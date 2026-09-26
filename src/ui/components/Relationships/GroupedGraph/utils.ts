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
  GridLayoutDraft,
  ConnectionRecord,
  TierPlacement,
} from './types';
import {
  HEADER_HEIGHT,
  ROW_HEIGHT,
  GROUP_PADDING,
  GROUP_GAP_X,
  GROUP_GAP_Y,
  GROUP_WIDTH,
  TIER_LABEL_NODE_PREFIX,
  WRAPPER_NODE_PREFIX,
  GROUP_NODE_PREFIX,
  GENERATED_CONNECTION_COLOR,
  STANDARD_GROUP_HEADER_FILL,
  WRAPPER_HEADER_HEIGHT,
  WRAPPER_PADDING,
  CARD_BOX_PADDING,
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
  // worth of body, so its empty-root line has somewhere to sit.
  const rows = Math.max(group.variables.length, 1);
  return HEADER_HEIGHT + rows * ROW_HEIGHT + GROUP_PADDING * 2;
}

/**
 * A card's ROWS without its header — the body a CONTAINER absorbs (part 4).
 *
 * Deliberately has no one-row floor, unlike getGroupHeight: a container with
 * no rows of its own simply has no body. The empty-root placeholder a
 * row-less collection CARD shows is noise inside a container that holds
 * children, so the container never renders it and never reserves its space.
 */
function getCardRowsHeight(group: GroupData | null | undefined): number {
  const count = group?.variables.length ?? 0;
  return count === 0 ? 0 : count * ROW_HEIGHT + GROUP_PADDING * 2;
}

function normalizeGridLayoutSettings(value: unknown): GridLayoutSettings {
  const candidate = (value && typeof value === 'object') ? value as Partial<GridLayoutSettings> : {};
  const gapX = typeof candidate.gapX === 'number' && candidate.gapX >= 0 ? candidate.gapX : GROUP_GAP_X;
  const gapY = typeof candidate.gapY === 'number' && candidate.gapY >= 0 ? candidate.gapY : GROUP_GAP_Y;
  // Settings persisted while the column cap existed also carry a
  // `maxColumnHeight`. Rebuilding the object field by field rather than
  // spreading `candidate` drops it: an old record loads as a valid
  // {gapX, gapY} and the dead key never reaches state, the draft or storage
  // (the next Apply writes the two-field shape back).
  return { gapX, gapY };
}

