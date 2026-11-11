// Layout for expanded group "wrapper" frames.
//
// Given the flat list of standard (unmanaged) cards plus the collection root
// cards, and the set of frames, this builds the frames, each holding cards
// and nothing else — frames are ONE level, never nested — and computes
// React-Flow positions. Cards inside a frame use positions relative to that
// frame (React Flow parent-node coordinates) and are auto-stacked; they are
// frozen, only the whole frame moves. Top-level units (frames and loose
// cards) use absolute positions.
//
// A frame is identified by `<collectionId>::<path>`, where the empty path is
// the collection's own frame — see getWrapperKey in ./utils.

import { GroupData } from './types';
import {
  GROUP_WIDTH,
  WRAPPER_HEADER_HEIGHT,
  WRAPPER_PADDING,
  CONTAINER_INSET,
  WRAPPER_GAP,
  WRAPPER_NODE_PREFIX,
} from './constants';
import {
  getCardRowsHeight,
  getGroupHeight,
  getWrapperKey,
  parseWrapperKey,
  outermostGroupedAncestor,
} from './utils';

export interface WrapperPlacement {
  kind: 'wrapper';
  /** `wrapper:<collectionId>::<path>` — the React Flow node id. */
  id: string;
  /** Bare path, empty for a collection's own frame. */
  path: string;
  collectionId: string;
  /** Always null: a frame is never inside another frame. */
  parentId: null;
  position: { x: number; y: number };
  width: number;
  height: number;
  /**
   * The card this frame ABSORBED — the one whose own (collection, path) is
   * this frame's. Its header, rows and header actions are the container's
   * own, and it is NOT emitted as a card placement: a group is one thing, not
   * a frame drawn around a card with the same name.
   *
   * Undefined for a grouped path no card sits at, which renders as a
   * container with a header and no rows — same chrome, no special case.
   */
  group?: GroupData;
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
  /** Position inside the parent frame; only meaningful for a frame's cards. */
  rel: { x: number; y: number };
}

const wrapperId = (collectionId: string, path: string) =>
  `${WRAPPER_NODE_PREFIX}${getWrapperKey(collectionId, path)}`;

interface UnitForest {
  roots: Unit[];
  unitId: (unit: Unit) => string;
}

/**
 * The frames and loose cards `cards` fold into, sized: a frame's cards
 * stacked inside it (visible ones only), every root sized exactly as it is
 * drawn. Shared by the layout and by `measureWrapperFrames`, so Collection
 * mode's columns (columnLayout.ts) are sized by the very sizes frames render
 * at.
 */
function buildUnitForest(
  cards: GroupData[],
  groupedPaths: Set<string>,
  hiddenCardKeys: ReadonlySet<string>
): UnitForest {
  // Frames actually needed: the outermost grouped frame of some card, as
  // `<collectionId>::<path>` keys. The walk includes the card's own path (a
  // card whose own path is grouped needs that frame to exist, and is absorbed
  // by it) and starts at depth 0, the collection's own frame, which a
  // collection ROOT card joins. Arrange (outermostGroupedAncestor) uses the
  // same walk, so the two always agree.
  const wrapperKeys = new Set<string>();
  cards.forEach(card => {
    const key = outermostGroupedAncestor(card.collectionId, card.sourceGroupName || '', groupedPaths);
    if (key) wrapperKeys.add(key);
  });

  // Create units.
  const units = new Map<string, Unit>();
  wrapperKeys.forEach(key => {
    // Always parses: every key in here was minted by getWrapperKey above.
    const parsed = parseWrapperKey(key);
    if (!parsed) return;
    units.set(wrapperId(parsed.collectionId, parsed.path), {
      kind: 'wrapper', path: parsed.path, collectionId: parsed.collectionId,
      children: [], width: 0, height: 0, rel: { x: 0, y: 0 },
    });
  });
  cards.forEach(card => {
    const ownKey = getWrapperKey(card.collectionId, card.sourceGroupName || '');
    const container = units.get(`${WRAPPER_NODE_PREFIX}${ownKey}`);
    if (container) {
      // Absorbed: the frame at this card's own path IS this card. It gets no
      // unit of its own, so it can never be both a frame and a card inside
      // that frame with the same name and a second header.
      container.group = card;
      return;
    }
    units.set(card.key, {
      kind: 'card', path: card.sourceGroupName || '', collectionId: card.collectionId,
      group: card, children: [], width: 0, height: 0, rel: { x: 0, y: 0 },
    });
  });

  // Link cards to their frame; everything else is a root. Frames are roots
  // by construction.
  const roots: Unit[] = [];
  units.forEach(unit => {
    if (unit.kind === 'wrapper') {
      roots.push(unit);
      return;
    }
    const parentKey = outermostGroupedAncestor(unit.collectionId, unit.path, groupedPaths);
    const parent = parentKey ? units.get(`${WRAPPER_NODE_PREFIX}${parentKey}`) : undefined;
    if (parent) parent.children.push(unit);
    else roots.push(unit);
  });

  // Stable ordering by collection then path. Within one frame every child
  // shares the collection, so this reduces to the path comparison.
  const sortKey = (unit: Unit) => getWrapperKey(unit.collectionId, unit.path);
  roots.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  roots.forEach(unit => unit.children.sort((a, b) => sortKey(a).localeCompare(sortKey(b))));

  // Size + relative layout: a frame's cards stacked vertically, left-aligned.
  const unitId = (unit: Unit) =>
    unit.kind === 'card' && unit.group ? unit.group.key : wrapperId(unit.collectionId, unit.path);
  const sizeUnit = (unit: Unit) => {
    if (unit.kind === 'card') {
      unit.width = GROUP_WIDTH;
      unit.height = unit.group ? getGroupHeight(unit.group) : 0;
      return;
    }
    // The container's own body: the absorbed card's rows, directly under the
    // header, exactly where a leaf card draws them. Zero when nothing was
    // absorbed.
    const ownRows = unit.group && hiddenCardKeys.has(unit.group.key) ? 0 : getCardRowsHeight(unit.group);
    let y = CONTAINER_INSET + WRAPPER_HEADER_HEIGHT + ownRows + WRAPPER_PADDING;
    let maxW = 0;
    const visibleChildren = unit.children.filter(child => !(child.group && hiddenCardKeys.has(child.group.key)));
    unit.children.forEach(child => {
      if (!visibleChildren.includes(child)) {
        // Not drawn: parked at the first slot, taking no room.
        child.width = GROUP_WIDTH;
        child.height = 0;
        child.rel = { x: CONTAINER_INSET + WRAPPER_PADDING, y: CONTAINER_INSET + WRAPPER_HEADER_HEIGHT + ownRows + WRAPPER_PADDING };
        return;
      }
      sizeUnit(child);
      child.rel = { x: CONTAINER_INSET + WRAPPER_PADDING, y };
      y += child.height + WRAPPER_GAP;
      maxW = Math.max(maxW, child.width);
    });
    const minWidth = Math.max(maxW + (CONTAINER_INSET + WRAPPER_PADDING) * 2, GROUP_WIDTH);
    // A container with rows and no children is exactly a card's box — header
    // plus rows, no trailing dead space; only the dashed outline tells the
    // two apart. With nothing at all it keeps the empty frame's minimum.
    const minHeight = visibleChildren.length > 0
      ? y - WRAPPER_GAP + WRAPPER_PADDING + CONTAINER_INSET
      : CONTAINER_INSET * 2 + WRAPPER_HEADER_HEIGHT + (ownRows > 0 ? ownRows : WRAPPER_PADDING * 2);
    unit.width = minWidth;
    unit.height = minHeight;
  };
  roots.forEach(sizeUnit);

  return { roots, unitId };
}

