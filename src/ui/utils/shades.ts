import { ShadeConfig, ShadeCurveHandles } from '../types';
import {
  generateShadeColorsWithCurves,
  getShadeNames,
  hexToRgb,
  parseColorToRgb,
} from './color';

export const DEFAULT_SHADE_LIGHT_VALUE = 5;
export const DEFAULT_SHADE_DARK_VALUE = 90;

export function createDefaultCurveHandles(): ShadeCurveHandles {
  return {
    startValue: 0,
    handle1: { t: 0.25, value: 0 },
    handle2: { t: 0.75, value: 0 },
    endValue: 0,
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function cubicBezierAt(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}

function cubicBezierDerivative(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const mt = 1 - t;
  return 3 * mt * mt * (p1 - p0) + 6 * mt * t * (p2 - p1) + 3 * t * t * (p3 - p2);
}

function solveBezierTForX(x: number, x1: number, x2: number): number {
  let t = clamp(x, 0, 1);
  for (let i = 0; i < 5; i++) {
    const xAt = cubicBezierAt(0, x1, x2, 1, t);
    const dx = xAt - x;
    if (Math.abs(dx) < 1e-4) break;
    const derivative = cubicBezierDerivative(0, x1, x2, 1, t);
    if (derivative === 0) break;
    t = clamp(t - dx / derivative, 0, 1);
  }
  return t;
}

export function evaluateCubicBezier(handles: ShadeCurveHandles, t: number): number {
  const p1x = clamp(handles.handle1.t, 0, 1);
  const p2x = clamp(handles.handle2.t, 0, 1);
  const u = solveBezierTForX(t, p1x, p2x);

  return cubicBezierAt(
    handles.startValue,
    handles.handle1.value,
    handles.handle2.value,
    handles.endValue,
    u
  );
}

export function evaluateCurveAtNodes(handles: ShadeCurveHandles, count: number): number[] {
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0;
    values.push(evaluateCubicBezier(handles, t));
  }
  return values;
}

export function buildShadePayload(
  baseColor: string,
  groupName: string,
  shadeCount: number,
  lightnessCurve: ShadeCurveHandles,
  saturationCurve: ShadeCurveHandles,
  hueCurve: ShadeCurveHandles,
  lightValue = DEFAULT_SHADE_LIGHT_VALUE,
  darkValue = DEFAULT_SHADE_DARK_VALUE
): ShadeConfig[] {
  const rgb = parseColorToRgb(baseColor);
  if (!rgb) return [];

  const lightAdj = evaluateCurveAtNodes(lightnessCurve, shadeCount);
  const satAdj = evaluateCurveAtNodes(saturationCurve, shadeCount);
  const hueAdj = evaluateCurveAtNodes(hueCurve, shadeCount);
  const names = getShadeNames(shadeCount);
  const colors = generateShadeColorsWithCurves(
    lightValue,
    darkValue,
    rgb,
    shadeCount,
    lightAdj,
    satAdj,
    hueAdj
  );

  return colors.map((hex, index) => ({
    name: `${groupName}/${names[index]}`,
    value: hexToRgb(hex),
  }));
}