/** Settings → the string-backed draft the Grid Settings inputs edit. */
function toGridLayoutDraft(settings: GridLayoutSettings): GridLayoutDraft {
  return {
    gapX: String(settings.gapX),
    gapY: String(settings.gapY),
  };
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

/**
 * Extra inputs to Arrange Grid, named rather than positional: the two
 * connection lists would otherwise sit next to each other in the argument
 * tail with nothing but their position to tell them apart.
 */
interface ArrangeGridOptions {
  /** Vertical footprint override per unit, for wrapper frames. */
  heightOverrides?: Map<string, number>;
  /**
   * The FULL connection set — hidden endpoints included — used only to compute
   * each group's topological depth, i.e. which tier it belongs to.
   *
   * `connections` carries just the edges the user can actually see, because
   * packing must follow what is on screen. Depth must not: hiding the `_global`
   * collection would strip every incoming edge from `color/surface/*`, turn it
   * into a root, and collapse the whole graph into the first two columns.
   * A group keeps the tier it occupies in the real graph; only its PLACEMENT is
   * restricted to visible cards. Endpoints that are not in `groups` (hidden
   * units) take part in the depth walk and are never placed.
   *
   * Defaults to `connections`, so a caller that has only one list behaves as
   * it always did.
   */
  depthConnections?: ConnectionRecord[];
}

/** What Arrange Grid produces: where every unit goes, and where the tier
 *  caption above each column goes. */
interface ArrangeGridResult {
  positions: Map<string, { x: number; y: number }>;
  /** One entry per non-empty tier, left to right. Empty when nothing was
   *  arranged. Never contains an entry for a parked (hidden) unit — parking
   *  happens in the caller, after this returns. */
  tiers: TierPlacement[];
}

function arrangeGroupsByConnectedBlocks(
  groups: GroupData[],
  connections: ConnectionRecord[],
  gapX: number,
  gapY: number,
  options: ArrangeGridOptions = {}
): ArrangeGridResult {
  const { heightOverrides, depthConnections } = options;
  // One lane == one tier == one column, so this is both the tier-to-tier step
  // and the full caption pitch.
  const columnStep = GROUP_WIDTH + gapX;
  const positions = new Map<string, { x: number; y: number }>();
  const groupMap = new Map(groups.map(group => [group.key, group]));
  // Callers (e.g. Arrange treating a wrapper frame as one unit) can override
  // a pseudo-group's vertical footprint instead of deriving it from row count.
  const heightOf = (group: GroupData): number => heightOverrides?.get(group.key) ?? getGroupHeight(group);

  // Directed graph over the VISIBLE groups only: fromGroup → toGroup
  // (a connection flows left to right). Drives the barycenter sweeps, which
  // order cards against the neighbours actually drawn beside them.
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

  // ── Topological depth over the FULL graph ────────────────────────
  // Node set = every visible group PLUS every endpoint of a connection that
  // has an end off screen, so a hidden provider still pushes its consumers
  // into the tier they belong to.
  const depthEdges = depthConnections ?? connections;
  const depthOutgoing = new Map<string, Set<string>>();
  const depthIncoming = new Map<string, Set<string>>();
  const ensureDepthNode = (key: string) => {
    if (!depthOutgoing.has(key)) depthOutgoing.set(key, new Set());
    if (!depthIncoming.has(key)) depthIncoming.set(key, new Set());
  };
  groups.forEach(group => ensureDepthNode(group.key));
  depthEdges.forEach(conn => {
    if (conn.fromGroup === conn.toGroup) return;
    ensureDepthNode(conn.fromGroup);
    ensureDepthNode(conn.toGroup);
    depthOutgoing.get(conn.fromGroup)?.add(conn.toGroup);
    depthIncoming.get(conn.toGroup)?.add(conn.fromGroup);
  });

  const depthNodes = Array.from(depthOutgoing.keys());
  const groupDepth = new Map<string, number>();
  const indegreeCount = new Map<string, number>();
  depthNodes.forEach(key => {
    groupDepth.set(key, 0);
    indegreeCount.set(key, depthIncoming.get(key)?.size || 0);
  });

  // Kahn's algorithm, taking the longest path to each node.
  const queue = depthNodes.filter(key => (indegreeCount.get(key) || 0) === 0);
  const processed = new Set<string>();

  while (queue.length > 0) {
    queue.sort((a, b) => {
      const gA = groupMap.get(a);
      const gB = groupMap.get(b);
      if (!gA || !gB) return a.localeCompare(b);
      return sortGroupsByPosition(gA, gB);
    });
    const currentKey = queue.shift();
    if (!currentKey || processed.has(currentKey)) continue;
    processed.add(currentKey);
    const currentDepth = groupDepth.get(currentKey) || 0;

    depthOutgoing.get(currentKey)?.forEach(nextKey => {
      groupDepth.set(nextKey, Math.max(groupDepth.get(nextKey) || 0, currentDepth + 1));
      indegreeCount.set(nextKey, (indegreeCount.get(nextKey) || 0) - 1);
      if ((indegreeCount.get(nextKey) || 0) === 0) queue.push(nextKey);
    });
  }

  // Handle cycles: assign remaining nodes a fallback depth
  if (processed.size !== depthNodes.length) {
    const maxProcessedDepth = processed.size > 0
      ? Math.max(...Array.from(processed).map(key => groupDepth.get(key) || 0))
      : -1;
    depthNodes.forEach(key => {
      if (!processed.has(key)) groupDepth.set(key, maxProcessedDepth + 1);
    });
  }

  // Identify managed chains: groups linked by sourceGroupName (source → shader → shades)
  // Each chain is laid out as a horizontal row with aligned Y positions
  const groupToChain = new Map<string, string>(); // group.key → sourceGroupName
  groups.forEach(group => {
    if (getManagedLane(group) !== null && group.sourceGroupName) {
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

  // ── Pass 1: vertical placement ───────────────────────────────────
  // X is deferred to pass 2, because a lane's column index depends on how many
  // lanes to its left survive the empty-lane collapse.

  // Managed chains first — each chain is one horizontal row across its fixed
  // lanes, so its cards share a Y.
  const chainPlacements: { key: string; lane: number; y: number }[] = [];
  let nextBlockY = 0;
  const reserveGeneratorLane = sortedChains.length > 0;
  const laneBottoms = new Map<number, number>();
  const chainLanes = new Set<number>();

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
      chainPlacements.push({ key: group.key, lane, y: nextBlockY });
      rowLanes.add(lane);
      chainLanes.add(lane);
      rowHeight = Math.max(rowHeight, heightOf(group));
    });
    nextBlockY += rowHeight + gapY;
    rowLanes.forEach(lane => {
      laneBottoms.set(lane, nextBlockY);
    });
  });

  // Standalone groups by depth lane. When shaders/steps are present, lane 1 is
  // reserved for them and other dependent groups start at lane 2. Each lane
  // stacks beneath whatever already occupies that same lane, not beneath the
  // full graph.
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

  // ── Pass 2: lane → left edge ─────────────────────────────────────
  // Lanes with nothing visible in them collapse: the remaining lanes renumber
  // contiguously in their original order, so hiding a whole tier leaves no
  // horizontal void. Every surviving lane is exactly one card wide, so the
  // lanes step by the uniform `columnStep` and each caption is one card wide.
  const usedLanes = Array.from(new Set([...chainLanes, ...sortedLanes])).sort((a, b) => a - b);
  const laneStartX = new Map<number, number>();
  const tiers: TierPlacement[] = [];
  usedLanes.forEach((lane, index) => {
    const x = index * columnStep;
    laneStartX.set(lane, x);
    tiers.push({ tier: index + 1, x, width: GROUP_WIDTH });
  });

  // ── Pass 3: emit positions ───────────────────────────────────────
  chainPlacements.forEach(placement => {
    positions.set(placement.key, {
      x: laneStartX.get(placement.lane) ?? 0,
      y: placement.y,
    });
  });

  sortedLanes.forEach(lane => {
    const startX = laneStartX.get(lane) ?? 0;
    let nextY = laneBottoms.get(lane) ?? 0;

    (laneOrder.get(lane) || []).forEach(key => {
      const group = groupMap.get(key);
      if (!group) return;
      positions.set(group.key, { x: startX, y: nextY });
      nextY += heightOf(group) + gapY;
    });

    laneBottoms.set(lane, nextY);
  });

  return { positions, tiers };
}

