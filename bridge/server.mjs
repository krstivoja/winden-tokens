#!/usr/bin/env node
/**
 * Winden Tokens — browser bridge relay (DEV ONLY, never shipped).
 *
 * Pairs the Figma plugin UI with one or more browser tabs running the same UI,
 * so the Relationships graph can be driven full-size in a browser tab against
 * the Figma file that is currently open.
 *
 *   Figma plugin UI ──ws──▶ relay (127.0.0.1:9337) ──ws──▶ browser tab
 *          ▲                                                  │
 *          └──────────── commands ◀───────────────────────────┘
 *
 * The relay holds no application state and never looks inside `payload`.
 * Adding a new plugin command needs no change here.
 *
 * ---------------------------------------------------------------------------
 * PROTOCOL  (the plugin side and the browser side must both match this)
 * ---------------------------------------------------------------------------
 *
 * Every frame is JSON:
 *
 *     { v: 1, role: 'plugin' | 'client', kind: 'hello' | 'message', payload }
 *
 * `payload` is opaque to the relay. It carries the existing plugin message
 * types verbatim (`refresh`, `create-variable`, `bind-node-property`, …).
 * The relay only reads `payload.type` for logging, and forwards the ORIGINAL
 * bytes unchanged — it never re-serialises your payload.
 *
 * 1. hello — first frame on every socket, names the role:
 *
 *        { v: 1, role: 'plugin', kind: 'hello', payload: {...} }
 *        { v: 1, role: 'client', kind: 'hello', payload: {...} }
 *
 *    Before its hello a socket is unidentified: the relay sends it nothing and
 *    forwards nothing from it. A socket that has not said hello within
 *    HELLO_TIMEOUT_MS is closed.
 *
 * 2. Routing — plugin ──▶ every client, any client ──▶ the plugin.
 *    Clients never reach each other.
 *
 * 3. CLIENT HELLO IS FORWARDED TO THE PLUGIN VERBATIM.
 *    When a browser tab says hello, the plugin socket receives that exact
 *    frame — `{ v:1, role:'client', kind:'hello', payload }`. That is the
 *    plugin's cue to push a full `refresh`, so a tab opened late still gets
 *    current data. There is no special wrapper kind for this: the plugin
 *    simply listens for `kind === 'hello'` from `role === 'client'`.
 *
 * 4. Relay-generated status frames use a THIRD role, `'relay'`, and the kind
 *    `'status'`, so they can never be confused with app traffic:
 *
 *        { v:1, role:'relay', kind:'status', payload:{ type:'bridge/plugin-connected'    } }
 *        { v:1, role:'relay', kind:'status', payload:{ type:'bridge/plugin-disconnected' } }
 *            → sent to clients. `plugin-disconnected` is what lets the browser
 *              say "lost the document" instead of hanging. A client also gets
 *              one of these immediately after its own hello, describing the
 *              current state.
 *
 *        { v:1, role:'relay', kind:'status', payload:{ type:'bridge/client-attached', clients:N } }
 *        { v:1, role:'relay', kind:'status', payload:{ type:'bridge/client-detached', clients:N } }
 *            → sent to the plugin, for the headless status strip. Purely
 *              informational; safe to ignore. The refresh cue is the forwarded
 *              client hello in (3), NOT these frames.
 *
 * Exactly one plugin socket exists at a time. Figma reloads the plugin often,
 * so a new plugin hello REPLACES the old socket, closing it with code 4000.
 *
 * ---------------------------------------------------------------------------
 * THREAT MODEL  (read before changing the Origin logic)
 * ---------------------------------------------------------------------------
 *
 * A WebSocket handshake is NOT subject to CORS. Without an Origin check, any
 * web page the user happens to have open in any tab could connect to
 * ws://localhost:9337 and issue write commands into their Figma file. The
 * same-origin policy does not stop it, and no preflight is made.
 *
 * Two mitigations, both required:
 *
 *   1. Bind 127.0.0.1 only — never 0.0.0.0. Nothing off this machine can reach
 *      the relay, so a hostile device on the LAN is out of the picture.
 *
 *   2. Check the Origin header at handshake and answer 403 before the upgrade
 *      completes. A browser sets Origin itself and a page cannot forge it, so
 *      this is sufficient against a hostile page. A local process CAN forge it,
 *      but that already implies code execution on the machine — out of scope.
 *
 * The awkward part, handled honestly rather than hand-waved: the role is
 * claimed in the `hello`, which arrives AFTER the handshake, so the role is
 * unknown at Origin-check time. So the check runs in two stages:
 *
 *   Stage 1 (handshake): accept if the Origin is EITHER an allowed client
 *     origin (the vite dev server) OR null/absent. Anything else → 403.
 *     Figma's plugin iframe is sandboxed, so it sends `Origin: null` or no
 *     Origin at all — which is why null must be allowed through at all.
 *
 *   Stage 2 (hello): bind the claim to the origin.
 *       null/absent origin  → may claim ONLY 'plugin'
 *       localhost:5173      → may claim ONLY 'client'
 *     A violation closes the socket with a reason.
 *
 *   The consequence worth stating plainly: stage 1 lets any NON-BROWSER client
 *   (curl, a script) reach stage 2 and claim `plugin`, because a non-browser
 *   client can simply omit Origin. That is accepted — it is the same "local
 *   code execution" case as forging Origin. What the check does buy is the
 *   thing that actually matters: a hostile WEB PAGE is blocked, because a
 *   browser always sets Origin to that page's real origin and cannot make it
 *   null for a WebSocket.
 *
 * No tokens, no other auth — deliberately out of scope. Loopback, dev machine.
 */

