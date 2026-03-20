// Tokens Manager - Figma Plugin

figma.showUI(__html__, { width: 750, height: 500, themeColors: true } as any);

// Track variable state for change detection
let lastDataHash = '';
const RELAUNCH_COMMAND = 'open';
const RELAUNCH_DESCRIPTION = 'Manage variables and design tokens';

interface UIVariableData {
  id: string;
  collectionId: string;
  name: string;
  resolvedType: string;
  value: string; // First mode value (for backward compatibility)
  valuesByMode: Record<string, string>; // All mode values
}

interface CollectionData {
  id: string;
  name: string;
  modes: Array<{ modeId: string; name: string }>;
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

interface StoredStepData {
  id: string;
  name: string;
  ratio: number; // Ratio relative to base value
}

interface StoredStepEntry {
  id: string | null;
  name: string;
  ratio: number;
  isBase: boolean;
}

interface StoredStepModalState {
  ratioPreset: string;
  customRatio: number;
  stepsPreset: string;
  stepsList: string;
  baseStep: string;
}

interface StoredStepModeConfig {
  steps: StoredStepEntry[];
  generatedSteps: StoredStepData[];
  modalState: StoredStepModalState;
}

interface StoredStepGeneratorConfig {
  version: number;
  sourceVariableId: string;
  sourceName: string;
  baseStepName: string; // Which step references the source (e.g., 'md')
  generatedSteps: StoredStepData[];
  steps?: StoredStepEntry[];
  modalState?: StoredStepModalState;
  modes?: Record<string, StoredStepModeConfig>;
  updatedAt: string;
}

interface HistoryCollectionSnapshot {
  id: string;
  name: string;
  hiddenFromPublishing: boolean;
  modes: Array<{ id: string; name: string }>;
}

interface HistoryVariableSnapshot {
  id: string;
  collectionId: string;
  name: string;
  resolvedType: string;
  valuesByMode: Record<string, string>;
  shadeConfig: StoredShadeGeneratorConfig | null;
  stepConfig: StoredStepGeneratorConfig | null;
}

interface HistorySnapshot {
  collections: HistoryCollectionSnapshot[];
  variables: HistoryVariableSnapshot[];
  variableOrder: string[];
  hash: string;
}

const STEP_RATIO_PRESET_VALUES = [
  { value: '1.125', ratio: 1.125 },
  { value: '1.2', ratio: 1.2 },
  { value: '1.25', ratio: 1.25 },
  { value: '1.333', ratio: 1.333 },
  { value: '1.414', ratio: 1.414 },
  { value: '1.5', ratio: 1.5 },
  { value: '1.618', ratio: 1.618 },
  { value: '2', ratio: 2 },
];

const STEP_NAME_PRESETS = [
  { value: 'tshirt', steps: ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'], baseStep: 'md' },
  { value: 'numeric', steps: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'], baseStep: '5' },
  { value: 'gutenberg', steps: ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'ultra'], baseStep: 'md' },
];

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
const STEP_GENERATOR_CONFIG_KEY = 'stepGeneratorConfig';
const DEFAULT_SHADE_LIGHT_VALUE = 5;
const DEFAULT_SHADE_DARK_VALUE = 90;
const HISTORY_LIMIT = 20;

let undoHistory: HistorySnapshot[] = [];
let redoHistory: HistorySnapshot[] = [];
let currentHistoryHash = '';

function setSidebarRelaunchData(): void {
  const relaunchData = { [RELAUNCH_COMMAND]: RELAUNCH_DESCRIPTION };

  figma.root.setRelaunchData(relaunchData);
  figma.currentPage.setRelaunchData(relaunchData);
}

// Get stored variable order
function getVariableOrder(): string[] {
  const orderJson = figma.root.getPluginData('variableOrder');
  return orderJson ? JSON.parse(orderJson) : [];
}

// Set stored variable order
function setVariableOrder(order: string[]): void {
  figma.root.setPluginData('variableOrder', JSON.stringify(order));
}

function getHistoryVariableKey(
  collectionIndexById: Map<string, number>,
  variable: Pick<HistoryVariableSnapshot, 'collectionId' | 'resolvedType' | 'name'>
): string {
  const storedIndex = collectionIndexById.get(variable.collectionId);
  const collectionIndex = storedIndex !== undefined ? storedIndex : -1;
  return `${collectionIndex}::${variable.resolvedType}::${variable.name}`;
}

function buildHistoryHash(snapshot: Omit<HistorySnapshot, 'hash'>): string {
  const collectionIndexById = new Map<string, number>();
  snapshot.collections.forEach((collection, index) => {
    collectionIndexById.set(collection.id, index);
  });

  const variableKeyById = new Map<string, string>();
  snapshot.variables.forEach(variable => {
    variableKeyById.set(variable.id, getHistoryVariableKey(collectionIndexById, variable));
  });

  const normalizeShadeConfigForHash = (config: StoredShadeGeneratorConfig | null) => {
    if (!config) return null;
    return {
      version: config.version,
      sourceName: config.sourceName,
      sourceValue: config.sourceValue,
      shadeCount: config.shadeCount,
      baseIndex: config.baseIndex,
      lightValue: config.lightValue,
      darkValue: config.darkValue,
      lightnessCurve: config.lightnessCurve,
      saturationCurve: config.saturationCurve,
      hueCurve: config.hueCurve,
      generatedShades: config.generatedShades.map(shade => ({
        name: shade.name,
        value: shade.value,
      })),
    };
  };

  const normalizeStepEntriesForHash = (steps: StoredStepEntry[]) =>
    steps.map(step => ({
      name: step.name,
      ratio: step.ratio,
      isBase: step.isBase,
    }));

  const normalizeGeneratedStepsForHash = (steps: StoredStepData[]) =>
    steps.map(step => ({
      name: step.name,
      ratio: step.ratio,
    }));

  const normalizeStepConfigForHash = (collectionId: string, config: StoredStepGeneratorConfig | null) => {
    if (!config) return null;

    const collection = snapshot.collections.find(candidate => candidate.id === collectionId) || null;
    const orderedModes = collection ? collection.modes : [];
    const modes = orderedModes
      .map(mode => {
        const modeConfig = config.modes ? config.modes[mode.id] : null;
        if (!modeConfig) return null;
        return {
          name: mode.name,
          steps: normalizeStepEntriesForHash(modeConfig.steps),
          generatedSteps: normalizeGeneratedStepsForHash(modeConfig.generatedSteps),
          modalState: modeConfig.modalState,
        };
      })
      .filter((mode): mode is { name: string; steps: ReturnType<typeof normalizeStepEntriesForHash>; generatedSteps: ReturnType<typeof normalizeGeneratedStepsForHash>; modalState: StoredStepModalState } => mode !== null);

    return {
      version: config.version,
      sourceName: config.sourceName,
      baseStepName: config.baseStepName,
      steps: normalizeStepEntriesForHash(config.steps || []),
      generatedSteps: normalizeGeneratedStepsForHash(config.generatedSteps),
      modalState: config.modalState,
      modes,
    };
  };

  const normalizedVariables = snapshot.variables.map(variable => {
    const collection = snapshot.collections.find(candidate => candidate.id === variable.collectionId) || null;
    const orderedModes = collection ? collection.modes : [];
    const valuesByMode = orderedModes
      .filter(mode => Object.prototype.hasOwnProperty.call(variable.valuesByMode, mode.id))
      .map(mode => ({
        name: mode.name,
        value: variable.valuesByMode[mode.id],
      }));

    return {
      key: getHistoryVariableKey(collectionIndexById, variable),
      valuesByMode,
      shadeConfig: normalizeShadeConfigForHash(variable.shadeConfig),
      stepConfig: normalizeStepConfigForHash(variable.collectionId, variable.stepConfig),
    };
  });

  return JSON.stringify({
    collections: snapshot.collections.map(collection => ({
      name: collection.name,
      hiddenFromPublishing: collection.hiddenFromPublishing,
      modes: collection.modes.map(mode => mode.name),
    })),
    variables: normalizedVariables,
    variableOrder: snapshot.variableOrder
      .map(id => variableKeyById.get(id) || null)
      .filter((value): value is string => value !== null),
  });
}

function cloneStoredShadeConfig(config: StoredShadeGeneratorConfig | null): StoredShadeGeneratorConfig | null {
  if (!config) return null;
  return JSON.parse(JSON.stringify(config)) as StoredShadeGeneratorConfig;
}

function cloneStoredStepConfig(config: StoredStepGeneratorConfig | null): StoredStepGeneratorConfig | null {
  if (!config) return null;
  return JSON.parse(JSON.stringify(config)) as StoredStepGeneratorConfig;
}

async function captureHistorySnapshot(): Promise<HistorySnapshot> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const variables = await figma.variables.getLocalVariablesAsync();
  const variablesById = new Map(variables.map(variable => [variable.id, variable]));

  const collectionSnapshots: HistoryCollectionSnapshot[] = collections.map(collection => ({
    id: collection.id,
    name: collection.name,
    hiddenFromPublishing: collection.hiddenFromPublishing,
    modes: collection.modes.map(mode => ({
      id: mode.modeId,
      name: mode.name,
    })),
  }));

  const variableSnapshots: HistoryVariableSnapshot[] = [];
  for (const collection of collections) {
    for (const variableId of collection.variableIds) {
      const variable = variablesById.get(variableId);
      if (!variable) continue;

      const valuesByMode: Record<string, string> = {};
      for (const modeId of Object.keys(variable.valuesByMode)) {
        valuesByMode[modeId] = await formatValue(variable.valuesByMode[modeId], variable.resolvedType);
      }

      variableSnapshots.push({
        id: variable.id,
        collectionId: collection.id,
        name: variable.name,
        resolvedType: variable.resolvedType,
        valuesByMode,
        shadeConfig: cloneStoredShadeConfig(readShadeGeneratorConfig(variable)),
        stepConfig: cloneStoredStepConfig(readStepGeneratorConfig(variable)),
      });
    }
  }

  const snapshotBase = {
    collections: collectionSnapshots,
    variables: variableSnapshots,
    variableOrder: getVariableOrder().filter(variableId => variablesById.has(variableId)),
  };

  return {
    collections: snapshotBase.collections,
    variables: snapshotBase.variables,
    variableOrder: snapshotBase.variableOrder,
    hash: buildHistoryHash(snapshotBase),
  };
}

function remapShadeConfigForRestore(
  config: StoredShadeGeneratorConfig,
  variableIdMap: Map<string, Variable>
): StoredShadeGeneratorConfig {
  const remapped = cloneStoredShadeConfig(config);
  if (!remapped) {
    return config;
  }

  const sourceVariable = variableIdMap.get(config.sourceVariableId);
  remapped.sourceVariableId = sourceVariable ? sourceVariable.id : remapped.sourceVariableId;
  remapped.generatedShades = remapped.generatedShades.map(shade => ({
    id: (() => {
      const shadeVariable = variableIdMap.get(shade.id);
      return shadeVariable ? shadeVariable.id : shade.id;
    })(),
    name: shade.name,
    value: shade.value,
  }));
  remapped.updatedAt = new Date().toISOString();
  return remapped;
}

function remapStoredStepEntriesForRestore(
  steps: StoredStepEntry[] | undefined,
  variableIdMap: Map<string, Variable>
): StoredStepEntry[] | undefined {
  if (!steps) return steps;
  return steps.map(step => ({
    id: typeof step.id === 'string'
      ? (() => {
          const mappedVariable = variableIdMap.get(step.id);
          return mappedVariable ? mappedVariable.id : null;
        })()
      : null,
    name: step.name,
    ratio: step.ratio,
    isBase: step.isBase,
  }));
}

function remapStoredGeneratedStepsForRestore(
  steps: StoredStepData[],
  variableIdMap: Map<string, Variable>
): StoredStepData[] {
  return steps.map(step => ({
    id: (() => {
      const mappedVariable = variableIdMap.get(step.id);
      return mappedVariable ? mappedVariable.id : step.id;
    })(),
    name: step.name,
    ratio: step.ratio,
  }));
}

function remapStepConfigForRestore(
  config: StoredStepGeneratorConfig,
  variableIdMap: Map<string, Variable>,
  modeIdMap: Map<string, string>
): StoredStepGeneratorConfig {
  const remapped = cloneStoredStepConfig(config);
  if (!remapped) {
    return config;
  }

  const sourceVariable = variableIdMap.get(config.sourceVariableId);
  remapped.sourceVariableId = sourceVariable ? sourceVariable.id : remapped.sourceVariableId;
  remapped.generatedSteps = remapStoredGeneratedStepsForRestore(remapped.generatedSteps, variableIdMap);
  remapped.steps = remapStoredStepEntriesForRestore(remapped.steps, variableIdMap);

  if (remapped.modes) {
    const nextModes: Record<string, StoredStepModeConfig> = {};
    for (const [oldModeId, modeConfig] of Object.entries(remapped.modes)) {
      const newModeId = modeIdMap.get(oldModeId) || oldModeId;
      nextModes[newModeId] = {
        steps: remapStoredStepEntriesForRestore(modeConfig.steps, variableIdMap) || [],
        generatedSteps: remapStoredGeneratedStepsForRestore(modeConfig.generatedSteps, variableIdMap),
        modalState: modeConfig.modalState,
      };
    }
    remapped.modes = nextModes;
  }

  remapped.updatedAt = new Date().toISOString();
  return remapped;
}

async function restoreHistorySnapshot(snapshot: HistorySnapshot): Promise<void> {
  const existingCollections = await figma.variables.getLocalVariableCollectionsAsync();
  for (const collection of existingCollections) {
    collection.remove();
  }

  const collectionSnapshotById = new Map(snapshot.collections.map(collection => [collection.id, collection]));
  const collectionMap = new Map<string, VariableCollection>();
  const modeIdMap = new Map<string, string>();

  for (const collectionSnapshot of snapshot.collections) {
    const collection = figma.variables.createVariableCollection(collectionSnapshot.name);
    const defaultMode = collectionSnapshot.modes.length > 0 ? collectionSnapshot.modes[0] : null;
    const extraModes = collectionSnapshot.modes.slice(1);

    if (defaultMode) {
      collection.renameMode(collection.defaultModeId, defaultMode.name);
      modeIdMap.set(defaultMode.id, collection.defaultModeId);
    }

    for (const mode of extraModes) {
      const newModeId = collection.addMode(mode.name);
      modeIdMap.set(mode.id, newModeId);
    }

    collection.hiddenFromPublishing = collectionSnapshot.hiddenFromPublishing;
    collectionMap.set(collectionSnapshot.id, collection);
  }

  const variableMap = new Map<string, Variable>();
  for (const variableSnapshot of snapshot.variables) {
    const collection = collectionMap.get(variableSnapshot.collectionId);
    const collectionSnapshot = collectionSnapshotById.get(variableSnapshot.collectionId);
    if (!collection || !collectionSnapshot) continue;

    const variable = figma.variables.createVariable(
      variableSnapshot.name,
      collection,
      variableSnapshot.resolvedType as VariableResolvedDataType
    );
    const defaultModeId = collectionSnapshot.modes[0]
      ? modeIdMap.get(collectionSnapshot.modes[0].id) || collection.defaultModeId
      : collection.defaultModeId;
    variable.setValueForMode(defaultModeId, getDefaultValue(variableSnapshot.resolvedType));
    variableMap.set(variableSnapshot.id, variable);
  }

  for (const variableSnapshot of snapshot.variables) {
    const variable = variableMap.get(variableSnapshot.id);
    if (!variable) continue;

    for (const [oldModeId, value] of Object.entries(variableSnapshot.valuesByMode)) {
      const newModeId = modeIdMap.get(oldModeId);
      if (!newModeId) continue;
      const parsedValue = await parseValue(value, variable.resolvedType);
      variable.setValueForMode(newModeId, parsedValue);
    }
  }

  for (const variableSnapshot of snapshot.variables) {
    const variable = variableMap.get(variableSnapshot.id);
    if (!variable) continue;

    if (variableSnapshot.shadeConfig) {
      variable.setPluginData(
        SHADE_GENERATOR_CONFIG_KEY,
        JSON.stringify(remapShadeConfigForRestore(variableSnapshot.shadeConfig, variableMap))
      );
    } else {
      clearShadeGeneratorConfig(variable);
    }

    if (variableSnapshot.stepConfig) {
      variable.setPluginData(
        STEP_GENERATOR_CONFIG_KEY,
        JSON.stringify(remapStepConfigForRestore(variableSnapshot.stepConfig, variableMap, modeIdMap))
      );
    } else {
      clearStepGeneratorConfig(variable);
    }
  }

  setVariableOrder(
    snapshot.variableOrder
      .map(oldVariableId => {
        const mappedVariable = variableMap.get(oldVariableId);
        return mappedVariable ? mappedVariable.id : null;
      })
      .filter((id): id is string => id !== null)
  );
  setSidebarRelaunchData();
  await fetchData();
}

function trimHistoryStack(stack: HistorySnapshot[]): HistorySnapshot[] {
  if (stack.length <= HISTORY_LIMIT) {
    return stack;
  }
  return stack.slice(stack.length - HISTORY_LIMIT);
}

function postHistoryState(): void {
  figma.ui.postMessage({
    type: 'history-state',
    canUndo: undoHistory.length > 0,
    canRedo: redoHistory.length > 0,
    undoCount: undoHistory.length,
    redoCount: redoHistory.length,
  });
}

async function resetHistory(): Promise<void> {
  undoHistory = [];
  redoHistory = [];
  currentHistoryHash = (await captureHistorySnapshot()).hash;
  postHistoryState();
}

async function runMutationWithHistory(action: () => Promise<void>): Promise<void> {
  const beforeSnapshot = await captureHistorySnapshot();
  await action();
  const afterSnapshot = await captureHistorySnapshot();

  currentHistoryHash = afterSnapshot.hash;

  if (afterSnapshot.hash !== beforeSnapshot.hash) {
    undoHistory = trimHistoryStack(undoHistory.concat([beforeSnapshot]));
    redoHistory = [];
  }

  postHistoryState();
}

async function undoHistoryStep(): Promise<void> {
  if (undoHistory.length === 0) {
    postHistoryState();
    return;
  }

  const currentSnapshot = await captureHistorySnapshot();
  if (currentSnapshot.hash !== currentHistoryHash) {
    await resetHistory();
    figma.ui.postMessage({
      type: 'history-error',
      error: 'Undo history was cleared because the file changed outside the plugin.',
    });
    return;
  }

  const previousSnapshot = undoHistory[undoHistory.length - 1];
  undoHistory = undoHistory.slice(0, -1);
  redoHistory = trimHistoryStack(redoHistory.concat([currentSnapshot]));

  await restoreHistorySnapshot(previousSnapshot);
  currentHistoryHash = previousSnapshot.hash;
  postHistoryState();
  figma.ui.postMessage({ type: 'history-applied', direction: 'undo' });
}

async function redoHistoryStep(): Promise<void> {
  if (redoHistory.length === 0) {
    postHistoryState();
    return;
  }

  const currentSnapshot = await captureHistorySnapshot();
  if (currentSnapshot.hash !== currentHistoryHash) {
    await resetHistory();
    figma.ui.postMessage({
      type: 'history-error',
      error: 'Redo history was cleared because the file changed outside the plugin.',
    });
    return;
  }

  const nextSnapshot = redoHistory[redoHistory.length - 1];
  redoHistory = redoHistory.slice(0, -1);
  undoHistory = trimHistoryStack(undoHistory.concat([currentSnapshot]));

  await restoreHistorySnapshot(nextSnapshot);
  currentHistoryHash = nextSnapshot.hash;
  postHistoryState();
  figma.ui.postMessage({ type: 'history-applied', direction: 'redo' });
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

function getStepShortName(name: string): string {
  const parts = name.split('/');
  return parts[parts.length - 1];
}

function reorderLegacyStoredSteps(
  baseStepName: string,
  steps: StoredStepEntry[]
): StoredStepEntry[] {
  if (steps.length <= 1) {
    return steps;
  }

  const baseShortName = getStepShortName(baseStepName);
  const stepsByShortName = new Map<string, StoredStepEntry>();
  for (const step of steps) {
    stepsByShortName.set(getStepShortName(step.name), step);
  }

  for (const preset of STEP_NAME_PRESETS) {
    const matchesPreset =
      preset.baseStep === baseShortName &&
      preset.steps.length === steps.length &&
      preset.steps.every(stepName => stepsByShortName.has(stepName));

    if (matchesPreset) {
      return preset.steps
        .map(stepName => stepsByShortName.get(stepName) || null)
        .filter((step): step is StoredStepEntry => step !== null)
        .map(step => ({
          id: step.id,
          name: step.name,
          ratio: step.ratio,
          isBase: getStepShortName(step.name) === baseShortName,
        }));
    }
  }

  const allNumeric = Array.from(stepsByShortName.keys()).every(stepName => /^-?\d+(\.\d+)?$/.test(stepName));
  if (allNumeric) {
    const sortedSteps = steps.slice().sort((a, b) => Number.parseFloat(getStepShortName(a.name)) - Number.parseFloat(getStepShortName(b.name)));
    return sortedSteps.map(step => ({
      id: step.id,
      name: step.name,
      ratio: step.ratio,
      isBase: getStepShortName(step.name) === baseShortName,
    }));
  }

  return steps;
}

function normalizeStoredStepEntries(
  baseStepName: string,
  generatedSteps: StoredStepData[],
  rawSteps: unknown
): StoredStepEntry[] {
  if (Array.isArray(rawSteps)) {
    const normalizedSteps = rawSteps
      .filter(step =>
        step &&
        typeof step === 'object' &&
        typeof (step as StoredStepEntry).name === 'string' &&
        typeof (step as StoredStepEntry).ratio === 'number' &&
        typeof (step as StoredStepEntry).isBase === 'boolean'
      )
      .map(step => {
        const candidate = step as StoredStepEntry;
        return {
          id: typeof candidate.id === 'string' ? candidate.id : null,
          name: candidate.name,
          ratio: candidate.ratio,
          isBase: candidate.isBase,
        };
      });

    if (normalizedSteps.length > 0) {
      return normalizedSteps;
    }
  }

  const legacySteps: StoredStepEntry[] = [
    { id: null, name: baseStepName, ratio: 1, isBase: true },
  ];
  for (const step of generatedSteps) {
    legacySteps.push({
      id: step.id,
      name: step.name,
      ratio: step.ratio,
      isBase: false,
    });
  }
  return reorderLegacyStoredSteps(baseStepName, legacySteps);
}

function normalizeStoredStepModalState(
  value: unknown,
  baseStepName: string,
  steps: StoredStepEntry[]
): StoredStepModalState {
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as StoredStepModalState).ratioPreset === 'string' &&
    typeof (value as StoredStepModalState).customRatio === 'number' &&
    typeof (value as StoredStepModalState).stepsPreset === 'string' &&
    typeof (value as StoredStepModalState).stepsList === 'string' &&
    typeof (value as StoredStepModalState).baseStep === 'string'
  ) {
    const candidate = value as StoredStepModalState;
    return {
      ratioPreset: candidate.ratioPreset,
      customRatio: candidate.customRatio,
      stepsPreset: candidate.stepsPreset,
      stepsList: candidate.stepsList,
      baseStep: candidate.baseStep,
    };
  }

