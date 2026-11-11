// Collection mode: one column per collection (columnLayout.ts).

import { describe, it, expect } from 'vitest';
import type { NodeChange } from '@xyflow/react';
import {
  buildCollectionColumnItems,
  layoutCollectionColumns,
  packCollectionColumns,
  lockChangesToColumns,
} from '../../../../src/ui/components/Relationships/GroupedGraph/columnLayout';
import type { ColumnItem, CollectionColumn } from '../../../../src/ui/components/Relationships/GroupedGraph/columnLayout';
import { compareGroupPaths } from '../../../../src/ui/utils/groupFilters';
import type { GroupData, VariableNode } from '../../../../src/ui/components/Relationships/GroupedGraph/types';

const gapX = 100;
const gapY = 20;
const order = ['_global', 'color', 'typography'];

const card = (collectionId: string, path: string, over: Partial<ColumnItem> & { width?: number; height?: number; hidden?: boolean } = {}): ColumnItem => ({
  collectionId,
  path,
  members: [{
    id: `${collectionId}::${path}`,
    width: over.width ?? 260,
    height: over.height ?? 100,
    hidden: over.hidden,
  }],
  emptyRoot: over.emptyRoot,
});

const chain = (collectionId: string, path: string, heights = [60, 60, 200]): ColumnItem => ({
  collectionId,
  path,
  chain: true,
  members: heights.map((height, index) => ({ id: `${['source', 'shader', 'shades'][index]}:${path}`, width: 260, height })),
});

const layout = (items: ColumnItem[], collectionOrder = order) =>
  layoutCollectionColumns({ items, collectionOrder, gapX, gapY });

