// Collection mode (Grid Settings "Sort by: Collection") — the stored card order.
//
// Each column is an always-packed ordered list of its top-level units (loose
// cards, frames, managed chains). The order lives in client storage under
// `graph-order-collection`, one entry per collection. Entries are matched to
// live collections by id, then by name, and items are keyed by PATH, never by
// node id, so the order survives a Winden undo (which recreates every id).
//
// Item keys:
// - `path:<path>` — a loose card or a frame. Shared namespace on purpose, so a
//   frame created over a card, level-up and ungroup all keep the slot.
//   `path:` (empty) is the collection root card or the collection's own frame.
// - `chain:<sourceGroupName>` — a managed chain (source → shader → shades).
//
// Pure functions only; no y is ever stored for a column unit.

import { compareItems as compareNatural } from './columnLayout';
import type { ColumnItem } from './columnLayout';
import { WRAPPER_NODE_PREFIX } from './constants';
import { isPathInScope } from './sidebarFocus';

type Point = { x: number; y: number };
export type PositionRecord = Record<string, Point>;

export interface ColumnOrderEntry {
  /** Live collection id at the last write. */
  id: string;
  /** Live collection name at the last write — the fallback match after an undo. */
  name: string;
  /** Item keys top to bottom (see getColumnItemKey). */
  items: string[];
}

export interface ColumnOrderRecord {
  v: 1;
  columns: ColumnOrderEntry[];
}

const PATH_KEY_PREFIX = 'path:';
const CHAIN_KEY_PREFIX = 'chain:';

/** A managed chain item (keyed `chain:`). */
const isChainItem = (item: ColumnItem) => item.chain === true;

const isFrameItem = (item: ColumnItem) =>
  !isChainItem(item) && (item.members[0]?.id ?? '').startsWith(WRAPPER_NODE_PREFIX);

const isItemVisible = (item: ColumnItem) => item.members.some(member => !member.hidden);

/**
 * Validates a stored record. Anything other than a well-formed v1 object, or
 * any malformed column entry, reads as `null` (natural order everywhere).
 * Column ids are deduplicated (first wins), as are item keys inside a column.
 */
export function parseColumnOrder(raw: unknown): ColumnOrderRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const candidate = raw as { v?: unknown; columns?: unknown };
  if (candidate.v !== 1 || !Array.isArray(candidate.columns)) return null;

  const seenIds = new Set<string>();
  const columns: ColumnOrderEntry[] = [];
  for (const entry of candidate.columns) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const { id, name, items } = entry as { id?: unknown; name?: unknown; items?: unknown };
    if (typeof id !== 'string' || typeof name !== 'string' || !Array.isArray(items)) return null;
    if (!items.every(key => typeof key === 'string')) return null;
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    columns.push({ id, name, items: Array.from(new Set(items as string[])) });
  }
  return { v: 1, columns };
}

/** `chain:<sourceGroupName>` for a managed chain, otherwise `path:<path>`. */
export function getColumnItemKey(item: ColumnItem): string {
  return (isChainItem(item) ? CHAIN_KEY_PREFIX : PATH_KEY_PREFIX) + item.path;
}

/**
 * Stored order per live collection id, matched in two passes like
 * resolveCollectionOrder (src/ui/utils/collectionOrder.ts):
 * 1. each entry claims the collection with the same id;
 * 2. each still-unmatched entry claims the first unclaimed collection with the
 *    same name, in the given order.
 * A stale entry therefore never takes the slot of a collection matched by id.
 * Collections with no entry are absent (= natural order). The returned arrays
 * are the record's own — read them, never mutate them.
 */
export function matchColumnOrders(
  collections: { id: string; name: string }[],
  record: ColumnOrderRecord | null
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (!record) return out;
  matchColumnEntries(collections, record.columns).forEach((index, collectionId) => {
    out.set(collectionId, record.columns[index].items);
  });
  return out;
}

/** The two-pass match of matchColumnOrders: live collection id → entry index. */
function matchColumnEntries(
  collections: { id: string; name: string }[],
  columns: ColumnOrderEntry[]
): Map<string, number> {
  const out = new Map<string, number>();
  if (columns.length === 0 || collections.length === 0) return out;
  const liveIds = new Set(collections.map(collection => collection.id));
  const unmatched: number[] = [];
  columns.forEach((entry, index) => {
    if (liveIds.has(entry.id) && !out.has(entry.id)) out.set(entry.id, index);
    else unmatched.push(index);
  });
  unmatched.forEach(index => {
    const collection = collections.find(c => c.name === columns[index].name && !out.has(c.id));
    if (collection) out.set(collection.id, index);
  });
  return out;
}