import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';

const DEFAULT_PORT = 9337;
const HOST = '127.0.0.1'; // loopback ONLY — see threat model above
const PROTOCOL_VERSION = 1;
const HELLO_TIMEOUT_MS = 10_000;
const HEARTBEAT_MS = 30_000;

/** Origins a socket may claim `role: 'client'` from. */
const CLIENT_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

/** Close codes (4000-4999 is the application-private range). */
const CLOSE_REPLACED = 4000;
const CLOSE_POLICY = 4001;

const port = resolvePort(process.env.WINDEN_BRIDGE_PORT);

// ---------------------------------------------------------------------------
// Logging — this is what you stare at when it does not work, so every
// connect, disconnect, rejected origin, role claim and forwarded frame gets
// exactly one line, with a timestamp and the role.
// ---------------------------------------------------------------------------

function stamp() {
  const d = new Date();
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

function log(tag, msg) {
  console.log(`[${stamp()}] ${tag.padEnd(8)} ${msg}`);
}
function warn(tag, msg) {
  console.warn(`[${stamp()}] ${tag.padEnd(8)} ${msg}`);
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** @type {import('ws').WebSocket | null} */
let pluginSocket = null;
/** @type {Set<import('ws').WebSocket>} */
const clientSockets = new Set();

let seq = 0; // monotonic socket id, for readable logs
const counts = { toClients: 0, toPlugin: 0, dropped: 0 };

// ---------------------------------------------------------------------------
// HTTP server — `noServer` so we own the upgrade and can answer a real 403
// before the WebSocket handshake completes.
// ---------------------------------------------------------------------------

const httpServer = createServer((req, res) => {
  res.writeHead(426, { 'Content-Type': 'text/plain' });
  res.end('Winden Tokens bridge relay — WebSocket only.\n');
});

const wss = new WebSocketServer({ noServer: true, clientTracking: false });

httpServer.on('upgrade', (req, socket, head) => {
  const origin = req.headers.origin; // undefined if the header is absent
  const originLabel = origin === undefined ? '<absent>' : origin;

  // Stage 1 of the Origin check. Role is not known yet — see threat model.
  const isNullOrigin = origin === undefined || origin === 'null';
  const isClientOrigin = origin !== undefined && CLIENT_ORIGINS.has(origin);

  if (!isNullOrigin && !isClientOrigin) {
    warn('REJECT', `403 handshake refused — disallowed Origin: ${originLabel}`);
    socket.write(
      'HTTP/1.1 403 Forbidden\r\n' +
        'Connection: close\r\n' +
        'Content-Type: text/plain\r\n' +
        'Content-Length: 34\r\n' +
        '\r\n' +
        'Origin not allowed by bridge relay'
    );
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    ws._bridge = {
      id: ++seq,
      origin, // undefined | 'null' | an allowed client origin
      originLabel,
      role: null, // set at hello
      alive: true,
    };
    log('OPEN', `socket #${ws._bridge.id} accepted (Origin: ${originLabel}) — awaiting hello`);
    wss.emit('connection', ws, req);
  });
});

// ---------------------------------------------------------------------------
// Connection handling
// ---------------------------------------------------------------------------

wss.on('connection', (ws) => {
  const meta = ws._bridge;

  const helloTimer = setTimeout(() => {
    if (!meta.role) {
      warn('TIMEOUT', `socket #${meta.id} said no hello within ${HELLO_TIMEOUT_MS}ms — closing`);
      closeWith(ws, CLOSE_POLICY, 'no hello');
    }
  }, HELLO_TIMEOUT_MS);

  ws.on('pong', () => {
    meta.alive = true;
  });

  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      counts.dropped++;
      warn('DROP', `socket #${meta.id} (${meta.role ?? 'unidentified'}) sent a binary frame — ignored`);
      return;
    }

    const raw = data.toString();
    let frame;
    try {
      frame = JSON.parse(raw);
    } catch {
      counts.dropped++;
      warn('DROP', `socket #${meta.id} (${meta.role ?? 'unidentified'}) sent unparseable JSON — ignored`);
      return;
    }

    if (!frame || typeof frame !== 'object') {
      counts.dropped++;
      warn('DROP', `socket #${meta.id} sent a non-object frame — ignored`);
      return;
    }

    if (frame.kind === 'hello') {
      handleHello(ws, frame, raw, helloTimer);
      return;
    }

    if (!meta.role) {
      counts.dropped++;
      warn('DROP', `socket #${meta.id} sent '${frame.kind}' before hello — ignored`);
      return;
    }

    // Forward the ORIGINAL bytes. The relay does not re-serialise payload.
    if (meta.role === 'plugin') {
      forwardToClients(raw, frame);
    } else {
      forwardToPlugin(raw, frame, meta);
    }
  });

  ws.on('close', (code, reasonBuf) => {
    clearTimeout(helloTimer);
    const reason = reasonBuf?.toString() || 'none';
    if (meta.role === 'plugin' && pluginSocket === ws) {
      pluginSocket = null;
      log('CLOSE', `plugin  socket #${meta.id} disconnected (code ${code}, reason: ${reason})`);
      log('NOTIFY', `telling ${clientSockets.size} client(s): plugin is gone`);
      broadcastToClients(status('bridge/plugin-disconnected'));
    } else if (meta.role === 'client') {
      clientSockets.delete(ws);
      log('CLOSE', `client  socket #${meta.id} disconnected (code ${code}, reason: ${reason}) — ${clientSockets.size} client(s) left`);
      sendToPlugin(status('bridge/client-detached', { clients: clientSockets.size }));
    } else {
      log('CLOSE', `socket #${meta.id} (${meta.role ?? 'unidentified'}) disconnected (code ${code}, reason: ${reason})`);
    }
  });

  ws.on('error', (err) => {
    warn('ERROR', `socket #${meta.id} (${meta.role ?? 'unidentified'}): ${err.message}`);
  });
});