/** Whether an xyflow node id belongs to a tier caption rather than a card. */
function isTierLabelNodeId(id: string): boolean {
  return id.startsWith(TIER_LABEL_NODE_PREFIX);
}

// ── Arrange units ──────────────────────────────────────────────────

// ── Wrapper frame keys ─────────────────────────────────────────────

/**
 * A wrapper frame's key: `<collectionId>::<path>`, where the EMPTY path means
 * the collection itself.
 *
 * A bare path is not an identity. A frame named `test` used to gather `test*`
 * cards from every collection, and a top-level card like `test` had no parent
 * at all to level up into — the collection, its obvious parent, was simply
 * not part of the key space. `::` is the separator already used by
 * `getCollectionGroupKey` for group filters: collection ids contain `:` but
 * never `::`, so the first `::` always separates the two halves.
 */
function getWrapperKey(collectionId: string, path: string): string {
  return `${collectionId}::${path}`;
}

/** Inverse of `getWrapperKey`; null for a bare (pre-3a) path. */
function parseWrapperKey(key: string): { collectionId: string; path: string } | null {
  const index = key.indexOf('::');
  if (index < 0) return null;
  return { collectionId: key.slice(0, index), path: key.slice(index + 2) };
}

// Shallowest (outermost) grouped ancestor of `(collectionId, path)` — the
// top-level wrapper that ultimately contains it, even when wrappers are
// nested inside one another. Mirrors wrapperLayout.ts's path-prefix walk but
// stops at the FIRST match (ascending depth) instead of the deepest one,
// since Arrange treats a whole nested wrapper frame as a single movable unit.
//
// Depth 0 is the collection's own frame, which contains every card of that
// collection — including the collection ROOT card, whose path is empty and
// which belongs to no other frame. `path` itself also counts as a match: the
// card for path `p` lives INSIDE the frame named `p`, it is not a sibling of
// it. Only the wrapper→parent walk in wrapperLayout.ts stays strict, so a
// frame can never parent itself.
//
// Returns the wrapper KEY (`<collectionId>::<path>`), not a bare path.
function outermostGroupedAncestor(
  collectionId: string,
  path: string,
  grouped: Set<string>
): string | null {
  const parts = path ? path.split('/') : [];
  for (let depth = 0; depth <= parts.length; depth++) {
    const key = getWrapperKey(collectionId, parts.slice(0, depth).join('/'));
    if (grouped.has(key)) return key;
  }
  return null;
}

