// Collection mode: the stored card order per column (columnOrder.ts).

import { describe, it, expect } from 'vitest';
import {
  getColumnItemKey,
  matchColumnOrders,
  migrateCollectionPositions,
  moveItems,
  orderColumnItems,
  parseColumnOrder,
  writeColumnOrder,
} from '../../../../src/ui/components/Relationships/GroupedGraph/columnOrder';
import type { ColumnOrderRecord } from '../../../../src/ui/components/Relationships/GroupedGraph/columnOrder';
import type { ColumnItem } from '../../../../src/ui/components/Relationships/GroupedGraph/columnLayout';

const CID = 'VariableCollectionId:1:0';

const card = (path: string, extra: Partial<ColumnItem> = {}): ColumnItem => ({
  collectionId: CID,
  path,
  members: [{ id: path === '' ? `collection:${CID}` : `group:${CID}::${path}`, width: 240, height: 100 }],
  ...extra,
});

const frame = (path: string): ColumnItem => ({
  collectionId: CID,
  path,
  members: [{ id: `wrapper:${CID}::${path}`, width: 280, height: 300 }],
});

const chain = (path: string): ColumnItem => ({
  collectionId: CID,
  path,
  members: [
    { id: `source:${path}`, width: 240, height: 100 },
    { id: `shader:${path}`, width: 240, height: 120 },
    { id: `shades:${path}`, width: 240, height: 200 },
  ],
  chain: true,
} as ColumnItem);

const keys = (items: ColumnItem[]) => items.map(getColumnItemKey);

describe('parseColumnOrder', () => {
  it('reads a well-formed record', () => {
    const raw = { v: 1, columns: [{ id: 'c1', name: 'Colors', items: ['path:', 'path:a'] }] };
    expect(parseColumnOrder(raw)).toEqual(raw);
  });

  it('rejects a wrong version, a non-array and malformed entries', () => {
    expect(parseColumnOrder(null)).toBeNull();
    expect(parseColumnOrder([])).toBeNull();
    expect(parseColumnOrder('x')).toBeNull();
    expect(parseColumnOrder({ v: 2, columns: [] })).toBeNull();
    expect(parseColumnOrder({ v: 1, columns: {} })).toBeNull();
    expect(parseColumnOrder({ v: 1, columns: [null] })).toBeNull();
    expect(parseColumnOrder({ v: 1, columns: [{ id: 1, name: 'a', items: [] }] })).toBeNull();
    expect(parseColumnOrder({ v: 1, columns: [{ id: 'c', name: 'a' }] })).toBeNull();
    expect(parseColumnOrder({ v: 1, columns: [{ id: 'c', name: 'a', items: ['path:', 3] }] })).toBeNull();
  });

  it('reads an empty column list as natural everywhere', () => {
    expect(parseColumnOrder({ v: 1, columns: [] })).toEqual({ v: 1, columns: [] });
  });

  it('dedups column ids (first wins) and item keys', () => {
    const parsed = parseColumnOrder({
      v: 1,
      columns: [
        { id: 'c1', name: 'A', items: ['path:a', 'path:b', 'path:a'] },
        { id: 'c1', name: 'B', items: ['path:z'] },
      ],
    });
    expect(parsed).toEqual({ v: 1, columns: [{ id: 'c1', name: 'A', items: ['path:a', 'path:b'] }] });
  });
});

describe('getColumnItemKey', () => {
  it('keys cards, frames and the root by path, chains by source group', () => {
    expect(getColumnItemKey(card('color/brand'))).toBe('path:color/brand');
    expect(getColumnItemKey(card(''))).toBe('path:');
    expect(getColumnItemKey(frame('color'))).toBe('path:color');
    expect(getColumnItemKey(frame(''))).toBe('path:');
    expect(getColumnItemKey(chain('blue'))).toBe('chain:blue');
  });
});

