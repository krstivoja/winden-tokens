import { ShadeConfig, ShadeCurveHandles, ShadeCurvePoint } from '../types';
import {
  generateShadeColorsWithCurves,
  getShadeNames,
  hexToRgb,
  parseColorToRgb,
  rgbToHsl,
  rgbObjToHex,
} from './color';

export const DEFAULT_SHADE_LIGHT_VALUE = 5;
export const DEFAULT_SHADE_DARK_VALUE = 90;

const CURVE_MIN_HANDLE_GAP = 0.02;

interface LegacyShadeCurveHandles {
  startValue: number;
  handle1: ShadeCurvePoint;
  handle2: ShadeCurvePoint;
  endValue: number;
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

function solveBezierTForRangeX(x: number, x0: number, x1: number, x2: number, x3: number): number {
  if (Math.abs(x3 - x0) < 1e-6) return 0;

  let t = clamp((x - x0) / (x3 - x0), 0, 1);
  for (let i = 0; i < 6; i++) {
    const xAt = cubicBezierAt(x0, x1, x2, x3, t);
    const dx = xAt - x;
    if (Math.abs(dx) < 1e-4) break;

    const derivative = cubicBezierDerivative(x0, x1, x2, x3, t);
    if (Math.abs(derivative) < 1e-6) break;
    t = clamp(t - dx / derivative, 0, 1);
  }

  return t;
}

function splitCubicAt(p0: number, p1: number, p2: number, p3: number, t: number) {
  const p01 = p0 + (p1 - p0) * t;
  const p12 = p1 + (p2 - p1) * t;
  const p23 = p2 + (p3 - p2) * t;
  const p012 = p01 + (p12 - p01) * t;
  const p123 = p12 + (p23 - p12) * t;
  const p0123 = p012 + (p123 - p012) * t;

  return {
    left: [p0, p01, p012, p0123] as const,
    right: [p0123, p123, p23, p3] as const,
  };
}

function isModernCurveHandles(value: unknown): value is ShadeCurveHandles {
  const candidate = value as Partial<ShadeCurveHandles> | null;
  return !!candidate &&
    typeof candidate.startValue === 'number' &&
    typeof candidate.endValue === 'number' &&
    !!candidate.leftHandle1 &&
    !!candidate.leftHandle2 &&
    !!candidate.rightHandle1 &&
    !!candidate.rightHandle2;
}

function isLegacyCurveHandles(value: unknown): value is LegacyShadeCurveHandles {
  const candidate = value as Partial<LegacyShadeCurveHandles> | null;
  return !!candidate &&
    typeof candidate.startValue === 'number' &&
    typeof candidate.endValue === 'number' &&
    !!candidate.handle1 &&
    !!candidate.handle2;
}

export function getShadeBaseIndex(count: number): number {
  const names = getShadeNames(count);
  const explicitBaseIndex = names.indexOf('500');
  if (explicitBaseIndex >= 0) {
    return explicitBaseIndex;
  }

  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  names.forEach((name, index) => {
    const distance = Math.abs(parseInt(name, 10) - 500);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  return closestIndex;
}

export function getShadeBaseIndexForColor(baseColor: string, count: number): number {
  const rgb = parseColorToRgb(baseColor);
  if (!rgb) {
    return getShadeBaseIndex(count);
  }

  const { l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const darkness = 1 - clamp(l / 100, 0, 1);
  return normalizeShadeBaseIndex(Math.round(darkness * (count - 1)), count);
}

export function normalizeShadeBaseIndex(baseIndex: number | undefined, count: number): number {
  if (count <= 1) return 0;
  if (typeof baseIndex !== 'number' || Number.isNaN(baseIndex)) {
    return getShadeBaseIndex(count);
  }
  return clamp(Math.round(baseIndex), 0, count - 1);
}

export function remapShadeBaseIndex(baseIndex: number, previousCount: number, nextCount: number): number {
  if (nextCount <= 1) return 0;
  if (previousCount <= 1) return normalizeShadeBaseIndex(undefined, nextCount);

  const ratio = clamp(baseIndex / (previousCount - 1), 0, 1);
  return normalizeShadeBaseIndex(Math.round(ratio * (nextCount - 1)), nextCount);
}

export function getShadeBaseT(count: number, baseIndex: number): number {
  if (count <= 1) return 0;
  return normalizeShadeBaseIndex(baseIndex, count) / (count - 1);
}

function clampOrderedHandles(
  first: ShadeCurvePoint,
  second: ShadeCurvePoint,
  startT: number,
  endT: number
): [ShadeCurvePoint, ShadeCurvePoint] {
  const segmentSize = Math.max(0, endT - startT);
  if (segmentSize < 1e-6) {
    return [
      { t: startT, value: first.value },
      { t: endT, value: second.value },
    ];
  }

  const endpointGap = Math.min(CURVE_MIN_HANDLE_GAP, segmentSize / 4);
  const minGap = Math.min(CURVE_MIN_HANDLE_GAP, segmentSize / 4);
  const minFirstT = startT + endpointGap;
  const maxSecondT = endT - endpointGap;
  const firstT = clamp(first.t, minFirstT, maxSecondT - minGap);
  const secondT = clamp(second.t, firstT + minGap, maxSecondT);

  return [
    { t: firstT, value: first.value },
    { t: secondT, value: second.value },
  ];
}

export function createDefaultCurveHandles(count = 11, baseIndex = getShadeBaseIndex(count)): ShadeCurveHandles {
  const baseT = getShadeBaseT(count, baseIndex);
  const leftSpan = Math.max(baseT, 0);
  const rightSpan = Math.max(1 - baseT, 0);

  return {
    startValue: 0,
    leftHandle1: { t: baseT - leftSpan * 0.66, value: 0 },
    leftHandle2: { t: baseT - leftSpan * 0.33, value: 0 },
    rightHandle1: { t: baseT + rightSpan * 0.33, value: 0 },
    rightHandle2: { t: baseT + rightSpan * 0.66, value: 0 },
    endValue: 0,
  };
}

export function normalizeCurveHandles(
  value: unknown,
  count: number,
  baseIndex: number
): ShadeCurveHandles {
  const normalizedBaseIndex = normalizeShadeBaseIndex(baseIndex, count);
  const baseT = getShadeBaseT(count, normalizedBaseIndex);

  if (isModernCurveHandles(value)) {
    const [leftHandle1, leftHandle2] = clampOrderedHandles(
      value.leftHandle1,
      value.leftHandle2,
      0,
      baseT
    );
    const [rightHandle1, rightHandle2] = clampOrderedHandles(
      value.rightHandle1,
      value.rightHandle2,
      baseT,
      1
    );

    return {
      startValue: value.startValue,
      leftHandle1,
      leftHandle2,
      rightHandle1,
      rightHandle2,
      endValue: value.endValue,
    };
  }

  if (isLegacyCurveHandles(value) && baseT > 0 && baseT < 1) {
    const legacyHandle1T = clamp(value.handle1.t, 0, 1);
    const legacyHandle2T = clamp(value.handle2.t, 0, 1);
    const splitT = solveBezierTForRangeX(baseT, 0, legacyHandle1T, legacyHandle2T, 1);
    const splitX = splitCubicAt(0, legacyHandle1T, legacyHandle2T, 1, splitT);
    const splitY = splitCubicAt(
      value.startValue,
      value.handle1.value,
      value.handle2.value,
      value.endValue,
      splitT
    );

    return normalizeCurveHandles({
      startValue: value.startValue,
      leftHandle1: { t: splitX.left[1], value: splitY.left[1] },
      leftHandle2: { t: splitX.left[2], value: splitY.left[2] },
      rightHandle1: { t: splitX.right[1], value: splitY.right[1] },
      rightHandle2: { t: splitX.right[2], value: splitY.right[2] },
      endValue: value.endValue,
    }, count, normalizedBaseIndex);
  }

  return normalizeCurveHandles(createDefaultCurveHandles(count, normalizedBaseIndex), count, normalizedBaseIndex);
}

function evaluateCurveAtT(handles: ShadeCurveHandles, t: number, count: number, baseIndex: number): number {
  const baseT = getShadeBaseT(count, baseIndex);
  const clampedT = clamp(t, 0, 1);

  if (baseT <= 0 || clampedT <= baseT) {
    const u = solveBezierTForRangeX(
      clampedT,
      0,
      handles.leftHandle1.t,
      handles.leftHandle2.t,
      baseT
    );

    return cubicBezierAt(
      handles.startValue,
      handles.leftHandle1.value,
      handles.leftHandle2.value,
      0,
      u
    );
  }

  const u = solveBezierTForRangeX(
    clampedT,
    baseT,
    handles.rightHandle1.t,
    handles.rightHandle2.t,
    1
  );

  return cubicBezierAt(
    0,
    handles.rightHandle1.value,
    handles.rightHandle2.value,
    handles.endValue,
    u
  );
}

export function evaluateCurveAtNodes(handles: ShadeCurveHandles, count: number, baseIndex: number): number[] {
  const normalizedHandles = normalizeCurveHandles(handles, count, baseIndex);
  const values: number[] = [];

  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0;
    values.push(i === normalizeShadeBaseIndex(baseIndex, count) ? 0 : evaluateCurveAtT(normalizedHandles, t, count, baseIndex));
  }

  return values;
}

export function findClosestShadeIndex(
  baseColor: string,
  shades: Array<{ value: string }>,
  count: number
): number {
  const baseRgb = parseColorToRgb(baseColor);
  if (!baseRgb || shades.length === 0) {
    return normalizeShadeBaseIndex(undefined, count);
  }

  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  shades.forEach((shade, index) => {
    const shadeRgb = parseColorToRgb(shade.value);
    if (!shadeRgb) return;

    const distance =
      (baseRgb.r - shadeRgb.r) ** 2 +
      (baseRgb.g - shadeRgb.g) ** 2 +
      (baseRgb.b - shadeRgb.b) ** 2;

    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  return normalizeShadeBaseIndex(closestIndex, count);
}

export function getBaseShadeToneAtT(
  t: number,
  count: number,
  baseIndex: number,
  lightValue = DEFAULT_SHADE_LIGHT_VALUE,
  darkValue = DEFAULT_SHADE_DARK_VALUE
): number {
  if (count <= 1) {
    return 50;
  }

  const baseT = getShadeBaseT(count, baseIndex);
  const clampedT = clamp(t, 0, 1);

  if (clampedT <= baseT) {
    const localT = baseT === 0 ? 0 : clampedT / baseT;
    return lightValue + (50 - lightValue) * localT;
  }

  const localT = baseT === 1 ? 0 : (clampedT - baseT) / (1 - baseT);
  return 50 + (darkValue - 50) * localT;
}

export function buildShadePayload(
  baseColor: string,
  groupName: string,
  shadeCount: number,
  baseIndex: number,
  lightnessCurve: ShadeCurveHandles,
  saturationCurve: ShadeCurveHandles,
  hueCurve: ShadeCurveHandles,
  lightValue = DEFAULT_SHADE_LIGHT_VALUE,
  darkValue = DEFAULT_SHADE_DARK_VALUE
): ShadeConfig[] {
  const rgb = parseColorToRgb(baseColor);
  if (!rgb) return [];

  const normalizedBaseIndex = normalizeShadeBaseIndex(baseIndex, shadeCount);
  const lightAdj = evaluateCurveAtNodes(lightnessCurve, shadeCount, normalizedBaseIndex);
  const satAdj = evaluateCurveAtNodes(saturationCurve, shadeCount, normalizedBaseIndex);
  const hueAdj = evaluateCurveAtNodes(hueCurve, shadeCount, normalizedBaseIndex);
  const names = getShadeNames(shadeCount);
  const colors = generateShadeColorsWithCurves(
    lightValue,
    darkValue,
    rgb,
    shadeCount,
    normalizedBaseIndex,
    lightAdj,
    satAdj,
    hueAdj
  );

  if (colors[normalizedBaseIndex]) {
    colors[normalizedBaseIndex] = rgbObjToHex(rgb);
  }

  return colors.map((hex, index) => ({
    name: `${groupName}/${names[index]}`,
    value: hexToRgb(hex),
  }));
}