// ── Part 4: the card IS the container ──────────────────────────────

/**
 * Whether this card is ABSORBED by a container — i.e. a wrapper frame exists
 * at the card's own (collection, path), so that frame draws the card's header,
 * rows and header actions and the card is not emitted as a node of its own.
 *
 * A group is one thing, not two: before part 4 a grouped path produced a
 * `groupWrapper` frame with its own dashed chrome and header AND a `groupNode`
 * card with the same name and a second header inside it.
 *
 * A collection ROOT card's own path is the empty one, so its container is the
 * collection's frame `<cid>::` — which is exactly why the empty path is part
 * of the wrapper key space (3a).
 */
function isAbsorbedCard(group: GroupData, groupedPaths: Set<string>): boolean {
  // Only the cards buildWrapperLayout lays out can ever be absorbed; managed
  // source/shader/shades cards are never nested.
  if (group.kind !== 'standard' && group.kind !== 'collection') return false;
  return groupedPaths.has(getWrapperKey(group.collectionId, group.sourceGroupName || ''));
}

/**
 * The xyflow node id that actually DRAWS this card: its own key, or the
 * container node that absorbed it.
 *
 * Edges are built from connection records that name CARD keys, so every edge
 * endpoint has to go through here or an absorbed card's edges would point at
 * a node id that no longer exists and xyflow would silently drop them.
 */
function getCardNodeId(group: GroupData, groupedPaths: Set<string>): string {
  return isAbsorbedCard(group, groupedPaths)
    ? `${WRAPPER_NODE_PREFIX}${getWrapperKey(group.collectionId, group.sourceGroupName || '')}`
    : group.key;
}

// ── 3a migration: bare wrapper paths → collection-scoped keys ──────

/**
 * Bare group path → the collections that own it, in the order `collections`
 * was given.
 *
 * Two senses of "own", because the two key spaces being migrated mean
 * different things by a bare path:
 *
 * - Default (a WRAPPER frame, 3a): a collection owns path `p` when one of its
 *   variables sits at that group path **or below it** — exactly when the old,
 *   collection-blind frame named `p` really did draw a card from that
 *   collection.
 * - `exactPathOnly` (a CARD, 3b): only the variable's own parent path counts.
 *   A card is one leaf group, so a collection whose only variable is
 *   `test/test2/leaf` has a card at `test/test2` and NONE at `test` — it must
 *   not be offered the position of the old `group:test` card.
 *
 * Loose (slash-less) variables contribute nothing in either sense: they have
 * no group path, and since part 1 they live on their collection's root card.
 */