/**
 * Stage 2 of the Origin check plus role registration.
 */
function handleHello(ws, frame, raw, helloTimer) {
  const meta = ws._bridge;
  const claimed = frame.role;

  if (meta.role) {
    warn('DROP', `socket #${meta.id} (${meta.role}) said hello twice — ignored`);
    return;
  }

  if (claimed !== 'plugin' && claimed !== 'client') {
    warn('REJECT', `socket #${meta.id} claimed unknown role ${JSON.stringify(claimed)} — closing`);
    closeWith(ws, CLOSE_POLICY, 'unknown role');
    return;
  }

  if (frame.v !== PROTOCOL_VERSION) {
    warn('REJECT', `socket #${meta.id} claimed protocol v${frame.v}, relay speaks v${PROTOCOL_VERSION} — closing`);
    closeWith(ws, CLOSE_POLICY, `protocol v${PROTOCOL_VERSION} required`);
    return;
  }

  // Bind the role claim to the handshake Origin. See threat model, stage 2.
  const isNullOrigin = meta.origin === undefined || meta.origin === 'null';
  if (isNullOrigin && claimed !== 'plugin') {
    warn('REJECT', `socket #${meta.id} with null Origin claimed '${claimed}' — only 'plugin' is allowed from a null Origin. Closing.`);
    closeWith(ws, CLOSE_POLICY, "null Origin may only claim role 'plugin'");
    return;
  }
  if (!isNullOrigin && claimed !== 'client') {
    warn('REJECT', `socket #${meta.id} from Origin ${meta.originLabel} claimed '${claimed}' — only 'client' is allowed from a browser Origin. Closing.`);
    closeWith(ws, CLOSE_POLICY, "browser Origin may only claim role 'client'");
    return;
  }

  clearTimeout(helloTimer);
  meta.role = claimed;

  if (claimed === 'plugin') {
    if (pluginSocket && pluginSocket !== ws) {
      const old = pluginSocket;
      log('REPLACE', `plugin socket #${old._bridge.id} replaced by #${meta.id} (Figma reloaded the plugin) — closing the old one`);
      // Clear first: the old socket's 'close' handler must not see itself as
      // the current plugin, or it would broadcast a spurious plugin-disconnected.
      pluginSocket = null;
      closeWith(old, CLOSE_REPLACED, 'replaced by a newer plugin connection');
    }
    pluginSocket = ws;
    log('HELLO', `plugin  socket #${meta.id} identified (Origin: ${meta.originLabel}) — ${clientSockets.size} client(s) attached`);
    log('NOTIFY', `telling ${clientSockets.size} client(s): plugin is here`);
    broadcastToClients(status('bridge/plugin-connected'));
    if (clientSockets.size > 0) {
      sendToPlugin(status('bridge/client-attached', { clients: clientSockets.size }));
    }
    return;
  }

  clientSockets.add(ws);
  log('HELLO', `client  socket #${meta.id} identified (Origin: ${meta.originLabel}) — ${clientSockets.size} client(s) attached`);

  // (3) The client's hello is forwarded to the plugin VERBATIM. That is the
  //     plugin's cue to push a full refresh.
  if (pluginSocket) {
    pluginSocket.send(raw);
    counts.toPlugin++;
    log('FWD', `client #${meta.id} → plugin   kind=hello  type=${payloadType(frame)}  #${counts.toPlugin}`);
    sendToPlugin(status('bridge/client-attached', { clients: clientSockets.size }));
  } else {
    warn('FWD', `client #${meta.id} said hello but NO PLUGIN is connected — the tab will get no data until the Figma plugin window is open`);
  }

  // Tell the new client where things stand, so it can show "lost the document"
  // rather than waiting forever.
  send(ws, status(pluginSocket ? 'bridge/plugin-connected' : 'bridge/plugin-disconnected'));
}

