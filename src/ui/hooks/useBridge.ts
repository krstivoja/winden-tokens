// Browser-tab side of the bridge: this UI, opened in a browser tab, driving the
// Figma file through the local relay (threat model and protocol: bridge/server.mjs).
//
// Client role ONLY. The Figma side of the relay is the separate "Bridge to
// browser" window (src/ui/bridge/); the app UI never acts as the plugin end.
//
// HOW THE CLIENT IS KEPT OUT OF THE FIGMA BUNDLE
//
// `BRIDGE_CLIENT_ENABLED` is a build-time constant. It is true in exactly two
// bundles, the two that are ever opened in a browser tab:
//
//   - the vite dev server (`import.meta.env.DEV`), and
//   - `vite build --mode browser` (BRIDGE_CLIENT_BUILD_MODE), the UI that the
//     `winden-tokens` relay serves (bridge/scripts/build-ui.mjs).
//
// A plain `npm run build` (mode `production`) folds it to `false`, `bridge`
// below to `null`, and the bundler drops `BridgeClient` together with every
// WebSocket reference, so `dist/index.html` — the file Figma loads — carries no
// network code at all. A runtime switch (dynamic import when not in Figma)
// would not do: vite-plugin-singlefile inlines dynamic imports into the one
// HTML file, so the code would still ship.

import { useEffect, useState } from 'react';
import {
  BRIDGE_CLOSE_VERSION,
  BRIDGE_EVENT_TAG,
  BRIDGE_PROTOCOL_VERSION,
  BRIDGE_URL,
  CLIENT_PAIRING_ANSWER,
  RELAY_PAIRING_REQUEST,
  RELAY_PAIRING_RESOLVED,
  RELAY_PLUGIN_CONNECTED,
  RELAY_PLUGIN_DISCONNECTED,
  RELAY_VERSION_MISMATCH,
  decodeEnvelope,
  encodeEnvelope,
  type BridgeEnvelope,
} from '../bridge/protocol';

export { BRIDGE_EVENT_TAG, BRIDGE_URL, BRIDGE_CLOSE_VERSION } from '../bridge/protocol';

declare global {
  interface ImportMeta {
    readonly env: {
      readonly MODE: string;
      readonly DEV: boolean;
    };
  }
}

/**
 * The vite mode that builds the relay-served browser UI. Must match the
 * `--mode` bridge/scripts/build-ui.mjs passes. Not `bridge`: that mode builds
 * the Figma-side bridge window (vite.config.ts).
 */
export const BRIDGE_CLIENT_BUILD_MODE = 'browser';

/** Build-time switch, see the header. Folds to a literal in every build. */
export const BRIDGE_CLIENT_ENABLED =
  import.meta.env.MODE !== 'test' &&
  (import.meta.env.DEV === true || import.meta.env.MODE === BRIDGE_CLIENT_BUILD_MODE);

/**
 * A browser tab is SERVED BY the relay (`winden-tokens` serves the built UI
 * from the same HTTP server the WebSocket upgrades from), so the relay is
 * wherever this page came from. Deriving the socket URL from `window.location`
 * is what makes `winden-tokens --port N` work at all, and it is what makes the
 * page and the socket literally same-origin — the assumption the relay's Origin
 * allowlist is built on.
 *
 * Returns null for anything that is not a plausible relay origin (a file://
 * page, a default-port URL), leaving the caller on the fixed default.
 */
export function relayUrlFromLocation(loc: {
  protocol: string;
  hostname: string;
  port: string;
}): string | null {
  if (loc.protocol !== 'http:' && loc.protocol !== 'https:') return null;
  if (!loc.hostname || !loc.port) return null;
  return `${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.hostname}:${loc.port}`;
}

/**
 * Where this tab should look for the relay. A tab on the vite dev server is
 * served by vite, not by the relay, so it uses the fixed default;
 * `import.meta.env.DEV` is precisely "served by vite dev" and folds to `false`
 * in the bundle the relay ships.
 */
export function bridgeUrl(): string {
  if (import.meta.env.DEV === true) return BRIDGE_URL;
  if (typeof window === 'undefined') return BRIDGE_URL;
  return relayUrlFromLocation(window.location) ?? BRIDGE_URL;
}

/**
 * Plugin messages a browser tab must never put on the relay.
 *
 * THE RULE: a browser tab may send anything that acts on the *document* — the
 * Figma file, its variables, its nodes — and nothing that acts on the *plugin
 * window* or duplicates what the bridge handshake already does on its behalf.
 *
 *   resize            — carries the BROWSER window's size; the sandbox would
 *                       resize the user's Figma panel to it.
 *   ui-ready          — the bootstrap pair. The relay forwards every client
 *   get-history-state   hello to the plugin, which answers it with exactly
 *                       these two messages, so sending them again re-reads the
 *                       whole file for nothing.
 *   cancel            — figma.closePlugin(); would also kill the bridge.
 *
 * Add a message here only if both halves hold: it targets the plugin window
 * rather than the document, or the bridge already issues it.
 */
