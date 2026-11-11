// Overlap nudge for the graph canvas — the pure half.
//
// Saved layouts are only as good as the size estimates they were made with.
// Records written before the card-height fix (cards 6px, frames 22–34px
// shorter than drawn) now overlap: in Tier mode a frame runs into the card
// below it, in Collection mode the computed cards above a dragged one run
// into it. Rather than rewrite anyone's record, every layout pass resolves
// overlaps on the way to the canvas, and a drop resolves the overlap it made.
//
// The rule: walking top to bottom, a box that overlaps a box above it (both
// on screen, in the same column) moves DOWN to sit exactly the Grid Settings
// vertical gap below it. Nothing ever moves up or sideways, a box that
// collides with nothing stays put, and a push can push the next box
// (cascade). In a layout pass the top edge decides the order: of two
// overlapping boxes the one whose top is higher stays.
//
// A pushed box keeps the full gap: once a push is involved (the box was
// pushed, or the box above it was), closer than the gap counts as a
// collision too, so a cascade never leaves a pushed box touching the next
// one. Boxes no push touched may still sit closer than the gap and stay put.
//
// A drop is the exception to "higher top stays": the boxes the user just
// moved are pinned — they stay exactly where they were dropped, and every box
// they land on, above or below, goes down to the gap below them — except
// that a drop that PASSES boxes in its column swaps with them (see
// resolveDrop), so the column stays packed like a reorder.
//
// Deterministic and idempotent: a layout without overlaps comes back
// untouched, so running it on every rebuild never moves anything twice, and
// a resolved layout that gets saved resolves to itself.

import type { Node } from '@xyflow/react';
import { GROUP_WIDTH } from './constants';
import type { GroupNodeData } from './types';
import { getGroupHeight } from './utils';

export interface OverlapBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Positions come from drags and sums of estimates, so a sub-pixel touch is
// not a collision.
const EPSILON = 0.5;

const overlaps = (aStart: number, aSize: number, bStart: number, bSize: number) =>
  aStart < bStart + bSize - EPSILON && bStart < aStart + aSize - EPSILON;

/**
 * Two boxes share a column when they overlap horizontally by at least half
 * the narrower one. A box that only sticks into the next column by a sliver
 * (a frame wider than its Tier column at a small horizontal gap) is a
 * sideways overlap: pushing that whole neighbouring column down would wreck
 * the layout and fix nothing a vertical push can fix, so it is left alone.
 */
const sameColumn = (a: OverlapBox, b: OverlapBox) =>
  Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) >= Math.min(a.width, b.width) / 2;

const byTop = (a: OverlapBox, b: OverlapBox) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id);

/**
 * The y every box that has to move moves to, by id. Boxes that stay are left
 * out, so an empty map means "nothing overlaps".
 *
 * `pinned` (a drop): those boxes are placed first and stay where they are —
 * the rest are resolved around them, so any box overlapping a pinned one ends
 * up below it. Pinned boxes that overlap each other (they move together, so
 * only a layout that already overlapped) fall back to "higher top stays"
 * among themselves.
 */
export function resolveOverlaps(
  boxes: readonly OverlapBox[],
  gapY: number,
  pinned?: ReadonlySet<string>
): Map<string, number> {
  const isPinned = (box: OverlapBox) => pinned?.has(box.id) ?? false;
  const ordered = [
    ...boxes.filter(isPinned).sort(byTop),
    ...boxes.filter(box => !isPinned(box)).sort(byTop),
  ];
  const placed: OverlapBox[] = [];
  const moved = new Map<string, number>();
  ordered.forEach(box => {
    let y = box.y;
    // Below everything placed above it that it runs into; a push can land it
    // on another placed box, so repeat until it lands clear.
    for (;;) {
      let bottom = -Infinity;
      placed.forEach(other => {
        if (!sameColumn(box, other)) return;
        // Either one pushed: closer than the gap is a collision as well.
        const keep = y !== box.y || moved.has(other.id) ? gapY : 0;
        if (!overlaps(y, box.height + keep, other.y, other.height + keep)) return;
        bottom = Math.max(bottom, other.y + other.height + gapY);
      });
      if (bottom === -Infinity) break;
      y = bottom;
    }
    if (y !== box.y) moved.set(box.id, y);
    placed.push(y === box.y ? box : { ...box, y });
  });
  return moved;
}

