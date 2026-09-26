import { describe, it, expect } from 'vitest';
import {
  arrangeGroupsByConnectedBlocks,
  buildArrangeUnits,
  getGroupHeight,
  normalizeGridLayoutSettings,
  toGridLayoutDraft,
} from '../../../../src/ui/components/Relationships/GroupedGraph/utils';
import type { CardVisibilityFilters } from '../../../../src/ui/components/Relationships/GroupedGraph/utils';
import {
  GRID_MAX_COLUMN_HEIGHT,
  GROUP_GAP_X,
  GROUP_GAP_Y,
  GROUP_WIDTH,
  SHADER_GROUP_HEADER_FILL,
  STANDARD_GROUP_HEADER_FILL,
} from '../../../../src/ui/components/Relationships/GroupedGraph/constants';
import type {
  ConnectionRecord,
  GroupData,
  VariableNode,
} from '../../../../src/ui/components/Relationships/GroupedGraph/types';
import type { VariableData } from '../../../../src/ui/types';

// ── Fixtures ───────────────────────────────────────────────────────

const COLUMN_STEP = GROUP_WIDTH + GROUP_GAP_X;

const row = (id: string, name: string, extra: Partial<VariableNode> = {}): VariableNode => ({
  id,
  name,
  shortName: name.split('/').pop() || name,
  displayName: name,
  color: '#ffffff',
  value: '#ffffff',
  resolvedValue: '#ffffff',
  resolvedType: 'COLOR',
  isReference: false,
  referenceName: null,
  ...extra,
});

const card = (
  key: string,
  collectionId: string,
  sourceGroupName: string,
  rows: VariableNode[],
  extra: Partial<GroupData> = {}
): GroupData => ({
  key,
  title: key,
  variables: rows,
  x: 0,
  y: 0,
  initialX: 0,
  initialY: 0,
  kind: 'standard',
  sourceGroupName,
  headerFill: STANDARD_GROUP_HEADER_FILL,
  collectionId,
  ...extra,
});

/** A one-row standalone card in collection `color`, titled by its key. */
const plain = (key: string, collectionId = 'color'): GroupData =>
  card(`group:${key}`, collectionId, `${collectionId}/${key}`, [
    row(`v-${key}`, `${collectionId}/${key}/base`),
  ]);

const link = (from: GroupData, to: GroupData): ConnectionRecord => ({
  id: `${from.key}->${to.key}`,
  kind: 'reference',
  fromGroup: from.key,
  fromVar: from.variables[0]?.name || '',
  toGroup: to.key,
  toVar: to.variables[0]?.name || '',
});

const variablesById = (groups: GroupData[]): Map<string, VariableData> => {
  const map = new Map<string, VariableData>();
  groups.forEach(group => {
    group.variables.forEach(variable => {
      if (variable.isVirtual) return;
      map.set(variable.id, {
        id: variable.id,
        collectionId: group.collectionId,
        name: variable.name,
        resolvedType: 'COLOR',
        value: '#ffffff',
        valuesByMode: {},
      });
    });
  });
  return map;
};

const filtersFor = (
  groups: GroupData[],
  visibleCollections: string[]
): CardVisibilityFilters => {
  // Managed cards match the group filter on `sourceGroupName`; every other
  // card matches on the parent path of each of its rows. Select both, so the
  // group filter never quietly hides a fixture.
  const selectedGroups = new Set<string>();
  groups.forEach(group => {
    if (group.sourceGroupName) {
      selectedGroups.add(`${group.collectionId}::${group.sourceGroupName}`);
    }
    group.variables.forEach(variable => {
      const parent = variable.name.split('/').slice(0, -1).join('/');
      if (parent) selectedGroups.add(`${group.collectionId}::${parent}`);
    });
  });

  return {
    selectedCollections: new Set(visibleCollections),
    selectedTypes: new Set(['COLOR', 'FLOAT']),
    selectedGroups,
    variablesById: variablesById(groups),
  };
};

/**
 * The exact composition `handleArrangeGrid` performs: fold cards into units,
 * split the connections into "everything" (tiers) and "both ends visible"
 * (packing), then arrange.
 */
