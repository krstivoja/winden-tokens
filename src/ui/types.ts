// Type definitions for the UI

export interface CollectionData {
  id: string;
  name: string;
}

export interface VariableData {
  id: string;
  collectionId: string;
  name: string;
  resolvedType: VariableType;
  value: string;
  displayName?: string;
}

export type VariableType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';

export interface PluginMessage {
  type: string;
  [key: string]: any;
}

export interface ShadeConfig {
  name: string;
  value: string;
}

export interface ShadeCurvePoint {
  t: number;
  value: number;
}

export interface ShadeCurveHandles {
  startValue: number;
  leftHandle1: ShadeCurvePoint;
  leftHandle2: ShadeCurvePoint;
  rightHandle1: ShadeCurvePoint;
  rightHandle2: ShadeCurvePoint;
  endValue: number;
}

export interface ShadeGeneratorConfig {
  version: number;
  sourceVariableId: string;
  sourceName: string;
  sourceValue: string;
  shadeCount: number;
  baseIndex: number;
  lightValue: number;
  darkValue: number;
  lightnessCurve: ShadeCurveHandles;
  saturationCurve: ShadeCurveHandles;
  hueCurve: ShadeCurveHandles;
  generatedShades: Array<{
    id: string;
    name: string;
    value: string;
  }>;
  updatedAt: string;
}

export interface ShadeGroupData {
  sourceVariableId: string;
  sourceVariableName: string;
  collectionId: string;
  deleteIds: string[];
  status: 'clean' | 'dirty';
  dirtyReasons: string[];
  config: ShadeGeneratorConfig;
}

export interface StepGroupData {
  sourceVariableId: string;
  sourceVariableName: string;
  collectionId: string;
  deleteIds: string[];
  status: 'clean' | 'dirty';
  dirtyReasons: string[];
  config: StepGeneratorConfig;
}

export interface StepGeneratorConfig {
  baseValue: number;
  ratio: number;
  baseStep: string;
  steps: Array<{ name: string; value: number }>;
}
