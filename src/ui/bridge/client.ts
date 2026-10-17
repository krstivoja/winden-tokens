// The plugin role of the browser bridge: the "Bridge to browser" window.
//
// Ported from the plugin half of BridgeClient (src/ui/hooks/useBridge.ts):
// everything the Figma sandbox posts to this window goes out to the relay, and
// every command a browser tab sends comes back in and is handed to the sandbox
// unchanged. This window renders nothing of the app; it only reports how the
// connection is doing.

import {
  BRIDGE_EVENT_TAG,
  RELAY_CLIENT_ATTACHED,
  RELAY_CLIENT_DETACHED,
  RELAY_PAIRING_APPROVED,
  RELAY_PAIRING_PENDING,
  decodeEnvelope,
  encodeEnvelope,
  type BridgeEnvelope,
} from './protocol';
import { BRIDGE_SANDBOX_PREFIX } from './key';
import { closeOutcome, isTerminal, type BridgePhase } from './state';

export const RECONNECT_BASE_MS = 1000;
export const RECONNECT_MAX_MS = 15000;
/** See requestFullRefresh. Only stops a lost reply from wedging refreshes. */
export const REFRESH_DEADLINE_MS = 30000;
/**
 * After the socket opens, how long to wait for a `pairing-pending` before
 * calling the link "Connected". A trusted key gets no pairing frame at all, an
 * unknown one gets it on the next loopback tick; without the grace the window
 * would flash "Connected" before every pairing prompt.
 */
export const OPEN_GRACE_MS = 400;

/**
 * Commands from the relay that never reach the sandbox.
 *
 *   resize   — a tab's own size; would blow this small window up to it.
 *   cancel   — figma.closePlugin(), which would kill the bridge itself.
 *   bridge-* — this window's private sandbox channel (the plugin key).
 */
const RELAY_BLOCKED_COMMANDS: ReadonlySet<string> = new Set(['resize', 'cancel']);

export function isBlockedFromRelay(type: unknown): boolean {
  if (typeof type !== 'string') return true;
  return RELAY_BLOCKED_COMMANDS.has(type) || type.startsWith(BRIDGE_SANDBOX_PREFIX);
}

/**
 * Sandbox replies that stay in this window: the `bridge-*` channel, which
 * carries the plugin key (SANDBOX_KEY_REPLY). A tab must never see the key.
 */
export function isPrivateSandboxMessage(type: unknown): boolean {
  return typeof type === 'string' && type.startsWith(BRIDGE_SANDBOX_PREFIX);
}

/**
 * Minimal WebSocket surface, so tests can supply a fake. Handler events are
 * `any` because DOM's handler types (MessageEvent, CloseEvent) would otherwise
 * make the real WebSocket unassignable; the handlers below read only
 * `data`, `code` and `reason`.
 */
export interface SocketLike {
  readyState: number;
  onopen: ((event: any) => void) | null;
  onmessage: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onclose: ((event: any) => void) | null;
  send(data: string): void;
  close(): void;
}

export interface PluginBridgeDeps {
  url: string;
  createSocket(url: string): SocketLike;
  /** `parent.postMessage({ pluginMessage }, '*')` in the real window. */
  postToSandbox(message: Record<string, unknown>): void;
  /** Subscribe to `pluginMessage`s the sandbox posts to this window. */
  onSandboxMessage(handler: (message: Record<string, unknown>) => void): () => void;
  now?: () => number;
}

const SOCKET_OPEN = 1;

type Listener = (state: BridgePhase) => void;

export class PluginBridge {
  private readonly deps: PluginBridgeDeps;
  private key = '';
  private socket: SocketLike | null = null;
  private state: BridgePhase = { phase: 'connecting' };
  private paired = false;
  private attempts = 0;
  private stopped = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private graceTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshDeadline = 0;
  private unsubscribeSandbox: (() => void) | null = null;
  private listeners = new Set<Listener>();

  constructor(deps: PluginBridgeDeps) {
    this.deps = deps;
  }

  getState(): BridgePhase {
    return this.state;
  }

  onState(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(pluginKey: string): void {
    this.key = pluginKey;
    if (!this.unsubscribeSandbox) {
      this.unsubscribeSandbox = this.deps.onSandboxMessage((message) => this.mirror(message));
    }
    this.stopped = false;
    this.attempts = 0;
    this.connect();
  }

  /** The Retry button: leave a terminal state and try again right away. */
  retry(): void {
    if (!this.key) return;
    this.clearTimers();
    this.dropSocket();
    this.setState({ phase: 'connecting' });
    this.start(this.key);
  }

  stop(): void {
    this.stopped = true;
    this.clearTimers();
    this.dropSocket();
    this.unsubscribeSandbox?.();
    this.unsubscribeSandbox = null;
  }

  private connect(): void {
    if (this.stopped || this.socket) return;
    this.attempts += 1;

    let socket: SocketLike;
    try {
      socket = this.deps.createSocket(this.deps.url);
    } catch {
      // Figma refuses the socket outright when the manifest does not allow the
      // domain. Same as "no relay", from the user's side.
      this.handleClose(undefined);
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.attempts = 0;
      try {
        socket.send(encodeEnvelope('plugin', 'hello', { pluginKey: this.key }));
      } catch {
        return;
      }
      this.graceTimer = setTimeout(() => {
        this.graceTimer = null;
        if (this.socket === socket && this.state.phase !== 'pairing') this.markPaired();
      }, OPEN_GRACE_MS);
    };

    socket.onmessage = (event: { data: unknown }) => {
      if (this.socket !== socket) return;
      this.handleEnvelope(decodeEnvelope(event.data));
    };

    // Swallowed: a refused connection is the normal state with no relay, and
    // `onclose` follows to drive the retry policy.
    socket.onerror = () => undefined;

    socket.onclose = (event?: { code?: number; reason?: string }) => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.handleClose(event?.code, event?.reason);
    };
  }