const arrange = (
  groups: GroupData[],
  connections: ConnectionRecord[],
  visibleCollections: string[],
  options: { maxColumnHeight?: number; dropHiddenEdgesFromDepth?: boolean } = {}
) => {
  const visibility = filtersFor(groups, visibleCollections);
  const { units, heightOverrides, unitKeyByGroupKey, hiddenByKey } = buildArrangeUnits(
    groups,
    new Set(),
    visibility,
    new Map()
  );

  const allConnections: ConnectionRecord[] = [];
  const visibleConnections: ConnectionRecord[] = [];
  connections.forEach(conn => {
    const fromUnit = unitKeyByGroupKey.get(conn.fromGroup);
    const toUnit = unitKeyByGroupKey.get(conn.toGroup);
    if (!fromUnit || !toUnit) return;
    if (fromUnit === toUnit) return;
    const remapped: ConnectionRecord = { ...conn, fromGroup: fromUnit, toGroup: toUnit };
    allConnections.push(remapped);
    if (hiddenByKey.get(conn.fromGroup) || hiddenByKey.get(conn.toGroup)) return;
    visibleConnections.push(remapped);
  });

  return arrangeGroupsByConnectedBlocks(units, visibleConnections, GROUP_GAP_X, GROUP_GAP_Y, {
    heightOverrides,
    // `dropHiddenEdgesFromDepth` reproduces the pre-fix behaviour, where the
    // tiers were read off the filtered graph.
    depthConnections: options.dropHiddenEdgesFromDepth ? visibleConnections : allConnections,
    maxColumnHeight: options.maxColumnHeight,
  });
};

// ── Fault 1: tiers must survive filtering ──────────────────────────

describe('Arrange tiers are computed over the full connection graph', () => {
  // `prim` lives in the collection the user deselects. `surface` references it,
  // `button` references `surface`, and `root` references nothing at all.
  const prim = plain('prim', '_global');
  const root = plain('root');
  const surface = plain('surface');
  const button = plain('button');
  const groups = [prim, root, surface, button];
  const connections = [link(prim, surface), link(surface, button)];

  it('keeps each visible card in its own tier when a whole collection is hidden', () => {
    const positions = arrange(groups, connections, ['color']);

    expect(Array.from(positions.keys()).sort()).toEqual([
      'group:button', 'group:root', 'group:surface',
    ]);
    // `root` is a genuine root, `surface` is one level in, `button` two —
    // exactly the tiers they hold with `_global` on screen.
    expect(positions.get('group:root')!.x).toBe(0);
    expect(positions.get('group:surface')!.x).toBe(COLUMN_STEP);
    expect(positions.get('group:button')!.x).toBe(COLUMN_STEP * 2);
  });

  it('collapsed the tiers before the fix: the filtered graph makes a consumer a root', () => {
    const positions = arrange(groups, connections, ['color'], {
      dropHiddenEdgesFromDepth: true,
    });

    // Without its incoming edge `surface` looks like a root and shares the
    // first column with `root`; the graph flattens into two columns.
    expect(positions.get('group:surface')!.x).toBe(0);
    expect(positions.get('group:root')!.x).toBe(0);
    expect(positions.get('group:button')!.x).toBe(COLUMN_STEP);
  });

  it('is unchanged when nothing is hidden', () => {
    const positions = arrange(groups, connections, ['color', '_global']);

    expect(positions.get('group:prim')!.x).toBe(0);
    expect(positions.get('group:root')!.x).toBe(0);
    expect(positions.get('group:surface')!.x).toBe(COLUMN_STEP);
    expect(positions.get('group:button')!.x).toBe(COLUMN_STEP * 2);
  });
});

describe('Empty lanes collapse', () => {
  it('leaves no horizontal void where a fully hidden tier used to sit', () => {
    // Every depth-0 card is hidden, so lane 0 holds nothing visible.
    const prim = plain('prim', '_global');
    const surface = plain('surface');
    const button = plain('button');
    const positions = arrange(
      [prim, surface, button],
      [link(prim, surface), link(surface, button)],
      ['color']
    );

    // Depths are still 1 and 2, but the lanes renumber contiguously.
    expect(positions.get('group:surface')!.x).toBe(0);
    expect(positions.get('group:button')!.x).toBe(COLUMN_STEP);
  });

  it('keeps the relative order of the lanes it renumbers', () => {
    // Depth 0 and depth 1 are both fully hidden; depth 2 and 3 remain.
    const a = plain('a', '_global');
    const b = plain('b', '_global');
    const c = plain('c');
    const d = plain('d');
    const positions = arrange(
      [a, b, c, d],
      [link(a, b), link(b, c), link(c, d)],
      ['color']
    );

    expect(positions.get('group:c')!.x).toBe(0);
    expect(positions.get('group:d')!.x).toBe(COLUMN_STEP);
  });
});

