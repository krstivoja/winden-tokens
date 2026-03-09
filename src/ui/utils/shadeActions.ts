import { post } from '../hooks/usePluginMessages';
import { ShadeGroupData, VariableData } from '../types';
import { hexToRgb } from './color';
import { buildShadePayload } from './shades';

function normalizeColorValue(value: string): string {
  return value.startsWith('#') ? hexToRgb(value) : value;
}

export function refreshManagedShadeGroup(
  shadeGroup: ShadeGroupData,
  sourceVariable: VariableData
): boolean {
  const shades = buildShadePayload(
    sourceVariable.value,
    sourceVariable.name,
    shadeGroup.config.shadeCount,
    shadeGroup.config.lightnessCurve,
    shadeGroup.config.saturationCurve,
    shadeGroup.config.hueCurve,
    shadeGroup.config.lightValue,
    shadeGroup.config.darkValue
  );

  if (shades.length === 0) {
    return false;
  }

  post({
    type: 'update-shades',
    collectionId: sourceVariable.collectionId,
    deleteIds: shadeGroup.deleteIds,
    shades,
    source: {
      id: sourceVariable.id,
      name: sourceVariable.name,
      value: normalizeColorValue(sourceVariable.value),
    },
    config: {
      shadeCount: shadeGroup.config.shadeCount,
      lightValue: shadeGroup.config.lightValue,
      darkValue: shadeGroup.config.darkValue,
      lightnessCurve: shadeGroup.config.lightnessCurve,
      saturationCurve: shadeGroup.config.saturationCurve,
      hueCurve: shadeGroup.config.hueCurve,
    },
  });

  return true;
}
