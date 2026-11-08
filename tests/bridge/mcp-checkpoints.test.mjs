// Tests for the version checkpoints in bridge/mcp.mjs: every write tool saves a
// named Figma version first (once per burst, always before rename/delete), and
// a failed save blocks the write.
//
// Real relay, real sockets, and a fake plugin socket that answers the commands
// the way src/plugin/code.ts does: `data-loaded` before `update-success`, and
// `version-saved` / `version-save-error` for `save-version`. The burst clock is
// injected, so ten minutes pass in a line.

import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';

import { startRelay, hashPluginKey, PROTOCOL_VERSION, CLOSE_VERSION } from '../../bridge/server.mjs';
import { BURST_QUIET_MS, RelayLink, callTool } from '../../bridge/mcp.mjs';

const PLUGIN_KEY = 'a'.repeat(32);
const MINUTE = 60_000;
/** 2026-11-08 14:32 local time, the example in plans/mcp-server.md. */
const START = new Date(2026, 10, 8, 14, 32).getTime();

const homes = [];
afterAll(() => homes.forEach((h) => rmSync(h, { recursive: true, force: true })));

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

async function until(condition, what) {
  const deadline = Date.now() + 2_000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

/**
 * A plugin socket with a tiny file behind it. `commands` is every payload type
 * it received, in order, which is what the tests assert on. `saveReply` decides
 * how it answers `save-version`.
 */
async function fakePlugin(port, { version = PROTOCOL_VERSION } = {}) {
  const plugin = {
    commands: [],
    saves: [],
    closed: null,
    saveReply: (n) => ({ type: 'version-saved', id: `version-${n}` }),
    collections: [{ id: 'C:1', name: 'Primitives', modes: [{ modeId: 'M:1', name: 'Value' }] }],
    variables: [
      { id: 'V:1', collectionId: 'C:1', name: 'color/brand/500', resolvedType: 'COLOR', value: '#3366ff', valuesByMode: { 'M:1': '#3366ff' } },
    ],
  };
  let nextId = 2;

  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  plugin.ws = ws;
  const post = (payload) => ws.send(JSON.stringify({ v: version, role: 'plugin', kind: 'message', payload }));
  const loaded = () => post({ type: 'data-loaded', collections: plugin.collections, variables: plugin.variables });
  const mutated = () => {
    loaded();
    post({ type: 'update-success' });
  };

  ws.on('message', (data) => {
    const frame = JSON.parse(data.toString());
    if (frame.kind !== 'message') return;
    const msg = frame.payload;
    plugin.commands.push(msg.type);
    switch (msg.type) {
      case 'ui-ready':
        loaded();
        break;
      case 'save-version': {
        plugin.saves.push({ title: msg.title, description: msg.description });
        const reply = plugin.saveReply(plugin.saves.length);
        if (reply) post(reply);
        break;
      }
      case 'create-collection':
        plugin.collections.push({ id: `C:${nextId++}`, name: msg.name, modes: [{ modeId: `M:${nextId++}`, name: 'Mode 1' }] });
        mutated();
        break;
      case 'create-variable':
        plugin.variables.push({
          id: `V:${nextId++}`,
          collectionId: msg.collectionId,
          name: msg.name,
          resolvedType: msg.varType,
          value: msg.value,
          valuesByMode: { 'M:1': msg.value },
        });
        mutated();
        break;
      case 'update-variable-value':
        plugin.variables = plugin.variables.map((v) =>
          v.id === msg.id ? { ...v, value: msg.value, valuesByMode: { ...v.valuesByMode, [msg.modeId]: msg.value } } : v
        );
        mutated();
        break;
      case 'update-variable-name':
        plugin.variables = plugin.variables.map((v) => (v.id === msg.id ? { ...v, name: msg.name } : v));
        mutated();
        break;
      case 'delete-variable':
        plugin.variables = plugin.variables.filter((v) => v.id !== msg.id);
        mutated();
        break;
    }
  });
  ws.on('close', (code, reason) => (plugin.closed = { code, reason: reason.toString() }));
  ws.on('error', () => {});
  await new Promise((resolve) => ws.on('open', resolve));
  ws.send(JSON.stringify({ v: version, role: 'plugin', kind: 'hello', payload: { pluginKey: PLUGIN_KEY } }));
  return plugin;
}

const running = [];
afterEach(async () => {
  for (const { link, relay, plugins } of running.splice(0)) {
    // Fatal first, so the link does not schedule a reconnect to a closed relay.
    link.fatal = 'test over';
    link.socket?.close();
    plugins.forEach((p) => p.ws.close());
    await relay.close();
  }
});

/** A relay, a trusted fake plugin, and an mcp link on a clock the test owns. */
async function boot({ withPlugin = true } = {}) {
  const port = await freePort();
  const home = mkdtempSync(join(tmpdir(), 'winden-mcp-test-'));
  homes.push(home);
  writeFileSync(join(home, 'trusted-plugins.json'), JSON.stringify([hashPluginKey(PLUGIN_KEY)]));
  const relay = await startRelay({ port, home });

  const clock = { now: START };
  // RelayLink reads the token from WINDEN_TOKENS_HOME, as the bin does.
  process.env.WINDEN_TOKENS_HOME = home;
  const link = new RelayLink(port, { now: () => clock.now });
  await link.connect();

  const env = { port, relay, link, clock, plugins: [] };
  running.push(env);
  env.attachPlugin = async (opts) => {
    const plugin = await fakePlugin(port, opts);
    env.plugins.push(plugin);
    return plugin;
  };
  if (withPlugin) {
    env.plugin = await env.attachPlugin();
    await until(() => link.pluginAttached, 'the plugin to attach');
  }
  return env;
}

async function call(link, name, args) {
  const result = await callTool(link, name, args);
  return JSON.parse(result.content[0].text);
}

const createVariable = (link, name) => call(link, 'create_variable', { collection: 'C:1', name, type: 'FLOAT', value: '4' });

describe('mcp version checkpoints', () => {
  it('saves a version before the first write, titled and described', async () => {
    const { link, plugin } = await boot();

    const result = await createVariable(link, 'space/1');

    expect(plugin.saves).toEqual([
      { title: 'Winden Tokens MCP · before edit · 2026-11-08 14:32', description: 'create_variable space/1' },
    ]);
    // The save is confirmed before the write is even sent.
    expect(plugin.commands.indexOf('save-version')).toBeLessThan(plugin.commands.indexOf('create-variable'));
    expect(result.checkpoint).toContain('Saved version "Winden Tokens MCP · before edit · 2026-11-08 14:32"');
  });

  it('shares one version across a burst, and saves again after ten quiet minutes', async () => {
    const { link, plugin, clock } = await boot();

    await createVariable(link, 'space/1');
    clock.now += 6 * MINUTE;
    const second = await createVariable(link, 'space/2');
    // Quiet is measured from the last write, not from the save: still one burst.
    clock.now += 6 * MINUTE;
    await call(link, 'set_variable_value', { variable: 'space/1', value: '8' });

    expect(plugin.saves).toHaveLength(1);
    expect(second.checkpoint).toContain('was saved 6 minute(s) ago');

    clock.now += BURST_QUIET_MS;
    const fresh = await createVariable(link, 'space/3');

    expect(plugin.saves).toHaveLength(2);
    expect(plugin.saves[1]).toEqual({
      title: 'Winden Tokens MCP · before edit · 2026-11-08 14:54',
      description: 'create_variable space/3',
    });
    expect(fresh.checkpoint).toContain('Saved version');
  });

  it('always saves right before rename_variable and delete_variable, even mid-burst', async () => {
    const { link, plugin, clock } = await boot();

    await createVariable(link, 'space/1');
    clock.now += MINUTE;
    const renamed = await call(link, 'rename_variable', { variable: 'space/1', new_name: 'space/xs' });
    clock.now += MINUTE;
    const deleted = await call(link, 'delete_variable', { variable: 'color/brand/500' });

    expect(plugin.saves.map((s) => s.description)).toEqual([
      'create_variable space/1',
      'rename_variable space/1 → space/xs',
      'delete_variable color/brand/500',
    ]);
    expect(renamed.checkpoint).toContain('Saved version');
    expect(deleted.checkpoint).toContain('Saved version');
    expect(deleted.confirmed).toBe(true);
  });

  it('saves once for a whole create_group, before its first variable', async () => {
    const { link, plugin } = await boot();

    const result = await call(link, 'create_group', {
      collection: 'C:1',
      group: 'radius',
      variables: [
        { name: 'sm', type: 'FLOAT', value: '2' },
        { name: 'md', type: 'FLOAT', value: '4' },
        { name: 'lg', type: 'FLOAT', value: '8' },
      ],
    });

    expect(result.created).toBe(3);
    expect(plugin.saves).toEqual([
      { title: 'Winden Tokens MCP · before edit · 2026-11-08 14:32', description: 'create_group radius' },
    ]);
    expect(plugin.commands.filter((c) => c !== 'ui-ready')).toEqual([
      'save-version',
      'create-variable',
      'create-variable',
      'create-variable',
    ]);
  });

  it('blocks the write, and sends no write command, when the version cannot be saved', async () => {
    const { link, plugin } = await boot();
    plugin.saveReply = () => ({ type: 'version-save-error', message: 'File is read-only' });

    await expect(createVariable(link, 'space/1')).rejects.toThrow(
      /Nothing was changed: the checkpoint version could not be saved.*File is read-only/
    );
    await expect(call(link, 'delete_variable', { variable: 'color/brand/500' })).rejects.toThrow(/File is read-only/);

    expect(plugin.commands).not.toContain('create-variable');
    expect(plugin.commands).not.toContain('delete-variable');
    expect(plugin.variables.map((v) => v.name)).toEqual(['color/brand/500']);

    // A failed save starts no burst: the next write tries again, and proceeds.
    plugin.saveReply = (n) => ({ type: 'version-saved', id: `version-${n}` });
    await createVariable(link, 'space/1');
    expect(plugin.saves).toHaveLength(3);
    expect(plugin.commands).toContain('create-variable');
  });

  it('starts a new burst when the plugin detaches and reattaches', async () => {
    const env = await boot();
    const { link, plugin, clock } = env;

    await createVariable(link, 'space/1');
    plugin.ws.close();
    await until(() => !link.pluginAttached, 'the plugin to detach');

    // The bridge window may now be on another file, with no version of ours.
    const again = await env.attachPlugin();
    await until(() => link.pluginAttached, 'the plugin to reattach');
    clock.now += MINUTE;
    const result = await createVariable(link, 'space/2');

    expect(again.saves).toHaveLength(1);
    expect(result.checkpoint).toContain('Saved version');
  });

  it('save_version saves on request, with a manual default title, and resets the burst', async () => {
    const { link, plugin, clock } = await boot();

    const manual = await call(link, 'save_version', {});
    expect(manual.saved).toEqual({ id: 'version-1', title: 'Winden Tokens MCP · manual · 2026-11-08 14:32', description: '' });

    await call(link, 'save_version', { title: 'Before the rebrand', description: 'brand colours about to change' });
    expect(plugin.saves[1]).toEqual({ title: 'Before the rebrand', description: 'brand colours about to change' });

    // The write that follows shares the manual version.
    clock.now += 3 * MINUTE;
    const write = await createVariable(link, 'space/1');
    expect(plugin.saves).toHaveLength(2);
    expect(write.checkpoint).toContain('"Before the rebrand" was saved 3 minute(s) ago');
  });

  it('turns an older plugin build away as a version mismatch, and says to update it', async () => {
    const env = await boot({ withPlugin: false });

    // A build from before `save-version` speaks protocol v2. It would ignore
    // the command and leave every write to time out; the relay refuses it.
    const old = await env.attachPlugin({ version: PROTOCOL_VERSION - 1 });
    await until(() => old.closed, 'the relay to refuse the old plugin');
    expect(old.closed.code).toBe(CLOSE_VERSION);
    await until(() => env.link.mismatch, 'the mismatch broadcast');

    const started = Date.now();
    await expect(createVariable(env.link, 'space/1')).rejects.toThrow(/update the Winden Tokens plugin/);
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(old.commands).toEqual([]);
  });
});
