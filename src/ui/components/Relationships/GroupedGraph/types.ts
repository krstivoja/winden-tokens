// Types for GroupedGraph component

import type { Node, Edge } from '@xyflow/react';
import { CollectionData, ShadeGroupData, VariableData } from '../../../types';

// ── Main Component Props ───────────────────────────────────────────

export interface GroupedGraphProps {
  collections: CollectionData[];
  variables: VariableData[];
  selectedCollectionIds: Set<string>;
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
  resolvedType?: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
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
  // True when this card has a parent path it can be grouped under a wrapper
  // frame ("level up"; standard groups only).
  canGroup?: boolean;
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
  // Path-highlight state: set when a node's connected chain is highlighted.
  isHighlighted?: boolean;
  isDimmed?: boolean;
  // True while any chain is highlighted; highlightedVars holds the variable
  // names on the chain so individual rows can be dimmed.
  highlightActive?: boolean;
  highlightedVars?: Set<string>;
  onHighlightPath: (group: GroupData) => void;
  onGeneratorOpen: (group: GroupData, node: VariableNode) => void;
  onShowColorMenu: (event: React.MouseEvent, node: VariableNode) => void;
  onAddVariable: (group: GroupData) => void;
  onRenameGroup: (group: GroupData) => void;
  onDuplicateGroup: (group: GroupData) => void;
  onEditAsText: (group: GroupData) => void;
  onLevelUp: (path: string) => void;
  onDeleteGroup: (group: GroupData) => void;
  onRenameVariable: (node: VariableNode) => void;
  onDeleteVariable: (node: VariableNode) => void;
  onDisconnect: (receiverVarName: string, resolvedValue: string) => void;
};

// ── Wrapper Node Data Type ─────────────────────────────────────────

export type WrapperNodeData = {
  path: string;
  title: string;
  onLevelUp: (path: string) => void;
  onUngroup: (path: string) => void;
};

// ── Edge Data Type ─────────────────────────────────────────────────

export type CustomEdgeData = {
  kind: 'reference' | 'generated';
  receiverName: string;
  receiverShortName: string;
  resolvedValue: string;
  // Path-highlight state.
  isHighlighted?: boolean;
  isDimmed?: boolean;
  onDisconnect: (receiverVarName: string, resolvedValue: string) => void;
};

// ── React Flow Types ───────────────────────────────────────────────

export type GroupNode = Node<GroupNodeData>;
export type CustomEdge = Edge<CustomEdgeData>;
