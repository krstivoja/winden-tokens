import { CollectionData, VariableData } from '../types';

function getModeNameById(
  collections: CollectionData[],
  modeId: string | null | undefined
): string | null {
  if (!modeId) return null;

  for (const collection of collections) {
    const mode = collection.modes.find(candidate => candidate.modeId === modeId);
    if (mode) {
      return mode.name;
    }
  }

  return null;
}

export function resolveModeIdForCollection(
  collections: CollectionData[],
  collectionId: string,
  preferredModeId?: string | null
): string | null {
  const collection = collections.find(candidate => candidate.id === collectionId);
  if (!collection || collection.modes.length === 0) {
    return null;
  }

  if (preferredModeId && collection.modes.some(mode => mode.modeId === preferredModeId)) {
    return preferredModeId;
  }

  const preferredModeName = getModeNameById(collections, preferredModeId);
  if (preferredModeName) {
    const matchingMode = collection.modes.find(mode => mode.name === preferredModeName);
    if (matchingMode) {
      return matchingMode.modeId;
    }
  }

  return collection.modes[0].modeId;
}

export function getVariableValueForMode(
  collections: CollectionData[],
  variable: VariableData,
  preferredModeId?: string | null
): string {
  const resolvedModeId = resolveModeIdForCollection(collections, variable.collectionId, preferredModeId);
  if (resolvedModeId && variable.valuesByMode[resolvedModeId] !== undefined) {
    return variable.valuesByMode[resolvedModeId];
  }

  return variable.value;
}