describe('layoutCollectionColumns', () => {
  it('one column per collection, in collection order, x = running width + gapX', () => {
    const { columns, positions, maxRight } = layout([
      card('typography', 'font'), card('color', 'brand'), card('_global', 'base'),
    ]);
    expect(columns).toEqual([
      { collectionId: '_global', x: 0, width: 260 },
      { collectionId: 'color', x: 360, width: 260 },
      { collectionId: 'typography', x: 720, width: 260 },
    ]);
    expect(positions.get('typography::font')).toEqual({ x: 720, y: 0 });
    expect(maxRight).toBe(980);
  });

  it('a column is as wide as its widest visible unit (a frame widens only its own column)', () => {
    const { columns } = layout([
      card('_global', 'a'), card('_global', 'frame', { width: 312 }), card('color', 'b'),
    ]);
    expect(columns.map(c => c.width)).toEqual([312, 260]);
    expect(columns[1].x).toBe(312 + gapX);
  });

  it('a managed chain is one horizontal line that widens its column', () => {
    const { columns, positions } = layout([chain('color', 'brand/500'), card('color', 'brand'), card('typography', 'font')]);
    expect(columns[0].width).toBe(3 * 260 + 2 * gapX);
    // The chain sits at its source's path slot: after the `brand` card.
    expect(positions.get('color::brand')).toEqual({ x: 0, y: 0 });
    expect(positions.get('source:brand/500')).toEqual({ x: 0, y: 120 });
    expect(positions.get('shader:brand/500')).toEqual({ x: 360, y: 120 });
    expect(positions.get('shades:brand/500')).toEqual({ x: 720, y: 120 });
    expect(positions.get('typography::font')!.x).toBe(columns[0].width + gapX);
  });

  it('stacks by the sidebar tree order, not a whole-string compare (badge/color before badge-x)', () => {
    const paths = ['badge-x', 'badge/color', 'badge', 'alpha'];
    const { positions } = layout(paths.map(path => card('color', path, { height: 10 })));
    const ys = paths.map(path => positions.get(`color::${path}`)!.y);
    const stacked = paths.slice().sort((a, b) => ys[paths.indexOf(a)] - ys[paths.indexOf(b)]);
    expect(stacked).toEqual(['alpha', 'badge', 'badge/color', 'badge-x']);
    expect(stacked).toEqual(paths.slice().sort(compareGroupPaths));
    // The whole-string order would differ.
    expect(paths.slice().sort((a, b) => a.localeCompare(b))).not.toEqual(stacked);
  });

  it('root card first, the empty root card last', () => {
    const { positions } = layout([
      card('color', 'b', { height: 10 }), card('color', '', { height: 10, emptyRoot: true }), card('color', 'a', { height: 10 }),
    ]);
    expect(positions.get('color::a')!.y).toBe(0);
    expect(positions.get('color::b')!.y).toBe(30);
    expect(positions.get('color::')!.y).toBe(60);
    const withRows = layout([card('color', 'a', { height: 10 }), card('color', '', { height: 10 })]);
    expect(withRows.positions.get('color::')!.y).toBe(0);
  });

  it('every column starts at y 0 with gapY between units', () => {
    const { positions } = layout([
      card('_global', 'a', { height: 50 }), card('_global', 'b', { height: 70 }), card('_global', 'c'), card('color', 'x'),
    ]);
    expect(['a', 'b', 'c'].map(p => positions.get(`_global::${p}`)!.y)).toEqual([0, 70, 160]);
    expect(positions.get('color::x')!.y).toBe(0);
  });

  it('hidden units take no room and get no position', () => {
    const { positions } = layout([card('_global', 'a', { hidden: true }), card('_global', 'b')]);
    expect(positions.has('_global::a')).toBe(false);
    expect(positions.get('_global::b')!.y).toBe(0);
  });

  it('a fully hidden collection collapses: no column, no gap', () => {
    const { columns, positions } = layout([
      card('_global', 'a', { hidden: true }), card('color', 'b'), card('typography', 'c'),
    ]);
    expect(columns.map(c => c.collectionId)).toEqual(['color', 'typography']);
    expect(positions.get('color::b')!.x).toBe(0);
    expect(positions.get('typography::c')!.x).toBe(360);
  });

  it('a hidden lane of a chain keeps its slot on the line', () => {
    const item = chain('color', 'p');
    item.members[1].hidden = true;
    const { positions } = layout([item]);
    expect(positions.has('shader:p')).toBe(false);
    expect(positions.get('shades:p')!.x).toBe(720);
  });

  it('is deterministic under shuffled input; unknown collections go last, by id', () => {
    const items = [card('zzz', 'q'), card('color', 'b'), card('aaa', 'q'), card('_global', 'a'), card('color', 'a')];
    const one = layout(items);
    const two = layout(items.slice().reverse());
    expect(Array.from(two.positions.entries()).sort()).toEqual(Array.from(one.positions.entries()).sort());
    expect(one.columns.map(c => c.collectionId)).toEqual(['_global', 'color', 'aaa', 'zzz']);
  });

  it('no visible units: no columns, maxRight 0', () => {
    expect(layout([])).toEqual({ positions: new Map(), columns: [], maxRight: 0 });
  });
});