/**
 * A drop, resolved: the y every box moves to (the dropped ones included), by
 * id. `boxes` is the canvas with the drop applied; `origins` holds where each
 * dropped box started (its x and y before the drag, or its slot before a
 * run of key presses — see GroupedGraph's key walk).
 *
 * The dropped boxes of one column move as one block, keeping their offsets.
 * A block that stayed in its column and PASSED boxes swaps with them:
 * - Up: a passed box started above the block and the block's new top is
 *   inside it or above it (so one key press into the card above passes it).
 *   The block takes the top of the top-most passed box — even when dropped
 *   above it — and the passed boxes stack below it at the gap, in their
 *   order. A block dropped clear of every passed box (free space) stays.
 * - Down, the mirror image: a passed box started below the block and the
 *   block's new bottom is inside it or below it (so one key press into the
 *   card below passes it). The passed boxes move up by the block's height
 *   plus the gap — into its old slot in a packed column, never above its old
 *   top — keeping their order and spacing, and the block sits the gap below
 *   the last one. A block dropped clear of every passed box (free space
 *   below them) stays; the boxes it crossed still move up.
 * Anything else the drop (or the swap) lands on resolves as in
 * resolveOverlaps with the dropped boxes pinned: it moves down to the gap
 * below them, cascading. A block moved into another column swaps nothing.
 */
export function resolveDrop(
  boxes: readonly OverlapBox[],
  gapY: number,
  origins: ReadonlyMap<string, { x: number; y: number }>
): Map<string, number> {
  const dropped = boxes.filter(box => origins.has(box.id));
  const pinned = new Set(dropped.map(box => box.id));
  const finalY = new Map<string, number>();

  // Blocks: dropped boxes that share a column.
  const blocks: OverlapBox[][] = [];
  dropped.forEach(box => {
    const joined = blocks.filter(block => block.some(other => sameColumn(box, other)));
    const merged = [box, ...joined.flat()];
    joined.forEach(block => blocks.splice(blocks.indexOf(block), 1));
    blocks.push(merged);
  });

  blocks.forEach(block => {
    const stayedInColumn = block.every(box => {
      const origin = origins.get(box.id)!;
      return sameColumn(box, { ...box, x: origin.x, y: origin.y });
    });
    if (!stayedInColumn) return;
    const originTop = Math.min(...block.map(box => origins.get(box.id)!.y));
    const newTop = Math.min(...block.map(box => box.y));
    const others = boxes.filter(box => !pinned.has(box.id) && block.some(member => sameColumn(box, member)));
    let shift = 0;
    if (newTop < originTop - EPSILON) {
      const passed = others.filter(box => box.y < originTop - EPSILON && box.y + box.height > newTop + EPSILON);
      if (passed.length === 0) return;
      // Dropped clear of every passed box (free space above them): it stays.
      const touches = passed.some(box => block.some(member => overlaps(member.y, member.height, box.y, box.height)));
      if (touches) shift = Math.min(...passed.map(box => box.y)) - newTop;
    } else if (newTop > originTop + EPSILON) {
      // The mirror image: a passed box started below the block and the
      // block's new bottom is inside it or below it.
      const originBottom = Math.max(...block.map(box => origins.get(box.id)!.y + box.height));
      const newBottom = Math.max(...block.map(box => box.y + box.height));
      const passed = others
        .filter(box => box.y + box.height > originBottom + EPSILON && box.y < newBottom - EPSILON)
        .sort(byTop);
      if (passed.length === 0) return;
      // The passed boxes move up by the block's height plus the gap (into its
      // old slot in a packed column), keeping their spacing — never above
      // the block's old top, and never further in a sparse one.
      const up = Math.min(originBottom - originTop + gapY, passed[0].y - originTop);
      passed.forEach(box => {
        finalY.set(box.id, box.y - up);
        pinned.add(box.id);
      });
      const last = passed[passed.length - 1];
      const y = last.y - up + last.height + gapY;
      // The block sits the gap below the last one — unless it was dropped
      // clear of every passed box (free space below them): then it stays.
      const touches = passed.some(box => block.some(member => overlaps(member.y, member.height, box.y, box.height)));
      if (touches) shift = y - newTop;
    }
    block.forEach(box => finalY.set(box.id, box.y + shift));
  });

  const placed = boxes.map(box => (finalY.has(box.id) ? { ...box, y: finalY.get(box.id)! } : box));
  const moved = resolveOverlaps(placed, gapY, pinned);
  const out = new Map<string, number>();
  placed.forEach((box, index) => {
    const y = moved.get(box.id) ?? box.y;
    if (y !== boxes[index].y) out.set(box.id, y);
  });
  return out;
}

