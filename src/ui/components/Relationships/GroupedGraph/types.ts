// Types for GroupedGraph component

import type { Node, Edge } from '@xyflow/react';
import { CollectionData, ShadeGroupData, VariableData } from '../../../types';

// ── Main Component Props ───────────────────────────────────────────

export interface GroupedGraphProps {
  collections: CollectionData[];
  variables: VariableData[];
  selectedCollectionIds: Set<string>;
  variableType: 'COLOR' | 'FLOAT';
  shadeGroups: ShadeGroupData[];
  selectedModeId: string | null;
}

// ── Variable Node ──────────────────────────────────────────────────

export interface VariableNode {
  id: string;
  name: string;
  shortName: string;
  displayName: string;
  color: string;
  value: string;
  resolvedValue: string;
  isReference: boolean;
  referenceName: string | null;
  isVirtual?: boolean;
  virtualType?: 'shader' | 'palette';
  connectionsDisabled?: boolean;
}

// ── Group Data ─────────────────────────────────────────────────────

export interface GroupData {
  key: string;
  title: string;
  variables: VariableNode[];
  x: number;
  y: number;
  initialX: number;
  initialY: number;
  kind: 'standard' | 'source' | 'shader' | 'shades';
  sourceGroupName?: string;
  headerFill: string;
  collectionId: string;
}

// ── Managed Groups ─────────────────────────────────────────────────

export interface ManagedNumberStepGroup {
  sourceVariable: VariableData;
  stepVariables: VariableData[];
}

// ── Connections ────────────────────────────────────────────────────

export interface ConnectionRecord {
  id: string;
  kind: 'reference' | 'generated';
  fromGroup: string;
  fromVar: string;
  toGroup: string;
  toVar: string;
}

export interface ConnectionFlags {
  hasInput: boolean;
  hasOutput: boolean;
  inputKind: 'reference' | 'generated' | null;
  outputKind: 'reference' | 'generated' | null;
}

// ── Grid Layout ────────────────────────────────────────────────────

export interface GridLayoutSettings {
  gapX: number;
  gapY: number;
}

export interface GridLayoutDraft {
  gapX: string;
  gapY: string;
}

// ── Node Data Type ─────────────────────────────────────────────────

export type GroupNodeData = {
  group: GroupData;
  isColorType: boolean;
  variableType: 'COLOR' | 'FLOAT';
  connectedVars: Map<string, ConnectionFlags>;
  onGeneratorOpen: (group: GroupData, node: VariableNode) => void;
  onShowColorMenu: (event: React.MouseEvent, node: VariableNode) => void;
  onAddVariable: (group: GroupData) => void;
  onRenameGroup: (group: GroupData) => void;
  onDuplicateGroup: (group: GroupData) => void;
  onDeleteGroup: (group: GroupData) => void;
  onRenameVariable: (node: VariableNode) => void;
  onDeleteVariable: (node: VariableNode) => void;
  onDisconnect: (receiverVarName: string, resolvedValue: string) => void;
};

// ── Edge Data Type ─────────────────────────────────────────────────

export type CustomEdgeData = {
  kind: 'reference' | 'generated';
  receiverName: string;
  receiverShortName: string;
  resolvedValue: string;
  onDisconnect: (receiverVarName: string, resolvedValue: string) => void;
};

// ── React Flow Types ───────────────────────────────────────────────

export type GroupNode = Node<GroupNodeData>;
export type CustomEdge = Edge<CustomEdgeData>;
