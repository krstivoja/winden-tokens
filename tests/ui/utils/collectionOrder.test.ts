import { describe, it, expect } from 'vitest';
import {
  buildCollectionOrder,
  moveCollectionId,
  parseCollectionOrder,
  resolveCollectionOrder,
  sortVariablesByCollectionOrder,
} from '../../../src/ui/utils/collectionOrder';
import type { StoredCollectionOrder } from '../../../src/ui/types';

const c = (id: string, name: string) => ({ id, name });
const order = (...entries: Array<[string, string]>): StoredCollectionOrder => ({
  v: 1,
  entries: entries.map(([id, name]) => ({ id, name })),
});
const names = (list: { name: string }[]) => list.map(item => item.name);

describe('parseCollectionOrder', () => {
  it('accepts a valid v1 order', () => {
    expect(parseCollectionOrder({ v: 1, entries: [{ id: 'a', name: 'A' }] })).toEqual(order(['a', 'A']));
  });

  it('returns null for other versions, strings and bad shapes', () => {
    expect(parseCollectionOrder({ v: 2, entries: [] })).toBeNull();
    expect(parseCollectionOrder('{"v":1,"entries":[]}')).toBeNull();
    expect(parseCollectionOrder(null)).toBeNull();
    expect(parseCollectionOrder(undefined)).toBeNull();
    expect(parseCollectionOrder([])).toBeNull();
    expect(parseCollectionOrder({ v: 1 })).toBeNull();
    expect(parseCollectionOrder({ v: 1, entries: {} })).toBeNull();
  });

  it('rejects the whole value when any entry is malformed (matches the sandbox)', () => {
    for (const bad of [{ id: 1, name: 'A' }, { id: 'b' }, { name: 'B' }, null, 'x', ['a', 'A']]) {
      expect(parseCollectionOrder({ v: 1, entries: [{ id: 'a', name: 'A' }, bad] })).toBeNull();
      expect(parseCollectionOrder({ v: 1, entries: [bad, { id: 'a', name: 'A' }] })).toBeNull();
    }
  });

  it('rejects a malformed entry even after a duplicate id', () => {
    expect(parseCollectionOrder({
      v: 1,
      entries: [{ id: 'a', name: 'A' }, { id: 'a', name: 'A2' }, { id: 'b', name: 2 }],
    })).toBeNull();
  });

  it('accepts an empty entry list', () => {
    expect(parseCollectionOrder({ v: 1, entries: [] })).toEqual(order());
  });

  it('deduplicates ids, first wins', () => {
    expect(parseCollectionOrder({
      v: 1,
      entries: [{ id: 'a', name: 'A' }, { id: 'a', name: 'A2' }, { id: 'b', name: 'B' }],
    })).toEqual(order(['a', 'A'], ['b', 'B']));
  });

  it('caps the list at 1000 unique entries', () => {
    const entries = Array.from({ length: 1200 }, (_, i) => ({ id: `id${i}`, name: `n${i}` }));
    const parsed = parseCollectionOrder({ v: 1, entries });
    expect(parsed?.entries.length).toBe(1000);
    expect(parsed?.entries[999].id).toBe('id999');
  });

  it('counts the cap after deduplication', () => {
    const entries = [{ id: 'id0', name: 'dup' }].concat(
      Array.from({ length: 1200 }, (_, i) => ({ id: `id${i}`, name: `n${i}` }))
    );
    const parsed = parseCollectionOrder({ v: 1, entries });
    expect(parsed?.entries.length).toBe(1000);
    expect(parsed?.entries[0]).toEqual({ id: 'id0', name: 'dup' });
    expect(parsed?.entries[999].id).toBe('id999');
  });

  it('ignores entries past the cap, like the sandbox', () => {
    const entries: unknown[] = Array.from({ length: 1000 }, (_, i) => ({ id: `id${i}`, name: `n${i}` }));
    entries.push({ id: 7 });
    expect(parseCollectionOrder({ v: 1, entries })?.entries.length).toBe(1000);
  });
});

