import { CollectionData, VariableData } from '../types';
import { parseColorToRgb, rgbObjToHex } from './color';

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

// Follow {alias} references across variables until a concrete (non-alias)
// value is reached. Handles chained aliases (a -> b -> #hex), unlike a
// single-hop lookup. Returns the last value seen if a reference can't be
// resolved or the chain is too deep (cycle guard).
export function resolveAliasValue(
  collections: CollectionData[],
  variables: VariableData[],
  startValue: string,
  preferredModeId?: string | null,
  maxDepth = 10
): string {
  const refPattern = /^\{(.+)\}$/;
  let value = startValue;
  for (let i = 0; i < maxDepth; i++) {
    const match = value.match(refPattern);
    if (!match) return value;
    const refVar = variables.find(v => v.name === match[1]);
    if (!refVar) return value;
    value = getVariableValueForMode(collections, refVar, preferredModeId);
  }
  return value;
}

// Color a COLOR variable value displays as: follows aliases to a hex color,
// falls back to neutral gray for an alias that never reaches a color, and
// passes any other non-color value through unchanged.
export function resolveDisplayColor(
  collections: CollectionData[],
  variables: VariableData[],
  value: string,
  preferredModeId?: string | null
): string {
  const isReference = /^\{(.+)\}$/.test(value);
  const resolved = resolveAliasValue(collections, variables, value, preferredModeId);
  const resolvedRgb = parseColorToRgb(resolved);
  if (resolvedRgb) return rgbObjToHex(resolvedRgb);
  return isReference ? '#888888' : resolved;
}