/**
 * One column's items (hidden ones too) in display order.
 *
 * - No stored order: natural order.
 * - Known keys come in stored order. Stored keys with no live item are
 *   skipped (pruned only when that column is next written, never on read).
 * - An unknown frame `path:p` takes the slot of the first stored `path:` key
 *   at or below `p` that no longer exists (the frame absorbed that card).
 * - An unknown empty root card goes last.
 * - Any other unknown item goes right after its nearest natural-order
 *   predecessor already in the list, else at the front. After an ungroup the
 *   freed cards therefore follow `path:p` with no special case.
 */
export function orderColumnItems(items: ColumnItem[], stored?: string[]): ColumnItem[] {
  const natural = items.slice().sort(compareNatural);
  if (!stored) return natural;

  const byKey = new Map<string, ColumnItem[]>();
  natural.forEach(item => {
    const key = getColumnItemKey(item);
    byKey.set(key, [...(byKey.get(key) || []), item]);
  });

  // Slots: live keys and deleted placeholders, in stored order.
  type Slot = { key: string; live: boolean };
  const slots: Slot[] = [];
  const known = new Set<string>();
  stored.forEach(key => {
    if (known.has(key)) return;
    known.add(key);
    slots.push({ key, live: byKey.has(key) });
  });

  const unknown = natural.filter(item => !known.has(getColumnItemKey(item)));
  const placed = new Set<ColumnItem>();
  const order: ColumnItem[] = [];

  // New frames claim the first deleted slot they absorbed.
  const frameAt = new Map<number, ColumnItem>();
  unknown.forEach(item => {
    if (!isFrameItem(item)) return;
    const slotIndex = slots.findIndex((slot, index) =>
      !slot.live
      && !frameAt.has(index)
      && slot.key.startsWith(PATH_KEY_PREFIX)
      && isPathInScope(slot.key.slice(PATH_KEY_PREFIX.length), item.path)
    );
    if (slotIndex !== -1) {
      frameAt.set(slotIndex, item);
      placed.add(item);
    }
  });

  slots.forEach((slot, index) => {
    const frame = frameAt.get(index);
    if (frame) order.push(frame);
    else if (slot.live) (byKey.get(slot.key) || []).forEach(item => order.push(item));
  });
  order.forEach(item => placed.add(item));

  const emptyRoots: ColumnItem[] = [];
  unknown.forEach(item => {
    if (placed.has(item)) return;
    if (item.emptyRoot) {
      emptyRoots.push(item);
      return;
    }
    const naturalIndex = natural.indexOf(item);
    let insertAt = 0;
    for (let i = naturalIndex - 1; i >= 0; i--) {
      const at = order.indexOf(natural[i]);
      if (at !== -1) {
        insertAt = at + 1;
        break;
      }
    }
    order.splice(insertAt, 0, item);
    placed.add(item);
  });

  return [...order, ...emptyRoots];
}

export type MoveTarget = { kind: 'index'; index: number } | { kind: 'step'; delta: 1 | -1 };

/**
 * Moves `moved` keys within one column's `order`.
 *
 * The moved keys keep their relative order (as in `order`) and land as one
 * contiguous block. Positions count VISIBLE keys only; hidden keys keep
 * their places.
 * - `index`: insert before the visible item at that index among the remaining
 *   (not moved) visible items; an index past the last puts the block right
 *   after the last remaining visible item. Negative clamps to 0.
 * - `step`: one visible slot up (-1) or down (+1), skipping hidden keys; at
 *   either end nothing changes.
 * Returns the SAME array when the visible order does not change.
 */
export function moveItems(
  order: string[],
  visibleKeys: ReadonlySet<string>,
  moved: string[],
  target: MoveTarget
): string[] {
  const movedSet = new Set(moved.filter(key => order.includes(key)));
  if (movedSet.size === 0) return order;

  const block = order.filter(key => movedSet.has(key));
  const remaining = order.filter(key => !movedSet.has(key));
  const remainingVisible = remaining.filter(key => visibleKeys.has(key));

  let index: number;
  if (target.kind === 'step') {
    // Remaining visible items before the first / last moved key.
    const visibleBefore = (key: string) => {
      const at = order.indexOf(key);
      return order.slice(0, at).filter(k => !movedSet.has(k) && visibleKeys.has(k)).length;
    };
    if (target.delta < 0) {
      const before = visibleBefore(block[0]);
      if (before === 0) return order;
      index = before - 1;
    } else {
      const before = visibleBefore(block[block.length - 1]);
      if (before >= remainingVisible.length) return order;
      index = before + 1;
    }
  } else {
    index = Math.max(0, Math.floor(target.index));
  }

  let insertAt: number;
  if (index < remainingVisible.length) {
    insertAt = remaining.indexOf(remainingVisible[index]);
  } else if (remainingVisible.length > 0) {
    insertAt = remaining.indexOf(remainingVisible[remainingVisible.length - 1]) + 1;
  } else {
    insertAt = remaining.length;
  }
  const next = [...remaining.slice(0, insertAt), ...block, ...remaining.slice(insertAt)];

  const visibleOf = (keys: string[]) => keys.filter(key => visibleKeys.has(key) || movedSet.has(key));
  const before = visibleOf(order);
  const after = visibleOf(next);
  return after.every((key, i) => key === before[i]) ? order : next;
}

