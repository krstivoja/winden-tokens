#!/usr/bin/env node
/**
 * `winden-tokens-mcp` — read and edit the design tokens in the open Figma file
 * from an MCP client, over the bridge relay that already exists.
 *
 *     MCP client ──stdio──▶ winden-tokens-mcp ──ws──▶ relay ──ws──▶ Figma plugin
 *
 * Ships as a second bin in the same package as the relay, so one
 * `npm i -g winden-tokens` installs both halves and they can never be
 * different ages. It starts nothing: the relay (`winden-tokens`) and the Figma
 * plugin window must already be up, and this server refuses to start, with a
 * sentence saying which one is missing, if either is not.
 *
 * ---------------------------------------------------------------------------
 * REQUEST/RESPONSE OVER A BROADCAST PROTOCOL
 * ---------------------------------------------------------------------------
 *
 * MCP is request/response. The plugin protocol is not: `figma.ui.postMessage`
 * broadcasts to everything attached, commands carry no id, and replies carry no
 * id to match one with. See plans/mcp-server.md — the decision there, kept
 * here, is to CORRELATE BY OUTCOME and change nothing in the plugin sandbox.
 *
 *   Reads   — trigger a snapshot, await the next `data-loaded`, answer from it.
 *   Writes  — send the command, await the next `update-success` /
 *             `update-error`, then answer from the snapshot that came with it.
 *   Always  — every wait is bounded, and the timeout says what was awaited.
 *
 * What that buys, and what it costs:
 *
 *   + no change to the ~4,500 lines of src/plugin/code.ts, and no change to any
 *     plugin build already loaded in Figma. This works against the bundle the
 *     user has open right now.
 *   − a second writer (a browser tab on the same relay, or the user clicking in
 *     the plugin window) produces `update-success` frames that are
 *     indistinguishable from ours. A success is therefore not proof that OUR
 *     write is the one that succeeded. Every write tool says so in its
 *     description, and every write tool answers from a re-read of the file
 *     rather than from what it hoped it did.
 *
 * The clean fix is a correlation id in the envelope, echoed by the sandbox.
 * That is the v2, and it costs a plugin rebuild for every user.
 *
 * WHY READS SEND `ui-ready` AND NOT `refresh`
 *
 * The plan said `refresh`. `refresh` does more than re-read the file — look at
 * its case in src/plugin/code.ts:
 *
 *     case 'refresh':
 *       setVariableOrder([]);   // throws away the user's custom ordering
 *       await fetchData();
 *       await resetHistory();   // throws away the plugin's undo/redo stack
 *
 * A read tool that a model may call unattended, several times per answer, must
 * not quietly destroy the user's undo history and their variable ordering.
 * `ui-ready` produces exactly the same `data-loaded` broadcast with neither
 * side effect — and it is not an improvisation: it is the cue the bridge
 * ALREADY uses when a browser tab attaches (`requestFullRefresh` in
 * src/ui/hooks/useBridge.ts posts `ui-ready` + `get-history-state`). So this is
 * the established "give me the current state" message, and reads use it.
 *
 * Cost, stated honestly: `ui-ready` also re-posts the current selection, which
 * we ignore, and a read is a full re-read of the file every time. No caching —
 * a stale answer about a file someone else is editing is worse than a slow one.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS SERVER IS NOT ALLOWED TO DO
 * ---------------------------------------------------------------------------
 *
 * - It never claims the `plugin` role. It says hello as `mcp`, a role the relay
 *   routes exactly like a browser tab and never promotes. See the PROTOCOL and
 *   THREAT MODEL blocks in ./server.mjs, which also record why `mcp` is allowed
 *   from the same null Origin as `plugin`.
 * - It labels its command frames `role: 'client'`. The plugin half speaks v1 and
 *   drops envelopes whose role it does not know, so an `mcp`-labelled command
 *   would be silently discarded by every plugin build in existence. The relay
 *   decides policy on the hello role, not on this label. See PROTOCOL (2b).
 * - No node binding (`bind-node-property`) and no `rename-group`. Both are
 *   deliberate v1 exclusions — see plans/mcp-server.md. Binding depends on the
 *   live Figma selection, which the model cannot see; renaming a group rewrites
 *   every variable under it in one unreviewable step.
 */

import { readFile } from 'node:fs/promises';
import { get as httpGet } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { WebSocket } from 'ws';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { DEFAULT_PORT, HOST, PROTOCOL_VERSION } from './server.mjs';
import {
  collectionsOverview,
  deletionImpact,
  describeVariable,
  filterVariables,
  groupedName,
  normaliseType,
  resolveCollection,
  resolveMode,
  resolveVariable,
  summariseVariable,
} from './mcp-tokens.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * STDOUT IS THE MCP TRANSPORT. One stray `console.log` corrupts the JSON-RPC
 * stream and the client disconnects with a parse error that points nowhere
 * near the cause. Everything this process says goes to stderr, through here.
 */
