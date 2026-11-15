// Undo / redo restore the file in place: ids survive whenever the thing they
// name survives, and a recreated variable takes its layer bindings along.
// Runs the real plugin sandbox (src/plugin/code.ts) against tests/plugin/fakeFigma.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  boundPaint,
  installFakeFigma,
  loadPlugin,
  rgb,
  uninstallFakeFigma,
  type FakeCollection,
  type FakeFigma,
  type FakeVariable,
} from './fakeFigma';

let fake: FakeFigma;

// Every local id in the file: collections, modes, variables.
function idState() {
  const { world } = fake;
  return {
    collections: world.localCollections().map(collection => collection.id),
    modes: world.localCollections().map(collection => collection.modes.map(mode => mode.modeId)),
    variables: world.localVariables().map(variable => `${variable.id}=${variable.name}`),
  };
}

function variableNamed(name: string, collection?: FakeCollection): FakeVariable {
  const found = fake.world.localVariables().find(variable =>
    variable.name === name && (!collection || variable.variableCollectionId === collection.id)
  );
  if (!found) throw new Error(`No live variable named ${name}`);
  return found;
}

function historyErrors(): string[] {
  return fake.messagesOfType('history-error').map(message => message.error);
}

function lastHistoryState() {
  const states = fake.messagesOfType('history-state');
  return states[states.length - 1];
}

function seedColors() {
  const { world } = fake;
  const colors = world.createCollection('Colors');
  const light = colors.defaultModeId;
  colors.renameMode(light, 'Light');
  const dark = colors.addMode('Dark');
  const brand = world.createVariable('brand/default', colors, 'COLOR');
  brand.setValueForMode(light, rgb('#3366FF'));
  brand.setValueForMode(dark, rgb('#99BBFF'));
  const text = world.createVariable('text/primary', colors, 'COLOR');
  text.setValueForMode(light, { type: 'VARIABLE_ALIAS', id: brand.id });
  text.setValueForMode(dark, rgb('#FFFFFF'));

  const spacing = world.createCollection('Spacing');
  const md = world.createVariable('space/md', spacing, 'FLOAT');
  md.setValueForMode(spacing.defaultModeId, 16);
  return { colors, light, dark, brand, text, spacing, md };
}

beforeEach(() => {
  fake = installFakeFigma();
});

afterEach(() => {
  uninstallFakeFigma();
});

