// A layer bound to a variable that no longer exists reads as broken on the
// component card (token `missing`), and a variable aliasing one is flagged
// too. Runs the real plugin sandbox (src/plugin/code.ts) against
// tests/plugin/fakeFigma.ts, whose `remove()` soft-deletes like Figma.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  boundPaint,
  installFakeFigma,
  loadPlugin,
  rgb,
  uninstallFakeFigma,
  type FakeFigma,
} from './fakeFigma';

let fake: FakeFigma;

function seed() {
  const { world } = fake;
  const colors = world.createCollection('Colors');
  const mode = colors.defaultModeId;
  const brand = world.createVariable('brand/default', colors, 'COLOR');
  brand.setValueForMode(mode, rgb('#3366FF'));
  const text = world.createVariable('text/primary', colors, 'COLOR');
  text.setValueForMode(mode, { type: 'VARIABLE_ALIAS', id: brand.id });
  const box = world.addNode('FRAME', 'Box');
  box.fills = [boundPaint(brand)];
  world.currentPage.selection = [box];
  return { world, colors, mode, brand, text, box };
}

function lastSelection() {
  const sent = fake.messagesOfType('selection-changed');
  return sent[sent.length - 1];
}

function fillToken() {
  return lastSelection().node.entries.find((entry: any) => entry.property === 'Fill').token;
}

beforeEach(() => {
  fake = installFakeFigma();
});

afterEach(() => {
  uninstallFakeFigma();
});

describe('broken bindings on the component card', () => {
  it('a live binding is not missing', async () => {
    const { brand, colors } = seed();
    await loadPlugin();
    expect(fillToken()).toEqual({
      id: brand.id, name: 'brand/default', collectionId: colors.id, collectionName: 'Colors',
    });
  });

  it('a binding to a soft-deleted variable is missing, with its last name and collection name', async () => {
    const { world, colors, brand } = seed();
    await loadPlugin();

    brand.remove();
    world.createVariable('brand/default', colors, 'COLOR');
    await fake.send({ type: 'refresh' });

    const entry = lastSelection().node.entries.find((e: any) => e.property === 'Fill');
    expect(entry.kind).toBe('variable');
    expect(entry.token).toEqual({ id: brand.id, name: 'brand/default', collectionName: 'Colors', missing: true });
  });

  it('a binding whose id no longer resolves is missing, not hardcoded', async () => {
    const { world, brand } = seed();
    await loadPlugin();

    world.dropVariable(brand.id);
    await fake.send({ type: 'refresh' });

    const entry = lastSelection().node.entries.find((e: any) => e.property === 'Fill');
    expect(entry.kind).toBe('variable');
    expect(entry.token).toEqual({ id: brand.id, name: '', missing: true });
  });

  it('a library variable is trusted as is', async () => {
    const { world, box } = seed();
    const library = world.addRemoteVariable('lib/blue', 'COLOR', rgb('#0000FF'));
    box.fills = [boundPaint(library)];
    await loadPlugin();
    expect(fillToken().missing).toBeUndefined();
    expect(fillToken().name).toBe('lib/blue');
  });

  it('Relink (bind-node-property) to the live namesake turns the row healthy', async () => {
    const { world, colors, brand, box } = seed();
    await loadPlugin();
    brand.remove();
    const live = world.createVariable('brand/default', colors, 'COLOR');
    await fake.send({ type: 'refresh' });
    expect(fillToken().missing).toBe(true);

    await fake.send({
      type: 'bind-node-property', nodeId: box.id,
      target: { kind: 'paint', prop: 'fills', index: 0 }, variableId: live.id,
    });
    expect(fillToken()).toEqual({
      id: live.id, name: 'brand/default', collectionId: colors.id, collectionName: 'Colors',
    });
  });

  it('Relink all (bind-node-properties) binds every row and resends the card once', async () => {
    const { world, colors, brand, box } = seed();
    box.strokes = [boundPaint(brand)];
    await loadPlugin();
    brand.remove();
    const live = world.createVariable('brand/default', colors, 'COLOR');
    await fake.send({ type: 'refresh' });
    fake.clearMessages();

    await fake.send({
      type: 'bind-node-properties',
      bindings: [
        { nodeId: box.id, target: { kind: 'paint', prop: 'fills', index: 0 }, variableId: live.id },
        { nodeId: box.id, target: { kind: 'paint', prop: 'strokes', index: 0 }, variableId: live.id },
      ],
    });

    expect(fake.messagesOfType('selection-changed')).toHaveLength(1);
    expect(fake.messagesOfType('update-success')).toHaveLength(1);
    const tokens = lastSelection().node.entries
      .filter((e: any) => e.property === 'Fill' || e.property === 'Stroke')
      .map((e: any) => e.token);
    expect(tokens.map((t: any) => [t.id, t.missing])).toEqual([[live.id, undefined], [live.id, undefined]]);
  });

  it('Relink all applies every valid binding even when others fail, and reports the failures together', async () => {
    const { world, colors, brand, box } = seed();
    box.strokes = [boundPaint(brand)];
    await loadPlugin();
    brand.remove();
    const live = world.createVariable('brand/default', colors, 'COLOR');
    await fake.send({ type: 'refresh' });
    fake.clearMessages();

    await fake.send({
      type: 'bind-node-properties',
      bindings: [
        { nodeId: box.id, target: { kind: 'paint', prop: 'fills', index: 5 }, variableId: live.id },
        { nodeId: box.id, target: { kind: 'paint', prop: 'fills' }, variableId: live.id },
        null,
        { nodeId: box.id, target: { kind: 'paint', prop: 'strokes', index: 0 }, variableId: live.id },
        { nodeId: 'nope', target: { kind: 'paint', prop: 'fills', index: 0 }, variableId: live.id },
        { nodeId: box.id, target: { kind: 'paint', prop: 'fills', index: 0 }, variableId: live.id },
      ],
    });

    expect(fake.messagesOfType('selection-changed')).toHaveLength(1);
    expect(fake.messagesOfType('update-success')).toHaveLength(0);
    const errors = fake.messagesOfType('update-error').map((m: any) => m.error);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^4 of 6 bindings failed \(2 applied\)/);
    expect(errors[0]).toMatch(/binding 1: Paint not found/);
    expect(errors[0]).toMatch(/binding 2: invalid request/);
    expect(errors[0]).toMatch(/binding 3: invalid request/);
    expect(errors[0]).toMatch(/binding 5: Node not found/);
    const tokens = lastSelection().node.entries
      .filter((e: any) => e.property === 'Fill' || e.property === 'Stroke')
      .map((e: any) => e.token);
    expect(tokens.map((t: any) => [t.id, t.missing])).toEqual([[live.id, undefined], [live.id, undefined]]);
  });
});