function note(message) {
  console.error(`[winden-tokens-mcp] ${message}`);
}

/**
 * A full read of a real token file (678 variables, measured) runs in the
 * single-threaded Figma sandbox behind whatever else it is doing. Generous, but
 * finite: a tool that hangs is worse than a tool that fails.
 */
const READ_TIMEOUT_MS = 20_000;
/** A write is a read plus the mutation — the plugin refreshes before it answers. */
const WRITE_TIMEOUT_MS = 30_000;
const CONNECT_TIMEOUT_MS = 10_000;
const RECONNECT_MS = 2_000;
/** The relay's close code for a protocol-version mismatch. Retrying cannot fix it. */
const CLOSE_VERSION = 4002;

/** Default cap on `list_variables`, so one call cannot return a whole file. */
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

// ---------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------

const HELP = `
  winden-tokens-mcp — an MCP server over the Winden Tokens bridge relay.

  It speaks MCP on stdio and is started BY an MCP client, not by hand. Both of
  these must already be running, or it refuses to start and says which:

    1. the relay:  winden-tokens --no-open
    2. the Winden Tokens plugin, open in Figma on the file you want.

  Usage
    winden-tokens-mcp [--port <n>]

  Options
    --port <n>     Relay port (default ${DEFAULT_PORT}). Must match the relay's.
    -h, --help     This text.
    -v, --version  Print the version.

  Environment
    WINDEN_BRIDGE_PORT   same as --port

  Client config (Claude Desktop / Claude Code), one line:

    claude mcp add winden-tokens -- winden-tokens-mcp

  Safety
    delete_variable and rename_variable change the Figma file and CANNOT be
    undone from here. Figma's own undo (in the Figma window) is the only way
    back. Gate them in your client if it can.
`;

function fail(message, code = 1) {
  console.error(`\n${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const opts = { port: null, help: false, version: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--version' || arg === '-v') opts.version = true;
    else if (arg === '--port') opts.port = argv[++i];
    else if (arg.startsWith('--port=')) opts.port = arg.slice('--port='.length);
    else fail(`  Unknown option: ${arg}\n  Run \`winden-tokens-mcp --help\`.`);
  }
  return opts;
}

function resolvePort(fromFlag) {
  const raw = fromFlag ?? process.env.WINDEN_BRIDGE_PORT;
  if (raw === undefined || raw === null || raw === '') return DEFAULT_PORT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) fail(`  "${raw}" is not a valid port (1-65535).`);
  return n;
}

// ---------------------------------------------------------------------------
// Preflight — refuse to start, out loud, rather than hang on the first tool call
// ---------------------------------------------------------------------------

function healthz(port) {
  return new Promise((resolve, reject) => {
    const req = httpGet(
      { host: HOST, port, path: '/healthz', headers: { Host: `${HOST}:${port}` } },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, json: null, body });
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(5_000, () => req.destroy(new Error('timed out')));
  });
}

/**
 * Three distinct failures, three distinct sentences. The whole point is that
 * the user reads the reason in their MCP client's log and knows which of the
 * two processes to start — rather than watching a tool call time out later.
 */
async function preflight(port) {
  let health;
  try {
    health = await healthz(port);
  } catch (err) {
    if (err?.code === 'ECONNREFUSED') {
      fail(
        `  winden-tokens-mcp cannot start: nothing is listening on ${HOST}:${port}.\n\n` +
          `  That port belongs to the Winden Tokens bridge relay, and this server is only a\n` +
          `  client of it. Start the relay first, in its own terminal:\n\n` +
          `      winden-tokens --no-open\n\n` +
          `  then start this server again (reconnect the MCP server in your client).`
      );
    }
    fail(
      `  winden-tokens-mcp cannot start: could not reach the bridge relay at ${HOST}:${port}.\n` +
        `  ${err?.message ?? err}`
    );
  }

  if (!health.json || health.json.ok !== true) {
    fail(
      `  winden-tokens-mcp cannot start: something is listening on ${HOST}:${port}, but it did not\n` +
        `  answer /healthz like a Winden Tokens relay (HTTP ${health.status}).\n` +
        `  Another program is probably on that port. Start the relay on a free one:\n\n` +
        `      winden-tokens --no-open --port <n>\n\n` +
        `  and pass the same --port here.`
    );
  }

  if (health.json.protocol !== PROTOCOL_VERSION) {
    fail(
      `  winden-tokens-mcp cannot start: the relay on ${HOST}:${port} speaks bridge protocol\n` +
        `  v${health.json.protocol}, this server speaks v${PROTOCOL_VERSION}. They ship as one package, so they should\n` +
        `  never differ — reinstall it: npm i -g winden-tokens@latest`
    );
  }

  if (health.json.plugin !== true) {
    fail(
      `  winden-tokens-mcp cannot start: the bridge relay is running on ${HOST}:${port}, but no\n` +
        `  Figma plugin is attached to it.\n\n` +
        `  The plugin window is the only thing that can call the Figma API — this server\n` +
        `  cannot read or write a single variable without it. Open the Winden Tokens plugin\n` +
        `  in Figma, on the file you want to work on, leave that window open, and start this\n` +
        `  server again.`
    );
  }

  return health.json;
}

