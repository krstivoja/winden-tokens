// Tests for the bridge relay (bridge/server.mjs) as the `winden-tokens`
// package runs it: serving the browser UI, and the Origin/Host/version checks,
// the mcp token and plugin pairing that stand between a hostile page and the
// user's Figma file.
//
// Real sockets on a real loopback port. The relay's whole job is the handshake,
// and a mock of the handshake would test nothing.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import { request } from 'node:http';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';

import {
  startRelay,
  CLOSE_VERSION,
  CLOSE_POLICY,
  CLOSE_PAIRING_DENIED,
  CLOSE_PAIRING_TIMEOUT,
  CLOSE_PAIRING_BUSY,
  PROTOCOL_VERSION,
  hashPluginKey,
  pairingCode,
  readMcpToken,
} from '../../bridge/server.mjs';

const UI_MARKER = '<html><body>winden tokens ui</body></html>';

/** A plugin key the test relays already trust, and two they do not. */
const TRUSTED_KEY = 'a'.repeat(32);
const UNKNOWN_KEY = 'b'.repeat(32);
const OTHER_UNKNOWN_KEY = 'c'.repeat(40);

const homes = [];
afterAll(() => homes.forEach((h) => rmSync(h, { recursive: true, force: true })));

/** A fresh secrets dir per relay, so no test ever touches ~/.winden-tokens. */
function tempHome({ trusted = [TRUSTED_KEY] } = {}) {
  const home = mkdtempSync(join(tmpdir(), 'winden-home-test-'));
  homes.push(home);
  if (trusted.length) {
    writeFileSync(join(home, 'trusted-plugins.json'), JSON.stringify(trusted.map(hashPluginKey)));
  }
  return home;
}

const pluginHello = (pluginKey = TRUSTED_KEY) => ({ v: PROTOCOL_VERSION, role: 'plugin', kind: 'hello', payload: { pluginKey } });
const mcpHello = (home) => ({ v: PROTOCOL_VERSION, role: 'mcp', kind: 'hello', payload: { token: readMcpToken(home) } });
const statusOf = (frames) => frames.filter((f) => f.role === 'relay' && f.kind === 'status').map((f) => f.payload);

/** An unused loopback port, so this suite never touches the dev relay's 9337. */
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function get(port, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method: 'GET', headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

/** Open a socket and settle on what the relay did with it. */
function handshake(port, { origin, hello } = {}) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, origin ? { origin } : {});
    const frames = [];
    let opened = false;

    ws.on('unexpected-response', (_req, res) => {
      resolve({ opened: false, httpStatus: res.statusCode, frames });
    });
    ws.on('error', () => {
      /* resolved by 'unexpected-response' or 'close' */
    });
    ws.on('open', () => {
      opened = true;
      if (hello) ws.send(JSON.stringify(hello));
    });
    ws.on('message', (data) => frames.push(JSON.parse(data.toString())));
    ws.on('close', (code, reason) => {
      resolve({ opened, closeCode: code, closeReason: reason.toString(), frames });
    });

    // A socket that stays open is itself the result we want to assert on.
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        resolve({ opened, stillOpen: true, frames, ws });
      }
    }, 250);
  });
}

