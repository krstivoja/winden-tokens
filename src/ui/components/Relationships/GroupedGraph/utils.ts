// Utility functions for GroupedGraph component

import { VariableData, CollectionData, ShadeGroupData } from '../../../types';
import { parseColorToRgb, rgbObjToHex } from '../../../utils/color';
import { getCollectionGroupKey, isVariableVisibleForGroupFilters } from '../../../utils/groupFilters';
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
  STANDARD_GROUP_HEADER_FILL,
  WRAPPER_HEADER_HEIGHT,
  WRAPPER_PADDING,
  WRAPPER_GAP,
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
  // An empty collection placeholder has no rows but still reserves one row's
  // worth of body, so its "No variables yet" line has somewhere to sit.
  const rows = Math.max(group.variables.length, 1);
  return HEADER_HEIGHT + rows * ROW_HEIGHT + GROUP_PADDING * 2;
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
  gapY: number,
  heightOverrides?: Map<string, number>
): Map<string, { x: number; y: number }> {
  const columnStep = GROUP_WIDTH + gapX;
  const positions = new Map<string, { x: number; y: number }>();
  const groupMap = new Map(groups.map(group => [group.key, group]));
  // Callers (e.g. Arrange treating a wrapper frame as one unit) can override
  // a pseudo-group's vertical footprint instead of deriving it from row count.
  const heightOf = (group: GroupData): number => heightOverrides?.get(group.key) ?? getGroupHeight(group);

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

  groups.slice().sort((a, b) => a.title.localeCompare(b.title)).forEach(group => {
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

  // Deterministic block order: by minimum group title, larger blocks first as tiebreak
  blocks.sort((a, b) => {
    const minTitleA = a.reduce((min, g) => (g.title < min ? g.title : min), a[0]?.title || '');
    const minTitleB = b.reduce((min, g) => (g.title < min ? g.title : min), b[0]?.title || '');
    if (minTitleA !== minTitleB) return minTitleA.localeCompare(minTitleB);
    return b.length - a.length;
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
      rowHeight = Math.max(rowHeight, heightOf(group));
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

    // Initial within-column order: by title (position-independent, deterministic)
    const laneOrder = new Map<number, string[]>();
    sortedLanes.forEach(lane => {
      const columnGroups = (standaloneColumns.get(lane) || [])
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title));
      laneOrder.set(lane, columnGroups.map(group => group.key));
    });

    // Barycenter sweeps: reduce edge crossings by reordering each column
    // according to the average index of its connected neighbors in the
    // adjacent (already-visited) column, sweeping left-to-right then
    // right-to-left. Groups without neighbors in that column keep their
    // relative order (stable sort on original index).
    const barycenterSweepCount = 4;
    for (let sweep = 0; sweep < barycenterSweepCount; sweep++) {
      const leftToRight = sweep % 2 === 0;
      const laneSequence = leftToRight ? sortedLanes : sortedLanes.slice().reverse();
      const neighborSets = leftToRight ? incoming : outgoing;

      laneSequence.forEach((lane, seqIndex) => {
        if (seqIndex === 0) return; // first column in this sweep direction stays fixed
        const adjacentLane = laneSequence[seqIndex - 1];
        const adjacentOrder = laneOrder.get(adjacentLane) || [];
        const adjacentIndex = new Map(adjacentOrder.map((key, index) => [key, index]));
        const currentOrder = laneOrder.get(lane) || [];

        const withBarycenter = currentOrder.map((key, originalIndex) => {
          const neighborKeys = Array.from(neighborSets.get(key) || []).filter(n => adjacentIndex.has(n));
          const barycenter = neighborKeys.length > 0
            ? neighborKeys.reduce((sum, n) => sum + (adjacentIndex.get(n) || 0), 0) / neighborKeys.length
            : originalIndex;
          return { key, barycenter, originalIndex };
        });

        withBarycenter.sort((a, b) => {
          if (a.barycenter !== b.barycenter) return a.barycenter - b.barycenter;
          return a.originalIndex - b.originalIndex;
        });

        laneOrder.set(lane, withBarycenter.map(item => item.key));
      });
    }

    sortedLanes.forEach((lane, compressedCol) => {
      const orderedKeys = laneOrder.get(lane) || [];
      let nextColumnY = laneBottoms.get(lane) ?? 0;
      orderedKeys.forEach(key => {
        const group = groupMap.get(key);
        if (!group) return;
        const xLane = reserveGeneratorLane ? lane : compressedCol;
        positions.set(group.key, { x: xLane * columnStep, y: nextColumnY });
        nextColumnY += heightOf(group) + gapY;
      });
      laneBottoms.set(lane, nextColumnY);
    });
  }

  return positions;
}

// ── Arrange units ──────────────────────────────────────────────────

// Shallowest (outermost) grouped ancestor of `path` — the top-level wrapper
// that ultimately contains it, even when wrappers are nested inside one
// another. Mirrors wrapperLayout.ts's path-prefix walk but stops at the
// FIRST match (ascending depth) instead of the deepest one, since Arrange
// treats a whole nested wrapper frame as a single movable unit.
function outermostGroupedAncestor(path: string, grouped: Set<string>): string | null {
  const parts = path.split('/');
  for (let depth = 1; depth < parts.length; depth++) {
    const prefix = parts.slice(0, depth).join('/');
    if (grouped.has(prefix)) return prefix;
  }
  return null;
}

/** Live geometry of a wrapper frame node, keyed by `wrapper:<path>`. */
export interface WrapperFrameGeometry {
  position: { x: number; y: number };
  measuredHeight?: number;
}

export interface ArrangeUnits {
  /** Visible units, the only ones that get a grid slot. */
  units: GroupData[];
  /** Units with nothing visible in them — parked rather than arranged. */
  hiddenUnits: GroupData[];
  /** Vertical footprint override per wrapper unit (visible and hidden). */
  heightOverrides: Map<string, number>;
  /** Card key → the unit it was folded into. */
  unitKeyByGroupKey: Map<string, string>;
  /** Card key → hidden by the current filters. */
  hiddenByKey: Map<string, boolean>;
}

/**
 * Fold cards into the units Arrange Grid actually moves, splitting them by
 * visibility.
 *
 * A wrapped card can't be arranged on its own — its coordinates are
 * parent-relative and the wrapper frame itself never moves otherwise — so
 * every card folds into its outermost wrapper's unit key and the whole frame
 * is arranged as one block. Only 'standard' cards can ever be wrapped
 * (buildWrapperLayout never nests managed source/shader/shades groups), so
 * those are left alone even if their sourceGroupName happens to share a
 * prefix with a grouped path.
 *
 * Visibility rules:
 * - A card hidden by the filters gets no slot; its empty slot is exactly the
 *   gap this split exists to remove.
 * - A wrapper unit is hidden only when EVERY member is hidden. One visible
 *   member means the frame is on screen and still needs a slot.
 * - A wrapper's height counts ALL its members, hidden ones included:
 *   buildWrapperLayout stacks members without consulting visibility, so a
 *   hidden member's space inside the frame stays reserved and the frame drawn
 *   on the canvas is that tall. Measuring only the visible members would
 *   under-size the unit and overlap whatever is placed after it.
 */
function buildArrangeUnits(
  groups: GroupData[],
  groupedPaths: Set<string>,
  filters: CardVisibilityFilters,
  wrapperFrames: Map<string, WrapperFrameGeometry>
): ArrangeUnits {
  const unitKeyForGroup = (group: GroupData): string => {
    if (group.kind !== 'standard') return group.key;
    const outermost = outermostGroupedAncestor(group.sourceGroupName || '', groupedPaths);
    return outermost ? `wrapper:${outermost}` : group.key;
  };

  const hiddenByKey = new Map<string, boolean>();
  const unitKeyByGroupKey = new Map<string, string>();
  // One pseudo GroupData per top-level unit. For a wrapper unit, reuse its
  // first member card and override key/title/position — only those plus the
  // height override matter to the arrange algorithm.
  const unitGroups = new Map<string, GroupData>();
  const unitHidden = new Map<string, boolean>();
  const wrapperMemberHeightSum = new Map<string, number>();

  groups.forEach(group => {
    const unitKey = unitKeyForGroup(group);
    const hidden = isCardHidden(group, filters);
    hiddenByKey.set(group.key, hidden);
    unitKeyByGroupKey.set(group.key, unitKey);
    unitHidden.set(unitKey, (unitHidden.get(unitKey) ?? true) && hidden);

    if (unitKey === group.key) {
      unitGroups.set(unitKey, group);
      return;
    }
    if (!unitGroups.has(unitKey)) {
      const frame = wrapperFrames.get(unitKey);
      unitGroups.set(unitKey, {
        ...group,
        key: unitKey,
        title: unitKey.slice('wrapper:'.length),
        x: frame?.position.x ?? group.x,
        y: frame?.position.y ?? group.y,
      });
    }
    wrapperMemberHeightSum.set(
      unitKey,
      (wrapperMemberHeightSum.get(unitKey) || 0) + getGroupHeight(group) + WRAPPER_GAP
    );
  });

  // Wrapper units use the measured frame height when xyflow has it; otherwise
  // fall back to summing member card heights + gaps, wrapped in the same
  // chrome buildWrapperLayout adds (header + top/bottom padding).
  const heightOverrides = new Map<string, number>();
  unitGroups.forEach((_group, unitKey) => {
    if (!unitKey.startsWith('wrapper:')) return;
    const measured = wrapperFrames.get(unitKey)?.measuredHeight;
    if (typeof measured === 'number' && measured > 0) {
      heightOverrides.set(unitKey, measured);
      return;
    }
    const memberSum = wrapperMemberHeightSum.get(unitKey) || 0;
    heightOverrides.set(
      unitKey,
      memberSum > 0
        ? memberSum - WRAPPER_GAP + WRAPPER_HEADER_HEIGHT + WRAPPER_PADDING * 2
        : WRAPPER_HEADER_HEIGHT + WRAPPER_PADDING * 2
    );
  });

  const units: GroupData[] = [];
  const hiddenUnits: GroupData[] = [];
  unitGroups.forEach((group, unitKey) => {
    (unitHidden.get(unitKey) ? hiddenUnits : units).push(group);
  });

  return { units, hiddenUnits, heightOverrides, unitKeyByGroupKey, hiddenByKey };
}

// ── Card visibility ────────────────────────────────────────────────

/**
 * Everything the card-visibility rule needs, passed in explicitly so the rule
 * itself stays a pure function outside React.
 */
interface CardVisibilityFilters {
  selectedCollections: Set<string>;
  selectedTypes: Set<string>;
  selectedGroups: Set<string>;
  variablesById: Map<string, VariableData>;
  // Cards that provide a token to the current Figma selection are force-shown
  // even when the filters above would hide them, so the selection's link is
  // never drawn to nothing. Omit for "filters only".
  selectionProviderGroupKeys?: Set<string>;
}

/**
 * Whether a card is hidden on the canvas right now.
 *
 * Single source of truth, deliberately: the layout effect uses it to set
 * `hidden` on the node, and Arrange Grid uses it to decide which cards get a
 * grid slot. A second copy of this rule would drift, and arrange would go back
 * to handing grid slots to invisible cards — which is exactly the empty-gap
 * bug this replaced.
 */
function isCardHidden(group: GroupData, filters: CardVisibilityFilters): boolean {
  // Force-show wins over every filter below.
  if (filters.selectionProviderGroupKeys?.has(group.key)) return false;
  if (!filters.selectedCollections.has(group.collectionId)) return true;
  // An empty collection's card has no variables to match against the type
  // or group filters — the collection filter above is the only one that
  // can meaningfully apply to it.
  if (group.kind === 'collection') return false;

  const hasMatchingType = group.variables.some(v => {
    if (v.isVirtual) return true;
    const sourceVar = filters.variablesById.get(v.id);
    return sourceVar && filters.selectedTypes.has(sourceVar.resolvedType);
  });
  if (!hasMatchingType) return true;

  let hasMatchingGroup = false;
  if (group.kind === 'shader' || group.kind === 'shades') {
    if (group.sourceGroupName) {
      hasMatchingGroup = filters.selectedGroups.has(
        getCollectionGroupKey(group.collectionId, group.sourceGroupName)
      );
    }
  } else {
    hasMatchingGroup = group.variables.some(v => {
      if (v.isVirtual) return false;
      return isVariableVisibleForGroupFilters(
        { collectionId: group.collectionId, name: v.name },
        filters.selectedGroups
      );
    });
  }
  return !hasMatchingGroup;
}

/**
 * Placeholder cards for collections that hold no variables at all.
 *
 * Every other card is derived from variables, so a brand-new, still-empty
 * collection renders nothing on the canvas and the user has no way to create
 * its first variable. One minimal card per empty collection fixes that; the
 * card is derived from the same variable list, so it stops being produced the
 * moment the collection has a variable and the real group cards take over.
 *
 * Deliberately keyed on "has zero variables in total" rather than "has no
 * visible variables": a collection whose variables are merely hidden by the
 * type/search filters already has real cards, and a placeholder beside them
 * would read as a duplicate.
 *
 * Cards are stacked downwards in column 0 starting at `startY`, ordered by
 * collection name so the layout is stable across reloads.
 */
function buildEmptyCollectionCards(
  collections: CollectionData[],
  variables: VariableData[],
  startY: number
): GroupData[] {
  const collectionsWithVariables = new Set(variables.map(variable => variable.collectionId));
  const empty = collections
    .filter(collection => !collectionsWithVariables.has(collection.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  let y = startY;
  return empty.map(collection => {
    const card: GroupData = {
      key: getCollectionCardKey(collection.id),
      title: collection.name,
      variables: [],
      x: 0, y: 0, initialX: 0, initialY: y,
      kind: 'collection',
      headerFill: STANDARD_GROUP_HEADER_FILL,
      collectionId: collection.id,
    };
    y += getGroupHeight(card) + GROUP_GAP_Y;
    return card;
  });
}

// Own key namespace, so an empty collection's card can never collide with a
// `group:` / `source:` / `shader:` / `shades:` / `ext-group:` card.
function getCollectionCardKey(collectionId: string): string {
  return `collection:${collectionId}`;
}

export type { CardVisibilityFilters };

export {
  buildEmptyCollectionCards,
  isCardHidden,
  buildArrangeUnits,
  outermostGroupedAncestor,
  getCollectionCardKey,
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
