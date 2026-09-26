// Dev-only bridge between the Figma plugin UI and a browser tab, via a local
// relay (see plans/browser-bridge.md).
//
// Nothing in the shipped plugin may depend on this. Two independent guards:
//
//   1. BRIDGE_ENABLED is a build-time constant. In a production `vite build`
//      it folds to `false`, the client below is never constructed, and the
//      module never touches WebSocket. Set VITE_BRIDGE=1 to build a bridge
//      enabled bundle for Figma; the vite dev server enables it on its own.
//   2. Even when enabled, a failed connect is completely silent: no logging
//      from the plugin role, no UI change, and a hard cap on cold retries so
//      a missing relay can never turn into a retry storm.

import { useEffect, useState } from 'react';

declare global {
  interface ImportMeta {
    readonly env: {
      readonly MODE: string;
      readonly DEV: boolean;
      readonly VITE_BRIDGE?: string;
    };
  }
}

export const BRIDGE_URL = 'ws://localhost:9337';
export const BRIDGE_PROTOCOL_VERSION = 1;

/**
 * Marks a `window.postMessage` frame that this module re-emitted from a relay
 * payload. `usePluginMessages` already received it through the bridge
 * subscription, so its window listener skips tagged frames; the handful of
 * components that listen on `window` directly still see them.
 */
export const BRIDGE_EVENT_TAG = '__windenBridge';

/** Build-time switch. Folds to a literal in a production build. */
export const BRIDGE_ENABLED =
  import.meta.env.MODE !== 'test' &&
  (import.meta.env.DEV === true ||
    import.meta.env.VITE_BRIDGE === '1' ||
    import.meta.env.VITE_BRIDGE === 'true');

export type BridgeRole = 'plugin' | 'client';
export type BridgeKind = 'hello' | 'message';

export interface BridgeEnvelope {
  v: number;
  role: BridgeRole;
  kind: BridgeKind;
  payload?: unknown;
}

export interface BridgeStatus {
  /** The bridge was compiled in and is allowed to open a socket. */
  enabled: boolean;
  /** Which side of the relay this window is. */
  role: BridgeRole;
  /** A relay socket is open. */
  connected: boolean;
  /** The other side (browser tab, or plugin) has said hello over the relay. */
  peerAttached: boolean;
}

type PayloadListener = (payload: any) => void;
type StatusListener = (status: BridgeStatus) => void;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;
/**
 * How many times the plugin retries a relay that has never answered. After
 * this it gives up for the session — a developer who starts the relay later
 * reloads the plugin. A browser tab has no other transport, so it keeps
 * retrying with the same backoff.
 */
const PLUGIN_COLD_ATTEMPTS = 4;
/** Outbound messages held while a browser tab is still connecting. */
const MAX_QUEUED = 100;

/**
 * Plugin-vs-browser detection.
 *
 * Figma renders plugin UI inside an iframe it owns, so `window.parent` is a
 * different window object. A browser tab serving this app from vite is the top
 * level document, where `window.parent === window`. That is the same structural
 * signal the existing `src/ui/index.html` mock-data script already relies on:
 * it is a property of how the document is embedded, not a string anyone can
 * spoof, and it needs no user agent sniffing. (An embedded preview — Storybook,
 * say — reads as "plugin", which is the safe direction: `post()` keeps doing
 * exactly what it does today.)
 */
export function isInsideFigma(): boolean {
  if (typeof window === 'undefined') return false;
  return window.parent !== window;
}

export function bridgeRole(): BridgeRole {
  return isInsideFigma() ? 'plugin' : 'client';
}

export function encodeEnvelope(role: BridgeRole, kind: BridgeKind, payload?: unknown): string {
  const envelope: BridgeEnvelope = { v: BRIDGE_PROTOCOL_VERSION, role, kind };
  if (kind === 'message') envelope.payload = payload;
  return JSON.stringify(envelope);
}

export function decodeEnvelope(raw: unknown): BridgeEnvelope | null {
  if (typeof raw !== 'string') return null;

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  if (parsed.v !== BRIDGE_PROTOCOL_VERSION) return null;
  if (parsed.role !== 'plugin' && parsed.role !== 'client') return null;
  if (parsed.kind !== 'hello' && parsed.kind !== 'message') return null;
  if (parsed.kind === 'message' && (!parsed.payload || typeof parsed.payload !== 'object')) return null;

  return parsed as BridgeEnvelope;
}