  return {
    ratioPreset: 'custom',
    customRatio: 1.25,
    stepsPreset: 'custom',
    stepsList: steps.map(step => getStepShortName(step.name)).join(', '),
    baseStep: getStepShortName(baseStepName),
  };
}

function buildGeneratedStepsFromEntries(steps: StoredStepEntry[]): StoredStepData[] {
  return steps
    .filter(step => !step.isBase && typeof step.id === 'string')
    .map(step => ({
      id: step.id as string,
      name: step.name,
      ratio: step.ratio,
    }));
}

function roundStepRatio(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function inferCustomRatioFromSteps(steps: StoredStepEntry[]): number {
  const baseIndex = steps.findIndex(step => step.isBase);
  if (baseIndex === -1) {
    return 1.25;
  }

  const inferredRatios = steps
    .map((step, index) => {
      const offset = index - baseIndex;
      if (offset === 0 || step.ratio <= 0) {
        return null;
      }

      const normalizedRatio =
        offset > 0
          ? Math.pow(step.ratio, 1 / offset)
          : Math.pow(1 / step.ratio, 1 / Math.abs(offset));

      return Number.isFinite(normalizedRatio) && normalizedRatio > 0 ? normalizedRatio : null;
    })
    .filter((value): value is number => value !== null);

  if (inferredRatios.length === 0) {
    return 1.25;
  }

  const total = inferredRatios.reduce((sum, value) => sum + value, 0);
  return roundStepRatio(total / inferredRatios.length);
}

function inferStepsPresetFromEntries(
  steps: StoredStepEntry[],
  baseStepName: string
): string {
  const shortNames = steps.map(step => getStepShortName(step.name));
  const baseStep = getStepShortName(baseStepName);

  for (const preset of STEP_NAME_PRESETS) {
    if (
      preset.baseStep === baseStep &&
      preset.steps.length === shortNames.length &&
      preset.steps.every((name, index) => shortNames[index] === name)
    ) {
      return preset.value;
    }
  }

  return 'custom';
}

function inferStoredStepModalState(
  baseStepName: string,
  steps: StoredStepEntry[]
): StoredStepModalState {
  const customRatio = inferCustomRatioFromSteps(steps);
  const matchingPreset = STEP_RATIO_PRESET_VALUES.find(preset => Math.abs(preset.ratio - customRatio) < 0.002);

  return {
    ratioPreset: matchingPreset ? matchingPreset.value : 'custom',
    customRatio,
    stepsPreset: inferStepsPresetFromEntries(steps, baseStepName),
    stepsList: steps.map(step => getStepShortName(step.name)).join(', '),
    baseStep: getStepShortName(baseStepName),
  };
}

function buildStoredStepModalState(
  value: unknown,
  baseStepName: string,
  steps: StoredStepEntry[]
): StoredStepModalState {
  const inferredState = inferStoredStepModalState(baseStepName, steps);
  const normalized = normalizeStoredStepModalState(value, baseStepName, steps);

  if (
    normalized.ratioPreset === 'custom' &&
    normalized.stepsPreset === 'custom' &&
    (
      inferredState.ratioPreset !== 'custom' ||
      inferredState.stepsPreset !== 'custom' ||
      Math.abs(inferredState.customRatio - normalized.customRatio) > 0.0001
    )
  ) {
    return inferredState;
  }

  return {
    ratioPreset: normalized.ratioPreset,
    customRatio: normalized.customRatio,
    stepsPreset: normalized.stepsPreset,
    stepsList: steps.map(step => getStepShortName(step.name)).join(', '),
    baseStep: getStepShortName(baseStepName),
  };
}

function alignStoredStepsWithTemplate(
  templateSteps: StoredStepEntry[],
  existingSteps: StoredStepEntry[]
): StoredStepEntry[] {
  const existingById = new Map<string, StoredStepEntry>();
  const existingByName = new Map<string, StoredStepEntry>();

  for (const step of existingSteps) {
    if (typeof step.id === 'string') {
      existingById.set(step.id, step);
    }
    existingByName.set(step.name, step);
  }

  const alignedSteps = templateSteps.map(step => {
    const matchedStep =
      (typeof step.id === 'string' ? existingById.get(step.id) : null) ||
      existingByName.get(step.name) ||
      null;

    if (!matchedStep) {
      return {
        id: step.id,
        name: step.name,
        ratio: step.ratio,
        isBase: step.isBase,
      };
    }

    return {
      id: step.id,
      name: step.name,
      ratio: matchedStep.ratio,
      isBase: matchedStep.isBase,
    };
  });

  if (!alignedSteps.some(step => step.isBase)) {
    const templateBaseStep = templateSteps.find(templateStep => templateStep.isBase) || null;
    return alignedSteps.map(step => ({
      id: step.id,
      name: step.name,
      ratio: step.ratio,
      isBase: !!templateBaseStep && step.name === templateBaseStep.name,
    }));
  }

  return alignedSteps;
}

function normalizeStoredStepModeConfig(
  value: unknown,
  baseStepName: string,
  fallbackSteps: StoredStepEntry[],
  fallbackGeneratedSteps: StoredStepData[],
  fallbackModalState: StoredStepModalState
): StoredStepModeConfig | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Partial<StoredStepModeConfig>;
  const steps = normalizeStoredStepEntries(baseStepName, fallbackGeneratedSteps, candidate.steps);
  const generatedSteps = Array.isArray(candidate.generatedSteps)
    ? candidate.generatedSteps
        .filter(step =>
          step &&
          typeof step === 'object' &&
          typeof (step as StoredStepData).id === 'string' &&
          typeof (step as StoredStepData).name === 'string' &&
          typeof (step as StoredStepData).ratio === 'number'
        )
        .map(step => ({
          id: (step as StoredStepData).id,
          name: (step as StoredStepData).name,
          ratio: (step as StoredStepData).ratio,
        }))
    : buildGeneratedStepsFromEntries(steps);
  const modalState = buildStoredStepModalState(
    candidate.modalState || fallbackModalState,
    (steps.find(step => step.isBase) || { name: baseStepName }).name,
    steps
  );

  return {
    steps,
    generatedSteps: generatedSteps.length > 0 ? generatedSteps : buildGeneratedStepsFromEntries(steps),
    modalState,
  };
}