describe('matchColumnOrders', () => {
  const record = (columns: ColumnOrderRecord['columns']): ColumnOrderRecord => ({ v: 1, columns });

  it('matches by id', () => {
    const map = matchColumnOrders(
      [{ id: 'c1', name: 'A' }, { id: 'c2', name: 'B' }],
      record([{ id: 'c2', name: 'B', items: ['path:x'] }])
    );
    expect(map.get('c2')).toEqual(['path:x']);
    expect(map.has('c1')).toBe(false);
  });

  it('falls back to the name after the id changed (undo)', () => {
    const map = matchColumnOrders(
      [{ id: 'new', name: 'Colors' }],
      record([{ id: 'old', name: 'Colors', items: ['path:a'] }])
    );
    expect(map.get('new')).toEqual(['path:a']);
  });

  it('never lets a stale name take a slot matched by id', () => {
    const map = matchColumnOrders(
      [{ id: 'c1', name: 'Colors' }],
      record([
        { id: 'stale', name: 'Colors', items: ['path:stale'] },
        { id: 'c1', name: 'Renamed', items: ['path:own'] },
      ])
    );
    expect(map.get('c1')).toEqual(['path:own']);
    expect(map.size).toBe(1);
  });

  it('with duplicate names the first unclaimed collection wins', () => {
    const map = matchColumnOrders(
      [{ id: 'n1', name: 'Dup' }, { id: 'n2', name: 'Dup' }],
      record([
        { id: 'o1', name: 'Dup', items: ['path:first'] },
        { id: 'o2', name: 'Dup', items: ['path:second'] },
      ])
    );
    expect(map.get('n1')).toEqual(['path:first']);
    expect(map.get('n2')).toEqual(['path:second']);
  });

  it('returns nothing for a null record', () => {
    expect(matchColumnOrders([{ id: 'c1', name: 'A' }], null).size).toBe(0);
  });
});

describe('orderColumnItems', () => {
  const root = card('');
  const a = card('a');
  const b = card('b');
  const c = card('c');

  it('without a stored order uses natural order, empty root last', () => {
    const emptyRoot = card('', { emptyRoot: true });
    expect(keys(orderColumnItems([c, emptyRoot, a, b]))).toEqual(['path:a', 'path:b', 'path:c', 'path:']);
    expect(keys(orderColumnItems([c, b, root, a]))).toEqual(['path:', 'path:a', 'path:b', 'path:c']);
  });

  it('keeps the stored order', () => {
    const stored = ['path:c', 'path:', 'path:a', 'path:b'];
    expect(keys(orderColumnItems([root, a, b, c], stored))).toEqual(stored);
  });

  it('inserts an unknown item after its natural predecessor, else at the front', () => {
    expect(keys(orderColumnItems([a, b, c], ['path:c', 'path:a']))).toEqual(['path:c', 'path:a', 'path:b']);
    expect(keys(orderColumnItems([a, b, c], ['path:c', 'path:b']))).toEqual(['path:a', 'path:c', 'path:b']);
  });

  it('chains consecutive unknown items in natural order', () => {
    const d = card('d');
    const e = card('e');
    // b follows a; d follows c (its nearest natural predecessor), e follows d.
    expect(keys(orderColumnItems([a, b, c, d, e], ['path:c', 'path:a'])))
      .toEqual(['path:c', 'path:d', 'path:e', 'path:a', 'path:b']);
  });

  it('puts an unknown empty root last', () => {
    const emptyRoot = card('', { emptyRoot: true });
    expect(keys(orderColumnItems([emptyRoot, a, b], ['path:b', 'path:a'])))
      .toEqual(['path:b', 'path:a', 'path:']);
  });

  it('keeps a stored empty root where it was moved', () => {
    const emptyRoot = card('', { emptyRoot: true });
    expect(keys(orderColumnItems([emptyRoot, a, b], ['path:', 'path:b', 'path:a'])))
      .toEqual(['path:', 'path:b', 'path:a']);
  });

  it('skips stored keys with no live item', () => {
    expect(keys(orderColumnItems([a, c], ['path:c', 'path:gone', 'path:a']))).toEqual(['path:c', 'path:a']);
  });

  it('a new frame takes the slot of the first card it absorbed', () => {
    const stored = ['path:z', 'path:p/a', 'path:x', 'path:p/b'];
    const items = [card('x'), frame('p'), card('z')];
    expect(keys(orderColumnItems(items, stored))).toEqual(['path:z', 'path:p', 'path:x']);
  });

  it('a frame never claims a deleted slot outside its path', () => {
    const stored = ['path:pq', 'path:z'];
    expect(keys(orderColumnItems([frame('p'), card('z')], stored))).toEqual(['path:p', 'path:z']);
  });

  it('after an ungroup the freed cards follow path:p', () => {
    const stored = ['path:z', 'path:p', 'path:x'];
    const items = [card('p'), card('p/a'), card('p/b'), card('x'), card('z')];
    expect(keys(orderColumnItems(items, stored)))
      .toEqual(['path:z', 'path:p', 'path:p/a', 'path:p/b', 'path:x']);
  });

  it('orders chains by their own key', () => {
    const stored = ['chain:blue', 'path:a'];
    expect(keys(orderColumnItems([a, chain('blue')], stored))).toEqual(['chain:blue', 'path:a']);
  });
});

