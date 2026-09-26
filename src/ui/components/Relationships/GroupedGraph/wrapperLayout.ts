// Layout for expanded group "wrapper" frames.
//
// Given the flat list of standard (unmanaged) cards plus the collection root
// cards, and the set of expanded frames, this builds a nested tree of wrapper
// frames containing cards and computes React-Flow positions. Cards/wrappers
// inside a wrapper use positions relative to that wrapper (React Flow
// parent-node coordinates); top-level units use absolute positions.
//
// A frame is identified by `<collectionId>::<path>`, where the empty path is
// the collection's own frame — see getWrapperKey in ./utils.

import { GroupData } from './types';
import {
  GROUP_WIDTH,
  WRAPPER_HEADER_HEIGHT,
  WRAPPER_PADDING,
  CARD_BOX_PADDING,
  WRAPPER_GAP,
  WRAPPER_NODE_PREFIX,
} from './constants';
import { getCardRowsHeight, getGroupHeight, getWrapperKey, parseWrapperKey } from './utils';

export interface WrapperPlacement {
  kind: 'wrapper';
  /** `wrapper:<collectionId>::<path>` — the React Flow node id. */
  id: string;
  /** Bare path, empty for a collection's own frame. */
  path: string;
  collectionId: string;
  parentId: string | null;
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
  rel: { x: number; y: number };
}

/**
 * Deepest grouped frame containing `(collectionId, path)` — the wrapper it
 * belongs in, as a wrapper KEY (`<collectionId>::<path>`).
 *
 * Depth 0 is the collection's own frame: every card of that collection is in
 * it, including the collection ROOT card whose path is empty and which
 * belongs to no other frame.
 *
 * `includeSelf` decides whether `path` itself counts:
 * - Cards pass `true`. The card for path `p` lives INSIDE the frame named `p`
 *   (a card `test` and a card `test/test` are both members of frame `test`);
 *   treating it as a sibling is what parked it thousands of pixels away.
 * - Wrapper units pass `false`, and must. A wrapper's own path is grouped by
 *   definition, so a self-match would make frame `p` its own parent — and the
 *   deepest-match walk would pick that self-match over the real parent `p`'s
 *   ancestor. Strict prefixes are strictly shorter and the chain bottoms out
 *   at the collection frame (`<cid>::`), which has no candidates at all, so
 *   the wrapper→parent walk always terminates:
 *   `<cid>::a/b` → `<cid>::a` → `<cid>::` → nothing.
 */
function deepestGroupedAncestor(
  collectionId: string,
  path: string,
  grouped: Set<string>,
  includeSelf: boolean
): string | null {
  const parts = path ? path.split('/') : [];
  const maxDepth = includeSelf ? parts.length : parts.length - 1;
  let result: string | null = null;
  for (let depth = 0; depth <= maxDepth; depth++) {
    const key = getWrapperKey(collectionId, parts.slice(0, depth).join('/'));
    if (grouped.has(key)) result = key;
  }
  return result;
}

const wrapperId = (collectionId: string, path: string) =>
  `${WRAPPER_NODE_PREFIX}${getWrapperKey(collectionId, path)}`;

