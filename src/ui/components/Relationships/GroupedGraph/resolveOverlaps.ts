// Overlap nudge for the graph canvas — the pure half.
//
// Saved layouts are only as good as the size estimates they were made with.
// Records written before the card-height fix (cards 6px, frames 22–34px
// shorter than drawn) now overlap: in Tier mode a frame runs into the card
// below it, in Collection mode the computed cards above a dragged one run
// into it. Rather than rewrite anyone's record, every layout pass resolves
// overlaps on the way to the canvas, and a drop resolves the overlap it made.
//
// The rule is one rule everywhere: walking top to bottom, a box that overlaps
// a box above it (both on screen, in the same column) moves DOWN to sit
// exactly the Grid Settings vertical gap below it. Nothing ever moves up or
// sideways, a box that collides with nothing stays put, and a push can push
// the next box (cascade). The top edge decides the order: of two overlapping
// boxes the one whose top is higher stays.
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

/**
 * The y every box that has to move moves to, by id. Boxes that stay are left
 * out, so an empty map means "nothing overlaps".
 */
export function resolveOverlaps(boxes: readonly OverlapBox[], gapY: number): Map<string, number> {
  const ordered = boxes.slice().sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
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
        if (!overlaps(y, box.height, other.y, other.height)) return;
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

/** resolveOverlaps over xyflow nodes: the new position of every node that moves. */
export function resolveNodeOverlaps(nodes: readonly Node[], gapY: number): Map<string, { x: number; y: number }> {
  const boxes: OverlapBox[] = [];
  const xById = new Map<string, number>();
  nodes.forEach(node => {
    const box = getNodeOverlapBox(node);
    if (!box) return;
    boxes.push(box);
    xById.set(box.id, box.x);
  });
  const out = new Map<string, { x: number; y: number }>();
  resolveOverlaps(boxes, gapY).forEach((y, id) => out.set(id, { x: xById.get(id)!, y }));
  return out;
}