/**
 * The browser preview injects mock data from index.html when it is the only
 * data source. Let it know the relay is (or is not) supplying real data.
 */
function setBrowserPreviewFlag(active: boolean): void {
  if (typeof window === 'undefined') return;
  (window as any).__WINDEN_BRIDGE_ACTIVE__ = active;
}

function injectBrowserPreviewMock(): void {
  if (typeof window === 'undefined') return;
  const inject = (window as any).__WINDEN_INJECT_MOCK__;
  if (typeof inject === 'function') inject();
}

export class BridgeClient {
  readonly role: BridgeRole;

  private socket: WebSocket | null = null;
  private started = false;
  private abandoned = false;
  private attempts = 0;
  private everConnected = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private queue: Record<string, unknown>[] = [];
  private connected = false;
  private peerAttached = false;
  private payloadListeners = new Set<PayloadListener>();
  private statusListeners = new Set<StatusListener>();
  private figmaListener: ((event: MessageEvent) => void) | null = null;

  constructor(role: BridgeRole) {
    this.role = role;
  }

  getStatus(): BridgeStatus {
    return {
      enabled: true,
      role: this.role,
      connected: this.connected,
      peerAttached: this.peerAttached,
    };
  }

  /** Idempotent. Safe to call from several effects. */
  start(): void {
    if (this.started || this.abandoned) return;
    if (typeof WebSocket === 'undefined') {
      this.abandoned = true;
      return;
    }
    this.started = true;

    if (this.role === 'plugin') {
      this.mirrorFigmaMessages();
    } else {
      setBrowserPreviewFlag(true);
    }

    this.connect();
  }

