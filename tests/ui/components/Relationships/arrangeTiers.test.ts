import { describe, it, expect } from 'vitest';
import {
  arrangeGroupsByConnectedBlocks,
  buildArrangeUnits,
  getGroupHeight,
  isTierLabelNodeId,
  normalizeGridLayoutSettings,
  toGridLayoutDraft,
} from '../../../../src/ui/components/Relationships/GroupedGraph/utils';
import type { CardVisibilityFilters } from '../../../../src/ui/components/Relationships/GroupedGraph/utils';
import {
  GROUP_GAP_X,
  GROUP_GAP_Y,
  GROUP_WIDTH,
  SHADER_GROUP_HEADER_FILL,
  STANDARD_GROUP_HEADER_FILL,
  TIER_LABEL_NODE_PREFIX,
} from '../../../../src/ui/components/Relationships/GroupedGraph/constants';
import type {
  ConnectionRecord,
  GroupData,
  VariableNode,
} from '../../../../src/ui/components/Relationships/GroupedGraph/types';
import type { VariableData } from '../../../../src/ui/types';

// ── Fixtures ───────────────────────────────────────────────────────

// One tier is one column, so every tier boundary is the same uniform step.
const COLUMN_STEP = GROUP_WIDTH + GROUP_GAP_X;

/** Left edge of the tier with `tiersBefore` tiers to its left. */
const laneX = (tiersBefore: number) => tiersBefore * COLUMN_STEP;

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
  options: { dropHiddenEdgesFromDepth?: boolean } = {}
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
    const { positions } = arrange(groups, connections, ['color']);

    expect(Array.from(positions.keys()).sort()).toEqual([
      'group:button', 'group:root', 'group:surface',
    ]);
    // `root` is a genuine root, `surface` is one level in, `button` two —
    // exactly the tiers they hold with `_global` on screen.
    expect(positions.get('group:root')!.x).toBe(0);
    expect(positions.get('group:surface')!.x).toBe(laneX(1));
    expect(positions.get('group:button')!.x).toBe(laneX(2));
  });

  it('collapsed the tiers before the fix: the filtered graph makes a consumer a root', () => {
    const { positions } = arrange(groups, connections, ['color'], {
      dropHiddenEdgesFromDepth: true,
    });

    // Without its incoming edge `surface` looks like a root and shares the
    // first column with `root`; the graph flattens into two columns.
    expect(positions.get('group:surface')!.x).toBe(0);
    expect(positions.get('group:root')!.x).toBe(0);
    expect(positions.get('group:button')!.x).toBe(laneX(1));
  });

  it('is unchanged when nothing is hidden', () => {
    const { positions } = arrange(groups, connections, ['color', '_global']);

    expect(positions.get('group:prim')!.x).toBe(0);
    expect(positions.get('group:root')!.x).toBe(0);
    expect(positions.get('group:surface')!.x).toBe(laneX(1));
    expect(positions.get('group:button')!.x).toBe(laneX(2));
  });
});

describe('Empty lanes collapse', () => {
  it('leaves no horizontal void where a fully hidden tier used to sit', () => {
    // Every depth-0 card is hidden, so lane 0 holds nothing visible.
    const prim = plain('prim', '_global');
    const surface = plain('surface');
    const button = plain('button');
    const { positions } = arrange(
      [prim, surface, button],
      [link(prim, surface), link(surface, button)],
      ['color']
    );

    // Depths are still 1 and 2, but the lanes renumber contiguously.
    expect(positions.get('group:surface')!.x).toBe(0);
    expect(positions.get('group:button')!.x).toBe(laneX(1));
  });

  it('keeps the relative order of the lanes it renumbers', () => {
    // Depth 0 and depth 1 are both fully hidden; depth 2 and 3 remain.
    const a = plain('a', '_global');
    const b = plain('b', '_global');
    const c = plain('c');
    const d = plain('d');
    const { positions } = arrange(
      [a, b, c, d],
      [link(a, b), link(b, c), link(c, d)],
      ['color']
    );

    expect(positions.get('group:c')!.x).toBe(0);
    expect(positions.get('group:d')!.x).toBe(laneX(1));
  });
});

