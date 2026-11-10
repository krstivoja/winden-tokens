import { VariableData } from '../types';

export function getVariableGroupName(variableName: string): string | null {
  const parts = variableName.split('/');
  if (parts.length <= 1) {
    return null;
  }

  return parts.slice(0, -1).join('/');
}

/**
 * The sidebar tree's order for two group paths of one collection: segment by
 * segment with `localeCompare`, a parent before everything below it (the tree
 * is walked depth-first). '' (the collection root) comes first. A whole-string
 * compare can disagree — it puts `badge-x` before `badge/color`, the tree puts
 * the `badge` folder first.
 */
export function compareGroupPaths(a: string, b: string): number {
  if (a === b) return 0;
  if (a === '') return -1;
  if (b === '') return 1;
  const aParts = a.split('/');
  const bParts = b.split('/');
  const shared = Math.min(aParts.length, bParts.length);
  for (let i = 0; i < shared; i++) {
    const order = aParts[i].localeCompare(bParts[i]);
    if (order !== 0) return order;
  }
  return aParts.length - bParts.length;
}

export function getCollectionGroupKey(collectionId: string, groupName: string): string {
  return `${collectionId}::${groupName}`;
}

/** Every real group key per collection, derived from the variable names. */
export function getGroupKeysByCollection(
  variables: Pick<VariableData, 'collectionId' | 'name'>[]
): Map<string, string[]> {
  const byCollection = new Map<string, Set<string>>();
  variables.forEach(v => {
    const groupName = getVariableGroupName(v.name);
    if (!groupName) return;
    if (!byCollection.has(v.collectionId)) byCollection.set(v.collectionId, new Set());
    byCollection.get(v.collectionId)!.add(getCollectionGroupKey(v.collectionId, groupName));
  });
  return new Map(Array.from(byCollection, ([id, keys]) => [id, Array.from(keys)]));
}

/**
 * Grouped variables show when their own group is selected. Ungrouped
 * (collection root) variables belong to no group row, so with
 * `groupKeysByCollection` they show only while every group of their
 * collection is selected (or it has none): picking one group in the sidebar
 * shows just that group. Without the map they always show.
 */
export function isVariableVisibleForGroupFilters(
  variable: Pick<VariableData, 'collectionId' | 'name'>,
  selectedGroupKeys: Set<string>,
  groupKeysByCollection?: Map<string, string[]>
): boolean {
  const groupName = getVariableGroupName(variable.name);
  if (!groupName) {
    if (!groupKeysByCollection) return true;
    const own = groupKeysByCollection.get(variable.collectionId) ?? [];
    return own.every(key => selectedGroupKeys.has(key));
  }

  return selectedGroupKeys.has(getCollectionGroupKey(variable.collectionId, groupName));
}
