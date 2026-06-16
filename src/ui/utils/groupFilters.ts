import { VariableData } from '../types';

export function getVariableGroupName(variableName: string): string | null {
  const parts = variableName.split('/');
  if (parts.length <= 1) {
    return null;
  }

  return parts.slice(0, -1).join('/');
}

export function getCollectionGroupKey(collectionId: string, groupName: string): string {
  return `${collectionId}::${groupName}`;
}

export function isVariableVisibleForGroupFilters(
  variable: Pick<VariableData, 'collectionId' | 'name'>,
  selectedGroupKeys: Set<string>
): boolean {
  const groupName = getVariableGroupName(variable.name);
  if (!groupName) {
    return true;
  }

  return selectedGroupKeys.has(getCollectionGroupKey(variable.collectionId, groupName));
}
