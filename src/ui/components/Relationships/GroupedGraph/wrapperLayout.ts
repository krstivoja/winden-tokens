// Layout for expanded group "wrapper" frames.
//
// Given the flat list of standard (unmanaged) cards and the set of expanded
// group paths, this builds a nested tree of wrapper frames containing cards
// and computes React-Flow positions. Cards/wrappers inside a wrapper use
// positions relative to that wrapper (React Flow parent-node coordinates);
// top-level units use absolute positions.

import { GroupData } from './types';
import { GROUP_WIDTH, WRAPPER_HEADER_HEIGHT, WRAPPER_PADDING, WRAPPER_GAP } from './constants';
import { getGroupHeight } from './utils';

export interface WrapperPlacement {
  kind: 'wrapper';
  id: string;
  path: string;
  collectionId: string;
  parentId: string | null;
  position: { x: number; y: number };
  width: number;
  height: number;
}

export interface CardPlacement {
  kind: 'card';
  id: string;
  group: GroupData;
  parentId: string | null;
  position: { x: number; y: number };
}

export type Placement = WrapperPlacement | CardPlacement;

interface Unit {
  kind: 'card' | 'wrapper';
  path: string;
  collectionId: string;
  group?: GroupData;
  children: Unit[];
  width: number;
  height: number;
  rel: { x: number; y: number };
}

// Deepest grouped path that is a proper ancestor of `path` (its wrapper), or null.
function deepestGroupedAncestor(path: string, grouped: Set<string>): string | null {
  const parts = path.split('/');
  let result: string | null = null;
  for (let depth = 1; depth < parts.length; depth++) {
    const prefix = parts.slice(0, depth).join('/');
    if (grouped.has(prefix)) result = prefix;
  }
  return result;
}

const wrapperId = (path: string) => `wrapper:${path}`;

/**
 * Build placements for standard cards, nesting them inside wrapper frames for
 * every expanded ancestor path. Managed groups are not handled here.
 *
 * `savedPositions` holds two namespaces in one record: a top-level unit's id
 * (card key or `wrapper:<path>`) maps to its absolute position, while
 * `rel:<id>` maps a *nested* unit to a manually-dragged position relative to
 * its parent wrapper — used instead of the auto vertical stack for that one
 * child, at whatever nesting depth it lives.
 */