export const BROWSER_SUPPRESSED_MESSAGES: ReadonlySet<string> = new Set([
  'resize',
  'ui-ready',
  'get-history-state',
  'cancel',
]);

/** True for a message a browser tab must not put on the relay (see above). */
export function isSuppressedFromBrowser(type: unknown): boolean {
  return typeof type === 'string' && BROWSER_SUPPRESSED_MESSAGES.has(type);
}

export interface BridgeStatus {
  /** This bundle carries the client and this window is a browser tab. */
  enabled: boolean;
  /** A relay socket is open. */
  connected: boolean;
  /**
   * The Figma "Bridge to browser" window is on the relay. Driven by the relay's
   * own status frames, so it also goes false when the plugin disappears.
   */
  peerAttached: boolean;
  /**
   * The first connect attempt has resolved (opened, or failed). Before that the
   * UI knows nothing and must not claim the relay is down — otherwise every
   * page load flashes a "not connected" banner for the duration of a handshake.
   */
  probed: boolean;
  /**
   * A failure the user has to act on, in plain words, or null. Today this is
   * only ever a bridge protocol-version mismatch.
   */
  error: string | null;
  /**
   * An unknown Figma plugin window is waiting to be approved: the 6-character
   * code it shows, which the user compares before approving. Null otherwise.
   */
  pairingCode: string | null;
}

type PayloadListener = (payload: any) => void;
type StatusListener = (status: BridgeStatus) => void;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;
/** Outbound messages held while the tab is still connecting. */
const MAX_QUEUED = 100;

/** Used when the relay gave no words of its own (an older relay, mostly). */
const DEFAULT_VERSION_MESSAGE =
  `Bridge protocol mismatch. The relay and the Winden Tokens plugin are different versions ` +
  `(this side speaks v${BRIDGE_PROTOCOL_VERSION}). Update the older half: npx winden-tokens@latest, ` +
  `or update the plugin in Figma.`;

/**
 * Plugin-vs-browser detection.
 *
 * Figma renders plugin UI inside an iframe it owns, so `window.parent` is a
 * different window object. A browser tab is the top level document, where
 * `window.parent === window`. That is the same structural signal the
 * `src/ui/index.html` mock-data script relies on: a property of how the
 * document is embedded, not a string anyone can spoof. (An embedded preview —
 * Storybook, say — reads as "inside Figma", the safe direction: no bridge.)
 */
