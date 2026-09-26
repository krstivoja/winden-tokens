/**
 * Winden Tokens — browser bridge relay.
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
 * The SAME server also serves the browser UI (`ui/index.html`, shipped inside
 * the published npm package). The page and the socket are therefore
 * same-origin, which is what lets the Origin allowlist below be as narrow as
 * it is. `bridge/cli.mjs` is the executable that drives this module.
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
 *    THE `v` IS CHECKED FIRST, BEFORE ANYTHING ELSE ABOUT THE HELLO.
 *    The relay now ships separately from the plugin (`npm i -g winden-tokens`),
 *    so an old global install WILL eventually meet a newer plugin. A mismatch
 *    must be legible, not a blank tab — see the version-mismatch block below.
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
 *        { v:1, role:'relay', kind:'status', payload:{ type:'bridge/version-mismatch',
 *                                                      relay:1, peer:2, message:'…' } }
 *            → broadcast to every attached client when a socket is turned away
 *              for speaking a different protocol version. Without it, the
 *              failure a user actually sees is "my tab is empty" — the rejected
 *              side knows why, and the side still attached knows nothing.
 *              (It is only delivered to clients on the relay's OWN version;
 *              a client on another version is itself being rejected, and learns
 *              why from its close reason instead.)
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
 * Three mitigations, all required:
 *
 *   1. Bind 127.0.0.1 only — never 0.0.0.0. Nothing off this machine can reach
 *      the relay, so a hostile device on the LAN is out of the picture.
 *
 *   2. Check the Origin header at handshake and answer 403 before the upgrade
 *      completes. A browser sets Origin itself and a page cannot forge it, so
 *      this is sufficient against a hostile page. A local process CAN forge it,
 *      but that already implies code execution on the machine — out of scope.
 *
 *   3. Check the Host header on every request, HTTP and upgrade alike. Only
 *      `127.0.0.1:<port>` and `localhost:<port>` are answered. This is the DNS
 *      rebinding guard: a name an attacker controls, re-pointed at 127.0.0.1,
 *      arrives with ITS name in Host and is refused before anything else runs.
 *
 * WHICH ORIGINS ARE ALLOWED, AND WHY THAT LIST GOT SHORTER
 *
 *   The relay now serves the browser UI itself, so the normal client origin is
 *   the relay's OWN origin — `http://127.0.0.1:<port>` and its `localhost`
 *   spelling. Only a page this relay served can have that origin, so the
 *   allowlist and the set of pages that exist are the same set.
 *
 *   The vite dev origin (`http://localhost:5173`) used to be allowed
 *   unconditionally. It is now allowed ONLY in dev mode — `--dev`, or
 *   `WINDEN_BRIDGE_DEV=1` — which is set by `npm run dev:bridge` in this
 *   repo and by nothing a published install does. Someone developing the UI
 *   opts in explicitly; everyone else never has 5173 on the list at all.
 *   Dev mode is an explicit flag rather than "is there a checkout next to me"
 *   precisely because it must be impossible to enter by accident.
 *
 * The awkward part, handled honestly rather than hand-waved: the role is
 * claimed in the `hello`, which arrives AFTER the handshake, so the role is
 * unknown at Origin-check time. So the check runs in two stages:
 *
 *   Stage 1 (handshake): accept if the Origin is EITHER an allowed client
 *     origin (see above) OR null/absent. Anything else → 403. Figma's plugin
 *     iframe is sandboxed, so it sends `Origin: null` or no Origin at all —
 *     which is why null must be allowed through at all.
 *
 *   Stage 2 (hello): bind the claim to the origin.
 *       null/absent origin  → may claim ONLY 'plugin'
 *       an allowed origin   → may claim ONLY 'client'
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
import { readFile } from 'node:fs/promises';
import { WebSocketServer } from 'ws';

export const DEFAULT_PORT = 9337;
export const HOST = '127.0.0.1'; // loopback ONLY — see threat model above
export const PROTOCOL_VERSION = 1;

const HELLO_TIMEOUT_MS = 10_000;
const HEARTBEAT_MS = 30_000;

/** The vite dev server's origin. Allowed only in dev mode — see threat model. */
const VITE_DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

/** Hostnames that may appear in Host / Origin. Loopback spellings only. */
const LOOPBACK_HOSTNAMES = ['127.0.0.1', 'localhost'];

/** Close codes (4000-4999 is the application-private range). */
const CLOSE_REPLACED = 4000;
const CLOSE_POLICY = 4001;
/** Protocol version mismatch. Distinct from POLICY: retrying can never fix it. */
export const CLOSE_VERSION = 4002;

const BODY_403 = 'Forbidden — the Winden Tokens bridge relay answers loopback requests only.\n';