export function buildWrapperLayout(
  cards: GroupData[],
  groupedPaths: Set<string>,
  savedPositions: Record<string, { x: number; y: number }>
): Placement[] {
  if (cards.length === 0) return [];

  // Collect wrapper paths actually needed (grouped ancestors of some card).
  const wrapperPaths = new Set<string>();
  const collectionByWrapper = new Map<string, string>();
  cards.forEach(card => {
    const path = card.sourceGroupName || '';
    const parts = path.split('/');
    for (let depth = 1; depth < parts.length; depth++) {
      const prefix = parts.slice(0, depth).join('/');
      if (groupedPaths.has(prefix)) {
        wrapperPaths.add(prefix);
        if (!collectionByWrapper.has(prefix)) collectionByWrapper.set(prefix, card.collectionId);
      }
    }
  });

  // Create units.
  const units = new Map<string, Unit>();
  wrapperPaths.forEach(path => {
    units.set(wrapperId(path), {
      kind: 'wrapper', path, collectionId: collectionByWrapper.get(path) || '',
      children: [], width: 0, height: 0, rel: { x: 0, y: 0 },
    });
  });
  cards.forEach(card => {
    units.set(card.key, {
      kind: 'card', path: card.sourceGroupName || '', collectionId: card.collectionId,
      group: card, children: [], width: 0, height: 0, rel: { x: 0, y: 0 },
    });
  });

  // Link units to parents.
  const roots: Unit[] = [];
  const attach = (unit: Unit) => {
    const parentPath = deepestGroupedAncestor(unit.path, groupedPaths);
    if (parentPath && units.has(wrapperId(parentPath))) {
      units.get(wrapperId(parentPath))!.children.push(unit);
    } else {
      roots.push(unit);
    }
  };
  units.forEach(unit => attach(unit));

  // Stable child ordering by path.
  const sortChildren = (unit: Unit) => {
    unit.children.sort((a, b) => a.path.localeCompare(b.path));
    unit.children.forEach(sortChildren);
  };
  roots.sort((a, b) => a.path.localeCompare(b.path));
  roots.forEach(sortChildren);

  // Size + relative layout: cards/sub-wrappers stacked vertically,
  // left-aligned, inside the wrapper — unless the user dragged one to a
  // manual spot (rel:<id> in savedPositions), in which case that position
  // wins and the auto-stack skips over it for the *other* children.
  const unitId = (unit: Unit) => unit.kind === 'card' && unit.group ? unit.group.key : wrapperId(unit.path);
  const sizeUnit = (unit: Unit) => {
    if (unit.kind === 'card') {
      unit.width = GROUP_WIDTH;
      unit.height = unit.group ? getGroupHeight(unit.group) : 0;
      return;
    }
    let y = WRAPPER_HEADER_HEIGHT + WRAPPER_PADDING;
    let maxW = 0;
    let maxRight = 0;
    let maxBottom = 0;
    unit.children.forEach(child => {
      sizeUnit(child);
      const manualRel = savedPositions[`rel:${unitId(child)}`];
      if (manualRel) {
        child.rel = manualRel;
      } else {
        child.rel = { x: WRAPPER_PADDING, y };
        y += child.height + WRAPPER_GAP;
      }
      maxW = Math.max(maxW, child.width);
      maxRight = Math.max(maxRight, child.rel.x + child.width);
      maxBottom = Math.max(maxBottom, child.rel.y + child.height);
    });
    const minWidth = Math.max(maxW + WRAPPER_PADDING * 2, GROUP_WIDTH);
    const minHeight = unit.children.length > 0
      ? y - WRAPPER_GAP + WRAPPER_PADDING
      : WRAPPER_HEADER_HEIGHT + WRAPPER_PADDING * 2;
    // Bounding box of all children (auto-stacked and manually placed) never
    // shrinks the wrapper below what the auto-stack alone would need.
    unit.width = Math.max(minWidth, maxRight + WRAPPER_PADDING);
    unit.height = Math.max(minHeight, maxBottom + WRAPPER_PADDING);
  };
  roots.forEach(sizeUnit);

  // Natural absolute origin for a unit (used for top-level placement).
  const naturalPos = (unit: Unit): { x: number; y: number } => {
    if (unit.kind === 'card' && unit.group) {
      return { x: unit.group.initialX, y: unit.group.initialY };
    }
    // Wrapper: min over descendant cards.
    let minX = Infinity;
    let minY = Infinity;
    const visit = (u: Unit) => {
      if (u.kind === 'card' && u.group) {
        minX = Math.min(minX, u.group.initialX);
        minY = Math.min(minY, u.group.initialY);
      }
      u.children.forEach(visit);
    };
    visit(unit);
    return { x: minX === Infinity ? 0 : minX, y: minY === Infinity ? 0 : minY };
  };

  // Place top-level units, stacking by column to avoid overlap.
  const placements: Placement[] = [];
  const emit = (unit: Unit, parentId: string | null, position: { x: number; y: number }) => {
    if (unit.kind === 'card' && unit.group) {
      placements.push({ kind: 'card', id: unit.group.key, group: unit.group, parentId, position });
    } else {
      placements.push({
        kind: 'wrapper', id: wrapperId(unit.path), path: unit.path,
        collectionId: unit.collectionId, parentId, position,
        width: unit.width, height: unit.height,
      });
      unit.children.forEach(child => emit(child, wrapperId(unit.path), child.rel));
    }
  };

  // Simple top-level packing: order roots by natural X then Y, place left→right
  // into columns, stacking vertically within a column when X collides.
  const sortedRoots = [...roots].sort((a, b) => {
    const pa = naturalPos(a);
    const pb = naturalPos(b);
    return pa.x - pb.x || pa.y - pb.y;
  });
  const columnBottoms = new Map<number, number>();
  sortedRoots.forEach(unit => {
    const saved = savedPositions[unitId(unit)];
    let pos: { x: number; y: number };
    if (saved) {
      pos = saved;
    } else {
      const natural = naturalPos(unit);
      const colKey = Math.round(natural.x);
      const top = Math.max(columnBottoms.get(colKey) ?? 0, natural.y);
      pos = { x: natural.x, y: top };
      columnBottoms.set(colKey, top + unit.height + WRAPPER_GAP);
    }
    emit(unit, null, pos);
  });

  return placements;
}
