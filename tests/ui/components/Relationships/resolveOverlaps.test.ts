import { describe, it, expect } from 'vitest';
import type { Node } from '@xyflow/react';
import {
  boxesToStore,
  getNodeOverlapBox,
  resolveDrop,
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

describe('resolveOverlaps with pinned boxes (a drop)', () => {
  const pin = (...ids: string[]) => new Set(ids);

  it('keeps a dropped box where it landed and pushes the box below it down', () => {
    // a dropped 26px into b: a stays, b goes below it.
    expect(asObject(resolveOverlaps([box('a', 0, 50), box('b', 0, 124)], 24, pin('a')))).toEqual({ b: 174 });
  });

  it('a box dropped onto the bottom of the one above stays, and the one above goes below it', () => {
    // Without the pin the higher top would win and b would jump below a.
    expect(asObject(resolveOverlaps([box('a', 0, 0), box('b', 0, 90)], 24))).toEqual({ b: 124 });
    expect(asObject(resolveOverlaps([box('a', 0, 0), box('b', 0, 90)], 24, pin('b')))).toEqual({ a: 214 });
  });

  it('one keyboard step up into the card above passes it', () => {
    // a 0..100, b sat the gap below (124) and moved up 32 → 92: a goes below b.
    expect(asObject(resolveOverlaps([box('a', 0, 0), box('b', 0, 92)], 24, pin('b')))).toEqual({ a: 216 });
  });

  it('cascades down the column from the boxes it pushed, keeping their order', () => {
    // b dropped at 10 lands on a and c; a goes below b, c below a, d below c.
    const moved = resolveOverlaps(
      [box('a', 0, 0), box('b', 0, 10), box('c', 0, 124), box('d', 0, 248), box('e', 0, 1000)],
      24,
      pin('b')
    );
    expect(asObject(moved)).toEqual({ a: 134, c: 258, d: 382 });
  });

  it('leaves boxes the drop does not touch alone, other columns included', () => {
    expect(resolveOverlaps([box('a', 0, 0), box('b', 0, 300), box('x', 400, 310)], 24, pin('b')).size).toBe(0);
    expect(asObject(resolveOverlaps([box('a', 0, 0), box('b', 0, 50), box('x', 400, 60)], 24, pin('b')))).toEqual({ a: 174 });
  });

  it('keeps every box of a multi-selection where it was dropped', () => {
    // a and b dropped together (still 24 apart) onto c and d.
    const moved = resolveOverlaps(
      [box('a', 0, 100), box('b', 0, 224), box('c', 0, 150), box('d', 0, 300)],
      24,
      pin('a', 'b')
    );
    expect(asObject(moved)).toEqual({ c: 348, d: 472 });
  });

  it('pinned boxes overlapping each other fall back to "higher top stays" among themselves', () => {
    expect(asObject(resolveOverlaps([box('a', 0, 0), box('b', 0, 50), box('c', 0, 60)], 24, pin('a', 'b'))))
      .toEqual({ b: 124, c: 248 });
  });

  it('the resolved drop is a clean layout: a plain pass leaves it untouched', () => {
    const boxes = [box('a', 0, 0), box('b', 0, 10), box('c', 0, 124), box('d', 40, 248, 300)];
    const moved = resolveOverlaps(boxes, 24, pin('b'));
    const resolved = boxes.map(b => ({ ...b, y: moved.get(b.id) ?? b.y }));
    expect(resolveOverlaps(resolved, 24).size).toBe(0);
  });
});

// A pushed box keeps the full gap: closer than the gap to the next box in the
// column counts as a collision once a push is involved. Boxes no push touched
// may still sit closer (a near-miss drop, an old layout) and stay put.
describe('resolveOverlaps keeps the full gap after a push', () => {
  const pin = (...ids: string[]) => new Set(ids);

  it('a push that lands closer than the gap to the next box pushes it too', () => {
    // b pushed to 124 (to 224); c at 230 is clear but only 6px away → 248.
    expect(asObject(resolveOverlaps([box('a', 0, 0), box('b', 0, 90), box('c', 0, 230)], 24)))
      .toEqual({ b: 124, c: 248 });
    // The same from a drop: a dropped onto b, b's push lands flush on c.
    expect(asObject(resolveOverlaps([box('a', 0, 50), box('b', 0, 124), box('c', 0, 274)], 24, pin('a'))))
      .toEqual({ b: 174, c: 298 });
  });

  it('a box passed by a drop keeps the gap to the box below the drop', () => {
    // b dropped up into a; a goes below b and must keep the gap to c (at 224).
    expect(asObject(resolveOverlaps([box('a', 0, 0), box('b', 0, 90), box('c', 0, 224)], 24, pin('b'))))
      .toEqual({ a: 214, c: 338 });
  });

  it('leaves a near-miss drop alone: nothing overlaps, nothing moves', () => {
    expect(resolveOverlaps([box('a', 0, 0), box('b', 0, 104), box('c', 0, 210)], 24, pin('b')).size).toBe(0);
  });

  it('boxes no push touched may stay closer than the gap', () => {
    expect(resolveOverlaps([box('a', 0, 0), box('b', 0, 104), box('c', 0, 300), box('d', 0, 402)], 24, pin('a')).size)
      .toBe(0);
  });
});

// A drop that passes boxes in its column swaps with them, like a reorder.
describe('resolveDrop', () => {
  const at = (entries: Record<string, [number, number]>) =>
    new Map(Object.entries(entries).map(([id, [x, y]]) => [id, { x, y }]));

  it('up: one step into the card above swaps the two', () => {
    // b sat at 124 under a (0..100) and moved up to 92.
    expect(asObject(resolveDrop([box('a', 0, 0), box('b', 0, 92)], 24, at({ b: [0, 124] }))))
      .toEqual({ b: 0, a: 124 });
  });

  it('up: past several boxes, the drop takes the top-most one\'s top and they stack below it in order', () => {
    const moved = resolveDrop([box('a', 0, 0), box('b', 0, 124), box('c', 0, 50), box('d', 0, 372)], 24, at({ c: [0, 248] }));
    expect(asObject(moved)).toEqual({ c: 0, a: 124, b: 248 });
  });

  it('up: a drop above the top-most passed box but onto it still takes its top', () => {
    // b dropped at -40 (to 60) onto a (0..100): b → 0, a below it.
    expect(asObject(resolveDrop([box('a', 0, 0), box('b', 0, -40)], 24, at({ b: [0, 124] }))))
      .toEqual({ b: 0, a: 124 });
  });

  it('up: a drop clear of every passed box (free space above) stays where it was dropped', () => {
    expect(resolveDrop([box('a', 0, 0), box('b', 0, -150)], 24, at({ b: [0, 124] })).size).toBe(0);
  });

  it('up: a drop into the gap above, touching nothing, changes nothing', () => {
    expect(resolveDrop([box('a', 0, 0), box('b', 0, 108)], 24, at({ b: [0, 124] })).size).toBe(0);
  });

  it('down: a drop into the upper part of the card below swaps the two (the mirror of up)', () => {
    expect(asObject(resolveDrop([box('a', 0, 40), box('b', 0, 124)], 24, at({ a: [0, 0] })))).toEqual({ b: 0, a: 124 });
  });

  it('down: in a sparse column the passed box moves up by the block\'s height plus the gap, no further', () => {
    expect(asObject(resolveDrop([box('a', 0, 450), box('b', 0, 500)], 24, at({ a: [0, 0] })))).toEqual({ b: 376, a: 500 });
  });

  it('down: a passed box that sat closer than the gap never moves above the block\'s old top', () => {
    expect(asObject(resolveDrop([box('a', 0, 8), box('b', 0, 104)], 24, at({ a: [0, 0] })))).toEqual({ b: 0, a: 124 });
  });

  it('down: a drop into the gap below, touching nothing, changes nothing', () => {
    expect(resolveDrop([box('a', 0, 16), box('b', 0, 124)], 24, at({ a: [0, 0] })).size).toBe(0);
  });

  // Gap 40, cards 100 tall: c0 0, c1 140, c2 280, c3 420.
  const column = (n: number) => Array.from({ length: n }, (_, i) => box(`c${i}`, 0, i * 140));
  const applied = (boxes: OverlapBox[], moved: Map<string, number>) =>
    boxes.map(b => ({ ...b, y: moved.get(b.id) ?? b.y }));

  it('down by keys (each press its own drop): 10px presses eventually swap with the card below', () => {
    let boxes = column(4);
    for (let press = 0; press < 30; press++) {
      const origin = boxes.find(b => b.id === 'c1')!;
      const dropped = boxes.map(b => (b.id === 'c1' ? { ...b, y: b.y + 10 } : b));
      boxes = applied(dropped, resolveDrop(dropped, 40, at({ c1: [0, origin.y] })));
    }
    const order = boxes.slice().sort((p, q) => p.y - q.y).map(b => b.id);
    expect(order.indexOf('c1')).toBeGreaterThan(1);
  });

  it('down by keys (from the slot, as the key walk passes it): one swap every few presses, the column never grows', () => {
    let boxes = column(4);
    let slot = 140;
    const orders: string[] = [];
    for (let press = 0; press < 30; press++) {
      const dropped = boxes.map(b => (b.id === 'c1' ? { ...b, y: b.y + 10 } : b));
      const moved = resolveDrop(dropped, 40, at({ c1: [0, slot] }));
      if (moved.has('c1')) slot = moved.get('c1')!;
      boxes = applied(dropped, moved);
      orders.push(boxes.slice().sort((p, q) => p.y - q.y).map(b => b.id).join(','));
    }
    // Swapped with c2 and then c3; the column never grows.
    expect(orders[orders.length - 1]).toBe('c0,c2,c3,c1');
    expect(boxes.filter(b => b.id !== 'c1').map(b => b.y).sort((p, q) => p - q)).toEqual([0, 140, 280]);
  });

  it('down by mouse: a drop just above the next card\'s top keeps the column packed', () => {
    const boxes = column(4).map(b => (b.id === 'c0' ? { ...b, y: 130 } : b));
    expect(asObject(resolveDrop(boxes, 40, at({ c0: [0, 0] })))).toEqual({ c1: 0, c0: 140 });
  });

  it('down: past the top of the card below swaps the two', () => {
    const moved = resolveDrop([box('a', 0, 140), box('b', 0, 124), box('c', 0, 248)], 24, at({ a: [0, 0] }));
    expect(asObject(moved)).toEqual({ b: 0, a: 124 });
  });

  it('down: past several boxes, they move up into the old slot in order and the drop sits below them', () => {
    const moved = resolveDrop(
      [box('a', 0, 260), box('b', 0, 124), box('c', 0, 248), box('d', 0, 372)],
      24,
      at({ a: [0, 0] })
    );
    expect(asObject(moved)).toEqual({ b: 0, c: 124, a: 248 });
  });

  it('down: a drop past the passed box\'s bottom stays where it was dropped', () => {
    expect(asObject(resolveDrop([box('a', 0, 300), box('b', 0, 124), box('c', 0, 600)], 24, at({ a: [0, 0] }))))
      .toEqual({ b: 0 });
  });

  it('a multi-selection in one column swaps as one block, keeping its offsets', () => {
    const moved = resolveDrop(
      [box('a', 0, 0), box('b', 0, 92), box('c', 0, 216), box('x', 400, 0)],
      24,
      at({ b: [0, 124], c: [0, 248] })
    );
    expect(asObject(moved)).toEqual({ b: 0, c: 124, a: 248 });
  });

  it('a box moved into another column swaps nothing: what it lands on is pushed', () => {
    const moved = resolveDrop([box('a', 0, 0), box('b', 400, 50), box('x', 400, 0)], 24, at({ b: [0, 124] }));
    expect(asObject(moved)).toEqual({ x: 174 });
  });

  it('the swapped layout is clean: a plain pass leaves it untouched', () => {
    const boxes = [box('a', 0, 0), box('b', 0, 124), box('c', 0, 50), box('d', 0, 372)];
    const moved = resolveDrop(boxes, 24, at({ c: [0, 248] }));
    const resolved = boxes.map(b => ({ ...b, y: moved.get(b.id) ?? b.y }));
    expect(resolveOverlaps(resolved, 24).size).toBe(0);
  });
});

// Collection mode stores only what the next layout pass would not reproduce
// by itself: the dropped boxes and the ones that passed them. Boxes pushed
// down from below keep re-flowing with the filters.
describe('boxesToStore', () => {
  it('a drop onto the boxes below stores the drop alone', () => {
    // a dropped from 0 to 50 onto b (124) and c (248): shown after the drop.
    const shown = [box('a', 0, 50), box('b', 0, 174), box('c', 0, 298)];
    const start = new Map([['b', 124], ['c', 248]]);
    expect([...boxesToStore(shown, start, new Set(['a']), 24)].sort()).toEqual(['a']);
  });

  it('a box the drop passed is stored with it, the cascade below is not', () => {
    // b dropped up to 90 into a; a passed it; c pushed from 248.
    const shown = [box('a', 0, 214), box('b', 0, 90), box('c', 0, 338)];
    const start = new Map([['a', 0], ['c', 248]]);
    expect([...boxesToStore(shown, start, new Set(['b']), 24)].sort()).toEqual(['a', 'b']);
  });

  it('a stored box the next pass pushes the same way keeps its old record', () => {
    // c is stored at 280 (closer than the gap under b once b is pushed).
    const shown = [box('a', 0, 50), box('b', 0, 174), box('c', 0, 298)];
    const start = new Map([['b', 124], ['c', 280]]);
    expect([...boxesToStore(shown, start, new Set(['a']), 24)].sort()).toEqual(['a']);
  });

  it('stores whatever else the pass would not reproduce', () => {
    // x sat 400 in the record but is shown at 500 (nothing pushes it there).
    const shown = [box('a', 0, 0), box('x', 0, 500)];
    expect([...boxesToStore(shown, new Map([['x', 400]]), new Set(['a']), 24)].sort()).toEqual(['a', 'x']);
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
  it('passes the pinned ids through', () => {
    const height = getGroupHeight(group('a', 2));
    expect(resolveNodeOverlaps([card('a', 0), card('b', height - 10)], 24, new Set(['b'])))
      .toEqual(new Map([['a', { x: 0, y: height - 10 + height + 24 }]]));
  });

  it('a hidden card pushes nothing', () => {
    const height = getGroupHeight(group('a', 2));
    expect(resolveNodeOverlaps([card('a', 0, 2, { hidden: true }), card('b', height - 10)], 24).size).toBe(0);
    expect(resolveNodeOverlaps([card('a', 0), card('b', height - 10)], 24))
      .toEqual(new Map([['b', { x: 0, y: height + 24 }]]));
  });
});