describe('undo / redo keep ids', () => {
  it('keeps every id across undo and redo of a value edit and a rename', async () => {
    const { brand, light } = seedColors();
    await loadPlugin();
    const before = idState();

    await fake.send({ type: 'update-variable-value', id: brand.id, modeId: light, value: '#FF0000' });
    await fake.send({ type: 'update-variable-name', id: brand.id, name: 'brand/primary' });
    expect(brand.name).toBe('brand/primary');

    await fake.send({ type: 'undo' });
    expect(brand.removed).toBe(false);
    expect(brand.name).toBe('brand/default');
    expect(brand.valuesByMode[light]).toEqual(rgb('#FF0000'));

    await fake.send({ type: 'undo' });
    expect(brand.valuesByMode[light]).toEqual(rgb('#3366FF'));
    expect(idState()).toEqual(before);

    await fake.send({ type: 'redo' });
    await fake.send({ type: 'redo' });
    expect(brand.name).toBe('brand/primary');
    expect(brand.valuesByMode[light]).toEqual(rgb('#FF0000'));
    expect(idState().collections).toEqual(before.collections);
    expect(idState().modes).toEqual(before.modes);
    expect(fake.world.localVariables().map(variable => variable.id))
      .toEqual(before.variables.map(entry => entry.split('=')[0]));

    // In-place restores never walk the canvas.
    expect(fake.world.loadAllPagesCalls).toBe(0);
    expect(historyErrors()).toEqual([]);
    // The UI saw the same ids it already knew.
    const data = fake.lastData();
    expect(data.variables.map((variable: any) => variable.id).sort())
      .toEqual(before.variables.map(entry => entry.split('=')[0]).sort());
  });

  it('swaps two names in place', async () => {
    const { brand, text } = seedColors();
    await loadPlugin();

    await fake.send({ type: 'update-variable-name', id: brand.id, name: 'tmp' });
    await fake.send({ type: 'update-variable-name', id: text.id, name: 'brand/default' });
    await fake.send({ type: 'update-variable-name', id: brand.id, name: 'text/primary' });

    await fake.send({ type: 'undo' });
    await fake.send({ type: 'undo' });
    await fake.send({ type: 'undo' });
    expect([brand.name, text.name]).toEqual(['brand/default', 'text/primary']);

    await fake.send({ type: 'redo' });
    await fake.send({ type: 'redo' });
    await fake.send({ type: 'redo' });
    expect([brand.name, text.name]).toEqual(['text/primary', 'brand/default']);
    expect(brand.removed || text.removed).toBe(false);
    expect(historyErrors()).toEqual([]);
  });

  it('undo of a delete recreates the variable and rebinds layers on every page', async () => {
    const { brand, text, light, dark } = seedColors();
    brand.description = 'Primary brand colour';
    brand.scopes = ['FRAME_FILL', 'SHAPE_FILL'];
    brand.setVariableCodeSyntax('WEB', '--brand');
    brand.hiddenFromPublishing = true;
    brand.setPluginData('custom', 'kept');

    const button = fake.world.addNode('FRAME', 'Button');
    button.fills = [boundPaint(brand)];
    button.setBoundVariable('itemSpacing', variableNamed('space/md'));
    const otherPage = fake.world.addPage('Page 2');
    const card = fake.world.addNode('RECTANGLE', 'Card', otherPage);
    card.strokes = [boundPaint(brand)];

    await loadPlugin();
    const before = idState();

    await fake.send({ type: 'delete-variable', id: brand.id });
    expect(brand.removed).toBe(true);

    await fake.send({ type: 'undo' });
    const restored = variableNamed('brand/default');
    expect(restored.id).not.toBe(brand.id);
    expect(restored.valuesByMode[light]).toEqual(rgb('#3366FF'));
    expect(restored.valuesByMode[dark]).toEqual(rgb('#99BBFF'));
    expect(restored.description).toBe('Primary brand colour');
    expect(restored.scopes).toEqual(['FRAME_FILL', 'SHAPE_FILL']);
    expect(restored.codeSyntax).toEqual({ WEB: '--brand' });
    expect(restored.hiddenFromPublishing).toBe(true);

    // The alias pointing at it and both layers follow the new id.
    expect(text.removed).toBe(false);
    expect(text.valuesByMode[light]).toEqual({ type: 'VARIABLE_ALIAS', id: restored.id });
    expect((button.boundVariables.fills as any[])[0].id).toBe(restored.id);
    expect((card.boundVariables.strokes as any[])[0].id).toBe(restored.id);
    expect((button.boundVariables.itemSpacing as any).id).toBe(variableNamed('space/md').id);
    expect(fake.world.loadAllPagesCalls).toBe(1);

    // Every other id is unchanged.
    const after = idState();
    expect(after.collections).toEqual(before.collections);
    expect(after.modes).toEqual(before.modes);
    expect(after.variables.filter(entry => !entry.endsWith('=brand/default')))
      .toEqual(before.variables.filter(entry => !entry.endsWith('=brand/default')));

    // Redo deletes the restored variable; undo brings it back once more and
    // the stacks were remapped, so no name fallback and no history reset.
    await fake.send({ type: 'redo' });
    expect(restored.removed).toBe(true);
    await fake.send({ type: 'undo' });
    const again = variableNamed('brand/default');
    expect(again.id).not.toBe(restored.id);
    expect((button.boundVariables.fills as any[])[0].id).toBe(again.id);
    expect((card.boundVariables.strokes as any[])[0].id).toBe(again.id);
    expect(text.valuesByMode[light]).toEqual({ type: 'VARIABLE_ALIAS', id: again.id });
    expect(historyErrors()).toEqual([]);
    expect(lastHistoryState()).toMatchObject({ undoCount: 0, redoCount: 1 });
  });

  it('undo three times through a delete, then redo three times', async () => {
    const { brand, md, light, spacing } = seedColors();
    const node = fake.world.addNode('FRAME', 'Box');
    node.fills = [boundPaint(brand)];
    await loadPlugin();

    await fake.send({ type: 'update-variable-value', id: brand.id, modeId: light, value: '#00FF00' });
    await fake.send({ type: 'delete-variable', id: brand.id });
    await fake.send({ type: 'update-variable-value', id: md.id, modeId: spacing.defaultModeId, value: '24' });

    await fake.send({ type: 'undo' });
    expect(md.valuesByMode[spacing.defaultModeId]).toBe(16);
    await fake.send({ type: 'undo' });
    const back = variableNamed('brand/default');
    expect(back.valuesByMode[light]).toEqual(rgb('#00FF00'));
    await fake.send({ type: 'undo' });
    expect(variableNamed('brand/default').id).toBe(back.id);
    expect(back.valuesByMode[light]).toEqual(rgb('#3366FF'));
    expect((node.boundVariables.fills as any[])[0].id).toBe(back.id);

    await fake.send({ type: 'redo' });
    expect(back.valuesByMode[light]).toEqual(rgb('#00FF00'));
    await fake.send({ type: 'redo' });
    expect(back.removed).toBe(true);
    await fake.send({ type: 'redo' });
    expect(md.valuesByMode[spacing.defaultModeId]).toBe(24);
    expect(md.removed).toBe(false);

    expect(historyErrors()).toEqual([]);
    expect(lastHistoryState()).toMatchObject({ undoCount: 3, redoCount: 0 });
  });

  it('undo of a move puts the variable back and leaves no stray copy', async () => {
    const { brand, spacing, colors } = seedColors();
    const target = fake.world.createCollection('Other');
    const node = fake.world.addNode('FRAME', 'Box');
    node.fills = [boundPaint(brand)];
    await loadPlugin();

    await fake.send({ type: 'move-variable-to-collection', variableId: brand.id, targetCollectionId: target.id });
    const moved = variableNamed('brand/default', target as any);
    expect((node.boundVariables.fills as any[])[0].id).toBe(moved.id);

    await fake.send({ type: 'undo' });
    expect(moved.removed).toBe(true);
    const back = variableNamed('brand/default', colors);
    expect(fake.world.localVariables().filter(variable => variable.name === 'brand/default')).toHaveLength(1);
    expect((node.boundVariables.fills as any[])[0].id).toBe(back.id);
    expect(spacing.removed).toBe(false);
    expect(historyErrors()).toEqual([]);
  });

  it('keeps alias targets exact: library variables and same-named variables', async () => {
    const { colors, light, brand } = seedColors();
    const library = fake.world.addRemoteVariable('brand/default', 'COLOR', rgb('#123456'));
    const other = fake.world.createCollection('Legacy');
    const twin = fake.world.createVariable('brand/default', other, 'COLOR');
    const fromLibrary = fake.world.createVariable('link/library', colors, 'COLOR');
    fromLibrary.setValueForMode(light, { type: 'VARIABLE_ALIAS', id: library.id });
    const fromTwin = fake.world.createVariable('link/twin', colors, 'COLOR');
    fromTwin.setValueForMode(light, { type: 'VARIABLE_ALIAS', id: twin.id });
    await loadPlugin();

    await fake.send({ type: 'update-variable-value', id: fromLibrary.id, modeId: light, value: '#000000' });
    await fake.send({ type: 'update-variable-value', id: fromTwin.id, modeId: light, value: '#000000' });
    await fake.send({ type: 'undo' });
    await fake.send({ type: 'undo' });

    expect(fromLibrary.valuesByMode[light]).toEqual({ type: 'VARIABLE_ALIAS', id: library.id });
    expect(fromTwin.valuesByMode[light]).toEqual({ type: 'VARIABLE_ALIAS', id: twin.id });
    expect(brand.removed).toBe(false);
    expect(historyErrors()).toEqual([]);
  });

  it('an alias to a deleted variable never blocks undo: delete target, edit, undo twice, redo twice', async () => {
    const { brand, text, light, dark } = seedColors();
    const node = fake.world.addNode('FRAME', 'Box');
    node.fills = [boundPaint(brand)];
    await loadPlugin();

    await fake.send({ type: 'delete-variable', id: brand.id });
    // The alias now dangles on the soft-deleted variable.
    expect(text.valuesByMode[light]).toEqual({ type: 'VARIABLE_ALIAS', id: brand.id });
    await fake.send({ type: 'update-variable-value', id: text.id, modeId: light, value: '#FF0000' });

    // Undo of the edit: the snapshot's alias points at a variable that cannot
    // exist after this step, so that mode keeps its current value and the
    // step still goes through (with a notice, not an error).
    fake.clearMessages();
    await fake.send({ type: 'undo' });
    expect(text.valuesByMode[light]).toEqual(rgb('#FF0000'));
    expect(historyErrors()).toEqual([]);
    const applied = fake.messagesOfType('history-applied');
    expect(applied).toHaveLength(1);
    expect(applied[0].notice).toMatch(/couldn't restore the reference on text\/primary/);
    expect(lastHistoryState()).toMatchObject({ undoCount: 1, redoCount: 1 });

    // Undo of the delete recreates brand/default, and the alias, resolved
    // against the snapshot's own variables, points at the recreated one.
    await fake.send({ type: 'undo' });
    const back = variableNamed('brand/default');
    expect(back.id).not.toBe(brand.id);
    expect(back.valuesByMode[light]).toEqual(rgb('#3366FF'));
    expect(text.removed).toBe(false);
    expect(text.valuesByMode[light]).toEqual({ type: 'VARIABLE_ALIAS', id: back.id });
    expect(text.valuesByMode[dark]).toEqual(rgb('#FFFFFF'));
    expect((node.boundVariables.fills as any[])[0].id).toBe(back.id);
    expect(lastHistoryState()).toMatchObject({ undoCount: 0, redoCount: 2 });

    // Redo the delete, then the edit. Redo returns to what each undo left:
    // after the delete the light mode held #FF0000 (kept by the first undo).
    await fake.send({ type: 'redo' });
    expect(back.removed).toBe(true);
    expect(text.valuesByMode[light]).toEqual(rgb('#FF0000'));
    await fake.send({ type: 'redo' });
    expect(text.valuesByMode[light]).toEqual(rgb('#FF0000'));
    expect(lastHistoryState()).toMatchObject({ undoCount: 2, redoCount: 0 });

    // And back to the start once more.
    await fake.send({ type: 'undo' });
    await fake.send({ type: 'undo' });
    const again = variableNamed('brand/default');
    expect(text.valuesByMode[light]).toEqual({ type: 'VARIABLE_ALIAS', id: again.id });
    expect((node.boundVariables.fills as any[])[0].id).toBe(again.id);
    expect(historyErrors()).toEqual([]);
    expect(lastHistoryState()).toMatchObject({ undoCount: 0, redoCount: 2 });
  });

  it('a library alias that no longer resolves keeps its current value; the rest of the step applies', async () => {
    const { colors, light, md, spacing } = seedColors();
    const library = fake.world.addRemoteVariable('lib/blue', 'COLOR', rgb('#0000FF'));
    const linked = fake.world.createVariable('link/library', colors, 'COLOR');
    linked.setValueForMode(light, { type: 'VARIABLE_ALIAS', id: library.id });
    await loadPlugin();

    await fake.send({ type: 'update-variable-value', id: linked.id, modeId: light, value: '#FF00FF' });
    await fake.send({ type: 'update-variable-value', id: md.id, modeId: spacing.defaultModeId, value: '24' });
    fake.world.dropVariable(library.id);
    fake.clearMessages();

    await fake.send({ type: 'undo' });
    expect(md.valuesByMode[spacing.defaultModeId]).toBe(16);
    await fake.send({ type: 'undo' });
    expect(linked.valuesByMode[light]).toEqual(rgb('#FF00FF'));
    expect(historyErrors()).toEqual([]);
    const notices = fake.messagesOfType('history-applied').map(message => message.notice).filter(Boolean);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatch(/link\/library/);
    expect(lastHistoryState()).toMatchObject({ undoCount: 0, redoCount: 2 });

    await fake.send({ type: 'redo' });
    await fake.send({ type: 'redo' });
    expect(md.valuesByMode[spacing.defaultModeId]).toBe(24);
    expect(historyErrors()).toEqual([]);
  });

  it('undo / redo of a move rebinds each layer to its own original, never a namesake in another collection', async () => {
    const { brand, colors } = seedColors();
    const legacy = fake.world.createCollection('Legacy');
    const legacyBrand = fake.world.createVariable('brand/default', legacy, 'COLOR');
    const other = fake.world.createCollection('Other');
    const colorsBox = fake.world.addNode('FRAME', 'Colors box');
    colorsBox.fills = [boundPaint(brand)];
    const legacyBox = fake.world.addNode('FRAME', 'Legacy box');
    legacyBox.fills = [boundPaint(legacyBrand)];
    await loadPlugin();

    // Legacy's copy takes the plain name, Colors' copy becomes brand/default-2.
    await fake.send({ type: 'move-group-to-collection', variableIds: [legacyBrand.id, brand.id], targetCollectionId: other.id });
    const legacyCopy = variableNamed('brand/default', other as any);
    const colorsCopy = variableNamed('brand/default-2', other as any);
    expect((legacyBox.boundVariables.fills as any[])[0].id).toBe(legacyCopy.id);
    expect((colorsBox.boundVariables.fills as any[])[0].id).toBe(colorsCopy.id);

    await fake.send({ type: 'undo' });
    const colorsBack = variableNamed('brand/default', colors);
    const legacyBack = variableNamed('brand/default', legacy as any);
    expect((legacyBox.boundVariables.fills as any[])[0].id).toBe(legacyBack.id);
    expect((colorsBox.boundVariables.fills as any[])[0].id).toBe(colorsBack.id);

    await fake.send({ type: 'redo' });
    const legacyCopyAgain = variableNamed('brand/default', other as any);
    const colorsCopyAgain = variableNamed('brand/default-2', other as any);
    expect((legacyBox.boundVariables.fills as any[])[0].id).toBe(legacyCopyAgain.id);
    expect((colorsBox.boundVariables.fills as any[])[0].id).toBe(colorsCopyAgain.id);

    await fake.send({ type: 'undo' });
    expect((legacyBox.boundVariables.fills as any[])[0].id).toBe(variableNamed('brand/default', legacy as any).id);
    expect((colorsBox.boundVariables.fills as any[])[0].id).toBe(variableNamed('brand/default', colors).id);
    expect(historyErrors()).toEqual([]);
  });

  it('a restore that fails half-way is rolled back and keeps the stacks', async () => {
    const { brand, text, md, light } = seedColors();
    await loadPlugin();

    await fake.send({ type: 'delete-group', ids: [brand.id, text.id] });
    await fake.send({ type: 'update-variable-value', id: md.id, modeId: fake.world.collections.get(md.variableCollectionId)!.defaultModeId, value: '20' });
    await fake.send({ type: 'undo' });
    const before = fake.world.localVariables().map(variable => variable.name);
    expect(before).toEqual(['space/md']);

    // Undo recreates brand, then the second create throws.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    fake.world.failNext = 'createVariable';
    fake.clearMessages();
    await fake.send({ type: 'undo' });
    expect(fake.world.localVariables().map(variable => variable.name)).toEqual(before);
    expect(historyErrors()).toHaveLength(1);
    expect(historyErrors()[0]).toMatch(/rolled back/);
    consoleError.mockRestore();
    expect(lastHistoryState()).toMatchObject({ undoCount: 1, redoCount: 1 });

    // The same undo then goes through.
    await fake.send({ type: 'undo' });
    const restoredBrand = variableNamed('brand/default');
    expect(variableNamed('text/primary').valuesByMode[light]).toEqual({ type: 'VARIABLE_ALIAS', id: restoredBrand.id });
    expect(historyErrors()).toHaveLength(1);
    expect(lastHistoryState()).toMatchObject({ undoCount: 0, redoCount: 2 });
  });

  it('undo of a new collection removes it, redo brings it back, other ids stay', async () => {
    seedColors();
    await loadPlugin();
    const before = idState();

    await fake.send({ type: 'create-collection', name: 'Typography' });
    const created = fake.world.localCollections().find(collection => collection.name === 'Typography')!;
    await fake.send({ type: 'create-variable', collectionId: created.id, name: 'font/size', varType: 'FLOAT', value: '14' });

    await fake.send({ type: 'undo' });
    await fake.send({ type: 'undo' });
    expect(created.removed).toBe(true);
    expect(idState()).toEqual(before);

    await fake.send({ type: 'redo' });
    await fake.send({ type: 'redo' });
    const again = fake.world.localCollections().find(collection => collection.name === 'Typography')!;
    expect(again).toBeTruthy();
    expect(variableNamed('font/size').valuesByMode[again.defaultModeId]).toBe(14);
    expect(idState().collections.slice(0, 2)).toEqual(before.collections);
    expect(historyErrors()).toEqual([]);
  });

  it('undo of delete-all rebuilds collections with their modes and rebinds layers', async () => {
    const { brand, light, dark } = seedColors();
    const node = fake.world.addNode('FRAME', 'Box');
    node.fills = [boundPaint(brand)];
    await loadPlugin();

    await fake.send({ type: 'delete-all-variables' });
    expect(fake.world.localCollections()).toHaveLength(0);

    await fake.send({ type: 'undo' });
    const colors = fake.world.localCollections().find(collection => collection.name === 'Colors')!;
    expect(colors.modes.map(mode => mode.name)).toEqual(['Light', 'Dark']);
    const [newLight, newDark] = colors.modes.map(mode => mode.modeId);
    expect([newLight, newDark]).not.toEqual([light, dark]);
    const newBrand = variableNamed('brand/default');
    expect(newBrand.valuesByMode[newDark]).toEqual(rgb('#99BBFF'));
    expect(variableNamed('text/primary').valuesByMode[newLight]).toEqual({ type: 'VARIABLE_ALIAS', id: newBrand.id });
    expect((node.boundVariables.fills as any[])[0].id).toBe(newBrand.id);

    await fake.send({ type: 'redo' });
    expect(fake.world.localCollections()).toHaveLength(0);
    await fake.send({ type: 'undo' });
    expect(fake.world.localCollections().map(collection => collection.name)).toEqual(['Colors', 'Spacing']);
    expect((node.boundVariables.fills as any[])[0].id).toBe(variableNamed('brand/default').id);
    expect(historyErrors()).toEqual([]);
  });

  it('undo and redo of generated shades keep the source id and remap shade ids', async () => {
    const { colors, light, brand } = seedColors();
    await loadPlugin();
    const curve = {
      startValue: 0,
      leftHandle1: { t: 0.2, value: 0.2 },
      leftHandle2: { t: 0.4, value: 0.4 },
      rightHandle1: { t: 0.6, value: 0.6 },
      rightHandle2: { t: 0.8, value: 0.8 },
      endValue: 1,
    };
    await fake.send({
      type: 'update-shades',
      collectionId: colors.id,
      modeId: light,
      deleteIds: [],
      shades: [
        { name: 'brand/default/100', value: '#EEEEFF' },
        { name: 'brand/default/200', value: '#CCCCFF' },
      ],
      source: { id: brand.id, name: 'brand/default', value: '#3366FF' },
      config: {
        shadeCount: 2, baseIndex: 1, lightValue: 5, darkValue: 90,
        lightnessCurve: curve, saturationCurve: curve, hueCurve: curve,
      },
    });
    const shadeIds = () => fake.world.localVariables()
      .filter(variable => /\/\d+$/.test(variable.name))
      .map(variable => variable.id);
    expect(shadeIds()).toHaveLength(2);
    expect(brand.getPluginData('shadeGeneratorConfig')).not.toBe('');

    await fake.send({ type: 'undo' });
    expect(shadeIds()).toHaveLength(0);
    expect(brand.removed).toBe(false);
    expect(brand.getPluginData('shadeGeneratorConfig')).toBe('');

    await fake.send({ type: 'redo' });
    const ids = shadeIds();
    expect(ids).toHaveLength(2);
    const config = JSON.parse(brand.getPluginData('shadeGeneratorConfig'));
    expect(config.sourceVariableId).toBe(brand.id);
    expect(config.generatedShades.map((shade: any) => shade.id).sort()).toEqual(ids.slice().sort());

    await fake.send({ type: 'undo' });
    await fake.send({ type: 'redo' });
    expect(shadeIds()).toHaveLength(2);
    expect(historyErrors()).toEqual([]);
  });

  it('undo and redo of duplicate, group rename and group delete', async () => {
    const { brand, text, colors } = seedColors();
    await loadPlugin();
    const before = idState();

    await fake.send({ type: 'duplicate-variable', id: brand.id });
    await fake.send({ type: 'rename-group', variableIds: [brand.id, text.id], groupName: 'brand', newGroupName: 'accent' });
    await fake.send({ type: 'delete-group', ids: [text.id] });
    expect(text.removed).toBe(true);

    await fake.send({ type: 'undo' });
    await fake.send({ type: 'undo' });
    await fake.send({ type: 'undo' });
    const after = idState();
    expect(after.collections).toEqual(before.collections);
    expect(after.modes).toEqual(before.modes);
    expect(brand.name).toBe('brand/default');
    expect(brand.removed).toBe(false);
    expect(fake.world.localVariables().filter(variable => variable.variableCollectionId === colors.id)).toHaveLength(2);

    await fake.send({ type: 'redo' });
    await fake.send({ type: 'redo' });
    await fake.send({ type: 'redo' });
    expect(historyErrors()).toEqual([]);
    expect(lastHistoryState()).toMatchObject({ undoCount: 3, redoCount: 0 });
  });
});