/**
 * The record with `collection`'s column set to `order` (the caller's resolved
 * order, i.e. live keys only — that is the prune), stamped with the live id
 * and name. The column's entry is the one matchColumnOrders gives
 * `collection` among the `live` collections: by id, else a stale entry (its
 * id not live, e.g. after an undo) by name — never the entry of another live
 * collection that shares the name. It keeps its place, or is appended. Other
 * columns pass through verbatim. Never mutates `record`.
 */
export function writeColumnOrder(
  record: ColumnOrderRecord | null,
  collection: { id: string; name: string },
  order: string[],
  live: { id: string; name: string }[]
): ColumnOrderRecord {
  const columns = record ? record.columns.slice() : [];
  const entry: ColumnOrderEntry = {
    id: collection.id,
    name: collection.name,
    items: Array.from(new Set(order)),
  };
  const liveWithTarget = live.some(c => c.id === collection.id) ? live : [...live, collection];
  const at = matchColumnEntries(liveWithTarget, columns).get(collection.id);
  if (at === undefined) columns.push(entry);
  else columns[at] = entry;
  return { v: 1, columns };
}

/** One Collection-mode column, as migrateCollectionPositions reads it. */
export interface MigrationColumn {
  /** The live collection — stamped on the written entry. */
  collection: { id: string; name: string };
  /**
   * Every top-level unit of the column, hidden ones too
   * (buildCollectionColumnItems). Member ids are the xyflow node ids the
   * legacy record was keyed by: the card key (`group:<cid>::<path>`,
   * `collection:<cid>`), the frame (`wrapper:<cid>::<path>`, `wrapper:<cid>::`
   * for the collection's own frame), or a chain's lanes
   * (`source:` / `shader:` / `shades:` keys).
   */
  items: ColumnItem[];
  /**
   * Natural position by node id from an ALL-VISIBLE natural pack of this
   * column; an item's natural y is the smallest y among its members.
   */
  natural: ReadonlyMap<string, Point>;
  /**
   * Other node ids that belong to this column but are not item members
   * (cards absorbed into a frame). Stripped from `free`, never read for y.
   */
  absorbedIds?: Iterable<string>;
}

/**
 * One-time move from the legacy y record (`graph-positions-collection` keyed
 * by node id) to `graph-order-collection`.
 *
 * Per column: every item gets its stored y when any member id is in `legacy`
 * (the smallest one), else its natural y; items sort by that y, ties in
 * natural order. A column gets an entry only when at least one item had a
 * stored y; `order` is null when no column did.
 * `free` is `legacy` minus every column member and absorbed id — what stays
 * in `graph-positions-collection` (library and selection cards).
 */
export function migrateCollectionPositions(
  legacy: Readonly<PositionRecord> | null,
  columns: MigrationColumn[]
): { order: ColumnOrderRecord | null; free: PositionRecord } {
  const stored: Readonly<PositionRecord> = legacy || {};
  const columnIds = new Set<string>();
  const entries: ColumnOrderEntry[] = [];

  columns.forEach(column => {
    let anyStored = false;
    const ranked = column.items.slice().sort(compareNatural).map((item, naturalIndex) => {
      const storedYs: number[] = [];
      const naturalYs: number[] = [];
      item.members.forEach(member => {
        columnIds.add(member.id);
        const saved = stored[member.id];
        if (saved && Number.isFinite(saved.y)) storedYs.push(saved.y);
        const natural = column.natural.get(member.id);
        if (natural) naturalYs.push(natural.y);
      });
      if (storedYs.length > 0) anyStored = true;
      const y = storedYs.length > 0
        ? Math.min(...storedYs)
        : naturalYs.length > 0 ? Math.min(...naturalYs) : Number.POSITIVE_INFINITY;
      return { key: getColumnItemKey(item), y, naturalIndex };
    });
    for (const id of column.absorbedIds ?? []) columnIds.add(id);
    if (!anyStored) return;

    ranked.sort((a, b) => (a.y === b.y ? 0 : a.y < b.y ? -1 : 1) || a.naturalIndex - b.naturalIndex);
    entries.push({
      id: column.collection.id,
      name: column.collection.name,
      items: Array.from(new Set(ranked.map(entry => entry.key))),
    });
  });

  const free: PositionRecord = {};
  Object.entries(stored).forEach(([id, point]) => {
    if (!columnIds.has(id)) free[id] = point;
  });

  return { order: entries.length > 0 ? { v: 1, columns: entries } : null, free };
}
