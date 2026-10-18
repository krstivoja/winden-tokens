// Bridge wire protocol: the one place its names, codes and envelope live.
//
// Pure — no DOM, no WebSocket, no React — so the plugin-role window
// (src/ui/bridge/) and the browser-tab role (src/ui/hooks/useBridge.ts)
// can share it. Mirrors the PROTOCOL block in bridge/server.mjs; change the two
// together, and bump BRIDGE_PROTOCOL_VERSION on both sides for any wire change.

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
 * The relay's default port. A Figma plugin may only open a socket to a host its
 * manifest lists, and the manifest lists `ws://localhost:9337`, so for the
 * PLUGIN role this is not a default but a hard constraint.
 */
export const BRIDGE_PORT = 9337;
export const BRIDGE_URL = `ws://localhost:${BRIDGE_PORT}`;
/**
 * The relay serves the browser UI on the same port the plugin's socket is
 * pinned to, so the bridge window can always link back to it. Copied as a
 * literal in src/plugin/code.ts, which opens it.
 */
export const BRIDGE_UI_URL = `http://localhost:${BRIDGE_PORT}/`;
export const BRIDGE_PROTOCOL_VERSION = 2;

/** What the user runs to get a relay. Shown verbatim in the bridge window. */
export const BRIDGE_CLI_COMMAND = 'npx winden-tokens';
export const BRIDGE_CLI_UPDATE_COMMAND = 'npx winden-tokens@latest';

// ---------------------------------------------------------------------------
// Close codes (bridge/server.mjs `CLOSE_*`)
// ---------------------------------------------------------------------------

/** Another plugin socket took over (a second Figma window ran Bridge). */
export const BRIDGE_CLOSE_REPLACED = 4000;
/** Generic policy refusal: wrong role for the Origin, no hello, unpaired, … */
export const BRIDGE_CLOSE_POLICY = 4001;
/** Protocol-version mismatch. Retrying can never fix it. */
export const BRIDGE_CLOSE_VERSION = 4002;
/** Pairing was denied in the browser tab. */
export const BRIDGE_CLOSE_PAIRING_DENIED = 4003;
/** Nobody answered the pairing prompt in time. */
export const BRIDGE_CLOSE_PAIRING_TIMEOUT = 4004;
/** Another unknown plugin is already waiting for pairing. Retryable later. */
export const BRIDGE_CLOSE_PAIRING_BUSY = 4005;

// ---------------------------------------------------------------------------
// Relay status frames (`role: 'relay'`, `kind: 'status'`, payload.type)
// ---------------------------------------------------------------------------

export const RELAY_PLUGIN_CONNECTED = 'bridge/plugin-connected';
export const RELAY_PLUGIN_DISCONNECTED = 'bridge/plugin-disconnected';
/** To the plugin: `{ clients: N }` after a tab attached. */
export const RELAY_CLIENT_ATTACHED = 'bridge/client-attached';
/** To the plugin: `{ clients: N }` after a tab went away. */
export const RELAY_CLIENT_DETACHED = 'bridge/client-detached';
/** To clients: the relay turned someone away over protocol version. */
export const RELAY_VERSION_MISMATCH = 'bridge/version-mismatch';
/**
 * To the plugin: its key is unknown; `{ code }` (6 chars, Crockford base32,
 * uppercase) is shown on both sides. While pending, the relay drops every frame
 * the plugin sends.
 */
export const RELAY_PAIRING_PENDING = 'bridge/pairing-pending';
/**
 * To the plugin: the user approved. A key that was already trusted gets no
 * pairing frames at all, just the normal flow.
 */
export const RELAY_PAIRING_APPROVED = 'bridge/pairing-approved';
/** To clients: approve or deny an unknown plugin, `{ code }`. */
export const RELAY_PAIRING_REQUEST = 'bridge/pairing-request';
/**
 * To clients: the pending request ended,
 * `{ approved: boolean, reason?: 'denied' | 'timeout' | 'closed' }`.
 */
export const RELAY_PAIRING_RESOLVED = 'bridge/pairing-resolved';
/**
 * Client → relay, sent as `kind: 'status'` (the one status frame a client
 * authors): `{ type, code, approve: boolean }`. `code` must match the current
 * request or the relay ignores the answer.
 */
export const CLIENT_PAIRING_ANSWER = 'bridge/pairing-answer';

// ---------------------------------------------------------------------------
// Plugin key (pairing identity of one Figma install)
// ---------------------------------------------------------------------------

/** 128 bits, lowercase hex. The relay accepts 32–128 hex chars. */
export const PLUGIN_KEY_BYTES = 16;
const PLUGIN_KEY_PATTERN = /^[0-9a-f]{32}$/;

export function isValidPluginKey(value: unknown): value is string {
  return typeof value === 'string' && PLUGIN_KEY_PATTERN.test(value);
}

/**
 * A fresh random plugin key. The UI iframe generates it, not the sandbox: the
 * sandbox has no guaranteed `crypto.getRandomValues`.
 */
export function generatePluginKey(
  random: (bytes: Uint8Array) => Uint8Array = (bytes) => crypto.getRandomValues(bytes)
): string {
  const bytes = random(new Uint8Array(PLUGIN_KEY_BYTES));
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

/**
 * `payload` travels on `message` frames, on a client's `status` frame (its
 * pairing answer, CLIENT_PAIRING_ANSWER) and, from v2, on the plugin's `hello`
 * (`{ pluginKey }`). A hello without a payload stays payload-less.
 */
export function encodeEnvelope(role: BridgeRole, kind: BridgeKind, payload?: unknown): string {
  const envelope: BridgeEnvelope = { v: BRIDGE_PROTOCOL_VERSION, role, kind };
  if (kind === 'message' || kind === 'status' || (kind === 'hello' && payload !== undefined)) {
    envelope.payload = payload;
  }
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
  // Inbound, `status` is the relay's own kind and the relay's only kind: a peer
  // must not be able to impersonate the relay's view of who is attached. (A
  // client's pairing answer is `status` too, but it is addressed to the relay
  // and never forwarded, so no window ever decodes one.)
  if ((parsed.role === 'relay') !== (parsed.kind === 'status')) return null;
  if (parsed.kind !== 'hello' && (!parsed.payload || typeof parsed.payload !== 'object')) return null;

  return parsed as BridgeEnvelope;
}

/**
 * Marks a `window.postMessage` frame re-emitted from a relay payload, so a
 * mirror never sends it back out (see src/ui/bridge/client.ts).
 */
export const BRIDGE_EVENT_TAG = '__windenBridge';
