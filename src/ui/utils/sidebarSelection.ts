// Selection math for the sidebar Collections tree. A row click never toggles a
// checkbox: it replaces the selection (plain click) or flips one row in it
// (Cmd/Ctrl-click). The selection itself keeps its two-set shape (collection
// ids + `<collectionId>::<group>` keys) so the table, the graph and "Hide
// unused" keep reading it unchanged. Which rows are ringed is tracked apart
// from it, as the marks of the rows the user clicked (see `visibleMarks`).

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
 * Plain click. Root and collection: everything (a collection row hides
 * nothing and clears any group narrowing; the row is only marked and jumped
 * to, see `visibleMarks`). Group: every collection stays selected and every
 * other collection keeps all its groups, only the clicked collection narrows
 * to the clicked group's keys, so a group click never hides another
 * collection.
 */
export function selectOnly(row: SidebarRow, universe: SidebarUniverse): SidebarSelection {
  const keys = rowKeys(row, universe);
  if (row.kind !== 'group') {
    const all = rowKeys({ kind: 'root' }, universe);
    return { collections: new Set(all.collectionIds), groups: new Set(all.groupKeys) };
  }
  const groups = new Set<string>();
  universe.collectionIds.forEach(id => {
    if (id === row.collectionId) return;
    (universe.groupKeysByCollection.get(id) ?? []).forEach(key => groups.add(key));
  });
  keys.groupKeys.forEach(key => groups.add(key));
  return { collections: new Set(universe.collectionIds), groups };
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

// ---------------------------------------------------------------------------
// Marks: the rows the user clicked. Only marked rows get the ring, so a folder
// whose only child was clicked (same variables) is never ringed with it.
// A mark is the row id `<collectionId>::<path>` (path '' = the collection
// row), the same key as `focusedRowKey`. A mark is shown only while its row
// still exists and is selected (`visibleMarks`), so a selection changed
// elsewhere (Hide unused, Show all, plugin undo recreating every id) never
// rings a row that is not shown.
// ---------------------------------------------------------------------------

export type SidebarMarks = ReadonlySet<string>;

/** Row id of a collection (`path` '') or group/folder row. */
export const markId = (collectionId: string, path = ''): string => `${collectionId}::${path}`;

const splitMarkId = (id: string): { collectionId: string; path: string } | null => {
  const at = id.indexOf('::');
  return at === -1 ? null : { collectionId: id.slice(0, at), path: id.slice(at + 2) };
};

const ownKeys = (universe: SidebarUniverse, id: string): string[] =>
  universe.groupKeysByCollection.get(id) ?? [];

/**
 * The row a mark stands for, or null once it no longer exists. A group mark
 * stands for the group and every descendant group; an "own" mark (path with a
 * trailing `/`, see `ownMarkId`) only for the variables a folder holds
 * directly, and rings the same row.
 */
export function markRow(id: string, universe: SidebarUniverse): SidebarRow | null {
  const parts = splitMarkId(id);
  if (!parts || !universe.collectionIds.includes(parts.collectionId)) return null;
  const { collectionId, path } = parts;
  if (path === '') return { kind: 'collection', collectionId };
  if (path.endsWith('/')) {
    const own = markId(collectionId, path.slice(0, -1));
    return ownKeys(universe, collectionId).includes(own) ? { kind: 'group', collectionId, groupKeys: [own] } : null;
  }
  const own = markId(collectionId, path);
  const groupKeys = ownKeys(universe, collectionId).filter(key => key === own || key.startsWith(`${own}/`));
  return groupKeys.length > 0 ? { kind: 'group', collectionId, groupKeys } : null;
}

/** Mark for only the variables a folder (that is also a group) holds itself. */
export const ownMarkId = (collectionId: string, path: string): string => markId(collectionId, `${path}/`);

/** `path` is strictly under `ancestor` (an own mark `x/` counts as under `x`). */
const isUnder = (path: string, ancestor: string): boolean => path.startsWith(`${ancestor}/`);

interface LiveMark {
  id: string;
  collectionId: string;
  path: string;
  row: SidebarRow;
  /** Collection row: its collection is on; group row: all of its keys are. */
  selected: boolean;
}

const isFullyShown = (current: SidebarSelection, universe: SidebarUniverse, cid: string): boolean =>
  current.collections.has(cid) && ownKeys(universe, cid).every(key => current.groups.has(key));

/**
 * Marks that still mean a pick: the row exists, and a group mark's collection
 * is still narrowed, unless the collection's selected group marks together
 * cover all of it (e.g. a collection's only folder). A group pick that Show
 * all turned back into "whole collection" no longer counts. A mark hidden by
 * Hide unused (its keys unchecked for now) still counts.
 */
function liveMarks(marks: SidebarMarks, current: SidebarSelection, universe: SidebarUniverse): LiveMark[] {
  const all: LiveMark[] = [];
  marks.forEach(id => {
    const row = markRow(id, universe);
    const parts = splitMarkId(id);
    if (!row || !parts || row.kind === 'root') return;
    const selected =
      row.kind === 'collection' ? current.collections.has(row.collectionId) : isRowSelected(current, row, universe);
    all.push({ id, collectionId: parts.collectionId, path: parts.path, row, selected });
  });
  return all.filter(mark => {
    if (mark.row.kind !== 'group' || !isFullyShown(current, universe, mark.collectionId)) return true;
    const covered = new Set(
      all
        .filter(other => other.collectionId === mark.collectionId && other.row.kind === 'group' && other.selected)
        .flatMap(other => rowKeys(other.row, universe).groupKeys)
    );
    return ownKeys(universe, mark.collectionId).every(key => covered.has(key));
  });
}

/**
 * The rows to ring: picks (see `liveMarks`) whose row is selected. A
 * collection row (which never filters) needs only its collection, so it stays
 * ringed next to a group picked inside it; a group row needs all of its keys,
 * so Hide unused never leaves a ring on a hidden row. A ring under another
 * shown ring of its collection is not shown (rows under a ring get the fill).
 */
export function visibleMarks(
  marks: SidebarMarks,
  current: SidebarSelection,
  universe: SidebarUniverse
): Set<string> {
  const shown = liveMarks(marks, current, universe).filter(mark => mark.selected);
  const visible = new Set<string>();
  shown.forEach(mark => {
    const covered = mark.path !== '' && shown.some(
      other => other.collectionId === mark.collectionId && other.path !== '' && isUnder(mark.path, other.path)
    );
    if (!covered) visible.add(mark.id);
  });
  return visible;
}

/** Drops marks whose row no longer exists; returns `marks` itself when none do. */
export function pruneMarks(marks: SidebarMarks, universe: SidebarUniverse): SidebarMarks {
  const kept = Array.from(marks).filter(id => markRow(id, universe) !== null);
  return kept.length === marks.size ? marks : new Set(kept);
}

/** "All variables" is ringed while everything is selected and no row is. */
export function isRootMarked(
  current: SidebarSelection,
  universe: SidebarUniverse,
  visible: ReadonlySet<string>
): boolean {
  return visible.size === 0 && isEverythingSelected(current, universe);
}

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean =>
  a.size === b.size && Array.from(a).every(item => b.has(item));

export interface MarkToggle {
  selection: SidebarSelection;
  marks: SidebarMarks;
}

/** Paths of the rows right under `path` (a folder or group) in its collection. */
function childPaths(universe: SidebarUniverse, collectionId: string, path: string): string[] {
  const prefix = markId(collectionId, `${path}/`);
  const children = new Set<string>();
  ownKeys(universe, collectionId).forEach(key => {
    if (key.startsWith(prefix)) children.add(`${path}/${key.slice(prefix.length).split('/')[0]}`);
  });
  return Array.from(children);
}

/**
 * Cmd/Ctrl-click on a collection or group row (`id`, see `markId`). Returns
 * null when nothing changes; `selection` is `current` itself when only the
 * marks change. Decided on the picks (`liveMarks`): a ring Hide unused hides
 * for now still counts, and is kept, so it comes back after Show all.
 *
 * - Collection row: only its mark flips, the selection is untouched (a
 *   collection that is off, e.g. hidden by Hide unused, cannot be marked).
 * - Group row that is selected and picked (marked itself, or under a marked
 *   folder/group of its collection, or a folder marked only for the variables
 *   it holds itself, which then leave): it leaves. Marks under it go; a marked
 *   ancestor no longer applies in full, so its mark moves to what stays of it:
 *   the siblings on the way down to the clicked row, and the variables a
 *   folder on that way holds itself (`ownMarkId`). The row's keys leave the
 *   selection except those another remaining mark covers; with no key of the
 *   collection and no other pick of it left, it is fully visible again (or,
 *   in a collection subset, leaves).
 * - Any other group row joins and takes over the marks under it: it adds its
 *   keys, narrowing its collection to itself first only when the collection
 *   has no group pick and is fully shown.
 * The last pick never leaves.
 */
export function toggleMark(
  current: SidebarSelection,
  marks: SidebarMarks,
  clickedId: string,
  universe: SidebarUniverse
): MarkToggle | null {
  const parts = splitMarkId(clickedId);
  if (!parts) return null;
  const next = new Set(liveMarks(marks, current, universe).map(mark => mark.id));
  // A folder ringed only for its own variables: the click is on those.
  const own = parts.path === '' ? null : ownMarkId(parts.collectionId, parts.path);
  const ownRow = own && !next.has(clickedId) && next.has(own) ? markRow(own, universe) : null;
  const id = own && ownRow && isRowSelected(current, ownRow, universe) ? own : clickedId;
  const row = markRow(id, universe);
  if (!row || row.kind === 'root') return null;
  const cid = row.collectionId;
  const path = splitMarkId(id)!.path;
  const collections = new Set(current.collections);
  const groups = new Set(current.groups);
  // Group picks of the row's collection, by path.
  const groupPicks = () =>
    Array.from(next)
      .map(splitMarkId)
      .filter((m): m is { collectionId: string; path: string } => !!m && m.collectionId === cid && m.path !== '')
      .map(m => m.path);
  const dropUnder = (at: string) =>
    groupPicks()
      .filter(mark => isUnder(mark, at))
      .forEach(mark => next.delete(markId(cid, mark)));

  if (row.kind === 'collection') {
    if (next.has(id) && collections.has(cid)) {
      next.delete(id);
      if (next.size === 0) return null;
    } else {
      if (!collections.has(cid)) return null;
      next.add(id);
    }
  } else {
    const ancestors = groupPicks().filter(mark => isUnder(path, mark));
    if (isRowSelected(current, row, universe) && (next.has(id) || ancestors.length > 0)) {
      next.delete(id);
      dropUnder(path);
      ancestors.forEach(ancestor => {
        next.delete(markId(cid, ancestor));
        let at = ancestor;
        while (at !== path) {
          if (ownKeys(universe, cid).includes(markId(cid, at))) next.add(ownMarkId(cid, at));
          const children = childPaths(universe, cid, at);
          const down = children.find(child => child === path || isUnder(path, child))!;
          children.filter(child => child !== down).forEach(child => next.add(markId(cid, child)));
          at = down;
        }
      });
      if (next.size === 0) return null;
      const kept = new Set(
        groupPicks().flatMap(mark => {
          const other = markRow(markId(cid, mark), universe);
          return other ? rowKeys(other, universe).groupKeys : [];
        })
      );
      row.groupKeys.forEach(key => {
        if (!kept.has(key)) groups.delete(key);
      });
      // No key of the collection left: it is fully visible again, unless
      // another pick of it remains (hidden by Hide unused for now).
      if (!ownKeys(universe, cid).some(key => groups.has(key)) && groupPicks().length === 0) {
        if (universe.collectionIds.every(c => collections.has(c))) ownKeys(universe, cid).forEach(key => groups.add(key));
        else collections.delete(cid);
      }
    } else {
      if (groupPicks().length === 0 && isFullyShown(current, universe, cid)) {
        ownKeys(universe, cid).forEach(key => groups.delete(key));
      }
      collections.add(cid);
      row.groupKeys.forEach(key => groups.add(key));
      dropUnder(path);
      next.add(id);
    }
  }

  if (collections.size === 0) return null;
  const unchanged = sameSet(collections, current.collections) && sameSet(groups, current.groups);
  return { selection: unchanged ? current : { collections, groups }, marks: next };
}
