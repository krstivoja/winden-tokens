// Collection mode (Grid Settings "Sort by: Collection") — the pure half.
//
// One column per collection, left to right in collection order. Inside a
// column the top-level units (loose cards, frames, managed chains) stack top
// to bottom in the sidebar tree's path order (compareGroupPaths), the
// collection root card first and an EMPTY root card last. Every column starts
// at y = 0 and is as wide as its widest visible unit; a collection with
// nothing visible takes no column and no gap.
//
// No depth walk, no connections, no node positions: the order is the path
// order, so the layout is deterministic and a drag never recomputes it.
//
// Units keep only their y when moved: the column x always comes from here
// (resolveColumnPositions for stored records, lockChangesToColumns for live
// drags), so nothing can leave its column.

import type { NodeChange } from '@xyflow/react';
import { compareGroupPaths } from '../../../utils/groupFilters';
import { GROUP_WIDTH, WRAPPER_NODE_PREFIX } from './constants';
import type { GroupData } from './types';
import { getGroupHeight, getManagedLane, outermostGroupedAncestor, parseWrapperKey } from './utils';
import { measureWrapperFrames } from './wrapperLayout';

type Point = { x: number; y: number };

/** One node drawn on a column line. */
export interface ColumnMember {
  /** xyflow node id (card key or `wrapper:<collectionId>::<path>`). */
  id: string;
  width: number;
  height: number;
  /** Not drawn: gets no position, still keeps its lane on the line. */
  hidden?: boolean;
}

/**
 * One top-level slot in a column: a loose card or frame (one member), or a
 * managed chain (source → shader → shades/steps) drawn as ONE horizontal line,
 * its members left to right, one lane each.
 */
export interface ColumnItem {
  collectionId: string;
  /** Sort path: the card's / frame's own path, '' for the collection root. */
  path: string;
  members: ColumnMember[];
  /** The collection-root card with no variables — always last in its column. */
  emptyRoot?: boolean;
}

export interface CollectionColumn {
  collectionId: string;
  x: number;
  width: number;
}

export interface CollectionColumnsLayout {
  /** Natural spot of every visible member, by node id. */
  positions: Map<string, Point>;
  /** Columns that hold something visible, left to right. */
  columns: CollectionColumn[];
  /** Right edge of the last column (0 when there is none). */
  maxRight: number;
}

export interface CollectionColumnsInput {
  items: ColumnItem[];
  /** Collection ids in display order; unknown collections go last, by id. */
  collectionOrder: string[];
  gapX: number;
  gapY: number;
}

const isVisible = (item: ColumnItem) => item.members.some(member => !member.hidden);

/** Lane offsets of a line's members and the line's drawn extent. */
function measureLine(item: ColumnItem, gapX: number) {
  const offsets: number[] = [];
  let x = 0;
  let width = 0;
  let height = 0;
  item.members.forEach(member => {
    offsets.push(x);
    if (!member.hidden) {
      width = Math.max(width, x + member.width);
      height = Math.max(height, member.height);
    }
    x += member.width + gapX;
  });
  return { offsets, width, height };
}

function compareItems(a: ColumnItem, b: ColumnItem): number {
  if (!!a.emptyRoot !== !!b.emptyRoot) return a.emptyRoot ? 1 : -1;
  return compareGroupPaths(a.path, b.path)
    || (a.members[0]?.id ?? '').localeCompare(b.members[0]?.id ?? '');
}

export function layoutCollectionColumns(input: CollectionColumnsInput): CollectionColumnsLayout {
  const { items, collectionOrder, gapX, gapY } = input;
  const rank = (collectionId: string) => {
    const index = collectionOrder.indexOf(collectionId);
    return index < 0 ? collectionOrder.length : index;
  };

  const byCollection = new Map<string, ColumnItem[]>();
  items.forEach(item => {
    if (!isVisible(item)) return;
    const list = byCollection.get(item.collectionId) || [];
    list.push(item);
    byCollection.set(item.collectionId, list);
  });
  const collectionIds = Array.from(byCollection.keys())
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

  const positions = new Map<string, Point>();
  const columns: CollectionColumn[] = [];
  let x = 0;
  collectionIds.forEach(collectionId => {
    const columnItems = (byCollection.get(collectionId) || []).slice().sort(compareItems);
    let y = 0;
    let width = 0;
    columnItems.forEach(item => {
      const line = measureLine(item, gapX);
      item.members.forEach((member, index) => {
        if (!member.hidden) positions.set(member.id, { x: x + line.offsets[index], y });
      });
      width = Math.max(width, line.width);
      y += line.height + gapY;
    });
    columns.push({ collectionId, x, width });
    x += width + gapX;
  });

  const last = columns[columns.length - 1];
  return { positions, columns, maxRight: last ? last.x + last.width : 0 };
}