describe('packCollectionColumns', () => {
  const columns: CollectionColumn[] = [{ collectionId: 'color', x: 360, width: 260 }];
  const pack = (items: ColumnItem[], stored?: string[], cols = columns) =>
    packCollectionColumns(items, cols, new Map(stored ? [['color', stored]] : []), gapX, gapY);
  const ys = (positions: Map<string, { x: number; y: number }>, ids: string[]) => ids.map(id => positions.get(id)?.y);

  it('stacks in stored order from y 0 with exactly gapY, at the column x', () => {
    const items = [card('color', 'a', { height: 50 }), card('color', 'b', { height: 70 }), card('color', 'c', { height: 30 })];
    const positions = pack(items, ['path:c', 'path:a', 'path:b']);
    expect(ys(positions, ['color::c', 'color::a', 'color::b'])).toEqual([0, 30 + gapY, 30 + 50 + 2 * gapY]);
    expect(positions.get('color::a')!.x).toBe(360);
  });

  it('hidden items keep their slot but take no room and get no position', () => {
    const items = [card('color', 'a', { height: 50 }), card('color', 'b', { height: 70, hidden: true }), card('color', 'c', { height: 30 })];
    const positions = pack(items, ['path:b', 'path:c', 'path:a']);
    expect(positions.has('color::b')).toBe(false);
    expect(ys(positions, ['color::c', 'color::a'])).toEqual([0, 30 + gapY]);
  });

  it('a chain line is as tall as its tallest visible lane; lanes at gapX steps', () => {
    const items = [chain('color', 'brand/500', [60, 300, 200]), card('color', 'z', { height: 40 })];
    items[0].members[1].hidden = true;
    const positions = pack(items, ['chain:brand/500', 'path:z']);
    expect(positions.get('source:brand/500')).toEqual({ x: 360, y: 0 });
    expect(positions.has('shader:brand/500')).toBe(false);
    expect(positions.get('shades:brand/500')).toEqual({ x: 360 + 2 * (260 + gapX), y: 0 });
    // Tallest VISIBLE lane is 200 (the hidden 300 takes no room).
    expect(positions.get('color::z')!.y).toBe(200 + gapY);
  });

  it('a frame is one block of its measured height; nothing inside it is placed here', () => {
    const groups: GroupData[] = [
      { key: 'group:color::f/a', title: 'a', variables: [], x: 0, y: 0, initialX: 0, initialY: 0, kind: 'standard', sourceGroupName: 'f/a', headerFill: '#222', collectionId: 'color' },
      { key: 'group:color::f/b', title: 'b', variables: [], x: 0, y: 0, initialX: 0, initialY: 0, kind: 'standard', sourceGroupName: 'f/b', headerFill: '#222', collectionId: 'color' },
      { key: 'group:color::z', title: 'z', variables: [], x: 0, y: 0, initialX: 0, initialY: 0, kind: 'standard', sourceGroupName: 'z', headerFill: '#222', collectionId: 'color' },
    ];
    const items = buildCollectionColumnItems(groups, new Set(['color::f']), () => false);
    const frame = items.find(item => item.members[0].id === 'wrapper:color::f')!;
    const positions = pack(items, ['path:f', 'path:z']);
    expect(positions.get('wrapper:color::f')!.y).toBe(0);
    expect(positions.has('group:color::f/a')).toBe(false);
    expect(positions.get('group:color::z')!.y).toBe(frame.members[0].height + gapY);
    // Hiding one card shrinks the block; the next unit moves up by exactly that.
    const shrunk = buildCollectionColumnItems(groups, new Set(['color::f']), g => g.key === 'group:color::f/a');
    const smaller = shrunk.find(item => item.members[0].id === 'wrapper:color::f')!.members[0].height;
    expect(smaller).toBeLessThan(frame.members[0].height);
    expect(pack(shrunk, ['path:f', 'path:z']).get('group:color::z')!.y).toBe(smaller + gapY);
  });

  it('only the listed columns are packed; other columns keep natural order', () => {
    const items = [card('color', 'a', { height: 10 }), card('color', 'b', { height: 10 }), card('size', 'a', { height: 10 }), card('size', 'b', { height: 10 })];
    const cols: CollectionColumn[] = [{ collectionId: 'color', x: 0, width: 260 }, { collectionId: 'size', x: 360, width: 260 }];
    const positions = pack(items, ['path:b', 'path:a'], cols);
    expect(ys(positions, ['color::b', 'color::a'])).toEqual([0, 30]);
    expect(ys(positions, ['size::a', 'size::b'])).toEqual([0, 30]);
  });

  it('natural layout == packing with an empty record, for every column', () => {
    const items = [
      card('color', 'b', { height: 40 }), card('color', '', { height: 10, emptyRoot: true }), chain('color', 'b/500'),
      card('color', 'a', { height: 30, hidden: true }), card('color', 'badge-x'), card('color', 'badge/color'),
      card('_global', 'base', { height: 70 }), card('typography', 'font', { width: 312 }),
    ];
    const natural = layout(items);
    expect(packCollectionColumns(items, natural.columns, new Map(), gapX, gapY)).toEqual(natural.positions);
    const empty = new Map(natural.columns.map(c => [c.collectionId, [] as string[]]));
    expect(packCollectionColumns(items, natural.columns, empty, gapX, gapY)).toEqual(natural.positions);
  });
});