function normalizeStoredStepModes(
  value: unknown,
  baseStepName: string,
  fallbackSteps: StoredStepEntry[],
  fallbackGeneratedSteps: StoredStepData[],
  fallbackModalState: StoredStepModalState
): Record<string, StoredStepModeConfig> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const modes: Record<string, StoredStepModeConfig> = {};
  for (const [modeId, modeConfig] of Object.entries(value as Record<string, unknown>)) {
    const normalizedModeConfig = normalizeStoredStepModeConfig(
      modeConfig,
      baseStepName,
      fallbackSteps,
      fallbackGeneratedSteps,
      fallbackModalState
    );
    if (normalizedModeConfig) {
      modes[modeId] = normalizedModeConfig;
    }
  }

  return modes;
}

function getStoredStepModeConfig(
  config: StoredStepGeneratorConfig,
  modeId?: string | null
): StoredStepModeConfig | null {
  if (modeId && config.modes) {
    if (config.modes[modeId]) {
      return config.modes[modeId];
    }
    if (Object.keys(config.modes).length > 0) {
      return null;
    }
  }

  const steps = config.steps || normalizeStoredStepEntries(config.baseStepName, config.generatedSteps, []);
  return {
    steps,
    generatedSteps:
      config.generatedSteps.length > 0
        ? config.generatedSteps
        : buildGeneratedStepsFromEntries(steps),
    modalState: buildStoredStepModalState(config.modalState, config.baseStepName, steps),
  };
}