  /** Stops reconnecting and drops the socket. Used by tests and teardown. */
  stop(): void {
    this.abandoned = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      try {
        socket.close();
      } catch {
        /* nothing useful to do */
      }
    }
    this.setConnected(false);
  }

  /**
   * Send one application message. Returns false when it went nowhere, which is
   * the normal case in the plugin with no relay running.
   */
  send(payload: Record<string, unknown>): boolean {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(encodeEnvelope(this.role, 'message', payload));
        return true;
      } catch {
        return false;
      }
    }

    // A browser tab has no other transport: hold the message until the relay
    // answers, so work done before the socket opened is not lost. The plugin
    // never queues — `parent.postMessage` already delivered it.
    if (this.role === 'client' && !this.abandoned) {
      if (this.queue.length < MAX_QUEUED) this.queue.push(payload);
    }
    return false;
  }

  onPayload(listener: PayloadListener): () => void {
    this.payloadListeners.add(listener);
    return () => {
      this.payloadListeners.delete(listener);
    };
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /** Local escape hatch out of headless mode (see App). */
  releasePeer(): void {
    this.setPeerAttached(false);
  }

  private connect(): void {
    if (this.abandoned || this.socket) return;

    this.attempts += 1;

    let socket: WebSocket;
    try {
      socket = new WebSocket(BRIDGE_URL);
    } catch {
      // Figma refuses the socket outright when the manifest does not allow the
      // domain. Treat it as "no relay" and stay quiet.
      this.scheduleReconnect();
      return;
    }

    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.everConnected = true;
      this.attempts = 0;
      try {
        socket.send(encodeEnvelope(this.role, 'hello'));
      } catch {
        return;
      }
      this.setConnected(true);
      this.flushQueue();
    };

    socket.onmessage = (event: MessageEvent) => {
      if (this.socket !== socket) return;
      this.handleEnvelope(decodeEnvelope(event.data));
    };

    // Swallowed on purpose: a refused connection must not reach the console.
    socket.onerror = () => {
      /* no-op — `onclose` follows and drives the retry policy */
    };

    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.setConnected(false);
      this.setPeerAttached(false);
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.abandoned || this.timer) return;

    if (!this.everConnected) {
      if (this.role === 'plugin' && this.attempts >= PLUGIN_COLD_ATTEMPTS) {
        // Nothing is listening. Give up for good: the plugin is now exactly
        // what it is today, with no timers left running.
        this.abandoned = true;
        this.queue = [];
        return;
      }
      if (this.role === 'client' && this.attempts === 1) {
        // No relay for the browser preview either — fall back to the mock data
        // index.html would have injected.
        setBrowserPreviewFlag(false);
        injectBrowserPreviewMock();
      }
    }

    const delay = Math.min(RECONNECT_BASE_MS * 2 ** Math.max(0, this.attempts - 1), RECONNECT_MAX_MS);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.connect();
    }, delay);
  }

  private flushQueue(): void {
    if (!this.queue.length) return;
    const pending = this.queue;
    this.queue = [];
    for (const payload of pending) this.send(payload);
  }

  private handleEnvelope(envelope: BridgeEnvelope | null): void {
    if (!envelope) return;
    // Frames the relay echoed back from this same side are not interesting.
    if (envelope.role === this.role) return;

    if (envelope.kind === 'hello') {
      this.setPeerAttached(true);
      if (this.role === 'plugin') {
        // A browser tab just attached (or re-attached). It has no data yet, so
        // ask the plugin sandbox for a full refresh; the reply travels back out
        // through the mirror below.
        this.requestFullRefresh();
      }
      return;
    }

    const payload = envelope.payload as Record<string, unknown>;

    if (this.role === 'plugin') {
      // A command from the browser. Only the plugin window can reach the Figma
      // API, so hand it straight to the sandbox unchanged.
      window.parent.postMessage({ pluginMessage: payload }, '*');
      return;
    }

    // Browser tab: this is what the plugin sandbox replied. Deliver it to the
    // handler maps, then re-emit it as a window message for the components that
    // listen on `window` directly (client-storage replies, mostly).
    for (const listener of this.payloadListeners) listener(payload);
    window.postMessage({ pluginMessage: payload, [BRIDGE_EVENT_TAG]: true }, '*');
  }

  /** Plugin only: re-send the bootstrap the UI sends on mount. */
  private requestFullRefresh(): void {
    window.parent.postMessage({ pluginMessage: { type: 'ui-ready' } }, '*');
    window.parent.postMessage({ pluginMessage: { type: 'get-history-state' } }, '*');
  }

  /**
   * Plugin only: everything the Figma sandbox posts to this window is also sent
   * to the relay. One listener for the whole window, so a message is mirrored
   * once no matter how many components are mounted.
   */
  private mirrorFigmaMessages(): void {
    if (this.figmaListener) return;
    this.figmaListener = (event: MessageEvent) => {
      const payload = event.data?.pluginMessage;
      if (!payload || typeof payload !== 'object') return;
      this.send(payload);
    };
    window.addEventListener('message', this.figmaListener);
  }

  private setConnected(connected: boolean): void {
    if (this.connected === connected) return;
    this.connected = connected;
    if (!connected) this.peerAttached = false;
    this.emitStatus();
  }

  private setPeerAttached(peerAttached: boolean): void {
    if (this.peerAttached === peerAttached) return;
    this.peerAttached = peerAttached;
    this.emitStatus();
  }

  private emitStatus(): void {
    const status = this.getStatus();
    for (const listener of this.statusListeners) listener(status);
  }
}

/**
 * The single client for this window. `null` when the bridge is compiled out,
 * which lets the bundler drop `BridgeClient` from a production build.
 */
export const bridge: BridgeClient | null = BRIDGE_ENABLED ? new BridgeClient(bridgeRole()) : null;

const DISABLED_STATUS: BridgeStatus = {
  enabled: false,
  role: 'plugin',
  connected: false,
  peerAttached: false,
};

/** Starts the bridge if it is compiled in. Idempotent, safe everywhere. */
export function startBridge(): void {
  bridge?.start();
}

/** Outbound half of the transport. No-op (returns false) without a relay. */
export function sendOverBridge(msg: Record<string, unknown>): boolean {
  return bridge ? bridge.send(msg) : false;
}

/** Inbound half: relay payloads addressed to this window. */
export function subscribeToBridgeMessages(listener: PayloadListener): () => void {
  if (!bridge) return () => undefined;
  return bridge.onPayload(listener);
}

/** Live bridge status, for the headless status strip. */
export function useBridge(): BridgeStatus {
  const [status, setStatus] = useState<BridgeStatus>(() => bridge?.getStatus() ?? DISABLED_STATUS);

  useEffect(() => {
    if (!bridge) return;
    const unsubscribe = bridge.onStatus(setStatus);
    bridge.start();
    setStatus(bridge.getStatus());
    return unsubscribe;
  }, []);

  return status;
}

/** Leave headless mode locally (the browser tab went away without a signal). */
export function releaseBridgePeer(): void {
  bridge?.releasePeer();
}