// ---------------------------------------------------------------------------
// Forwarding
// ---------------------------------------------------------------------------

function forwardToClients(raw, frame) {
  if (clientSockets.size === 0) {
    counts.dropped++;
    log('FWD', `plugin → (no clients)  type=${payloadType(frame)}  dropped (#${counts.dropped} dropped)`);
    return;
  }
  let sent = 0;
  for (const client of clientSockets) {
    if (client.readyState === client.OPEN) {
      client.send(raw);
      sent++;
    }
  }
  counts.toClients++;
  log('FWD', `plugin → ${sent} client(s)   kind=${frame.kind}  type=${payloadType(frame)}  #${counts.toClients}`);
}

function forwardToPlugin(raw, frame, meta) {
  if (!pluginSocket || pluginSocket.readyState !== pluginSocket.OPEN) {
    counts.dropped++;
    warn('FWD', `client #${meta.id} → plugin  type=${payloadType(frame)}  DROPPED — no plugin connected (#${counts.dropped} dropped)`);
    return;
  }
  pluginSocket.send(raw);
  counts.toPlugin++;
  log('FWD', `client #${meta.id} → plugin   kind=${frame.kind}  type=${payloadType(frame)}  #${counts.toPlugin}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read `payload.type` for logging only. Never used for routing. */
function payloadType(frame) {
  const p = frame?.payload;
  if (p && typeof p === 'object' && typeof p.type === 'string') return p.type;
  return '<none>';
}

function status(type, extra) {
  return {
    v: PROTOCOL_VERSION,
    role: 'relay',
    kind: 'status',
    payload: { type, ...extra },
  };
}

function send(ws, frame) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(frame));
}

function sendToPlugin(frame) {
  send(pluginSocket, frame);
}

function broadcastToClients(frame) {
  const raw = JSON.stringify(frame);
  for (const client of clientSockets) {
    if (client.readyState === client.OPEN) client.send(raw);
  }
}

function closeWith(ws, code, reason) {
  if (!ws) return;
  try {
    ws.close(code, reason);
  } catch {
    /* already gone */
  }
}

function resolvePort(raw) {
  if (raw === undefined || raw === '') return DEFAULT_PORT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    console.error(`WINDEN_BRIDGE_PORT="${raw}" is not a valid port. Using ${DEFAULT_PORT}.`);
    return DEFAULT_PORT;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Heartbeat — reap half-open sockets (Figma reloads can leave them behind).
// ---------------------------------------------------------------------------

const heartbeat = setInterval(() => {
  const sockets = [pluginSocket, ...clientSockets].filter(Boolean);
  for (const ws of sockets) {
    const meta = ws._bridge;
    if (!meta.alive) {
      warn('STALE', `socket #${meta.id} (${meta.role}) missed a heartbeat — terminating`);
      ws.terminate();
      continue;
    }
    meta.alive = false;
    try {
      ws.ping();
    } catch {
      /* closing */
    }
  }
}, HEARTBEAT_MS);
heartbeat.unref?.();

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\n  Bridge relay cannot start: 127.0.0.1:${port} is already in use.\n` +
        `  Another relay is probably already running. Stop it, or set\n` +
        `  WINDEN_BRIDGE_PORT to a free port (and update manifest.json to match).\n`
    );
  } else {
    console.error(`\n  Bridge relay failed: ${err.message}\n`);
  }
  process.exit(1);
});

httpServer.listen(port, HOST, () => {
  log('READY', `bridge relay listening on ws://${HOST}:${port} (loopback only)`);
  log('READY', `client Origins allowed: ${[...CLIENT_ORIGINS].join(', ')}`);
  log('READY', `plugin role allowed only from a null/absent Origin (the Figma iframe)`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    log('BYE', `${sig} — shutting down (${counts.toClients} frames to clients, ${counts.toPlugin} to plugin, ${counts.dropped} dropped)`);
    clearInterval(heartbeat);
    for (const ws of [pluginSocket, ...clientSockets].filter(Boolean)) {
      closeWith(ws, 1001, 'relay shutting down');
    }
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 500).unref();
  });
}