describe('moveItems', () => {
  const order = ['a', 'b', 'c', 'd'];
  const all = new Set(order);

  it('moves down and up by index among the remaining visible items', () => {
    expect(moveItems(order, all, ['a'], { kind: 'index', index: 2 })).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItems(order, all, ['d'], { kind: 'index', index: 1 })).toEqual(['a', 'd', 'b', 'c']);
  });

  it('above the top goes first, below the bottom goes last', () => {
    expect(moveItems(order, all, ['c'], { kind: 'index', index: -3 })).toEqual(['c', 'a', 'b', 'd']);
    expect(moveItems(order, all, ['b'], { kind: 'index', index: 99 })).toEqual(['a', 'c', 'd', 'b']);
  });

  it('returns the same array when nothing changes', () => {
    expect(moveItems(order, all, ['b'], { kind: 'index', index: 1 })).toBe(order);
    expect(moveItems(order, all, ['d'], { kind: 'index', index: 3 })).toBe(order);
    expect(moveItems(order, all, ['zz'], { kind: 'index', index: 0 })).toBe(order);
    expect(moveItems(order, all, [], { kind: 'step', delta: 1 })).toBe(order);
  });

  it('moves a multi-selection as one contiguous block in relative order', () => {
    expect(moveItems(order, all, ['c', 'a'], { kind: 'index', index: 2 })).toEqual(['b', 'd', 'a', 'c']);
    expect(moveItems(order, all, ['d', 'b'], { kind: 'index', index: 0 })).toEqual(['b', 'd', 'a', 'c']);
  });

  it('hidden keys keep their places', () => {
    const withHidden = ['a', 'h1', 'b', 'c', 'h2'];
    const visible = new Set(['a', 'b', 'c']);
    expect(moveItems(withHidden, visible, ['c'], { kind: 'index', index: 0 })).toEqual(['c', 'a', 'h1', 'b', 'h2']);
    expect(moveItems(withHidden, visible, ['a'], { kind: 'index', index: 99 })).toEqual(['h1', 'b', 'c', 'a', 'h2']);
    // Visible order unchanged → same array, hidden keys untouched.
    expect(moveItems(withHidden, visible, ['b'], { kind: 'index', index: 1 })).toBe(withHidden);
  });

  it('a step moves one visible slot, skipping hidden keys', () => {
    const withHidden = ['a', 'h1', 'h2', 'b', 'c'];
    const visible = new Set(['a', 'b', 'c']);
    expect(moveItems(withHidden, visible, ['a'], { kind: 'step', delta: 1 })).toEqual(['h1', 'h2', 'b', 'a', 'c']);
    expect(moveItems(withHidden, visible, ['b'], { kind: 'step', delta: -1 })).toEqual(['b', 'a', 'h1', 'h2', 'c']);
    expect(moveItems(order, all, ['b'], { kind: 'step', delta: 1 })).toEqual(['a', 'c', 'b', 'd']);
  });

  it('a step at either end changes nothing', () => {
    expect(moveItems(order, all, ['a'], { kind: 'step', delta: -1 })).toBe(order);
    expect(moveItems(order, all, ['d'], { kind: 'step', delta: 1 })).toBe(order);
    const trailingHidden = ['a', 'b', 'h'];
    expect(moveItems(trailingHidden, new Set(['a', 'b']), ['b'], { kind: 'step', delta: 1 })).toBe(trailingHidden);
  });
});

