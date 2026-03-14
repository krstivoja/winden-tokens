// Tokens Manager - Figma Plugin

figma.showUI(__html__, { width: 750, height: 500, themeColors: true } as any);

// Track variable state for change detection
let lastDataHash = '';

interface UIVariableData {
  id: string;
  collectionId: string;
  name: string;
  resolvedType: string;
  value: string;
}

interface CollectionData {
  id: string;
  name: string;
}

interface ShadeCurvePoint {
  t: number;
  value: number;
}

interface ShadeCurveHandles {
  startValue: number;
  leftHandle1: ShadeCurvePoint;
  leftHandle2: ShadeCurvePoint;
  rightHandle1: ShadeCurvePoint;
  rightHandle2: ShadeCurvePoint;
  endValue: number;
}

interface LegacyShadeCurveHandles {
  startValue: number;
  handle1: ShadeCurvePoint;
  handle2: ShadeCurvePoint;
  endValue: number;
}

interface ShadeConfigPayload {
  shadeCount: number;
  baseIndex: number;
  lightValue: number;
  darkValue: number;
  lightnessCurve: ShadeCurveHandles;
  saturationCurve: ShadeCurveHandles;
  hueCurve: ShadeCurveHandles;
}

interface StoredShadeData {
  id: string;
  name: string;
  value: string;
}

interface StoredShadeGeneratorConfig extends ShadeConfigPayload {
  version: number;
  sourceVariableId: string;
  sourceName: string;
  sourceValue: string;
  generatedShades: StoredShadeData[];
  updatedAt: string;
}

interface UIShadeGroupData {
  sourceVariableId: string;
  sourceVariableName: string;
  collectionId: string;
  deleteIds: string[];
  status: 'clean' | 'dirty';
  dirtyReasons: string[];
  config: StoredShadeGeneratorConfig;
}

interface ShadeSourceInput {
  id?: string;
  name: string;
  value: string;
}

interface UIState {
  collectionData: CollectionData[];
  variableData: UIVariableData[];
  shadeGroups: UIShadeGroupData[];
  hash: string;
}

interface RGBColor {
  r: number;
  g: number;
  b: number;
}

const SHADE_GENERATOR_CONFIG_KEY = 'shadeGeneratorConfig';

// Get stored variable order
function getVariableOrder(): string[] {
  const orderJson = figma.root.getPluginData('variableOrder');
  return orderJson ? JSON.parse(orderJson) : [];
}

// Set stored variable order
function setVariableOrder(order: string[]): void {
  figma.root.setPluginData('variableOrder', JSON.stringify(order));
}

function isShadeVariableName(name: string): boolean {
  return /^(.+)\/(\d+)$/.test(name);
}

function getShadeBaseName(name: string): string | null {
  const match = name.match(/^(.+)\/(\d+)$/);
  return match ? match[1] : null;
}