function buildWrapperPathOwners(
  collections: Array<Pick<CollectionData, 'id'>>,
  variables: Array<Pick<VariableData, 'collectionId' | 'name'>>,
  options: { exactPathOnly?: boolean } = {}
): Map<string, string[]> {
  const order = new Map(collections.map((collection, index) => [collection.id, index]));
  const byPath = new Map<string, Set<string>>();

  variables.forEach(variable => {
    if (!order.has(variable.collectionId)) return;
    const parts = variable.name.split('/');
    // `parts.length - 1`: the last segment is the variable's own name, not a
    // group path. A slash-less variable therefore contributes nothing.
    const maxDepth = parts.length - 1;
    // `Math.max(…, 1)` keeps a loose variable (maxDepth 0) out: depth 0 is the
    // EMPTY path, which is the collection root, not a group.
    const minDepth = options.exactPathOnly ? Math.max(maxDepth, 1) : 1;
    for (let depth = minDepth; depth <= maxDepth; depth++) {
      const prefix = parts.slice(0, depth).join('/');
      let owners = byPath.get(prefix);
      if (!owners) {
        owners = new Set<string>();
        byPath.set(prefix, owners);
      }
      owners.add(variable.collectionId);
    }
  });

  const result = new Map<string, string[]>();
  byPath.forEach((owners, path) => {
    result.set(path, Array.from(owners).sort((a, b) => order.get(a)! - order.get(b)!));
  });
  return result;
}

/**
 * Rewrite the persisted `graph-grouped-paths` record to collection-scoped
 * wrapper keys.
 *
 * A bare path becomes one entry per collection that owns it — a path two
 * collections both used becomes TWO frames, which is honest: the single old
 * frame really did contain cards from both. A path no collection owns any
 * more is dropped, not kept.
 *
 * Idempotent with no version flag: an entry that already contains `::` is
 * collection-scoped by construction and passes through untouched, so running
 * this twice is a no-op.
 */
function migrateGroupedPaths(stored: unknown, owners: Map<string, string[]>): string[] {
  if (!Array.isArray(stored)) return [];
  const out = new Set<string>();
  stored.forEach(entry => {
    if (typeof entry !== 'string' || !entry) return;
    if (entry.includes('::')) {
      out.add(entry);
      return;
    }
    (owners.get(entry) || []).forEach(collectionId => out.add(getWrapperKey(collectionId, entry)));
  });
  return Array.from(out);
}

/**
 * Rewrite the persisted `graph-positions` record's bare-path keys the same
 * way: wrapper frames (`wrapper:<path>`, 3a) and group CARDS
 * (`group:<name>`, 3b), each also in its dragged-nested `rel:` form.
 *
 * Unlike the grouped paths, a position cannot be duplicated: two frames (or
 * two cards) on one coordinate is worse than one arranged one. An ambiguous
 * path keeps its FIRST owner (collection order) — that is the single card the
 * old collection-blind key really addressed — and the rest are dropped, which
 * is honest: they are genuinely new cards and Arrange will place them.
 *
 * `cardOwners` is the EXACT-path ownership map (see `buildWrapperPathOwners`)
 * because a card is one leaf group, while `owners` is the at-or-below map a
 * frame needs. Everything else — `collection:` (already carries the id),
 * `source:`/`shader:`/`shades:`/`steps:`/`selection:` (keyed by variable or
 * node id) and `ext-group:` (a published library token has no local
 * collection to scope to) — passes through untouched.
 */