describe('lockChangesToColumns', () => {
  const locked = new Map([['a', 360]]);

  it('locked ids get their column x back, y untouched', () => {
    const changes: NodeChange[] = [{
      id: 'a', type: 'position', position: { x: 500, y: 77 }, positionAbsolute: { x: 500, y: 77 }, dragging: true,
    }];
    expect(lockChangesToColumns(changes, locked)).toEqual([{
      id: 'a', type: 'position', position: { x: 360, y: 77 }, positionAbsolute: { x: 360, y: 77 }, dragging: true,
    }]);
  });

  it('other ids and other change types pass through untouched', () => {
    const changes: NodeChange[] = [
      { id: 'ext', type: 'position', position: { x: 500, y: 77 } },
      { id: 'a', type: 'select', selected: true },
      { id: 'a', type: 'position', dragging: false },
    ];
    const out = lockChangesToColumns(changes, locked);
    expect(out[0]).toBe(changes[0]);
    expect(out[1]).toBe(changes[1]);
    expect(out[2]).toEqual({ id: 'a', type: 'position', dragging: false });
  });

  it('an empty map (Tier mode) is the identity', () => {
    const changes: NodeChange[] = [{ id: 'a', type: 'position', position: { x: 1, y: 2 } }];
    expect(lockChangesToColumns(changes, new Map())).toBe(changes);
  });
});

describe('buildCollectionColumnItems', () => {
  const rows = (n: number): VariableNode[] => Array.from({ length: n }, (_, i) => ({
    id: `v${i}`, name: `x/${i}`, shortName: `${i}`, displayName: '', color: '#fff',
    value: '', resolvedValue: '', isReference: false, referenceName: null,
  }));
  const g = (key: string, collectionId: string, kind: GroupData['kind'], path: string | undefined, n = 1): GroupData => ({
    key, title: key, variables: rows(n), x: 0, y: 0, initialX: 0, initialY: 0,
    kind, ...(path !== undefined ? { sourceGroupName: path } : {}), headerFill: '#222', collectionId,
  });
  const groups = [
    g('collection:c1', 'c1', 'collection', undefined, 0),
    g('group:c1::a', 'c1', 'standard', 'a'),
    g('group:c1::b/x', 'c1', 'standard', 'b/x'),
    g('group:c1::b/y', 'c1', 'standard', 'b/y'),
    g('source:s', 'c1', 'source', 'brand/500'),
    g('shades:s', 'c1', 'shades', 'brand/500', 5),
    g('shader:s', 'c1', 'shader', 'brand/500'),
  ];

  it('loose cards, one frame per grouped path, the empty root flagged, a chain as one ordered line', () => {
    const items = buildCollectionColumnItems(groups, new Set(['c1::b']), group => group.key === 'group:c1::b/x');
    const byId = new Map(items.map(item => [item.members[0].id, item]));
    expect(byId.get('collection:c1')).toMatchObject({ path: '', emptyRoot: true });
    expect(byId.get('group:c1::a')).toMatchObject({ path: 'a' });
    const frame = byId.get('wrapper:c1::b')!;
    expect(frame.path).toBe('b');
    // One visible card is enough to keep the frame; it is frame-wide.
    expect(frame.members[0].hidden).toBe(false);
    expect(frame.members[0].width).toBeGreaterThan(260);
    expect(byId.get('source:s')!.members.map(m => m.id)).toEqual(['source:s', 'shader:s', 'shades:s']);
    expect(byId.get('source:s')!.path).toBe('brand/500');
    expect(items.length).toBe(4);
  });

  it('a frame is hidden only when every card in it is', () => {
    const items = buildCollectionColumnItems(groups, new Set(['c1::b']), group => group.key.startsWith('group:c1::b/'));
    expect(items.find(item => item.members[0].id === 'wrapper:c1::b')!.members[0].hidden).toBe(true);
  });
});