/**
 * Build placements for standard cards, nesting them inside wrapper frames for
 * every expanded ancestor path. Managed groups are not handled here.
 *
 * `groupedPaths` holds wrapper KEYS (`<collectionId>::<path>`), not bare
 * paths — a frame belongs to exactly one collection.
 *
 * `savedPositions` holds two namespaces in one record: a top-level unit's id
 * (card key or `wrapper:<collectionId>::<path>`) maps to its absolute position, while
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

  // Collect wrapper frames actually needed (grouped ancestors of some card),
  // as `<collectionId>::<path>` keys.
  const wrapperKeys = new Set<string>();
  cards.forEach(card => {
    const path = card.sourceGroupName || '';
    const parts = path ? path.split('/') : [];
    // From depth 0 (the collection's own frame, which a collection ROOT card
    // joins) through `parts.length`: a card whose own path is grouped needs
    // that frame to exist, otherwise attach() below would look for a wrapper
    // that was never created and the card would silently pop back out to the
    // top level — and Arrange (outermostGroupedAncestor) would still fold it
    // into the missing frame's unit. The two walks have to agree.
    for (let depth = 0; depth <= parts.length; depth++) {
      const key = getWrapperKey(card.collectionId, parts.slice(0, depth).join('/'));
      if (groupedPaths.has(key)) wrapperKeys.add(key);
    }
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

  // Link units to parents.
  const roots: Unit[] = [];
  const attach = (unit: Unit) => {
    // Cards may land in the frame named after their own path; wrappers may
    // not (see deepestGroupedAncestor) — that is what keeps the tree acyclic.
    const parentKey = deepestGroupedAncestor(
      unit.collectionId, unit.path, groupedPaths, unit.kind === 'card'
    );
    const parentId = parentKey ? `${WRAPPER_NODE_PREFIX}${parentKey}` : null;
    if (parentId && units.has(parentId)) {
      units.get(parentId)!.children.push(unit);
    } else {
      roots.push(unit);
    }
  };
  units.forEach(unit => attach(unit));

  // Stable ordering by collection then path. Within one frame every child
  // shares the collection, so this reduces to the path comparison it was.
  const sortKey = (unit: Unit) => getWrapperKey(unit.collectionId, unit.path);
  const sortChildren = (unit: Unit) => {
    unit.children.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    unit.children.forEach(sortChildren);
  };
  roots.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  roots.forEach(sortChildren);

  // Size + relative layout: cards/sub-wrappers stacked vertically,
  // left-aligned, inside the wrapper — unless the user dragged one to a
  // manual spot (rel:<id> in savedPositions), in which case that position
  // wins and the auto-stack skips over it for the *other* children.
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
    const ownRows = getCardRowsHeight(unit.group);
    let y = CARD_BOX_PADDING + WRAPPER_HEADER_HEIGHT + ownRows + WRAPPER_PADDING;
    let maxW = 0;
    let maxRight = 0;
    let maxBottom = 0;
    unit.children.forEach(child => {
      sizeUnit(child);
      const manualRel = savedPositions[`rel:${unitId(child)}`];
      if (manualRel) {
        child.rel = manualRel;
      } else {
        child.rel = { x: CARD_BOX_PADDING + WRAPPER_PADDING, y };
        y += child.height + WRAPPER_GAP;
      }
      maxW = Math.max(maxW, child.width);
      maxRight = Math.max(maxRight, child.rel.x + child.width);
      maxBottom = Math.max(maxBottom, child.rel.y + child.height);
    });
    const minWidth = Math.max(maxW + (CARD_BOX_PADDING + WRAPPER_PADDING) * 2, GROUP_WIDTH);
    // A container with rows and no children is exactly a card's box — header
    // plus rows, no trailing dead space; only the dashed outline tells the
    // two apart. With nothing at all it keeps the empty frame's minimum.
    const minHeight = unit.children.length > 0
      ? y - WRAPPER_GAP + WRAPPER_PADDING + CARD_BOX_PADDING
      : CARD_BOX_PADDING * 2 + WRAPPER_HEADER_HEIGHT + (ownRows > 0 ? ownRows : WRAPPER_PADDING * 2);
    // Bounding box of all children (auto-stacked and manually placed) never
    // shrinks the wrapper below what the auto-stack alone would need.
    unit.width = Math.max(minWidth, maxRight + WRAPPER_PADDING + CARD_BOX_PADDING);
    unit.height = Math.max(minHeight, maxBottom + WRAPPER_PADDING + CARD_BOX_PADDING);
  };
  roots.forEach(sizeUnit);

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
        collectionId: unit.collectionId, parentId, position,
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
