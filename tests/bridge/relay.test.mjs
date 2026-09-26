// Tests for the bridge relay (bridge/server.mjs) as the `winden-tokens`
// package runs it: serving the browser UI, and the Origin/Host/version checks
// that are the only thing between a hostile page and the user's Figma file.
//
// Real sockets on a real loopback port. The relay's whole job is the handshake,
// and a mock of the handshake would test nothing.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import { request } from 'node:http';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';

import { startRelay, CLOSE_VERSION, PROTOCOL_VERSION } from '../../bridge/server.mjs';

const UI_MARKER = '<html><body>winden tokens ui</body></html>';

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
      relay = await startRelay({ port, uiFile });
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
      relay = await startRelay({ port, uiFile });
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
        hello: { v: PROTOCOL_VERSION, role: 'plugin', kind: 'hello' },
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
      relay = await startRelay({ port, uiFile, dev: true });
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
      relay = await startRelay({ port, uiFile });
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

    beforeAll(async () => {
      port = await freePort();
      relay = await startRelay({ port, uiFile });
    });
    afterAll(() => relay.close());

    /** An identified socket that stays open, with everything it received. */
    async function attach(role, { origin } = {}) {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`, origin ? { origin } : {});
      const frames = [];
      ws.on('message', (data) => frames.push(JSON.parse(data.toString())));
      await new Promise((resolve) => ws.on('open', resolve));
      ws.send(JSON.stringify({ v: PROTOCOL_VERSION, role, kind: 'hello' }));
      await new Promise((r) => setTimeout(r, 120));
      return { ws, frames };
    }

    const settle = () => new Promise((r) => setTimeout(r, 120));

    it("accepts 'mcp' from a null Origin, and tells it whether the plugin is there", async () => {
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
        hello: { v: PROTOCOL_VERSION, role: 'mcp', kind: 'hello' },
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
});