/**
 * Every top-level unit of `groups` as a column item, sized exactly as it is
 * drawn: loose cards and frames (a frame hugs its visible cards, as
 * buildWrapperLayout draws it), and each managed chain as one line in lane
 * order. `isHidden` is the visibility the layout must respect — a frame is
 * hidden only when every card in it is.
 */
export function buildCollectionColumnItems(
  groups: GroupData[],
  groupedPaths: Set<string>,
  isHidden: (group: GroupData) => boolean
): ColumnItem[] {
  const isLayoutCard = (g: GroupData) => g.kind === 'standard' || g.kind === 'collection';
  const layoutCards = groups.filter(isLayoutCard);
  const hiddenCardKeys = new Set(layoutCards.filter(isHidden).map(g => g.key));
  const sizes = measureWrapperFrames(layoutCards, groupedPaths, hiddenCardKeys);

  const units = new Map<string, ColumnItem>();
  layoutCards.forEach(card => {
    const path = card.sourceGroupName || '';
    const frameKey = outermostGroupedAncestor(card.collectionId, path, groupedPaths);
    const id = frameKey ? `${WRAPPER_NODE_PREFIX}${frameKey}` : card.key;
    const hidden = hiddenCardKeys.has(card.key);
    const existing = units.get(id);
    if (existing) {
      // A frame is on screen while any of its cards is.
      existing.members[0].hidden = existing.members[0].hidden && hidden;
      return;
    }
    const size = sizes.get(id) ?? { width: GROUP_WIDTH, height: getGroupHeight(card) };
    units.set(id, {
      collectionId: card.collectionId,
      path: frameKey ? (parseWrapperKey(frameKey)?.path ?? '') : path,
      members: [{ id, width: size.width, height: size.height, hidden }],
      ...(!frameKey && card.kind === 'collection' && card.variables.length === 0 ? { emptyRoot: true } : {}),
    });
  });

  // Managed chains: one line per source, lanes in order.
  const chains = new Map<string, GroupData[]>();
  groups.forEach(group => {
    if (getManagedLane(group) === null || !group.sourceGroupName) return;
    const key = `${group.collectionId}::${group.sourceGroupName}`;
    chains.set(key, [...(chains.get(key) || []), group]);
  });
  const chainItems: ColumnItem[] = Array.from(chains.values()).map(chain => {
    const ordered = chain.slice().sort((a, b) => (getManagedLane(a) ?? 0) - (getManagedLane(b) ?? 0));
    return {
      collectionId: ordered[0].collectionId,
      path: ordered[0].sourceGroupName || '',
      members: ordered.map(group => ({
        id: group.key, width: GROUP_WIDTH, height: getGroupHeight(group), hidden: isHidden(group),
      })),
    };
  });

  return [...units.values(), ...chainItems];
}

/**
 * The record a Collection-mode layout pass reads: every column unit at its
 * column's x and its saved y (natural y when it has none) — a saved x is never
 * trusted, so no stored record can pull a unit out of its column. Ids the
 * column layout does not place (library cards, the selection card, hidden
 * units) keep their saved spot untouched.
 */
export function resolveColumnPositions(
  saved: Readonly<Record<string, Point>>,
  natural: ReadonlyMap<string, Point>
): Record<string, Point> {
  const out: Record<string, Point> = { ...saved };
  natural.forEach((pos, id) => {
    out[id] = { x: pos.x, y: saved[id]?.y ?? pos.y };
  });
  return out;
}

/**
 * Collection mode's drag lock: every position change of a column unit gets
 * its column's x back, so a mouse drag, a multi-selection drag and a keyboard
 * move all slide it vertically only. Width-independent and exact; other ids
 * and other change types pass through untouched, and an empty map (Tier mode)
 * returns the very same array.
 */
export function lockChangesToColumns<T extends NodeChange>(
  changes: T[],
  lockedX: ReadonlyMap<string, number>
): T[] {
  if (lockedX.size === 0) return changes;
  let changed = false;
  const out = changes.map(change => {
    if (change.type !== 'position') return change;
    const x = lockedX.get(change.id);
    if (x === undefined) return change;
    changed = true;
    return {
      ...change,
      ...(change.position ? { position: { ...change.position, x } } : {}),
      ...(change.positionAbsolute ? { positionAbsolute: { ...change.positionAbsolute, x } } : {}),
    };
  });
  return changed ? out : changes;
}
