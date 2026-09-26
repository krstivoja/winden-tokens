// Types for GroupedGraph component

import type { Node, Edge } from '@xyflow/react';
import { CollectionData, InspectorBindingTarget, ShadeGroupData, VariableData } from '../../../types';

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
  // 'collection' is a placeholder card for a variable collection that holds no
  // variables at all — it has no sourceGroupName and no rows, and exists only
  // so the collection still has a visible "+" to create its first variable.
  kind: 'standard' | 'source' | 'shader' | 'shades' | 'collection';
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

// ── Tier captions ──────────────────────────────────────────────────

/**
 * One "Tier N" caption Arrange Grid emits. A tier is exactly one column wide,
 * so a caption spans exactly one card. A plain object (not an interface) so it
 * satisfies xyflow's `Record<string, unknown>` node-data constraint directly,
 * and the very same object can be handed to the node as `data` — the layout
 * effect must not mint a fresh identity for it on every pass.
 */
export type TierPlacement = {
  /** 1-based, as displayed. Empty tiers collapse, so this is the tier's
   *  position among the tiers that actually hold something. */
  tier: number;
  /** Left edge — the x of the tier's column. */
  x: number;
  /** Caption width: one column, i.e. GROUP_WIDTH. */
  width: number;
};

export type TierLabelNodeData = TierPlacement;

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
  // Variable name whose row is the highlight seed (row-level selection).
  highlightedVarSeed?: string | null;
  onHighlightPath: (group: GroupData) => void;
  onHighlightVariable: (group: GroupData, node: VariableNode) => void;
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
  // Off-chain edge touching the highlighted row's own card — drawn in the
  // highlight color but faded, to show group membership vs. selection.
  isGroupSibling?: boolean;
  // Token-to-token edges: reset the receiving variable to a literal value.
  onDisconnect?: (receiverVarName: string, resolvedValue: string) => void;
  // Token-to-property edges: unbind a property on the selected Figma node.
  // Held as plain values + one stable callback rather than a per-edge closure,
  // so the edge's `data` keeps a stable shape across layout passes.
  onUnbindProperty?: (nodeId: string, target: InspectorBindingTarget) => void;
  unbindNodeId?: string;
  unbindTarget?: InspectorBindingTarget;
};

// ── React Flow Types ───────────────────────────────────────────────

export type GroupNode = Node<GroupNodeData>;
export type CustomEdge = Edge<CustomEdgeData>;
