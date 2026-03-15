// Grouped graph component - @xyflow/react based relationships view

import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  getBezierPath,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import type {
  Node,
  Edge,
  NodeTypes,
  EdgeTypes,
  OnConnect,
  NodeProps,
  EdgeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ShadeGroupData, VariableData } from '../../types';
import { parseColorToRgb, rgbObjToHex } from '../../utils/color';
import { post } from '../../hooks/usePluginMessages';
import { useModalContext } from '../Modals/ModalContext';

// ── Constants ──────────────────────────────────────────────────────
const GROUP_WIDTH = 260;
const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 36;
const GROUP_PADDING = 8;
const GROUP_GAP_X = 180;
const GROUP_GAP_Y = 40;
const GENERATED_CONNECTION_COLOR = '#b86e00';
const REFERENCE_CONNECTION_COLOR = '#1877f2';
const DEFAULT_GROUP_CHILD_NAME = 'base';

// ── Interfaces ─────────────────────────────────────────────────────
interface GroupedGraphProps {
  variables: VariableData[];
  selectedCollectionIds: Set<string>;
  variableType: 'COLOR' | 'FLOAT';
  shadeGroups: ShadeGroupData[];
}

interface VariableNode {
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

interface GroupData {
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

interface ManagedNumberStepGroup {
  sourceVariable: VariableData;
  stepVariables: VariableData[];
}

interface ConnectionRecord {
  id: string;
  kind: 'reference' | 'generated';
  fromGroup: string;
  fromVar: string;
  toGroup: string;
  toVar: string;
}

interface GridLayoutSettings {
  gapX: number;
  gapY: number;
}

interface GridLayoutDraft {
  gapX: string;
  gapY: string;
}

interface ConnectionFlags {
  hasInput: boolean;
  hasOutput: boolean;
  inputKind: 'reference' | 'generated' | null;
  outputKind: 'reference' | 'generated' | null;
}

// ── Node data type for React Flow ──────────────────────────────────
type GroupNodeData = {
  group: GroupData;
  isColorType: boolean;
  variableType: 'COLOR' | 'FLOAT';
  connectedVars: Map<string, ConnectionFlags>;
  onGeneratorOpen: (group: GroupData, node: VariableNode) => void;
  onAddVariable: (group: GroupData) => void;
  onDeleteVariable: (node: VariableNode) => void;
  onDisconnect: (receiverVarName: string, resolvedValue: string) => void;
};

// ── Edge data type ─────────────────────────────────────────────────
type CustomEdgeData = {
  kind: 'reference' | 'generated';
  receiverName: string;
  receiverShortName: string;
  resolvedValue: string;
  onDisconnect: (receiverVarName: string, resolvedValue: string) => void;
};

// ── Utility functions ──────────────────────────────────────────────

function getDefaultVariableValue(type: 'COLOR' | 'FLOAT'): string {
  return type === 'COLOR' ? 'rgb(0, 0, 0)' : '0';
}

function normalizePathSegment(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, '');
}

function getGroupHeight(group: GroupData): number {
  return HEADER_HEIGHT + group.variables.length * ROW_HEIGHT + GROUP_PADDING * 2;
}

function normalizeGridLayoutSettings(value: unknown): GridLayoutSettings {
  const candidate = (value && typeof value === 'object') ? value as Partial<GridLayoutSettings> : {};
  const gapX = typeof candidate.gapX === 'number' && candidate.gapX >= 0 ? candidate.gapX : GROUP_GAP_X;
  const gapY = typeof candidate.gapY === 'number' && candidate.gapY >= 0 ? candidate.gapY : GROUP_GAP_Y;
  return { gapX, gapY };
}

function sortGroupsByPosition(a: GroupData, b: GroupData): number {
  if (a.y !== b.y) return a.y - b.y;
  return a.x - b.x;
}

function extractShadeNumber(name: string): number {
  const match = name.match(/\/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

function formatVariableNode(
  variable: VariableData,
  varsByName: Map<string, VariableData>,
  isColorType: boolean
): VariableNode {
  const refPattern = /^\{(.+)\}$/;
  const refMatch = variable.value.match(refPattern);
  const isReference = !!refMatch;
  const referenceName = refMatch ? refMatch[1] : null;

  let resolvedValue = variable.value;
  if (isReference && referenceName) {
    const refVar = varsByName.get(referenceName);
    if (refVar) {
      const refRefMatch = refVar.value.match(refPattern);
      if (refRefMatch) {
        const deepRef = varsByName.get(refRefMatch[1]);
        if (deepRef) resolvedValue = deepRef.value;
      } else {
        resolvedValue = refVar.value;
      }
    }
  }

  let displayColor = '#888888';
  let displayValue = resolvedValue;
  if (isColorType) {
    const rgb = parseColorToRgb(resolvedValue);
    displayColor = rgb ? rgbObjToHex(rgb) : '#888888';
    displayValue = isReference ? `{${referenceName}}` : displayColor.toUpperCase();
  } else {
    displayValue = isReference && referenceName
      ? `{${referenceName}:${resolvedValue}}`
      : resolvedValue;
  }

  const parts = variable.name.split('/');
  return {
    id: variable.id,
    name: variable.name,
    shortName: parts[parts.length - 1],
    displayName: displayValue,
    color: displayColor,
    value: variable.value,
    resolvedValue: isColorType ? displayColor : resolvedValue,
    isReference,
    referenceName,
  };
}

function createShaderNode(shadeGroup: ShadeGroupData, color: string): VariableNode {
  return {
    id: `shader:${shadeGroup.sourceVariableId}`,
    name: `shader:${shadeGroup.sourceVariableId}`,
    shortName: 'shader',
    displayName: `${shadeGroup.config.shadeCount} shades`,
    color,
    value: '', resolvedValue: '',
    isReference: false, referenceName: null,
    isVirtual: true, virtualType: 'shader',
    connectionsDisabled: true,
  };
}

function createStepsNode(sourceVariableId: string, stepCount: number): VariableNode {
  return {
    id: `shader:${sourceVariableId}`,
    name: `shader:${sourceVariableId}`,
    shortName: 'steps',
    displayName: `${stepCount} steps`,
    color: GENERATED_CONNECTION_COLOR,
    value: '', resolvedValue: '',
    isReference: false, referenceName: null,
    isVirtual: true, virtualType: 'shader',
    connectionsDisabled: true,
  };
}

function createPaletteNode(shadeGroup: ShadeGroupData, shadeCount: number, color: string): VariableNode {
  return {
    id: `palette:${shadeGroup.sourceVariableId}`,
    name: `palette:${shadeGroup.sourceVariableId}`,
    shortName: 'generated',
    displayName: `${shadeCount} outputs`,
    color, value: '', resolvedValue: '',
    isReference: false, referenceName: null,
    isVirtual: true, virtualType: 'palette',
    connectionsDisabled: true,
  };
}

function detectManagedNumberStepGroups(variables: VariableData[]): ManagedNumberStepGroup[] {
  const groups = variables.map(sourceVariable => ({
    sourceVariable,
    stepVariables: [] as VariableData[],
  }));
  const groupsBySourceId = new Map(groups.map(group => [group.sourceVariable.id, group]));
  const prefixes = variables.map(variable => ({ variable, prefix: `${variable.name}/` }));

  variables.forEach(variable => {
    let bestSource: VariableData | null = null;
    prefixes.forEach(candidate => {
      if (candidate.variable.id === variable.id) return;
      if (!variable.name.startsWith(candidate.prefix)) return;
      if (!bestSource || candidate.variable.name.length > bestSource.name.length) {
        bestSource = candidate.variable;
      }
    });
    if (bestSource) {
      groupsBySourceId.get((bestSource as VariableData).id)?.stepVariables.push(variable);
    }
  });

  return groups.filter(group => group.stepVariables.length > 0);
}

function arrangeGroupsByConnectedBlocks(
  groups: GroupData[],
  connections: ConnectionRecord[],
  gapX: number,
  gapY: number
): Map<string, { x: number; y: number }> {
  const columnStep = GROUP_WIDTH + gapX;
  const positions = new Map<string, { x: number; y: number }>();
  const groupMap = new Map(groups.map(group => [group.key, group]));

  // Build directed graph: fromGroup → toGroup (connection flows left to right)
  const outgoing = new Map<string, Set<string>>();
  const incoming = new Map<string, Set<string>>();
  groups.forEach(group => {
    outgoing.set(group.key, new Set());
    incoming.set(group.key, new Set());
  });

  connections.forEach(conn => {
    if (!groupMap.has(conn.fromGroup) || !groupMap.has(conn.toGroup)) return;
    if (conn.fromGroup === conn.toGroup) return;
    outgoing.get(conn.fromGroup)?.add(conn.toGroup);
    incoming.get(conn.toGroup)?.add(conn.fromGroup);
  });

  // Also build undirected adjacency for finding connected components
  const adjacency = new Map<string, Set<string>>();
  groups.forEach(group => adjacency.set(group.key, new Set()));
  connections.forEach(conn => {
    if (!groupMap.has(conn.fromGroup) || !groupMap.has(conn.toGroup)) return;
    adjacency.get(conn.fromGroup)?.add(conn.toGroup);
    adjacency.get(conn.toGroup)?.add(conn.fromGroup);
  });

  // Find connected components (blocks)
  const visited = new Set<string>();
  const blocks: GroupData[][] = [];

  groups.slice().sort(sortGroupsByPosition).forEach(group => {
    if (visited.has(group.key)) return;
    const stack = [group.key];
    const block: GroupData[] = [];
    visited.add(group.key);

    while (stack.length > 0) {
      const currentKey = stack.pop();
      if (!currentKey) continue;
      const currentGroup = groupMap.get(currentKey);
      if (currentGroup) block.push(currentGroup);
      adjacency.get(currentKey)?.forEach(nextKey => {
        if (visited.has(nextKey)) return;
        visited.add(nextKey);
        stack.push(nextKey);
      });
    }
    blocks.push(block);
  });

  blocks.sort((a, b) => {
    const topA = Math.min(...a.map(g => g.y));
    const topB = Math.min(...b.map(g => g.y));
    if (topA !== topB) return topA - topB;
    return Math.min(...a.map(g => g.x)) - Math.min(...b.map(g => g.x));
  });

  // Per-group topological depth (each group is its own unit)
  const groupDepth = new Map<string, number>();
  const indegreeCount = new Map<string, number>();

  groups.forEach(group => {
    groupDepth.set(group.key, 0);
    indegreeCount.set(group.key, incoming.get(group.key)?.size || 0);
  });

  // Kahn's algorithm for topological depth
  const queue = groups
    .filter(g => (indegreeCount.get(g.key) || 0) === 0)
    .map(g => g.key);
  const processed = new Set<string>();

  while (queue.length > 0) {
    queue.sort((a, b) => {
      const gA = groupMap.get(a);
      const gB = groupMap.get(b);
      if (!gA || !gB) return 0;
      return sortGroupsByPosition(gA, gB);
    });
    const currentKey = queue.shift();
    if (!currentKey || processed.has(currentKey)) continue;
    processed.add(currentKey);
    const currentDepth = groupDepth.get(currentKey) || 0;

    outgoing.get(currentKey)?.forEach(nextKey => {
      groupDepth.set(nextKey, Math.max(groupDepth.get(nextKey) || 0, currentDepth + 1));
      indegreeCount.set(nextKey, (indegreeCount.get(nextKey) || 0) - 1);
      if ((indegreeCount.get(nextKey) || 0) === 0) queue.push(nextKey);
    });
  }

  // Handle cycles: assign remaining groups a fallback depth
  if (processed.size !== groups.length) {
    const maxProcessedDepth = processed.size > 0
      ? Math.max(...Array.from(processed).map(key => groupDepth.get(key) || 0))
      : -1;
    groups.forEach(group => {
      if (!processed.has(group.key)) {
        groupDepth.set(group.key, maxProcessedDepth + 1);
      }
    });
  }

  // Identify managed chains: groups linked by sourceGroupName (source → shader → shades)
  // Each chain is laid out as a horizontal row with aligned Y positions
  const chainSourceNames = new Set<string>();
  const groupToChain = new Map<string, string>(); // group.key → sourceGroupName
  groups.forEach(group => {
    if (group.sourceGroupName && (group.kind === 'source' || group.kind === 'shader' || group.kind === 'shades')) {
      chainSourceNames.add(group.sourceGroupName);
      groupToChain.set(group.key, group.sourceGroupName);
    }
  });

  // Group chains and standalone groups
  const chains = new Map<string, GroupData[]>(); // sourceGroupName → groups in chain
  const standaloneGroups: GroupData[] = [];

  groups.forEach(group => {
    const chainName = groupToChain.get(group.key);
    if (chainName) {
      const chain = chains.get(chainName) || [];
      chain.push(group);
      chains.set(chainName, chain);
    } else {
      standaloneGroups.push(group);
    }
  });

  // Sort chains by their source group position
  const sortedChains = Array.from(chains.entries()).sort((a, b) => {
    const aSource = a[1].find(g => g.kind === 'source');
    const bSource = b[1].find(g => g.kind === 'source');
    if (!aSource || !bSource) return 0;
    return sortGroupsByPosition(aSource, bSource);
  });

  // Layout: managed chains first as horizontal rows, then standalone groups by depth
  let nextBlockY = 0;

  // Layout managed chains - each chain on its own row
  sortedChains.forEach(([, chainGroups]) => {
    // Sort chain groups by depth (source=0, shader=1, shades=2)
    chainGroups.sort((a, b) => (groupDepth.get(a.key) || 0) - (groupDepth.get(b.key) || 0));
    let rowHeight = 0;
    chainGroups.forEach(group => {
      const depth = groupDepth.get(group.key) || 0;
      positions.set(group.key, { x: depth * columnStep, y: nextBlockY });
      rowHeight = Math.max(rowHeight, getGroupHeight(group));
    });
    nextBlockY += rowHeight + gapY;
  });

  // Layout standalone groups by depth columns
  if (standaloneGroups.length > 0) {
    const standaloneColumns = new Map<number, GroupData[]>();
    standaloneGroups.forEach(group => {
      const depth = groupDepth.get(group.key) || 0;
      const col = standaloneColumns.get(depth) || [];
      col.push(group);
      standaloneColumns.set(depth, col);
    });

    let standaloneHeight = 0;
    Array.from(standaloneColumns.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([columnIndex, columnGroups]) => {
        let nextColumnY = nextBlockY;
        columnGroups.sort(sortGroupsByPosition).forEach(group => {
          positions.set(group.key, { x: columnIndex * columnStep, y: nextColumnY });
          nextColumnY += getGroupHeight(group) + gapY;
        });
        standaloneHeight = Math.max(standaloneHeight, nextColumnY - nextBlockY - gapY);
      });
  }

  return positions;
}

// ── Custom Node Component ──────────────────────────────────────────

function GroupNodeComponent({ data }: NodeProps<Node<GroupNodeData>>) {
  const { group, isColorType, connectedVars, onGeneratorOpen, onAddVariable, onDeleteVariable } = data;
  const height = getGroupHeight(group);
  const canManageGroupVariables = group.kind === 'standard';

  return (
    <div
      className={`rf-group-box ${group.kind}`}
      style={{ width: GROUP_WIDTH, height }}
    >
      {/* Header */}
      <div
        className="rf-group-header"
        style={{ background: group.headerFill, height: HEADER_HEIGHT }}
      >
        <span className="rf-group-title">{group.title}</span>
        {canManageGroupVariables && (
          <button
            type="button"
            className="rf-group-add-btn"
            onClick={(e) => { e.stopPropagation(); onAddVariable(group); }}
          >
            +
          </button>
        )}
      </div>

      {/* Variable rows */}
      <div className="rf-group-body" style={{ padding: `${GROUP_PADDING}px 0` }}>
        {group.variables.map((node, idx) => {
          const flags = connectedVars.get(node.name);
          const hasInput = flags?.hasInput || false;
          const hasOutput = flags?.hasOutput || false;
          const inputColor = flags?.inputKind === 'generated' ? GENERATED_CONNECTION_COLOR : REFERENCE_CONNECTION_COLOR;
          const outputColor = flags?.outputKind === 'generated' ? GENERATED_CONNECTION_COLOR : REFERENCE_CONNECTION_COLOR;
          const rowInteractive = group.kind === 'shader' && node.virtualType === 'shader';
          const showDeleteAction = group.kind === 'standard' && !node.isVirtual;

          return (
            <div
              key={node.id}
              className={`rf-variable-row ${rowInteractive ? 'shader-row' : ''}`}
              style={{ height: ROW_HEIGHT, position: 'relative' }}
              onClick={rowInteractive ? () => onGeneratorOpen(group, node) : undefined}
            >
              {/* Left handle (target) */}
              <Handle
                type="target"
                position={Position.Left}
                id={`${node.name}::in`}
                className={`rf-handle ${hasInput ? 'connected' : ''} ${node.connectionsDisabled ? 'disabled' : ''}`}
                isConnectable={!node.connectionsDisabled}
                style={{
                  top: ROW_HEIGHT / 2,
                  background: hasInput ? inputColor : 'white',
                  borderColor: hasInput ? inputColor : 'black',
                }}
              />

              {/* Color swatch */}
              {isColorType && !node.isVirtual && (
                <div className="rf-color-swatch" style={{ background: node.color }} />
              )}

              {/* Virtual badge */}
              {node.isVirtual && (
                <span className={`rf-virtual-badge ${node.virtualType}`}>
                  {node.virtualType === 'shader' ? 'fx' : 'out'}
                </span>
              )}

              {/* Name */}
              <span className="rf-var-name" style={{ left: node.isVirtual ? 52 : (isColorType ? 42 : 14) }}>
                {node.shortName}
              </span>

              {/* Value */}
              <span
                className="rf-var-value"
                style={{
                  right: showDeleteAction ? 42 : 16,
                  color: node.isReference ? '#666' : '#999',
                }}
              >
                {node.displayName}
              </span>

              {/* Delete button */}
              {showDeleteAction && (
                <button
                  type="button"
                  className="rf-delete-btn"
                  onClick={(e) => { e.stopPropagation(); onDeleteVariable(node); }}
                >
                  &times;
                </button>
              )}

              {/* Right handle (source) */}
              <Handle
                type="source"
                position={Position.Right}
                id={`${node.name}::out`}
                className={`rf-handle ${hasOutput ? 'connected' : ''} ${node.connectionsDisabled ? 'disabled' : ''}`}
                isConnectable={!node.connectionsDisabled}
                style={{
                  top: ROW_HEIGHT / 2,
                  background: hasOutput ? outputColor : 'white',
                  borderColor: hasOutput ? outputColor : 'black',
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Custom Edge Component ──────────────────────────────────────────

function CustomEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<Edge<CustomEdgeData>>) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const kind = data?.kind || 'reference';
  const stroke = kind === 'generated' ? GENERATED_CONNECTION_COLOR : REFERENCE_CONNECTION_COLOR;
  const strokeDasharray = kind === 'generated' ? '7 5' : undefined;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (kind !== 'reference' || !data) return;
    if (confirm(`Disconnect ${data.receiverShortName}?`)) {
      data.onDisconnect(data.receiverName, data.resolvedValue);
    }
  };

  return (
    <g className={`connection-group ${kind}`}>
      {kind === 'reference' && (
        <path
          d={edgePath}
          fill="none"
          stroke="transparent"
          strokeWidth={12}
          style={{ cursor: 'pointer' }}
          onClick={handleClick}
        />
      )}
      <path
        d={edgePath}
        fill="none"
        stroke={stroke}
        strokeWidth={kind === 'generated' ? 2.5 : 2}
        strokeDasharray={strokeDasharray}
        className="connection-line"
        style={{ pointerEvents: 'none' }}
      />
    </g>
  );
}

// ── Node & Edge type registrations ─────────────────────────────────

const nodeTypes: NodeTypes = {
  groupNode: GroupNodeComponent,
};

const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
};

// ── Inner component (needs ReactFlowProvider context) ──────────────

function GroupedGraphInner({
  variables,
  selectedCollectionIds,
  variableType,
  shadeGroups,
}: GroupedGraphProps) {
  const { openShadesModal, openStepsModal, openInputModal } = useModalContext();
  const isColorType = variableType === 'COLOR';
  const gridSettingsRef = useRef<HTMLDivElement>(null);
  const [savedPositions, setSavedPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [gridLayoutSettings, setGridLayoutSettings] = useState<GridLayoutSettings>({
    gapX: GROUP_GAP_X,
    gapY: GROUP_GAP_Y,
  });
  const [gridLayoutDraft, setGridLayoutDraft] = useState<GridLayoutDraft>({
    gapX: String(GROUP_GAP_X),
    gapY: String(GROUP_GAP_Y),
  });
  const [isGridSettingsOpen, setIsGridSettingsOpen] = useState(false);
  const [positionsHydrated, setPositionsHydrated] = useState(false);
  const reactFlowInstance = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<GroupNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<CustomEdgeData>>([]);

  // Load saved positions on mount
  useEffect(() => {
    const storageKey = `graph-positions-${variableType}`;
    setSavedPositions({});
    setPositionsHydrated(false);
    post({ type: 'get-client-storage', key: storageKey });

    const handleStorage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (msg?.type === 'client-storage-data' && msg.key === storageKey) {
        setSavedPositions(msg.value || {});
        setPositionsHydrated(true);
      }
    };

    window.addEventListener('message', handleStorage);
    return () => window.removeEventListener('message', handleStorage);
  }, [variableType]);

  useEffect(() => {
    const storageKey = `graph-layout-settings-${variableType}`;
    setGridLayoutSettings({ gapX: GROUP_GAP_X, gapY: GROUP_GAP_Y });
    post({ type: 'get-client-storage', key: storageKey });

    const handleStorage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (msg?.type === 'client-storage-data' && msg.key === storageKey) {
        setGridLayoutSettings(normalizeGridLayoutSettings(msg.value));
      }
    };

    window.addEventListener('message', handleStorage);
    return () => window.removeEventListener('message', handleStorage);
  }, [variableType]);

  useEffect(() => {
    if (isGridSettingsOpen) return;
    setGridLayoutDraft({
      gapX: String(gridLayoutSettings.gapX),
      gapY: String(gridLayoutSettings.gapY),
    });
  }, [gridLayoutSettings, isGridSettingsOpen]);

  useEffect(() => {
    if (!isGridSettingsOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (gridSettingsRef.current?.contains(event.target as globalThis.Node)) return;
      setIsGridSettingsOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsGridSettingsOpen(false);
    };
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isGridSettingsOpen]);

  // Callbacks for node actions
  const handleGeneratorOpen = useCallback((group: GroupData, node: VariableNode) => {
    if (group.kind === 'shader' && node.virtualType === 'shader' && group.sourceGroupName) {
      if (isColorType) {
        openShadesModal({ groupName: group.sourceGroupName });
      } else {
        openStepsModal({ groupName: group.sourceGroupName });
      }
    }
  }, [isColorType, openShadesModal, openStepsModal]);

  const handleAddVariableToGroup = useCallback((group: GroupData) => {
    const firstCollectionId = Array.from(selectedCollectionIds)[0];
    if (!firstCollectionId || group.kind !== 'standard' || !group.sourceGroupName) return;

    openInputModal({
      title: `New Variable in ${group.sourceGroupName}`,
      label: 'Variable name',
      confirmText: 'Add',
      onConfirm: value => {
        const variableName = normalizePathSegment(value);
        if (!variableName) return;
        post({
          type: 'create-variable',
          collectionId: firstCollectionId,
          name: `${group.sourceGroupName}/${variableName}`,
          varType: variableType,
          value: getDefaultVariableValue(variableType),
        });
      },
    });
  }, [openInputModal, selectedCollectionIds, variableType]);

  const handleDeleteGraphVariable = useCallback((node: VariableNode) => {
    if (node.isVirtual) return;
    if (confirm(`Delete ${node.name}?`)) {
      post({ type: 'delete-variable', id: node.id });
    }
  }, []);

  const handleDisconnect = useCallback((receiverVarId: string, resolvedValue: string) => {
    post({ type: 'update-variable-value', id: receiverVarId, value: resolvedValue });
  }, []);

  const handleCreateGroup = useCallback(() => {
    const firstCollectionId = Array.from(selectedCollectionIds)[0];
    if (!firstCollectionId) return;

    openInputModal({
      title: `New ${isColorType ? 'Color' : 'Number'} Group`,
      label: 'Group name',
      confirmText: 'Create',
      onConfirm: value => {
        const groupName = normalizePathSegment(value);
        if (!groupName) return;
        post({
          type: 'create-variable',
          collectionId: firstCollectionId,
          name: `${groupName}/${DEFAULT_GROUP_CHILD_NAME}`,
          varType: variableType,
          value: getDefaultVariableValue(variableType),
        });
      },
    });
  }, [isColorType, openInputModal, selectedCollectionIds, variableType]);

  // Compute groups and connections from ALL variables (collection filter is applied at render time)
  const { groupsData, connectionData, variableMap } = useMemo(() => {
    const typeVars = variables.filter(variable => variable.resolvedType === variableType);
    const varsByName = new Map<string, VariableData>();
    typeVars.forEach(variable => varsByName.set(variable.name, variable));

    const groupsArray: GroupData[] = [];
    const varMap = new Map<string, { group: string; index: number; node: VariableNode }>();
    const conns: ConnectionRecord[] = [];

    const managedSourceIds = new Set<string>();
    const managedGeneratedIds = new Set<string>();
    const managedShadeGroups = isColorType
      ? shadeGroups
          .sort((a, b) => a.sourceVariableName.localeCompare(b.sourceVariableName))
      : [];
    const managedStepGroups = !isColorType
      ? detectManagedNumberStepGroups(typeVars)
      : [];

    managedShadeGroups.forEach((shadeGroup, index) => {
      const sourceVariable = typeVars.find(v => v.id === shadeGroup.sourceVariableId);
      if (!sourceVariable) return;

      managedSourceIds.add(sourceVariable.id);
      shadeGroup.deleteIds.forEach(id => {
        if (id !== sourceVariable.id) managedGeneratedIds.add(id);
      });

      const sourceNode = formatVariableNode(sourceVariable, varsByName, true);
      const sourceGroupKey = `source:${sourceVariable.id}`;
      const shaderGroupKey = `shader:${sourceVariable.id}`;
      const shadesGroupKey = `shades:${sourceVariable.id}`;
      const sourceColor = sourceNode.color;
      const managedShades = typeVars
        .filter(v => shadeGroup.deleteIds.includes(v.id) && v.id !== sourceVariable.id)
        .sort((a, b) => extractShadeNumber(a.name) - extractShadeNumber(b.name));
      const shadeNodes = managedShades.map(v => formatVariableNode(v, varsByName, true));
      const shaderNode = createShaderNode(shadeGroup, sourceColor);
      const paletteNode = createPaletteNode(shadeGroup, shadeNodes.length, sourceColor);

      const baseY = index * (Math.max(
        HEADER_HEIGHT + ROW_HEIGHT + GROUP_PADDING * 2,
        HEADER_HEIGHT + (shadeNodes.length + 1) * ROW_HEIGHT + GROUP_PADDING * 2
      ) + GROUP_GAP_Y);

      const managedGroups: GroupData[] = [
        {
          key: sourceGroupKey, title: sourceVariable.name, variables: [sourceNode],
          x: 0, y: 0, initialX: 0, initialY: baseY,
          kind: 'source', sourceGroupName: sourceVariable.name, headerFill: '#f0f0f0',
          collectionId: shadeGroup.collectionId,
        },
        {
          key: shaderGroupKey, title: 'Shader', variables: [shaderNode],
          x: 0, y: 0, initialX: GROUP_WIDTH + GROUP_GAP_X, initialY: baseY,
          kind: 'shader', sourceGroupName: sourceVariable.name, headerFill: '#fff4df',
          collectionId: shadeGroup.collectionId,
        },
        {
          key: shadesGroupKey, title: `${sourceVariable.name} shades`, variables: [paletteNode, ...shadeNodes],
          x: 0, y: 0, initialX: (GROUP_WIDTH + GROUP_GAP_X) * 2, initialY: baseY,
          kind: 'shades', sourceGroupName: sourceVariable.name, headerFill: '#eef4ff',
          collectionId: shadeGroup.collectionId,
        },
      ];

      managedGroups.forEach(group => {
        groupsArray.push(group);
        group.variables.forEach((vNode, variableIndex) => {
          varMap.set(vNode.name, { group: group.key, index: variableIndex, node: vNode });
        });
      });

      conns.push({
        id: `generated:${sourceVariable.id}:source-to-shader`, kind: 'generated',
        fromGroup: sourceGroupKey, fromVar: sourceNode.name,
        toGroup: shaderGroupKey, toVar: shaderNode.name,
      });
      conns.push({
        id: `generated:${sourceVariable.id}:shader-to-palette`, kind: 'generated',
        fromGroup: shaderGroupKey, fromVar: shaderNode.name,
        toGroup: shadesGroupKey, toVar: paletteNode.name,
      });
    });

    managedStepGroups.forEach((stepGroup, index) => {
      const sourceVariable = stepGroup.sourceVariable;
      const sourceNode = formatVariableNode(sourceVariable, varsByName, false);
      const sourceGroupKey = `source:${sourceVariable.id}`;
      const shaderGroupKey = `shader:${sourceVariable.id}`;
      const stepsGroupKey = `steps:${sourceVariable.id}`;
      const stepNodes = stepGroup.stepVariables.map(v => formatVariableNode(v, varsByName, false));
      const stepsNode = createStepsNode(sourceVariable.id, stepNodes.length);
      const outputNode: VariableNode = {
        id: `palette:${sourceVariable.id}`,
        name: `palette:${sourceVariable.id}`,
        shortName: 'generated',
        displayName: `${stepNodes.length} outputs`,
        color: REFERENCE_CONNECTION_COLOR,
        value: '', resolvedValue: '',
        isReference: false, referenceName: null,
        isVirtual: true, virtualType: 'palette',
        connectionsDisabled: true,
      };

      managedSourceIds.add(sourceVariable.id);
      stepGroup.stepVariables.forEach(v => managedGeneratedIds.add(v.id));

      const baseY = index * (Math.max(
        HEADER_HEIGHT + ROW_HEIGHT + GROUP_PADDING * 2,
        HEADER_HEIGHT + (stepNodes.length + 1) * ROW_HEIGHT + GROUP_PADDING * 2
      ) + GROUP_GAP_Y);

      const managedGroups: GroupData[] = [
        {
          key: sourceGroupKey, title: sourceVariable.name, variables: [sourceNode],
          x: 0, y: 0, initialX: 0, initialY: baseY,
          kind: 'source', sourceGroupName: sourceVariable.name, headerFill: '#f0f0f0',
          collectionId: sourceVariable.collectionId,
        },
        {
          key: shaderGroupKey, title: 'Steps', variables: [stepsNode],
          x: 0, y: 0, initialX: GROUP_WIDTH + GROUP_GAP_X, initialY: baseY,
          kind: 'shader', sourceGroupName: sourceVariable.name, headerFill: '#fff4df',
          collectionId: sourceVariable.collectionId,
        },
        {
          key: stepsGroupKey, title: `${sourceVariable.name} steps`, variables: [outputNode, ...stepNodes],
          x: 0, y: 0, initialX: (GROUP_WIDTH + GROUP_GAP_X) * 2, initialY: baseY,
          kind: 'shades', sourceGroupName: sourceVariable.name, headerFill: '#eef4ff',
          collectionId: sourceVariable.collectionId,
        },
      ];

      managedGroups.forEach(group => {
        groupsArray.push(group);
        group.variables.forEach((vNode, variableIndex) => {
          varMap.set(vNode.name, { group: group.key, index: variableIndex, node: vNode });
        });
      });

      conns.push({
        id: `generated:${sourceVariable.id}:source-to-steps`, kind: 'generated',
        fromGroup: sourceGroupKey, fromVar: sourceNode.name,
        toGroup: shaderGroupKey, toVar: stepsNode.name,
      });
      conns.push({
        id: `generated:${sourceVariable.id}:steps-to-output`, kind: 'generated',
        fromGroup: shaderGroupKey, fromVar: stepsNode.name,
        toGroup: stepsGroupKey, toVar: outputNode.name,
      });
    });

    const unmanagedVars = typeVars.filter(
      v => !managedSourceIds.has(v.id) && !managedGeneratedIds.has(v.id)
    );
    const unmanagedGroupsMap = new Map<string, { nodes: VariableNode[]; collectionId: string }>();

    unmanagedVars.forEach(variable => {
      const parts = variable.name.split('/');
      const groupName = parts.length > 1 ? parts.slice(0, -1).join('/') : variable.name;
      const existing = unmanagedGroupsMap.get(groupName) || { nodes: [], collectionId: variable.collectionId };
      existing.nodes.push(formatVariableNode(variable, varsByName, isColorType));
      unmanagedGroupsMap.set(groupName, existing);
    });

    // Calculate the max Y used by managed groups so unmanaged ones start below
    let managedMaxY = 0;
    groupsArray.forEach(group => {
      managedMaxY = Math.max(managedMaxY, group.initialY + getGroupHeight(group) + GROUP_GAP_Y);
    });

    // Place unmanaged groups: primitives at column 0, semantic groups further right
    // First pass: create all groups and track which reference which
    const unmanagedEntries: Array<{ groupName: string; groupVariables: VariableNode[]; collectionId: string; hasReferences: boolean }> = [];
    Array.from(unmanagedGroupsMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([groupName, { nodes: groupVariables, collectionId }]) => {
        const hasReferences = groupVariables.some(v => v.isReference);
        unmanagedEntries.push({ groupName, groupVariables, collectionId, hasReferences });
      });

    // Primitives (no references) go at column 0, stacked below managed source groups
    let primitiveY = managedMaxY;
    unmanagedEntries.filter(e => !e.hasReferences).forEach(entry => {
      const groupKey = `group:${entry.groupName}`;
      const groupData: GroupData = {
        key: groupKey, title: entry.groupName, variables: entry.groupVariables,
        x: 0, y: 0, initialX: 0, initialY: primitiveY,
        kind: 'standard', sourceGroupName: entry.groupName, headerFill: '#f0f0f0',
        collectionId: entry.collectionId,
      };
      groupsArray.push(groupData);
      entry.groupVariables.forEach((vNode, variableIndex) => {
        varMap.set(vNode.name, { group: groupKey, index: variableIndex, node: vNode });
      });
      primitiveY += getGroupHeight(groupData) + GROUP_GAP_Y;
    });

    // Semantic groups (with references) - we'll set initialX after building connections
    // so we can compute depth. For now, place them temporarily.
    const semanticGroups: GroupData[] = [];
    let semanticY = managedMaxY;
    unmanagedEntries.filter(e => e.hasReferences).forEach(entry => {
      const groupKey = `group:${entry.groupName}`;
      const groupData: GroupData = {
        key: groupKey, title: entry.groupName, variables: entry.groupVariables,
        x: 0, y: 0, initialX: 0, initialY: semanticY,
        kind: 'standard', sourceGroupName: entry.groupName, headerFill: '#f0f0f0',
        collectionId: entry.collectionId,
      };
      groupsArray.push(groupData);
      semanticGroups.push(groupData);
      entry.groupVariables.forEach((vNode, variableIndex) => {
        varMap.set(vNode.name, { group: groupKey, index: variableIndex, node: vNode });
      });
      semanticY += getGroupHeight(groupData) + GROUP_GAP_Y;
    });

    groupsArray.forEach(group => {
      group.variables.forEach(vNode => {
        if (vNode.isReference && vNode.referenceName) {
          const provider = varMap.get(vNode.referenceName);
          const receiver = varMap.get(vNode.name);
          if (provider && receiver) {
            conns.push({
              id: `reference:${receiver.node.id}->${provider.node.id}`,
              kind: 'reference',
              fromGroup: provider.group, fromVar: provider.node.name,
              toGroup: receiver.group, toVar: receiver.node.name,
            });
          }
        }
      });
    });

    // Now compute depth-based initialX for semantic groups
    // Build a quick group→maxSourceDepth map from connections
    if (semanticGroups.length > 0) {
      const groupInitialCol = new Map<string, number>();
      groupsArray.forEach(group => {
        // Managed groups already have correct initialX columns
        groupInitialCol.set(group.key, Math.round(group.initialX / (GROUP_WIDTH + GROUP_GAP_X)));
      });

      // Iteratively propagate: each group's column = max(source columns) + 1
      let changed = true;
      let iterations = 0;
      while (changed && iterations < 20) {
        changed = false;
        iterations++;
        conns.forEach(conn => {
          const fromCol = groupInitialCol.get(conn.fromGroup) ?? 0;
          const toCol = groupInitialCol.get(conn.toGroup) ?? 0;
          const needed = fromCol + 1;
          if (needed > toCol) {
            groupInitialCol.set(conn.toGroup, needed);
            changed = true;
          }
        });
      }

      // Apply computed columns to semantic groups
      const colStep = GROUP_WIDTH + GROUP_GAP_X;
      const colYTracker = new Map<number, number>();
      semanticGroups.forEach(group => {
        const col = groupInitialCol.get(group.key) ?? 0;
        const currentY = colYTracker.get(col) ?? managedMaxY;
        group.initialX = col * colStep;
        group.initialY = currentY;
        colYTracker.set(col, currentY + getGroupHeight(group) + GROUP_GAP_Y);
      });
    }

    return { groupsData: groupsArray, connectionData: conns, variableMap: varMap };
  }, [variables, variableType, shadeGroups, isColorType]);

  // Compute connected vars flags
  const connectedVars = useMemo(() => {
    const connected = new Map<string, ConnectionFlags>();
    const ensureState = (name: string) => {
      const state = connected.get(name) || { hasInput: false, hasOutput: false, inputKind: null, outputKind: null };
      connected.set(name, state);
      return state;
    };

    connectionData.forEach(conn => {
      const output = ensureState(conn.fromVar);
      output.hasOutput = true;
      output.outputKind = output.outputKind || conn.kind;
      const input = ensureState(conn.toVar);
      input.hasInput = true;
      input.inputKind = input.inputKind || conn.kind;
    });

    return connected;
  }, [connectionData]);

  // Build React Flow nodes/edges when data changes, filtering by selected collections
  useEffect(() => {
    if (!positionsHydrated) return;

    // Determine which groups are visible based on collection filter
    const visibleGroupKeys = new Set<string>();
    const visibleGroups = groupsData.filter(group => selectedCollectionIds.has(group.collectionId));
    visibleGroups.forEach(group => visibleGroupKeys.add(group.key));

    const newNodes: Node<GroupNodeData>[] = visibleGroups.map(group => {
      const savedPos = savedPositions[group.key];
      const position = savedPos || { x: group.initialX, y: group.initialY };
      return {
        id: group.key,
        type: 'groupNode',
        position,
        data: {
          group,
          isColorType,
          variableType,
          connectedVars,
          onGeneratorOpen: handleGeneratorOpen,
          onAddVariable: handleAddVariableToGroup,
          onDeleteVariable: handleDeleteGraphVariable,
          onDisconnect: handleDisconnect,
        },
        dragHandle: '.rf-group-header',
      };
    });

    // Only show edges where both source and target groups are visible
    const newEdges: Edge<CustomEdgeData>[] = connectionData
      .filter(conn => visibleGroupKeys.has(conn.fromGroup) && visibleGroupKeys.has(conn.toGroup))
      .map(conn => {
        const toVarInfo = variableMap.get(conn.toVar);
        return {
          id: conn.id,
          source: conn.fromGroup,
          target: conn.toGroup,
          sourceHandle: `${conn.fromVar}::out`,
          targetHandle: `${conn.toVar}::in`,
          type: 'custom',
          data: {
            kind: conn.kind,
            receiverName: toVarInfo?.node.id || '',
            receiverShortName: toVarInfo?.node.shortName || '',
            resolvedValue: toVarInfo?.node.resolvedValue || '',
            onDisconnect: handleDisconnect,
          },
        };
      });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [groupsData, connectionData, connectedVars, variableMap, positionsHydrated, savedPositions,
      selectedCollectionIds, isColorType, variableType, handleGeneratorOpen, handleAddVariableToGroup,
      handleDeleteGraphVariable, handleDisconnect, setNodes, setEdges]);

  // Save positions when nodes are dragged
  const savePositionsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNodesChangeWrapped = useCallback((changes: Parameters<typeof onNodesChange>[0]) => {
    onNodesChange(changes);

    const hasPositionChanges = changes.some(c => c.type === 'position' && c.position);
    if (hasPositionChanges) {
      if (savePositionsTimeoutRef.current) clearTimeout(savePositionsTimeoutRef.current);
      savePositionsTimeoutRef.current = setTimeout(() => {
        const currentNodes = reactFlowInstance.getNodes();
        const positionsObj: Record<string, { x: number; y: number }> = {};
        currentNodes.forEach(n => {
          positionsObj[n.id] = { x: n.position.x, y: n.position.y };
        });
        const storageKey = `graph-positions-${variableType}`;
        post({ type: 'set-client-storage', key: storageKey, value: positionsObj });
      }, 300);
    }
  }, [onNodesChange, reactFlowInstance, variableType]);

  // Handle new connections (drag from handle to handle)
  const handleConnect: OnConnect = useCallback((connection) => {
    if (!connection.sourceHandle || !connection.targetHandle) return;

    const sourceVarName = connection.sourceHandle.replace('::out', '');
    const targetVarName = connection.targetHandle.replace('::in', '');

    const sourceVarInfo = variableMap.get(sourceVarName);
    const targetVarInfo = variableMap.get(targetVarName);
    if (!sourceVarInfo || !targetVarInfo) return;
    if (sourceVarInfo.node.connectionsDisabled || targetVarInfo.node.connectionsDisabled) return;

    const newValue = `{${sourceVarInfo.node.name}}`;
    post({ type: 'update-variable-value', id: targetVarInfo.node.id, value: newValue });
  }, [variableMap]);

  const handleArrangeGrid = useCallback((overrideSettings?: GridLayoutSettings) => {
    const settings = overrideSettings || gridLayoutSettings;
    const currentNodes = reactFlowInstance.getNodes();
    const currentGroups = groupsData.map(group => {
      const rfNode = currentNodes.find(n => n.id === group.key);
      return {
        ...group,
        x: rfNode?.position.x ?? group.initialX,
        y: rfNode?.position.y ?? group.initialY,
      };
    });

    const newPositions = arrangeGroupsByConnectedBlocks(
      currentGroups, connectionData, settings.gapX, settings.gapY
    );

    setNodes(prevNodes =>
      prevNodes.map(rfNode => {
        const pos = newPositions.get(rfNode.id);
        return pos ? { ...rfNode, position: { x: pos.x, y: pos.y } } : rfNode;
      })
    );

    const positionsObj: Record<string, { x: number; y: number }> = {};
    newPositions.forEach((pos, key) => { positionsObj[key] = pos; });
    post({ type: 'set-client-storage', key: `graph-positions-${variableType}`, value: positionsObj });
  }, [reactFlowInstance, groupsData, connectionData, gridLayoutSettings, setNodes, variableType]);

  const handleApplyGridSettings = useCallback(() => {
    const settings = normalizeGridLayoutSettings({
      gapX: Number.parseInt(gridLayoutDraft.gapX, 10),
      gapY: Number.parseInt(gridLayoutDraft.gapY, 10),
    });
    setGridLayoutSettings(settings);
    setGridLayoutDraft({ gapX: String(settings.gapX), gapY: String(settings.gapY) });
    setIsGridSettingsOpen(false);
    post({
      type: 'set-client-storage',
      key: `graph-layout-settings-${variableType}`,
      value: settings,
    });
    handleArrangeGrid(settings);
  }, [gridLayoutDraft, variableType, handleArrangeGrid]);

  return (
    <div className="grouped-graph" style={{ width: '100%', height: '100%' }}>
      <div className="graph-top-controls" onMouseDown={e => e.stopPropagation()}>
        <button
          type="button"
          className="graph-action-btn"
          onClick={handleCreateGroup}
          disabled={selectedCollectionIds.size === 0}
        >
          New Group
        </button>
        <button type="button" className="graph-action-btn" onClick={() => handleArrangeGrid()}>
          Arrange Grid
        </button>
        <div ref={gridSettingsRef} className="graph-settings-menu" onMouseDown={e => e.stopPropagation()}>
          <button
            type="button"
            className="graph-action-btn"
            onClick={() => {
              if (isGridSettingsOpen) { setIsGridSettingsOpen(false); return; }
              setGridLayoutDraft({
                gapX: String(gridLayoutSettings.gapX),
                gapY: String(gridLayoutSettings.gapY),
              });
              setIsGridSettingsOpen(true);
            }}
          >
            Grid Settings
          </button>
          {isGridSettingsOpen && (
            <div className="graph-settings-popover">
              <div className="graph-settings-title">Grid Layout</div>
              <div className="form-group">
                <label htmlFor="grid-gap-x">Horizontal gap</label>
                <input
                  id="grid-gap-x" type="number" min="0" className="form-input"
                  value={gridLayoutDraft.gapX}
                  onChange={e => setGridLayoutDraft(prev => ({ ...prev, gapX: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label htmlFor="grid-gap-y">Vertical gap</label>
                <input
                  id="grid-gap-y" type="number" min="0" className="form-input"
                  value={gridLayoutDraft.gapY}
                  onChange={e => setGridLayoutDraft(prev => ({ ...prev, gapY: e.target.value }))}
                />
              </div>
              <div className="graph-settings-actions">
                <button
                  type="button" className="graph-action-btn"
                  onClick={() => {
                    setGridLayoutDraft({
                      gapX: String(gridLayoutSettings.gapX),
                      gapY: String(gridLayoutSettings.gapY),
                    });
                    setIsGridSettingsOpen(false);
                  }}
                >
                  Cancel
                </button>
                <button type="button" className="graph-action-btn" onClick={handleApplyGridSettings}>
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChangeWrapped}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView={false}
        minZoom={0.2}
        maxZoom={3}
        defaultViewport={{ x: 50, y: 50, zoom: 1 }}
        proOptions={{ hideAttribution: true }}
        connectionLineStyle={{ stroke: REFERENCE_CONNECTION_COLOR, strokeWidth: 2, strokeDasharray: '4 2' }}
      />
    </div>
  );
}

// ── Exported component with ReactFlowProvider ──────────────────────

export function GroupedGraph(props: GroupedGraphProps) {
  return (
    <ReactFlowProvider>
      <GroupedGraphInner {...props} />
    </ReactFlowProvider>
  );
}