// ── One tier is one column ─────────────────────────────────────────

describe('A tier stacks in a single column', () => {
  const cardHeight = getGroupHeight(plain('a'));
  const stackStep = cardHeight + GROUP_GAP_Y;

  it('stacks every card of a tier in one column, however many there are', () => {
    const cards = ['a', 'b', 'c', 'd'].map(key => plain(key));
    const { positions } = arrange(cards, [], ['color']);

    cards.forEach((group, index) => {
      expect(positions.get(group.key)).toEqual({ x: 0, y: index * stackStep });
    });
  });

  it('keeps a 29-card tier one column wide and its consumer one step right', () => {
    // The 678-variable file: 29 literal-valued cards at depth 0 that used to
    // wrap into four sub-columns, plus one card at depth 1.
    const palette = Array.from({ length: 29 }, (_, i) =>
      plain(`p${String(i).padStart(2, '0')}`));
    const surface = plain('surface');
    const { positions, tiers } = arrange(
      [...palette, surface],
      [link(palette[0], surface)],
      ['color']
    );

    expect(new Set(palette.map(g => positions.get(g.key)!.x))).toEqual(new Set([0]));
    expect(positions.get('group:surface')!.x).toBe(laneX(1));
    expect(tiers).toEqual([
      { tier: 1, x: 0, width: GROUP_WIDTH },
      { tier: 2, x: COLUMN_STEP, width: GROUP_WIDTH },
    ]);
  });

  it('steps a four-tier chain by one uniform column each time', () => {
    const a = plain('a');
    const b = plain('b');
    const c = plain('c');
    const d = plain('d');
    const { positions, tiers } = arrange(
      [a, b, c, d],
      [link(a, b), link(b, c), link(c, d)],
      ['color']
    );

    // With the stock 260-wide card and gapX of 180.
    expect([a, b, c, d].map(g => positions.get(g.key)!.x)).toEqual([0, 440, 880, 1320]);
    expect(tiers.map(t => t.x)).toEqual([0, 440, 880, 1320]);
    expect(tiers.every(t => t.width === GROUP_WIDTH)).toBe(true);
  });
});

// ── Managed chains occupy fixed lanes ──────────────────────────────

describe('Managed chains hold one row across their fixed lanes', () => {
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

  it('places each chain as one row across three consecutive lanes', () => {
    const groups = [...chain('red'), ...chain('green'), ...chain('blue')];
    const { positions } = arrange(groups, [], ['color']);

    const rowHeight = getGroupHeight(groups[0]) + GROUP_GAP_Y;
    ['red', 'green', 'blue'].forEach(name => {
      const source = positions.get(`source:${name}`)!;
      const shader = positions.get(`shader:${name}`)!;
      const shades = positions.get(`shades:${name}`)!;
      // One horizontal row: same Y, three consecutive lanes.
      expect(shader.y).toBe(source.y);
      expect(shades.y).toBe(source.y);
      expect(source.x).toBe(0);
      expect(shader.x).toBe(laneX(1));
      expect(shades.x).toBe(laneX(2));
    });

    // The chains stack downwards in the same columns.
    expect(positions.get('source:red')!.y).toBe(0);
    expect(positions.get('source:green')!.y).toBe(rowHeight);
    expect(positions.get('source:blue')!.y).toBe(rowHeight * 2);
  });
});

// ── Grid Settings migration ────────────────────────────────────────

