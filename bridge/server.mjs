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
 *     { v: 2, role: 'plugin' | 'client' | 'mcp', kind: 'hello' | 'message' | 'status', payload }
 *
 * `payload` is opaque to the relay. It carries the existing plugin message
 * types verbatim (`refresh`, `create-variable`, `bind-node-property`, …).
 * The relay only reads `payload.type` for logging, and forwards the ORIGINAL
 * bytes unchanged — it never re-serialises your payload. The two exceptions
 * are the hello (below) and a client's `kind: 'status'` frame, which is
 * addressed to the relay itself and never forwarded (see 5).
 *
 * 1. hello — first frame on every socket, names the role:
 *
 *        { v: 2, role: 'plugin', kind: 'hello', payload: { pluginKey: '<32-128 hex>' } }
 *        { v: 2, role: 'client', kind: 'hello', payload: {...} }
 *        { v: 2, role: 'mcp',    kind: 'hello', payload: { token: '<contents of ~/.winden-tokens/mcp-token>' } }
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
 * 2. Routing — plugin ──▶ every client AND every mcp, any client ──▶ the
 *    plugin, any mcp ──▶ the plugin. Clients never reach each other, and an
 *    mcp socket is never reachable from a client.
 *
 * 2b. THE `mcp` ROLE (the `winden-tokens-mcp` bin, see ./mcp.mjs)
 *
 *    A third peer: a local stdio MCP server that lets a model read and edit the
 *    tokens in the open file. Its capabilities are deliberately a SUBSET of the
 *    browser client's:
 *
 *      may     send plugin commands (routed exactly like a client's)
 *      may     receive everything the plugin broadcasts
 *      may NOT ever become `pluginSocket` — it can never impersonate the
 *              Figma plugin, and therefore can never feed a browser tab a
 *              forged `data-loaded`
 *      may NOT be reached by a client, and cannot reach one
 *
 *    Two things the relay does for a client and deliberately does NOT do for an
 *    mcp socket, both for the same reason — an MCP server attaching must be
 *    INVISIBLE to the user's Figma plugin window:
 *
 *      - its hello is not forwarded to the plugin. A forwarded hello is the
 *        plugin UI's cue to enter headless mode ("the browser has the wheel")
 *        as well as to refresh, and a background process must not collapse the
 *        window the user is working in.
 *      - no `bridge/client-attached` / `client-detached` status frame is sent,
 *        for the same reason: that frame also drives headless mode.
 *
 *    Consequently an mcp socket gets no automatic first snapshot. It asks for
 *    one itself by sending `ui-ready`, which is precisely the cue the bridge
 *    already uses for a freshly attached tab (`requestFullRefresh` in
 *    src/ui/hooks/useBridge.ts). See ./mcp.mjs for why `ui-ready` and not
 *    `refresh`.
 *
 *    WIRE LABEL OF AN MCP COMMAND, AND WHY IT SAYS `client`. The plugin half of
 *    the bridge knows exactly two peer roles (as of v1); its
 *    `decodeEnvelope` DROPS a frame whose role it does not recognise. So an
 *    `mcp`-labelled command frame would be silently discarded by every plugin
 *    build that exists. The MCP server therefore names itself `mcp` in its
 *    hello — which is what the relay makes its policy decisions on — and labels
 *    its command frames `client`, the role the plugin already accepts commands
 *    from. The relay routes on the socket's hello role and never on a frame's
 *    label, so this changes nothing here; it is stated because it looks like an
 *    inconsistency and is not one. The cleanup is to teach `decodeEnvelope`
 *    the `mcp` role and drop the relabel, which costs a plugin rebuild.
 *
 * 3. CLIENT HELLO IS FORWARDED TO THE PLUGIN VERBATIM.
 *    When a browser tab says hello, the plugin socket receives that exact
 *    frame — `{ v:2, role:'client', kind:'hello', payload }`. That is the
 *    plugin's cue to push a full `refresh`, so a tab opened late still gets
 *    current data. There is no special wrapper kind for this: the plugin
 *    simply listens for `kind === 'hello'` from `role === 'client'`.
 *
 * 4. Relay-generated status frames use a THIRD role, `'relay'`, and the kind
 *    `'status'`, so they can never be confused with app traffic:
 *
 *        { v:2, role:'relay', kind:'status', payload:{ type:'bridge/plugin-connected'    } }
 *        { v:2, role:'relay', kind:'status', payload:{ type:'bridge/plugin-disconnected' } }
 *            → sent to clients. `plugin-disconnected` is what lets the browser
 *              say "lost the document" instead of hanging. A client also gets
 *              one of these immediately after its own hello, describing the
 *              current state.
 *
 *        { v:2, role:'relay', kind:'status', payload:{ type:'bridge/client-attached', clients:N } }
 *        { v:2, role:'relay', kind:'status', payload:{ type:'bridge/client-detached', clients:N } }
 *            → sent to the plugin, for the headless status strip. Purely
 *              informational; safe to ignore. The refresh cue is the forwarded
 *              client hello in (3), NOT these frames.
 *
 *        { v:2, role:'relay', kind:'status', payload:{ type:'bridge/version-mismatch',
 *                                                      relay:2, peer:3, message:'…' } }
 *            → broadcast to every attached client when a socket is turned away
 *              for speaking a different protocol version. Without it, the
 *              failure a user actually sees is "my tab is empty" — the rejected
 *              side knows why, and the side still attached knows nothing.
 *              (It is only delivered to clients on the relay's OWN version;
 *              a client on another version is itself being rejected, and learns
 *              why from its close reason instead.)
 *
 * 5. PAIRING — how an unknown plugin becomes trusted. All frames below are
 *    `{ v:2, role:'relay', kind:'status', payload }` unless marked client → relay.
 *
 *        relay → pending plugin   { type:'bridge/pairing-pending', code }
 *        relay → every client     { type:'bridge/pairing-request', code }
 *            (also sent to a client that attaches while a request is open,
 *            right after its plugin-connected/-disconnected frame)
 *        client → relay           { v:2, role:'client', kind:'status',
 *                                   payload:{ type:'bridge/pairing-answer', code, approve:boolean } }
 *            (ignored unless `code` is the CURRENT request's code, so an answer
 *            meant for one plugin can never approve another)
 *        relay → plugin           { type:'bridge/pairing-approved' }
 *            then the normal plugin-connected flow, exactly as for a known key
 *        relay → every client     { type:'bridge/pairing-resolved', approved:true }
 *                                 { type:'bridge/pairing-resolved', approved:false,
 *                                   reason:'denied' | 'timeout' | 'closed' }
 *
 *    `code` is 6 characters of Crockford base32 (no I, L, O, U) taken from
 *    sha256(pluginKey) — the same on the plugin window and in every tab, so the
 *    user approves the window they can actually see.
 *
 * Close codes: 4000 replaced by a newer plugin · 4001 policy (Origin/role
 * violation, missing/malformed pluginKey, wrong mcp token, no hello) ·
 * 4002 protocol version mismatch · 4003 pairing denied · 4004 pairing timed out
 * (PAIRING_TIMEOUT_MS) · 4005 another plugin is already waiting for pairing.
 *
 * Exactly one plugin socket exists at a time. Figma reloads the plugin often,
 * so a new TRUSTED plugin hello REPLACES the old socket, closing it with 4000.
 * At most one plugin waits for pairing at a time; while it waits it is
 * PENDING: it replaces nothing, every frame it sends is dropped, and nothing
 * but its own pairing frames is sent to it.
 *
 * ---------------------------------------------------------------------------
 * THREAT MODEL  (read before changing the Origin or pairing logic)
 * ---------------------------------------------------------------------------
 *
 * A WebSocket handshake is NOT subject to CORS. Without checks, any web page
 * the user happens to have open could connect to ws://localhost:9337 and issue
 * write commands into their Figma file. No preflight is made.
 *
 * Mitigations, all required:
 *
 *   1. Bind 127.0.0.1 only — never 0.0.0.0. Nothing off this machine can reach
 *      the relay.
 *
 *   2. Check the Host header on every request, HTTP and upgrade alike. Only
 *      `127.0.0.1:<port>` and `localhost:<port>` are answered — the DNS
 *      rebinding guard: a name an attacker controls, re-pointed at 127.0.0.1,
 *      arrives with ITS name in Host and is refused before anything else runs.
 *
 *   3. Check the Origin header at handshake (403 before the upgrade) and bind
 *      the role claimed in the hello to it:
 *        an allowed client origin → may claim ONLY 'client'
 *        null / absent Origin     → may claim ONLY 'plugin' or 'mcp'
 *        anything else            → 403
 *      Allowed client origins are the relay's OWN (`http://127.0.0.1:<port>`,
 *      `http://localhost:<port>`) — it serves the UI itself, so only a page it
 *      served has one — plus the vite dev origin in dev mode only (`--dev` /
 *      `WINDEN_BRIDGE_DEV=1`, never set by a published install).
 *
 *   4. Authenticate every role that arrives from a null Origin, because a null
 *      Origin proves NOTHING. Any web page can create
 *      `<iframe sandbox="allow-scripts">`; its opaque origin sends
 *      `Origin: null` — the very mechanism that gives Figma's own plugin iframe
 *      its null Origin. So "null" is "the Figma plugin, a Node process, or any
 *      website", and is treated as such:
 *
 *        mcp    — must send the token the relay wrote at start to
 *                 <home>/mcp-token (fresh per start, dir 0700, file 0600; home
 *                 is ~/.winden-tokens or WINDEN_TOKENS_HOME). Compared in
 *                 constant time; wrong/missing → 4001. A page cannot read the
 *                 file.
 *        plugin — must send a `pluginKey`. A key whose sha256 is listed in
 *                 <home>/trusted-plugins.json (0600, hashes only, never keys)
 *                 is promoted as before. Any other key waits for a human: the
 *                 code is shown in the plugin window and in every tab, and only
 *                 a CLIENT may answer — a role a hostile page cannot hold, by
 *                 (3). One pending plugin at a time, so a page cannot queue
 *                 prompts; a pending one cannot replace the real plugin, reach
 *                 a tab, or send anything at all.
 *
 *      The Figma iframe cannot keep a secret from the user, but it does not
 *      need to: the key only has to be unknown to OTHER pages, and a sandboxed
 *      page cannot read the plugin's `figma.clientStorage`.
 *
 *   An `mcp` socket can never become the plugin socket and never reaches a
 *   client — enforced below, not assumed.
 *
 * WHAT REMAINS ACCEPTED: local code execution. A process running as the user
 * can read the token and the trusted list, forge any Origin, and drive the
 * relay. That position already owns the user's files and browser profile.
 * A user who approves a hostile page's code instead of their plugin's is also
 * not protected against — the code on screen is the defence.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { WebSocketServer } from 'ws';

