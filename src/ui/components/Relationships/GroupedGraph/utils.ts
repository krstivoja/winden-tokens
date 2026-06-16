// Utility functions for GroupedGraph component

import { VariableData, CollectionData, ShadeGroupData } from '../../../types';
import { parseColorToRgb, rgbObjToHex } from '../../../utils/color';
import { getVariableValueForMode } from '../../../utils/modes';
import {
  GroupData,
  VariableNode,
  ManagedNumberStepGroup,
  GridLayoutSettings,
  ConnectionRecord,
} from './types';
import {
  HEADER_HEIGHT,
  ROW_HEIGHT,
  GROUP_PADDING,
  GROUP_GAP_X,
  GROUP_GAP_Y,
  GROUP_WIDTH,
  GENERATED_CONNECTION_COLOR,
} from './constants';

// ── Utility functions ──────────────────────────────────────────────

function getDefaultVariableValue(type: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN'): string {
  switch (type) {
    case 'COLOR':
      return 'rgb(0, 0, 0)';
    case 'FLOAT':
      return '0';
    case 'STRING':
      return '';
    case 'BOOLEAN':
      return 'false';
  }
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

function getManagedLane(group: GroupData): number | null {
  if (!group.sourceGroupName) return null;

  switch (group.kind) {
    case 'source':
      return 0;
    case 'shader':
      return 1;
    case 'shades':
      return 2;
    default:
      return null;
  }
}

function getStandaloneLane(depth: number, reserveGeneratorLane: boolean): number {
  if (!reserveGeneratorLane) return depth;
  return depth === 0 ? 0 : Math.max(depth, 2);
}

function extractShadeNumber(name: string): number {
  const match = name.match(/\/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

function formatVariableNode(
  variable: VariableData,
  varsByName: Map<string, VariableData>,
  isColorType: boolean,
  collections: CollectionData[],
  selectedModeId: string | null
): VariableNode {
  const refPattern = /^\{(.+)\}$/;

  const modeValue = getVariableValueForMode(collections, variable, selectedModeId);

  const refMatch = modeValue.match(refPattern);
  const isReference = !!refMatch;
  const referenceName = refMatch ? refMatch[1] : null;

  let resolvedValue = modeValue;
  if (isReference && referenceName) {
    const refVar = varsByName.get(referenceName);
    if (refVar) {
      const refVarModeValue = getVariableValueForMode(collections, refVar, selectedModeId);
      const refRefMatch = refVarModeValue.match(refPattern);
      if (refRefMatch) {
        const deepRef = varsByName.get(refRefMatch[1]);
        if (deepRef) {
          resolvedValue = getVariableValueForMode(collections, deepRef, selectedModeId);
        }
      } else {
        resolvedValue = refVarModeValue;
      }
    }
  }

  let displayColor = '#888888';
  let displayValue = resolvedValue;

  // Format display value based on the variable's actual type
  if (variable.resolvedType === 'COLOR') {
    const rgb = parseColorToRgb(resolvedValue);
    displayColor = rgb ? rgbObjToHex(rgb) : '#888888';
    displayValue = isReference ? `{${referenceName}}` : displayColor.toUpperCase();
  } else if (variable.resolvedType === 'BOOLEAN') {
    displayValue = isReference && referenceName
      ? `{${referenceName}}`
      : resolvedValue;
  } else if (variable.resolvedType === 'STRING') {
    displayValue = isReference && referenceName
      ? `{${referenceName}}`
      : resolvedValue || '""';
  } else {
    // FLOAT or other numeric types
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
    value: modeValue,
    resolvedValue: variable.resolvedType === 'COLOR' ? displayColor : resolvedValue,
    resolvedType: variable.resolvedType as 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN',
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
    if (getManagedLane(group) !== null && group.sourceGroupName) {
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
    const aSource = a[1].find(g => getManagedLane(g) === 0) || a[1][0];
    const bSource = b[1].find(g => getManagedLane(g) === 0) || b[1][0];
    if (!aSource || !bSource) return 0;
    return sortGroupsByPosition(aSource, bSource);
  });

  // Layout: managed chains first as horizontal rows, then standalone groups by depth
  let nextBlockY = 0;
  const reserveGeneratorLane = sortedChains.length > 0;
  const laneBottoms = new Map<number, number>();

  // Layout managed chains - each chain on its own row
  sortedChains.forEach(([, chainGroups]) => {
    // Managed chains always occupy fixed lanes regardless of extra references.
    chainGroups.sort((a, b) => {
      const laneA = getManagedLane(a) ?? Number.MAX_SAFE_INTEGER;
      const laneB = getManagedLane(b) ?? Number.MAX_SAFE_INTEGER;
      if (laneA !== laneB) return laneA - laneB;
      return sortGroupsByPosition(a, b);
    });
    let rowHeight = 0;
    const rowLanes = new Set<number>();
    chainGroups.forEach(group => {
      const lane = getManagedLane(group) ?? 0;
      positions.set(group.key, { x: lane * columnStep, y: nextBlockY });
      rowLanes.add(lane);
      rowHeight = Math.max(rowHeight, getGroupHeight(group));
    });
    nextBlockY += rowHeight + gapY;
    rowLanes.forEach(lane => {
      laneBottoms.set(lane, nextBlockY);
    });
  });

  // Layout standalone groups by depth columns.
  // When shaders/steps are present, reserve column 1 for them and place
  // other dependent groups starting at column 2. Each column stacks
  // beneath items already occupying that same lane, not beneath the full graph.
  if (standaloneGroups.length > 0) {
    const standaloneColumns = new Map<number, GroupData[]>();
    standaloneGroups.forEach(group => {
      const depth = groupDepth.get(group.key) || 0;
      const lane = getStandaloneLane(depth, reserveGeneratorLane);
      const col = standaloneColumns.get(lane) || [];
      col.push(group);
      standaloneColumns.set(lane, col);
    });

    const sortedLanes = Array.from(standaloneColumns.keys()).sort((a, b) => a - b);

    sortedLanes.forEach((lane, compressedCol) => {
      const columnGroups = standaloneColumns.get(lane) || [];
      let nextColumnY = laneBottoms.get(lane) ?? 0;
      columnGroups.sort(sortGroupsByPosition).forEach(group => {
        const xLane = reserveGeneratorLane ? lane : compressedCol;
        positions.set(group.key, { x: xLane * columnStep, y: nextColumnY });
        nextColumnY += getGroupHeight(group) + gapY;
      });
      laneBottoms.set(lane, nextColumnY);
    });
  }

  return positions;
}

export {
  getDefaultVariableValue,
  normalizePathSegment,
  getGroupHeight,
  normalizeGridLayoutSettings,
  sortGroupsByPosition,
  getManagedLane,
  getStandaloneLane,
  extractShadeNumber,
  formatVariableNode,
  createShaderNode,
  createStepsNode,
  createPaletteNode,
  detectManagedNumberStepGroups,
  arrangeGroupsByConnectedBlocks,
};