  private handleClose(code: number | undefined, reason?: string): void {
    if (this.graceTimer) {
      clearTimeout(this.graceTimer);
      this.graceTimer = null;
    }
    this.paired = false;
    this.refreshDeadline = 0;

    const outcome = closeOutcome(code);
    if (outcome === 'version') {
      this.setState({ phase: 'version', reason: reason || '' });
    } else if (outcome === 'denied') {
      this.setState({ phase: 'denied' });
    } else if (outcome === 'timed-out') {
      this.setState({ phase: 'timed-out' });
    } else if (outcome === 'replaced') {
      this.setState({ phase: 'replaced' });
    } else if (outcome === 'busy') {
      this.setState({ phase: 'busy' });
    } else {
      this.setState({ phase: 'relay-down' });
    }

    if (isTerminal(this.state)) {
      if (this.state.phase === 'version' && reason) {
        console.error(`[winden-tokens bridge] ${reason}`);
      }
      return;
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** Math.max(0, this.attempts - 1), RECONNECT_MAX_MS);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private handleEnvelope(envelope: BridgeEnvelope | null): void {
    if (!envelope) return;

    if (envelope.role === 'relay') {
      this.handleRelayStatus(envelope.payload as Record<string, unknown>);
      return;
    }

    // The relay never echoes the plugin's own frames, but stay robust.
    if (envelope.role === 'plugin') return;

    if (envelope.kind === 'hello') {
      // A browser tab attached (or re-attached) after us. It has no data yet.
      this.markPaired();
      if (this.state.phase === 'connected' && this.state.tabs === 0) {
        this.setState({ phase: 'connected', tabs: 1 });
      }
      this.requestFullRefresh();
      return;
    }

    const payload = envelope.payload as Record<string, unknown>;
    if (isBlockedFromRelay(payload.type)) return;
    // Only this window can reach the Figma API: hand the command over as is.
    this.deps.postToSandbox(payload);
  }

  private handleRelayStatus(payload: Record<string, unknown> | undefined): void {
    const type = payload?.type;

    if (type === RELAY_PAIRING_PENDING) {
      const code = typeof payload?.code === 'string' ? payload.code : '';
      this.paired = false;
      this.setState({ phase: 'pairing', code });
      return;
    }

    if (type === RELAY_PAIRING_APPROVED) {
      this.markPaired();
      return;
    }

    if (type === RELAY_CLIENT_ATTACHED || type === RELAY_CLIENT_DETACHED) {
      this.markPaired();
      const clients = typeof payload?.clients === 'number' ? payload.clients : 0;
      this.setState({ phase: 'connected', tabs: Math.max(0, clients) });
      // The tab-first case: a tab already on the relay when we connect gets no
      // forwarded hello, so this is its only refresh cue. Coalesced.
      if (type === RELAY_CLIENT_ATTACHED) this.requestFullRefresh();
    }
  }

  private markPaired(): void {
    if (this.graceTimer) {
      clearTimeout(this.graceTimer);
      this.graceTimer = null;
    }
    if (this.paired && this.state.phase === 'connected') return;
    this.paired = true;
    if (this.state.phase !== 'connected') this.setState({ phase: 'connected', tabs: 0 });
  }

  /**
   * Re-send the bootstrap a freshly mounted UI sends. Coalesced: every client
   * hello and every `client-attached` asks for it, and one outstanding refresh
   * answers all of them because the reply is broadcast to every attached tab.
   */
  private requestFullRefresh(): void {
    const now = (this.deps.now ?? Date.now)();
    if (now < this.refreshDeadline) return;
    this.refreshDeadline = now + REFRESH_DEADLINE_MS;
    this.deps.postToSandbox({ type: 'ui-ready' });
    this.deps.postToSandbox({ type: 'get-history-state' });
  }

  /** Everything the sandbox posts to this window goes out to the relay. */
  private mirror(message: Record<string, unknown>): void {
    if (isPrivateSandboxMessage(message.type)) return;
    // The outstanding refresh has been answered; the next cue may ask again.
    if (message.type === 'data-loaded') this.refreshDeadline = 0;

    // Unpaired, the relay drops plugin frames anyway; do not offer them.
    const socket = this.socket;
    if (!this.paired || !socket || socket.readyState !== SOCKET_OPEN) return;
    try {
      socket.send(encodeEnvelope('plugin', 'message', message));
    } catch {
      /* the close handler deals with a dead socket */
    }
  }

  private clearTimers(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.graceTimer) clearTimeout(this.graceTimer);
    this.reconnectTimer = null;
    this.graceTimer = null;
  }

  private dropSocket(): void {
    const socket = this.socket;
    this.socket = null;
    this.paired = false;
    if (!socket) return;
    socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
    try {
      socket.close();
    } catch {
      /* nothing useful to do */
    }
  }

  private setState(next: BridgePhase): void {
    const prev = this.state;
    if (JSON.stringify(prev) === JSON.stringify(next)) return;
    this.state = next;
    for (const listener of this.listeners) listener(next);
  }
}

/**
 * Sandbox → window frames, minus anything this module (or useBridge) re-emitted
 * onto `window` from a relay payload — mirroring that would be an echo.
 */
export function sandboxMessageFrom(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null;
  if ((data as Record<string, unknown>)[BRIDGE_EVENT_TAG]) return null;
  const payload = (data as { pluginMessage?: unknown }).pluginMessage;
  if (!payload || typeof payload !== 'object') return null;
  return payload as Record<string, unknown>;
}