export const DEFAULT_PORT = 9337;
export const HOST = '127.0.0.1'; // loopback ONLY — see threat model above
export const PROTOCOL_VERSION = 2;

const HELLO_TIMEOUT_MS = 10_000;
const HEARTBEAT_MS = 30_000;
/** How long an unknown plugin waits for a human before it is closed (4004). */
export const PAIRING_TIMEOUT_MS = 60_000;

/** The vite dev server's origin. Allowed only in dev mode — see threat model. */
const VITE_DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

/** Hostnames that may appear in Host / Origin. Loopback spellings only. */
const LOOPBACK_HOSTNAMES = ['127.0.0.1', 'localhost'];

/** Close codes (4000-4999 is the application-private range). See PROTOCOL. */
export const CLOSE_REPLACED = 4000;
export const CLOSE_POLICY = 4001;
/** Protocol version mismatch. Distinct from POLICY: retrying can never fix it. */
export const CLOSE_VERSION = 4002;
export const CLOSE_PAIRING_DENIED = 4003;
export const CLOSE_PAIRING_TIMEOUT = 4004;
/** Another plugin is already waiting for pairing. Retrying later can work. */
export const CLOSE_PAIRING_BUSY = 4005;

/** A plugin key: 128 bits or more of hex. Upper bound only to refuse junk. */
export const PLUGIN_KEY_RE = /^[0-9a-f]{32,128}$/i;