/**
 * Start the relay.
 *
 * @param {object} options
 * @param {number}  [options.port]   TCP port. Always bound on 127.0.0.1.
 * @param {boolean} [options.dev]    Also allow the vite dev origin as a client.
 * @param {string|null} [options.uiFile] Absolute path to the single-file UI to
 *        serve at `/`. `null` serves a 404 with an explanation instead.
 * @returns {Promise<{ port:number, url:string, close:() => Promise<void> }>}
 */
export function startRelay({ port = DEFAULT_PORT, dev = false, uiFile = null } = {}) {
  /**
   * Origins a socket may claim `role: 'client'` from.
   * Built per-relay because the relay's own origin depends on --port.
   */
  const clientOrigins = new Set([
    ...LOOPBACK_HOSTNAMES.map((h) => `http://${h}:${port}`),
    ...(dev ? VITE_DEV_ORIGINS : []),
  ]);

  /** Host header values this relay answers. See threat model, mitigation 3. */
  const allowedHosts = new Set([
    ...LOOPBACK_HOSTNAMES.map((h) => `${h}:${port}`),
    ...LOOPBACK_HOSTNAMES,
  ]);

  // -------------------------------------------------------------------------
  // Logging — this is what you stare at when it does not work, so every
  // connect, disconnect, rejected origin, role claim and forwarded frame gets
  // exactly one line, with a timestamp and the role.
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  /** @type {import('ws').WebSocket | null} */
  let pluginSocket = null;
  /** @type {Set<import('ws').WebSocket>} */
  const clientSockets = new Set();

  let seq = 0; // monotonic socket id, for readable logs
  const counts = { toClients: 0, toPlugin: 0, dropped: 0 };

  // -------------------------------------------------------------------------
  // HTTP server — serves the browser UI, and `noServer` so we own the upgrade
  // and can answer a real 403 before the WebSocket handshake completes.
  // -------------------------------------------------------------------------

  const httpServer = createServer((req, res) => {
    if (!hostAllowed(req)) {
      warn('REJECT', `403 ${req.method} ${req.url} — disallowed Host: ${req.headers.host ?? '<absent>'}`);
      res.writeHead(403, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
      res.end(BODY_403);
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain', Allow: 'GET, HEAD' });
      res.end('Method not allowed.\n');
      return;
    }

    const path = (req.url ?? '/').split('?')[0];

    if (path === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(
        JSON.stringify({
          ok: true,
          protocol: PROTOCOL_VERSION,
          plugin: Boolean(pluginSocket),
          clients: clientSockets.size,
        }) + '\n'
      );
      return;
    }

    if (path !== '/' && path !== '/index.html') {
      res.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
      res.end('Not found. The Winden Tokens bridge serves one page, at /.\n');
      return;
    }

    if (!uiFile) {
      res.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
      res.end(
        'No browser UI is bundled with this relay.\n' +
          'In a checkout, run `npm run build` first, or open the vite dev server instead.\n'
      );
      return;
    }

    // Read per request rather than once at boot: in a checkout the served file
    // is `dist/index.html`, and a rebuild should show up on reload.
    readFile(uiFile)
      .then((html) => {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': html.length,
          // The relay and the UI ship as one unit. A cached page from an older
          // relay talking to a newer one is exactly the mismatch we are trying
          // to make impossible.
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer',
        });
        res.end(req.method === 'HEAD' ? undefined : html);
      })
      .catch((err) => {
        warn('ERROR', `could not read the UI at ${uiFile}: ${err.message}`);
        res.writeHead(500, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
        res.end(`Could not read the bundled UI (${uiFile}).\n`);
      });
  });

  const wss = new WebSocketServer({ noServer: true, clientTracking: false });

  function hostAllowed(req) {
    const host = req.headers.host;
    if (typeof host !== 'string') return false;
    return allowedHosts.has(host.toLowerCase());
  }

  function refuseUpgrade(socket, status, body) {
    const bytes = Buffer.from(body, 'utf8');
    socket.write(
      `HTTP/1.1 ${status}\r\n` +
        'Connection: close\r\n' +
        'Content-Type: text/plain\r\n' +
        `Content-Length: ${bytes.length}\r\n` +
        '\r\n'
    );
    socket.write(bytes);
    socket.destroy();
  }

  httpServer.on('upgrade', (req, socket, head) => {
    if (!hostAllowed(req)) {
      warn('REJECT', `403 upgrade refused — disallowed Host: ${req.headers.host ?? '<absent>'}`);
      refuseUpgrade(socket, '403 Forbidden', BODY_403);
      return;
    }

    const origin = req.headers.origin; // undefined if the header is absent
    const originLabel = origin === undefined ? '<absent>' : origin;

    // Stage 1 of the Origin check. Role is not known yet — see threat model.
    const isNullOrigin = origin === undefined || origin === 'null';
    const isClientOrigin = origin !== undefined && clientOrigins.has(origin);

    if (!isNullOrigin && !isClientOrigin) {
      warn('REJECT', `403 handshake refused — disallowed Origin: ${originLabel}`);
      refuseUpgrade(socket, '403 Forbidden', 'Origin not allowed by bridge relay');
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

  // -------------------------------------------------------------------------
  // Connection handling
  // -------------------------------------------------------------------------

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

    // VERSION FIRST. A peer from another protocol generation may not agree with
    // us about anything else in this frame, including what the role names are,
    // so no other rejection may pre-empt this one: the user must be told the
    // actual problem, which is that the two halves are different ages.
    if (frame.v !== PROTOCOL_VERSION) {
      rejectVersion(ws, frame.v, claimed);
      return;
    }

    if (claimed !== 'plugin' && claimed !== 'client') {
      warn('REJECT', `socket #${meta.id} claimed unknown role ${JSON.stringify(claimed)} — closing`);
      closeWith(ws, CLOSE_POLICY, 'unknown role');
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

  /**
   * Turn away a socket from another protocol generation, loudly.
   *
   * Three audiences, because all three are somewhere a user might be looking:
   *   - the terminal running the relay (this block),
   *   - the rejected peer (the close reason, which its UI surfaces),
   *   - any browser tab already attached (the broadcast), which would otherwise
   *     just sit there empty with no idea why nothing arrived.
   */
  function rejectVersion(ws, peerVersion, claimed) {
    const meta = ws._bridge;
    const shown = Number.isInteger(peerVersion) ? `v${peerVersion}` : JSON.stringify(peerVersion);
    const older = Number.isInteger(peerVersion) && peerVersion < PROTOCOL_VERSION ? 'peer' : 'relay';
    const advice =
      older === 'relay'
        ? 'This relay is the older half — update it: npm i -g winden-tokens@latest'
        : 'The Figma plugin is the older half — rebuild/reinstall the plugin from a current source tree.';

    warn('VERSION', `socket #${meta.id} (claimed role: ${JSON.stringify(claimed)}) speaks bridge protocol ${shown}, this relay speaks v${PROTOCOL_VERSION}.`);
    warn('VERSION', advice);
    warn('VERSION', 'Refusing the socket. Nothing will be forwarded until both halves agree.');

    const message = `Bridge protocol mismatch: the relay speaks v${PROTOCOL_VERSION}, the other side speaks ${shown}. ${advice}`;

    broadcastToClients(
      status('bridge/version-mismatch', {
        relay: PROTOCOL_VERSION,
        peer: Number.isInteger(peerVersion) ? peerVersion : null,
        message,
      })
    );

    // A close reason is capped at 123 bytes, so it says the essential thing and
    // leaves the advice to the terminal and to the broadcast above.
    closeWith(ws, CLOSE_VERSION, `bridge protocol mismatch: relay v${PROTOCOL_VERSION}, you sent ${shown}`);
  }

  // -------------------------------------------------------------------------
  // Forwarding
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Heartbeat — reap half-open sockets (Figma reloads can leave them behind).
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Boot
  // -------------------------------------------------------------------------

  return new Promise((resolve, reject) => {
    httpServer.once('error', (err) => {
      clearInterval(heartbeat);
      reject(err);
    });

    httpServer.listen(port, HOST, () => {
      log('READY', `bridge relay listening on http://${HOST}:${port} (loopback only)`);
      log('READY', uiFile ? `serving the browser UI from ${uiFile}` : 'no browser UI bundled — / returns 404');
      log('READY', `client Origins allowed: ${[...clientOrigins].join(', ')}`);
      if (dev) log('READY', 'DEV MODE — the vite dev origin is on the allowlist');
      log('READY', `plugin role allowed only from a null/absent Origin (the Figma iframe)`);
      log('READY', `bridge protocol v${PROTOCOL_VERSION}`);

      resolve({
        port,
        url: `http://${HOST}:${port}/`,
        close() {
          log('BYE', `shutting down (${counts.toClients} frames to clients, ${counts.toPlugin} to plugin, ${counts.dropped} dropped)`);
          clearInterval(heartbeat);
          for (const ws of [pluginSocket, ...clientSockets].filter(Boolean)) {
            closeWith(ws, 1001, 'relay shutting down');
          }
          return new Promise((done) => {
            httpServer.close(() => done());
            setTimeout(done, 500).unref();
          });
        },
      });
    });
  });
}