function migrateGraphPositions(
  stored: unknown,
  owners: Map<string, string[]>,
  cardOwners: Map<string, string[]>
): Record<string, { x: number; y: number }> {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {};
  const source = stored as Record<string, { x: number; y: number }>;
  const out: Record<string, { x: number; y: number }> = {};
  const migrated: Array<[string, { x: number; y: number }]> = [];

  Object.entries(source).forEach(([key, value]) => {
    const relPrefix = key.startsWith('rel:') ? 'rel:' : '';
    const inner = key.slice(relPrefix.length);
    // `ext-group:` does NOT match `group:` — it is a different prefix, and
    // deliberately left unscoped.
    const prefix = inner.startsWith(WRAPPER_NODE_PREFIX)
      ? WRAPPER_NODE_PREFIX
      : inner.startsWith(GROUP_NODE_PREFIX) ? GROUP_NODE_PREFIX : null;
    if (!prefix) {
      out[key] = value;
      return;
    }
    const path = inner.slice(prefix.length);
    if (path.includes('::')) {
      // Already collection-scoped — idempotence, with no version flag: a key
      // without `::` is old by construction.
      out[key] = value;
      return;
    }
    const lookup = prefix === WRAPPER_NODE_PREFIX ? owners : cardOwners;
    const first = (lookup.get(path) || [])[0];
    if (!first) return; // unresolvable: dropped, not kept
    migrated.push([
      `${relPrefix}${prefix}${getWrapperKey(first, path)}`,
      value,
    ]);
  });

  // Pass-through keys win over a migrated one landing on the same key, so a
  // half-migrated record never loses the already-correct entry.
  migrated.forEach(([key, value]) => {
    if (!(key in out)) out[key] = value;
  });
  return out;
}