export const MCP_TOKEN_FILE = 'mcp-token';
export const TRUSTED_PLUGINS_FILE = 'trusted-plugins.json';

/** Where the relay keeps its secrets: option, then WINDEN_TOKENS_HOME, then ~/.winden-tokens. */
export function resolveHome(home) {
  return home || process.env.WINDEN_TOKENS_HOME || join(homedir(), '.winden-tokens');
}

export function mcpTokenPath(home) {
  return join(resolveHome(home), MCP_TOKEN_FILE);
}

/** The token the running relay wrote, or null if there is none (relay not running). */
export function readMcpToken(home) {
  try {
    return readFileSync(mcpTokenPath(home), 'utf8').trim() || null;
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest();
}

/** What trusted-plugins.json stores for a key: never the key itself. */
export function hashPluginKey(pluginKey) {
  return sha256(pluginKey.toLowerCase()).toString('hex');
}

/** Crockford base32 — no I, L, O, U, so the code reads aloud unambiguously. */
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** The 6-character pairing code shown in the plugin window and in every tab. */
export function pairingCode(pluginKey) {
  const bits = sha256(pluginKey.toLowerCase()).readUInt32BE(0) >>> 2; // top 30 bits
  let code = '';
  for (let i = 5; i >= 0; i--) code += CODE_ALPHABET[(bits >>> (i * 5)) & 31];
  return code;
}

/** Write a 0600 file atomically: a reader never sees a half-written secret. */
function writeSecretFile(path, content) {
  const tmp = `${path}.${process.pid}.tmp`;
  rmSync(tmp, { force: true });
  writeFileSync(tmp, content, { mode: 0o600, flag: 'wx' });
  renameSync(tmp, path);
}

const BODY_403 = 'Forbidden — the Winden Tokens bridge relay answers loopback requests only.\n';

/**
 * Start the relay.
 *
 * @param {object} options
 * @param {number}  [options.port]   TCP port. Always bound on 127.0.0.1.
 * @param {boolean} [options.dev]    Also allow the vite dev origin as a client.
 * @param {string|null} [options.uiFile] Absolute path to the single-file UI to
 *        serve at `/`. `null` serves a 404 with an explanation instead.
 * @param {string} [options.home] Directory for the mcp token and the trusted
 *        plugin list. Defaults to WINDEN_TOKENS_HOME, then ~/.winden-tokens.
 * @param {number} [options.pairingTimeoutMs] How long an unknown plugin waits.
 * @returns {Promise<{ port:number, url:string, home:string, mcpTokenFile:string, close:() => Promise<void> }>}
 */
export function startRelay({
  port = DEFAULT_PORT,
  dev = false,
  uiFile = null,
  home,
  pairingTimeoutMs = PAIRING_TIMEOUT_MS,
} = {}) {
  const homeDir = resolveHome(home);
  const tokenFile = join(homeDir, MCP_TOKEN_FILE);
  const trustedFile = join(homeDir, TRUSTED_PLUGINS_FILE);
  /** Fresh per start; written to `tokenFile` once the port is ours. */
  const mcpToken = randomBytes(32).toString('hex');
  const mcpTokenHash = sha256(mcpToken);

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
  /**
   * Sockets that claimed the `mcp` role. Kept apart from `clientSockets` on
   * purpose: they receive the same plugin broadcasts, but they must NOT be
   * counted in the `clients:N` the plugin uses to decide headless mode, and
   * they must not be forwarded a hello. See PROTOCOL (2b).
   * @type {Set<import('ws').WebSocket>}
   */
  const mcpSockets = new Set();
  /**
   * The one plugin socket waiting for a human to approve its key, or null.
   * See PROTOCOL (5).
   * @type {{ ws: import('ws').WebSocket, hash: string, code: string, timer: any } | null}
   */
  let pending = null;

  let seq = 0; // monotonic socket id, for readable logs
  const counts = { toClients: 0, toPlugin: 0, dropped: 0 };

  /** Every socket the relay currently holds, in one place. */
  function allSockets() {
    return [pluginSocket, pending?.ws, ...clientSockets, ...mcpSockets].filter(Boolean);
  }

  // -------------------------------------------------------------------------
  // Secrets — the mcp token and the trusted plugin list. See threat model (4).
  // -------------------------------------------------------------------------

  function ensureHome() {
    mkdirSync(homeDir, { recursive: true, mode: 0o700 });
    const mode = statSync(homeDir).mode & 0o777;
    if (mode & 0o077) {
      warn('SECRETS', `${homeDir} is mode ${mode.toString(8)} — other users can list it. Its files are 0600 regardless; chmod 700 it to be sure.`);
    }
  }

  function mcpTokenValid(given) {
    if (typeof given !== 'string' || given === '') return false;
    // Equal-length digests, so timingSafeEqual never throws and leaks no length.
    return timingSafeEqual(sha256(given), mcpTokenHash);
  }

  function readTrusted() {
    try {
      const list = JSON.parse(readFileSync(trustedFile, 'utf8'));
      return Array.isArray(list) ? list.filter((h) => typeof h === 'string') : [];
    } catch (err) {
      if (err.code !== 'ENOENT') warn('PAIR', `could not read ${trustedFile} (${err.message}) — treating it as empty`);
      return [];
    }
  }

  function trust(hash) {
    const list = readTrusted();
    if (!list.includes(hash)) list.push(hash);
    ensureHome();
    writeSecretFile(trustedFile, JSON.stringify(list, null, 2) + '\n');
  }

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
          // `winden-tokens-mcp` preflights this endpoint before it opens a
          // socket, so that it can refuse to start with a sentence instead of
          // hanging. `plugin` is the field it cares about most.
          mcp: mcpSockets.size,
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

      if (meta.pending) {
        counts.dropped++;
        warn('DROP', `plugin  socket #${meta.id} is waiting for pairing — its '${frame.kind}' frame is dropped`);
        return;
      }

      // `kind: 'status'` from a peer is addressed to the relay, never forwarded.
      // The only one it understands is a client's pairing answer.
      if (frame.kind === 'status' && meta.role !== 'plugin') {
        if (meta.role === 'client') handlePairingAnswer(ws, frame);
        else {
          counts.dropped++;
          warn('DROP', `${meta.role} #${meta.id} sent a status frame — only a client may answer a pairing request`);
        }
        return;
      }

      // Forward the ORIGINAL bytes. The relay does not re-serialise payload.
      // Both non-plugin roles route the same way: towards the plugin, and
      // nowhere else. That is the whole of "an mcp socket cannot reach a tab".
      if (meta.role === 'plugin') {
        forwardToClients(raw, frame);
      } else {
        forwardToPlugin(raw, frame, meta);
      }
    });

    ws.on('close', (code, reasonBuf) => {
      clearTimeout(helloTimer);
      const reason = reasonBuf?.toString() || 'none';
      if (pending && pending.ws === ws) {
        log('CLOSE', `pending plugin socket #${meta.id} went away before anyone answered (code ${code}, reason: ${reason})`);
        endPairing(false, 'closed');
      } else if (meta.role === 'plugin' && pluginSocket === ws) {
        pluginSocket = null;
        log('CLOSE', `plugin  socket #${meta.id} disconnected (code ${code}, reason: ${reason})`);
        log('NOTIFY', `telling ${clientSockets.size} client(s) and ${mcpSockets.size} mcp socket(s): plugin is gone`);
        broadcastToPeers(status('bridge/plugin-disconnected'));
      } else if (meta.role === 'client') {
        clientSockets.delete(ws);
        log('CLOSE', `client  socket #${meta.id} disconnected (code ${code}, reason: ${reason}) — ${clientSockets.size} client(s) left`);
        sendToPlugin(status('bridge/client-detached', { clients: clientSockets.size }));
      } else if (meta.role === 'mcp') {
        mcpSockets.delete(ws);
        // No `client-detached`: the plugin was never told this peer arrived,
        // and must not be told it left. See PROTOCOL (2b).
        log('CLOSE', `mcp     socket #${meta.id} disconnected (code ${code}, reason: ${reason}) — ${mcpSockets.size} mcp socket(s) left`);
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

    if (claimed !== 'plugin' && claimed !== 'client' && claimed !== 'mcp') {
      warn('REJECT', `socket #${meta.id} claimed unknown role ${JSON.stringify(claimed)} — closing`);
      closeWith(ws, CLOSE_POLICY, 'unknown role');
      return;
    }

    // Bind the role claim to the handshake Origin. See threat model, stage 2.
    const isNullOrigin = meta.origin === undefined || meta.origin === 'null';
    if (isNullOrigin && claimed !== 'plugin' && claimed !== 'mcp') {
      warn('REJECT', `socket #${meta.id} with null Origin claimed '${claimed}' — only 'plugin' and 'mcp' are allowed from a null Origin. Closing.`);
      closeWith(ws, CLOSE_POLICY, "null Origin may only claim role 'plugin' or 'mcp'");
      return;
    }
    if (!isNullOrigin && claimed !== 'client') {
      warn('REJECT', `socket #${meta.id} from Origin ${meta.originLabel} claimed '${claimed}' — only 'client' is allowed from a browser Origin. Closing.`);
      closeWith(ws, CLOSE_POLICY, "browser Origin may only claim role 'client'");
      return;
    }

    // Authenticate the null-Origin roles. See threat model (4).
    if (claimed === 'mcp' && !mcpTokenValid(frame.payload?.token)) {
      warn('REJECT', `socket #${meta.id} claimed 'mcp' without the right token (${tokenFile}) — closing`);
      closeWith(ws, CLOSE_POLICY, 'mcp token missing or wrong');
      return;
    }

    if (claimed === 'plugin') {
      const key = frame.payload?.pluginKey;
      if (typeof key !== 'string' || !PLUGIN_KEY_RE.test(key)) {
        warn('REJECT', `socket #${meta.id} claimed 'plugin' without a valid pluginKey — closing`);
        closeWith(ws, CLOSE_POLICY, 'pluginKey missing or malformed');
        return;
      }
      const hash = hashPluginKey(key);
      if (!readTrusted().includes(hash)) {
        if (pending) {
          warn('PAIR', `socket #${meta.id} has an unknown key, but plugin #${pending.ws._bridge.id} is already waiting for pairing — closing`);
          closeWith(ws, CLOSE_PAIRING_BUSY, 'another plugin is waiting for pairing');
          return;
        }
        clearTimeout(helloTimer);
        meta.role = 'plugin';
        meta.pending = true;
        startPairing(ws, hash, pairingCode(key));
        return;
      }
      clearTimeout(helloTimer);
      meta.role = 'plugin';
      promotePlugin(ws);
      return;
    }

    clearTimeout(helloTimer);
    meta.role = claimed;

    if (claimed === 'mcp') {
      mcpSockets.add(ws);
      log('HELLO', `mcp     socket #${meta.id} identified (Origin: ${meta.originLabel}) — ${mcpSockets.size} mcp socket(s) attached`);

      // Deliberately NOT done here, and both omissions are load-bearing:
      //   - the hello is not forwarded to the plugin,
      //   - no `bridge/client-attached` is sent.
      // Either one would put the user's plugin window into headless mode
      // because a background process attached. See PROTOCOL (2b).
      if (!pluginSocket) {
        warn('MCP', `mcp #${meta.id} attached but NO PLUGIN is connected — it will report that and refuse tool calls until the Figma plugin window is open`);
      }

      // The one thing it does get: the relay's view of the plugin, now and on
      // every later change, which is what lets it say "the plugin window
      // detached" instead of waiting out a timeout.
      send(ws, status(pluginSocket ? 'bridge/plugin-connected' : 'bridge/plugin-disconnected'));
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
    // ...and that a plugin is waiting for someone to approve it.
    if (pending) send(ws, status('bridge/pairing-request', { code: pending.code }));
  }

  /** A trusted plugin socket takes over. Figma reloads often: newest wins. */
  function promotePlugin(ws) {
    const meta = ws._bridge;
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
    log('NOTIFY', `telling ${clientSockets.size} client(s) and ${mcpSockets.size} mcp socket(s): plugin is here`);
    broadcastToPeers(status('bridge/plugin-connected'));
    if (clientSockets.size > 0) {
      sendToPlugin(status('bridge/client-attached', { clients: clientSockets.size }));
    }
  }

  // -------------------------------------------------------------------------
  // Pairing — PROTOCOL (5)
  // -------------------------------------------------------------------------

  function startPairing(ws, hash, code) {
    const meta = ws._bridge;
    pending = { ws, hash, code, timer: setTimeout(() => endPairing(false, 'timeout'), pairingTimeoutMs) };
    pending.timer.unref?.();
    log('PAIR', `plugin  socket #${meta.id} has an unknown key — waiting up to ${pairingTimeoutMs / 1000}s for approval in a browser tab. Code: ${code}`);
    if (clientSockets.size === 0) warn('PAIR', `no browser tab is open to approve it — open ${HOST}:${port}`);
    send(ws, status('bridge/pairing-pending', { code }));
    broadcastToClients(status('bridge/pairing-request', { code }));
  }

  function handlePairingAnswer(ws, frame) {
    const meta = ws._bridge;
    const p = frame.payload;
    if (!p || p.type !== 'bridge/pairing-answer' || typeof p.approve !== 'boolean') {
      counts.dropped++;
      warn('DROP', `client #${meta.id} sent a status frame that is not a pairing answer — ignored`);
      return;
    }
    if (!pending || p.code !== pending.code) {
      warn('PAIR', `client #${meta.id} answered code ${JSON.stringify(p.code)}, which is not the open request — ignored`);
      return;
    }
    log('PAIR', `client #${meta.id} ${p.approve ? 'APPROVED' : 'DENIED'} plugin #${pending.ws._bridge.id} (code ${pending.code})`);
    endPairing(p.approve, p.approve ? undefined : 'denied');
  }

  /** @param {'denied'|'timeout'|'closed'} [reason] when not approved */
  function endPairing(approved, reason) {
    const p = pending;
    if (!p) return;
    pending = null;
    clearTimeout(p.timer);

    if (approved) {
      try {
        trust(p.hash);
      } catch (err) {
        warn('PAIR', `could not save the approval to ${trustedFile} (${err.message}) — trusted for this session only`);
      }
      p.ws._bridge.pending = false;
      send(p.ws, status('bridge/pairing-approved'));
      promotePlugin(p.ws);
      broadcastToClients(status('bridge/pairing-resolved', { approved: true }));
      return;
    }

    if (reason === 'denied') closeWith(p.ws, CLOSE_PAIRING_DENIED, 'pairing denied');
    if (reason === 'timeout') {
      warn('PAIR', `plugin #${p.ws._bridge.id} was not approved within ${pairingTimeoutMs / 1000}s — closing`);
      closeWith(p.ws, CLOSE_PAIRING_TIMEOUT, 'pairing timed out');
    }
    broadcastToClients(status('bridge/pairing-resolved', { approved: false, reason }));
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

    broadcastToPeers(
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

  /**
   * Plugin ──▶ every listening peer: browser tabs AND mcp sockets.
   *
   * The two are listed separately in the log because "0 clients, 1 mcp" is a
   * perfectly normal state (a model driving the file with no tab open) and
   * reading it as "dropped" would send you hunting a bug that is not there.
   */
  function forwardToClients(raw, frame) {
    if (clientSockets.size === 0 && mcpSockets.size === 0) {
      counts.dropped++;
      log('FWD', `plugin → (nobody listening)  type=${payloadType(frame)}  dropped (#${counts.dropped} dropped)`);
      return;
    }
    let sent = 0;
    for (const client of clientSockets) {
      if (client.readyState === client.OPEN) {
        client.send(raw);
        sent++;
      }
    }
    let sentMcp = 0;
    for (const mcp of mcpSockets) {
      if (mcp.readyState === mcp.OPEN) {
        mcp.send(raw);
        sentMcp++;
      }
    }
    counts.toClients++;
    log('FWD', `plugin → ${sent} client(s) + ${sentMcp} mcp   kind=${frame.kind}  type=${payloadType(frame)}  #${counts.toClients}`);
  }

  function forwardToPlugin(raw, frame, meta) {
    if (!pluginSocket || pluginSocket.readyState !== pluginSocket.OPEN) {
      counts.dropped++;
      warn('FWD', `${meta.role.padEnd(6)} #${meta.id} → plugin  type=${payloadType(frame)}  DROPPED — no plugin connected (#${counts.dropped} dropped)`);
      return;
    }
    pluginSocket.send(raw);
    counts.toPlugin++;
    log('FWD', `${meta.role.padEnd(6)} #${meta.id} → plugin   kind=${frame.kind}  type=${payloadType(frame)}  #${counts.toPlugin}`);
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

  /**
   * A relay-authored status frame to everyone on the far side of the plugin:
   * browser tabs and mcp sockets alike.
   *
   * Both need the same two facts for the same reason — whether the Figma plugin
   * window is there. A tab that does not know says "lost the document" instead
   * of hanging; an MCP server that does not know would answer a tool call by
   * waiting out a timeout instead of saying the window is closed.
   */
  /** A relay-authored status frame to browser tabs only (pairing is for humans). */
  function broadcastToClients(frame) {
    const raw = JSON.stringify(frame);
    for (const client of clientSockets) {
      if (client.readyState === client.OPEN) client.send(raw);
    }
  }

  function broadcastToPeers(frame) {
    const raw = JSON.stringify(frame);
    for (const peer of [...clientSockets, ...mcpSockets]) {
      if (peer.readyState === peer.OPEN) peer.send(raw);
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
    const sockets = allSockets();
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
      // The token is written only once the port is ours: a second relay that
      // fails with EADDRINUSE must not rotate the running relay's token.
      try {
        ensureHome();
        writeSecretFile(tokenFile, mcpToken + '\n');
      } catch (err) {
        clearInterval(heartbeat);
        httpServer.close();
        reject(new Error(`could not write the mcp token to ${tokenFile}: ${err.message}`));
        return;
      }

      log('READY', `bridge relay listening on http://${HOST}:${port} (loopback only)`);
      log('READY', uiFile ? `serving the browser UI from ${uiFile}` : 'no browser UI bundled — / returns 404');
      log('READY', `client Origins allowed: ${[...clientOrigins].join(', ')}`);
      if (dev) log('READY', 'DEV MODE — the vite dev origin is on the allowlist');
      log('READY', `plugin role: null/absent Origin + a pluginKey listed in ${trustedFile}, or approved in a tab`);
      log('READY', `mcp    role: null/absent Origin + the token in ${tokenFile} — never becomes the plugin`);
      log('READY', `bridge protocol v${PROTOCOL_VERSION}`);

      resolve({
        port,
        url: `http://${HOST}:${port}/`,
        home: homeDir,
        mcpTokenFile: tokenFile,
        close() {
          log('BYE', `shutting down (${counts.toClients} frames to clients, ${counts.toPlugin} to plugin, ${counts.dropped} dropped)`);
          clearInterval(heartbeat);
          if (pending) clearTimeout(pending.timer);
          for (const ws of allSockets()) {
            closeWith(ws, 1001, 'relay shutting down');
          }
          // Remove the token only if it is still ours — another relay on
          // another port may have written its own since.
          try {
            if (readFileSync(tokenFile, 'utf8').trim() === mcpToken) rmSync(tokenFile, { force: true });
          } catch {
            /* already gone */
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
