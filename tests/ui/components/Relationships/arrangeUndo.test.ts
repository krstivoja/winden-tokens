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
    const snapshot = takeArrangeSnapshot(saved, []);
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
    const snapshot = takeArrangeSnapshot(saved, tiers);
    saved.a.x = 99;
    tiers[0].x = 99;
    expect(snapshot.positions.a.x).toBe(1);
    expect(snapshot.tierLabels[0].x).toBe(0);
    expect(restoreArrangeSnapshot(snapshot)).toEqual(snapshot);
  });
});