describe('broken variable aliases', () => {
  it('flags the mode whose alias points at a deleted variable', async () => {
    const { world, colors, mode, brand, text } = seed();
    await loadPlugin();
    const before = fake.lastData().variables.find((v: any) => v.id === text.id);
    expect(before.brokenModes).toBeUndefined();

    brand.remove();
    world.createVariable('brand/default', colors, 'COLOR');
    await fake.send({ type: 'refresh' });

    const after = fake.lastData().variables.find((v: any) => v.id === text.id);
    expect(after.brokenModes).toEqual([mode]);
    // The live namesake is not flagged.
    const live = fake.lastData().variables.find((v: any) => v.name === 'brand/default');
    expect(live.brokenModes).toBeUndefined();
  });

  it('looks each alias target up once per data load, however many modes alias it', async () => {
    const { world, colors, mode } = seed();
    const dark = colors.addMode('Dark');
    const library = world.addRemoteVariable('lib/blue', 'COLOR', rgb('#0000FF'));
    const gone = world.addRemoteVariable('lib/gone', 'COLOR', rgb('#00FF00'));
    for (const name of ['link/a', 'link/b']) {
      const link = world.createVariable(name, colors, 'COLOR');
      link.setValueForMode(mode, { type: 'VARIABLE_ALIAS', id: library.id });
      link.setValueForMode(dark, { type: 'VARIABLE_ALIAS', id: gone.id });
    }
    await loadPlugin();
    world.dropVariable(gone.id);

    const lookup = vi.spyOn(fake.figma.variables, 'getVariableByIdAsync');
    await fake.send({ type: 'refresh' });
    // `refresh` builds the UI state once and captures one history snapshot
    // (resetHistory): one lookup per target in each pass.
    const calls = (id: string) => lookup.mock.calls.filter(([arg]) => arg === id).length;
    expect(calls(library.id)).toBe(2);
    expect(calls(gone.id)).toBe(2);
    lookup.mockRestore();

    // Same output as before: names for live targets, broken flag for the dead one.
    const data = fake.lastData().variables.find((v: any) => v.name === 'link/a');
    expect(data.valuesByMode[mode]).toBe('{lib/blue}');
    expect(data.valuesByMode[dark]).toBe(`→ ${gone.id}`);
    expect(data.brokenModes).toEqual([dark]);
  });
});