/**
 * Collection mode stores only the boxes moved by hand: the rest keep
 * re-flowing with the filters. A drop moves more than that (the boxes it
 * pushed), so this picks what the record must also hold for the next layout
 * pass to show exactly `shown` again: the boxes that pass would not put there
 * by itself — in practice a box the drop passed (it started above a dropped
 * box and is now below it). A box pushed down from below is left out: the
 * pass makes the same push from the stored drop.
 *
 * `shown`: the boxes on screen after the drop. `passStart`: the y the next
 * pass starts a box at while its y is not stored now (its old record, else its
 * natural slot); a box missing there starts where it is shown. `stored`: the
 * ids the record will hold at their shown y. Returns `stored` plus what it
 * needs. Each round adds the first box, in the pass's own order, the pass
 * gets wrong: every box placed before it is right, so it can only be fixed
 * by storing it.
 */
export function boxesToStore(
  shown: readonly OverlapBox[],
  passStart: ReadonlyMap<string, number>,
  stored: ReadonlySet<string>,
  gapY: number
): Set<string> {
  const out = new Set(stored);
  for (let round = 0; round <= shown.length; round++) {
    const start = shown.map(box => (out.has(box.id) ? box : { ...box, y: passStart.get(box.id) ?? box.y }));
    const moved = resolveOverlaps(start, gapY);
    let first: OverlapBox | null = null;
    for (let index = 0; index < start.length; index++) {
      const box = start[index];
      const y = moved.get(box.id) ?? box.y;
      if (Math.abs(y - shown[index].y) <= EPSILON) continue;
      if (!first || byTop(box, first) < 0) first = box;
    }
    if (!first) return out;
    out.add(first.id);
  }
  return out;
}

/**
 * A node's box for the nudge: top-level, on screen, and a card or a frame —
 * a frame and the cards inside it are one block (the cards ride along with
 * their frame's position). Sizes are the layout's own estimates, which equal
 * the drawn size: a card's `getGroupHeight`, a frame's style box. Captions
 * and the selection card take part in nothing.
 */
export function getNodeOverlapBox(node: Node): OverlapBox | null {
  if (node.hidden || node.parentId) return null;
  if (node.type === 'groupWrapper') {
    const width = node.style?.width;
    const height = node.style?.height;
    if (typeof width !== 'number' || typeof height !== 'number') return null;
    return { id: node.id, x: node.position.x, y: node.position.y, width, height };
  }
  if (node.type === 'groupNode') {
    const group = (node.data as Partial<GroupNodeData> | undefined)?.group;
    if (!group) return null;
    return { id: node.id, x: node.position.x, y: node.position.y, width: GROUP_WIDTH, height: getGroupHeight(group) };
  }
  return null;
}

/** The nudge boxes of xyflow nodes (see getNodeOverlapBox). */
export function getNodeOverlapBoxes(nodes: readonly Node[]): OverlapBox[] {
  const boxes: OverlapBox[] = [];
  nodes.forEach(node => {
    const box = getNodeOverlapBox(node);
    if (box) boxes.push(box);
  });
  return boxes;
}

/** resolveDrop over xyflow nodes: the new position of every node that moves. */
export function resolveNodeDrop(
  nodes: readonly Node[],
  gapY: number,
  origins: ReadonlyMap<string, { x: number; y: number }>
): Map<string, { x: number; y: number }> {
  const boxes = getNodeOverlapBoxes(nodes);
  const xById = new Map(boxes.map(box => [box.id, box.x]));
  const out = new Map<string, { x: number; y: number }>();
  resolveDrop(boxes, gapY, origins).forEach((y, id) => out.set(id, { x: xById.get(id)!, y }));
  return out;
}

/**
 * resolveOverlaps over xyflow nodes: the new position of every node that
 * moves. `pinned`: the ids just dropped (see resolveOverlaps).
 */
export function resolveNodeOverlaps(
  nodes: readonly Node[],
  gapY: number,
  pinned?: ReadonlySet<string>
): Map<string, { x: number; y: number }> {
  const boxes = getNodeOverlapBoxes(nodes);
  const xById = new Map(boxes.map(box => [box.id, box.x]));
  const out = new Map<string, { x: number; y: number }>();
  resolveOverlaps(boxes, gapY, pinned).forEach((y, id) => out.set(id, { x: xById.get(id)!, y }));
  return out;
}