describe('bridge relay', () => {
  let dir;
  let uiFile;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'winden-relay-test-'));
    uiFile = join(dir, 'index.html');
    writeFileSync(uiFile, UI_MARKER);
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  describe('serving the UI', () => {
    let relay;
    let port;

    beforeAll(async () => {
      port = await freePort();
      relay = await startRelay({ port, uiFile, home: tempHome() });
    });
    afterAll(() => relay.close());

    it('serves the bundled page at / and at /index.html', async () => {
      for (const path of ['/', '/index.html']) {
        const res = await get(port, path, { Host: `127.0.0.1:${port}` });
        expect(res.status).toBe(200);
        expect(res.body).toBe(UI_MARKER);
        expect(res.headers['content-type']).toContain('text/html');
        // The relay and the UI ship as one unit; a cached page could outlive it.
        expect(res.headers['cache-control']).toBe('no-store');
      }
    });

    it('serves nothing else', async () => {
      const res = await get(port, '/../etc/passwd', { Host: `127.0.0.1:${port}` });
      expect(res.status).toBe(404);
    });

    it('refuses a request whose Host is not loopback (DNS rebinding guard)', async () => {
      const res = await get(port, '/', { Host: 'tokens.evil.example' });
      expect(res.status).toBe(403);
    });

    it('answers the localhost spelling too', async () => {
      const res = await get(port, '/', { Host: `localhost:${port}` });
      expect(res.status).toBe(200);
    });
  });

  describe('Origin allowlist', () => {
    let relay;
    let port;

    beforeAll(async () => {
      port = await freePort();
      relay = await startRelay({ port, uiFile, home: tempHome() });
    });
    afterAll(() => relay.close());

    it('refuses a hostile page before the upgrade completes', async () => {
      const result = await handshake(port, { origin: 'https://evil.example' });
      expect(result.opened).toBe(false);
      expect(result.httpStatus).toBe(403);
    });

    it("refuses the vite dev origin when the relay is not in dev mode", async () => {
      const result = await handshake(port, { origin: 'http://localhost:5173' });
      expect(result.opened).toBe(false);
      expect(result.httpStatus).toBe(403);
    });

    it("accepts the relay's own origin as a client", async () => {
      const result = await handshake(port, {
        origin: `http://127.0.0.1:${port}`,
        hello: { v: PROTOCOL_VERSION, role: 'client', kind: 'hello' },
      });
      expect(result.stillOpen).toBe(true);
      expect(result.frames[0]).toMatchObject({ role: 'relay', kind: 'status' });
      result.ws.close();
    });

    it("refuses a browser origin that claims role 'plugin'", async () => {
      const result = await handshake(port, {
        origin: `http://127.0.0.1:${port}`,
        hello: pluginHello(),
      });
      expect(result.closeCode).toBe(4001);
    });

    it("refuses a null origin that claims role 'client'", async () => {
      const result = await handshake(port, {
        hello: { v: PROTOCOL_VERSION, role: 'client', kind: 'hello' },
      });
      expect(result.closeCode).toBe(4001);
    });
  });

  describe('Origin allowlist in dev mode', () => {
    let relay;
    let port;

    beforeAll(async () => {
      port = await freePort();
      relay = await startRelay({ port, uiFile, dev: true, home: tempHome() });
    });
    afterAll(() => relay.close());

    it('accepts the vite dev origin, and only then', async () => {
      const result = await handshake(port, {
        origin: 'http://localhost:5173',
        hello: { v: PROTOCOL_VERSION, role: 'client', kind: 'hello' },
      });
      expect(result.stillOpen).toBe(true);
      result.ws.close();
    });

    it('still refuses a hostile origin', async () => {
      const result = await handshake(port, { origin: 'https://evil.example' });
      expect(result.httpStatus).toBe(403);
    });
  });

  describe('protocol version handshake', () => {
    let relay;
    let port;

    beforeAll(async () => {
      port = await freePort();
      relay = await startRelay({ port, uiFile, home: tempHome() });
    });
    afterAll(() => relay.close());

    it('refuses a newer peer with a readable close reason', async () => {
      const result = await handshake(port, {
        hello: { v: PROTOCOL_VERSION + 1, role: 'plugin', kind: 'hello' },
      });
      expect(result.closeCode).toBe(CLOSE_VERSION);
      expect(result.closeReason).toContain(`relay v${PROTOCOL_VERSION}`);
      expect(result.closeReason).toContain(`v${PROTOCOL_VERSION + 1}`);
      // A close reason is capped at 123 bytes by the protocol.
      expect(Buffer.byteLength(result.closeReason, 'utf8')).toBeLessThanOrEqual(123);
    });

    it('checks the version before the role, so a future role name still reports the real problem', async () => {
      const result = await handshake(port, {
        hello: { v: 99, role: 'observer', kind: 'hello' },
      });
      expect(result.closeCode).toBe(CLOSE_VERSION);
    });

    it('tells an attached client why the other half never showed up', async () => {
      const client = new WebSocket(`ws://127.0.0.1:${port}`, { origin: `http://127.0.0.1:${port}` });
      const frames = [];
      client.on('message', (data) => frames.push(JSON.parse(data.toString())));

      await new Promise((resolve) => client.on('open', resolve));
      client.send(JSON.stringify({ v: PROTOCOL_VERSION, role: 'client', kind: 'hello' }));
      await new Promise((r) => setTimeout(r, 100));

      await handshake(port, { hello: { v: PROTOCOL_VERSION + 1, role: 'plugin', kind: 'hello' } });
      await new Promise((r) => setTimeout(r, 100));

      const mismatch = frames.find((f) => f.payload?.type === 'bridge/version-mismatch');
      expect(mismatch).toBeTruthy();
      expect(mismatch.v).toBe(PROTOCOL_VERSION);
      expect(mismatch.role).toBe('relay');
      expect(mismatch.payload.relay).toBe(PROTOCOL_VERSION);
      expect(mismatch.payload.peer).toBe(PROTOCOL_VERSION + 1);
      expect(mismatch.payload.message).toMatch(/mismatch/i);

      client.close();
    });
  });
  // -------------------------------------------------------------------------
  // The third role. See PROTOCOL (2b) and the THREAT MODEL block in
  // bridge/server.mjs — the point of every test here is that an `mcp` socket
  // has a strict SUBSET of a browser tab's powers and is invisible to the
  // Figma plugin window.
  // -------------------------------------------------------------------------

  describe('the mcp role', () => {
    let relay;
    let port;
    let home;

    beforeAll(async () => {
      port = await freePort();
      home = tempHome();
      relay = await startRelay({ port, uiFile, home });
    });
    afterAll(() => relay.close());

    /** An identified socket that stays open, with everything it received. */
    async function attach(role, { origin } = {}) {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`, origin ? { origin } : {});
      const frames = [];
      ws.on('message', (data) => frames.push(JSON.parse(data.toString())));
      await new Promise((resolve) => ws.on('open', resolve));
      const hello =
        role === 'plugin' ? pluginHello() : role === 'mcp' ? mcpHello(home) : { v: PROTOCOL_VERSION, role, kind: 'hello' };
      ws.send(JSON.stringify(hello));
      await new Promise((r) => setTimeout(r, 120));
      return { ws, frames };
    }

    const settle = () => new Promise((r) => setTimeout(r, 120));

    it("accepts 'mcp' with the relay's token, and tells it whether the plugin is there", async () => {
      const mcp = await attach('mcp');
      expect(mcp.ws.readyState).toBe(WebSocket.OPEN);
      expect(mcp.frames.at(-1)).toMatchObject({
        role: 'relay',
        kind: 'status',
        payload: { type: 'bridge/plugin-disconnected' },
      });
      mcp.ws.close();
    });

    it("refuses 'mcp' from a browser Origin — only a non-browser peer may claim it", async () => {
      const result = await handshake(port, {
        origin: `http://127.0.0.1:${port}`,
        hello: mcpHello(home),
      });
      expect(result.closeCode).toBe(4001);
      expect(result.closeReason).toContain("may only claim role 'client'");
    });

    it('is invisible to the plugin: no forwarded hello, no client-attached', async () => {
      const plugin = await attach('plugin');
      const before = plugin.frames.length;

      const mcp = await attach('mcp');
      await settle();

      // A browser tab attaching sends the plugin TWO frames (the forwarded
      // hello and `client-attached`), and both put the plugin UI into headless
      // mode. An mcp socket must send it nothing at all.
      expect(plugin.frames.slice(before)).toEqual([]);

      mcp.ws.close();
      await settle();
      expect(plugin.frames.slice(before)).toEqual([]); // nor on the way out

      plugin.ws.close();
    });

    it('sends commands to the plugin and receives what the plugin broadcasts', async () => {
      const plugin = await attach('plugin');
      const mcp = await attach('mcp');
      const seen = plugin.frames.length;

      mcp.ws.send(
        JSON.stringify({ v: PROTOCOL_VERSION, role: 'client', kind: 'message', payload: { type: 'ui-ready' } })
      );
      await settle();
      expect(plugin.frames.slice(seen)).toEqual([
        { v: PROTOCOL_VERSION, role: 'client', kind: 'message', payload: { type: 'ui-ready' } },
      ]);

      const got = mcp.frames.length;
      plugin.ws.send(
        JSON.stringify({ v: PROTOCOL_VERSION, role: 'plugin', kind: 'message', payload: { type: 'data-loaded', variables: [] } })
      );
      await settle();
      expect(mcp.frames.slice(got)).toEqual([
        { v: PROTOCOL_VERSION, role: 'plugin', kind: 'message', payload: { type: 'data-loaded', variables: [] } },
      ]);

      mcp.ws.close();
      plugin.ws.close();
    });

    it('cannot reach a browser tab, and does not count as one', async () => {
      const client = await attach('client', { origin: `http://127.0.0.1:${port}` });
      const mcp = await attach('mcp');
      const seen = client.frames.length;

      mcp.ws.send(
        JSON.stringify({ v: PROTOCOL_VERSION, role: 'client', kind: 'message', payload: { type: 'delete-all-variables' } })
      );
      await settle();
      expect(client.frames.slice(seen)).toEqual([]);

      const health = await get(port, '/healthz');
      expect(JSON.parse(health.body)).toMatchObject({ clients: 1, mcp: 1, plugin: false });

      mcp.ws.close();
      client.ws.close();
    });

    it('never becomes the plugin socket', async () => {
      const plugin = await attach('plugin');
      const mcp = await attach('mcp');
      await settle();

      // A second PLUGIN hello replaces the first (close code 4000). An mcp
      // hello must not, or a background process could take the Figma window's
      // place and feed browser tabs whatever it liked.
      expect(plugin.ws.readyState).toBe(WebSocket.OPEN);
      expect(JSON.parse((await get(port, '/healthz')).body)).toMatchObject({ plugin: true, mcp: 1 });

      mcp.ws.close();
      plugin.ws.close();
    });
  });

  // -------------------------------------------------------------------------
  // A null Origin proves nothing: any page can send it from
  // <iframe sandbox="allow-scripts">. These are the regression tests for that
  // hole — on protocol v1 both a token-less `mcp` and a key-less `plugin` from
  // `Origin: null` were accepted. See THREAT MODEL (4) in bridge/server.mjs.
  // -------------------------------------------------------------------------

  describe('null Origin is authenticated (sandboxed-iframe hole)', () => {
    let relay;
    let port;
    let home;

    beforeAll(async () => {
      port = await freePort();
      home = tempHome();
      relay = await startRelay({ port, uiFile, home });
    });
    afterAll(() => relay.close());

    const health = async () => JSON.parse((await get(port, '/healthz')).body);

    it("refuses 'mcp' from Origin: null with no token", async () => {
      const result = await handshake(port, { origin: 'null', hello: { v: PROTOCOL_VERSION, role: 'mcp', kind: 'hello' } });
      expect(result.closeCode).toBe(CLOSE_POLICY);
      expect(result.closeReason).toBe('mcp token missing or wrong');
    });

    it("refuses 'mcp' with a wrong token, including one of the right length", async () => {
      for (const token of ['nope', 'f'.repeat(64), 42]) {
        const result = await handshake(port, { hello: { v: PROTOCOL_VERSION, role: 'mcp', kind: 'hello', payload: { token } } });
        expect(result.closeCode).toBe(CLOSE_POLICY);
      }
      expect((await health()).mcp).toBe(0);
    });

    it("refuses 'plugin' from Origin: null with no key or a malformed one", async () => {
      for (const payload of [undefined, {}, { pluginKey: 'abc' }, { pluginKey: 'z'.repeat(32) }, { pluginKey: 'a'.repeat(129) }]) {
        const result = await handshake(port, { origin: 'null', hello: { v: PROTOCOL_VERSION, role: 'plugin', kind: 'hello', payload } });
        expect(result.closeCode).toBe(CLOSE_POLICY);
        expect(result.closeReason).toBe('pluginKey missing or malformed');
      }
      expect((await health()).plugin).toBe(false);
    });

    it('promotes a plugin whose key is trusted, with no prompt', async () => {
      const result = await handshake(port, { origin: 'null', hello: pluginHello(TRUSTED_KEY.toUpperCase()) });
      expect(result.stillOpen).toBe(true);
      expect(statusOf(result.frames).map((p) => p.type)).not.toContain('bridge/pairing-pending');
      expect((await health()).plugin).toBe(true);
      result.ws.close();
    });
  });

  describe('secrets on disk', () => {
    it('writes a fresh 64-hex mcp token, 0600, in a 0700 dir it creates, and removes it on close', async () => {
      const parent = tempHome({ trusted: [] });
      const home = join(parent, 'nested', '.winden-tokens');
      const port = await freePort();
      const relay = await startRelay({ port, home });

      const tokenFile = join(home, 'mcp-token');
      expect(relay.mcpTokenFile).toBe(tokenFile);
      expect(readMcpToken(home)).toMatch(/^[0-9a-f]{64}$/);
      expect(statSync(tokenFile).mode & 0o777).toBe(0o600);
      expect(statSync(home).mode & 0o777).toBe(0o700);

      const first = readMcpToken(home);
      await relay.close();
      expect(existsSync(tokenFile)).toBe(false);

      const again = await startRelay({ port: await freePort(), home });
      expect(readMcpToken(home)).not.toBe(first);
      await again.close();
    });

    it('takes its directory from WINDEN_TOKENS_HOME when no option is given', async () => {
      const home = tempHome({ trusted: [] });
      const before = process.env.WINDEN_TOKENS_HOME;
      process.env.WINDEN_TOKENS_HOME = home;
      try {
        const relay = await startRelay({ port: await freePort() });
        expect(relay.home).toBe(home);
        expect(readMcpToken()).toBe(readMcpToken(home));
        await relay.close();
      } finally {
        if (before === undefined) delete process.env.WINDEN_TOKENS_HOME;
        else process.env.WINDEN_TOKENS_HOME = before;
      }
    });

    it('does not rotate the running relay\'s token when a second one fails to bind', async () => {
      const home = tempHome({ trusted: [] });
      const port = await freePort();
      const relay = await startRelay({ port, home });
      const token = readMcpToken(home);
      await expect(startRelay({ port, home })).rejects.toMatchObject({ code: 'EADDRINUSE' });
      expect(readMcpToken(home)).toBe(token);
      await relay.close();
    });
  });

  // -------------------------------------------------------------------------
  // Pairing — PROTOCOL (5). An unknown key waits for a browser tab (a role a
  // hostile page cannot hold) to approve it.
  // -------------------------------------------------------------------------

  describe('plugin pairing', () => {
    const settle = (ms = 120) => new Promise((r) => setTimeout(r, ms));

    async function boot({ pairingTimeoutMs } = {}) {
      const port = await freePort();
      const home = tempHome();
      const relay = await startRelay({ port, uiFile, home, pairingTimeoutMs });
      return { port, home, relay };
    }

    /** An open socket with everything it received and how it closed. */
    async function attach(port, hello, { origin } = {}) {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`, origin ? { origin } : {});
      const peer = { ws, frames: [], closed: null };
      ws.on('message', (data) => peer.frames.push(JSON.parse(data.toString())));
      ws.on('close', (code, reason) => (peer.closed = { code, reason: reason.toString() }));
      ws.on('error', () => {});
      await new Promise((resolve) => ws.on('open', resolve));
      ws.send(JSON.stringify(hello));
      await settle();
      return peer;
    }

    const clientHello = { v: PROTOCOL_VERSION, role: 'client', kind: 'hello' };
    const attachClient = (port) => attach(port, clientHello, { origin: `http://127.0.0.1:${port}` });
    const answer = (client, code, approve) =>
      client.ws.send(
        JSON.stringify({ v: PROTOCOL_VERSION, role: 'client', kind: 'status', payload: { type: 'bridge/pairing-answer', code, approve } })
      );
    const health = async (port) => JSON.parse((await get(port, '/healthz')).body);
    const trustedOnDisk = (home) => JSON.parse(readFileSync(join(home, 'trusted-plugins.json'), 'utf8'));

    it('holds an unknown key PENDING: it is shown a code, tabs are asked, nothing else happens', async () => {
      const { port, relay } = await boot();
      const client = await attachClient(port);
      const pending = await attach(port, pluginHello(UNKNOWN_KEY), { origin: 'null' });
      const code = pairingCode(UNKNOWN_KEY);

      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{6}$/);
      expect(pending.closed).toBeNull();
      expect(pending.frames).toEqual([
        { v: PROTOCOL_VERSION, role: 'relay', kind: 'status', payload: { type: 'bridge/pairing-pending', code } },
      ]);
      expect(statusOf(client.frames)).toContainEqual({ type: 'bridge/pairing-request', code });
      expect(await health(port)).toMatchObject({ plugin: false });

      // Its frames reach no tab: no forged `data-loaded`.
      const seen = client.frames.length;
      pending.ws.send(JSON.stringify({ v: PROTOCOL_VERSION, role: 'plugin', kind: 'message', payload: { type: 'data-loaded', variables: [] } }));
      await settle();
      expect(client.frames.slice(seen)).toEqual([]);

      pending.ws.close();
      client.ws.close();
      await relay.close();
    });

    it('cannot replace the real plugin, which keeps receiving tab commands', async () => {
      const { port, relay } = await boot();
      const real = await attach(port, pluginHello(TRUSTED_KEY), { origin: 'null' });
      const client = await attachClient(port);
      const pending = await attach(port, pluginHello(UNKNOWN_KEY), { origin: 'null' });

      expect(real.closed).toBeNull();
      expect(await health(port)).toMatchObject({ plugin: true });

      const seenReal = real.frames.length;
      const seenPending = pending.frames.length;
      client.ws.send(JSON.stringify({ v: PROTOCOL_VERSION, role: 'client', kind: 'message', payload: { type: 'refresh' } }));
      await settle();
      expect(real.frames.slice(seenReal).map((f) => f.payload?.type)).toEqual(['refresh']);
      expect(pending.frames.slice(seenPending)).toEqual([]);

      pending.ws.close();
      real.ws.close();
      client.ws.close();
      await relay.close();
    });

    it('tells a tab that attaches later about the open request', async () => {
      const { port, relay } = await boot();
      const pending = await attach(port, pluginHello(UNKNOWN_KEY), { origin: 'null' });
      const client = await attachClient(port);
      expect(statusOf(client.frames)).toEqual([
        { type: 'bridge/plugin-disconnected' },
        { type: 'bridge/pairing-request', code: pairingCode(UNKNOWN_KEY) },
      ]);
      pending.ws.close();
      client.ws.close();
      await relay.close();
    });

    it('rejects a second unknown key while one is pending', async () => {
      const { port, relay } = await boot();
      const client = await attachClient(port);
      const first = await attach(port, pluginHello(UNKNOWN_KEY), { origin: 'null' });
      const second = await attach(port, pluginHello(OTHER_UNKNOWN_KEY), { origin: 'null' });

      expect(second.closed).toEqual({ code: CLOSE_PAIRING_BUSY, reason: 'another plugin is waiting for pairing' });
      expect(first.closed).toBeNull();
      // Only one prompt ever reached the tab.
      expect(statusOf(client.frames).filter((p) => p.type === 'bridge/pairing-request')).toHaveLength(1);

      first.ws.close();
      client.ws.close();
      await relay.close();
    });

    it('approve: persists the hash (0600, never the key), promotes the plugin, and a reconnect skips the prompt', async () => {
      const { port, home, relay } = await boot();
      const client = await attachClient(port);
      const pending = await attach(port, pluginHello(UNKNOWN_KEY), { origin: 'null' });
      const code = pairingCode(UNKNOWN_KEY);
      const seenClient = client.frames.length;

      answer(client, code, true);
      await settle();

      // The plugin: approved, then the normal flow — the tab is already here.
      expect(statusOf(pending.frames).map((p) => p.type)).toEqual([
        'bridge/pairing-pending',
        'bridge/pairing-approved',
        'bridge/client-attached',
      ]);
      expect(statusOf(client.frames.slice(seenClient))).toEqual([
        { type: 'bridge/plugin-connected' },
        { type: 'bridge/pairing-resolved', approved: true },
      ]);
      expect(await health(port)).toMatchObject({ plugin: true });

      // Now a real plugin: its frames reach the tab, and the tab's reach it.
      pending.ws.send(JSON.stringify({ v: PROTOCOL_VERSION, role: 'plugin', kind: 'message', payload: { type: 'data-loaded' } }));
      await settle();
      expect(client.frames.at(-1).payload).toEqual({ type: 'data-loaded' });

      const file = join(home, 'trusted-plugins.json');
      expect(statSync(file).mode & 0o777).toBe(0o600);
      expect(trustedOnDisk(home)).toContain(hashPluginKey(UNKNOWN_KEY));
      expect(readFileSync(file, 'utf8')).not.toContain(UNKNOWN_KEY);

      pending.ws.close();
      await settle();
      const again = await attach(port, pluginHello(UNKNOWN_KEY), { origin: 'null' });
      expect(statusOf(again.frames).map((p) => p.type)).not.toContain('bridge/pairing-pending');
      expect(await health(port)).toMatchObject({ plugin: true });

      again.ws.close();
      client.ws.close();
      await relay.close();
    });

    it('deny: closes the plugin with 4003, tells the tabs, trusts nothing', async () => {
      const { port, home, relay } = await boot();
      const client = await attachClient(port);
      const pending = await attach(port, pluginHello(UNKNOWN_KEY), { origin: 'null' });

      answer(client, pairingCode(UNKNOWN_KEY), false);
      await settle();

      expect(pending.closed).toEqual({ code: CLOSE_PAIRING_DENIED, reason: 'pairing denied' });
      expect(statusOf(client.frames).at(-1)).toEqual({ type: 'bridge/pairing-resolved', approved: false, reason: 'denied' });
      expect(trustedOnDisk(home)).not.toContain(hashPluginKey(UNKNOWN_KEY));

      // The slot is free again for the next request.
      const next = await attach(port, pluginHello(OTHER_UNKNOWN_KEY), { origin: 'null' });
      expect(next.closed).toBeNull();
      next.ws.close();
      client.ws.close();
      await relay.close();
    });

    it('timeout: closes the plugin with 4004 and tells the tabs', async () => {
      const { port, relay } = await boot({ pairingTimeoutMs: 150 });
      const client = await attachClient(port);
      const pending = await attach(port, pluginHello(UNKNOWN_KEY), { origin: 'null' });
      await settle(250);

      expect(pending.closed).toEqual({ code: CLOSE_PAIRING_TIMEOUT, reason: 'pairing timed out' });
      expect(statusOf(client.frames).at(-1)).toEqual({ type: 'bridge/pairing-resolved', approved: false, reason: 'timeout' });
      client.ws.close();
      await relay.close();
    });

    it('a pending plugin that leaves resolves the request as not approved', async () => {
      const { port, relay } = await boot();
      const client = await attachClient(port);
      const pending = await attach(port, pluginHello(UNKNOWN_KEY), { origin: 'null' });
      pending.ws.close();
      await settle();
      expect(statusOf(client.frames).at(-1)).toEqual({ type: 'bridge/pairing-resolved', approved: false, reason: 'closed' });
      client.ws.close();
      await relay.close();
    });

    it('ignores an answer with the wrong code, from a non-client, or with no request open', async () => {
      const { port, home, relay } = await boot();
      const client = await attachClient(port);

      answer(client, 'ABCDEF', true); // nothing pending: must not pre-approve the next one
      await settle();

      const pending = await attach(port, pluginHello(UNKNOWN_KEY), { origin: 'null' });
      answer(client, pairingCode(OTHER_UNKNOWN_KEY), true); // stale code
      await settle();

      // mcp sockets cannot answer — approving is a human's job in a tab.
      const mcp = await attach(port, mcpHello(home));
      mcp.ws.send(
        JSON.stringify({
          v: PROTOCOL_VERSION,
          role: 'client',
          kind: 'status',
          payload: { type: 'bridge/pairing-answer', code: pairingCode(UNKNOWN_KEY), approve: true },
        })
      );
      // Nor the pending plugin itself.
      pending.ws.send(
        JSON.stringify({
          v: PROTOCOL_VERSION,
          role: 'client',
          kind: 'status',
          payload: { type: 'bridge/pairing-answer', code: pairingCode(UNKNOWN_KEY), approve: true },
        })
      );
      await settle();

      expect(pending.closed).toBeNull();
      expect(statusOf(pending.frames).map((p) => p.type)).toEqual(['bridge/pairing-pending']);
      expect(await health(port)).toMatchObject({ plugin: false });

      mcp.ws.close();
      pending.ws.close();
      client.ws.close();
      await relay.close();
    });

    it('never forwards a client status frame to the plugin', async () => {
      const { port, relay } = await boot();
      const plugin = await attach(port, pluginHello(TRUSTED_KEY), { origin: 'null' });
      const client = await attachClient(port);
      const seen = plugin.frames.length;
      answer(client, 'ABCDEF', true);
      await settle();
      expect(plugin.frames.slice(seen)).toEqual([]);
      plugin.ws.close();
      client.ws.close();
      await relay.close();
    });
  });
});