describe('normalizeGridLayoutSettings drops the retired column cap', () => {
  it('loads settings persisted while the cap existed, without the dead field', () => {
    const stored = { gapX: 10, gapY: 20, maxColumnHeight: 2400 };
    const settings = normalizeGridLayoutSettings(stored);

    expect(settings).toEqual({ gapX: 10, gapY: 20 });
    expect('maxColumnHeight' in settings).toBe(false);
  });

  it('still defaults the two gaps it does keep', () => {
    expect(normalizeGridLayoutSettings(undefined)).toEqual({
      gapX: GROUP_GAP_X,
      gapY: GROUP_GAP_Y,
    });
    expect(normalizeGridLayoutSettings({ gapX: -1, gapY: 5 })).toEqual({
      gapX: GROUP_GAP_X,
      gapY: 5,
    });
  });

  it('round-trips through the draft the Grid Settings inputs edit', () => {
    const settings = normalizeGridLayoutSettings({ gapX: 1, gapY: 2, maxColumnHeight: 3 });
    expect(toGridLayoutDraft(settings)).toEqual({ gapX: '1', gapY: '2' });
  });
});

// ── Tier captions ──────────────────────────────────────────────────

describe('Tier captions', () => {
  it('numbers the tiers that actually hold something, left to right', () => {
    // Depth 0 is entirely hidden, so it collapses and the visible depth-1
    // cards become the first caption.
    const prim = plain('prim', '_global');
    const surface = plain('surface');
    const button = plain('button');
    const { tiers } = arrange(
      [prim, surface, button],
      [link(prim, surface), link(surface, button)],
      ['color']
    );

    expect(tiers.map(t => t.tier)).toEqual([1, 2]);
    expect(tiers.map(t => t.x)).toEqual([0, laneX(1)]);
    expect(tiers.every(t => t.width === GROUP_WIDTH)).toBe(true);
  });

  it('emits nothing when there is nothing to arrange', () => {
    const { positions, tiers } = arrange([], [], ['color']);
    expect(tiers).toEqual([]);
    expect(positions.size).toBe(0);
  });

  it('leaves no caption entry in the position record Arrange persists', () => {
    const roots = ['a', 'b'].map(key => plain(key));
    const leaf = plain('leaf');
    const { positions, tiers } = arrange([...roots, leaf], [link(roots[0], leaf)], ['color']);

    // Captions live in their own return value and their own id namespace —
    // they are never keys of the map that becomes `savedPositions`.
    expect(tiers.length).toBeGreaterThan(0);
    expect(Array.from(positions.keys()).some(isTierLabelNodeId)).toBe(false);
  });
});

describe('isTierLabelNodeId keeps captions out of the saved positions', () => {
  it('matches caption ids and nothing else', () => {
    expect(isTierLabelNodeId(`${TIER_LABEL_NODE_PREFIX}1`)).toBe(true);
    expect(isTierLabelNodeId(`${TIER_LABEL_NODE_PREFIX}12`)).toBe(true);
    ['group:color/base', 'wrapper:color', 'source:red', 'shades:red',
      'collection:1:2', 'selection:42:7', 'ext-group:lib'].forEach(id => {
      expect(isTierLabelNodeId(id)).toBe(false);
    });
  });

  it('drops captions from the record the drag-save and undo snapshot build', () => {
    // Mirrors both persistence loops in GroupedGraph.tsx: every top-level
    // node's position is recorded except a caption's. A caption that slipped
    // through would be restored on the next hydration as a phantom card and
    // would pollute the persisted record for good.
    const canvasNodes = [
      { id: 'group:a', parentId: undefined, position: { x: 0, y: 0 } },
      { id: `${TIER_LABEL_NODE_PREFIX}1`, parentId: undefined, position: { x: 0, y: -40 } },
      { id: 'group:leaf', parentId: undefined, position: { x: laneX(1), y: 0 } },
      { id: `${TIER_LABEL_NODE_PREFIX}2`, parentId: undefined, position: { x: laneX(1), y: -40 } },
    ];

    const saved: Record<string, { x: number; y: number }> = {};
    canvasNodes.forEach(n => {
      if (n.parentId) return;
      if (isTierLabelNodeId(n.id)) return;
      saved[n.id] = n.position;
    });

    expect(Object.keys(saved).sort()).toEqual(['group:a', 'group:leaf']);
  });
});