describe('writeColumnOrder', () => {
  const record: ColumnOrderRecord = {
    v: 1,
    columns: [
      { id: 'old', name: 'Colors', items: ['path:a', 'path:gone', 'path:b'] },
      { id: 'c2', name: 'Spacing', items: ['path:x'] },
    ],
  };

  it('refreshes id and name, stores the resolved (pruned) order, passes others through', () => {
    const next = writeColumnOrder(record, { id: 'new', name: 'Colors' }, ['path:b', 'path:a'], [
      { id: 'new', name: 'Colors' }, { id: 'c2', name: 'Spacing' },
    ]);
    expect(next).toEqual({
      v: 1,
      columns: [
        { id: 'new', name: 'Colors', items: ['path:b', 'path:a'] },
        { id: 'c2', name: 'Spacing', items: ['path:x'] },
      ],
    });
    expect(next.columns[1]).toBe(record.columns[1]);
    expect(record.columns[0].id).toBe('old');
  });

  it('matches by id before name and renames', () => {
    const next = writeColumnOrder(record, { id: 'c2', name: 'Space' }, ['path:y'], [{ id: 'c2', name: 'Space' }]);
    expect(next.columns[1]).toEqual({ id: 'c2', name: 'Space', items: ['path:y'] });
    expect(next.columns[0]).toBe(record.columns[0]);
  });

  it('two live collections named alike: a write never takes the other one\'s entry', () => {
    const live = [{ id: 'k1', name: 'colors' }, { id: 'k2', name: 'colors' }];
    const shared: ColumnOrderRecord = { v: 1, columns: [{ id: 'k1', name: 'colors', items: ['path:a', 'path:b'] }] };
    const next = writeColumnOrder(shared, live[1], ['path:y', 'path:x'], live);
    expect(next.columns).toEqual([
      { id: 'k1', name: 'colors', items: ['path:a', 'path:b'] },
      { id: 'k2', name: 'colors', items: ['path:y', 'path:x'] },
    ]);
    expect(matchColumnOrders(live, next).get('k1')).toEqual(['path:a', 'path:b']);
  });

  it('a stale entry goes to the collection matchColumnOrders gives it, and only that one', () => {
    // After an undo both ids are new: the stale entry belongs to the first `colors`.
    const live = [{ id: 'n1', name: 'colors' }, { id: 'n2', name: 'colors' }];
    const stale: ColumnOrderRecord = { v: 1, columns: [{ id: 'k1', name: 'colors', items: ['path:a'] }] };
    expect(writeColumnOrder(stale, live[1], ['path:z'], live).columns).toEqual([
      { id: 'k1', name: 'colors', items: ['path:a'] },
      { id: 'n2', name: 'colors', items: ['path:z'] },
    ]);
    expect(writeColumnOrder(stale, live[0], ['path:b'], live).columns).toEqual([
      { id: 'n1', name: 'colors', items: ['path:b'] },
    ]);
  });

  it('adds a column and starts from a null record', () => {
    expect(writeColumnOrder(record, { id: 'c3', name: 'Radius' }, ['path:'], [{ id: 'c3', name: 'Radius' }]).columns).toHaveLength(3);
    expect(writeColumnOrder(null, { id: 'c1', name: 'A' }, ['path:a'], [{ id: 'c1', name: 'A' }])).toEqual({
      v: 1,
      columns: [{ id: 'c1', name: 'A', items: ['path:a'] }],
    });
  });
});

