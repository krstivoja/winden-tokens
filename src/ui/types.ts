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