function extractShadeNumber(name: string): number {
  const match = name.match(/\/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

function getDefaultShadeBaseIndex(count: number): number {
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

function normalizeShadeBaseIndex(baseIndex: number | undefined, count: number): number {
  if (count <= 1) return 0;
  if (typeof baseIndex !== 'number' || Number.isNaN(baseIndex)) {
    return getDefaultShadeBaseIndex(count);
  }
  return clamp(Math.round(baseIndex), 0, count - 1);
}

function getShadeBaseT(count: number, baseIndex: number): number {
  if (count <= 1) return 0;
  return normalizeShadeBaseIndex(baseIndex, count) / (count - 1);
}

function parseCssColorToRgb(value: string): RGBColor | null {
  const rgbMatch = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }

  const hexMatch = value.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
    }

    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }

  return null;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;
  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const delta = max - min;
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    switch (max) {
      case nr:
        h = ((ng - nb) / delta + (ng < nb ? 6 : 0)) / 6;
        break;
      case ng:
        h = ((nb - nr) / delta + 2) / 6;
        break;
      default:
        h = ((nr - ng) / delta + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function getShadeBaseIndexForRgb(rgb: RGBColor, count: number): number {
  const { l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const darkness = 1 - clamp(l / 100, 0, 1);
  return normalizeShadeBaseIndex(Math.round(darkness * (count - 1)), count);
}

function getShadeBaseIndexForColor(value: string, count: number): number {
  const rgb = parseCssColorToRgb(value);
  if (!rgb) {
    return getDefaultShadeBaseIndex(count);
  }

  return getShadeBaseIndexForRgb(rgb, count);
}

function findClosestShadeIndex(baseColor: string, shades: StoredShadeData[], count: number): number {
  const baseRgb = parseCssColorToRgb(baseColor);
  if (!baseRgb || shades.length === 0) {
    return normalizeShadeBaseIndex(undefined, count);
  }

  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  shades.forEach((shade, index) => {
    const shadeRgb = parseCssColorToRgb(shade.value);
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

  const endpointGap = Math.min(0.02, segmentSize / 4);
  const minGap = Math.min(0.02, segmentSize / 4);
  const minFirstT = startT + endpointGap;
  const maxSecondT = endT - endpointGap;
  const firstT = clamp(first.t, minFirstT, maxSecondT - minGap);
  const secondT = clamp(second.t, firstT + minGap, maxSecondT);
  return [
    { t: firstT, value: first.value },
    { t: secondT, value: second.value },
  ];
}

function createDefaultCurveHandles(count: number, baseIndex: number): ShadeCurveHandles {
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

function normalizeCurveHandles(value: unknown, count: number, baseIndex: number): ShadeCurveHandles {
  const normalizedBaseIndex = normalizeShadeBaseIndex(baseIndex, count);
  const baseT = getShadeBaseT(count, normalizedBaseIndex);

  if (isModernCurveHandles(value)) {
    const [leftHandle1, leftHandle2] = clampOrderedHandles(value.leftHandle1, value.leftHandle2, 0, baseT);
    const [rightHandle1, rightHandle2] = clampOrderedHandles(value.rightHandle1, value.rightHandle2, baseT, 1);

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
    const handle1T = clamp(value.handle1.t, 0, 1);
    const handle2T = clamp(value.handle2.t, 0, 1);
    const splitT = solveBezierTForRangeX(baseT, 0, handle1T, handle2T, 1);
    const splitX = splitCubicAt(0, handle1T, handle2T, 1, splitT);
    const splitY = splitCubicAt(value.startValue, value.handle1.value, value.handle2.value, value.endValue, splitT);

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

function readShadeGeneratorConfig(variable: Variable): StoredShadeGeneratorConfig | null {
  const raw = variable.getPluginData(SHADE_GENERATOR_CONFIG_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.generatedShades)) {
      return null;
    }

    const shadeCount =
      typeof parsed.shadeCount === 'number'
        ? parsed.shadeCount
        : parsed.generatedShades.length;
    const sourceValue = typeof parsed.sourceValue === 'string' ? parsed.sourceValue : '';
    const derivedBaseIndex =
      typeof parsed.baseIndex === 'number'
        ? parsed.baseIndex
        : parsed.generatedShades.length > 0
          ? findClosestShadeIndex(sourceValue, parsed.generatedShades, shadeCount)
          : getShadeBaseIndexForColor(sourceValue, shadeCount);
    const normalizedBaseIndex = normalizeShadeBaseIndex(derivedBaseIndex, shadeCount);

    return {
      version: typeof parsed.version === 'number' ? parsed.version : 2,
      sourceVariableId: typeof parsed.sourceVariableId === 'string' ? parsed.sourceVariableId : variable.id,
      sourceName: typeof parsed.sourceName === 'string' ? parsed.sourceName : variable.name,
      sourceValue,
      shadeCount,
      baseIndex: normalizedBaseIndex,
      lightValue: typeof parsed.lightValue === 'number' ? parsed.lightValue : 5,
      darkValue: typeof parsed.darkValue === 'number' ? parsed.darkValue : 90,
      lightnessCurve: normalizeCurveHandles(
        parsed.lightnessCurve,
        shadeCount,
        normalizedBaseIndex
      ),
      saturationCurve: normalizeCurveHandles(
        parsed.saturationCurve,
        shadeCount,
        normalizedBaseIndex
      ),
      hueCurve: normalizeCurveHandles(
        parsed.hueCurve,
        shadeCount,
        normalizedBaseIndex
      ),
      generatedShades: parsed.generatedShades,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    };
  } catch (error) {
    console.warn('[Plugin] Failed to parse shade generator config for', variable.name, error);
    return null;
  }
}

function clearShadeGeneratorConfig(variable: Variable): void {
  variable.setPluginData(SHADE_GENERATOR_CONFIG_KEY, '');
}

function sortVariableData(variableData: UIVariableData[]): UIVariableData[] {
  const order = getVariableOrder();
  const sorted = [...variableData];

  if (order.length > 0) {
    sorted.sort((a, b) => {
      const indexA = order.indexOf(a.id);
      const indexB = order.indexOf(b.id);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }

  const groupMap = new Map<string, UIVariableData[]>();
  for (const variable of sorted) {
    const baseName = getShadeBaseName(variable.name);
    if (!baseName) continue;

    if (!groupMap.has(baseName)) {
      groupMap.set(baseName, []);
    }
    groupMap.get(baseName)!.push(variable);
  }

  for (const group of groupMap.values()) {
    group.sort((a, b) => extractShadeNumber(a.name) - extractShadeNumber(b.name));
  }

  const result: UIVariableData[] = [];
  const processedGroups = new Set<string>();

  for (const variable of sorted) {
    const baseName = getShadeBaseName(variable.name);
    if (baseName) {
      if (!processedGroups.has(baseName)) {
        processedGroups.add(baseName);
        result.push(...groupMap.get(baseName)!);
      }
    } else {
      result.push(variable);
    }
  }

  return result;
}

function buildShadeGroups(
  variables: Variable[],
  formattedValueMap: Map<string, string>
): UIShadeGroupData[] {
  const variableMap = new Map(variables.map(variable => [variable.id, variable]));
  const shadeGroups: UIShadeGroupData[] = [];

  for (const variable of variables) {
    if (variable.resolvedType !== 'COLOR') continue;

    const config = readShadeGeneratorConfig(variable);
    if (!config) continue;

    const trackedShades = config.generatedShades || [];
    const trackedShadeIds = new Set(trackedShades.map(shade => shade.id));
    const baseNames = new Set<string>([variable.name, config.sourceName]);

    for (const shade of trackedShades) {
      const baseName = getShadeBaseName(shade.name);
      if (baseName) {
        baseNames.add(baseName);
      }
    }

    const actualShadeVars = variables.filter(candidate => {
      if (candidate.id === variable.id) return false;
      if (candidate.variableCollectionId !== variable.variableCollectionId) return false;
      if (candidate.resolvedType !== 'COLOR') return false;

      const baseName = getShadeBaseName(candidate.name);
      return !!baseName && baseNames.has(baseName);
    });

    actualShadeVars.sort((a, b) => extractShadeNumber(a.name) - extractShadeNumber(b.name));

    const deleteIds = Array.from(new Set([
      ...trackedShades.map(shade => shade.id),
      ...actualShadeVars.map(shade => shade.id),
    ].filter(id => !!variableMap.get(id))));

    const dirtyReasons = new Set<string>();
    const currentSourceValue = formattedValueMap.get(variable.id) || '';

    if (currentSourceValue !== config.sourceValue) {
      dirtyReasons.add('source-value');
    }

    if (variable.name !== config.sourceName) {
      dirtyReasons.add('source-name');
    }

    if (trackedShades.length === 0) {
      dirtyReasons.add('missing-shades');
    }

    for (const shade of trackedShades) {
      const actual = variableMap.get(shade.id);
      if (!actual) {
        dirtyReasons.add('missing-shades');
        continue;
      }

      const actualValue = formattedValueMap.get(actual.id) || '';
      if (actual.name !== shade.name || actualValue !== shade.value) {
        dirtyReasons.add('modified-shades');
      }
    }

    if (actualShadeVars.length !== trackedShades.length) {
      dirtyReasons.add('modified-shades');
    }

    for (const actual of actualShadeVars) {
      if (!trackedShadeIds.has(actual.id)) {
        dirtyReasons.add('modified-shades');
      }
    }

    shadeGroups.push({
      sourceVariableId: variable.id,
      sourceVariableName: variable.name,
      collectionId: variable.variableCollectionId,
      deleteIds,
      status: dirtyReasons.size > 0 ? 'dirty' : 'clean',
      dirtyReasons: Array.from(dirtyReasons),
      config: {
        version: config.version,
        sourceVariableId: variable.id,
        sourceName: config.sourceName,
        sourceValue: config.sourceValue,
        shadeCount: config.shadeCount,
        baseIndex: config.baseIndex,
        lightValue: config.lightValue,
        darkValue: config.darkValue,
        lightnessCurve: config.lightnessCurve,
        saturationCurve: config.saturationCurve,
        hueCurve: config.hueCurve,
        generatedShades: config.generatedShades,
        updatedAt: config.updatedAt,
      },
    });
  }

  shadeGroups.sort((a, b) => a.sourceVariableName.localeCompare(b.sourceVariableName));
  return shadeGroups;
}

function getManagedShadeVariables(
  sourceVariable: Variable,
  config: StoredShadeGeneratorConfig,
  variables: Variable[]
): Variable[] {
  const baseNames = new Set<string>([sourceVariable.name, config.sourceName]);

  for (const shade of config.generatedShades || []) {
    const baseName = getShadeBaseName(shade.name);
    if (baseName) {
      baseNames.add(baseName);
    }
  }

  const actualShadeVars = variables.filter(candidate => {
    if (candidate.id === sourceVariable.id) return false;
    if (candidate.variableCollectionId !== sourceVariable.variableCollectionId) return false;
    if (candidate.resolvedType !== 'COLOR') return false;

    const baseName = getShadeBaseName(candidate.name);
    return !!baseName && baseNames.has(baseName);
  });

  actualShadeVars.sort((a, b) => extractShadeNumber(a.name) - extractShadeNumber(b.name));
  return actualShadeVars;
}

function collectManagedShadeDeleteIds(
  sourceVariable: Variable,
  config: StoredShadeGeneratorConfig,
  variables: Variable[]
): string[] {
  return Array.from(new Set([
    ...(config.generatedShades || []).map(shade => shade.id),
    ...getManagedShadeVariables(sourceVariable, config, variables).map(shade => shade.id),
  ]));
}

function clamp(value: number, min: number, max: number): number {
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

function evaluateShadeCurveAtT(handles: ShadeCurveHandles, t: number, count: number, baseIndex: number): number {
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

function evaluateShadeCurveAtNodes(handles: ShadeCurveHandles, count: number, baseIndex: number): number[] {
  const normalizedHandles = normalizeCurveHandles(handles, count, baseIndex);
  const normalizedBaseIndex = normalizeShadeBaseIndex(baseIndex, count);
  const values: number[] = [];

  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0;
    values.push(i === normalizedBaseIndex ? 0 : evaluateShadeCurveAtT(normalizedHandles, t, count, normalizedBaseIndex));
  }

  return values;
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;
  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  const delta = max - min;

  let h = 0;
  const s = max === 0 ? 0 : delta / max;
  const v = max;

  if (delta !== 0) {
    switch (max) {
      case nr:
        h = ((ng - nb) / delta + (ng < nb ? 6 : 0)) * 60;
        break;
      case ng:
        h = ((nb - nr) / delta + 2) * 60;
        break;
      default:
        h = ((nr - ng) / delta + 4) * 60;
        break;
    }
  }

  return { h, s: s * 100, v: v * 100 };
}

function hsvToRgb(h: number, s: number, v: number): RGBColor {
  const normalizedS = s / 100;
  const normalizedV = v / 100;
  const i = Math.floor(h / 60) % 6;
  const f = h / 60 - Math.floor(h / 60);
  const p = normalizedV * (1 - normalizedS);
  const q = normalizedV * (1 - f * normalizedS);
  const t = normalizedV * (1 - (1 - f) * normalizedS);

  let r = normalizedV;
  let g = normalizedV;
  let b = normalizedV;

  switch (i) {
    case 0:
      r = normalizedV; g = t; b = p;
      break;
    case 1:
      r = q; g = normalizedV; b = p;
      break;
    case 2:
      r = p; g = normalizedV; b = t;
      break;
    case 3:
      r = p; g = q; b = normalizedV;
      break;
    case 4:
      r = t; g = p; b = normalizedV;
      break;
    default:
      r = normalizedV; g = p; b = q;
      break;
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

function lightnessToRgb(baseRgb: RGBColor, lightness: number): RGBColor {
  if (lightness <= 50) {
    const t = lightness / 50;
    return {
      r: Math.round(255 + (baseRgb.r - 255) * t),
      g: Math.round(255 + (baseRgb.g - 255) * t),
      b: Math.round(255 + (baseRgb.b - 255) * t),
    };
  }

  const t = (lightness - 50) / 50;
  return {
    r: Math.round(baseRgb.r * (1 - t)),
    g: Math.round(baseRgb.g * (1 - t)),
    b: Math.round(baseRgb.b * (1 - t)),
  };
}

function rgbToCss(rgb: RGBColor): string {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

function getShadeNames(count: number): string[] {
  if (count === 5) return ['100', '300', '500', '700', '900'];
  if (count === 10) return ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
  if (count === 11) return ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const value = Math.round(50 + (i / (count - 1)) * 900);
    names.push(String(value));
  }
  return names;
}

function getShadeBaseIndex(count: number): number {
  return getDefaultShadeBaseIndex(count);
}

function getBaseShadeToneAtT(
  t: number,
  count: number,
  baseIndex: number,
  lightValue: number,
  darkValue: number
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

function buildManagedShadePayload(
  baseRgb: RGBColor,
  groupName: string,
  config: ShadeConfigPayload
): { name: string; value: string }[] {
  const normalizedBaseIndex = normalizeShadeBaseIndex(config.baseIndex, config.shadeCount);
  const lightAdj = evaluateShadeCurveAtNodes(config.lightnessCurve, config.shadeCount, normalizedBaseIndex);
  const satAdj = evaluateShadeCurveAtNodes(config.saturationCurve, config.shadeCount, normalizedBaseIndex);
  const hueAdj = evaluateShadeCurveAtNodes(config.hueCurve, config.shadeCount, normalizedBaseIndex);
  const names = getShadeNames(config.shadeCount);
  const colors: { name: string; value: string }[] = [];
  const baseHsv = rgbToHsv(baseRgb.r, baseRgb.g, baseRgb.b);

  for (let i = 0; i < config.shadeCount; i++) {
    const t = config.shadeCount > 1 ? i / (config.shadeCount - 1) : 0;
    const baseLightness = getBaseShadeToneAtT(t, config.shadeCount, normalizedBaseIndex, config.lightValue, config.darkValue);
    const lightness = clamp(baseLightness + (lightAdj[i] || 0), 0, 100);
    const saturation = clamp(baseHsv.s + (satAdj[i] || 0), 0, 100);
    const hue = (baseHsv.h + (hueAdj[i] || 0) + 360) % 360;
    const adjustedRgb = hsvToRgb(hue, saturation, baseHsv.v);
    const shadeRgb = lightnessToRgb(adjustedRgb, lightness);

    colors.push({
      name: `${groupName}/${names[i]}`,
      value: rgbToCss(shadeRgb),
    });
  }

  if (colors[normalizedBaseIndex]) {
    colors[normalizedBaseIndex].value = rgbToCss(baseRgb);
  }

  return colors;
}

async function resolveSourceVariableRgb(
  variable: Variable,
  visited = new Set<string>()
): Promise<RGBColor | null> {
  if (visited.has(variable.id)) {
    return null;
  }

  visited.add(variable.id);
  const modeId = Object.keys(variable.valuesByMode)[0];
  const value = variable.valuesByMode[modeId];

  if (value && typeof value === 'object' && 'type' in value && value.type === 'VARIABLE_ALIAS') {
    const referencedVariable = await figma.variables.getVariableByIdAsync(value.id);
    if (!referencedVariable) {
      return null;
    }
    return resolveSourceVariableRgb(referencedVariable, visited);
  }

  if (value && typeof value === 'object' && 'r' in value) {
    return {
      r: Math.round(value.r * 255),
      g: Math.round(value.g * 255),
      b: Math.round(value.b * 255),
    };
  }

  return null;
}

async function buildUiState(): Promise<UIState> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const variables = await figma.variables.getLocalVariablesAsync();

  console.log('[Plugin] Collections:', collections.map(c => ({ name: c.name, variableIds: c.variableIds })));
  console.log('[Plugin] Variables from API:', variables.map(v => v.name));

  const collectionData: CollectionData[] = collections.map(c => ({
    id: c.id,
    name: c.name
  }));

  let variableData: UIVariableData[] = [];
  for (const collection of collections) {
    for (const varId of collection.variableIds) {
      const variable = variables.find(v => v.id === varId);
      if (variable) {
        const modeId = Object.keys(variable.valuesByMode)[0];
        const value = variable.valuesByMode[modeId];
        variableData.push({
          id: variable.id,
          collectionId: variable.variableCollectionId,
          name: variable.name,
          resolvedType: variable.resolvedType,
          value: await formatValue(value, variable.resolvedType)
        });
      }
    }
  }

  variableData = sortVariableData(variableData);
  console.log('[Plugin] Variables after collection order:', variableData.map(v => v.name));

  const formattedValueMap = new Map(variableData.map(variable => [variable.id, variable.value]));
  const shadeGroups = buildShadeGroups(variables, formattedValueMap);
  const hash = JSON.stringify({
    collections: collectionData,
    variables: variableData,
    shadeGroups,
  });

  return {
    collectionData,
    variableData,
    shadeGroups,
    hash,
  };
}

// Fetch and send all data to UI
async function fetchData() {
  await syncManagedShadeSources();
  const { collectionData, variableData, shadeGroups, hash } = await buildUiState();

  lastDataHash = hash;

  console.log('[Plugin] Sending data-loaded with', collectionData.length, 'collections,', variableData.length, 'variables and', shadeGroups.length, 'shade groups');
  figma.ui.postMessage({
    type: 'data-loaded',
    collections: collectionData,
    variables: variableData,
    shadeGroups,
  });
}

async function formatValue(value: any, type: string): Promise<string> {
  if (value === null || value === undefined) {
    return 'undefined';
  }

  if (typeof value === 'object' && 'type' in value && value.type === 'VARIABLE_ALIAS') {
    // Look up the referenced variable and return its name in {name} format
    try {
      const refVariable = await figma.variables.getVariableByIdAsync(value.id);
      if (refVariable) {
        return `{${refVariable.name}}`;
      }
    } catch (e) {
      // If lookup fails, return the ID
    }
    return `→ ${value.id}`;
  }

  switch (type) {
    case 'COLOR':
      if (typeof value === 'object' && 'r' in value) {
        const r = Math.round(value.r * 255);
        const g = Math.round(value.g * 255);
        const b = Math.round(value.b * 255);
        const a = value.a !== undefined ? value.a : 1;
        const toHex = (n: number) => ('0' + n.toString(16).toUpperCase()).slice(-2);
        const hex = '#' + toHex(r) + toHex(g) + toHex(b);
        if (a < 1) {
          return hex + toHex(Math.round(a * 255));
        }
        return hex;
      }
      return String(value);
    case 'FLOAT':
      // Round to remove floating point precision artifacts
      const rounded = Math.round(value * 1000) / 1000;
      // If it's a whole number, show without decimals
      return Number.isInteger(rounded) ? String(rounded) : String(rounded);
    case 'STRING':
      return String(value);
    case 'BOOLEAN':
      return value ? 'true' : 'false';
    default:
      return JSON.stringify(value);
  }
}

async function parseValue(value: string, type: string): Promise<any> {
  // Check if value is a variable reference (format: {variableName})
  const refMatch = value.match(/^\{(.+)\}$/);
  if (refMatch) {
    const refName = refMatch[1];
    const variables = await figma.variables.getLocalVariablesAsync();
    const refVariable = variables.find(v => v.name === refName);

    if (!refVariable) {
      throw new Error(`Referenced variable not found: ${refName}`);
    }

    // Return a variable alias
    return {
      type: 'VARIABLE_ALIAS',
      id: refVariable.id
    };
  }

  switch (type) {
    case 'COLOR':
      const rgbaMatch = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (rgbaMatch) {
        return {
          r: parseInt(rgbaMatch[1]) / 255,
          g: parseInt(rgbaMatch[2]) / 255,
          b: parseInt(rgbaMatch[3]) / 255,
          a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1
        };
      }
      const hexMatch = value.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
      if (hexMatch) {
        let hex = hexMatch[1];
        if (hex.length === 3) {
          hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        return {
          r: parseInt(hex.substring(0, 2), 16) / 255,
          g: parseInt(hex.substring(2, 4), 16) / 255,
          b: parseInt(hex.substring(4, 6), 16) / 255,
          a: 1
        };
      }
      throw new Error(`Invalid color format: ${value}`);
    case 'FLOAT':
      const num = parseFloat(value);
      if (isNaN(num)) throw new Error(`Invalid number: ${value}`);
      return num;
    case 'STRING':
      return value;
    case 'BOOLEAN':
      if (value === 'true') return true;
      if (value === 'false') return false;
      throw new Error(`Invalid boolean: ${value}`);
    default:
      return value;
  }
}

function getDefaultValue(type: string): any {
  switch (type) {
    case 'COLOR':
      return { r: 0, g: 0, b: 0, a: 1 };
    case 'FLOAT':
      return 0;
    case 'STRING':
      return '';
    case 'BOOLEAN':
      return false;
    default:
      return null;
  }
}

// Create a new collection
async function createCollection(name: string) {
  try {
    figma.variables.createVariableCollection(name);
    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Create a new variable
async function createVariable(
  collectionId: string,
  name: string,
  varType: string,
  value: string
) {
  try {
    let collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);

    // Auto-create default collection if none exists (like Figma does)
    if (!collection) {
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      if (collections.length === 0) {
        collection = figma.variables.createVariableCollection('Collection 1');
      } else {
        throw new Error('Collection not found');
      }
    }

    const resolvedType = varType as VariableResolvedDataType;
    const variable = figma.variables.createVariable(name, collection, resolvedType);

    const modeId = collection.modes[0].modeId;
    const parsedValue = value ? await parseValue(value, varType) : getDefaultValue(varType);
    variable.setValueForMode(modeId, parsedValue);

    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Update variable name
async function updateVariableName(id: string, newName: string) {
  try {
    const variable = await figma.variables.getVariableByIdAsync(id);
    if (variable) {
      variable.name = newName;
      await fetchData();
      figma.ui.postMessage({ type: 'update-success' });
    }
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Update variable value
async function updateVariableValue(id: string, newValue: string) {
  try {
    const variable = await figma.variables.getVariableByIdAsync(id);
    if (variable) {
      const modeId = Object.keys(variable.valuesByMode)[0];
      const parsedValue = await parseValue(newValue, variable.resolvedType);
      variable.setValueForMode(modeId, parsedValue);
      await fetchData();
      figma.ui.postMessage({ type: 'update-success' });
    }
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Delete variable
async function deleteVariable(id: string) {
  try {
    const variable = await figma.variables.getVariableByIdAsync(id);
    if (variable) {
      const shadeConfig = readShadeGeneratorConfig(variable);
      if (shadeConfig) {
        for (const shade of shadeConfig.generatedShades) {
          const shadeVariable = await figma.variables.getVariableByIdAsync(shade.id);
          if (shadeVariable) {
            shadeVariable.remove();
          }
        }
      }
      variable.remove();
      await fetchData();
      figma.ui.postMessage({ type: 'update-success' });
    }
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Delete group of variables
async function deleteGroup(ids: string[]) {
  try {
    for (const id of ids) {
      const variable = await figma.variables.getVariableByIdAsync(id);
      if (variable) {
        variable.remove();
      }
    }
    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Duplicate variable
async function duplicateVariable(id: string) {
  try {
    const variable = await figma.variables.getVariableByIdAsync(id);
    if (variable) {
      const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
      if (!collection) throw new Error('Collection not found');

      const newVariable = figma.variables.createVariable(
        variable.name + ' copy',
        collection,
        variable.resolvedType
      );

      // Copy value from first mode
      const modeId = Object.keys(variable.valuesByMode)[0];
      const value = variable.valuesByMode[modeId];
      newVariable.setValueForMode(modeId, value);

      await fetchData();
      figma.ui.postMessage({ type: 'update-success' });
    }
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Bulk update group from CSV
async function bulkUpdateGroup(
  collectionId: string,
  groupName: string,
  updates: { name: string; value: string }[]
) {
  try {
    const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
    if (!collection) throw new Error('Collection not found');

    const modeId = collection.modes[0].modeId;
    const existingVariables = await figma.variables.getLocalVariablesAsync();

    // Find all variables in this group (matching groupName/ prefix)
    const groupPrefix = groupName + '/';
    const groupVariables = existingVariables.filter(v =>
      v.variableCollectionId === collectionId && v.name.startsWith(groupPrefix)
    );

    // Get set of names that should exist after update
    const updateNames = new Set(updates.map(u => u.name));

    // Delete variables that are in the group but not in updates
    for (const variable of groupVariables) {
      if (!updateNames.has(variable.name)) {
        variable.remove();
      }
    }

    // Update or create variables
    for (const update of updates) {
      // Find existing variable with this name
      const existing = existingVariables.find(v =>
        v.variableCollectionId === collectionId && v.name === update.name
      );

      if (existing) {
        // Update existing variable
        const parsedValue = await parseValue(update.value, existing.resolvedType);
        existing.setValueForMode(modeId, parsedValue);
      } else {
        // Create new variable - detect type from value
        let varType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN' = 'STRING';

        if (update.value.startsWith('#') || update.value.startsWith('rgb') || update.value.startsWith('{')) {
          varType = 'COLOR';
        } else if (!isNaN(Number(update.value))) {
          varType = 'FLOAT';
        } else if (update.value === 'true' || update.value === 'false') {
          varType = 'BOOLEAN';
        }

        const newVariable = figma.variables.createVariable(update.name, collection, varType);
        const parsedValue = await parseValue(update.value, varType);
        newVariable.setValueForMode(modeId, parsedValue);
      }
    }

    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

async function upsertShadeSourceVariable(
  collection: VariableCollection,
  modeId: string,
  source: ShadeSourceInput
): Promise<Variable> {
  let variable: Variable | null = null;

  if (source.id) {
    variable = await figma.variables.getVariableByIdAsync(source.id);
  }

  if (!variable) {
    const variables = await figma.variables.getLocalVariablesAsync();
    variable = variables.find(
      candidate =>
        candidate.variableCollectionId === collection.id &&
        candidate.name === source.name &&
        candidate.resolvedType === 'COLOR'
    ) || null;
  }

  if (!variable) {
    variable = figma.variables.createVariable(source.name, collection, 'COLOR');
  }

  if (variable.variableCollectionId !== collection.id) {
    throw new Error('Source color must be in the selected collection');
  }

  if (variable.resolvedType !== 'COLOR') {
    throw new Error('Source variable must be a color');
  }

  if (variable.name !== source.name) {
    variable.name = source.name;
  }

  const parsedValue = await parseValue(source.value, 'COLOR');
  variable.setValueForMode(modeId, parsedValue);

  return variable;
}

async function persistShadeGeneratorConfig(
  sourceVariable: Variable,
  modeId: string,
  config: ShadeConfigPayload,
  shadeVariables: Variable[]
): Promise<void> {
  const generatedShades: StoredShadeData[] = [];
  for (const variable of shadeVariables) {
    generatedShades.push({
      id: variable.id,
      name: variable.name,
      value: await formatValue(variable.valuesByMode[modeId], variable.resolvedType),
    });
  }

  const storedConfig: StoredShadeGeneratorConfig = {
    version: 2,
    sourceVariableId: sourceVariable.id,
    sourceName: sourceVariable.name,
    sourceValue: await formatValue(sourceVariable.valuesByMode[modeId], sourceVariable.resolvedType),
    shadeCount: config.shadeCount,
    baseIndex: normalizeShadeBaseIndex(config.baseIndex, config.shadeCount),
    lightValue: config.lightValue,
    darkValue: config.darkValue,
    lightnessCurve: config.lightnessCurve,
    saturationCurve: config.saturationCurve,
    hueCurve: config.hueCurve,
    generatedShades,
    updatedAt: new Date().toISOString(),
  };

  sourceVariable.setPluginData(SHADE_GENERATOR_CONFIG_KEY, JSON.stringify(storedConfig));
}

async function applyShadeUpdate(
  collection: VariableCollection,
  modeId: string,
  deleteIds: string[],
  shades: { name: string; value: string }[],
  sourceVariable: Variable | null,
  config?: ShadeConfigPayload
): Promise<void> {
  const existingVars: { id: string; variable: Variable }[] = [];
  for (const id of Array.from(new Set(deleteIds))) {
    if (sourceVariable && id === sourceVariable.id) {
      continue;
    }

    const variable = await figma.variables.getVariableByIdAsync(id);
    if (variable) {
      existingVars.push({ id, variable });
    }
  }

  existingVars.sort((a, b) => extractShadeNumber(a.variable.name) - extractShadeNumber(b.variable.name));
  const sortedShades = [...shades].sort((a, b) => extractShadeNumber(a.name) - extractShadeNumber(b.name));
  const finalShadeVariables: Variable[] = [];

  const reusedCount = Math.min(existingVars.length, sortedShades.length);
  for (let i = 0; i < reusedCount; i++) {
    const variable = existingVars[i].variable;
    const shade = sortedShades[i];

    variable.name = shade.name;
    const parsedValue = await parseValue(shade.value, 'COLOR');
    variable.setValueForMode(modeId, parsedValue);
    finalShadeVariables.push(variable);
  }

  for (let i = reusedCount; i < existingVars.length; i++) {
    existingVars[i].variable.remove();
  }

  for (let i = reusedCount; i < sortedShades.length; i++) {
    const shade = sortedShades[i];
    const variable = figma.variables.createVariable(shade.name, collection, 'COLOR');
    const parsedValue = await parseValue(shade.value, 'COLOR');
    variable.setValueForMode(modeId, parsedValue);
    finalShadeVariables.push(variable);
  }

  if (sourceVariable) {
    if (config) {
      await persistShadeGeneratorConfig(sourceVariable, modeId, config, finalShadeVariables);
    } else {
      clearShadeGeneratorConfig(sourceVariable);
    }
  }
}

async function syncManagedShadeSources(): Promise<boolean> {
  const variables = await figma.variables.getLocalVariablesAsync();
  let syncedAny = false;

  for (const variable of variables) {
    if (variable.resolvedType !== 'COLOR') continue;

    const storedConfig = readShadeGeneratorConfig(variable);
    if (!storedConfig) continue;

    const modeId = Object.keys(variable.valuesByMode)[0];
    const currentSourceValue = await formatValue(variable.valuesByMode[modeId], variable.resolvedType);
    const sourceChanged =
      currentSourceValue !== storedConfig.sourceValue ||
      variable.name !== storedConfig.sourceName;

    if (!sourceChanged) continue;

    const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
    if (!collection) continue;

    const resolvedSourceRgb = await resolveSourceVariableRgb(variable);
    if (!resolvedSourceRgb) continue;
    const nextBaseIndex = getShadeBaseIndexForRgb(resolvedSourceRgb, storedConfig.shadeCount);

    const shades = buildManagedShadePayload(resolvedSourceRgb, variable.name, {
      shadeCount: storedConfig.shadeCount,
      baseIndex: nextBaseIndex,
      lightValue: storedConfig.lightValue,
      darkValue: storedConfig.darkValue,
      lightnessCurve: storedConfig.lightnessCurve,
      saturationCurve: storedConfig.saturationCurve,
      hueCurve: storedConfig.hueCurve,
    });

    await applyShadeUpdate(
      collection,
      modeId,
      collectManagedShadeDeleteIds(variable, storedConfig, variables),
      shades,
      variable,
      {
        shadeCount: storedConfig.shadeCount,
        baseIndex: nextBaseIndex,
        lightValue: storedConfig.lightValue,
        darkValue: storedConfig.darkValue,
        lightnessCurve: storedConfig.lightnessCurve,
        saturationCurve: storedConfig.saturationCurve,
        hueCurve: storedConfig.hueCurve,
      }
    );

    syncedAny = true;
  }

  return syncedAny;
}

// Create color shades
async function createShades(
  collectionId: string,
  shades: { name: string; value: string }[]
) {
  try {
    const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
    if (!collection) throw new Error('Collection not found');

    const modeId = collection.modes[0].modeId;

    for (const shade of shades) {
      const variable = figma.variables.createVariable(shade.name, collection, 'COLOR');
      const parsedValue = await parseValue(shade.value, 'COLOR');
      variable.setValueForMode(modeId, parsedValue);
    }

    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Update color shades (update existing, delete extras, create new ones as needed)
async function updateShades(
  collectionId: string,
  deleteIds: string[],
  shades: { name: string; value: string }[],
  source?: ShadeSourceInput,
  config?: ShadeConfigPayload
) {
  try {
    const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
    if (!collection) throw new Error('Collection not found');

    const modeId = collection.modes[0].modeId;
    const sourceVariable = source
      ? await upsertShadeSourceVariable(collection, modeId, source)
      : null;
    await applyShadeUpdate(collection, modeId, deleteIds, shades, sourceVariable, config);

    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Remove shades and keep the source color
async function removeShades(
  collectionId: string,
  deleteIds: string[],
  source?: ShadeSourceInput
) {
  try {
    const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
    if (!collection) throw new Error('Collection not found');

    const modeId = collection.modes[0].modeId;
    const sourceVariable = source
      ? await upsertShadeSourceVariable(collection, modeId, source)
      : null;

    for (const id of Array.from(new Set(deleteIds))) {
      if (sourceVariable && id === sourceVariable.id) {
        continue;
      }

      const variable = await figma.variables.getVariableByIdAsync(id);
      if (variable) {
        variable.remove();
      }
    }

    if (sourceVariable) {
      clearShadeGeneratorConfig(sourceVariable);
    }

    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Create number steps
async function createSteps(
  collectionId: string,
  steps: { name: string; value: string }[]
) {
  try {
    const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
    if (!collection) throw new Error('Collection not found');

    const modeId = collection.modes[0].modeId;

    // Get all existing variables in the collection
    const allVariables = await figma.variables.getLocalVariablesAsync('FLOAT');
    const existingVarsMap = new Map<string, Variable>();
    for (const v of allVariables) {
      if (v.variableCollectionId === collectionId) {
        existingVarsMap.set(v.name, v);
      }
    }

    for (const step of steps) {
      const existing = existingVarsMap.get(step.name);
      const parsedValue = await parseValue(step.value, 'FLOAT');

      if (existing) {
        // Update existing variable
        existing.setValueForMode(modeId, parsedValue);
      } else {
        // Create new variable
        const variable = figma.variables.createVariable(step.name, collection, 'FLOAT');
        variable.setValueForMode(modeId, parsedValue);
      }
    }

    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Update number steps (update existing, delete extras, create new ones as needed)
async function updateSteps(
  collectionId: string,
  deleteIds: string[],
  steps: { name: string; value: string }[]
) {
  try {
    const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
    if (!collection) throw new Error('Collection not found');

    const modeId = collection.modes[0].modeId;

    // Get existing variables from the deleteIds list
    const existingVars: { id: string; variable: Variable }[] = [];
    for (const id of deleteIds) {
      const variable = await figma.variables.getVariableByIdAsync(id);
      if (variable) {
        existingVars.push({ id, variable });
      }
    }

    // Steps arrive in the correct order from UI, so preserve that order
    // Match existing variables to new steps by index position
    const reusedCount = Math.min(existingVars.length, steps.length);
    for (let i = 0; i < reusedCount; i++) {
      const variable = existingVars[i].variable;
      const step = steps[i];

      // Update name and value
      variable.name = step.name;
      const parsedValue = await parseValue(step.value, 'FLOAT');
      variable.setValueForMode(modeId, parsedValue);
    }

    // Delete excess variables if we have more existing than needed
    for (let i = reusedCount; i < existingVars.length; i++) {
      existingVars[i].variable.remove();
    }

    // Create new variables if we need more than we had
    for (let i = reusedCount; i < steps.length; i++) {
      const step = steps[i];
      const variable = figma.variables.createVariable(step.name, collection, 'FLOAT');
      const parsedValue = await parseValue(step.value, 'FLOAT');
      variable.setValueForMode(modeId, parsedValue);
    }

    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Remove steps and convert back to single number
async function removeSteps(
  collectionId: string,
  deleteIds: string[],
  newNumber: { name: string; value: string }
) {
  try {
    // Delete all steps
    for (const id of deleteIds) {
      const variable = await figma.variables.getVariableByIdAsync(id);
      if (variable) {
        variable.remove();
      }
    }

    // Create single number
    const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
    if (!collection) throw new Error('Collection not found');

    const modeId = collection.modes[0].modeId;
    const variable = figma.variables.createVariable(newNumber.name, collection, 'FLOAT');
    const parsedValue = await parseValue(newNumber.value, 'FLOAT');
    variable.setValueForMode(modeId, parsedValue);

    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Reorder variable (plugin-only - Figma API doesn't support native reordering)
async function reorderVariable(draggedId: string, targetId: string, insertBefore: boolean) {
  try {
    // Get current Figma order from collections
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    let order: string[] = [];
    for (const collection of collections) {
      order = order.concat(collection.variableIds);
    }

    // Remove dragged item from current position
    const draggedIndex = order.indexOf(draggedId);
    if (draggedIndex > -1) {
      order.splice(draggedIndex, 1);
    }

    // Find target position and insert
    let targetIndex = order.indexOf(targetId);
    if (!insertBefore) {
      targetIndex++;
    }
    order.splice(targetIndex, 0, draggedId);

    // Save custom order (Note: this only affects plugin display, not Figma's native panel)
    setVariableOrder(order);
    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
  } catch (error: any) {
    console.error('[Plugin] Reorder error:', error);
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Update from JSON
async function updateFromJson(data: { collections: CollectionData[], variables: any[] }) {
  try {
    // Get collection IDs from the data
    const collectionIds = new Set(data.collections.map(c => c.id));

    // Get all current variables from those collections
    const allVariables = await figma.variables.getLocalVariablesAsync();
    const currentVarsInCollections = allVariables.filter(v => collectionIds.has(v.variableCollectionId));

    // Get IDs of variables in the JSON data
    const jsonVarIds = new Set(data.variables.map(v => v.id).filter(Boolean));

    // Delete variables that exist in Figma but not in the JSON
    for (const variable of currentVarsInCollections) {
      if (!jsonVarIds.has(variable.id)) {
        variable.remove();
      }
    }

    // Update existing variables
    for (const varData of data.variables) {
      if (varData.id) {
        const variable = await figma.variables.getVariableByIdAsync(varData.id);
        if (variable) {
          if (varData.name && varData.name !== variable.name) {
            variable.name = varData.name;
          }
          if (varData.value !== undefined) {
            const modeId = Object.keys(variable.valuesByMode)[0];
            const parsedValue = await parseValue(varData.value, varData.type || variable.resolvedType);
            variable.setValueForMode(modeId, parsedValue);
          }
        }
      }
    }

    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Poll for changes
async function checkForChanges() {
  const syncedManagedShades = await syncManagedShadeSources();
  if (syncedManagedShades) {
    await fetchData();
    return;
  }

  const { hash: currentHash } = await buildUiState();

  if (lastDataHash && currentHash !== lastDataHash) {
    figma.ui.postMessage({ type: 'changes-detected' });
  }
}

// Start polling
setInterval(checkForChanges, 2000);

// Initial fetch
fetchData();

// Message handler
figma.ui.onmessage = async (msg: any) => {
  switch (msg.type) {
    case 'refresh':
      console.log('[Plugin] Refresh received');
      setVariableOrder([]); // Clear custom order on refresh to match Figma's order
      await fetchData();
      console.log('[Plugin] Refresh complete');
      break;

    case 'create-collection':
      await createCollection(msg.name);
      break;

    case 'create-variable':
      await createVariable(msg.collectionId, msg.name, msg.varType, msg.value);
      break;

    case 'update-variable-name':
      await updateVariableName(msg.id, msg.name);
      break;

    case 'update-variable-value':
      await updateVariableValue(msg.id, msg.value);
      break;

    case 'delete-variable':
      await deleteVariable(msg.id);
      break;

    case 'delete-group':
      await deleteGroup(msg.ids);
      break;

    case 'duplicate-variable':
      await duplicateVariable(msg.id);
      break;

    case 'bulk-update-group':
      await bulkUpdateGroup(msg.collectionId, msg.groupName, msg.updates);
      break;

    case 'update-from-json':
      await updateFromJson(msg.data);
      break;

    case 'create-shades':
      await createShades(msg.collectionId, msg.shades);
      break;

    case 'update-shades':
      await updateShades(msg.collectionId, msg.deleteIds, msg.shades, msg.source, msg.config);
      break;

    case 'remove-shades':
      await removeShades(msg.collectionId, msg.deleteIds, msg.source);
      break;

    case 'create-steps':
      await createSteps(msg.collectionId, msg.steps);
      break;

    case 'update-steps':
      await updateSteps(msg.collectionId, msg.deleteIds, msg.steps);
      break;

    case 'remove-steps':
      await removeSteps(msg.collectionId, msg.deleteIds, msg.newNumber);
      break;

    case 'reorder-variable':
      await reorderVariable(msg.draggedId, msg.targetId, msg.insertBefore);
      break;

    case 'reset-order':
      setVariableOrder([]);
      await fetchData();
      break;

    case 'get-client-storage':
      try {
        const value = await figma.clientStorage.getAsync(msg.key);
        figma.ui.postMessage({ type: 'client-storage-data', key: msg.key, value });
      } catch (error) {
        console.error('[Plugin] Error getting client storage:', error);
      }
      break;

    case 'set-client-storage':
      try {
        await figma.clientStorage.setAsync(msg.key, msg.value);
      } catch (error) {
        console.error('[Plugin] Error setting client storage:', error);
      }
      break;

    case 'resize':
      figma.ui.resize(msg.width, msg.height);
      break;

    case 'cancel':
      figma.closePlugin();
      break;
  }
};
