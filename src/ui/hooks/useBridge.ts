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
//      from the plugin role and no UI change. Retries continue for the life of
//      the window, but with capped backoff (one attempt per RECONNECT_MAX_MS
//      once cold), so "relay started after Figma" — the normal dev order —
//      attaches on its own instead of needing the plugin window reopened.

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

/**
 * Plugin messages a browser tab must never put on the relay.
 *
 * THE RULE: a browser tab may send anything that acts on the *document* — the
 * Figma file, its variables, its nodes — and nothing that acts on the *plugin
 * window* or duplicates what the bridge handshake already does on its behalf.
 * The tab does not own the Figma plugin window, and its own dimensions,
 * lifecycle and mount-time bootstrap say nothing about that window.
 *
 *   resize            — carries the BROWSER window's size. The plugin hands it
 *                       to the sandbox, which calls `figma.ui.resize()`, so the
 *                       user's Figma panel jumps to the size of a browser tab.
 *   ui-ready          — the bootstrap pair. The relay forwards every client
 *   get-history-state   hello to the plugin, and the plugin answers it with
 *                       exactly these two messages (`requestFullRefresh`), so a
 *                       tab that sends them again asks a 678-variable file to
 *                       be re-read for nothing.
 *
 * Add a message here only if both halves hold: it targets the plugin window
 * rather than the document, or the bridge already issues it.
 */
export const BROWSER_SUPPRESSED_MESSAGES: ReadonlySet<string> = new Set([
  'resize',
  'ui-ready',
  'get-history-state',
  // `cancel` makes the sandbox call figma.closePlugin(). Nothing in the UI
  // sends it today, but a browser tab must never be able to close the user's
  // plugin window — that would also kill the bridge the tab depends on.
  'cancel',
]);

/** True for a message a browser tab must not put on the relay (see above). */
export function isSuppressedFromBrowser(type: unknown): boolean {
  return typeof type === 'string' && BROWSER_SUPPRESSED_MESSAGES.has(type);
}

/** Build-time switch. Folds to a literal in a production build. */
export const BRIDGE_ENABLED =
  import.meta.env.MODE !== 'test' &&
  (import.meta.env.DEV === true ||
    import.meta.env.VITE_BRIDGE === '1' ||
    import.meta.env.VITE_BRIDGE === 'true');

export type BridgeRole = 'plugin' | 'client';
/** The relay speaks too, under a third role it alone may claim. */
export type BridgeSender = BridgeRole | 'relay';
export type BridgeKind = 'hello' | 'message' | 'status';

export interface BridgeEnvelope {
  v: number;
  role: BridgeSender;
  kind: BridgeKind;
  payload?: unknown;
}

/**
 * Relay status frames (`role: 'relay'`, `kind: 'status'`). The relay never
 * looks inside an application payload; these are the only frames it authors.
 * See the PROTOCOL block in bridge/server.mjs.
 */
export const RELAY_PLUGIN_CONNECTED = 'bridge/plugin-connected';
export const RELAY_PLUGIN_DISCONNECTED = 'bridge/plugin-disconnected';
export const RELAY_CLIENT_ATTACHED = 'bridge/client-attached';
export const RELAY_CLIENT_DETACHED = 'bridge/client-detached';

export interface BridgeStatus {
  /** The bridge was compiled in and is allowed to open a socket. */
  enabled: boolean;
  /** Which side of the relay this window is. */
  role: BridgeRole;
  /** A relay socket is open. */
  connected: boolean;
  /**
   * The other side is on the relay: for a browser tab, the Figma plugin window;
   * for the plugin, at least one browser tab. Driven by the relay's own status
   * frames, so it also goes false when the peer disappears.
   */
  peerAttached: boolean;
  /**
   * The first connect attempt has resolved (opened, or failed). Before that the
   * UI knows nothing and must not claim the relay is down — otherwise every
   * page load flashes a "not connected" banner for the duration of a handshake.
   */
  probed: boolean;
}

type PayloadListener = (payload: any) => void;
type StatusListener = (status: BridgeStatus) => void;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;
/** Outbound messages held while a browser tab is still connecting. */
const MAX_QUEUED = 100;
/**
 * A full refresh of a real file is expensive (678 variables in the file this
 * was measured on). Several things can ask for one at once — a client hello,
 * the relay's `client-attached`, a second tab — so a request is coalesced while
 * an earlier one is still outstanding. The deadline only stops a lost reply
 * (plugin reload mid-fetch) from wedging refreshes for the session.
 */