function persistStoredStepModeConfig(
  sourceVariable: Variable,
  previousConfig: StoredStepGeneratorConfig | null,
  modeId: string,
  steps: StoredStepEntry[],
  modalState: StoredStepModalState
): void {
  const baseStep = steps.find(step => step.isBase) || steps[0] || null;
  const baseStepName = baseStep ? baseStep.name : sourceVariable.name;
  const normalizedModalState = buildStoredStepModalState(modalState, baseStepName, steps);
  const currentModeConfig: StoredStepModeConfig = {
    steps,
    generatedSteps: buildGeneratedStepsFromEntries(steps),
    modalState: normalizedModalState,
  };

  const nextModes: Record<string, StoredStepModeConfig> = {};
  const previousModes = previousConfig && previousConfig.modes ? previousConfig.modes : {};

  for (const [storedModeId, storedModeConfig] of Object.entries(previousModes)) {
    if (storedModeId === modeId) continue;

    const alignedSteps = alignStoredStepsWithTemplate(steps, storedModeConfig.steps);
    const alignedBaseStep = alignedSteps.find(step => step.isBase) || alignedSteps[0] || null;
    nextModes[storedModeId] = {
      steps: alignedSteps,
      generatedSteps: buildGeneratedStepsFromEntries(alignedSteps),
      modalState: buildStoredStepModalState(
        storedModeConfig.modalState,
        alignedBaseStep ? alignedBaseStep.name : sourceVariable.name,
        alignedSteps
      ),
    };
  }

  nextModes[modeId] = currentModeConfig;

  const storedConfig: StoredStepGeneratorConfig = {
    version: 2,
    sourceVariableId: sourceVariable.id,
    sourceName: sourceVariable.name,
    baseStepName,
    generatedSteps: currentModeConfig.generatedSteps,
    steps: currentModeConfig.steps,
    modalState: currentModeConfig.modalState,
    modes: nextModes,
    updatedAt: new Date().toISOString(),
  };

  sourceVariable.setPluginData(STEP_GENERATOR_CONFIG_KEY, JSON.stringify(storedConfig));
}

function readStepGeneratorConfig(variable: Variable): StoredStepGeneratorConfig | null {
  const raw = variable.getPluginData(STEP_GENERATOR_CONFIG_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1 && parsed.version !== 2) return null;

    const generatedSteps = Array.isArray(parsed.generatedSteps)
      ? parsed.generatedSteps
          .filter((step: unknown) =>
            step &&
            typeof step === 'object' &&
            typeof (step as StoredStepData).id === 'string' &&
            typeof (step as StoredStepData).name === 'string' &&
            typeof (step as StoredStepData).ratio === 'number'
          )
          .map((step: StoredStepData) => ({
            id: step.id,
            name: step.name,
            ratio: step.ratio,
          }))
      : [];
    const baseStepName = typeof parsed.baseStepName === 'string' ? parsed.baseStepName : variable.name;
    const steps = normalizeStoredStepEntries(baseStepName, generatedSteps, parsed.steps);
    const modalState = buildStoredStepModalState(parsed.modalState, baseStepName, steps);

    return {
      version: 2,
      sourceVariableId: typeof parsed.sourceVariableId === 'string' ? parsed.sourceVariableId : variable.id,
      sourceName: typeof parsed.sourceName === 'string' ? parsed.sourceName : variable.name,
      baseStepName,
      generatedSteps,
      steps,
      modalState,
      modes: normalizeStoredStepModes(parsed.modes, baseStepName, steps, generatedSteps, modalState),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    };
  } catch (error) {
    return null;
  }
}

function clearStepGeneratorConfig(variable: Variable): void {
  variable.setPluginData(STEP_GENERATOR_CONFIG_KEY, '');
}

