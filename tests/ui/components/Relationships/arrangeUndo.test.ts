// Undo Arrange restores the SAVED record, not the live node positions.
//
// The bug: Arrange with a filter on → Undo → lift the filter → the frame the
// filter had shrunk grows back into the frame stacked under it.

import { describe, it, expect } from 'vitest';
import { buildWrapperLayout } from '../../../../src/ui/components/Relationships/GroupedGraph/wrapperLayout';
import type { Placement, WrapperPlacement } from '../../../../src/ui/components/Relationships/GroupedGraph/wrapperLayout';
import {
  takeArrangeSnapshot,
  restoreArrangeSnapshot,
} from '../../../../src/ui/components/Relationships/GroupedGraph/arrangeUndo';
import type { GroupData, VariableNode } from '../../../../src/ui/components/Relationships/GroupedGraph/types';

const rows = (n: number): VariableNode[] => Array.from({ length: n }, (_, i) => ({
  id: `v${i}`, name: `x/${i}`, shortName: `${i}`, displayName: '', color: '#fff',
  value: '', resolvedValue: '', isReference: false, referenceName: null,
}));

// Two collection frames, both primitives in column 0: c1 (cards a, b) above
// c2 (card x), as the default layout's initial positions put them.
const card = (collectionId: string, path: string, initialY: number): GroupData => ({
  key: `group:${collectionId}::${path}`, title: path, variables: rows(2),
  x: 0, y: 0, initialX: 0, initialY,
  kind: 'standard', sourceGroupName: path, headerFill: '#222', collectionId,
});
const cards = [card('c1', 'a', 0), card('c1', 'b', 156), card('c2', 'x', 312)];
const frames = new Set(['c1::', 'c2::']);
const filtered = new Set(['group:c1::a']);

const frame = (placements: Placement[], id: string) =>
  placements.find(p => p.id === id) as WrapperPlacement;

const overlaps = (placements: Placement[]) => {
  const one = frame(placements, 'wrapper:c1::');
  const two = frame(placements, 'wrapper:c2::');
  return two.position.y < one.position.y + one.height;
};

// Arrange's own result is irrelevant here — any saved record will do.
const arranged = { 'wrapper:c1::': { x: 0, y: 0 }, 'wrapper:c2::': { x: 500, y: 0 } };

describe('Arrange → Undo with a filter on, then lift the filter', () => {
  it('the natural layout itself never overlaps, filtered or not', () => {
    expect(overlaps(buildWrapperLayout(cards, frames, {}, filtered))).toBe(false);
    expect(overlaps(buildWrapperLayout(cards, frames, {}, new Set()))).toBe(false);
  });

  it('restoring the pre-arrange SAVED record leaves no overlap', () => {
    const saved = {};
    const snapshot = takeArrangeSnapshot(saved, [], 'tier');
    // Arrange writes its record; Undo writes the snapshot back.
    let record: Record<string, { x: number; y: number }> = arranged;
    record = restoreArrangeSnapshot(snapshot).positions;
    expect(record).toEqual({});
    // Lift the filter: both frames re-flow.
    expect(overlaps(buildWrapperLayout(cards, frames, record, new Set()))).toBe(false);
  });

  it('counter-test: the old live-position snapshot freezes the filtered layout and overlaps', () => {
    const live = buildWrapperLayout(cards, frames, {}, filtered);
    const oldSnapshot: Record<string, { x: number; y: number }> = {};
    live.forEach(p => { if (!p.parentId) oldSnapshot[p.id] = p.position; });
    expect(overlaps(buildWrapperLayout(cards, frames, oldSnapshot, new Set()))).toBe(true);
  });

  it('copies: mutating the inputs after the snapshot cannot change it', () => {
    const saved = { a: { x: 1, y: 2 } };
    const tiers = [{ tier: 1, x: 0, width: 260 }];
    const snapshot = takeArrangeSnapshot(saved, tiers, 'tier');
    saved.a.x = 99;
    tiers[0].x = 99;
    expect(snapshot.positions.a.x).toBe(1);
    expect(snapshot.tierLabels[0].x).toBe(0);
    expect(restoreArrangeSnapshot(snapshot)).toEqual(snapshot);
  });
});

describe('per-mode store', () => {
  it('the snapshot carries the store it was taken from, and restore round-trips it', () => {
    const tier = takeArrangeSnapshot({ a: { x: 1, y: 2 } }, [], 'tier');
    expect(tier.store).toBe('tier');
    expect(restoreArrangeSnapshot(tier)).toEqual(tier);

    const collection = takeArrangeSnapshot({}, [], 'collection', 'tier');
    expect(collection).toEqual({ positions: {}, tierLabels: [], store: 'collection', sortBy: 'tier' });
    expect(restoreArrangeSnapshot(collection)).toEqual(collection);
  });
});

describe('collection card order', () => {
  const order = { v: 1 as const, columns: [{ id: 'c1', name: 'Color', items: ['path:b', 'path:a'] }] };

  it('is deep-copied: mutating the record after the snapshot cannot change it', () => {
    const live = { v: 1 as const, columns: order.columns.map(c => ({ ...c, items: c.items.slice() })) };
    const snapshot = takeArrangeSnapshot({}, [], 'collection', undefined, live);
    live.columns[0].items.push('path:c');
    live.columns[0].name = 'Renamed';
    live.columns.push({ id: 'c2', name: 'Size', items: [] });
    expect(snapshot.collectionOrder).toEqual(order);
  });

  it('restores verbatim, as a fresh copy', () => {
    const snapshot = takeArrangeSnapshot({}, [], 'collection', 'tier', order);
    const restored = restoreArrangeSnapshot(snapshot);
    expect(restored).toEqual({ positions: {}, tierLabels: [], store: 'collection', sortBy: 'tier', collectionOrder: order });
    expect(restored.collectionOrder).not.toBe(snapshot.collectionOrder);
    expect(restored.collectionOrder!.columns[0].items).not.toBe(snapshot.collectionOrder!.columns[0].items);
  });

  it('null (no stored order) round-trips as null; a Tier snapshot has no key', () => {
    const none = takeArrangeSnapshot({}, [], 'collection', undefined, null);
    expect(none.collectionOrder).toBeNull();
    expect(restoreArrangeSnapshot(none).collectionOrder).toBeNull();
    expect('collectionOrder' in takeArrangeSnapshot({}, [], 'tier')).toBe(false);
    expect('collectionOrder' in restoreArrangeSnapshot(takeArrangeSnapshot({}, [], 'tier'))).toBe(false);
  });
});