// ---------------------------------------------------------------------------
// The relay socket
// ---------------------------------------------------------------------------

/**
 * The wire role on a COMMAND frame. Not `mcp` — see the header, and PROTOCOL
 * (2b) in ./server.mjs. The hello below is what actually names this peer.
 */
const WIRE_ROLE = 'client';

class RelayLink {
  constructor(port) {
    this.port = port;
    this.socket = null;
    this.connected = false;
    this.pluginAttached = false;
    /** Set when retrying is pointless (protocol mismatch). */
    this.fatal = null;
    /** The most recent `data-loaded`, and a counter so a waiter can tell "new". */
    this.lastSnapshot = null;
    this.snapshotSeq = 0;
    /** @type {Set<{ match:(p:any)=>boolean, resolve:Function, reject:Function, timer:any, describe:string }>} */
    this.waiters = new Set();
    this.retry = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      // No Origin header: a Node client sends none, which is the condition the
      // relay reads as "not a browser" and the only one from which `mcp` may
      // be claimed at all.
      const socket = new WebSocket(`ws://${HOST}:${this.port}`);
      this.socket = socket;

      const timer = setTimeout(() => {
        socket.terminate();
        reject(new Error(`the relay at ${HOST}:${this.port} accepted no WebSocket within ${CONNECT_TIMEOUT_MS}ms`));
      }, CONNECT_TIMEOUT_MS);

      socket.on('open', () => {
        clearTimeout(timer);
        this.connected = true;
        socket.send(
          JSON.stringify({
            v: PROTOCOL_VERSION,
            role: 'mcp',
            kind: 'hello',
            payload: { client: 'winden-tokens-mcp' },
          })
        );
        note(`attached to the relay at ws://${HOST}:${this.port} as role 'mcp'`);
        resolve();
      });

      socket.on('message', (data) => this.receive(data));

      socket.on('error', (err) => {
        clearTimeout(timer);
        if (!this.connected) reject(err);
      });

      socket.on('close', (code, reasonBuf) => {
        clearTimeout(timer);
        const reason = reasonBuf?.toString() || '';
        const wasConnected = this.connected;
        this.connected = false;
        this.pluginAttached = false;
        this.socket = null;

        if (code === CLOSE_VERSION) {
          this.fatal =
            `The relay refused this server over a bridge protocol mismatch: ${reason || 'no reason given'}. ` +
            `Reconnecting cannot fix it — update the older half (npm i -g winden-tokens@latest) and restart.`;
          note(this.fatal);
          this.failWaiters(this.fatal);
          if (!wasConnected) reject(new Error(this.fatal));
          return;
        }

        if (wasConnected) {
          note(`relay socket closed (code ${code}${reason ? `, ${reason}` : ''}) — retrying every ${RECONNECT_MS}ms`);
          this.failWaiters(
            `The connection to the bridge relay closed (code ${code}${reason ? `, ${reason}` : ''}) while waiting. ` +
              `Is \`winden-tokens\` still running?`
          );
          this.scheduleReconnect();
        }
      });
    });
  }

  scheduleReconnect() {
    if (this.retry || this.fatal) return;
    this.retry = setTimeout(() => {
      this.retry = null;
      this.connect().catch(() => this.scheduleReconnect());
    }, RECONNECT_MS);
    this.retry.unref?.();
  }

  receive(data) {
    let frame;
    try {
      frame = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (!frame || typeof frame !== 'object' || frame.v !== PROTOCOL_VERSION) return;

    // The relay's own frames: the only way this server learns that the Figma
    // window went away, instead of discovering it as a timeout.
    if (frame.role === 'relay' && frame.kind === 'status') {
      const type = frame.payload?.type;
      if (type === 'bridge/plugin-connected') {
        this.pluginAttached = true;
        note('the Figma plugin is attached');
      } else if (type === 'bridge/plugin-disconnected') {
        this.pluginAttached = false;
        note('the Figma plugin window detached');
        this.failWaiters(
          'The Figma plugin window detached while this was waiting. Reopen the Winden Tokens plugin in Figma and try again.'
        );
      } else if (type === 'bridge/version-mismatch') {
        note(String(frame.payload?.message ?? 'bridge protocol version mismatch'));
      }
      return;
    }

    if (frame.role !== 'plugin' || frame.kind !== 'message') return;
    const payload = frame.payload;
    if (!payload || typeof payload !== 'object') return;

    if (payload.type === 'data-loaded') {
      this.lastSnapshot = payload;
      this.snapshotSeq++;
    }

    for (const waiter of [...this.waiters]) {
      if (waiter.match(payload)) {
        this.waiters.delete(waiter);
        clearTimeout(waiter.timer);
        waiter.resolve(payload);
      }
    }
  }

  failWaiters(message) {
    for (const waiter of [...this.waiters]) {
      this.waiters.delete(waiter);
      clearTimeout(waiter.timer);
      waiter.reject(new Error(`${message} (was waiting for ${waiter.describe})`));
    }
  }

  send(payload) {
    if (this.fatal) throw new Error(this.fatal);
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error(
        `Not connected to the bridge relay at ${HOST}:${this.port}. Is \`winden-tokens\` still running? ` +
          `This server retries every ${RECONNECT_MS}ms — try again in a moment.`
      );
    }
    this.socket.send(JSON.stringify({ v: PROTOCOL_VERSION, role: WIRE_ROLE, kind: 'message', payload }));
  }

  /**
   * Send something and wait for the first plugin message that satisfies
   * `match`. The entire correlation strategy is these four lines plus a clock:
   * the protocol offers nothing to match on but the outcome itself.
   */
  await({ match, describe, timeoutMs, trigger, onTimeout }) {
    if (this.fatal) return Promise.reject(new Error(this.fatal));
    if (!this.pluginAttached) {
      return Promise.reject(
        new Error(
          'No Figma plugin is attached to the bridge relay. The plugin window is the only thing that can ' +
            'reach the Figma API. Open the Winden Tokens plugin in Figma, on the file you want, and leave it open.'
        )
      );
    }

    return new Promise((resolve, reject) => {
      const waiter = { match, describe, resolve, reject, timer: null };
      waiter.timer = setTimeout(() => {
        this.waiters.delete(waiter);
        reject(
          new Error(
            `Timed out after ${Math.round(timeoutMs / 1000)}s waiting for ${describe}. ` +
              `The Figma plugin is attached but said nothing back.` +
              (onTimeout ? ` ${onTimeout}` : '')
          )
        );
      }, timeoutMs);
      this.waiters.add(waiter);

      try {
        trigger();
      } catch (err) {
        this.waiters.delete(waiter);
        clearTimeout(waiter.timer);
        reject(err);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Reads and writes, in terms of the link
// ---------------------------------------------------------------------------

/**
 * Ask the plugin for the current state of the file and wait for it.
 *
 * Any `data-loaded` that arrives after the trigger answers this: the payload is
 * a complete snapshot of collections, variables and modes, so a snapshot
 * someone else's action happened to cause is exactly as valid as one caused by
 * us. That is the one place where correlating by outcome costs nothing at all.
 */
function readSnapshot(link) {
  return link.await({
    describe: 'a fresh token snapshot (`data-loaded`) from the Figma plugin',
    match: (p) => p.type === 'data-loaded',
    timeoutMs: READ_TIMEOUT_MS,
    trigger: () => link.send({ type: 'ui-ready' }),
    onTimeout: 'A very large file can take a while; the Figma window may also be mid-operation.',
  });
}

const NO_OP_HINT =
  'Note that the plugin answers `update-variable-value`, `update-variable-name` and `delete-variable` ' +
  'with NOTHING AT ALL when the target id no longer exists, so a vanished variable looks exactly like this.';

/**
 * Send one mutating command and wait for the plugin's outcome.
 *
 * Returns the snapshot that goes with it: every write handler in
 * src/plugin/code.ts calls `fetchData()` BEFORE it posts `update-success`, so
 * the post-write `data-loaded` has already arrived by the time we get here.
 * Using it saves a second full read of the file and is strictly closer to the
 * truth than re-reading a moment later would be.
 */
async function writeCommand(link, command, describe) {
  const seqBefore = link.snapshotSeq;

  const outcome = await link.await({
    describe,
    match: (p) => p.type === 'update-success' || p.type === 'update-error',
    timeoutMs: WRITE_TIMEOUT_MS,
    trigger: () => link.send(command),
    onTimeout: NO_OP_HINT,
  });

  if (outcome.type === 'update-error') {
    throw new Error(`The Figma plugin refused ${JSON.stringify(command.type)}: ${outcome.error}`);
  }

  const snapshot = link.snapshotSeq > seqBefore ? link.lastSnapshot : await readSnapshot(link);
  return snapshot;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

const CONCURRENCY_CAVEAT =
  'CORRELATION CAVEAT: the plugin protocol is fire-and-forget — a command carries no id and the reply ' +
  'carries none either. This tool sends the command and returns on the plugin\'s next `update-success`. ' +
  'If anything else writes at the same moment (a browser tab on the same bridge, or the user clicking in ' +
  'the plugin window), that success may belong to the other write. The result below is therefore re-read ' +
  'from the file rather than assumed — check it, and do not treat success alone as proof this change landed.';

const VALUE_SYNTAX =
  'Values are written as strings, in the syntax the plugin parses: COLOR `#rrggbb`, `#rgb` or ' +
  '`rgba(r,g,b,a)` with 0-255 channels; FLOAT a plain number like `16`; BOOLEAN `true` or `false`; ' +
  'STRING the text itself. A REFERENCE to another variable is `{full/variable/name}` — resolved by name ' +
  'against every local variable, so the name must be exact and, if two variables share it, the first ' +
  'match wins.';

const TOOLS = [
  {
    name: 'list_collections',
    description:
      'List the variable collections in the Figma file that is currently open, with their modes, how many ' +
      'variables each holds, and the groups (name prefixes) inside them. Start here: every other tool wants ' +
      'a collection id or a group prefix, and this is where those come from. Reads the live file; makes no changes.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_variables',
    description:
      'List variables in the open Figma file, with their value in every mode. Filter by collection, by group ' +
      '(a name prefix such as `color/brand`), by type, or by a substring of the name. A value shown as ' +
      '`{some/other/token}` is a reference to that variable. Capped at ' + DEFAULT_LIMIT + ' rows by default; the ' +
      'result says when it truncated. Reads the live file; makes no changes.',
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'Collection id (preferred) or exact name.' },
        group: { type: 'string', description: 'Name prefix, e.g. `color/brand`. Matches everything under it.' },
        type: { type: 'string', enum: ['COLOR', 'FLOAT', 'STRING', 'BOOLEAN'], description: 'Figma variable type.' },
        name_contains: { type: 'string', description: 'Case-insensitive substring of the full variable name.' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_LIMIT, description: `Max rows (default ${DEFAULT_LIMIT}).` },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_variable',
    description:
      'Everything about one variable: its value in each mode, what it references (per mode — a token can alias ' +
      'one variable in Light and another in Dark), and what references it. Call this before renaming or deleting ' +
      'anything: `referencedBy` is the blast radius. Reads the live file; makes no changes.',
    inputSchema: {
      type: 'object',
      properties: {
        variable: { type: 'string', description: 'Variable id (preferred) or its exact full name, e.g. `color/brand/500`.' },
      },
      required: ['variable'],
      additionalProperties: false,
    },
  },

  // ---- writes ----

  {
    name: 'create_collection',
    description:
      'Create an empty variable collection in the open Figma file. It starts with one mode, named by Figma. ' +
      'Additive and easy to undo by hand (delete it in Figma), but it does change the user\'s file.\n\n' +
      CONCURRENCY_CAVEAT,
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Collection name.' } },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_variable',
    description:
      'Create one variable in a collection. Put it in a group by naming it with `/` — `color/brand/500` is the ' +
      'variable `500` in the group `color/brand`; that is the only thing a group is.\n\n' +
      'The value is set on the collection\'s FIRST mode only. For a multi-mode collection, set the other modes ' +
      'afterwards with set_variable_value.\n\n' + VALUE_SYNTAX + '\n\n' + CONCURRENCY_CAVEAT,
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'Collection id (preferred) or exact name.' },
        name: { type: 'string', description: 'Full variable name, `/` separated, e.g. `color/brand/500`.' },
        type: { type: 'string', enum: ['COLOR', 'FLOAT', 'STRING', 'BOOLEAN'] },
        value: { type: 'string', description: 'Initial value. Omitted means the type\'s default (black / 0 / empty / false).' },
      },
      required: ['collection', 'name', 'type'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_group',
    description:
      'Create a group of variables in one call. A GROUP IS NOT AN OBJECT IN FIGMA: it exists only as the shared ' +
      '`/` prefix of the variables in it, so an empty group cannot be represented and this tool therefore ' +
      'requires the variables to put in it. Each is created as `<group>/<name>`, one command at a time, and the ' +
      'result reports each one separately — a partial failure leaves the variables that already succeeded in ' +
      'place.\n\n' + VALUE_SYNTAX + '\n\n' + CONCURRENCY_CAVEAT,
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'Collection id (preferred) or exact name.' },
        group: { type: 'string', description: 'Group prefix, e.g. `color/brand`. May itself be nested.' },
        variables: {
          type: 'array',
          minItems: 1,
          description: 'The variables to create inside the group.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Leaf name, appended to the group prefix.' },
              type: { type: 'string', enum: ['COLOR', 'FLOAT', 'STRING', 'BOOLEAN'] },
              value: { type: 'string' },
            },
            required: ['name', 'type'],
            additionalProperties: false,
          },
        },
      },
      required: ['collection', 'group', 'variables'],
      additionalProperties: false,
    },
  },
  {
    name: 'set_variable_value',
    description:
      'Set one variable\'s value in one mode. The mode must be named explicitly whenever its collection has more ' +
      'than one — this tool will not guess, because a value written into the wrong mode looks correct until ' +
      'someone switches theme.\n\n' + VALUE_SYNTAX + '\n\n' +
      'Overwrites the previous value, which is not recoverable from here; the old value is reported back so it ' +
      'can be put back by hand.\n\n' + CONCURRENCY_CAVEAT,
    inputSchema: {
      type: 'object',
      properties: {
        variable: { type: 'string', description: 'Variable id (preferred) or exact full name.' },
        value: { type: 'string', description: 'The new value, or `{another/variable}` to reference one.' },
        mode: { type: 'string', description: 'Mode name or mode id. Required when the collection has several modes.' },
      },
      required: ['variable', 'value'],
      additionalProperties: false,
    },
  },
  {
    name: 'rename_variable',
    description:
      'DESTRUCTIVE — ASK THE USER FIRST. Renames a variable in the user\'s Figma file. THERE IS NO UNDO FROM ' +
      'HERE: this server cannot reverse it, and only Figma\'s own undo, in the Figma window, can.\n\n' +
      'What a rename does and does not break: aliases between variables are stored by id, so other variables ' +
      'that reference this one keep working. Everything that consumes the NAME does not — exported CSS custom ' +
      'properties, code that looks the token up by name, and any documentation of it. Renaming across `/` also ' +
      'MOVES the variable between groups, which is the usual reason to call this.\n\n' +
      'Call get_variable first and look at `referencedBy`. The result reports what referenced it at the moment ' +
      'of the rename.\n\n' + CONCURRENCY_CAVEAT,
    inputSchema: {
      type: 'object',
      properties: {
        variable: { type: 'string', description: 'Variable id (preferred) or exact full name.' },
        new_name: { type: 'string', description: 'New full name, `/` separated.' },
      },
      required: ['variable', 'new_name'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_variable',
    description:
      'DESTRUCTIVE — ASK THE USER FIRST. Permanently deletes a variable from the user\'s Figma file. THERE IS NO ' +
      'UNDO FROM HERE: this server cannot restore it, and only Figma\'s own undo, in the Figma window, can — and ' +
      'only while that window is open.\n\n' +
      'It can take more than the one variable with it. If the variable is the source of a generated shade ramp, ' +
      'the plugin deletes EVERY shade it manages in the same step. Any variable that aliased this one is left ' +
      'pointing at nothing, and so is every layer in the file bound to it.\n\n' +
      'This tool reads the file first and reports what would be affected, then deletes. Call get_variable and ' +
      'show the user `referencedBy` before calling this.\n\n' + CONCURRENCY_CAVEAT,
    inputSchema: {
      type: 'object',
      properties: {
        variable: { type: 'string', description: 'Variable id (preferred) or exact full name.' },
      },
      required: ['variable'],
      additionalProperties: false,
    },
  },
];

function ok(result) {
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
}

function findVariable(snapshot, collectionId, name) {
  return (snapshot.variables ?? []).find((v) => v.collectionId === collectionId && v.name === name) ?? null;
}

async function callTool(link, name, args) {
  switch (name) {
    // ---- reads ----

    case 'list_collections': {
      const snapshot = await readSnapshot(link);
      const collections = collectionsOverview(snapshot);
      return ok({
        collections,
        totalVariables: (snapshot.variables ?? []).length,
        ...(collections.length === 0
          ? { note: 'This file has no local variable collections yet. create_collection makes one.' }
          : {}),
      });
    }

    case 'list_variables': {
      const snapshot = await readSnapshot(link);
      const matched = filterVariables(snapshot, args);
      const limit = Math.min(Number(args.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
      const shown = matched.slice(0, limit);
      return ok({
        matched: matched.length,
        returned: shown.length,
        ...(matched.length > shown.length
          ? { truncated: `${matched.length - shown.length} more — narrow the filter or raise \`limit\` (max ${MAX_LIMIT}).` }
          : {}),
        variables: shown.map((v) => summariseVariable(snapshot, v)),
      });
    }

    case 'get_variable': {
      const snapshot = await readSnapshot(link);
      return ok(describeVariable(snapshot, resolveVariable(snapshot, args.variable)));
    }

    // ---- writes ----

    case 'create_collection': {
      if (!args.name) throw new Error('A collection name is required.');
      const before = await readSnapshot(link);
      const clash = (before.collections ?? []).find((c) => c.name === args.name);

      const after = await writeCommand(
        link,
        { type: 'create-collection', name: args.name },
        `the plugin to confirm it created the collection ${JSON.stringify(args.name)}`
      );

      const created = (after.collections ?? []).filter((c) => c.name === args.name);
      return ok({
        created: created.length ? { id: created[created.length - 1].id, name: args.name, modes: created[created.length - 1].modes } : null,
        ...(clash
          ? { warning: `A collection named ${JSON.stringify(args.name)} already existed (${clash.id}). Figma allows the duplicate; now there are two, and a name alone no longer identifies one.` }
          : {}),
        collections: collectionsOverview(after).map((c) => ({ id: c.id, name: c.name, variableCount: c.variableCount })),
      });
    }

    case 'create_variable': {
      const before = await readSnapshot(link);
      const collection = resolveCollection(before, args.collection);
      const type = normaliseType(args.type);
      if (!args.name) throw new Error('A variable name is required.');
      if (findVariable(before, collection.id, args.name)) {
        throw new Error(
          `${JSON.stringify(args.name)} already exists in ${collection.name}. Figma would let you create a second ` +
            `variable with the same name; refusing, because a duplicate name breaks {reference} lookups. ` +
            `Use set_variable_value to change the existing one.`
        );
      }

      const after = await writeCommand(
        link,
        { type: 'create-variable', collectionId: collection.id, name: args.name, varType: type, value: args.value ?? '' },
        `the plugin to confirm it created ${JSON.stringify(args.name)} in ${JSON.stringify(collection.name)}`
      );

      const created = findVariable(after, collection.id, args.name);
      if (!created) {
        throw new Error(
          `The plugin reported success, but ${JSON.stringify(args.name)} is not in the snapshot that came back. ` +
            `Given that a concurrent write can produce the success we matched on, treat this as "probably did not ` +
            `happen" and check the file.`
        );
      }
      return ok({
        created: describeVariable(after, created),
        note:
          collection.modes.length > 1
            ? `The value was set on the first mode (${collection.modes[0].name}) only — ${collection.name} has ${collection.modes.length} modes. Use set_variable_value for the rest.`
            : undefined,
      });
    }

    case 'create_group': {
      const before = await readSnapshot(link);
      const collection = resolveCollection(before, args.collection);
      const group = String(args.group ?? '').replace(/^\/+|\/+$/g, '');
      if (!group) throw new Error('A group prefix is required.');
      const wanted = args.variables ?? [];
      if (!wanted.length) {
        throw new Error(
          'A group needs at least one variable: a Figma group exists only as the shared `/` prefix of the ' +
            'variables in it, so an empty one cannot be created.'
        );
      }

      const results = [];
      let snapshot = before;
      for (const spec of wanted) {
        const fullName = groupedName(group, spec.name);
        try {
          const type = normaliseType(spec.type);
          if (findVariable(snapshot, collection.id, fullName)) {
            results.push({ name: fullName, status: 'skipped', reason: 'already exists' });
            continue;
          }
          snapshot = await writeCommand(
            link,
            { type: 'create-variable', collectionId: collection.id, name: fullName, varType: type, value: spec.value ?? '' },
            `the plugin to confirm it created ${JSON.stringify(fullName)}`
          );
          const created = findVariable(snapshot, collection.id, fullName);
          results.push(
            created
              ? { name: fullName, status: 'created', id: created.id, values: summariseVariable(snapshot, created).values }
              : { name: fullName, status: 'unconfirmed', reason: 'the plugin reported success but the variable is not in the snapshot' }
          );
        } catch (err) {
          // Stop at the first real failure. Continuing would create half a
          // group and bury the reason under later output.
          results.push({ name: fullName, status: 'failed', reason: err.message });
          break;
        }
      }

      return ok({
        collection: { id: collection.id, name: collection.name },
        group,
        results,
        created: results.filter((r) => r.status === 'created').length,
        ...(results.some((r) => r.status === 'failed')
          ? { warning: 'Stopped at the first failure. Variables listed as created are already in the file.' }
          : {}),
      });
    }

    case 'set_variable_value': {
      const before = await readSnapshot(link);
      const variable = resolveVariable(before, args.variable);
      const collection = resolveCollection(before, variable.collectionId);
      const mode = resolveMode(collection, args.mode);
      if (typeof args.value !== 'string') throw new Error('`value` must be a string — see the value syntax in this tool\'s description.');

      const previous = variable.valuesByMode?.[mode.modeId];

      const after = await writeCommand(
        link,
        { type: 'update-variable-value', id: variable.id, value: args.value, modeId: mode.modeId },
        `the plugin to confirm it set ${JSON.stringify(variable.name)} in mode ${JSON.stringify(mode.name)}`
      );

      const updated = (after.variables ?? []).find((v) => v.id === variable.id);
      return ok({
        variable: updated ? describeVariable(after, updated) : null,
        mode: mode.name,
        previousValue: previous,
        newValue: updated?.valuesByMode?.[mode.modeId],
        ...(updated?.valuesByMode?.[mode.modeId] === previous
          ? { warning: 'The value in the file is unchanged. Either it already had this value, or the write that reported success was somebody else\'s.' }
          : {}),
      });
    }

    case 'rename_variable': {
      const before = await readSnapshot(link);
      const variable = resolveVariable(before, args.variable);
      if (!args.new_name) throw new Error('`new_name` is required.');
      if (args.new_name === variable.name) throw new Error(`${JSON.stringify(variable.name)} already has that name.`);
      const clash = findVariable(before, variable.collectionId, args.new_name);
      if (clash) {
        throw new Error(
          `${JSON.stringify(args.new_name)} is already taken in that collection (${clash.id}). Two variables with ` +
            `one name make every {reference} to it ambiguous.`
        );
      }
      const wasReferencedBy = describeVariable(before, variable).referencedBy;

      const after = await writeCommand(
        link,
        { type: 'update-variable-name', id: variable.id, name: args.new_name },
        `the plugin to confirm it renamed ${JSON.stringify(variable.name)}`
      );

      const updated = (after.variables ?? []).find((v) => v.id === variable.id);
      return ok({
        renamed: { id: variable.id, from: variable.name, to: updated?.name ?? null },
        confirmed: updated?.name === args.new_name,
        referencedBy: wasReferencedBy,
        note:
          wasReferencedBy.length > 0
            ? `${wasReferencedBy.length} variable(s) referenced it. Those aliases are stored by id and still work; anything outside Figma that used the old NAME does not.`
            : 'Nothing referenced it inside Figma. Anything outside Figma that used the old name still needs updating.',
        ...(updated?.name === args.new_name
          ? {}
          : { warning: 'The file does not show the new name. The success this matched on may have been a concurrent write — check Figma.' }),
      });
    }

    case 'delete_variable': {
      const before = await readSnapshot(link);
      const variable = resolveVariable(before, args.variable);
      const impact = deletionImpact(before, variable);

      const after = await writeCommand(
        link,
        { type: 'delete-variable', id: variable.id },
        `the plugin to confirm it deleted ${JSON.stringify(variable.name)}`
      );

      const stillThere = (after.variables ?? []).some((v) => v.id === variable.id);
      const shadesGone = impact.managedShades.filter((s) => !(after.variables ?? []).some((v) => v.id === s.id));

      return ok({
        deleted: { id: variable.id, name: variable.name, type: variable.resolvedType },
        confirmed: !stillThere,
        alsoDeleted: shadesGone,
        nowDangling: impact.referencedBy,
        note:
          impact.referencedBy.length > 0
            ? `${impact.referencedBy.length} variable(s) referenced it and now point at a variable that no longer exists. Fix them with set_variable_value.`
            : 'No other variable referenced it. Layers bound to it in the file are not visible from here and may still be.',
        ...(stillThere
          ? { warning: 'The variable is still in the file. The success this matched on was probably a concurrent write — check Figma.' }
          : {}),
      });
    }

    default:
      throw new Error(`Unknown tool ${JSON.stringify(name)}.`);
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function version() {
  try {
    const pkg = JSON.parse(await readFile(join(HERE, 'package.json'), 'utf8'));
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.error(HELP);
    return;
  }
  if (opts.version) {
    console.error(await version());
    return;
  }

  const port = resolvePort(opts.port);
  const health = await preflight(port);
  note(`relay ok on ${HOST}:${port} — protocol v${health.protocol}, plugin attached, ${health.clients} browser tab(s)`);

  const link = new RelayLink(port);
  try {
    await link.connect();
  } catch (err) {
    fail(
      `  winden-tokens-mcp cannot start: the relay answered /healthz but refused the WebSocket.\n` +
        `  ${err?.message ?? err}`
    );
  }

  // /healthz already said the plugin is there; the relay confirms it on our
  // hello. Wait briefly for that frame so the first tool call does not race it.
  const deadline = Date.now() + 2_000;
  while (!link.pluginAttached && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 25));
  }
  if (!link.pluginAttached) {
    fail(
      `  winden-tokens-mcp cannot start: the relay accepted this server, but then reported that no Figma\n` +
        `  plugin is attached. Open the Winden Tokens plugin in Figma and start this server again.`
    );
  }

  const server = new Server(
    { name: 'winden-tokens', version: await version() },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      return await callTool(link, name, args ?? {});
    } catch (err) {
      // A tool failure is a result, not a transport error: the model has to be
      // able to read what went wrong and try something else.
      return { content: [{ type: 'text', text: err?.message ?? String(err) }], isError: true };
    }
  });

  await server.connect(new StdioServerTransport());
  note('MCP server ready on stdio');
}

main().catch((err) => {
  fail(`  winden-tokens-mcp failed to start:\n  ${err?.stack ?? err}`);
});