// ── Fault 2: over-tall columns wrap ────────────────────────────────

describe('Over-tall lanes wrap into sub-columns', () => {
  const cardHeight = getGroupHeight(plain('a'));
  const stackStep = cardHeight + GROUP_GAP_Y;

  it('stacks the whole tier in one column when the cap allows it', () => {
    const cards = ['a', 'b', 'c', 'd'].map(key => plain(key));
    const positions = arrange(cards, [], ['color']);

    cards.forEach((group, index) => {
      expect(positions.get(group.key)).toEqual({ x: 0, y: index * stackStep });
    });
  });

  it('splits a lane whose stack exceeds the cap, chunking its existing order', () => {
    const cards = ['a', 'b', 'c', 'd'].map(key => plain(key));
    // Room for two cards per column (2 * 84 + 40 = 208), not three.
    const positions = arrange(cards, [], ['color'], { maxColumnHeight: 2 * cardHeight + GROUP_GAP_Y });

    expect(positions.get('group:a')).toEqual({ x: 0, y: 0 });
    expect(positions.get('group:b')).toEqual({ x: 0, y: stackStep });
    expect(positions.get('group:c')).toEqual({ x: COLUMN_STEP, y: 0 });
    expect(positions.get('group:d')).toEqual({ x: COLUMN_STEP, y: stackStep });
  });

  it('still gives a card taller than the cap a sub-column of its own', () => {
    const tall = card('group:tall', 'color', 'color/tall', [
      row('v-tall-1', 'color/tall/one'),
      row('v-tall-2', 'color/tall/two'),
      row('v-tall-3', 'color/tall/three'),
    ]);
    const small = plain('zz');
    const positions = arrange([tall, small], [], ['color'], { maxColumnHeight: 10 });

    expect(positions.get('group:tall')).toEqual({ x: 0, y: 0 });
    expect(positions.get('group:zz')).toEqual({ x: COLUMN_STEP, y: 0 });
  });

  it('shifts later tiers right by the extra columns a split tier consumes', () => {
    const a = plain('a');
    const b = plain('b');
    const c = plain('c');
    const d = plain('d');
    const leaf = plain('leaf');
    // a..d are roots; `leaf` sits one tier to their right.
    const connections = [link(a, leaf)];
    const groups = [a, b, c, d, leaf];

    const uncapped = arrange(groups, connections, ['color']);
    expect(uncapped.get('group:leaf')!.x).toBe(COLUMN_STEP);

    // Two cards per sub-column: lane 0 becomes two columns wide.
    const capped = arrange(groups, connections, ['color'], {
      maxColumnHeight: 2 * cardHeight + GROUP_GAP_Y,
    });
    expect(capped.get('group:a')!.x).toBe(0);
    expect(capped.get('group:c')!.x).toBe(COLUMN_STEP);
    expect(capped.get('group:leaf')!.x).toBe(COLUMN_STEP * 2);
  });

  it('chunks the order the barycenter sweeps produced, not the title order', () => {
    // Lane 0 keeps title order [a-src, b-src]. In lane 1 the titles sort the
    // other way round from the connections, so only the sweeps can put `z-dep`
    // (fed by the first source) ahead of `a-dep` (fed by the second).
    const first = plain('a-src');
    const second = plain('b-src');
    const late = plain('z-dep');
    const early = plain('a-dep');
    const groups = [first, second, late, early];
    const connections = [link(first, late), link(second, early)];

    // One card per sub-column, so the chunking is directly readable as order.
    const positions = arrange(groups, connections, ['color'], { maxColumnHeight: 10 });

    expect(positions.get('group:a-src')!.x).toBe(0);
    expect(positions.get('group:b-src')!.x).toBe(COLUMN_STEP);
    // Lane 1 starts after lane 0's two sub-columns, and follows the swept
    // order: `z-dep` first even though its title sorts last.
    expect(positions.get('group:z-dep')!.x).toBe(COLUMN_STEP * 2);
    expect(positions.get('group:a-dep')!.x).toBe(COLUMN_STEP * 3);
  });
});

// ── Managed chains are never broken up ─────────────────────────────