describe('resolveCollectionOrder', () => {
  const api = [c('1', 'global'), c('2', 'color'), c('3', 'components'), c('4', 'dimensions')];

  it('keeps API order (same array) without a stored order', () => {
    expect(resolveCollectionOrder(api, null)).toBe(api);
    expect(resolveCollectionOrder(api, order())).toBe(api);
  });

  it('applies the stored order', () => {
    const stored = order(['1', 'global'], ['2', 'color'], ['4', 'dimensions'], ['3', 'components']);
    expect(names(resolveCollectionOrder(api, stored))).toEqual(['global', 'color', 'dimensions', 'components']);
  });

  it('appends new and unknown collections in API order', () => {
    const stored = order(['4', 'dimensions'], ['1', 'global']);
    expect(names(resolveCollectionOrder(api, stored))).toEqual(['dimensions', 'global', 'color', 'components']);
  });

  it('skips deleted collections', () => {
    const stored = order(['9', 'gone'], ['4', 'dimensions'], ['3', 'components']);
    expect(names(resolveCollectionOrder(api, stored))).toEqual(['dimensions', 'components', 'global', 'color']);
  });

  it('keeps the slot of a renamed collection', () => {
    const renamed = [c('1', 'global'), c('2', 'colors'), c('3', 'components')];
    const stored = order(['3', 'components'], ['2', 'color'], ['1', 'global']);
    expect(names(resolveCollectionOrder(renamed, stored))).toEqual(['components', 'colors', 'global']);
  });

  it('keeps the order when undo recreated every id with the same names', () => {
    const recreated = [c('11', 'global'), c('12', 'color'), c('13', 'components'), c('14', 'dimensions')];
    const stored = order(['4', 'dimensions'], ['2', 'color'], ['1', 'global'], ['3', 'components']);
    expect(names(resolveCollectionOrder(recreated, stored))).toEqual(['dimensions', 'color', 'global', 'components']);
  });

  it('resolves duplicate names in API order', () => {
    const dupes = [c('a', 'x'), c('b', 'x'), c('c', 'y')];
    const stored = order(['old-y', 'y'], ['old-x1', 'x'], ['old-x2', 'x']);
    expect(resolveCollectionOrder(dupes, stored).map(item => item.id)).toEqual(['c', 'a', 'b']);
  });

  it('never lets a stale entry steal an id-matched slot', () => {
    const live = [c('1', 'global'), c('2', 'color')];
    // A deleted 'color' (id 9) is listed first; the live 'color' (id 2) is matched by id later.
    const stored = order(['9', 'color'], ['1', 'global'], ['2', 'color']);
    expect(resolveCollectionOrder(live, stored).map(item => item.id)).toEqual(['1', '2']);
  });

  it('returns [] for no collections', () => {
    expect(resolveCollectionOrder([], order(['1', 'global']))).toEqual([]);
  });
});

describe('moveCollectionId', () => {
  const ids = ['a', 'b', 'c', 'd'];

  it('moves before and after a target', () => {
    expect(moveCollectionId(ids, 'd', 'b', 'before')).toEqual(['a', 'd', 'b', 'c']);
    expect(moveCollectionId(ids, 'a', 'c', 'after')).toEqual(['b', 'c', 'a', 'd']);
    expect(moveCollectionId(ids, 'c', 'a', 'before')).toEqual(['c', 'a', 'b', 'd']);
    expect(moveCollectionId(ids, 'b', 'd', 'after')).toEqual(['a', 'c', 'd', 'b']);
  });

  it('returns the same array when nothing changes', () => {
    expect(moveCollectionId(ids, 'b', 'b', 'before')).toBe(ids);
    expect(moveCollectionId(ids, 'b', 'b', 'after')).toBe(ids);
    expect(moveCollectionId(ids, 'b', 'c', 'before')).toBe(ids);
    expect(moveCollectionId(ids, 'c', 'b', 'after')).toBe(ids);
  });

  it('is a no-op for unknown ids', () => {
    expect(moveCollectionId(ids, 'x', 'b', 'before')).toBe(ids);
    expect(moveCollectionId(ids, 'a', 'x', 'after')).toBe(ids);
  });

  it('does not mutate the input', () => {
    const copy = [...ids];
    moveCollectionId(copy, 'a', 'd', 'after');
    expect(copy).toEqual(ids);
  });
});

describe('sortVariablesByCollectionOrder', () => {
  it('groups by collection rank and stays stable within a collection', () => {
    const vars = [
      { id: 'v1', collectionId: 'A' },
      { id: 'v2', collectionId: 'B' },
      { id: 'v3', collectionId: 'A' },
      { id: 'v4', collectionId: 'Z' },
      { id: 'v5', collectionId: 'B' },
    ];
    const sorted = sortVariablesByCollectionOrder(vars, [{ id: 'B' }, { id: 'A' }]);
    expect(sorted.map(v => v.id)).toEqual(['v2', 'v5', 'v1', 'v3', 'v4']);
    expect(vars.map(v => v.id)).toEqual(['v1', 'v2', 'v3', 'v4', 'v5']);
  });
});

describe('buildCollectionOrder', () => {
  it('builds a v1 order with id and name only', () => {
    const built = buildCollectionOrder([
      { id: '2', name: 'color', modes: [] } as { id: string; name: string },
      c('1', 'global'),
    ]);
    expect(built).toEqual(order(['2', 'color'], ['1', 'global']));
    expect(Object.keys(built.entries[0])).toEqual(['id', 'name']);
  });
});