describe('migrateCollectionPositions', () => {
  const a = card('a');
  const b = card('b');
  const c = card('c');
  const items = [a, b, c];
  const natural = new Map([
    [a.members[0].id, { x: 0, y: 0 }],
    [b.members[0].id, { x: 0, y: 140 }],
    [c.members[0].id, { x: 0, y: 280 }],
  ]);
  const column = { collection: { id: CID, name: 'Colors' }, items, natural };

  it('turns stored y into an order', () => {
    const legacy = {
      [a.members[0].id]: { x: 0, y: 500 },
      [b.members[0].id]: { x: 0, y: 10 },
      [c.members[0].id]: { x: 0, y: 200 },
    };
    const { order } = migrateCollectionPositions(legacy, [column]);
    expect(order).toEqual({ v: 1, columns: [{ id: CID, name: 'Colors', items: ['path:b', 'path:c', 'path:a'] }] });
  });

  it('breaks ties in natural order', () => {
    const legacy = {
      [c.members[0].id]: { x: 0, y: 0 },
      [b.members[0].id]: { x: 0, y: 0 },
    };
    const { order } = migrateCollectionPositions(legacy, [column]);
    expect(order?.columns[0].items).toEqual(['path:a', 'path:b', 'path:c']);
  });

  it('unstored items use their natural y', () => {
    const legacy = { [a.members[0].id]: { x: 0, y: 200 } };
    const { order } = migrateCollectionPositions(legacy, [column]);
    expect(order?.columns[0].items).toEqual(['path:b', 'path:a', 'path:c']);
  });

  it('reads a chain by any lane and a frame by its node id', () => {
    const blue = chain('blue');
    const p = frame('p');
    const mixed = {
      collection: { id: CID, name: 'Colors' },
      items: [a, p, blue],
      natural: new Map([
        [a.members[0].id, { x: 0, y: 0 }],
        [p.members[0].id, { x: 0, y: 140 }],
        ['source:blue', { x: 0, y: 480 }],
      ]),
    };
    const legacy = {
      'shader:blue': { x: 300, y: -50 },
      [p.members[0].id]: { x: 0, y: 900 },
    };
    const { order } = migrateCollectionPositions(legacy, [mixed]);
    expect(order?.columns[0].items).toEqual(['chain:blue', 'path:a', 'path:p']);
  });

  it('keeps free nodes and strips column members and absorbed ids', () => {
    const legacy = {
      [a.members[0].id]: { x: 0, y: 10 },
      [`group:${CID}::p/inner`]: { x: 0, y: 20 },
      'ext-group:lib': { x: 900, y: 40 },
      'selection:1': { x: 1200, y: 0 },
    };
    const { free } = migrateCollectionPositions(legacy, [{ ...column, absorbedIds: [`group:${CID}::p/inner`] }]);
    expect(free).toEqual({ 'ext-group:lib': { x: 900, y: 40 }, 'selection:1': { x: 1200, y: 0 } });
  });

  it('nothing stored gives no order and only columns with a stored y get an entry', () => {
    const free = { 'ext-group:lib': { x: 1, y: 2 } };
    expect(migrateCollectionPositions(free, [column])).toEqual({ order: null, free });
    expect(migrateCollectionPositions(null, [column])).toEqual({ order: null, free: {} });

    const other = { collection: { id: 'c2', name: 'Spacing' }, items: [card('s')], natural: new Map() };
    const { order } = migrateCollectionPositions({ [b.members[0].id]: { x: 0, y: -1 } }, [column, other]);
    expect(order?.columns.map(entry => entry.id)).toEqual([CID]);
  });
});