function sortVariableData(variableData: UIVariableData[]): UIVariableData[] {
  const order = getVariableOrder();
  const sorted = variableData.slice();

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
        const group = groupMap.get(baseName) || [];
        for (const groupedVariable of group) {
          result.push(groupedVariable);
        }
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

    const deleteIdSet = new Set<string>();
    for (const shade of trackedShades) {
      if (variableMap.get(shade.id)) {
        deleteIdSet.add(shade.id);
      }
    }
    for (const shade of actualShadeVars) {
      if (variableMap.get(shade.id)) {
        deleteIdSet.add(shade.id);
      }
    }
    const deleteIds = Array.from(deleteIdSet);

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
  const deleteIds = new Set<string>();
  for (const shade of config.generatedShades || []) {
    deleteIds.add(shade.id);
  }
  const managedVariables = getManagedShadeVariables(sourceVariable, config, variables);
  for (const shade of managedVariables) {
    deleteIds.add(shade.id);
  }
  return Array.from(deleteIds);
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

async function resolveSourceVariableNumber(
  variable: Variable,
  modeId: string,
  visited = new Set<string>()
): Promise<number | null> {
  if (visited.has(variable.id)) {
    return null;
  }

  visited.add(variable.id);
  const value = variable.valuesByMode[modeId];

  if (typeof value === 'number') {
    return value;
  }

  if (value && typeof value === 'object' && 'type' in value && value.type === 'VARIABLE_ALIAS') {
    const referencedVariable = await figma.variables.getVariableByIdAsync(value.id);
    if (!referencedVariable || referencedVariable.resolvedType !== 'FLOAT') {
      return null;
    }
    return resolveSourceVariableNumber(referencedVariable, modeId, visited);
  }

  return null;
}

async function resolveModeIdForVariable(
  variable: Variable,
  requestedModeId?: string | null
): Promise<string | null> {
  const availableModeIds = Object.keys(variable.valuesByMode);
  if (availableModeIds.length === 0) {
    return null;
  }

  if (requestedModeId && availableModeIds.includes(requestedModeId)) {
    return requestedModeId;
  }

  if (requestedModeId) {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    let requestedModeName: string | null = null;

    for (const collection of collections) {
      const mode = collection.modes.find(candidate => candidate.modeId === requestedModeId);
      if (mode) {
        requestedModeName = mode.name;
        break;
      }
    }

    if (requestedModeName) {
      const targetCollection = collections.find(collection => collection.id === variable.variableCollectionId);
      const matchingMode = targetCollection
        ? targetCollection.modes.find(mode => mode.name === requestedModeName)
        : null;
      if (matchingMode && availableModeIds.includes(matchingMode.modeId)) {
        return matchingMode.modeId;
      }
    }
  }

  return availableModeIds[0];
}

async function buildUiState(): Promise<UIState> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const variables = await figma.variables.getLocalVariablesAsync();

  console.log('[Plugin] Collections:', collections.map(c => ({ name: c.name, variableIds: c.variableIds })));
  console.log('[Plugin] Variables from API:', variables.map(v => v.name));

  const collectionData: CollectionData[] = collections.map(c => ({
    id: c.id,
    name: c.name,
    modes: c.modes.map(m => ({ modeId: m.modeId, name: m.name }))
  }));

  let variableData: UIVariableData[] = [];
  for (const collection of collections) {
    for (const varId of collection.variableIds) {
      const variable = variables.find(v => v.id === varId);
      if (variable) {
        // Get first mode value for backward compatibility
        const firstModeId = Object.keys(variable.valuesByMode)[0];
        const firstModeValue = variable.valuesByMode[firstModeId];

        // Format all mode values
        const valuesByMode: Record<string, string> = {};
        for (const modeId of Object.keys(variable.valuesByMode)) {
          const modeValue = variable.valuesByMode[modeId];
          valuesByMode[modeId] = await formatValue(modeValue, variable.resolvedType);
        }

        variableData.push({
          id: variable.id,
          collectionId: variable.variableCollectionId,
          name: variable.name,
          resolvedType: variable.resolvedType,
          value: await formatValue(firstModeValue, variable.resolvedType),
          valuesByMode
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
  await syncManagedStepSources();
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

// Move variable to different collection
async function moveVariableToCollection(variableId: string, targetCollectionId: string) {
  try {
    const variable = await figma.variables.getVariableByIdAsync(variableId);
    const targetCollection = await figma.variables.getVariableCollectionByIdAsync(targetCollectionId);

    if (!variable || !targetCollection) {
      figma.ui.postMessage({ type: 'update-error', error: 'Variable or collection not found' });
      return;
    }

    // Get source collection
    const sourceCollection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
    if (!sourceCollection) {
      figma.ui.postMessage({ type: 'update-error', error: 'Source collection not found' });
      return;
    }

    // Store variable data before deletion
    const variableName = variable.name;
    const variableType = variable.resolvedType;
    const valuesByMode: Record<string, any> = {};

    // Get all mode values from source collection
    for (const modeId of Object.keys(variable.valuesByMode)) {
      valuesByMode[modeId] = variable.valuesByMode[modeId];
    }

    // Delete the variable from source collection
    variable.remove();

    // Create new variable in target collection
    const newVariable = figma.variables.createVariable(variableName, targetCollection, variableType);

    // Map modes from source to target collection
    // Use first mode of target collection if modes don't match
    const targetModeId = targetCollection.modes[0].modeId;
    const sourceModeId = sourceCollection.modes[0].modeId;
    const valueToSet = valuesByMode[sourceModeId];

    if (valueToSet !== undefined) {
      newVariable.setValueForMode(targetModeId, valueToSet);
    }

    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Move group of variables to different collection
async function moveGroupToCollection(variableIds: string[], targetCollectionId: string) {
  try {
    const targetCollection = await figma.variables.getVariableCollectionByIdAsync(targetCollectionId);
    if (!targetCollection) {
      figma.ui.postMessage({ type: 'update-error', error: 'Target collection not found' });
      return;
    }

    // Move each variable in the group
    for (const variableId of variableIds) {
      const variable = await figma.variables.getVariableByIdAsync(variableId);
      if (!variable) continue;

      // Skip if already in target collection
      if (variable.variableCollectionId === targetCollectionId) continue;

      // Get source collection
      const sourceCollection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
      if (!sourceCollection) continue;

      // Store variable data
      const variableName = variable.name;
      const variableType = variable.resolvedType;
      const valuesByMode: Record<string, any> = {};

      // Get all mode values
      for (const modeId of Object.keys(variable.valuesByMode)) {
        valuesByMode[modeId] = variable.valuesByMode[modeId];
      }

      // Delete from source
      variable.remove();

      // Create in target
      const newVariable = figma.variables.createVariable(variableName, targetCollection, variableType);

      // Transfer value from first mode
      const targetModeId = targetCollection.modes[0].modeId;
      const sourceModeId = sourceCollection.modes[0].modeId;
      const valueToSet = valuesByMode[sourceModeId];

      if (valueToSet !== undefined) {
        newVariable.setValueForMode(targetModeId, valueToSet);
      }
    }

    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Update variable value
async function updateVariableValue(id: string, newValue: string, modeId?: string) {
  try {
    const variable = await figma.variables.getVariableByIdAsync(id);
    if (variable) {
      const targetModeId = await resolveModeIdForVariable(variable, modeId);
      if (!targetModeId) {
        throw new Error(`No mode available for variable: ${variable.name}`);
      }

      const parsedValue = await parseValue(newValue, variable.resolvedType);
      variable.setValueForMode(targetModeId, parsedValue);

      if (variable.resolvedType === 'FLOAT') {
        await syncManagedStepSourceForMode(variable, targetModeId);
      }

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

// Delete ALL variables and collections
async function deleteAllVariables() {
  try {
    console.log('[Plugin] Deleting all variables and collections...');

    // Get all collections
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    console.log(`[Plugin] Found ${collections.length} collections to delete`);

    // Delete all collections (this will delete all variables in them)
    for (const collection of collections) {
      console.log(`[Plugin] Deleting collection: ${collection.name}`);
      collection.remove();
    }

    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
    console.log('[Plugin] All variables and collections deleted');
  } catch (error: any) {
    console.error('[Plugin] Error deleting all variables:', error);
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

// Helper: Convert hex color to Figma RGB
function hexToRgb(hex: string): { r: number; g: number; b: number; a: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 0, g: 0, b: 0, a: 1 };
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
    a: 1
  };
}

// Import preset tokens
async function importPreset(presetName: string) {
  try {
    console.log(`[Plugin] Importing preset: ${presetName}`);

    if (presetName === 'tailwind-complete') {
      // Import ALL Tailwind tokens in separate collections
      const presets = ['tailwind', 'tailwind-spacing', 'tailwind-width', 'tailwind-typography', 'tailwind-screens'];
      for (const preset of presets) {
        await importPreset(preset);
      }
      return;
    }

    const collection = figma.variables.createVariableCollection(presetName);
    const modeId = collection.modes[0].modeId;

    if (presetName === 'tailwind') {
      // Tailwind CSS v3 color palette
      const colors: Record<string, Record<string, string>> = {
        slate: { '50': '#f8fafc', '100': '#f1f5f9', '200': '#e2e8f0', '300': '#cbd5e1', '400': '#94a3b8', '500': '#64748b', '600': '#475569', '700': '#334155', '800': '#1e293b', '900': '#0f172a', '950': '#020617' },
        gray: { '50': '#f9fafb', '100': '#f3f4f6', '200': '#e5e7eb', '300': '#d1d5db', '400': '#9ca3af', '500': '#6b7280', '600': '#4b5563', '700': '#374151', '800': '#1f2937', '900': '#111827', '950': '#030712' },
        zinc: { '50': '#fafafa', '100': '#f4f4f5', '200': '#e4e4e7', '300': '#d4d4d8', '400': '#a1a1aa', '500': '#71717a', '600': '#52525b', '700': '#3f3f46', '800': '#27272a', '900': '#18181b', '950': '#09090b' },
        neutral: { '50': '#fafafa', '100': '#f5f5f5', '200': '#e5e5e5', '300': '#d4d4d4', '400': '#a3a3a3', '500': '#737373', '600': '#525252', '700': '#404040', '800': '#262626', '900': '#171717', '950': '#0a0a0a' },
        stone: { '50': '#fafaf9', '100': '#f5f5f4', '200': '#e7e5e4', '300': '#d6d3d1', '400': '#a8a29e', '500': '#78716c', '600': '#57534e', '700': '#44403c', '800': '#292524', '900': '#1c1917', '950': '#0c0a09' },
        red: { '50': '#fef2f2', '100': '#fee2e2', '200': '#fecaca', '300': '#fca5a5', '400': '#f87171', '500': '#ef4444', '600': '#dc2626', '700': '#b91c1c', '800': '#991b1b', '900': '#7f1d1d', '950': '#450a0a' },
        orange: { '50': '#fff7ed', '100': '#ffedd5', '200': '#fed7aa', '300': '#fdba74', '400': '#fb923c', '500': '#f97316', '600': '#ea580c', '700': '#c2410c', '800': '#9a3412', '900': '#7c2d12', '950': '#431407' },
        amber: { '50': '#fffbeb', '100': '#fef3c7', '200': '#fde68a', '300': '#fcd34d', '400': '#fbbf24', '500': '#f59e0b', '600': '#d97706', '700': '#b45309', '800': '#92400e', '900': '#78350f', '950': '#451a03' },
        yellow: { '50': '#fefce8', '100': '#fef9c3', '200': '#fef08a', '300': '#fde047', '400': '#facc15', '500': '#eab308', '600': '#ca8a04', '700': '#a16207', '800': '#854d0e', '900': '#713f12', '950': '#422006' },
        lime: { '50': '#f7fee7', '100': '#ecfccb', '200': '#d9f99d', '300': '#bef264', '400': '#a3e635', '500': '#84cc16', '600': '#65a30d', '700': '#4d7c0f', '800': '#3f6212', '900': '#365314', '950': '#1a2e05' },
        green: { '50': '#f0fdf4', '100': '#dcfce7', '200': '#bbf7d0', '300': '#86efac', '400': '#4ade80', '500': '#22c55e', '600': '#16a34a', '700': '#15803d', '800': '#166534', '900': '#14532d', '950': '#052e16' },
        emerald: { '50': '#ecfdf5', '100': '#d1fae5', '200': '#a7f3d0', '300': '#6ee7b7', '400': '#34d399', '500': '#10b981', '600': '#059669', '700': '#047857', '800': '#065f46', '900': '#064e3b', '950': '#022c22' },
        teal: { '50': '#f0fdfa', '100': '#ccfbf1', '200': '#99f6e4', '300': '#5eead4', '400': '#2dd4bf', '500': '#14b8a6', '600': '#0d9488', '700': '#0f766e', '800': '#115e59', '900': '#134e4a', '950': '#042f2e' },
        cyan: { '50': '#ecfeff', '100': '#cffafe', '200': '#a5f3fc', '300': '#67e8f9', '400': '#22d3ee', '500': '#06b6d4', '600': '#0891b2', '700': '#0e7490', '800': '#155e75', '900': '#164e63', '950': '#083344' },
        sky: { '50': '#f0f9ff', '100': '#e0f2fe', '200': '#bae6fd', '300': '#7dd3fc', '400': '#38bdf8', '500': '#0ea5e9', '600': '#0284c7', '700': '#0369a1', '800': '#075985', '900': '#0c4a6e', '950': '#082f49' },
        blue: { '50': '#eff6ff', '100': '#dbeafe', '200': '#bfdbfe', '300': '#93c5fd', '400': '#60a5fa', '500': '#3b82f6', '600': '#2563eb', '700': '#1d4ed8', '800': '#1e40af', '900': '#1e3a8a', '950': '#172554' },
        indigo: { '50': '#eef2ff', '100': '#e0e7ff', '200': '#c7d2fe', '300': '#a5b4fc', '400': '#818cf8', '500': '#6366f1', '600': '#4f46e5', '700': '#4338ca', '800': '#3730a3', '900': '#312e81', '950': '#1e1b4b' },
        violet: { '50': '#f5f3ff', '100': '#ede9fe', '200': '#ddd6fe', '300': '#c4b5fd', '400': '#a78bfa', '500': '#8b5cf6', '600': '#7c3aed', '700': '#6d28d9', '800': '#5b21b6', '900': '#4c1d95', '950': '#2e1065' },
        purple: { '50': '#faf5ff', '100': '#f3e8ff', '200': '#e9d5ff', '300': '#d8b4fe', '400': '#c084fc', '500': '#a855f7', '600': '#9333ea', '700': '#7e22ce', '800': '#6b21a8', '900': '#581c87', '950': '#3b0764' },
        fuchsia: { '50': '#fdf4ff', '100': '#fae8ff', '200': '#f5d0fe', '300': '#f0abfc', '400': '#e879f9', '500': '#d946ef', '600': '#c026d3', '700': '#a21caf', '800': '#86198f', '900': '#701a75', '950': '#4a044e' },
        pink: { '50': '#fdf2f8', '100': '#fce7f3', '200': '#fbcfe8', '300': '#f9a8d4', '400': '#f472b6', '500': '#ec4899', '600': '#db2777', '700': '#be185d', '800': '#9d174d', '900': '#831843', '950': '#500724' },
        rose: { '50': '#fff1f2', '100': '#ffe4e6', '200': '#fecdd3', '300': '#fda4af', '400': '#fb7185', '500': '#f43f5e', '600': '#e11d48', '700': '#be123c', '800': '#9f1239', '900': '#881337', '950': '#4c0519' }
      };

      // Create all color variables
      for (const [colorName, shades] of Object.entries(colors)) {
        for (const [shade, hex] of Object.entries(shades)) {
          const variable = figma.variables.createVariable(`${colorName}/${shade}`, collection, 'COLOR');
          variable.setValueForMode(modeId, hexToRgb(hex));
        }
      }
    } else if (presetName === 'tailwind-spacing') {
      // Tailwind spacing scale (padding, margin, gap)
      // Using rem values converted to pixels (1rem = 16px)
      const spacing: Record<string, number> = {
        '0': 0, 'px': 1,
        '0.5': 2, '1': 4, '1.5': 6, '2': 8, '2.5': 10, '3': 12, '3.5': 14, '4': 16,
        '5': 20, '6': 24, '7': 28, '8': 32, '9': 36, '10': 40, '11': 44, '12': 48,
        '14': 56, '16': 64, '20': 80, '24': 96, '28': 112, '32': 128, '36': 144,
        '40': 160, '44': 176, '48': 192, '52': 208, '56': 224, '60': 240, '64': 256,
        '72': 288, '80': 320, '96': 384
      };

      for (const [name, value] of Object.entries(spacing)) {
        const variable = figma.variables.createVariable(`spacing/${name}`, collection, 'FLOAT');
        variable.setValueForMode(modeId, value);
      }
    } else if (presetName === 'tailwind-width') {
      // Tailwind max-width scale
      const widths: Record<string, number> = {
        'none': 0, 'xs': 320, 'sm': 384, 'md': 448, 'lg': 512, 'xl': 576, '2xl': 672,
        '3xl': 768, '4xl': 896, '5xl': 1024, '6xl': 1152, '7xl': 1280,
        'full': 9999, 'min': 0, 'max': 9999, 'fit': 9999, 'prose': 672,
        'screen-sm': 640, 'screen-md': 768, 'screen-lg': 1024, 'screen-xl': 1280, 'screen-2xl': 1536
      };

      for (const [name, value] of Object.entries(widths)) {
        const variable = figma.variables.createVariable(`max-width/${name}`, collection, 'FLOAT');
        variable.setValueForMode(modeId, value);
      }
    } else if (presetName === 'tailwind-typography') {
      // Tailwind font size scale (in pixels)
      const fontSizes: Record<string, number> = {
        'xs': 12, 'sm': 14, 'base': 16, 'lg': 18, 'xl': 20,
        '2xl': 24, '3xl': 30, '4xl': 36, '5xl': 48,
        '6xl': 60, '7xl': 72, '8xl': 96, '9xl': 128
      };

      for (const [name, value] of Object.entries(fontSizes)) {
        const variable = figma.variables.createVariable(`text/${name}`, collection, 'FLOAT');
        variable.setValueForMode(modeId, value);
      }
    } else if (presetName === 'tailwind-screens') {
      // Tailwind responsive breakpoints
      const screens: Record<string, number> = {
        'sm': 640, 'md': 768, 'lg': 1024, 'xl': 1280, '2xl': 1536
      };

      for (const [name, value] of Object.entries(screens)) {
        const variable = figma.variables.createVariable(`screen/${name}`, collection, 'FLOAT');
        variable.setValueForMode(modeId, value);
      }
    } else if (presetName === 'basic') {
      // Base colors - create with shade generation
      const baseColors = [
        { name: 'primary', hex: '#3b82f6' },
        { name: 'secondary', hex: '#8b5cf6' },
        { name: 'neutral', hex: '#71717a' }
      ];

      for (const { name, hex } of baseColors) {
        // Create base color variable
        const baseVar = figma.variables.createVariable(name, collection, 'COLOR');
        const baseRgbFigma = hexToRgb(hex);
        baseVar.setValueForMode(modeId, baseRgbFigma);

        // Generate shades using the shade generator
        // Convert Figma RGB (0-1) to 0-255 range for shade generator
        const baseRgb: RGBColor = {
          r: Math.round(baseRgbFigma.r * 255),
          g: Math.round(baseRgbFigma.g * 255),
          b: Math.round(baseRgbFigma.b * 255),
        };
        const shadeCount = 11; // 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950
        const baseIndex = getDefaultShadeBaseIndex(shadeCount); // Index for 500

        const shadeConfig: ShadeConfigPayload = {
          shadeCount,
          baseIndex,
          lightValue: DEFAULT_SHADE_LIGHT_VALUE,
          darkValue: DEFAULT_SHADE_DARK_VALUE,
          lightnessCurve: createDefaultCurveHandles(shadeCount, baseIndex),
          saturationCurve: createDefaultCurveHandles(shadeCount, baseIndex),
          hueCurve: createDefaultCurveHandles(shadeCount, baseIndex),
        };

        const shades = buildManagedShadePayload(baseRgb, name, shadeConfig);

        // Create shade variables directly (convert RGB 0-255 back to Figma 0-1 format)
        const shadeVariables: Variable[] = [];
        for (const shade of shades) {
          // Parse RGB from string like "rgb(59, 130, 246)"
          const rgbMatch = shade.value.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (rgbMatch) {
            const shadeVar = figma.variables.createVariable(shade.name, collection, 'COLOR');
            shadeVar.setValueForMode(modeId, {
              r: parseInt(rgbMatch[1]) / 255,
              g: parseInt(rgbMatch[2]) / 255,
              b: parseInt(rgbMatch[3]) / 255,
              a: 1
            });
            shadeVariables.push(shadeVar);
          }
        }

        // Store shade config on base variable
        await persistShadeGeneratorConfig(baseVar, modeId, shadeConfig, shadeVariables);
      }

      // Status colors
      const success = figma.variables.createVariable('success', collection, 'COLOR');
      success.setValueForMode(modeId, hexToRgb('#22c55e'));

      const error = figma.variables.createVariable('error', collection, 'COLOR');
      error.setValueForMode(modeId, hexToRgb('#ef4444'));

      const warning = figma.variables.createVariable('warning', collection, 'COLOR');
      warning.setValueForMode(modeId, hexToRgb('#f59e0b'));

      const info = figma.variables.createVariable('info', collection, 'COLOR');
      info.setValueForMode(modeId, hexToRgb('#0ea5e9'));

      // Screen sizes
      const mobile = figma.variables.createVariable('screen/mobile', collection, 'FLOAT');
      mobile.setValueForMode(modeId, 375);

      const tablet = figma.variables.createVariable('screen/tablet', collection, 'FLOAT');
      tablet.setValueForMode(modeId, 768);

      const desktop = figma.variables.createVariable('screen/desktop', collection, 'FLOAT');
      desktop.setValueForMode(modeId, 1440);

      // Spacing scale with base variable (base: 16px at md, ratio: 1.5, steps: xs to 3xl)
      const spacingSteps = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'];
      const spacingBase = 16;
      const spacingBaseIndex = spacingSteps.indexOf('md'); // md is the base
      const spacingRatio = 1.5;

      // Create base spacing variable
      const spacingBaseVar = figma.variables.createVariable('spacing', collection, 'FLOAT');
      spacingBaseVar.setValueForMode(modeId, spacingBase);

      // Create spacing steps with reference to base variable for the 'md' step
      const spacingValues: { name: string; value: string }[] = [];
      for (let i = 0; i < spacingSteps.length; i++) {
        const offset = i - spacingBaseIndex;
        const value = Math.round(spacingBase * Math.pow(spacingRatio, offset) * 100) / 100;
        spacingValues.push({
          name: `spacing/${spacingSteps[i]}`,
          value: spacingSteps[i] === 'md' ? '{spacing}' : String(value) // Reference base for md
        });
      }
      await createSteps(collection.id, spacingValues);

      // Font size scale with base variable (base: 16px at md, ratio: 1.25, steps: xs to 4xl)
      const fontSizeSteps = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'];
      const fontSizeBase = 16;
      const fontSizeBaseIndex = fontSizeSteps.indexOf('md'); // md is the base
      const fontSizeRatio = 1.25;

      // Create base font-size variable
      const fontSizeBaseVar = figma.variables.createVariable('font-size', collection, 'FLOAT');
      fontSizeBaseVar.setValueForMode(modeId, fontSizeBase);

      // Create font-size steps with reference to base variable for the 'md' step
      const fontSizeValues: { name: string; value: string }[] = [];
      for (let i = 0; i < fontSizeSteps.length; i++) {
        const offset = i - fontSizeBaseIndex;
        const value = Math.round(fontSizeBase * Math.pow(fontSizeRatio, offset) * 100) / 100;
        fontSizeValues.push({
          name: `font-size/${fontSizeSteps[i]}`,
          value: fontSizeSteps[i] === 'md' ? '{font-size}' : String(value) // Reference base for md
        });
      }
      await createSteps(collection.id, fontSizeValues);
    }

    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
    console.log(`[Plugin] Preset ${presetName} imported`);
  } catch (error: any) {
    console.error('[Plugin] Error importing preset:', error);
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
  const sortedShades = shades.slice().sort((a, b) => extractShadeNumber(a.name) - extractShadeNumber(b.name));
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

async function syncManagedStepSources(): Promise<boolean> {
  const variables = await figma.variables.getLocalVariablesAsync();
  let syncedAny = false;

  for (const variable of variables) {
    if (variable.resolvedType !== 'FLOAT') continue;

    const storedConfig = readStepGeneratorConfig(variable);
    if (!storedConfig) continue;

    const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
    if (!collection) continue;

    const renamed = variable.name !== storedConfig.sourceName;
    if (!renamed) continue;

    const updatedConfig: StoredStepGeneratorConfig = {
      version: storedConfig.version,
      sourceVariableId: storedConfig.sourceVariableId,
      sourceName: variable.name,
      baseStepName: storedConfig.baseStepName,
      generatedSteps: storedConfig.generatedSteps,
      steps: storedConfig.steps,
      modalState: storedConfig.modalState,
      modes: storedConfig.modes,
      updatedAt: new Date().toISOString(),
    };
    variable.setPluginData(STEP_GENERATOR_CONFIG_KEY, JSON.stringify(updatedConfig));

    syncedAny = true;
  }

  return syncedAny;
}

async function syncManagedStepSourceForMode(
  variable: Variable,
  modeId: string
): Promise<boolean> {
  if (variable.resolvedType !== 'FLOAT') return false;

  const storedConfig = readStepGeneratorConfig(variable);
  if (!storedConfig) return false;
  const storedModeConfig = getStoredStepModeConfig(storedConfig, modeId);
  if (!storedModeConfig) return false;

  const baseValue = await resolveSourceVariableNumber(variable, modeId);
  if (baseValue === null) return false;

  const variables = await figma.variables.getLocalVariablesAsync('FLOAT');

  for (const stepData of storedModeConfig.generatedSteps) {
    const stepVar = variables.find(candidate => candidate.id === stepData.id);
    if (!stepVar) continue;

    const calculatedValue = baseValue * stepData.ratio;
    stepVar.setValueForMode(modeId, Math.round(calculatedValue * 100) / 100);
  }

  const updatedConfig: StoredStepGeneratorConfig = {
    version: storedConfig.version,
    sourceVariableId: storedConfig.sourceVariableId,
    sourceName: variable.name,
    baseStepName: storedConfig.baseStepName,
    generatedSteps: storedConfig.generatedSteps,
    steps: storedConfig.steps,
    modalState: storedConfig.modalState,
    modes: storedConfig.modes,
    updatedAt: new Date().toISOString(),
  };
  variable.setPluginData(STEP_GENERATOR_CONFIG_KEY, JSON.stringify(updatedConfig));

  return true;
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

function getManagedStepDefinition(
  steps: { name: string; value: string }[]
): {
  baseVariableRef: string | null;
  baseStepIndex: number;
  stepIsReference: boolean[];
} {
  let baseVariableRef: string | null = null;
  let baseStepIndex = -1;
  const stepIsReference: boolean[] = [];

  for (let i = 0; i < steps.length; i++) {
    const refMatch = steps[i].value.match(/^\{(.+)\}$/);
    stepIsReference.push(!!refMatch);
    if (refMatch) {
      baseVariableRef = refMatch[1];
      baseStepIndex = i;
    }
  }

  return { baseVariableRef, baseStepIndex, stepIsReference };
}

async function buildManagedStepRatios(
  steps: { name: string; value: string }[],
  allVariables: Variable[],
  targetModeId: string,
  baseVariableRef: string | null,
  baseStepIndex: number,
  stepIsReference: boolean[]
): Promise<{ baseVariable: Variable | null; stepRatios: number[] }> {
  const baseVariable = baseVariableRef
    ? allVariables.find(variable => variable.name === baseVariableRef) || null
    : null;
  const baseValue = baseVariable
    ? await resolveSourceVariableNumber(baseVariable, targetModeId)
    : null;

  const stepRatios = steps.map((step, index) => {
    if (index === baseStepIndex) {
      return 1;
    }
    if (stepIsReference[index]) {
      return 1;
    }
    const parsedValue = Number.parseFloat(step.value);
    if (baseValue && baseValue !== 0 && !Number.isNaN(parsedValue)) {
      return parsedValue / baseValue;
    }
    return 1;
  });

  return { baseVariable, stepRatios };
}

async function resolveManagedStepValue(
  step: { name: string; value: string },
  index: number,
  baseStepIndex: number,
  stepIsReference: boolean[],
  stepRatios: number[],
  baseValue: number | null
): Promise<any> {
  if (index === baseStepIndex) {
    return parseValue(step.value, 'FLOAT');
  }

  if (baseValue !== null && !stepIsReference[index]) {
    return Math.round(baseValue * stepRatios[index] * 100) / 100;
  }

  return parseValue(step.value, 'FLOAT');
}

function buildStoredStepEntries(
  variables: Variable[],
  stepRatios: number[],
  baseStepIndex: number
): StoredStepEntry[] {
  return variables.map((variable, index) => ({
    id: variable.id,
    name: variable.name,
    ratio: stepRatios[index] || 1,
    isBase: index === baseStepIndex,
  }));
}

function getManagedStepExistingOrder(
  deleteIds: string[],
  previousConfig: StoredStepGeneratorConfig | null,
  targetModeId: string
): Map<string, number> {
  const order = new Map<string, number>();
  const storedModeConfig = previousConfig ? getStoredStepModeConfig(previousConfig, targetModeId) : null;
  const preferredIds = storedModeConfig
    ? storedModeConfig.steps
        .filter(step => !step.isBase && typeof step.id === 'string')
        .map(step => step.id as string)
    : deleteIds;

  preferredIds.forEach((id, index) => {
    order.set(id, index);
  });

  return order;
}

function buildTemporaryStepVariableName(variable: Variable, index: number): string {
  return variable.name + '__tmp__' + variable.id.replace(/[:;]/g, '_') + '__' + String(index);
}

async function getStepModalState(sourceVariableId: string, modeId?: string): Promise<void> {
  const sourceVariable = await figma.variables.getVariableByIdAsync(sourceVariableId);
  if (!sourceVariable || sourceVariable.resolvedType !== 'FLOAT') {
    figma.ui.postMessage({ type: 'step-modal-state', sourceVariableId, modeId: modeId || null, state: null });
    return;
  }

  const storedConfig = readStepGeneratorConfig(sourceVariable);
  if (!storedConfig) {
    figma.ui.postMessage({ type: 'step-modal-state', sourceVariableId, modeId: modeId || null, state: null });
    return;
  }

  const storedModeConfig = getStoredStepModeConfig(storedConfig, modeId || null);
  if (!storedModeConfig) {
    figma.ui.postMessage({ type: 'step-modal-state', sourceVariableId, modeId: modeId || null, state: null });
    return;
  }

  const resolvedModeId = modeId || Object.keys(sourceVariable.valuesByMode)[0];
  const baseValue = resolvedModeId
    ? await resolveSourceVariableNumber(sourceVariable, resolvedModeId)
    : null;
  const editableSteps = storedModeConfig.steps.map(step => ({
    name: getStepShortName(step.name),
    value: step.isBase || baseValue === null
      ? Math.round((baseValue || 0) * 100) / 100
      : Math.round(baseValue * step.ratio * 100) / 100,
  }));

  figma.ui.postMessage({
    type: 'step-modal-state',
    sourceVariableId,
    modeId: modeId || null,
    state: {
      ratioPreset: storedModeConfig.modalState.ratioPreset,
      customRatio: storedModeConfig.modalState.customRatio,
      stepsPreset: storedModeConfig.modalState.stepsPreset,
      stepsList: storedModeConfig.modalState.stepsList,
      baseStep: storedModeConfig.modalState.baseStep,
      editableSteps,
    },
  });
}

async function createSteps(
  collectionId: string,
  steps: { name: string; value: string }[],
  modeId?: string,
  modalState?: StoredStepModalState
) {
  try {
    const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
    if (!collection) throw new Error('Collection not found');
    const targetModeId = modeId || (collection.modes[0] ? collection.modes[0].modeId : null);
    if (!targetModeId) throw new Error('No mode found for collection');

    const allVariables = await figma.variables.getLocalVariablesAsync('FLOAT');
    const existingVarsMap = new Map<string, Variable>();
    for (const variable of allVariables) {
      if (variable.variableCollectionId === collectionId) {
        existingVarsMap.set(variable.name, variable);
      }
    }

    const { baseVariableRef, baseStepIndex, stepIsReference } = getManagedStepDefinition(steps);
    const { baseVariable, stepRatios } = await buildManagedStepRatios(
      steps,
      allVariables,
      targetModeId,
      baseVariableRef,
      baseStepIndex,
      stepIsReference
    );
    const baseValue = baseVariable
      ? await resolveSourceVariableNumber(baseVariable, targetModeId)
      : null;
    const finalStepVariables: Variable[] = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const existing = existingVarsMap.get(step.name);
      const variable = existing || figma.variables.createVariable(step.name, collection, 'FLOAT');
      const valueToSet = await resolveManagedStepValue(
        step,
        i,
        baseStepIndex,
        stepIsReference,
        stepRatios,
        baseValue
      );

      variable.setValueForMode(targetModeId, valueToSet);
      finalStepVariables.push(variable);
    }

    if (baseVariable && baseStepIndex !== -1) {
      const previousConfig = readStepGeneratorConfig(baseVariable);
      const storedSteps = buildStoredStepEntries(finalStepVariables, stepRatios, baseStepIndex);
      persistStoredStepModeConfig(
        baseVariable,
        previousConfig,
        targetModeId,
        storedSteps,
        modalState || buildStoredStepModalState(null, steps[baseStepIndex].name, storedSteps)
      );
    }

    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

async function updateSteps(
  collectionId: string,
  deleteIds: string[],
  steps: { name: string; value: string }[],
  modeId?: string,
  modalState?: StoredStepModalState
) {
  try {
    const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
    if (!collection) throw new Error('Collection not found');
    const targetModeId = modeId || (collection.modes[0] ? collection.modes[0].modeId : null);
    if (!targetModeId) throw new Error('No mode found for collection');

    const allVariables = await figma.variables.getLocalVariablesAsync('FLOAT');
    const { baseVariableRef, baseStepIndex, stepIsReference } = getManagedStepDefinition(steps);
    const { baseVariable, stepRatios } = await buildManagedStepRatios(
      steps,
      allVariables,
      targetModeId,
      baseVariableRef,
      baseStepIndex,
      stepIsReference
    );
    const previousConfig = baseVariable ? readStepGeneratorConfig(baseVariable) : null;
    const existingOrder = getManagedStepExistingOrder(deleteIds, previousConfig, targetModeId);
    const existingVars: { id: string; variable: Variable }[] = [];

    for (const id of Array.from(new Set(deleteIds))) {
      const variable = await figma.variables.getVariableByIdAsync(id);
      if (variable) {
        existingVars.push({ id, variable });
      }
    }

    existingVars.sort((a, b) => {
      const indexA = existingOrder.has(a.id) ? existingOrder.get(a.id) as number : Number.MAX_SAFE_INTEGER;
      const indexB = existingOrder.has(b.id) ? existingOrder.get(b.id) as number : Number.MAX_SAFE_INTEGER;
      return indexA - indexB;
    });

    const baseValue = baseVariable
      ? await resolveSourceVariableNumber(baseVariable, targetModeId)
      : null;
    const finalStepVariables: Variable[] = [];
    const reusedCount = Math.min(existingVars.length, steps.length);

    // Rename reused variables out of the way first so swaps/reorders do not
    // collide with existing names still present in the collection.
    for (let i = 0; i < reusedCount; i++) {
      const variable = existingVars[i].variable;
      variable.name = buildTemporaryStepVariableName(variable, i);
    }

    for (let i = reusedCount; i < existingVars.length; i++) {
      existingVars[i].variable.remove();
    }

    for (let i = 0; i < reusedCount; i++) {
      const variable = existingVars[i].variable;
      const step = steps[i];
      const valueToSet = await resolveManagedStepValue(
        step,
        i,
        baseStepIndex,
        stepIsReference,
        stepRatios,
        baseValue
      );

      variable.name = step.name;
      variable.setValueForMode(targetModeId, valueToSet);
      finalStepVariables.push(variable);
    }

    for (let i = reusedCount; i < steps.length; i++) {
      const step = steps[i];
      const variable = figma.variables.createVariable(step.name, collection, 'FLOAT');
      const valueToSet = await resolveManagedStepValue(
        step,
        i,
        baseStepIndex,
        stepIsReference,
        stepRatios,
        baseValue
      );

      variable.setValueForMode(targetModeId, valueToSet);
      finalStepVariables.push(variable);
    }

    if (baseVariable && baseStepIndex !== -1) {
      const storedSteps = buildStoredStepEntries(finalStepVariables, stepRatios, baseStepIndex);
      persistStoredStepModeConfig(
        baseVariable,
        previousConfig,
        targetModeId,
        storedSteps,
        modalState || buildStoredStepModalState(null, steps[baseStepIndex].name, storedSteps)
      );
    }

    await fetchData();
    figma.ui.postMessage({ type: 'update-success' });
  } catch (error: any) {
    figma.ui.postMessage({ type: 'update-error', error: error.message });
  }
}

async function removeManagedSteps(sourceVariableId: string): Promise<void> {
  try {
    const sourceVariable = await figma.variables.getVariableByIdAsync(sourceVariableId);
    if (!sourceVariable || sourceVariable.resolvedType !== 'FLOAT') {
      throw new Error('Source variable not found');
    }

    const storedConfig = readStepGeneratorConfig(sourceVariable);
    const deleteIds = new Set<string>();
    const variables = await figma.variables.getLocalVariablesAsync('FLOAT');
    const prefix = sourceVariable.name + '/';

    if (storedConfig) {
      for (const step of storedConfig.steps || []) {
        if (!step.isBase && typeof step.id === 'string') {
          deleteIds.add(step.id);
        }
      }
      if (storedConfig.modes) {
        for (const modeConfig of Object.values(storedConfig.modes)) {
          for (const step of modeConfig.steps) {
            if (!step.isBase && typeof step.id === 'string') {
              deleteIds.add(step.id);
            }
          }
        }
      }
    }

    for (const variable of variables) {
      if (
        variable.variableCollectionId === sourceVariable.variableCollectionId &&
        variable.name.startsWith(prefix)
      ) {
        deleteIds.add(variable.id);
      }
    }

    for (const id of deleteIds) {
      const variable = await figma.variables.getVariableByIdAsync(id);
      if (variable) {
        variable.remove();
      }
    }

    clearStepGeneratorConfig(sourceVariable);

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
  newNumber: { name: string; value: string },
  modeId?: string
) {
  try {
    for (const id of deleteIds) {
      const variable = await figma.variables.getVariableByIdAsync(id);
      if (variable) {
        variable.remove();
      }
    }

    const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
    if (!collection) throw new Error('Collection not found');
    const targetModeId = modeId || (collection.modes[0] ? collection.modes[0].modeId : null);
    if (!targetModeId) throw new Error('No mode found for collection');

    const variable = figma.variables.createVariable(newNumber.name, collection, 'FLOAT');
    const parsedValue = await parseValue(newNumber.value, 'FLOAT');
    variable.setValueForMode(targetModeId, parsedValue);

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
  const syncedManagedSteps = await syncManagedStepSources();
  if (syncedManagedShades || syncedManagedSteps) {
    await fetchData();
    await resetHistory();
    return;
  }

  const { hash: currentHash } = await buildUiState();

  if (lastDataHash && currentHash !== lastDataHash) {
    figma.ui.postMessage({ type: 'changes-detected' });
  }
}

setSidebarRelaunchData();
figma.on('currentpagechange', () => {
  setSidebarRelaunchData();
});

// Start polling - check every 5 seconds to reduce overhead
setInterval(checkForChanges, 5000);

// Initial fetch
void (async () => {
  await fetchData();
  await resetHistory();
})();

// Message handler
figma.ui.onmessage = async (msg: any) => {
  switch (msg.type) {
    case 'refresh':
      console.log('[Plugin] Refresh received');
      setVariableOrder([]); // Clear custom order on refresh to match Figma's order
      await fetchData();
      await resetHistory();
      console.log('[Plugin] Refresh complete');
      break;

    case 'create-collection':
      await runMutationWithHistory(() => createCollection(msg.name));
      break;

    case 'create-variable':
      await runMutationWithHistory(() => createVariable(msg.collectionId, msg.name, msg.varType, msg.value));
      break;

    case 'update-variable-name':
      await runMutationWithHistory(() => updateVariableName(msg.id, msg.name));
      break;

    case 'move-variable-to-collection':
      await runMutationWithHistory(() => moveVariableToCollection(msg.variableId, msg.targetCollectionId));
      break;

    case 'move-group-to-collection':
      await runMutationWithHistory(() => moveGroupToCollection(msg.variableIds, msg.targetCollectionId));
      break;

    case 'update-variable-value':
      await runMutationWithHistory(() => updateVariableValue(msg.id, msg.value, msg.modeId));
      break;

    case 'delete-variable':
      await runMutationWithHistory(() => deleteVariable(msg.id));
      break;

    case 'delete-all-variables':
      await runMutationWithHistory(() => deleteAllVariables());
      break;

    case 'import-preset':
      await runMutationWithHistory(() => importPreset(msg.preset));
      break;

    case 'delete-group':
      await runMutationWithHistory(() => deleteGroup(msg.ids));
      break;

    case 'duplicate-variable':
      await runMutationWithHistory(() => duplicateVariable(msg.id));
      break;

    case 'bulk-update-group':
      await runMutationWithHistory(() => bulkUpdateGroup(msg.collectionId, msg.groupName, msg.updates));
      break;

    case 'update-from-json':
      await runMutationWithHistory(() => updateFromJson(msg.data));
      break;

    case 'create-shades':
      await runMutationWithHistory(() => createShades(msg.collectionId, msg.shades));
      break;

    case 'update-shades':
      await runMutationWithHistory(() => updateShades(msg.collectionId, msg.deleteIds, msg.shades, msg.source, msg.config));
      break;

    case 'remove-shades':
      await runMutationWithHistory(() => removeShades(msg.collectionId, msg.deleteIds, msg.source));
      break;

    case 'create-steps':
      await runMutationWithHistory(() => createSteps(msg.collectionId, msg.steps, msg.modeId, msg.modalState));
      break;

    case 'update-steps':
      await runMutationWithHistory(() => updateSteps(msg.collectionId, msg.deleteIds, msg.steps, msg.modeId, msg.modalState));
      break;

    case 'remove-steps':
      await runMutationWithHistory(() => {
        if (msg.sourceVariableId) {
          return removeManagedSteps(msg.sourceVariableId);
        }
        return removeSteps(msg.collectionId, msg.deleteIds, msg.newNumber, msg.modeId);
      });
      break;

    case 'get-step-modal-state':
      await getStepModalState(msg.sourceVariableId, msg.modeId);
      break;

    case 'reorder-variable':
      await runMutationWithHistory(() => reorderVariable(msg.draggedId, msg.targetId, msg.insertBefore));
      break;

    case 'reset-order':
      await runMutationWithHistory(async () => {
        setVariableOrder([]);
        await fetchData();
      });
      break;

    case 'undo':
      await undoHistoryStep();
      break;

    case 'redo':
      await redoHistoryStep();
      break;

    case 'get-history-state':
      postHistoryState();
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
