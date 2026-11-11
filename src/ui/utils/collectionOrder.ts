// Collection order: the Figma API returns collections in creation order and
// exposes no order field, so Winden stores its own order in the file and
// resolves it against the live collections here. Pure functions only.

import type { CollectionOrderEntry, StoredCollectionOrder } from '../types';

export const MAX_COLLECTION_ORDER_ENTRIES = 1000;

// Validates a stored order exactly like the sandbox's
// `sanitizeCollectionOrderEntries` (src/plugin/code.ts): anything other than a
// well-formed v1 object, or any malformed entry, reads as `null` (API order).
// Ids are deduplicated (first wins) and the list is capped at 1000 unique
// entries; entries past the cap are not looked at.
export function parseCollectionOrder(raw: unknown): StoredCollectionOrder | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const candidate = raw as { v?: unknown; entries?: unknown };
  if (candidate.v !== 1 || !Array.isArray(candidate.entries)) return null;

  const seen = new Set<string>();
  const entries: CollectionOrderEntry[] = [];
  for (const entry of candidate.entries) {
    if (!entry || typeof entry !== 'object') return null;
    const { id, name } = entry as { id?: unknown; name?: unknown };
    if (typeof id !== 'string' || typeof name !== 'string') return null;
    if (seen.has(id)) continue;
    seen.add(id);
    entries.push({ id, name });
    if (entries.length >= MAX_COLLECTION_ORDER_ENTRIES) break;
  }
  return { v: 1, entries };
}

// Applies a stored order to live collections in two passes:
// 1. each entry claims the collection with the same id;
// 2. each still-unmatched entry claims the first unclaimed collection with
//    the same name, in API order.
// Claimed collections come in entry order, then unclaimed ones in API order.
// A stale entry therefore never takes the slot of a collection matched by id.
export function resolveCollectionOrder<T extends { id: string; name: string }>(
  collections: T[],
  stored: StoredCollectionOrder | null
): T[] {
  if (!stored || stored.entries.length === 0 || collections.length === 0) {
    return collections;
  }

  const entries = stored.entries;
  const byId = new Map<string, number>();
  collections.forEach((collection, index) => {
    if (!byId.has(collection.id)) byId.set(collection.id, index);
  });

  const claimedBy: Array<number | undefined> = new Array(entries.length);
  const claimed = new Set<number>();

  entries.forEach((entry, entryIndex) => {
    const index = byId.get(entry.id);
    if (index !== undefined && !claimed.has(index)) {
      claimed.add(index);
      claimedBy[entryIndex] = index;
    }
  });

  entries.forEach((entry, entryIndex) => {
    if (claimedBy[entryIndex] !== undefined) return;
    const index = collections.findIndex(
      (collection, i) => !claimed.has(i) && collection.name === entry.name
    );
    if (index !== -1) {
      claimed.add(index);
      claimedBy[entryIndex] = index;
    }
  });

  const result: T[] = [];
  for (const index of claimedBy) {
    if (index !== undefined) result.push(collections[index]);
  }
  collections.forEach((collection, index) => {
    if (!claimed.has(index)) result.push(collection);
  });
  return result;
}

// Stable sort by the rank of each variable's collection. Variables whose
// collection is not in `ordered` keep their relative order at the end.
export function sortVariablesByCollectionOrder<V extends { collectionId: string }>(
  variables: V[],
  ordered: { id: string }[]
): V[] {
  const rank = new Map<string, number>();
  ordered.forEach((collection, index) => {
    if (!rank.has(collection.id)) rank.set(collection.id, index);
  });
  const fallback = ordered.length;
  return variables
    .map((variable, index) => ({ variable, index, rank: rank.get(variable.collectionId) ?? fallback }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(item => item.variable);
}

// Moves `dragged` before or after `target`. Returns `ids` unchanged (same
// array) when either id is unknown or the move changes nothing.
export function moveCollectionId(
  ids: string[],
  dragged: string,
  target: string,
  pos: 'before' | 'after'
): string[] {
  if (dragged === target) return ids;
  if (!ids.includes(dragged) || !ids.includes(target)) return ids;

  const without = ids.filter(id => id !== dragged);
  const targetIndex = without.indexOf(target);
  const insertAt = pos === 'before' ? targetIndex : targetIndex + 1;
  const next = [...without.slice(0, insertAt), dragged, ...without.slice(insertAt)];

  return next.every((id, index) => id === ids[index]) ? ids : next;
}

export function buildCollectionOrder(ordered: { id: string; name: string }[]): StoredCollectionOrder {
  return {
    v: 1,
    entries: ordered.map(({ id, name }) => ({ id, name })),
  };
}
