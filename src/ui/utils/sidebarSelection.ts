// Selection math for the sidebar Collections tree. A row click never toggles a
// checkbox: it replaces the selection (plain click) or flips one row in it
// (Cmd/Ctrl-click). The selection itself keeps its two-set shape (collection
// ids + `<collectionId>::<group>` keys) so the table, the graph and "Hide
// unused" keep reading it unchanged.

import type { SidebarSelection } from '../components/Relationships/GroupedGraph/hideUnused';

export type { SidebarSelection };

/** Every collection and, per collection, every real group key it owns. */
export interface SidebarUniverse {
  collectionIds: string[];
  groupKeysByCollection: Map<string, string[]>;
}

/**
 * One row of the tree. `groupKeys` of a group row is the row's own group plus
 * every descendant group (a folder row carries only its descendants).
 */
export type SidebarRow =
  | { kind: 'root' }
  | { kind: 'collection'; collectionId: string }
  | { kind: 'group'; collectionId: string; groupKeys: string[] };

export interface RowKeys {
  collectionIds: string[];
  groupKeys: string[];
}

const allGroupKeys = (universe: SidebarUniverse): string[] =>
  universe.collectionIds.flatMap(id => universe.groupKeysByCollection.get(id) ?? []);

/** The collections and group keys a row stands for. */
export function rowKeys(row: SidebarRow, universe: SidebarUniverse): RowKeys {
  switch (row.kind) {
    case 'root':
      return { collectionIds: universe.collectionIds, groupKeys: allGroupKeys(universe) };
    case 'collection':
      return {
        collectionIds: [row.collectionId],
        groupKeys: universe.groupKeysByCollection.get(row.collectionId) ?? [],
      };
    case 'group':
      return { collectionIds: [row.collectionId], groupKeys: row.groupKeys };
  }
}

/**
 * Plain click. Root: everything. Collection: only that collection (the other
 * collections hide). Group: every collection stays selected and every other
 * collection keeps all its groups, only the clicked collection narrows to the
 * clicked group's keys, so a group click never hides another collection.
 */
export function selectOnly(row: SidebarRow, universe: SidebarUniverse): SidebarSelection {
  const keys = rowKeys(row, universe);
  if (row.kind !== 'group') {
    return { collections: new Set(keys.collectionIds), groups: new Set(keys.groupKeys) };
  }
  const groups = new Set<string>();
  universe.collectionIds.forEach(id => {
    if (id === row.collectionId) return;
    (universe.groupKeysByCollection.get(id) ?? []).forEach(key => groups.add(key));
  });
  keys.groupKeys.forEach(key => groups.add(key));
  return { collections: new Set(universe.collectionIds), groups };
}

const ownKeys = (universe: SidebarUniverse, id: string): string[] =>
  universe.groupKeysByCollection.get(id) ?? [];

/** Some group of the collection is not selected: it shows only part of itself. */
const isNarrowed = (current: SidebarSelection, universe: SidebarUniverse, id: string): boolean =>
  ownKeys(universe, id).some(key => !current.groups.has(key));

const allCollectionsSelected = (current: SidebarSelection, universe: SidebarUniverse): boolean =>
  universe.collectionIds.every(id => current.collections.has(id));

/**
 * Whether the row is one the user picked (as opposed to merely visible).
 * With every collection selected a collection is only "visible", and a group
 * is picked when it is fully selected inside a narrowed collection. With a
 * collection subset, a collection with all its groups is picked and so is
 * every group under it. Nothing is picked while everything is selected.
 */
export function isRowMarked(
  current: SidebarSelection,
  row: SidebarRow,
  universe: SidebarUniverse
): boolean {
  if (row.kind === 'root') return isEverythingSelected(current, universe);
  if (isEverythingSelected(current, universe)) return false;
  const id = row.collectionId;
  if (!current.collections.has(id)) return false;
  const narrowed = isNarrowed(current, universe, id);
  if (row.kind === 'group' && narrowed) return row.groupKeys.every(key => current.groups.has(key));
  return !narrowed && !allCollectionsSelected(current, universe);
}

/** Whether every collection and group key the row stands for is selected. */
export function isRowSelected(
  current: SidebarSelection,
  row: SidebarRow,
  universe: SidebarUniverse
): boolean {
  const keys = rowKeys(row, universe);
  return (
    keys.collectionIds.length > 0 &&
    keys.collectionIds.every(id => current.collections.has(id)) &&
    keys.groupKeys.every(key => current.groups.has(key))
  );
}

/** True when every collection and every group is selected. */
export function isEverythingSelected(current: SidebarSelection, universe: SidebarUniverse): boolean {
  return isRowSelected(current, { kind: 'root' }, universe);
}

/**
 * Cmd/Ctrl-click. A picked row (see `isRowMarked`) leaves the selection, a
 * row that is not picked joins it:
 * - collection: leaves with its groups / joins with all of them;
 * - group in a narrowed collection: its keys leave (the collection goes when
 *   none are left, or returns to fully visible when every collection is
 *   selected) / its keys join, adding the collection if needed;
 * - group of a collection that is fully visible alongside the others:
 *   the collection narrows to that group.
 * A removal that would empty the selection or fall back to everything
 * returns `current` unchanged, so the last picked row stays.
 */
export function toggleRow(
  current: SidebarSelection,
  row: SidebarRow,
  universe: SidebarUniverse
): SidebarSelection {
  if (row.kind === 'root') return current;
  const keys = rowKeys(row, universe);
  const id = row.collectionId;
  const collections = new Set(current.collections);
  const groups = new Set(current.groups);
  const allSelected = allCollectionsSelected(current, universe);
  const visibleInFull = collections.has(id) && !isNarrowed(current, universe, id);

  const marked = isRowMarked(current, row, universe);
  if (marked) {
    if (row.kind === 'collection') {
      collections.delete(id);
      keys.groupKeys.forEach(key => groups.delete(key));
    } else {
      keys.groupKeys.forEach(key => groups.delete(key));
      if (!ownKeys(universe, id).some(key => groups.has(key))) {
        if (allSelected) ownKeys(universe, id).forEach(key => groups.add(key));
        else collections.delete(id);
      }
    }
  } else if (row.kind === 'collection') {
    // Fully visible next to the others (all collections selected): nothing to add.
    if (visibleInFull) return current;
    collections.add(id);
    keys.groupKeys.forEach(key => groups.add(key));
  } else if (visibleInFull && allSelected) {
    ownKeys(universe, id).forEach(key => groups.delete(key));
    keys.groupKeys.forEach(key => groups.add(key));
  } else {
    collections.add(id);
    keys.groupKeys.forEach(key => groups.add(key));
  }

  const next = { collections, groups };
  if (collections.size === 0) return current;
  // Un-picking the last picked row would fall back to "everything": keep it.
  return marked && isEverythingSelected(next, universe) ? current : next;
}