/** Live geometry of a wrapper frame node, keyed by `wrapper:<collectionId>::<path>`. */
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
    // Exactly the cards buildWrapperLayout lays out (see isStandardLayoutCard
    // in GroupedGraph.tsx). A collection ROOT card is wrappable too now: it
    // sits inside its collection's own frame, so Arrange has to fold it into
    // that unit or it would try to move a parent-relative node absolutely.
    if (group.kind !== 'standard' && group.kind !== 'collection') return group.key;
    const outermost = outermostGroupedAncestor(
      group.collectionId,
      group.sourceGroupName || '',
      groupedPaths
    );
    return outermost ? `${WRAPPER_NODE_PREFIX}${outermost}` : group.key;
  };

  const hiddenByKey = new Map<string, boolean>();
  const unitKeyByGroupKey = new Map<string, string>();
  // One pseudo GroupData per top-level unit. For a wrapper unit, reuse its
  // first member card and override key/title/position — only those plus the
  // height override matter to the arrange algorithm.
  const unitGroups = new Map<string, GroupData>();
  const unitHidden = new Map<string, boolean>();
  // Fallback footprint for a wrapper unit, split the way buildWrapperLayout
  // stacks it: absorbed cards contribute only their ROWS to the container's
  // own body, every other member is a card stacked below with a gap.
  const wrapperStackHeight = new Map<string, number>();
  const wrapperOwnRowsHeight = new Map<string, number>();

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
      const parsed = parseWrapperKey(unitKey.slice(WRAPPER_NODE_PREFIX.length));
      unitGroups.set(unitKey, {
        ...group,
        key: unitKey,
        // The bare path reads as the frame's name; the collection frame has
        // no path, so it falls back to the collection it wraps.
        title: parsed ? (parsed.path || parsed.collectionId) : unitKey.slice(WRAPPER_NODE_PREFIX.length),
        x: frame?.position.x ?? group.x,
        y: frame?.position.y ?? group.y,
      });
    }
    if (isAbsorbedCard(group, groupedPaths)) {
      wrapperOwnRowsHeight.set(
        unitKey,
        (wrapperOwnRowsHeight.get(unitKey) || 0) + getCardRowsHeight(group)
      );
    } else {
      wrapperStackHeight.set(
        unitKey,
        (wrapperStackHeight.get(unitKey) || 0) + getGroupHeight(group) + WRAPPER_GAP
      );
    }
  });

  // Wrapper units use the measured frame height when xyflow has it — which it
  // does from the first paint onwards, since buildWrapperLayout sets the
  // frame's exact height as its node style. The sum below is only the
  // first-pass estimate, before anything has been measured.
  //
  // It stays a flat sum over the unit's members rather than a second copy of
  // buildWrapperLayout's recursion: a unit is the OUTERMOST frame, so a
  // nested frame's own header and padding are not counted. That imprecision
  // predates part 4 and is corrected by the very next measured pass; a real
  // recursion here would mean importing buildWrapperLayout into utils.ts,
  // which wrapperLayout.ts already imports from.
  const heightOverrides = new Map<string, number>();
  unitGroups.forEach((_group, unitKey) => {
    if (!unitKey.startsWith(WRAPPER_NODE_PREFIX)) return;
    const measured = wrapperFrames.get(unitKey)?.measuredHeight;
    if (typeof measured === 'number' && measured > 0) {
      heightOverrides.set(unitKey, measured);
      return;
    }
    const stack = wrapperStackHeight.get(unitKey) || 0;
    const ownRows = wrapperOwnRowsHeight.get(unitKey) || 0;
    // Mirrors sizeUnit in wrapperLayout.ts: header, then the absorbed rows,
    // then the stacked children inside the frame's padding. With no children
    // the container is exactly a card's box; with nothing at all it keeps the
    // empty frame's minimum.
    const below = stack > 0
      ? stack - WRAPPER_GAP + WRAPPER_PADDING * 2
      : (ownRows > 0 ? 0 : WRAPPER_PADDING * 2);
    // `CARD_BOX_PADDING * 2`: the container carries the card box's own inner
    // gutter (`p-0.5`) top and bottom, exactly as sizeUnit does — otherwise
    // this estimate and the measured frame disagree by 4px on the first pass.
    heightOverrides.set(
      unitKey,
      CARD_BOX_PADDING * 2 + WRAPPER_HEADER_HEIGHT + ownRows + below
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
  // A collection root card with no loose variables has nothing to match
  // against the type or group filters — the collection filter above is the
  // only one that can meaningfully apply to it, and an empty `.some()` below
  // would otherwise park the collection's own root (and its "+") off screen.
  // With rows it is an ordinary card and takes the ordinary rules, so a
  // loose variable still disappears when its type is filtered out.
  if (group.kind === 'collection' && group.variables.length === 0) return false;

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

/** One card's worth of unmanaged variables: the rows, and who owns them. */
interface UnmanagedGroupBucket {
  nodes: VariableNode[];
  collectionId: string;
  groupName: string;
}

/**
 * Bucket the unmanaged variables into the cards they will become.
 *
 * Keyed `<collectionId>::<groupName>` — the collection is part of the
 * identity, not decoration. Keyed by group name alone, two collections that
 * both own `color/brand` fell into ONE bucket whose `collectionId` was
 * whichever variable happened to arrive first, so they rendered as a single
 * card attributed to the wrong collection half the time. The merge happens
 * HERE, before any card key is built, which is why re-keying the card alone
 * could never have separated them.
 *
 * Loose (slash-less) variables are returned separately: they have no parent
 * path and belong to their collection's root card (part 1), not to a
 * synthetic group named after themselves.
 *
 * `toNode` is the caller's row formatter — kept as a callback so this stays a
 * pure grouping rule with no opinion about how a row is rendered.
 */
function bucketUnmanagedVariables<T extends Pick<VariableData, 'collectionId' | 'name'>>(
  variables: T[],
  toNode: (variable: T) => VariableNode
): { groups: Map<string, UnmanagedGroupBucket>; loose: Map<string, VariableNode[]> } {
  const groups = new Map<string, UnmanagedGroupBucket>();
  const loose = new Map<string, VariableNode[]>();

  variables.forEach(variable => {
    // Cards are leaf groups (one per parent path) — wrappers group cards
    // visually without merging their variables.
    const parts = variable.name.split('/');
    const node = toNode(variable);
    if (parts.length === 1) {
      const existing = loose.get(variable.collectionId) || [];
      existing.push(node);
      loose.set(variable.collectionId, existing);
      return;
    }
    const groupName = parts.slice(0, -1).join('/');
    const bucketKey = getWrapperKey(variable.collectionId, groupName);
    const existing = groups.get(bucketKey)
      || { nodes: [], collectionId: variable.collectionId, groupName };
    existing.nodes.push(node);
    groups.set(bucketKey, existing);
  });

  return { groups, loose };
}

/**
 * The root card of every variable collection — one per collection, always.
 *
 * A collection's root is a real place: it is where a variable with no `/` in
 * its name lives, and it is the only "+" that can create one. Deriving the
 * card from the variables instead (emit it only when the collection is empty,
 * or only when it happens to hold a slash-less variable) leaves a collection
 * whose variables are all grouped with no root card and therefore no way back
 * to the root — which is the gap this card exists to close. So it is
 * unconditional, and a collection with no loose variables simply gets a card
 * with no rows.
 *
 * Rows are the collection's loose (slash-less) variables. They used to be
 * bucketed into a synthetic `group:<variableName>` card, which collided with
 * the real group of the same name: variable `test` and the parent path of
 * `test/test2` produced one key and merged into one card.
 *
 * Cards are stacked downwards in column 0 starting at `startY`, ordered by
 * collection name so the layout is stable across reloads.
 */
function buildCollectionCards(
  collections: CollectionData[],
  looseVariablesByCollection: Map<string, VariableNode[]>,
  startY: number
): GroupData[] {
  const ordered = [...collections].sort((a, b) => a.name.localeCompare(b.name));

  let y = startY;
  return ordered.map(collection => {
    const card: GroupData = {
      key: getCollectionCardKey(collection.id),
      title: collection.name,
      variables: looseVariablesByCollection.get(collection.id) || [],
      x: 0, y: 0, initialX: 0, initialY: y,
      kind: 'collection',
      headerFill: STANDARD_GROUP_HEADER_FILL,
      collectionId: collection.id,
    };
    y += getGroupHeight(card) + GROUP_GAP_Y;
    return card;
  });
}

// Own key namespace, so a collection's root card can never collide with a
// `group:` / `source:` / `shader:` / `shades:` / `ext-group:` card.
function getCollectionCardKey(collectionId: string): string {
  return `collection:${collectionId}`;
}

/**
 * A standard group card's key: `group:<collectionId>::<groupName>`.
 *
 * The group name alone is not an identity. Two collections that both own
 * `color/brand` used to produce ONE card, attributed to whichever collection
 * the first matching variable happened to belong to. Same `::` convention as
 * `getWrapperKey` and `getCollectionGroupKey`: collection ids contain `:` but
 * never `::`, so the FIRST `::` always separates the two halves.
 *
 * Mirrored by SidebarFilter, which addresses a card by key to highlight it —
 * both call this, so the two can no longer drift.
 */
function getGroupCardKey(collectionId: string, groupName: string): string {
  return `${GROUP_NODE_PREFIX}${getWrapperKey(collectionId, groupName)}`;
}

export type { CardVisibilityFilters, ArrangeGridOptions, ArrangeGridResult, UnmanagedGroupBucket };

export {
  buildCollectionCards,
  bucketUnmanagedVariables,
  isCardHidden,
  buildArrangeUnits,
  outermostGroupedAncestor,
  isAbsorbedCard,
  getCardNodeId,
  getWrapperKey,
  parseWrapperKey,
  buildWrapperPathOwners,
  migrateGroupedPaths,
  migrateGraphPositions,
  getCollectionCardKey,
  getGroupCardKey,
  getDefaultVariableValue,
  normalizePathSegment,
  getGroupHeight,
  getCardRowsHeight,
  normalizeGridLayoutSettings,
  toGridLayoutDraft,
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
  isTierLabelNodeId,
};