/**
 * Build placements for standard cards, putting each inside the frame that
 * contains it.
 *
 * `groupedPaths` holds wrapper KEYS (`<collectionId>::<path>`), not bare
 * paths — a frame belongs to exactly one collection. Frames are one level:
 * when keys of one collection nest (which `flattenGroupedPaths` prevents on
 * every write), the OUTERMOST one is the frame and the inner key draws
 * nothing, so a card is never inside a frame inside a frame.
 *
 * `savedPositions` maps a top-level unit's id (card key or
 * `wrapper:<collectionId>::<path>`) to its absolute position. A frame's cards
 * have no saved position: they are always auto-stacked.
 *
 * `hiddenCardKeys` are cards a filter currently hides. A frame is sized and
 * stacked from its VISIBLE cards only, so it hugs them instead of keeping the
 * room of the hidden ones; hidden cards take no space (they are not drawn
 * anyway) and the frame grows back when the filter is lifted.
 *
 * Collection mode hands in every column unit's spot through `savedPositions`
 * (see resolveColumnPositions), so the packing below only ever fills in what
 * the record does not cover.
 */
export function buildWrapperLayout(
  cards: GroupData[],
  groupedPaths: Set<string>,
  savedPositions: Record<string, { x: number; y: number }>,
  hiddenCardKeys: ReadonlySet<string> = new Set()
): Placement[] {
  if (cards.length === 0) return [];

  const { roots, unitId } = buildUnitForest(cards, groupedPaths, hiddenCardKeys);

  // Natural absolute origin for a unit (used for top-level placement).
  const naturalPos = (unit: Unit): { x: number; y: number } => {
    if (unit.kind === 'card' && unit.group) {
      return { x: unit.group.initialX, y: unit.group.initialY };
    }
    // Wrapper: min over every card it draws — its own absorbed one included,
    // which for a lone grouped card is the ONLY card there is.
    let minX = Infinity;
    let minY = Infinity;
    const visit = (u: Unit) => {
      if (u.group) {
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
      const id = wrapperId(unit.collectionId, unit.path);
      placements.push({
        kind: 'wrapper', id, path: unit.path,
        collectionId: unit.collectionId, parentId: null, position,
        width: unit.width, height: unit.height,
        ...(unit.group ? { group: unit.group } : {}),
      });
      unit.children.forEach(child => emit(child, id, child.rel));
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

/**
 * The exact drawn size of every top-level unit `cards` fold into, keyed by
 * its node id (card key or `wrapper:<collectionId>::<path>`): the same sizing
 * buildWrapperLayout renders with, frames hugging their visible cards.
 */
export function measureWrapperFrames(
  cards: GroupData[],
  groupedPaths: Set<string>,
  hiddenCardKeys: ReadonlySet<string> = new Set()
): Map<string, { width: number; height: number }> {
  const sizes = new Map<string, { width: number; height: number }>();
  if (cards.length === 0) return sizes;
  const { roots, unitId } = buildUnitForest(cards, groupedPaths, hiddenCardKeys);
  roots.forEach(unit => sizes.set(unitId(unit), { width: unit.width, height: unit.height }));
  return sizes;
}