const REFRESH_DEADLINE_MS = 30000;

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
  if (parsed.role !== 'plugin' && parsed.role !== 'client' && parsed.role !== 'relay') return null;
  if (parsed.kind !== 'hello' && parsed.kind !== 'message' && parsed.kind !== 'status') return null;
  // `status` is the relay's own kind and the relay's only kind: a peer must not
  // be able to impersonate the relay's view of who is attached, and the relay
  // never sends anything else.
  if ((parsed.role === 'relay') !== (parsed.kind === 'status')) return null;
  if (parsed.kind !== 'hello' && (!parsed.payload || typeof parsed.payload !== 'object')) return null;

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
  private probed = false;
  private refreshDeadline = 0;
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
      probed: this.probed,
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
      this.setProbed();
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
      this.setProbed();
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
      this.setProbed();
      this.setConnected(false);
      this.setPeerAttached(false);
      this.refreshDeadline = 0;
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.abandoned || this.timer) return;

    if (!this.everConnected) {
      // No cold give-up, in either role. The dev flow is "open Figma, then run
      // `npm run dev:bridge`", so a plugin that stopped trying after ~15s could
      // only be recovered by closing and reopening the plugin window. Retrying
      // for the life of the window costs one silent, failed socket per
      // RECONNECT_MAX_MS and is invisible with no relay running. A production
      // build has no WebSocket code at all (BRIDGE_ENABLED), so this loop
      // cannot exist there — that is the guarantee that makes it affordable.
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

    if (envelope.role === 'relay') {
      this.handleRelayStatus(envelope.payload as Record<string, unknown>);
      return;
    }

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

  /**
   * The relay's own view of who is attached. This is the only way either side
   * learns that its peer went away: the relay forwards a client hello to the
   * plugin, but it never forwards the plugin's hello to clients, and a socket
   * that stays open tells a browser tab nothing about the Figma window behind
   * it. Without these frames a tab whose plugin closed just sits there empty.
   */
  private handleRelayStatus(payload: Record<string, unknown> | undefined): void {
    const type = payload?.type;

    if (this.role === 'client') {
      if (type === RELAY_PLUGIN_CONNECTED) this.setPeerAttached(true);
      else if (type === RELAY_PLUGIN_DISCONNECTED) this.setPeerAttached(false);
      return;
    }

    if (type === RELAY_CLIENT_ATTACHED) {
      this.setPeerAttached(true);
      // Covers the tab-first case: a tab already on the relay when the plugin
      // connects gets no forwarded hello, so this is its only refresh cue.
      // Coalesced against the hello path, which fires for the same event.
      this.requestFullRefresh();
      return;
    }

    if (type === RELAY_CLIENT_DETACHED && payload?.clients === 0) {
      // Last tab gone: leave headless mode instead of waiting for a human.
      this.setPeerAttached(false);
    }
  }

  /**
   * Plugin only: re-send the bootstrap the UI sends on mount.
   *
   * Coalesced. Every client hello and every `client-attached` asks for this, so
   * N tabs (or one tab plus its own relay status frame) would otherwise mean N
   * full reads of the file, serialised in the single-threaded sandbox. One
   * outstanding refresh answers all of them: the reply is broadcast to every
   * attached client, so a tab that arrives mid-refresh still gets the data.
   */
  private requestFullRefresh(): void {
    const now = Date.now();
    if (now < this.refreshDeadline) return;
    this.refreshDeadline = now + REFRESH_DEADLINE_MS;

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
      // Never mirror a frame this module itself re-emitted onto `window`: that
      // frame came off the relay, and sending it back would be an echo. Only
      // the client role re-emits today, and only the plugin role mirrors, so
      // this cannot fire in the current wiring — it is the invariant that keeps
      // it that way if a future change ever re-emits on the plugin side.
      if (event.data?.[BRIDGE_EVENT_TAG]) return;

      const payload = event.data?.pluginMessage;
      if (!payload || typeof payload !== 'object') return;

      // The outstanding refresh has been answered; the next cue may ask again.
      if (payload.type === 'data-loaded') this.refreshDeadline = 0;

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

  private setProbed(): void {
    if (this.probed) return;
    this.probed = true;
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
  probed: false,
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