describe('Managed chains survive wrapping', () => {
  const chain = (name: string): GroupData[] => [
    card(`source:${name}`, 'color', `color/${name}`, [row(`v-${name}`, `color/${name}`)], {
      kind: 'source',
    }),
    card(
      `shader:${name}`,
      'color',
      `color/${name}`,
      [row(`shader:${name}`, `shader:${name}`, { isVirtual: true, virtualType: 'shader' })],
      { kind: 'shader', headerFill: SHADER_GROUP_HEADER_FILL }
    ),
    card(`shades:${name}`, 'color', `color/${name}`, [row(`v-${name}-100`, `color/${name}/100`)], {
      kind: 'shades',
    }),
  ];

  it('keeps every chain whole on one row however small the cap is', () => {
    const groups = [...chain('red'), ...chain('green'), ...chain('blue')];
    const positions = arrange(groups, [], ['color'], { maxColumnHeight: 1 });

    const rowHeight = getGroupHeight(groups[0]) + GROUP_GAP_Y;
    ['red', 'green', 'blue'].forEach(name => {
      const source = positions.get(`source:${name}`)!;
      const shader = positions.get(`shader:${name}`)!;
      const shades = positions.get(`shades:${name}`)!;
      // One horizontal row: same Y, three consecutive lanes.
      expect(shader.y).toBe(source.y);
      expect(shades.y).toBe(source.y);
      expect(source.x).toBe(0);
      expect(shader.x).toBe(COLUMN_STEP);
      expect(shades.x).toBe(COLUMN_STEP * 2);
    });

    // The chains stack downwards in the SAME columns — a chain row is never
    // pushed into a sub-column, even though the three rows together are far
    // taller than the cap.
    expect(positions.get('source:red')!.y).toBe(0);
    expect(positions.get('source:green')!.y).toBe(rowHeight);
    expect(positions.get('source:blue')!.y).toBe(rowHeight * 2);
  });

  it('wraps the standalone cards beside a chain without disturbing it', () => {
    const groups = [...chain('red'), plain('p'), plain('q'), plain('r')];
    const cardHeight = getGroupHeight(plain('p'));
    const positions = arrange(groups, [], ['color'], {
      maxColumnHeight: 2 * cardHeight + GROUP_GAP_Y,
    });

    // Lane 0 holds the chain row plus three standalone cards; the standalone
    // stack wraps after two, so lane 0 is two columns wide and the chain's
    // shader/shades lanes shift right by one.
    expect(positions.get('source:red')).toEqual({ x: 0, y: 0 });
    expect(positions.get('shader:red')!.y).toBe(0);
    expect(positions.get('shades:red')!.y).toBe(0);
    expect(positions.get('shader:red')!.x).toBe(COLUMN_STEP * 2);
    expect(positions.get('shades:red')!.x).toBe(COLUMN_STEP * 3);

    // Standalone cards start below the chain row, and the third wraps.
    const belowChain = getGroupHeight(groups[0]) + GROUP_GAP_Y;
    expect(positions.get('group:p')).toEqual({ x: 0, y: belowChain });
    expect(positions.get('group:q')).toEqual({ x: 0, y: belowChain + cardHeight + GROUP_GAP_Y });
    expect(positions.get('group:r')).toEqual({ x: COLUMN_STEP, y: belowChain });
  });
});

// ── The new Grid Setting ───────────────────────────────────────────

describe('normalizeGridLayoutSettings: max column height', () => {
  it('defaults when the stored settings predate the option', () => {
    expect(normalizeGridLayoutSettings({ gapX: 10, gapY: 20 })).toEqual({
      gapX: 10,
      gapY: 20,
      maxColumnHeight: GRID_MAX_COLUMN_HEIGHT,
    });
  });

  it('keeps a positive value and rejects anything else', () => {
    expect(normalizeGridLayoutSettings({ maxColumnHeight: 900 }).maxColumnHeight).toBe(900);
    expect(normalizeGridLayoutSettings({ maxColumnHeight: 0 }).maxColumnHeight).toBe(GRID_MAX_COLUMN_HEIGHT);
    expect(normalizeGridLayoutSettings({ maxColumnHeight: -5 }).maxColumnHeight).toBe(GRID_MAX_COLUMN_HEIGHT);
    expect(normalizeGridLayoutSettings({ maxColumnHeight: Number.NaN }).maxColumnHeight).toBe(GRID_MAX_COLUMN_HEIGHT);
    expect(normalizeGridLayoutSettings(undefined).maxColumnHeight).toBe(GRID_MAX_COLUMN_HEIGHT);
  });

  it('round-trips through the draft the Grid Settings inputs edit', () => {
    const settings = normalizeGridLayoutSettings({ gapX: 1, gapY: 2, maxColumnHeight: 3 });
    expect(toGridLayoutDraft(settings)).toEqual({ gapX: '1', gapY: '2', maxColumnHeight: '3' });
  });
});
