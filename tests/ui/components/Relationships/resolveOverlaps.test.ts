import { describe, it, expect } from 'vitest';
import type { Node } from '@xyflow/react';
import {
  getNodeOverlapBox,
  resolveNodeOverlaps,
  resolveOverlaps,
} from '../../../../src/ui/components/Relationships/GroupedGraph/resolveOverlaps';
import type { OverlapBox } from '../../../../src/ui/components/Relationships/GroupedGraph/resolveOverlaps';
import { GROUP_WIDTH } from '../../../../src/ui/components/Relationships/GroupedGraph/constants';
import { getGroupHeight } from '../../../../src/ui/components/Relationships/GroupedGraph/utils';
import type { GroupData } from '../../../../src/ui/components/Relationships/GroupedGraph/types';

const box = (id: string, x: number, y: number, height = 100, width = 200): OverlapBox => ({ id, x, y, width, height });
const asObject = (map: Map<string, number>) => Object.fromEntries(map);

describe('resolveOverlaps', () => {
  it('leaves a layout without overlaps untouched, gaps smaller than the setting included', () => {
    expect(resolveOverlaps([box('a', 0, 0), box('b', 0, 105), box('c', 300, 50)], 40).size).toBe(0);
  });

  it('pushes the lower of two overlapping boxes down to exactly the gap', () => {
    expect(asObject(resolveOverlaps([box('a', 0, 0), box('b', 0, 90)], 24))).toEqual({ b: 124 });
  });

  it('keeps the box whose top is higher, wherever the lower one starts', () => {
    // b's top is inside a: b goes below a, a stays.
    expect(asObject(resolveOverlaps([box('b', 0, 99), box('a', 0, 0)], 10))).toEqual({ b: 110 });
  });

  it('cascades: a push that lands on the next box pushes it too', () => {
    const moved = resolveOverlaps([box('a', 0, 0), box('b', 0, 90), box('c', 0, 200), box('d', 0, 400)], 24);
    // b → 124 (to 224) runs into c → 248 (to 348); d at 400 is clear.
    expect(asObject(moved)).toEqual({ b: 124, c: 248 });
  });

  it('needs the same column: side-by-side boxes never push each other', () => {
    expect(resolveOverlaps([box('a', 0, 0), box('b', 200, 50), box('c', 450, 20)], 24).size).toBe(0);
  });

  it('ignores a box sticking into the next column by less than half the narrower box', () => {
    // A 316-wide frame 32px into a 260-wide card's column: sideways, not stacked.
    expect(resolveOverlaps([box('frame', 0, 0, 900, 316), box('card', 284, 100, 120, 260)], 24).size).toBe(0);
    // Half of the narrower box or more: the same column.
    expect(asObject(resolveOverlaps([box('a', 0, 0), box('b', 100, 50)], 24))).toEqual({ b: 124 });
  });

  it('a box overlapping two above it lands below the lower one', () => {
    const moved = resolveOverlaps([box('a', 0, 0), box('b', 80, 30), box('c', 40, 60)], 20);
    // b (30..130) shares a's column (overlap 120 of 200) → b at 120.
    // c overlaps a and b → below b: 120 + 100 + 20.
    expect(asObject(moved)).toEqual({ b: 120, c: 240 });
  });

  it('ignores sub-pixel touches', () => {
    expect(resolveOverlaps([box('a', 0, 0), box('b', 0, 99.7)], 24).size).toBe(0);
  });

  it('is idempotent: the resolved layout resolves to itself', () => {
    const boxes = [box('a', 0, 0), box('b', 0, 90), box('c', 50, 150, 300), box('d', 0, 320)];
    const moved = resolveOverlaps(boxes, 24);
    const resolved = boxes.map(b => ({ ...b, y: moved.get(b.id) ?? b.y }));
    expect(resolveOverlaps(resolved, 24).size).toBe(0);
  });
});

const group = (key: string, rows: number): GroupData => ({
  key, title: key, x: 0, y: 0, initialX: 0, initialY: 0,
  kind: 'standard', sourceGroupName: key, headerFill: '', collectionId: 'c1',
  variables: Array.from({ length: rows }, (_, i) => ({
    id: `${key}${i}`, name: `${key}/${i}`, shortName: `${i}`, displayName: `${i}`,
    color: '', value: '1', resolvedValue: '1', resolvedType: 'FLOAT', isReference: false, referenceName: null,
  })),
});

const card = (id: string, y: number, rows = 2, extra: Partial<Node> = {}): Node => ({
  id, type: 'groupNode', position: { x: 0, y }, data: { group: group(id, rows) }, ...extra,
});

describe('getNodeOverlapBox', () => {
  it('sizes a card by its estimate and a frame by its style box', () => {
    expect(getNodeOverlapBox(card('a', 5))).toEqual({ id: 'a', x: 0, y: 5, width: GROUP_WIDTH, height: getGroupHeight(group('a', 2)) });
    expect(getNodeOverlapBox({
      id: 'w', type: 'groupWrapper', position: { x: 1, y: 2 }, style: { width: 300, height: 400 }, data: {},
    })).toEqual({ id: 'w', x: 1, y: 2, width: 300, height: 400 });
  });

  it('skips hidden nodes, cards inside a frame, captions and the selection card', () => {
    expect(getNodeOverlapBox(card('a', 0, 2, { hidden: true }))).toBe(null);
    expect(getNodeOverlapBox(card('a', 0, 2, { parentId: 'w' }))).toBe(null);
    expect(getNodeOverlapBox({ id: 't', type: 'tierLabel', position: { x: 0, y: 0 }, data: {} })).toBe(null);
    expect(getNodeOverlapBox({ id: 's', type: 'propertyNode', position: { x: 0, y: 0 }, data: {} })).toBe(null);
  });
});

describe('resolveNodeOverlaps', () => {
  it('a hidden card pushes nothing', () => {
    const height = getGroupHeight(group('a', 2));
    expect(resolveNodeOverlaps([card('a', 0, 2, { hidden: true }), card('b', height - 10)], 24).size).toBe(0);
    expect(resolveNodeOverlaps([card('a', 0), card('b', height - 10)], 24))
      .toEqual(new Map([['b', { x: 0, y: height + 24 }]]));
  });
});