export function isInsideFigma(): boolean {
  if (typeof window === 'undefined') return false;
  return window.parent !== window;
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
  private error: string | null = null;
  private pairingCode: string | null = null;
  private payloadListeners = new Set<PayloadListener>();
  private statusListeners = new Set<StatusListener>();

  getStatus(): BridgeStatus {
    return {
      enabled: true,
      connected: this.connected,
      peerAttached: this.peerAttached,
      probed: this.probed,
      error: this.error,
      pairingCode: this.pairingCode,
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
    setBrowserPreviewFlag(true);
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
   * Send one application message. Returns false when it could not go out yet;
   * the message is then held until the relay answers, so work done before the
   * socket opened is not lost (the relay is a tab's only transport).
   */
  send(payload: Record<string, unknown>): boolean {
    if (this.sendRaw(encodeEnvelope('client', 'message', payload))) return true;
    if (!this.abandoned && this.queue.length < MAX_QUEUED) this.queue.push(payload);
    return false;
  }

  /**
   * Answer the open pairing request. Sent as `kind: 'status'` — addressed to
   * the relay, never forwarded — with the code being answered, so a stale
   * answer to an earlier request is ignored by the relay. Never queued: an
   * answer only means something on the socket that received the request.
   */
  answerPairing(approve: boolean): boolean {
    const code = this.pairingCode;
    if (!code) return false;
    const sent = this.sendRaw(
      encodeEnvelope('client', 'status', { type: CLIENT_PAIRING_ANSWER, code, approve })
    );
    // Hide the prompt now; the relay's `pairing-resolved` confirms it for
    // every tab, and a request still open after a lost answer is re-sent on
    // the next hello.
    if (sent) this.setPairingCode(null);
    return sent;
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

  private sendRaw(frame: string): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    try {
      this.socket.send(frame);
      return true;
    } catch {
      return false;
    }
  }

  private connect(): void {
    if (this.abandoned || this.socket) return;

    this.attempts += 1;

    let socket: WebSocket;
    try {
      socket = new WebSocket(bridgeUrl());
    } catch {
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
        socket.send(encodeEnvelope('client', 'hello'));
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

    socket.onclose = (event?: { code?: number; reason?: string }) => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.setProbed();
      this.setConnected(false);

      // The relay refused us for speaking a different protocol version.
      // Reconnecting would produce the same refusal forever; stop, and say why.
      if (event?.code === BRIDGE_CLOSE_VERSION) {
        this.giveUp(event.reason || DEFAULT_VERSION_MESSAGE);
        return;
      }

      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.abandoned || this.timer) return;

    // No relay on the very first try: fall back to the mock data index.html
    // would have injected, so a plain `vite` preview still shows something.
    // Retries continue for the life of the tab, capped at RECONNECT_MAX_MS, so
    // starting the relay later attaches without a reload.
    if (!this.everConnected && this.attempts === 1) {
      setBrowserPreviewFlag(false);
      injectBrowserPreviewMock();
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

    // Only the plugin's application messages are for this tab.
    if (envelope.role !== 'plugin' || envelope.kind !== 'message') return;

    const payload = envelope.payload as Record<string, unknown>;

    // This is what the plugin sandbox replied. Deliver it to the handler maps,
    // then re-emit it as a window message for the components that listen on
    // `window` directly (client-storage replies, mostly).
    for (const listener of this.payloadListeners) listener(payload);
    window.postMessage({ pluginMessage: payload, [BRIDGE_EVENT_TAG]: true }, '*');
  }

  /**
   * The relay's own view of who is attached — the only way a tab learns its
   * plugin went away, since a socket that stays open says nothing about the
   * Figma window behind it — plus the pairing prompt.
   */
  private handleRelayStatus(payload: Record<string, unknown> | undefined): void {
    const type = payload?.type;

    switch (type) {
      case RELAY_PLUGIN_CONNECTED:
        this.setPeerAttached(true);
        return;
      case RELAY_PLUGIN_DISCONNECTED:
        this.setPeerAttached(false);
        return;
      case RELAY_PAIRING_REQUEST: {
        const code = payload?.code;
        if (typeof code === 'string' && code) this.setPairingCode(code);
        return;
      }
      case RELAY_PAIRING_RESOLVED:
        this.setPairingCode(null);
        return;
      case RELAY_VERSION_MISMATCH: {
        // The relay turned SOMEONE ELSE away — almost always the Figma plugin.
        // This socket is fine, so it is a banner, not a `giveUp`.
        const message = payload?.message;
        this.setError(typeof message === 'string' && message ? message : DEFAULT_VERSION_MESSAGE);
        return;
      }
      default:
        return;
    }
  }

  /**
   * Stop for good, with a message the UI shows. A version mismatch is the one
   * bridge failure the user must fix and cannot wait out.
   */
  private giveUp(message: string): void {
    this.abandoned = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.setError(message);
    console.error(`[winden-tokens bridge] ${message}`);
  }

  private setError(error: string | null): void {
    if (this.error === error) return;
    this.error = error;
    this.emitStatus();
  }

  private setConnected(connected: boolean): void {
    if (this.connected === connected) return;
    this.connected = connected;
    if (!connected) {
      // Both are the relay's to report; a new socket hears them again on hello.
      this.peerAttached = false;
      this.pairingCode = null;
    }
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

  private setPairingCode(code: string | null): void {
    if (this.pairingCode === code) return;
    this.pairingCode = code;
    this.emitStatus();
  }

  private emitStatus(): void {
    const status = this.getStatus();
    for (const listener of this.statusListeners) listener(status);
  }
}

/**
 * The single client for this tab. `null` inside Figma and in any bundle built
 * without the client, which lets the bundler drop `BridgeClient` entirely.
 */
export const bridge: BridgeClient | null =
  BRIDGE_CLIENT_ENABLED && !isInsideFigma() ? new BridgeClient() : null;

const DISABLED_STATUS: BridgeStatus = {
  enabled: false,
  connected: false,
  peerAttached: false,
  probed: false,
  error: null,
  pairingCode: null,
};

/** True when this window talks to Figma through the relay. */
export function isBridgeClient(): boolean {
  return bridge !== null;
}

/** Starts the client if there is one. Idempotent, safe everywhere. */
export function startBridge(): void {
  bridge?.start();
}

/** Outbound half of the transport. No-op (returns false) without a client. */
export function sendOverBridge(msg: Record<string, unknown>): boolean {
  return bridge ? bridge.send(msg) : false;
}

/** Inbound half: relay payloads addressed to this tab. */
export function subscribeToBridgeMessages(listener: PayloadListener): () => void {
  if (!bridge) return () => undefined;
  return bridge.onPayload(listener);
}

/** Approve or deny the Figma plugin window waiting for pairing. */
export function answerBridgePairing(approve: boolean): void {
  bridge?.answerPairing(approve);
}

/** Live bridge status, for the tab's connection banners. */
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
