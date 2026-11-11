// Grouped graph component - @xyflow/react based relationships view

import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useUpdateNodeInternals,
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  SelectionMode,
} from '@xyflow/react';
import type {
  Node,
  Edge,
  NodeTypes,
  EdgeTypes,
  OnConnect,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CollectionData, InspectorBindingTarget, ShadeGroupData, VariableData } from '../../types';
import { resolveModeIdForCollection } from '../../utils/modes';
import { getCollectionGroupKey, getGroupKeysByCollection, getVariableGroupName } from '../../utils/groupFilters';
import { post } from '../../hooks/usePluginMessages';
import { useAppContext } from '../../context/AppContext';
import { useModalContext } from '../Modals/ModalContext';
import { ColorValueMenu } from '../Table/ColorValueMenu';
import { SidebarFilter } from '../Table/SidebarFilter';
import { Icon } from '../icons/Icon';
import { IconButton } from '../common/Button/IconButton/IconButton';
import { TextButton } from '../common/Button/Button';
import { Dropdown } from '../common/Dropdown/Dropdown';
import { Input } from '../common/Input/Input';
import { SegmentedControl } from '../common/SegmentedControl/SegmentedControl';

// Import from extracted files
import {
  CustomEdgeData,
  GroupData,
  VariableNode,
  ConnectionRecord,
  ConnectionFlags,
  GridLayoutSettings,
  GridLayoutDraft,
  GraphSortBy,
  TierPlacement,
  TierLabelNodeData,
  CollectionHeaderPlacement,
  GroupNodeData,
  WrapperNodeData,
} from './GroupedGraph/types';
import {
  GROUP_WIDTH,
  GROUP_GAP_X,
  GROUP_GAP_Y,
  DEFAULT_GROUP_CHILD_NAME,
  GENERATED_CONNECTION_COLOR,
  REFERENCE_CONNECTION_COLOR,
  IDLE_HANDLE_BORDER_COLOR,
  IDLE_HANDLE_FILL_COLOR,
  STANDARD_GROUP_HEADER_FILL,
  SHADER_GROUP_HEADER_FILL,
  TIER_LABEL_HEIGHT,
  TIER_LABEL_GAP_Y,
  TIER_LABEL_NODE_PREFIX,
  WRAPPER_NODE_PREFIX,
} from './GroupedGraph/constants';
import { GroupNodeComponent } from './GroupedGraph/GraphNode';
import { GroupWrapperComponent } from './GroupedGraph/GraphWrapperNode';
import { TierLabelNode } from './GroupedGraph/TierLabelNode';
import { PropertyNodeComponent, PropertyNodeData, getPropertyHandleId } from './GroupedGraph/PropertyNode';
import { flattenLayers } from './GroupedGraph/propertyLayers';
import { buildWrapperLayout } from './GroupedGraph/wrapperLayout';
import { boxesToStore, getNodeOverlapBoxes, resolveNodeDrop, resolveNodeOverlaps } from './GroupedGraph/resolveOverlaps';
import {
  buildCollectionColumnItems,
  layoutCollectionColumns,
  lockChangesToColumns,
  resolveColumnPositions,
} from './GroupedGraph/columnLayout';
import { takeArrangeSnapshot, restoreArrangeSnapshot } from './GroupedGraph/arrangeUndo';
import type { ArrangeUndoSnapshot } from './GroupedGraph/arrangeUndo';
import { CustomEdge } from './GroupedGraph/GraphEdge';
import { GraphSearchPalette, isQuickSearchShortcut } from './GroupedGraph/GraphSearchPalette';
import type { GraphSearchItem, GraphSearchTarget } from './GroupedGraph/GraphSearchPalette';
import {
  getDefaultVariableValue,
  normalizePathSegment,
  getGroupHeight,
  getCardHeightForRows,
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
  buildCollectionCards,
  isCardHidden,
  buildArrangeUnits,
  remapConnectionsToUnits,
  isTierLabelNodeId,
  isCollectionHeader,
  getWrapperKey,
  parseWrapperKey,
  getGroupCardKey,
  bucketUnmanagedVariables,
  buildWrapperPathOwners,
  migrateGroupedPaths,
  migrateGraphPositions,
  addFrame,
  flattenGroupedPaths,
  stripRelPositions,
  isAbsorbedCard,
  reconcileNodes,
  reconcileEdges,
} from './GroupedGraph/utils';
import type { CardVisibilityFilters, WrapperFrameGeometry } from './GroupedGraph/utils';
import {
  computeHighlightPathForKeys,
  isSingleTarget,
  getHidingPath,
  isCardHiddenByHideUnused,
  isEdgeOffPath,
  isTierLabelHidden,
  planSidebarUncheck,
  applySidebarUncheck,
  getHideUnusedGroupKeys,
  releaseCollectionsFromOwn,
  pruneOwnToExisting,
  extendHidingLayout,
  getActiveHidingLayout,
  mergeHidingPositions,
  collectionToggleEndsHiding,
} from './GroupedGraph/hideUnused';
import type { HidingLayout, HighlightTarget, SidebarSelection } from './GroupedGraph/hideUnused';
import {
  collectFocusableRowKeys,
  selectCollectionHeaderNodeId,
  selectFirstCollectionNodeId,
  selectFocusScope,
} from './GroupedGraph/sidebarFocus';

// ── Node & Edge type registrations ─────────────────────────────────

const nodeTypes: NodeTypes = {
  groupNode: GroupNodeComponent,
  groupWrapper: GroupWrapperComponent,
  propertyNode: PropertyNodeComponent,
  tierLabel: TierLabelNode,
};

// Every arranged tier's cards start at y = 0, so the captions form one row
// just above that.
const TIER_LABEL_Y = -(TIER_LABEL_HEIGHT + TIER_LABEL_GAP_Y);

const PROPERTY_COLUMN_GAP = 220;

/** Node id of a caption: `tier-label:<n>` for a tier, and
 *  `tier-label:collection:<collectionId>` for a Collection-mode column
 *  header — one namespace, so everything that ignores captions ignores both. */
const getTierLabelNodeId = (label: TierLabelNodeData) => (
  isCollectionHeader(label)
    ? `${TIER_LABEL_NODE_PREFIX}collection:${label.collectionId}`
    : `${TIER_LABEL_NODE_PREFIX}${label.tier}`
);

type PositionRecord = Record<string, { x: number; y: number }>;

// The selection card's xyflow id is derived from the selected Figma node id so
// that switching elements mounts a *fresh* node. xyflow caches handle geometry
// per node id; reusing one static id across selections leaves stale handle
// bounds, and edges whose target handle can't be located are silently dropped
// (the row's handle still shows, but no connecting line is drawn).
const getSelectionNodeId = (figmaNodeId: string) => `selection:${figmaNodeId}`;

/** Tier captions read back out of client storage, which is untyped.
 *  Captions persisted while tiers could wrap also carry a `columns` count;
 *  rebuilding each entry from its three live fields drops it rather than
 *  passing a dead key through to the node's `data`. Their `x`/`width` are
 *  kept as stored, because they match the card positions stored alongside
 *  them — the next Arrange rewrites both together. */
const normalizeTierLabels = (value: unknown): TierPlacement[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is TierPlacement => (
      !!entry && typeof entry === 'object'
      && typeof (entry as TierPlacement).tier === 'number'
      && typeof (entry as TierPlacement).x === 'number'
      && typeof (entry as TierPlacement).width === 'number'
    ))
    .map(({ tier, x, width }) => ({ tier, x, width }));
};

const SORT_BY_OPTIONS: Array<{ value: GraphSortBy; label: string }> = [
  { value: 'tier', label: 'Tier' },
  { value: 'collection', label: 'Collection' },
];

/** Drop label node ids from a saved positions record; the SAME object when there are none. */
const stripLabelPositions = <T,>(positions: Record<string, T>): Record<string, T> => {
  const isLabel = (key: string) => isTierLabelNodeId(key) || key.startsWith('row-label:');
  if (!Object.keys(positions).some(isLabel)) return positions;
  const out: Record<string, T> = {};
  Object.entries(positions).forEach(([key, value]) => {
    if (!isLabel(key)) out[key] = value;
  });
  return out;
};

// Stable empty index: the quick-search palette's items are only built while
// it is open, and this keeps the closed state from minting a new array (and a
// fresh memo result inside the palette) on every render.
const EMPTY_SEARCH_ITEMS: GraphSearchItem[] = [];

// Shared empties for a card's row state (see cardRowState in the layout
// effect): a card with nothing to show gets these exact objects every rebuild.
const NO_HIGHLIGHTED_VARS: Set<string> = new Set();
const NO_CONNECTED_VARS: Map<string, ConnectionFlags> = new Map();

const edgeTypes: EdgeTypes = {
  customEdge: CustomEdge,
};

// ── Inner component (needs ReactFlowProvider context) ──────────────

function GroupedGraphInner() {
  const { collections, variables, selectedCollectionIds, shadeGroups, selectedModeId, selectedNode, hasMultipleSelection } = useAppContext();
  const { modals, openShadesModal, openStepsModal, openInputModal, openAddVariableModal, openBulkEdit } = useModalContext();
  const groupedGraphRef = useRef<HTMLDivElement>(null);
  const updateNodeInternals = useUpdateNodeInternals();

  // The selection as a flat layer list (root + component descendants). Every
  // selection-row lookup goes through this so child-layer rows bind/unbind on
  // their own layer id; `layerIndex` is what handle and edge ids carry.
  const selectedLayers = useMemo(
    () => (selectedNode ? flattenLayers(selectedNode) : []),
    [selectedNode]
  );

  // Support both COLOR and FLOAT variables - groups are typed individually based on their variables
  // Storage keys are now type-independent since we show all types together
  // Default to COLOR type for backwards compatibility with color-specific features (can be mixed now)
  const hasColorVars = variables.some(v => v.resolvedType === 'COLOR');
  const hasNumberVars = variables.some(v => v.resolvedType === 'FLOAT');
  // For features that need a type, prefer COLOR if available (for color menu, shades, etc.)
  const variableType: 'COLOR' | 'FLOAT' = hasColorVars ? 'COLOR' : 'FLOAT';
  const isColorType = variableType === 'COLOR';
  const [savedPositions, setSavedPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [gridLayoutSettings, setGridLayoutSettings] = useState<GridLayoutSettings>(
    () => normalizeGridLayoutSettings({})
  );
  const [gridLayoutDraft, setGridLayoutDraft] = useState<GridLayoutDraft>(
    () => toGridLayoutDraft(normalizeGridLayoutSettings({}))
  );
  // The vertical gap the overlap nudge restores (see resolveOverlaps): a
  // number, so the layout effect re-runs only when it changes; the drop
  // handler reads it through the ref.
  const layoutGapY = gridLayoutSettings.gapY;
  const layoutGapYRef = useRef(layoutGapY);
  layoutGapYRef.current = layoutGapY;
  // Tier captions from the last Arrange Grid run. Pure wayfinding chrome:
  // they carry no graph meaning, never reach `savedPositions`, and are
  // replaced only by a saved Arrange, its undo, or hydration (an arrange
  // while hiding keeps its own, see hidingLayout). The element objects are
  // handed to the caption nodes as `data` unchanged, so the layout effect
  // does not mint a fresh data identity on every pass.
  const [tierLabels, setTierLabels] = useState<TierPlacement[]>([]);
  const tierLabelsRef = useRef(tierLabels);
  tierLabelsRef.current = tierLabels;
  const [positionsHydrated, setPositionsHydrated] = useState(false);
  // The Collection default layout uses the saved Grid Settings (mode and
  // gaps), so the layout waits for them too instead of jumping when they land.
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  // The layout effect seeds node positions from `savedPositions`, but that
  // state is rewritten by the 300ms debounce after every drag — keeping it in
  // the effect's deps made every drag-end rebuild every node and edge. The
  // effect reads it through this ref instead, and `savedPositionsRevision` is
  // bumped only by the paths that genuinely need a re-layout from stored
  // positions: hydration from client storage, Arrange Grid, and its undo.
  const savedPositionsRef = useRef(savedPositions);
  const [savedPositionsRevision, setSavedPositionsRevision] = useState(0);
  // Declared above the layout effect on purpose: effects run in declaration
  // order, so the ref is already current when the layout effect reads it.
  useEffect(() => {
    savedPositionsRef.current = savedPositions;
  }, [savedPositions]);
  // Collection mode's own record (`graph-positions-collection`): its manual
  // moves only, by node id. `graph-positions` above is Tier mode's and
  // Collection mode never touches it, so switching modes loses nothing. Only
  // the y of a column unit is ever used (see resolveColumnPositions). Read by
  // the layout effect like savedPositionsRef; written by hydration, the drag
  // save, Arrange and its undo, the last three bumping the revision as needed.
  const collectionPositionsRef = useRef<PositionRecord>({});
  const [collectionPositionsHydrated, setCollectionPositionsHydrated] = useState(false);
  // Highlight target: a set of cards (varName null = their whole chains) or a
  // single variable row inside one card (varName set = only that row's chain).
  // Card clicks, row clicks and quick search pass one key; a sidebar row
  // focuses every card under it. Never empty — no highlight is null.
  const [highlightTarget, setHighlightTarget] = useState<HighlightTarget | null>(null);
  const highlightedGroupKeys = highlightTarget?.groupKeys ?? null;
  const highlightedVarName = highlightTarget?.varName ?? null;
  const hasHighlight = highlightTarget !== null;
  // Value identity of the target: a re-focus that lands on the same cards
  // builds a new array, and must not count as the highlight moving.
  const highlightSignature = highlightTarget
    ? JSON.stringify([highlightTarget.groupKeys, highlightTarget.varName])
    : null;
  // "The one card" — only when exactly one is highlighted (the sidebar's
  // per-card ring). Anything asking "is something highlighted" uses
  // `hasHighlight` instead.
  const highlightedGroupKey = highlightedGroupKeys?.length === 1 ? highlightedGroupKeys[0] : null;
  // The sidebar row whose label set the current highlight (its
  // `<collectionId>::<path>`), ringed there. Cleared by every other way of
  // setting or clearing the highlight; see setCardHighlight.
  const [focusedRowKey, setFocusedRowKey] = useState<string | null>(null);
  // Sidebar click = select, then focus. Both refs bridge the gap until the
  // layout effect has applied the new selection to the nodes.
  const selectionPendingLayoutRef = useRef(false);
  const pendingFocusRef = useRef<{ collectionId: string; path: string } | null>(null);
  // Sidebar rows with something visible under them, as one sorted
  // `\n`-joined string of row keys (see collectFocusableRowKeys). Written by
  // the layout effect — the only place visibility changes — and a string, so
  // an unchanged set is an unchanged state and a drag never re-renders the
  // sidebar.
  const [focusableRowSignature, setFocusableRowSignature] = useState('');
  const focusableRowKeys = useMemo(
    () => new Set(focusableRowSignature ? focusableRowSignature.split('\n') : []),
    [focusableRowSignature]
  );
  const isPathFocusable = useCallback(
    (collectionId: string, path: string) => focusableRowKeys.has(getCollectionGroupKey(collectionId, path)),
    [focusableRowKeys]
  );
  // "Hide unused": while something is highlighted, hide every card and wire
  // that is not on its path. A preference, not a mode — with no highlight it
  // hides nothing. Not saved: every reload starts with it off, so a click on a
  // card never hides the graph because of a choice made in an earlier session.
  const [hideUnused, setHideUnused] = useState(false);
  const isHidingUnused = hideUnused && hasHighlight;
  // Arrange Grid run while hiding: a grid of the visible path only, in memory
  // and never saved (see HidingLayout). The layout effect lays it over
  // `savedPositions`; ending the hiding activation drops it, which brings the
  // saved layout back untouched. Read through the ref by the layout effect and
  // the drag save, for the same reason as savedPositionsRef: a drag rewrites
  // it, and that must not rebuild every node.
  const [hidingLayout, setHidingLayout] = useState<HidingLayout | null>(null);
  const hidingLayoutRef = useRef(hidingLayout);
  hidingLayoutRef.current = hidingLayout;
  // Frames the user has wrapped, as `<collectionId>::<path>` keys (see
  // getWrapperKey). Empty = flat leaf cards. A key here draws a wrapper
  // around every card of THAT collection at or below that path; the empty
  // path is the collection's own frame.
  const [groupedPaths, setGroupedPaths] = useState<Set<string>>(new Set());
  // Card key → the xyflow node that actually DRAWS that card. Identity for a
  // leaf card; the container's `wrapper:<cid>::<path>` id for a card a
  // container absorbed (part 4 — the card IS the container, so it is no
  // longer a node of its own).
  //
  // Held in a ref, written by the layout effect: the callbacks below address
  // a card by key and need the node id, and a state dep here would put every
  // one of them back in the layout effect's deps and undo the drag-perf work.
  const cardNodeIdRef = useRef<Map<string, string>>(new Map());
  const nodeIdForCard = useCallback(
    (cardKey: string) => cardNodeIdRef.current.get(cardKey) ?? cardKey,
    []
  );
  // Records read from client storage that still hold the pre-3a/3b bare-path
  // shape. Migrating them needs the collections/variables to work out which
  // collection owns a bare path, and storage answers long before the plugin
  // sends data — so the raw payload is parked here and the effect below
  // applies it as soon as data lands. Never dropped for arriving early.
  const pendingStorageRef = useRef<{
    positions: unknown;
    collectionPositions: unknown;
    groupedPaths: unknown;
  }>({ positions: null, collectionPositions: null, groupedPaths: null });
  const [pendingStorageRevision, setPendingStorageRevision] = useState(0);
  const reactFlowInstance = useReactFlow();
  // One-step undo for the last "Arrange Grid" run: the SAVED record and the
  // tier captions from before it (see arrangeUndo.ts — never the live node
  // positions, which would freeze a filter-dependent natural layout). Cleared
  // after use or once superseded by a fresh arrange.
  const lastArrangeUndoRef = useRef<ArrangeUndoSnapshot | null>(null);
  const [hasArrangeUndo, setHasArrangeUndo] = useState(false);

  // Get filter state from context
  const {
    setSelectedModeId: setGlobalModeId,
    selectedVariableTypes: selectedTypes,
    selectedCollectionIds: localSelectedCollections,
    selectedGroups,
    toggleVariableType,
    setSelectedCollectionIds,
    setSelectedGroups,
  } = useAppContext();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<CustomEdgeData>>([]);
  const variablesById = useMemo(
    () => new Map(variables.map(variable => [variable.id, variable])),
    [variables]
  );
  // Collection frames (`<cid>::`) are titled with the collection's name.
  // Memoized so the layout effect's dep on it only changes when the
  // collections do, never on a drag.
  const collectionNameById = useMemo(
    () => new Map(collections.map(collection => [collection.id, collection.name])),
    [collections]
  );

  const [colorMenu, setColorMenu] = useState<{
    show: boolean;
    position: { top: number; left: number };
    variableId: string;
    value: string;
  }>({ show: false, position: { top: 0, left: 0 }, variableId: '', value: '' });

  const hideColorMenu = useCallback(() => {
    setColorMenu(prev => ({ ...prev, show: false }));
  }, []);

  // Sidebar handlers
  const handleModeChange = useCallback((modeId: string) => {
    setGlobalModeId(modeId);
  }, [setGlobalModeId]);

  // Every tree group key, per collection. Declared before the sidebar
  // handlers, which read it.
  const groupKeysByCollection = useMemo(() => getGroupKeysByCollection(variables), [variables]);

  // One atomic write of the sidebar's click selection. Selecting a collection
  // that was off asks to see it — hiding would keep its off-path cards out (or
  // bring them back dimmed and unwired) — so that ends hiding. Narrowing the
  // selection or picking within selected collections keeps hiding on.
  const handleSelectionChange = useCallback((next: { collections: Set<string>; groups: Set<string> }) => {
    const addedCollections = new Set(Array.from(next.collections).filter(id =>
      collectionToggleEndsHiding(isHidingUnused, id, localSelectedCollections)
    ));
    if (addedCollections.size > 0) {
      // The click is the user's whole choice for the collections it turns
      // on: hiding ending must not re-check anything of theirs on top of it.
      // What hide-unused unchecked elsewhere comes back as usual.
      hideUnusedOwnRef.current = releaseCollectionsFromOwn(
        hideUnusedOwnRef.current, addedCollections, groupKeysByCollection
      );
      setHideUnused(false);
    }
    const changed =
      next.collections.size !== localSelectedCollections.size
      || next.groups.size !== selectedGroups.size
      || Array.from(next.collections).some(id => !localSelectedCollections.has(id))
      || Array.from(next.groups).some(key => !selectedGroups.has(key));
    // The layout has not seen the new visibility yet: a focus request that
    // follows (the row click) waits for it (see handleFocusPath).
    if (changed) selectionPendingLayoutRef.current = true;
    setSelectedCollectionIds(next.collections);
    setSelectedGroups(next.groups);
  }, [isHidingUnused, localSelectedCollections, selectedGroups, setSelectedCollectionIds, setSelectedGroups,
      groupKeysByCollection]);

  // Sidebar "Select All" means "show me everything": hiding ends with it.
  // The previous row's focus ring (and its canvas highlight) ends with it.
  const handleSelectAllCollections = useCallback(() => {
    setHideUnused(false);
    setHighlightTarget(null);
    setFocusedRowKey(null);
  }, []);

  const handleTypeToggle = useCallback((type: string) => {
    toggleVariableType(type);
  }, [toggleVariableType]);

  const handleShowColorMenu = useCallback((event: React.MouseEvent, node: VariableNode) => {
    event.stopPropagation();
    if (!isColorType || node.isVirtual || !groupedGraphRef.current) return;

    const graphRect = groupedGraphRef.current.getBoundingClientRect();
    const targetRect = (event.currentTarget as HTMLElement).getBoundingClientRect();

    setColorMenu({
      show: true,
      position: {
        top: targetRect.bottom - graphRect.top + 4,
        left: targetRect.left - graphRect.left,
      },
      variableId: node.id,
      value: node.value,
    });
  }, [isColorType]);

  // Load saved positions on mount
  useEffect(() => {
    const storageKey = `graph-positions`;
    setSavedPositions({});
    setPositionsHydrated(false);
    pendingStorageRef.current.positions = null;
    post({ type: 'get-client-storage', key: storageKey });

    const handleStorage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (msg?.type === 'client-storage-data' && msg.key === storageKey) {
        // Parked, not applied: the record may still hold bare `wrapper:<path>`
        // or `group:<name>` keys, and rewriting those needs the collections —
        // they say which collection owns a bare path. The migration
        // effect below bumps savedPositionsRevision when it applies, which is
        // also what covers a response landing after the 100ms fallback has
        // already flipped positionsHydrated.
        pendingStorageRef.current.positions = msg.value || {};
        setPendingStorageRevision(rev => rev + 1);
        setPositionsHydrated(true);
      }
    };

    // Fallback for browser mode: if no storage response within 100ms, hydrate anyway
    const fallbackTimeout = setTimeout(() => {
      setPositionsHydrated(true);
    }, 100);

    window.addEventListener('message', handleStorage);
    return () => {
      window.removeEventListener('message', handleStorage);
      clearTimeout(fallbackTimeout);
    };
  }, [variableType]);

  // Collection mode's record, loaded and migrated exactly like
  // `graph-positions` (parked until the collections arrive). Part of the
  // hydration gate, so a reload in Collection mode does not jump.
  useEffect(() => {
    const storageKey = `graph-positions-collection`;
    collectionPositionsRef.current = {};
    setCollectionPositionsHydrated(false);
    pendingStorageRef.current.collectionPositions = null;
    post({ type: 'get-client-storage', key: storageKey });

    const handleStorage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (msg?.type === 'client-storage-data' && msg.key === storageKey) {
        pendingStorageRef.current.collectionPositions = msg.value || {};
        setPendingStorageRevision(rev => rev + 1);
        setCollectionPositionsHydrated(true);
      }
    };

    const fallbackTimeout = setTimeout(() => {
      setCollectionPositionsHydrated(true);
    }, 100);

    window.addEventListener('message', handleStorage);
    return () => {
      window.removeEventListener('message', handleStorage);
      clearTimeout(fallbackTimeout);
    };
  }, [variableType]);

  useEffect(() => {
    const storageKey = `graph-layout-settings`;
    setGridLayoutSettings(normalizeGridLayoutSettings({}));
    setSettingsHydrated(false);
    post({ type: 'get-client-storage', key: storageKey });

    const handleStorage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (msg?.type === 'client-storage-data' && msg.key === storageKey) {
        setGridLayoutSettings(normalizeGridLayoutSettings(msg.value));
        setSettingsHydrated(true);
      }
    };

    // Same browser-mode fallback as the positions load.
    const fallbackTimeout = setTimeout(() => {
      setSettingsHydrated(true);
    }, 100);

    window.addEventListener('message', handleStorage);
    return () => {
      window.removeEventListener('message', handleStorage);
      clearTimeout(fallbackTimeout);
    };
  }, [variableType]);

  const handleToggleHideUnused = useCallback(() => {
    setHideUnused(prev => !prev);
  }, []);

  // Load grouped-path state (per variable type)
  useEffect(() => {
    const storageKey = `graph-grouped-paths`;
    setGroupedPaths(new Set());
    pendingStorageRef.current.groupedPaths = null;
    post({ type: 'get-client-storage', key: storageKey });

    const handleStorage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (msg?.type === 'client-storage-data' && msg.key === storageKey) {
        // Parked for the migration effect below — see pendingStorageRef.
        pendingStorageRef.current.groupedPaths = msg.value;
        setPendingStorageRevision(rev => rev + 1);
      }
    };

    window.addEventListener('message', handleStorage);
    return () => window.removeEventListener('message', handleStorage);
  }, [variableType]);

  // Apply the parked storage records, migrating the pre-3a/3b bare-path shape
  // to collection-scoped wrapper AND card keys on the way in. On the real
  // file `graph-positions` is the layout of ~161 cards, so dropping it would
  // mean re-arranging everything by hand.
  //
  // This is deliberately NOT done in the storage handlers: resolving which
  // collection owns a bare path needs the variables, and client storage
  // answers well before the plugin has sent any. Holding the raw record until
  // data lands is what keeps an early response from being silently dropped.
  //
  // `collections.length > 0` is the readiness signal. With no collections
  // there is nothing to key against, every entry would resolve to nothing and
  // be dropped — so the record stays parked instead, and is applied the
  // moment real data arrives.
  //
  // Each record is consumed (set back to null) as it is applied, so this runs
  // exactly once per storage response and can never clobber a drag.
  useEffect(() => {
    if (pendingStorageRevision === 0) return;
    const pending = pendingStorageRef.current;
    if (pending.positions === null && pending.collectionPositions === null && pending.groupedPaths === null) return;
    if (collections.length === 0) return;

    const owners = buildWrapperPathOwners(collections, variables);
    // Cards need EXACT-path ownership, frames need at-or-below — see
    // buildWrapperPathOwners. A collection whose only variable is
    // `test/test2/leaf` is inside the frame `test` but has no CARD there.
    const cardOwners = buildWrapperPathOwners(collections, variables, { exactPathOnly: true });

    if (pending.groupedPaths !== null) {
      const raw = pending.groupedPaths;
      // One-level frames: nested keys collapse to the outermost.
      const migrated = flattenGroupedPaths(migrateGroupedPaths(raw, owners));
      pending.groupedPaths = null;
      setGroupedPaths(new Set(migrated));
      // Write the migrated shape back only when it actually changed, so the
      // old record is gone after one load and an already-migrated one costs
      // no write at all.
      if (JSON.stringify(raw) !== JSON.stringify(migrated)) {
        post({ type: 'set-client-storage', key: `graph-grouped-paths`, value: migrated });
      }
    }

    if (pending.positions !== null) {
      const raw = pending.positions;
      // `rel:` entries (manual positions of cards inside frames) are retired:
      // those cards are frozen and auto-stacked. Label ids (`tier-label:`, and
      // the retired Collection `row-label:`) never belong in the record.
      const migrated = stripLabelPositions(stripRelPositions(migrateGraphPositions(raw, owners, cardOwners)));
      pending.positions = null;
      setSavedPositions(migrated);
      setSavedPositionsRevision(rev => rev + 1);
      if (JSON.stringify(raw) !== JSON.stringify(migrated)) {
        post({ type: 'set-client-storage', key: `graph-positions`, value: migrated });
      }
    }

    if (pending.collectionPositions !== null) {
      const raw = pending.collectionPositions;
      // Same stripping as `graph-positions`: nothing stored can bring back a
      // caption, a header or a frame-relative card.
      const migrated = stripLabelPositions(stripRelPositions(migrateGraphPositions(raw, owners, cardOwners)));
      pending.collectionPositions = null;
      collectionPositionsRef.current = migrated;
      setSavedPositionsRevision(rev => rev + 1);
      if (JSON.stringify(raw) !== JSON.stringify(migrated)) {
        post({ type: 'set-client-storage', key: `graph-positions-collection`, value: migrated });
      }
    }
  }, [pendingStorageRevision, collections, variables]);

  // Load the tier captions the last arrange produced, so a reloaded plugin
  // shows the same captions over the same (also persisted) positions.
  useEffect(() => {
    const storageKey = `graph-tier-labels`;
    setTierLabels([]);
    post({ type: 'get-client-storage', key: storageKey });

    const handleStorage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (msg?.type === 'client-storage-data' && msg.key === storageKey) {
        setTierLabels(normalizeTierLabels(msg.value));
      }
    };

    window.addEventListener('message', handleStorage);
    return () => window.removeEventListener('message', handleStorage);
  }, [variableType]);

  // Retired: Collection mode's first design kept collection row labels in
  // `graph-layout-labels`. Collection mode has no labels of its own any more
  // (its captions live in `graph-tier-labels` like Tier mode's), so a stored
  // record is cleared once, and an absent one costs no write.
  useEffect(() => {
    const storageKey = `graph-layout-labels`;
    post({ type: 'get-client-storage', key: storageKey });

    const handleStorage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (msg?.type === 'client-storage-data' && msg.key === storageKey
        && msg.value !== null && msg.value !== undefined) {
        post({ type: 'set-client-storage', key: storageKey, value: null });
      }
    };

    window.addEventListener('message', handleStorage);
    return () => window.removeEventListener('message', handleStorage);
  }, [variableType]);

  // Mutate + persist grouped-path state in one step.
  const persistGroupedPaths = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    setGroupedPaths(prev => {
      const next = updater(prev);
      post({ type: 'set-client-storage', key: `graph-grouped-paths`, value: Array.from(next) });
      return next;
    });
  }, []);

  // "Level up": wrap a card/frame together with its siblings into a frame
  // for their shared parent.
  //
  // A top-level path yields the EMPTY parent, which is the collection's own
  // frame — the case that used to return early and leave a card like `test`
  // with nowhere to rise to. The empty path itself has no parent (a
  // collection frame is the root), which is also why neither the collection
  // frame nor the collection root card offers the button.
  //
  // Frames are one level: when the new frame is the parent of a frame level-up
  // was fired from, it REPLACES that frame, and it swallows every other
  // deeper frame under it (addFrame). Nothing is lost — their cards are
  // inside the new frame already.
  const handleLevelUp = useCallback((collectionId: string, path: string) => {
    if (!collectionId || !path) return;
    const parent = path.split('/').slice(0, -1).join('/');
    persistGroupedPaths(prev => addFrame(prev, getWrapperKey(collectionId, parent)));
  }, [persistGroupedPaths]);

  // Remove a wrapper frame (its cards pop back out).
  const handleUngroup = useCallback((collectionId: string, path: string) => {
    if (!collectionId) return;
    persistGroupedPaths(prev => {
      const next = new Set(prev);
      next.delete(getWrapperKey(collectionId, path));
      return next;
    });
  }, [persistGroupedPaths]);

  useEffect(() => {
    if (!colorMenu.show) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('#color-value-menu') && !target.closest('.rf-color-swatch')) {
        hideColorMenu();
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [colorMenu.show, hideColorMenu]);

  // Callbacks for node actions
  const handleGeneratorOpen = useCallback((group: GroupData, node: VariableNode) => {
    if (group.kind === 'shader' && node.virtualType === 'shader' && group.sourceGroupName) {
      if (isColorType) {
        openShadesModal({ groupName: group.sourceGroupName, modeId: selectedModeId });
      } else {
        openStepsModal({ groupName: group.sourceGroupName, collectionId: group.collectionId });
      }
    }
  }, [isColorType, openShadesModal, openStepsModal, selectedModeId]);

  const handleAddVariableToGroup = useCallback((group: GroupData) => {
    // An empty collection's placeholder card has no group path, so its
    // variable is created at the collection root — no name prefix.
    const isCollectionCard = group.kind === 'collection';
    if (!isCollectionCard && (group.kind !== 'standard' || !group.sourceGroupName)) return;
    const namePrefix = isCollectionCard ? '' : `${group.sourceGroupName}/`;

    openAddVariableModal({
      title: `New Variable in ${isCollectionCard ? group.title : group.sourceGroupName}`,
      confirmText: 'Add',
      onConfirm: (name, type) => {
        const variableName = normalizePathSegment(name);
        if (!variableName) return;
        post({
          type: 'create-variable',
          collectionId: group.collectionId,
          name: `${namePrefix}${variableName}`,
          varType: type,
          value: getDefaultVariableValue(type),
        });
      },
    });
  }, [openAddVariableModal]);

  const handleRenameGroup = useCallback((group: GroupData) => {
    if (group.kind !== 'standard' || !group.sourceGroupName) return;

    openInputModal({
      title: `Rename ${group.sourceGroupName}`,
      label: 'Group name',
      confirmText: 'Rename',
      initialValue: group.sourceGroupName,
      onConfirm: value => {
        const groupName = normalizePathSegment(value);
        if (!groupName || groupName === group.sourceGroupName) return;

        post({
          type: 'rename-group',
          variableIds: group.variables.filter(node => !node.isVirtual).map(node => node.id),
          groupName: group.sourceGroupName,
          newGroupName: groupName,
        });
      },
    });
  }, [openInputModal]);

  const handleDuplicateGroup = useCallback((group: GroupData) => {
    if (group.kind !== 'standard' || !group.sourceGroupName) return;

    post({
      type: 'duplicate-group',
      variableIds: group.variables.filter(node => !node.isVirtual).map(node => node.id),
      groupName: group.sourceGroupName,
    });
  }, []);

  const handleEditGroupAsText = useCallback((group: GroupData) => {
    if (group.kind !== 'standard' || !group.sourceGroupName) return;
    openBulkEdit({ groupName: group.sourceGroupName, collectionId: group.collectionId });
  }, [openBulkEdit]);

  const handleDeleteGraphGroup = useCallback((group: GroupData) => {
    if (group.kind !== 'standard' || !group.sourceGroupName) return;

    const variableIds = group.variables.filter(node => !node.isVirtual).map(node => node.id);
    if (variableIds.length === 0) return;

    if (confirm(`Delete group ${group.sourceGroupName}?`)) {
      post({ type: 'delete-group', ids: variableIds });
    }
  }, []);

  const handleDeleteGraphVariable = useCallback((node: VariableNode) => {
    if (node.isVirtual) return;
    if (confirm(`Delete ${node.name}?`)) {
      post({ type: 'delete-variable', id: node.id });
    }
  }, []);

  const handleRenameGraphVariable = useCallback((node: VariableNode) => {
    if (node.isVirtual) return;

    openInputModal({
      title: `Rename ${node.shortName}`,
      label: 'Variable name',
      confirmText: 'Rename',
      initialValue: node.shortName,
      onConfirm: value => {
        const variableName = normalizePathSegment(value);
        if (!variableName || variableName === node.shortName) return;

        const parts = node.name.split('/');
        parts[parts.length - 1] = variableName;

        post({
          type: 'update-variable-name',
          id: node.id,
          name: parts.join('/'),
        });
      },
    });
  }, [openInputModal]);

  const handleDisconnect = useCallback((receiverVarId: string, resolvedValue: string) => {
    const receiverVariable = variablesById.get(receiverVarId);
    const modeId = receiverVariable
      ? resolveModeIdForCollection(collections, receiverVariable.collectionId, selectedModeId)
      : selectedModeId;
    post({ type: 'update-variable-value', id: receiverVarId, value: resolvedValue, modeId });
  }, [collections, selectedModeId, variablesById]);

  // Unbind a property on the selected Figma node. Stable identity so the
  // selection card's edges can carry plain values (unbindNodeId/unbindTarget)
  // instead of a fresh closure per edge per layout pass.
  const handleUnbindProperty = useCallback((nodeId: string, target: InspectorBindingTarget) => {
    post({ type: 'unbind-node-property', nodeId, target });
  }, []);

  // Every highlight change that does not come from a sidebar row goes
  // through here, so the sidebar ring never outlives the focus it marks.
  const setCardHighlight = useCallback((
    next: HighlightTarget | null | ((prev: HighlightTarget | null) => HighlightTarget | null)
  ) => {
    setHighlightTarget(next);
    setFocusedRowKey(null);
  }, []);

  // Highlight the full connected chain of a group (toggle off if re-selected)
  const handleHighlightPath = useCallback((group: GroupData) => {
    setCardHighlight(prev => (
      isSingleTarget(prev, group.key, null) ? null : { groupKeys: [group.key], varName: null }
    ));
  }, [setCardHighlight]);

  // Card menu "Hide unused": highlight this card's chain and hide the rest in
  // one step. While hiding is active the same item reads "Show all".
  const handleHideUnusedFromCard = useCallback((group: GroupData) => {
    if (hidingPathRef.current) {
      setHideUnused(false);
      return;
    }
    setCardHighlight({ groupKeys: [group.key], varName: null });
    setHideUnused(true);
  }, [setCardHighlight]);

  // Highlight only one variable row's chain (toggle off if re-selected).
  const handleHighlightVariable = useCallback((group: GroupData, node: VariableNode) => {
    setCardHighlight(prev => (
      isSingleTarget(prev, group.key, node.name) ? null : { groupKeys: [group.key], varName: node.name }
    ));
  }, [setCardHighlight]);

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.type !== 'groupNode') return;
    // A collection root card with no loose variables has no chain to
    // highlight — clicking it would just dim the whole graph. One that does
    // hold rows behaves like any other card.
    const clickedGroup = (node.data as { group?: GroupData } | undefined)?.group;
    if (clickedGroup?.kind === 'collection' && clickedGroup.variables.length === 0) return;
    setCardHighlight(prev => (
      isSingleTarget(prev, node.id, null) ? null : { groupKeys: [node.id], varName: null }
    ));
  }, [setCardHighlight]);

  const clearHighlight = useCallback(() => setCardHighlight(null), [setCardHighlight]);

  // Pan/zoom to one xyflow node, on the next frame so a node the same
  // interaction just caused to be rebuilt has painted before we measure it.
  // Takes a NODE id, not a card key — every card-key caller goes through
  // nodeIdForCard first, because an absorbed card has no node of its own.
  const zoomToNodeId = useCallback((nodeId: string) => {
    requestAnimationFrame(() => {
      try {
        reactFlowInstance.fitView({ nodes: [{ id: nodeId }], duration: 400, padding: 0.5, maxZoom: 1 });
      } catch {
        // Node may not be rendered (filtered out) — any highlight still applies.
      }
    });
  }, [reactFlowInstance]);

  // Quick-search's card/variable jump. Deliberately NOT a toggle: searching
  // for the card that already happens to be highlighted must still move the
  // viewport to it, not clear it and stay put.
  const focusCard = useCallback((cardKey: string, varName: string | null) => {
    setCardHighlight({ groupKeys: [cardKey], varName });
    zoomToNodeId(nodeIdForCard(cardKey));
  }, [setCardHighlight, zoomToNodeId, nodeIdForCard]);

  // Fit the viewport to a set of NODE ids, on the next frame like
  // zoomToNodeId. Callers pass visible nodes only (selectFocusScope).
  const fitToNodeIds = useCallback((nodeIds: string[]) => {
    requestAnimationFrame(() => {
      try {
        reactFlowInstance.fitView({ nodes: nodeIds.map(id => ({ id })), duration: 400, padding: 0.2, maxZoom: 1 });
      } catch {
        // A node can leave between read and fit — nothing to move to then.
      }
    });
  }, [reactFlowInstance]);

  // Sidebar row → canvas: highlight every visible card under the row and fit
  // them. Always focuses, never toggles — a second click on the same row
  // re-focuses, like the quick-search jump. Live nodes off the instance rather
  // than the `nodes` state, so this keeps one identity across layout passes
  // (see the drag-perf work). Nothing visible in scope → nothing at all, so a
  // stale sidebar can never park the canvas on a hidden node.
  // Collection mode: a collection is one (possibly very tall) column, so a
  // COLLECTION row (and quick search's collection jump) lands at the top of
  // it instead of fitting all of it — the column header plus the collection's
  // first card (see selectFirstCollectionNodeId / selectCollectionHeaderNodeId).
  // Group rows and Tier mode fit the scope.
  const isCollectionSort = gridLayoutSettings.sortBy === 'collection';
  const moveCameraToScope = useCallback((nodes: Node[], collectionId: string, path: string, nodeIds: string[]) => {
    const first = isCollectionSort && path === '' ? selectFirstCollectionNodeId(nodes, collectionId) : null;
    if (!first) {
      fitToNodeIds(nodeIds);
      return;
    }
    const header = selectCollectionHeaderNodeId(nodes, collectionId);
    if (header) fitToNodeIds([header, first]);
    else zoomToNodeId(first);
  }, [isCollectionSort, zoomToNodeId, fitToNodeIds]);

  const runFocusPath = useCallback((collectionId: string, path: string) => {
    const nodes = reactFlowInstance.getNodes();
    const scope = selectFocusScope(nodes, collectionId, path);
    if (!scope) return;
    // A frame with no card of its own (or its card filtered out) is a fit
    // target with nothing to highlight; the highlight then stays as it was.
    if (scope.cardKeys.length > 0) {
      setHighlightTarget({ groupKeys: scope.cardKeys, varName: null });
      setFocusedRowKey(getCollectionGroupKey(collectionId, path));
    }
    moveCameraToScope(nodes, collectionId, path, scope.nodeIds);
  }, [reactFlowInstance, moveCameraToScope]);

  // A row click selects, then asks to focus. When the selection just changed
  // the canvas still shows the old visibility, so the request is parked and
  // run by the effect below once the layout has applied the new one.
  const handleFocusPath = useCallback((collectionId: string, path: string) => {
    if (selectionPendingLayoutRef.current) {
      pendingFocusRef.current = { collectionId, path };
      return;
    }
    runFocusPath(collectionId, path);
  }, [runFocusPath]);

  useEffect(() => {
    selectionPendingLayoutRef.current = false;
    const pending = pendingFocusRef.current;
    if (!pending) return;
    pendingFocusRef.current = null;
    runFocusPath(pending.collectionId, pending.path);
  }, [nodes, runFocusPath]);

  // Quick-search's collection jump: fit every visible card of the collection,
  // no highlight. Same scope as the sidebar's collection row.
  const handleZoomToCollection = useCallback((collectionId: string) => {
    const nodes = reactFlowInstance.getNodes();
    const scope = selectFocusScope(nodes, collectionId, '');
    if (scope) moveCameraToScope(nodes, collectionId, '', scope.nodeIds);
  }, [reactFlowInstance, moveCameraToScope]);

  const handleCreateGroup = useCallback(() => {
    const firstCollectionId = Array.from(localSelectedCollections)[0];
    if (!firstCollectionId) return;

    const existingGroups = new Set<string>();
    variables.forEach(v => {
      if (v.collectionId !== firstCollectionId) return;
      const groupName = getVariableGroupName(v.name);
      if (groupName) existingGroups.add(groupName);
    });

    openInputModal({
      title: `New ${isColorType ? 'Color' : 'Number'} Group`,
      label: 'Group name',
      confirmText: 'Create',
      suggestions: Array.from(existingGroups).sort((a, b) => a.localeCompare(b)),
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
  }, [isColorType, openInputModal, localSelectedCollections, variableType, variables]);

  // Compute groups and connections from ALL variables (filtering applied at render time)
  const { groupsData, connectionData, variableMap } = useMemo(() => {
    // Use ALL variables - no filtering here
    const typeVars = variables;
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

      const sourceNode = formatVariableNode(sourceVariable, varsByName, true, collections, selectedModeId);
      const sourceGroupKey = `source:${sourceVariable.id}`;
      const shaderGroupKey = `shader:${sourceVariable.id}`;
      const shadesGroupKey = `shades:${sourceVariable.id}`;
      const sourceColor = sourceNode.color;
      const managedShades = typeVars
        .filter(v => shadeGroup.deleteIds.includes(v.id) && v.id !== sourceVariable.id)
        .sort((a, b) => extractShadeNumber(a.name) - extractShadeNumber(b.name));

      const shadeNodes = managedShades.map(v => formatVariableNode(v, varsByName, true, collections, selectedModeId));
      const shaderNode = createShaderNode(shadeGroup, sourceColor);
      const paletteNode = createPaletteNode(shadeGroup, shadeNodes.length, sourceColor);

      const baseY = index * (getCardHeightForRows(shadeNodes.length + 1) + GROUP_GAP_Y);

      const managedGroups: GroupData[] = [
        {
          key: sourceGroupKey, title: sourceVariable.name, variables: [sourceNode],
          x: 0, y: 0, initialX: 0, initialY: baseY,
          kind: 'source', sourceGroupName: sourceVariable.name, headerFill: STANDARD_GROUP_HEADER_FILL,
          collectionId: shadeGroup.collectionId,
        },
        {
          key: shaderGroupKey, title: 'Shader', variables: [shaderNode],
          x: 0, y: 0, initialX: GROUP_WIDTH + GROUP_GAP_X, initialY: baseY,
          kind: 'shader', sourceGroupName: sourceVariable.name, headerFill: SHADER_GROUP_HEADER_FILL,
          collectionId: shadeGroup.collectionId,
        },
        {
          key: shadesGroupKey, title: `${sourceVariable.name} shades`, variables: [paletteNode, ...shadeNodes],
          x: 0, y: 0, initialX: (GROUP_WIDTH + GROUP_GAP_X) * 2, initialY: baseY,
          kind: 'shades', sourceGroupName: sourceVariable.name, headerFill: STANDARD_GROUP_HEADER_FILL,
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
      const sourceNode = formatVariableNode(sourceVariable, varsByName, false, collections, selectedModeId);
      const sourceGroupKey = `source:${sourceVariable.id}`;
      const shaderGroupKey = `shader:${sourceVariable.id}`;
      const stepsGroupKey = `steps:${sourceVariable.id}`;
      const stepNodes = stepGroup.stepVariables.map(v => formatVariableNode(v, varsByName, false, collections, selectedModeId));
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

      const baseY = index * (getCardHeightForRows(stepNodes.length + 1) + GROUP_GAP_Y);

      const managedGroups: GroupData[] = [
        {
          key: sourceGroupKey, title: sourceVariable.name, variables: [sourceNode],
          x: 0, y: 0, initialX: 0, initialY: baseY,
          kind: 'source', sourceGroupName: sourceVariable.name, headerFill: STANDARD_GROUP_HEADER_FILL,
          collectionId: sourceVariable.collectionId,
        },
        {
          key: shaderGroupKey, title: 'Steps', variables: [stepsNode],
          x: 0, y: 0, initialX: GROUP_WIDTH + GROUP_GAP_X, initialY: baseY,
          kind: 'shader', sourceGroupName: sourceVariable.name, headerFill: SHADER_GROUP_HEADER_FILL,
          collectionId: sourceVariable.collectionId,
        },
        {
          key: stepsGroupKey, title: `${sourceVariable.name} steps`, variables: [outputNode, ...stepNodes],
          x: 0, y: 0, initialX: (GROUP_WIDTH + GROUP_GAP_X) * 2, initialY: baseY,
          kind: 'shades', sourceGroupName: sourceVariable.name, headerFill: STANDARD_GROUP_HEADER_FILL,
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
    // Buckets are keyed `<collectionId>::<groupName>`, and loose (slash-less)
    // variables come back separately for their collection's root card — see
    // bucketUnmanagedVariables, which owns both rules.
    const { groups: unmanagedGroupsMap, loose: looseVariablesByCollection } =
      bucketUnmanagedVariables(unmanagedVars, variable => formatVariableNode(
        variable,
        varsByName,
        // The actual variable's type, not the global isColorType.
        variable.resolvedType === 'COLOR',
        collections,
        selectedModeId
      ));

    const columnStep = GROUP_WIDTH + GROUP_GAP_X;
    const managedLaneBottoms = new Map<number, number>();
    groupsArray.forEach(group => {
      if (group.kind === 'standard') return;
      const lane = Math.round(group.initialX / columnStep);
      const bottom = group.initialY + getGroupHeight(group) + GROUP_GAP_Y;
      managedLaneBottoms.set(lane, Math.max(managedLaneBottoms.get(lane) || 0, bottom));
    });

    // Place unmanaged groups: primitives at column 0, semantic groups further right
    // First pass: create all groups and track which reference which
    const unmanagedEntries: Array<{ groupName: string; groupVariables: VariableNode[]; collectionId: string; hasReferences: boolean }> = [];
    // Sorted by group NAME (collection id only as a tie-break), so the
    // initial stacking order of a single-collection file is exactly what it
    // was before the bucket key gained a collection — the raw ids sort
    // meaninglessly.
    Array.from(unmanagedGroupsMap.values())
      .sort((a, b) => a.groupName.localeCompare(b.groupName) || a.collectionId.localeCompare(b.collectionId))
      .forEach(({ groupName, nodes: groupVariables, collectionId }) => {
        const hasReferences = groupVariables.some(v => v.isReference);
        unmanagedEntries.push({ groupName, groupVariables, collectionId, hasReferences });
      });

    // Primitives (no references) go at column 0, stacked below managed source groups
    let primitiveY = managedLaneBottoms.get(0) || 0;
    unmanagedEntries.filter(e => !e.hasReferences).forEach(entry => {
      const groupKey = getGroupCardKey(entry.collectionId, entry.groupName);
      const groupData: GroupData = {
        key: groupKey, title: entry.groupName, variables: entry.groupVariables,
        x: 0, y: 0, initialX: 0, initialY: primitiveY,
        kind: 'standard', sourceGroupName: entry.groupName, headerFill: STANDARD_GROUP_HEADER_FILL,
        collectionId: entry.collectionId,
        // Always: a top-level path levels up into its collection's frame.
        canGroup: true,
      };
      groupsArray.push(groupData);
      entry.groupVariables.forEach((vNode, variableIndex) => {
        varMap.set(vNode.name, { group: groupKey, index: variableIndex, node: vNode });
      });
      primitiveY += getGroupHeight(groupData) + GROUP_GAP_Y;
    });

    // Every collection gets a root card: it holds the collection's loose
    // (slash-less) variables and carries the only "+" that can create a
    // variable at the collection root. Emitted unconditionally, so a
    // collection whose variables are all grouped still has a reachable root.
    // Kept in column 0 with the primitives rather than in the depth-based
    // semantic columns below: a collection root is structural, not derived
    // from what its rows happen to reference.
    buildCollectionCards(collections, looseVariablesByCollection, primitiveY).forEach(card => {
      groupsArray.push(card);
      card.variables.forEach((vNode, variableIndex) => {
        varMap.set(vNode.name, { group: card.key, index: variableIndex, node: vNode });
      });
      primitiveY += getGroupHeight(card) + GROUP_GAP_Y;
    });

    // Semantic groups (with references) - we'll set initialX after building connections
    // so we can compute depth. For now, place them temporarily.
    const semanticGroups: GroupData[] = [];
    let semanticY = 0;
    unmanagedEntries.filter(e => e.hasReferences).forEach(entry => {
      const groupKey = getGroupCardKey(entry.collectionId, entry.groupName);
      const groupData: GroupData = {
        key: groupKey, title: entry.groupName, variables: entry.groupVariables,
        x: 0, y: 0, initialX: 0, initialY: semanticY,
        kind: 'standard', sourceGroupName: entry.groupName, headerFill: STANDARD_GROUP_HEADER_FILL,
        collectionId: entry.collectionId,
        // Always: a top-level path levels up into its collection's frame.
        canGroup: true,
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

    // Now compute depth-based initialX for semantic groups.
    // When shaders/steps exist, keep them in a dedicated column and place
    // other dependencies starting at the column after that.
    if (semanticGroups.length > 0) {
      const reserveGeneratorLane = groupsArray.some(group => group.kind === 'shader');
      const groupInitialCol = new Map<string, number>();
      groupsArray.forEach(group => {
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
          const needed = reserveGeneratorLane && fromCol < 2 ? 2 : fromCol + 1;
          if (needed > toCol) {
            groupInitialCol.set(conn.toGroup, needed);
            changed = true;
          }
        });
      }

      // Apply computed columns to semantic groups
      const colYTracker = new Map<number, number>();
      semanticGroups.forEach(group => {
        const col = groupInitialCol.get(group.key) ?? 0;
        const currentY = colYTracker.get(col) ?? managedLaneBottoms.get(col) ?? 0;
        group.initialX = col * columnStep;
        group.initialY = currentY;
        colYTracker.set(col, currentY + getGroupHeight(group) + GROUP_GAP_Y);
      });
    }

    return { groupsData: groupsArray, connectionData: conns, variableMap: varMap };
  }, [collections, variables, variableType, shadeGroups, isColorType, selectedModeId]);

  // Cards that provide a bound token to the current Figma selection. They are
  // force-shown even when the filters would hide them (see isCardHidden), so
  // the selection's connection is never drawn to nothing. Hoisted out of the
  // layout effect because Arrange Grid needs the same set: a force-shown card
  // is on screen, so it must get a grid slot.
  const selectionProviderGroupKeys = useMemo(() => {
    const keys = new Set<string>();
    selectedLayers.forEach(layer => layer.entries.forEach(entry => {
      if (entry.kind !== 'variable' || !entry.token) return;
      const info = variableMap.get(entry.token.name);
      if (info) keys.add(info.group);
    }));
    return keys;
  }, [selectedLayers, variableMap]);

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

  // The highlighted path, outside the layout effect because the handle
  // signature below needs it too (hide-unused can hide a container's own
  // card, which changes handles under a mounted node). Null = no highlight.
  const highlightPath = useMemo(
    () => computeHighlightPathForKeys(highlightedGroupKeys ?? [], highlightedVarName, groupsData, connectionData, variableMap),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the signature, see highlightSignature
    [highlightSignature, groupsData, connectionData, variableMap]
  );
  // What hide-unused hides against: the path while the toggle is on, else
  // null — and null hides nothing.
  const hidingPath = useMemo(() => getHidingPath(hideUnused, highlightPath), [hideUnused, highlightPath]);
  const hidingPathRef = useRef(hidingPath);
  hidingPathRef.current = hidingPath;

  // Hide-unused unchecks the off-path groups in the sidebar for real, so the
  // Collections tree (shared with the Table view) says what the canvas shows.
  // `coveredCards` are then the filter's to hide; the rest hide-unused still
  // hides itself (see isCardHiddenByHideUnused).
  const sidebarUncheck = useMemo(() => planSidebarUncheck(groupsData, hidingPath), [groupsData, hidingPath]);
  // The one definition of "is this card on screen right now", shared by the
  // layout effect (which renders the answer as node.hidden) and Arrange Grid
  // (which must skip hidden cards instead of reserving empty grid slots).
  // What hide-unused unchecked and is still unchecked. Only these may come
  // back — when hiding ends ("Show all"), or when a later activation puts
  // them on the path again; anything the user unchecked never does.
  const hideUnusedOwnRef = useRef<SidebarSelection>({ groups: new Set(), collections: new Set() });
  const cardVisibilityFilters = useMemo<CardVisibilityFilters>(() => ({
    selectedCollections: localSelectedCollections,
    selectedTypes,
    selectedGroups,
    variablesById,
    selectionProviderGroupKeys,
    groupKeysByCollection,
    // Only while hiding: just the keys Hide unused itself unchecked (never the
    // plan's other keys), so the user's own narrowing is kept.
    hideUnusedGroupKeys: getHideUnusedGroupKeys(!!hidingPath, hideUnusedOwnRef.current),
  }), [localSelectedCollections, selectedTypes, selectedGroups, variablesById, selectionProviderGroupKeys, groupKeysByCollection, hidingPath]);

  // Whether a card is hidden on the canvas right now: the shared filter
  // predicate, with hide-unused OR'd on top for what the sidebar uncheck
  // cannot cover — it can hide an on-filter card, never show a filtered one.
  // The layout effect renders this as `node.hidden` and Arrange Grid uses it
  // to decide which cards get a grid slot, so the two never disagree.
  const isCardHiddenNow = useCallback((group: GroupData) => (
    isCardHidden(group, cardVisibilityFilters)
    || isCardHiddenByHideUnused(group.key, hidingPath, sidebarUncheck.coveredCards)
  ), [cardVisibilityFilters, hidingPath, sidebarUncheck]);
  // A key the user re-ticks is theirs from then on: unticking it again later
  // is their uncheck, not ours to undo. Declared before the write below so it
  // never sees that write's own result mid-commit.
  useEffect(() => {
    const own = hideUnusedOwnRef.current;
    const stillUnchecked = (owned: Set<string>, selected: Set<string>) =>
      new Set(Array.from(owned).filter(k => !selected.has(k)));
    hideUnusedOwnRef.current = {
      groups: stillUnchecked(own.groups, selectedGroups),
      collections: stillUnchecked(own.collections, localSelectedCollections),
    };
  }, [selectedGroups, localSelectedCollections]);
  // One write per activation — toggled on with a highlight, card menu "Hide
  // unused", or the highlight moving while on — never a running override, so
  // re-ticking a group while hiding stays on simply shows it. Hiding ending
  // ("Show all", the highlight cleared) is one more write: an empty plan,
  // which re-checks exactly what hide-unused unchecked and still holds, so
  // the sidebar view from before comes back — the user's own narrowing
  // included, since it was never ours. Keyed on the highlight target, not the
  // path, so a data edit mid-hide does not write again.
  const hidingActivation = hidingPath ? highlightSignature : null;
  const lastHidingActivationRef = useRef<string | null>(null);
  useEffect(() => {
    if (hidingActivation === lastHidingActivationRef.current) return;
    lastHidingActivationRef.current = hidingActivation;
    // With hiding ended `hidingPath` is null, so `sidebarUncheck` is the
    // empty plan: every key still held comes back — but only keys that still
    // exist (a plugin undo recreates every id).
    const result = applySidebarUncheck(
      sidebarUncheck,
      { groups: selectedGroups, collections: localSelectedCollections },
      pruneOwnToExisting(hideUnusedOwnRef.current, new Set(collections.map(c => c.id)), groupKeysByCollection)
    );
    hideUnusedOwnRef.current = result.own;
    if (result.selection.groups !== selectedGroups) setSelectedGroups(result.selection.groups);
    if (result.selection.collections !== localSelectedCollections) {
      setSelectedCollectionIds(result.selection.collections);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidingActivation]);
  // A temporary arrange lives only as long as the activation it was made in.
  // Once that ends — toolbar or card-menu "Show all", the highlight cleared,
  // sidebar "Select All" / a collection ticked on, or the highlight moving to
  // another path — drop it. The layout effect already ignores it from the
  // ending commit on (its deps cover every input of `hidingActivation`), so no
  // revision bump is needed; this only frees it and, when hiding ended, frames
  // the saved layout it brought back. A moved highlight is framed by the
  // hide-unused fit below instead. The fit timer is deliberately not
  // cancelled on cleanup: clearing the state re-runs this effect at once.
  const activeHidingLayout = getActiveHidingLayout(hidingLayout, hidingActivation);
  useEffect(() => {
    if (hidingLayout === null || activeHidingLayout !== null) return;
    setHidingLayout(null);
    if (hidingActivation !== null) return;
    // The cards hiding took away mount again here and are measured a frame or
    // two later; fitView skips unmeasured nodes, so a fixed delay framed only
    // the path. Wait until every visible node has a size (bounded, so a node
    // that never measures cannot keep this alive).
    let frames = 0;
    const fitWhenMeasured = () => {
      const pending = reactFlowInstance.getNodes()
        .some(n => !n.hidden && !(n.measured?.width && n.measured?.height));
      if (pending && frames++ < 30) {
        requestAnimationFrame(fitWhenMeasured);
        return;
      }
      reactFlowInstance.fitView({ padding: 0.15, duration: 400 });
    };
    setTimeout(fitWhenMeasured, 50);
  }, [hidingLayout, activeHidingLayout, hidingActivation, reactFlowInstance]);

  // ── Collection mode: one column per collection ───────────────────
  // Where every visible top-level unit sits in Collection mode (null in Tier
  // mode, whose default layout is the `groupsData` initial columns +
  // buildWrapperLayout's packing, untouched): one column per collection in
  // collection order, units stacked by path (columnLayout.ts). A column
  // unit's x always comes from here; a stored record only supplies its y.
  // The column headers are derived from the same layout, never persisted;
  // their data objects are built here so a drag does not re-mint them.
  //
  // Filter-aware, but NOT hide-unused-aware: Hide unused never moves cards.
  // Hiding unchecks sidebar groups for real, so while it is active the
  // filters are frozen at what they were when it began.
  //
  // Never depends on node positions: a drag must not recompute it.
  const naturalLayoutFiltersRef = useRef(cardVisibilityFilters);
  if (hidingActivation === null) naturalLayoutFiltersRef.current = cardVisibilityFilters;
  const naturalLayoutFilters = hidingActivation === null ? cardVisibilityFilters : naturalLayoutFiltersRef.current;
  const collectionNaturalLayout = useMemo(() => {
    if (gridLayoutSettings.sortBy !== 'collection') return null;
    const items = buildCollectionColumnItems(groupsData, groupedPaths, g => isCardHidden(g, naturalLayoutFilters));
    const layout = layoutCollectionColumns({
      items,
      collectionOrder: collections.map(collection => collection.id),
      gapX: gridLayoutSettings.gapX,
      gapY: gridLayoutSettings.gapY,
    });
    const headers: CollectionHeaderPlacement[] = layout.columns.map(column => ({
      kind: 'collection',
      collectionId: column.collectionId,
      name: collectionNameById.get(column.collectionId) || column.collectionId,
      x: column.x,
      width: column.width,
    }));
    return { ...layout, headers };
  }, [gridLayoutSettings, groupsData, groupedPaths, naturalLayoutFilters, collections, collectionNameById]);
  // Read by a drop in Collection mode to tell which pushed boxes the next
  // layout pass reproduces by itself (see boxesToStore).
  const collectionNaturalLayoutRef = useRef(collectionNaturalLayout);
  collectionNaturalLayoutRef.current = collectionNaturalLayout;
  // Collection mode's drag lock: node id → the column x the layout effect
  // gave it (a temporary arrange's included). Empty in Tier mode. Written by
  // the layout effect, read by the nodes-change handler on every drag frame.
  const lockedXRef = useRef<ReadonlyMap<string, number>>(new Map());

  // Build React Flow nodes/edges when data changes
  // Note: Filtering applied here to hide nodes/edges without removing connections
  // ── Quick search (Cmd+K / Ctrl+K) ────────────────────────────────
  // Only the open flag lives here. The query lives inside the palette, so
  // typing never re-renders the graph.
  const [searchOpen, setSearchOpen] = useState(false);

  // Read by the shortcut listener, which is attached once. A modal open
  // anywhere else owns the keyboard; the palette must not jump in front of it.
  const anyModalOpenRef = useRef(false);
  useEffect(() => {
    anyModalOpenRef.current = Object.values(modals).some(Boolean);
  }, [modals]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !isQuickSearchShortcut(event)) return;
      const target = event.target as HTMLElement | null;
      // An editable target elsewhere owns the keystroke — another modal's
      // input, the toolbar search, a rename field. The palette's own input is
      // exempt, so Cmd+K still closes it.
      const inPalette = !!target?.closest('[data-graph-quick-search]');
      const isEditable = !!target && !inPalette && (
        target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      );
      if (isEditable) return;
      if (!inPalette && anyModalOpenRef.current) return;
      event.preventDefault();
      setSearchOpen(open => !open);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Built only while the palette is open — a closed palette costs nothing,
  // and this is deliberately outside the layout effect.
  const searchItems = useMemo<GraphSearchItem[]>(() => {
    if (!searchOpen) return EMPTY_SEARCH_ITEMS;

    const nameOf = (collectionId: string) => collectionNameById.get(collectionId) || collectionId;
    const items: GraphSearchItem[] = [];
    // Wrapper keys a real card sits at, so a container that merely absorbed a
    // card is not also offered as a nameless frame.
    const cardWrapperKeys = new Set<string>();
    const visibleCardsPerCollection = new Map<string, number>();

    groupsData.forEach(group => {
      // The same predicate the layout effect renders as `node.hidden` and
      // Arrange Grid packs by — never a second opinion about visibility.
      const hidden = isCardHidden(group, cardVisibilityFilters);
      if (!hidden) {
        visibleCardsPerCollection.set(
          group.collectionId,
          (visibleCardsPerCollection.get(group.collectionId) || 0) + 1
        );
      }
      if (group.kind === 'standard' || group.kind === 'collection') {
        cardWrapperKeys.add(getWrapperKey(group.collectionId, group.sourceGroupName || ''));
      }
      const collectionName = nameOf(group.collectionId);
      // A collection ROOT card with no loose rows has no chain to highlight —
      // highlighting it would dim every other card and light up nothing, the
      // exact case handleNodeClick already refuses. The Collection result
      // carries the same name and is the better jump anyway, so this card is
      // simply not offered.
      const isEmptyCollectionCard = group.kind === 'collection' && group.variables.length === 0;
      if (!isEmptyCollectionCard) {
        items.push({
          id: `card:${group.key}`,
          label: group.title,
          context: collectionName,
          target: { kind: 'card', cardKey: group.key },
          hidden,
        });
      }
      group.variables.forEach(node => {
        // Generator/palette rows are card chrome, not variables to jump to.
        if (node.isVirtual) return;
        items.push({
          id: `var:${group.key}::${node.name}`,
          label: node.name,
          context: `${group.title} · ${collectionName}`,
          target: { kind: 'variable', cardKey: group.key, varName: node.name },
          hidden,
          // Drives the row's COLOR/FLOAT/STRING icon. A row formatted from a
          // variable carries its resolved type; fall back to the variable
          // itself when it does not, and to COLOR only as a last resort so
          // the row never renders without an icon.
          variableType: node.resolvedType
            ?? variablesById.get(node.id ?? '')?.resolvedType
            ?? 'COLOR',
        });
      });
    });

    // Grouped paths no card sits at: a frame and nothing else. They get a
    // zoom-only target — `highlightTarget` addresses CARD keys, and handing
    // it a `wrapper:` id would dim every card and highlight none.
    const nodesById = new Map(reactFlowInstance.getNodes().map(node => [node.id, node]));
    groupedPaths.forEach(wrapperKey => {
      if (cardWrapperKeys.has(wrapperKey)) return;
      const parsed = parseWrapperKey(wrapperKey);
      if (!parsed) return;
      const nodeId = `${WRAPPER_NODE_PREFIX}${wrapperKey}`;
      const node = nodesById.get(nodeId);
      if (!node) return;
      items.push({
        id: `container:${nodeId}`,
        label: parsed.path || nameOf(parsed.collectionId),
        context: nameOf(parsed.collectionId),
        target: { kind: 'container', nodeId },
        hidden: node.hidden === true,
      });
    });

    collections.forEach(collection => {
      const visible = visibleCardsPerCollection.get(collection.id) || 0;
      items.push({
        id: `collection:${collection.id}`,
        label: collection.name,
        context: `${visible} ${visible === 1 ? 'card' : 'cards'}`,
        target: { kind: 'collection', collectionId: collection.id },
        // Nothing of it is on the canvas, so there is nothing to fit to —
        // the same check handleZoomToCollection makes before moving.
        hidden: visible === 0,
      });
    });

    return items;
  }, [searchOpen, groupsData, collections, collectionNameById, cardVisibilityFilters, groupedPaths, reactFlowInstance]);

  const handleSearchActivate = useCallback((target: GraphSearchTarget) => {
    setSearchOpen(false);
    switch (target.kind) {
      case 'collection':
        handleZoomToCollection(target.collectionId);
        break;
      case 'container':
        zoomToNodeId(target.nodeId);
        break;
      case 'card':
        focusCard(target.cardKey, null);
        break;
      case 'variable':
        focusCard(target.cardKey, target.varName);
        break;
    }
  }, [handleZoomToCollection, zoomToNodeId, focusCard]);

  const closeSearch = useCallback(() => setSearchOpen(false), []);

  useEffect(() => {
    if (!positionsHydrated || !collectionPositionsHydrated || !settingsHydrated) return;
    // Read through the refs: see savedPositionsRef and hidingLayout above.
    // A temporary arrange made while hiding wins over the saved record; one
    // left over from an activation that just ended is already ignored here,
    // in the commit before it is cleared from state.
    const temporaryLayout = getActiveHidingLayout(hidingLayoutRef.current, hidingActivation);
    // Tier mode: the Tier record as is. Collection mode: every column unit at
    // its column x and its stored (else natural) y; library cards and the
    // selection card keep their stored spot.
    const columns = collectionNaturalLayout;
    const savedPositions = mergeHidingPositions(
      columns
        ? resolveColumnPositions(collectionPositionsRef.current, columns.positions)
        : savedPositionsRef.current,
      temporaryLayout
    );
    // Captions: the temporary arrange's, else Tier mode's persisted record or
    // Collection mode's live column headers.
    const shownTierLabels: TierLabelNodeData[] = temporaryLayout?.tierLabels
      ?? (columns ? columns.headers : tierLabels);
    // The drag lock: every column unit stays at the x it gets here.
    const lockedX = new Map<string, number>();
    columns?.positions.forEach((_pos, id) => {
      const pos = savedPositions[id];
      if (pos) lockedX.set(id, pos.x);
    });
    lockedXRef.current = lockedX;

    // The highlighted lineage — see computeHighlightPath. Empty sets when
    // nothing is highlighted, so the rest of the effect reads them freely.
    const highlightedGroups = highlightPath?.groups ?? new Set<string>();
    const highlightedVars = highlightPath?.vars ?? new Set<string>();
    const highlightedEdgeIds = highlightPath?.edgeIds ?? new Set<string>();
    // All variables in the selected card — used to tint its off-chain edges
    // in a faded highlight color (group membership vs. actual selection).
    const selectedCardVars = highlightPath?.selectedCardVars ?? new Set<string>();

    // Resolve the selected node's bound tokens against the local token cards.
    // A token that maps to a real card marks that card as a "provider" (kept
    // visible even if filters would hide it, so the selection's link is never
    // dropped). A token with NO local card (e.g. a published library variable)
    // gets a synthetic "external" card so its connection is still drawn.
    const hexColorRe = /^#[0-9A-Fa-f]{6,8}$/;
    const externalTokenCardKey = new Map<string, string>();
    const externalTokensByCard = new Map<string, { title: string; collectionId: string; nodes: VariableNode[] }>();
    selectedLayers.forEach(layer => {
      layer.entries.forEach(entry => {
        if (entry.kind !== 'variable' || !entry.token) return;
        // A token with a local card is already counted in
        // selectionProviderGroupKeys (hoisted above the effect).
        if (variableMap.get(entry.token.name)) return;
        // No local match — bucket into a synthetic card by path prefix.
        // The slash-less fallback below has the same collision local cards
        // just lost (external token `test` and the parent path of
        // `test/test2` share one key). Left as is deliberately: the fix for
        // local cards was to host loose variables on their collection's root
        // card, and a published library token has no local collection card to
        // host it.
        //
        // The key is NOT collection-scoped either, for the same reason: the
        // only id available is the PUBLISHING library's, which no local
        // collection, ownership map or wrapper frame can resolve, and tokens
        // with none at all would all collapse onto the literal `'external'`
        // anyway. So `ext-group:` stays a bare path — and, since nothing
        // rewrites it, its saved position survives untouched.
        // Mirrored at handleFocusSelection — keep the two in step.
        const parts = entry.token.name.split('/');
        const groupName = parts.length > 1 ? parts.slice(0, -1).join('/') : entry.token.name;
        const cardKey = `ext-group:${groupName}`;
        externalTokenCardKey.set(entry.token.name, cardKey);
        const bucket = externalTokensByCard.get(cardKey)
          || { title: groupName, collectionId: entry.token.collectionId || 'external', nodes: [] };
        if (!bucket.nodes.some(n => n.name === entry.token!.name)) {
          const isColor = hexColorRe.test(entry.rawValue);
          bucket.nodes.push({
            id: `ext:${entry.token.name}`,
            name: entry.token.name,
            shortName: parts[parts.length - 1],
            displayName: entry.token.collectionName || 'library',
            color: isColor ? entry.rawValue : '#888888',
            value: entry.rawValue,
            resolvedValue: entry.rawValue,
            resolvedType: isColor ? 'COLOR' : 'STRING',
            isReference: false,
            referenceName: null,
            connectionsDisabled: false,
          });
        }
        externalTokensByCard.set(cardKey, bucket);
      });
    });

    // Same predicate Arrange Grid uses — see isCardHiddenNow.
    const cardHidden = isCardHiddenNow;

    // A card's row state, cut down to ITS OWN rows: CardRows only ever looks
    // up its own variable names, and the rebuild reconciliation (see
    // reconcileNodes) keeps a card's node object — and skips rendering it —
    // only while its data is unchanged. Graph-wide sets here would make every
    // card "change" whenever any connection or any highlighted row did.
    const cardRowState = (group: GroupData, isHighlighted: boolean) => {
      let cardConnected: Map<string, ConnectionFlags> | null = null;
      let cardHighlighted: Set<string> | null = null;
      for (const v of group.variables) {
        const flags = connectedVars.get(v.name);
        if (flags) (cardConnected ??= new Map()).set(v.name, flags);
        if (isHighlighted && highlightedVars.has(v.name)) (cardHighlighted ??= new Set()).add(v.name);
      }
      const seedInCard = highlightedVarName !== null
        && group.variables.some(v => v.name === highlightedVarName);
      return {
        connectedVars: cardConnected ?? NO_CONNECTED_VARS,
        highlightedVars: cardHighlighted ?? NO_HIGHLIGHTED_VARS,
        highlightedVarSeed: seedInCard ? highlightedVarName : null,
      };
    };

    // One card's worth of node data. Shared, because a CONTAINER renders the
    // card it absorbed from exactly this object — same header, same rows,
    // same actions (part 4).
    const buildCardData = (group: GroupData): GroupNodeData => {
      const firstRealVar = group.variables.find(v => !v.isVirtual);
      const sourceVariable = firstRealVar ? variablesById.get(firstRealVar.id) : null;
      const groupIsColorType = sourceVariable?.resolvedType === 'COLOR';
      const isHighlighted = hasHighlight && highlightedGroups.has(group.key);
      return {
        group,
        isColorType: groupIsColorType,
        variableType: groupIsColorType ? 'COLOR' : 'FLOAT',
        isHighlighted,
        isDimmed: hasHighlight && !highlightedGroups.has(group.key),
        highlightActive: hasHighlight,
        ...cardRowState(group, isHighlighted),
        onHighlightPath: handleHighlightPath,
        onHideUnused: handleHideUnusedFromCard,
        isHidingUnused: hidingPath !== null,
        onHighlightVariable: handleHighlightVariable,
        onGeneratorOpen: handleGeneratorOpen,
        onShowColorMenu: handleShowColorMenu,
        onAddVariable: handleAddVariableToGroup,
        onRenameGroup: handleRenameGroup,
        onDuplicateGroup: handleDuplicateGroup,
        onEditAsText: handleEditGroupAsText,
        onLevelUp: handleLevelUp,
        onDeleteGroup: handleDeleteGraphGroup,
        onRenameVariable: handleRenameGraphVariable,
        onDeleteVariable: handleDeleteGraphVariable,
        onDisconnect: handleDisconnect,
      };
    };

    const buildCardNode = (
      group: GroupData,
      position: { x: number; y: number },
      parentId: string | null
    ): Node => ({
      id: group.key,
      type: 'groupNode',
      position,
      // Force-show cards that provide a value to the current selection,
      // even when the active filters would otherwise hide them (folded into
      // the shared predicate via cardVisibilityFilters).
      hidden: cardHidden(group),
      // A card inside a frame is frozen: only the whole frame moves, so it
      // keeps its parentId (its position is frame-relative) but is not
      // draggable, and has no extent to be kept within.
      ...(parentId ? { parentId, draggable: false } : {}),
      data: parentId ? { ...buildCardData(group), inFrame: true } : buildCardData(group),
      dragHandle: '.group-header',
    });

    // Collection root cards lay out alongside the standard cards
    // (buildWrapperLayout treats their empty path as a top-level root), so
    // they share the same column packing instead of floating absolutely.
    const isStandardLayoutCard = (g: GroupData) => g.kind === 'standard' || g.kind === 'collection';
    const standardCards = groupsData.filter(isStandardLayoutCard);
    const managedGroups = groupsData.filter(g => !isStandardLayoutCard(g));

    const newNodes: Node[] = [];

    // Tier captions go in FIRST, so xyflow (which stacks in array order)
    // draws them beneath every card — a caption is chrome and must never sit
    // over a card that overlaps it. Their position in the array is otherwise
    // free: a caption has no `parentId` and is no node's parent, so it cannot
    // break the "nested node must follow its parentId" rule, and prepending
    // leaves the relative order of every real node untouched.
    shownTierLabels.forEach(label => {
      newNodes.push({
        id: getTierLabelNodeId(label),
        type: 'tierLabel',
        position: { x: label.x, y: TIER_LABEL_Y },
        // `pointerEvents: none` on the node wrapper itself, so panning and
        // rubber-band selection pass straight through the caption row.
        style: { width: label.width, height: TIER_LABEL_HEIGHT, pointerEvents: 'none' },
        // Inert in every way xyflow understands: no dragging, no selection,
        // no connecting, no keyboard focus, no delete.
        draggable: false,
        selectable: false,
        connectable: false,
        focusable: false,
        deletable: false,
        // The state object itself — see `tierLabels`.
        data: label,
      });
    });

    // Managed groups (shader/steps/source) stay top-level and absolute.
    managedGroups.forEach(group => {
      const position = savedPositions[group.key] || { x: group.initialX, y: group.initialY };
      newNodes.push(buildCardNode(group, position, null));
    });

    // Standard cards, nested inside wrapper frames for expanded groups.
    const cardHiddenByKey = new Map<string, boolean>();
    standardCards.forEach(g => cardHiddenByKey.set(g.key, cardHidden(g)));
    const hiddenCardKeys = new Set(standardCards.filter(g => cardHiddenByKey.get(g.key)).map(g => g.key));
    // Collection mode's column units are all in `savedPositions` already
    // (resolveColumnPositions); Tier mode keeps the packing.
    const placements = buildWrapperLayout(standardCards, groupedPaths, savedPositions, hiddenCardKeys);

    // Card key → the node that draws it. A card a container absorbed is no
    // longer a node of its own, and every edge endpoint names a CARD key, so
    // this is what keeps those edges attached to something that exists.
    const cardNodeId = new Map<string, string>();
    // Containers that actually hold something below their own rows — the
    // separator between the two depends on it.
    const containerChildCount = new Map<string, number>();
    placements.forEach(p => {
      if (p.kind === 'wrapper' && p.group) cardNodeId.set(p.group.key, p.id);
      if (p.parentId && !(p.kind === 'card' && hiddenCardKeys.has(p.group.key))) {
        containerChildCount.set(p.parentId, (containerChildCount.get(p.parentId) || 0) + 1);
      }
    });
    cardNodeIdRef.current = cardNodeId;
    const edgeNodeId = (cardKey: string) => cardNodeId.get(cardKey) ?? cardKey;

    placements.forEach(p => {
      if (p.kind === 'card') {
        newNodes.push(buildCardNode(p.group, p.position, p.parentId));
      } else {
        // Wrapper hidden when every card it contains is filtered out.
        // Membership is the same rule buildWrapperLayout used: same
        // collection, and the empty path (the collection's own frame) holds
        // all of them.
        const hasVisibleChild = standardCards.some(g => {
          if (g.collectionId !== p.collectionId) return false;
          const path = g.sourceGroupName || '';
          const within = p.path === '' || path === p.path || path.startsWith(p.path + '/');
          return within && !cardHiddenByKey.get(g.key);
        });
        const wrapperData: WrapperNodeData = {
          path: p.path,
          collectionId: p.collectionId,
          // A collection's own frame is titled with the COLLECTION NAME —
          // its path is empty and the raw id means nothing to the user. A
          // path frame is titled with its path, which is also the absorbed
          // card's own title.
          title: p.path || collectionNameById.get(p.collectionId) || p.collectionId,
          onLevelUp: handleLevelUp,
          onUngroup: handleUngroup,
          // The absorbed card: its header actions and rows ARE the
          // container's. Null for a grouped path no card sits at.
          card: p.group ? buildCardData(p.group) : null,
          cardHidden: p.group ? (cardHiddenByKey.get(p.group.key) ?? false) : true,
          hasChildren: (containerChildCount.get(p.id) || 0) > 0,
        };
        newNodes.push({
          id: p.id,
          type: 'groupWrapper',
          position: p.position,
          hidden: !hasVisibleChild,
          selectable: false,
          style: { width: p.width, height: p.height },
          data: wrapperData,
          dragHandle: '.group-header',
        });
      }
    });

    // Selected Figma node's own card, plus synthetic cards for any bound
    // tokens that have no local card. Laid out in reserved columns to the
    // right of every real token card: external tokens first, then the
    // selection card so its property rows sit beside their providers.
    if (selectedNode) {
      // Collection mode: right of the last column.
      const maxRight = columns
        ? columns.maxRight
        : groupsData.reduce((max, g) => Math.max(max, g.initialX + GROUP_WIDTH), 0);
      const externalX = maxRight + PROPERTY_COLUMN_GAP;
      const externalCards = Array.from(externalTokensByCard.entries());

      let externalY = 0;
      externalCards.forEach(([cardKey, bucket]) => {
        const group: GroupData = {
          key: cardKey, title: bucket.title, variables: bucket.nodes,
          x: 0, y: 0, initialX: externalX, initialY: externalY,
          // 'shader' kind suppresses the group management UI (add/rename/etc.)
          // that doesn't apply to a read-only external/library token card.
          kind: 'shader', sourceGroupName: bucket.title,
          headerFill: SHADER_GROUP_HEADER_FILL, collectionId: bucket.collectionId,
        };
        const position = savedPositions[cardKey] || { x: externalX, y: externalY };
        newNodes.push({
          id: cardKey,
          type: 'groupNode',
          position,
          // Filters never hide a library card; hide-unused does, unless the
          // path runs through it.
          hidden: isCardHiddenByHideUnused(cardKey, hidingPath, sidebarUncheck.coveredCards),
          data: {
            group,
            isColorType: bucket.nodes.every(n => n.resolvedType === 'COLOR'),
            variableType: 'FLOAT',
            isHighlighted: false,
            isDimmed: false,
            highlightActive: hasHighlight,
            ...cardRowState(group, false),
            onHighlightPath: handleHighlightPath,
            onHideUnused: handleHideUnusedFromCard,
            isHidingUnused: hidingPath !== null,
            onHighlightVariable: handleHighlightVariable,
            onGeneratorOpen: handleGeneratorOpen,
            onShowColorMenu: handleShowColorMenu,
            onAddVariable: handleAddVariableToGroup,
            onRenameGroup: handleRenameGroup,
            onDuplicateGroup: handleDuplicateGroup,
            onEditAsText: handleEditGroupAsText,
            onLevelUp: handleLevelUp,
            onDeleteGroup: handleDeleteGraphGroup,
            onRenameVariable: handleRenameGraphVariable,
            onDeleteVariable: handleDeleteGraphVariable,
            onDisconnect: handleDisconnect,
          },
          dragHandle: '.group-header',
        });
        externalY += getGroupHeight(group) + GROUP_GAP_Y;
      });

      const selectionX = externalCards.length > 0
        ? externalX + GROUP_WIDTH + PROPERTY_COLUMN_GAP
        : externalX;
      const selectionNodeId = getSelectionNodeId(selectedNode.id);
      const position = savedPositions[selectionNodeId] || { x: selectionX, y: 0 };
      newNodes.push({
        id: selectionNodeId,
        type: 'propertyNode',
        position,
        data: {
          nodeName: selectedNode.name,
          nodeType: selectedNode.type,
          layers: selectedLayers,
          truncated: selectedNode.truncated,
        } as PropertyNodeData,
        dragHandle: '.group-header',
      });
    }

    // Create visibility map for groups, keyed by CARD key — that is what a
    // connection record names. A container contributes the card it absorbed:
    // visible only when the container is on screen AND its own card is not
    // filtered out (the container can outlive its own rows when its children
    // are still visible).
    const groupVisibility = new Map<string, boolean>();
    newNodes.forEach(node => {
      if (node.type === 'groupNode') {
        groupVisibility.set(node.id, !node.hidden);
        return;
      }
      if (node.type === 'groupWrapper') {
        const wrapperData = node.data as WrapperNodeData;
        if (wrapperData.card) {
          groupVisibility.set(wrapperData.card.group.key, !node.hidden && !wrapperData.cardHidden);
        }
      }
    });

    // Hide edges if either source or target node is hidden
    const newEdges: Edge<CustomEdgeData>[] = connectionData
      .map(conn => {
        const toVarInfo = variableMap.get(conn.toVar);
        const sourceVisible = groupVisibility.get(conn.fromGroup) ?? false;
        const targetVisible = groupVisibility.get(conn.toGroup) ?? false;
        const edgeHidden = !sourceVisible || !targetVisible || isEdgeOffPath(conn.id, hidingPath);

        return {
          id: conn.id,
          // An absorbed card's rows live on its container node, so the edge
          // has to name the container — the card key is not a node id any more.
          source: edgeNodeId(conn.fromGroup),
          target: edgeNodeId(conn.toGroup),
          sourceHandle: `${conn.fromVar}::out`,
          targetHandle: `${conn.toVar}::in`,
          type: 'customEdge',
          hidden: edgeHidden,
          data: {
            kind: conn.kind,
            receiverName: toVarInfo?.node.id || '',
            receiverShortName: toVarInfo?.node.shortName || '',
            resolvedValue: toVarInfo?.node.resolvedValue || '',
            isHighlighted: hasHighlight && highlightedEdgeIds.has(conn.id),
            isDimmed: hasHighlight && !highlightedEdgeIds.has(conn.id),
            isGroupSibling: hasHighlight && !highlightedEdgeIds.has(conn.id)
              && (selectedCardVars.has(conn.fromVar) || selectedCardVars.has(conn.toVar)),
            onDisconnect: handleDisconnect,
          },
        };
      });

    // Edges from a bound token straight to the selected node's own property
    // row — same visual language as reference connections, but the receiver
    // is a live Figma property instead of another variable.
    // Bound rows are always visible on the card (rows inside a collapsed
    // section anchor their handle on that section's header), so every binding
    // gets an edge regardless of the card's session UI state.
    if (selectedNode) {
      const selectionNodeId = getSelectionNodeId(selectedNode.id);
      selectedLayers.forEach(layer => layer.entries.forEach((entry, index) => {
        if (entry.kind !== 'variable' || !entry.token || !entry.bindingTarget) return;
        // Prefer the real token card; fall back to the synthetic external card
        // when the token has no local match (library variable, etc.).
        const tokenInfo = variableMap.get(entry.token.name);
        const sourceGroupKey = tokenInfo ? tokenInfo.group : externalTokenCardKey.get(entry.token.name);
        if (!sourceGroupKey) return;
        const sourceVisible = groupVisibility.get(sourceGroupKey) ?? false;
        const bindingTarget = entry.bindingTarget;
        const layerNodeId = layer.id;

        newEdges.push({
          id: `prop-edge:${layer.layerIndex}:${index}`,
          source: edgeNodeId(sourceGroupKey),
          target: selectionNodeId,
          sourceHandle: `${entry.token.name}::out`,
          targetHandle: getPropertyHandleId(layer.layerIndex, index, 'in'),
          type: 'customEdge',
          hidden: !sourceVisible,
          data: {
            kind: 'reference',
            receiverName: entry.property,
            receiverShortName: entry.property,
            resolvedValue: '',
            onUnbindProperty: handleUnbindProperty,
            unbindNodeId: layerNodeId,
            unbindTarget: bindingTarget,
          },
        });
      }));
    }

    // No two boxes on screen overlap: a box that runs into one above it moves
    // down to sit the Grid Settings gap below it (see resolveOverlaps). This
    // is what keeps a record saved before the card-height fix — or a
    // Collection-mode drag under computed cards that grew — from drawing
    // cards on top of each other. Display only, never written back: the
    // record stays the user's, a clean layout comes back untouched, and the
    // next drag saves what is on screen. Hidden cards take no part.
    const nudged = resolveNodeOverlaps(newNodes, layoutGapY);
    if (nudged.size > 0) {
      newNodes.forEach((node, index) => {
        const position = nudged.get(node.id);
        if (position) newNodes[index] = { ...node, position };
      });
    }

    // Tier captions (and Collection column headers) over a column hide-unused
    // emptied go with it. Only while hiding: a filter-emptied tier column
    // keeps its caption, as it always has (a filter-emptied collection column
    // is not laid out at all).
    if (hidingPath) {
      const visibleBoxes: Array<{ x: number; width: number }> = [];
      newNodes.forEach(node => {
        if (node.hidden || node.parentId) return;
        if (node.type === 'groupNode') {
          visibleBoxes.push({ x: node.position.x, width: GROUP_WIDTH });
        } else if (node.type === 'groupWrapper') {
          const width = typeof node.style?.width === 'number' ? node.style.width : GROUP_WIDTH;
          visibleBoxes.push({ x: node.position.x, width });
        }
      });
      newNodes.forEach(node => {
        if (node.type !== 'tierLabel') return;
        node.hidden = isTierLabelHidden(node.data as TierLabelNodeData, visibleBoxes);
      });
    }

    // Unchanged nodes and edges keep their previous objects (no render, no
    // re-measure); changed nodes keep their last measurement — see
    // reconcileNodes in GroupedGraph/utils.
    setNodes(prev => reconcileNodes(prev, newNodes));
    setEdges(prev => reconcileEdges(prev, newEdges));
    setFocusableRowSignature(collectFocusableRowKeys(newNodes).join('\n'));
  }, [groupsData, connectionData, connectedVars, variableMap, positionsHydrated, collectionPositionsHydrated, settingsHydrated,
      savedPositionsRevision, groupedPaths,
      tierLabels, collectionNaturalLayout, hidingActivation,
      cardVisibilityFilters, variablesById, collectionNameById, selectedNode, selectedLayers,
      isColorType, variableType, handleGeneratorOpen, handleAddVariableToGroup,
      handleRenameGroup, handleDuplicateGroup, handleEditGroupAsText, handleLevelUp, handleUngroup, handleDeleteGraphGroup, handleRenameGraphVariable,
      handleDeleteGraphVariable, handleDisconnect, handleUnbindProperty, handleShowColorMenu, handleHighlightPath,
      handleHideUnusedFromCard, handleHighlightVariable, hasHighlight, highlightedVarName, highlightPath, hidingPath,
      sidebarUncheck, isCardHiddenNow, layoutGapY, setNodes, setEdges]);

  // Everything that can add, remove or move a handle *under an existing node
  // id*: a card's rows (handle ids are `${variable name}::in|out`, and the
  // output handle is suppressed for connection-disabled rows), and the
  // selection card's bindable rows. A drag, a highlight click or a filter
  // toggle changes none of it.
  const handleSignature = useMemo(() => {
    const cards = groupsData
      .map(g => `${g.key}[${g.variables
        .map(v => `${v.name}|${v.connectionsDisabled ? 1 : 0}|${v.virtualType || ''}`)
        .join(',')}]`)
      .join(';');
    // A container withholds its rows while its own card is filtered out (or
    // hidden by hide-unused). That
    // adds and removes handles under a node id that STAYS MOUNTED — unlike a
    // hidden card node, which xyflow removes wholesale — so the handle bounds
    // would go stale without a re-measure. A leaf card's visibility is
    // deliberately NOT in here: hiding it removes the node and its handles
    // with it.
    const containers = groupsData
      .filter(g => isAbsorbedCard(g, groupedPaths))
      .map(g => `${g.key}|${isCardHiddenNow(g) ? 0 : 1}`)
      .join(',');
    const selection = selectedNode
      ? `${getSelectionNodeId(selectedNode.id)}[${selectedLayers
        .map(layer => `${layer.layerIndex}:${layer.entries
          .map(e => `${e.kind}|${e.bindingTarget ? 1 : 0}|${e.token?.name || ''}`)
          .join(',')}`)
        .join(';')}]`
      : '';
    return `${cards}#${containers}#${selection}`;
  }, [groupsData, selectedNode, selectedLayers, groupedPaths, isCardHiddenNow]);

  const lastHandleSignatureRef = useRef<string | null>(null);
  const pendingMeasureNodesRef = useRef<Node[] | null>(null);

  // The selection card now carries a per-element id (see getSelectionNodeId),
  // so switching elements mounts a fresh node with correctly measured handles.
  // We still refresh internals here to cover in-place changes — e.g. rebinding a
  // property on the *same* selected element adds/removes handles under one id.
  //
  // `nodes` stays in the deps only so the re-measure runs against the array the
  // layout effect just committed; the signature guard turns every other `nodes`
  // identity change (a drag emits one per frame) into an early return, instead
  // of scheduling a re-measure of every node id in the graph.
  useEffect(() => {
    if (lastHandleSignatureRef.current !== handleSignature) {
      lastHandleSignatureRef.current = handleSignature;
      // The layout effect's setNodes lands in a *later* commit; remember the
      // pre-rebuild array so we measure the rebuilt one, not this one.
      pendingMeasureNodesRef.current = nodes;
    }
    if (pendingMeasureNodesRef.current === null) return;
    if (nodes.length === 0 || nodes === pendingMeasureNodesRef.current) return;
    const ids = nodes.map(n => n.id);
    const raf = requestAnimationFrame(() => {
      // Cleared only once the measure actually runs: if another `nodes` change
      // cancels this frame first, the request is still pending and the next
      // run re-schedules it against the newer array.
      pendingMeasureNodesRef.current = null;
      updateNodeInternals(ids);
    });
    return () => cancelAnimationFrame(raf);
  }, [nodes, handleSignature, updateNodeInternals]);

  // Save positions when nodes are dragged
  const savePositionsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The save the timeout above will run, so a temporary arrange can run it
  // early: left pending, it would read the temporary grid off the canvas and
  // persist it.
  const pendingPositionSaveRef = useRef<(() => void) | null>(null);

  // Collection mode's drag save records only the nodes that actually moved
  // (collected across the debounce window); everything else stays natural
  // and keeps re-flowing with filters and gaps.
  const movedNodeIdsRef = useRef<Set<string>>(new Set());
  // The start of the drag (or key press) each moving node is in, until its drop.
  const dragOriginsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  // A run of key presses (or drops) on the same nodes: each press is its own
  // drop, but the presses that only walk a card into the gap must not move
  // its slot, or the card that it then passes would move up to the walked
  // spot instead of the slot and the column would grow by a gap each swap.
  // Per node: its slot (moved only by a swap) and where the last drop left
  // it — the slot is used only while the node is still there.
  const dropWalkRef = useRef<Map<string, { slot: { x: number; y: number }; last: { x: number; y: number } }>>(new Map());
  // The mode a drag happens in decides where its save goes.
  const sortByRef = useRef(gridLayoutSettings.sortBy);
  sortByRef.current = gridLayoutSettings.sortBy;

  const handleNodesChangeWrapped = useCallback((rawChanges: Parameters<typeof onNodesChange>[0]) => {
    // Collection mode: a column unit only ever moves vertically. Rewritten
    // before xyflow applies it, so mouse drags, multi-selection drags and
    // keyboard moves are all covered; Tier mode's map is empty (identity).
    const changes = lockChangesToColumns(rawChanges, lockedXRef.current);
    // Where each moving node started (before its first drag tick or its key
    // press), read before xyflow applies the change: a drop that passes a
    // box swaps with it, and only the start tells which boxes it passed.
    changes.forEach(c => {
      if (c.type !== 'position' || !c.position || dragOriginsRef.current.has(c.id)) return;
      const node = reactFlowInstance.getNode(c.id);
      if (!node) return;
      const walk = dropWalkRef.current.get(c.id);
      const stillThere = walk
        && Math.abs(walk.last.x - node.position.x) < 0.5 && Math.abs(walk.last.y - node.position.y) < 0.5;
      dragOriginsRef.current.set(c.id, stillThere ? walk.slot : { x: node.position.x, y: node.position.y });
    });
    onNodesChange(changes);

    const positionChanges = changes.filter(c => c.type === 'position' && c.position);
    if (positionChanges.length > 0) {
      if (savePositionsTimeoutRef.current) clearTimeout(savePositionsTimeoutRef.current);
      positionChanges.forEach(c => { if (c.type === 'position') movedNodeIdsRef.current.add(c.id); });
      // A drop (drag end or keyboard move — never a drag tick) resolves at
      // once (see resolveDrop): a drop that passes boxes in its column swaps
      // with them like a reorder; otherwise the dropped boxes stay where the
      // user put them and every box they land on moves down to the gap below
      // them, cascading. Tier mode's save stores the whole canvas anyway.
      // Collection mode stores only what the next layout pass would not
      // reproduce by itself (see boxesToStore): the drop and the boxes it
      // swapped with — a box pushed down from below is pushed again by that
      // pass, so it stays unstored and keeps re-flowing with the filters.
      const dropped = new Map<string, { x: number; y: number }>();
      positionChanges.forEach(c => {
        if (c.type === 'position' && c.dragging === false && c.position) dropped.set(c.id, c.position);
      });
      if (dropped.size > 0) {
        const afterDrop = reactFlowInstance.getNodes().map(n => {
          const position = dropped.get(n.id);
          return position ? { ...n, position } : n;
        });
        const origins = new Map<string, { x: number; y: number }>();
        dropped.forEach((position, id) => origins.set(id, dragOriginsRef.current.get(id) ?? position));
        // Every move of this gesture ends here (a multi-selection drops at once).
        dragOriginsRef.current.clear();
        const pushed = resolveNodeDrop(afterDrop, layoutGapYRef.current, origins);
        const walks = new Map<string, { slot: { x: number; y: number }; last: { x: number; y: number } }>();
        dropped.forEach((position, id) => {
          const swapped = pushed.get(id);
          // A swap moves the slot to where the swap put the node.
          walks.set(id, { slot: swapped ?? origins.get(id)!, last: swapped ?? position });
        });
        dropWalkRef.current = walks;
        const natural = collectionNaturalLayoutRef.current;
        if (pushed.size > 0 && sortByRef.current === 'collection' && natural && hidingLayoutRef.current === null) {
          const shown = getNodeOverlapBoxes(afterDrop.map(n => {
            const position = pushed.get(n.id);
            return position ? { ...n, position } : n;
          }));
          const record = collectionPositionsRef.current;
          const passStart = new Map<string, number>();
          shown.forEach(box => {
            const y = record[box.id]?.y ?? natural.positions.get(box.id)?.y;
            if (y !== undefined) passStart.set(box.id, y);
          });
          boxesToStore(shown, passStart, movedNodeIdsRef.current, layoutGapYRef.current)
            .forEach(id => movedNodeIdsRef.current.add(id));
        }
        if (pushed.size > 0) {
          setNodes(prev => prev.map(n => {
            const position = pushed.get(n.id);
            return position ? { ...n, position } : n;
          }));
        }
      }
      // Decided when the drag happens, not when the save fires: a drag on a
      // temporary arrange only ever updates that layout, even if hiding ends
      // within the debounce (the layout is gone by then and the save is
      // dropped) — it must never reach a saved record. Likewise the record a
      // drag goes to is the one of the mode it was made in.
      const temporary = hidingLayoutRef.current !== null;
      const store = sortByRef.current;
      const save = () => {
        pendingPositionSaveRef.current = null;
        savePositionsTimeoutRef.current = null;
        const moved = movedNodeIdsRef.current;
        movedNodeIdsRef.current = new Set();
        const currentNodes = reactFlowInstance.getNodes();
        // Tier captions and column headers are not part of the graph and must
        // never enter a persisted record: on the next hydration they would
        // come back as phantom cards. A card inside a frame is frozen and
        // auto-stacked each render, so it is never saved: only its frame has
        // a position.
        const isSavable = (n: Node) => !isTierLabelNodeId(n.id) && !n.parentId;
        if (store === 'collection' && !temporary) {
          // Only the moved top-level nodes, merged into Collection mode's record.
          const record: PositionRecord = { ...collectionPositionsRef.current };
          currentNodes.forEach(n => {
            if (!moved.has(n.id) || !isSavable(n)) return;
            record[n.id] = { x: n.position.x, y: n.position.y };
          });
          collectionPositionsRef.current = record;
          post({ type: 'set-client-storage', key: `graph-positions-collection`, value: record });
          return;
        }
        const positionsObj: PositionRecord = {};
        currentNodes.forEach(n => {
          if (!isSavable(n)) return;
          // Top-level nodes save their absolute position as-is.
          positionsObj[n.id] = { x: n.position.x, y: n.position.y };
        });
        if (temporary) {
          setHidingLayout(prev => (prev ? { ...prev, positions: positionsObj } : prev));
          return;
        }
        const storageKey = `graph-positions`;
        // Synchronously too: an Arrange that flushes this save snapshots the
        // record through the ref before the state effect has run.
        savedPositionsRef.current = positionsObj;
        setSavedPositions(positionsObj);
        post({ type: 'set-client-storage', key: storageKey, value: positionsObj });
      };
      pendingPositionSaveRef.current = save;
      savePositionsTimeoutRef.current = setTimeout(save, 300);
    }
  }, [onNodesChange, reactFlowInstance, variableType, setSavedPositions, setNodes]);

  // Handle new connections (drag from handle to handle)
  const handleConnect: OnConnect = useCallback((connection) => {
    if (!connection.sourceHandle || !connection.targetHandle) return;

    const sourceIsProp = connection.sourceHandle.startsWith('prop:');
    const targetIsProp = connection.targetHandle.startsWith('prop:');

    // One side is the selected node's own property row — bind it to whichever
    // token variable is on the other end (regardless of which side was
    // dragged from first; xyflow doesn't guarantee drag direction here).
    if (sourceIsProp || targetIsProp) {
      if (sourceIsProp === targetIsProp) return;

      const propHandle = sourceIsProp ? connection.sourceHandle : connection.targetHandle;
      const tokenHandle = sourceIsProp ? connection.targetHandle : connection.sourceHandle;

      const indexMatch = propHandle.match(/^prop:(\d+):(\d+)::/);
      if (!indexMatch) return;
      const layer = selectedLayers[parseInt(indexMatch[1], 10)];
      const entry = layer?.entries[parseInt(indexMatch[2], 10)];
      if (!layer || !entry || !entry.bindingTarget) return;

      const tokenVarName = tokenHandle.replace('::out', '').replace('::in', '');
      const tokenVarInfo = variableMap.get(tokenVarName);
      if (!tokenVarInfo || tokenVarInfo.node.connectionsDisabled) return;

      post({ type: 'bind-node-property', nodeId: layer.id, target: entry.bindingTarget, variableId: tokenVarInfo.node.id });
      return;
    }

    const sourceVarName = connection.sourceHandle.replace('::out', '');
    const targetVarName = connection.targetHandle.replace('::in', '');

    const sourceVarInfo = variableMap.get(sourceVarName);
    const targetVarInfo = variableMap.get(targetVarName);
    if (!sourceVarInfo || !targetVarInfo) return;
    if (sourceVarInfo.node.connectionsDisabled || targetVarInfo.node.connectionsDisabled) return;

    const newValue = `{${sourceVarInfo.node.name}}`;
    const targetVariable = variablesById.get(targetVarInfo.node.id);
    const modeId = targetVariable
      ? resolveModeIdForCollection(collections, targetVariable.collectionId, selectedModeId)
      : selectedModeId;
    post({ type: 'update-variable-value', id: targetVarInfo.node.id, value: newValue, modeId });
  }, [collections, selectedModeId, variableMap, variablesById, selectedLayers]);

  // A drag save still pending belongs to the layout before an arrange: run it
  // now, against the positions it was meant for.
  const flushPendingPositionSave = useCallback(() => {
    if (!pendingPositionSaveRef.current) return;
    if (savePositionsTimeoutRef.current) clearTimeout(savePositionsTimeoutRef.current);
    pendingPositionSaveRef.current();
  }, []);

  // A temporary arrange (while hiding) from an Apply that switched "Sort by":
  // the saved one-step undo belongs to the mode being left, so it moves into
  // the temporary layout, and Undo Arrange gives it back with the mode
  // (handleUndoArrange). Null for an arrange that switched nothing.
  const setAsideSavedUndo = useCallback((previousSortBy: GraphSortBy | undefined) => {
    if (!previousSortBy) return null;
    const savedUndo = lastArrangeUndoRef.current;
    lastArrangeUndoRef.current = null;
    setHasArrangeUndo(false);
    return { previousSortBy, savedUndo };
  }, []);

  const handleArrangeGrid = useCallback((overrideSettings?: GridLayoutSettings) => {
    const settings = overrideSettings || gridLayoutSettings;
    // An Apply that switched "Sort by" also records the mode it left, so Undo
    // switches back (`gridLayoutSettings` here is still the pre-Apply value).
    const previousSortBy = settings.sortBy !== gridLayoutSettings.sortBy ? gridLayoutSettings.sortBy : undefined;

    // ── Collection mode ──────────────────────────────────────────────
    if (settings.sortBy === 'collection') {
      if (hidingActivation !== null) {
        // Temporary, like Tier mode's: the columns of the cards on screen
        // right now, into `hidingLayout` only — never a saved record.
        flushPendingPositionSave();
        const layout = layoutCollectionColumns({
          items: buildCollectionColumnItems(groupsData, groupedPaths, isCardHiddenNow),
          collectionOrder: collections.map(collection => collection.id),
          gapX: settings.gapX,
          gapY: settings.gapY,
        });
        const headers: CollectionHeaderPlacement[] = layout.columns.map(column => ({
          kind: 'collection',
          collectionId: column.collectionId,
          name: collectionNameById.get(column.collectionId) || column.collectionId,
          x: column.x,
          width: column.width,
        }));
        const packed: PositionRecord = {};
        layout.positions.forEach((pos, key) => { packed[key] = pos; });
        const switched = setAsideSavedUndo(previousSortBy);
        setHidingLayout(prev => extendHidingLayout(
          getActiveHidingLayout(prev, hidingActivation),
          { activation: hidingActivation, positions: packed, tierLabels: headers },
          switched
        ));
        setSavedPositionsRevision(rev => rev + 1);
        setTimeout(() => {
          reactFlowInstance.fitView({ padding: 0.15, duration: 400 });
        }, 50);
        return;
      }
      // Saved: Arrange = reset. Every unit goes back to its natural slot,
      // the columns re-packed with the current gaps; nothing hidden needs
      // parking (a hidden unit has no x to lose and gets its slot when
      // shown). Undo writes the previous record back.
      flushPendingPositionSave();
      lastArrangeUndoRef.current = takeArrangeSnapshot(collectionPositionsRef.current, [], 'collection', previousSortBy);
      setHasArrangeUndo(true);
      collectionPositionsRef.current = {};
      post({ type: 'set-client-storage', key: `graph-positions-collection`, value: {} });
      setSavedPositionsRevision(rev => rev + 1);
      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.15, duration: 400 });
      }, 50);
      return;
    }

    // ── Tier mode ────────────────────────────────────────────────────
    const currentNodes = reactFlowInstance.getNodes();
    const currentGroups = groupsData.map(group => {
      // An absorbed card has no node of its own; seed it from the container
      // that draws it.
      const nodeId = nodeIdForCard(group.key);
      const rfNode = currentNodes.find(n => n.id === nodeId);
      return {
        ...group,
        x: rfNode?.position.x ?? group.initialX,
        y: rfNode?.position.y ?? group.initialY,
      };
    });

    // Fold cards into arrangeable units and split them by visibility. The
    // helper applies the SAME predicate the layout effect renders as
    // `node.hidden` (isCardHiddenNow: filters, selection-provider force-show
    // and hide-unused included), so a card that isn't on screen never reserves a grid slot —
    // which is what used to leave the large empty gaps.
    const wrapperFrames = new Map<string, WrapperFrameGeometry>();
    currentNodes.forEach(n => {
      if (n.type !== 'groupWrapper') return;
      wrapperFrames.set(n.id, { position: n.position, measuredHeight: n.measured?.height });
    });
    const {
      units: arrangeUnits,
      hiddenUnits,
      heightOverrides,
      unitKeyByGroupKey,
      hiddenByKey,
    } = buildArrangeUnits(currentGroups, groupedPaths, cardVisibilityFilters, wrapperFrames, isCardHiddenNow);

    // `visibleConnections` drive the packing, `allConnections` the tier each
    // unit sits in (hidden endpoints included) — see remapConnectionsToUnits.
    const { all: allConnections, visible: visibleConnections } =
      remapConnectionsToUnits(connectionData, unitKeyByGroupKey, hiddenByKey);

    // `tiers` describes the caption row: one entry per non-empty tier, each
    // one column wide. It is taken BEFORE the hidden units are parked below,
    // so a parked column never gets a caption of its own.
    const { positions: newPositions, tiers } = arrangeGroupsByConnectedBlocks(
      arrangeUnits, visibleConnections, settings.gapX, settings.gapY,
      {
        heightOverrides,
        depthConnections: allConnections,
      }
    );

    // While hide-unused hides something the arrange is temporary: the grid of
    // the visible path goes into `hidingLayout` only. Hidden units are not
    // parked — they keep their spot, so "Show all" brings back the layout from
    // before exactly — and nothing reaches `savedPositions`, client storage or
    // the saved undo snapshot (Undo Arrange pops the temporary layout).
    if (hidingActivation !== null) {
      // A drag save still pending from before would read the grid below off
      // the canvas: run it now, against the positions it was meant for.
      flushPendingPositionSave();
      setNodes(prevNodes =>
        prevNodes.map(rfNode => {
          if (rfNode.parentId) return rfNode;
          const pos = newPositions.get(rfNode.id);
          return pos ? { ...rfNode, position: { x: pos.x, y: pos.y } } : rfNode;
        })
      );
      const packed: Record<string, { x: number; y: number }> = {};
      newPositions.forEach((pos, key) => { packed[key] = pos; });
      // Re-arranging on top of a temporary layout keeps what it did not move
      // (a card the user dragged, then unticked) where it is now.
      const switched = setAsideSavedUndo(previousSortBy);
      setHidingLayout(prev => extendHidingLayout(
        getActiveHidingLayout(prev, hidingActivation),
        { activation: hidingActivation, positions: packed, tierLabels: tiers },
        switched
      ));
      // The captions come from `hidingLayout`, which the layout effect reads
      // through its ref.
      setSavedPositionsRevision(rev => rev + 1);
      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.15, duration: 400 });
      }, 50);
      return;
    }

    // A saved arrange from here on, so every hidden unit is a filtered one
    // (hide-unused arranges returned above). Hidden units get no slot, but
    // they must keep an entry in the saved record. Dropping it would re-seed
    // them from their natural origin on the next layout pass and drop them
    // straight on top of the arranged grid the moment the filter is lifted.
    // Park them in a spare column just right of the arranged content,
    // ordered by their pre-arrange position so the result is deterministic.
    if (hiddenUnits.length > 0) {
      hiddenUnits.sort(sortGroupsByPosition);
      const parkX = newPositions.size > 0
        ? Math.max(...Array.from(newPositions.values(), pos => pos.x)) + GROUP_WIDTH + settings.gapX
        : 0;
      let parkY = 0;
      hiddenUnits.forEach(unit => {
        newPositions.set(unit.key, { x: parkX, y: parkY });
        parkY += (heightOverrides.get(unit.key) ?? getGroupHeight(unit)) + settings.gapY;
      });
    }

    // One-step undo: the SAVED record and the tier captions from before the
    // arrange — never the live node positions (arrangeUndo.ts). A drag save
    // still pending belongs to the record before the arrange: flush it first.
    flushPendingPositionSave();
    lastArrangeUndoRef.current = takeArrangeSnapshot(savedPositionsRef.current, tierLabelsRef.current, 'tier', previousSortBy);
    setHasArrangeUndo(true);

    setNodes(prevNodes =>
      prevNodes.map(rfNode => {
        if (rfNode.parentId) return rfNode; // wrapped cards stay parent-relative
        const pos = newPositions.get(rfNode.id);
        return pos ? { ...rfNode, position: { x: pos.x, y: pos.y } } : rfNode;
      })
    );

    const positionsObj: Record<string, { x: number; y: number }> = {};
    newPositions.forEach((pos, key) => { positionsObj[key] = pos; });
    savedPositionsRef.current = positionsObj;
    setSavedPositions(positionsObj);
    // The graph must be re-laid out from the new record.
    setSavedPositionsRevision(rev => rev + 1);
    post({ type: 'set-client-storage', key: `graph-positions`, value: positionsObj });

    tierLabelsRef.current = tiers;
    setTierLabels(tiers);
    post({ type: 'set-client-storage', key: `graph-tier-labels`, value: tiers });

    // Deferred so the new positions are committed before we measure for fit.
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.15, duration: 400 });
    }, 50);
  }, [reactFlowInstance, groupsData, connectionData, collections, collectionNameById, gridLayoutSettings, groupedPaths,
      cardVisibilityFilters, isCardHiddenNow, setNodes, nodeIdForCard, hidingActivation, flushPendingPositionSave,
      setAsideSavedUndo]);

  // Undo of an Apply that switched "Sort by": the mode goes back, saved; the
  // gaps stay as applied.
  const restoreSortBy = useCallback((sortBy: GraphSortBy) => {
    const restored = normalizeGridLayoutSettings({ ...gridLayoutSettings, sortBy });
    setGridLayoutSettings(restored);
    setGridLayoutDraft(toGridLayoutDraft(restored));
    post({ type: 'set-client-storage', key: `graph-layout-settings`, value: restored });
  }, [gridLayoutSettings]);

  const handleUndoArrange = useCallback(() => {
    // A temporary arrange is undone by dropping it: the saved layout comes
    // back, and the saved one-step snapshot stays for a later undo. One that
    // came from an Apply switching "Sort by" also switches back (saved, as a
    // saved undo does) and returns the old mode's undo step it set aside.
    const temporary = hidingLayoutRef.current;
    if (temporary !== null) {
      setHidingLayout(null);
      setSavedPositionsRevision(rev => rev + 1);
      if (temporary.previousSortBy) {
        restoreSortBy(temporary.previousSortBy);
        lastArrangeUndoRef.current = temporary.savedUndo ?? null;
        setHasArrangeUndo(lastArrangeUndoRef.current !== null);
      }
      return;
    }
    const snapshot = lastArrangeUndoRef.current;
    if (!snapshot) return;

    // Written back verbatim — possibly `{}` — to the record it was taken
    // from. Units that had no saved position before the arrange get none now,
    // so they take the natural layout again and keep re-flowing with the
    // filters (the revision bump re-lays out).
    const previous = restoreArrangeSnapshot(snapshot);
    if (previous.store === 'collection') {
      collectionPositionsRef.current = previous.positions;
      post({ type: 'set-client-storage', key: `graph-positions-collection`, value: previous.positions });
    } else {
      savedPositionsRef.current = previous.positions;
      setSavedPositions(previous.positions);
      post({ type: 'set-client-storage', key: `graph-positions`, value: previous.positions });

      tierLabelsRef.current = previous.tierLabels;
      setTierLabels(previous.tierLabels);
      post({ type: 'set-client-storage', key: `graph-tier-labels`, value: previous.tierLabels });
    }
    setSavedPositionsRevision(rev => rev + 1);

    // The arrange was an Apply that switched "Sort by": switch it back, saved.
    if (previous.sortBy) restoreSortBy(previous.sortBy);

    lastArrangeUndoRef.current = null;
    setHasArrangeUndo(false);
  }, [restoreSortBy]);

  const handleFocusSelection = useCallback(() => {
    if (!selectedNode) return;
    const wanted = new Set<string>([getSelectionNodeId(selectedNode.id)]);
    selectedLayers.forEach(layer => layer.entries.forEach(entry => {
      if (entry.kind !== 'variable' || !entry.token) return;
      const info = variableMap.get(entry.token.name);
      if (info) {
        // The card may be drawn by the container that absorbed it.
        wanted.add(nodeIdForCard(info.group));
      } else {
        // Mirror the synthetic external-card key built during node layout —
        // bare path, deliberately not collection-scoped like `group:` is.
        const parts = entry.token.name.split('/');
        const groupName = parts.length > 1 ? parts.slice(0, -1).join('/') : entry.token.name;
        wanted.add(`ext-group:${groupName}`);
      }
    }));

    // fitView({nodes}) relies on xyflow's internal measured dimensions, which
    // aren't populated for these nodes — so compute the bounding box from the
    // store positions (flow coords) plus live DOM sizes and fitBounds instead.
    const zoom = reactFlowInstance.getViewport().zoom || 1;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let found = false;
    wanted.forEach(id => {
      const node = reactFlowInstance.getNode(id);
      const el = document.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"]`) as HTMLElement | null;
      if (!node || !el) return;
      const rect = el.getBoundingClientRect();
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + rect.width / zoom);
      maxY = Math.max(maxY, node.position.y + rect.height / zoom);
      found = true;
    });
    if (!found) return;
    reactFlowInstance.fitBounds(
      { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
      { padding: 0.2, duration: 400 }
    );
  }, [selectedNode, selectedLayers, variableMap, reactFlowInstance, nodeIdForCard]);

  // Auto-frame the selection (and its providers) whenever a NEW node is
  // selected in Figma — the selection card is laid out past every token card,
  // so without this it can land far outside the current viewport. Deferred so
  // the freshly-built nodes have painted before we measure them.
  const selectionId = selectedNode?.id;
  useEffect(() => {
    if (!selectionId) return;
    const timer = setTimeout(() => handleFocusSelection(), 150);
    return () => clearTimeout(timer);
  }, [selectionId, handleFocusSelection]);

  // Hide-unused just took cards away (toggled on with a highlight, or the
  // highlight moved while on): frame what is left. Turning it off frames
  // nothing here — only dropping a temporary arrange does (see hidingLayout),
  // since that is when the cards move. Plain fitView skips hidden
  // nodes. Deferred like Arrange Grid's fit, so the rebuilt nodes are
  // committed before we measure; it also lands after a search jump's own
  // zoom, which is fine — the jumped-to card is on the path it fits.
  // maxZoom 1: a short path (one card) would otherwise blow up to fill the
  // canvas.
  useEffect(() => {
    if (!isHidingUnused) return;
    const timer = setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.15, duration: 400, maxZoom: 1 });
    }, 50);
    return () => clearTimeout(timer);
  }, [isHidingUnused, highlightSignature, reactFlowInstance]);

  const handleApplyGridSettings = useCallback(() => {
    const settings = normalizeGridLayoutSettings({
      gapX: Number.parseInt(gridLayoutDraft.gapX, 10),
      gapY: Number.parseInt(gridLayoutDraft.gapY, 10),
      sortBy: gridLayoutDraft.sortBy,
    });
    const switchOnly = settings.sortBy !== gridLayoutSettings.sortBy
      && settings.gapX === gridLayoutSettings.gapX
      && settings.gapY === gridLayoutSettings.gapY;
    setGridLayoutSettings(settings);
    setGridLayoutDraft(toGridLayoutDraft(settings));
    post({
      type: 'set-client-storage',
      key: `graph-layout-settings`,
      value: settings,
    });
    if (switchOnly) {
      // Each mode keeps its own record, so a switch alone is lossless: it
      // just shows the other mode's layout. Arranging would wipe that mode's
      // manual moves. An undo step or a temporary arrange belongs to the
      // layout being left, so both go.
      flushPendingPositionSave();
      lastArrangeUndoRef.current = null;
      setHasArrangeUndo(false);
      setHidingLayout(null);
      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.15, duration: 400 });
      }, 50);
      return;
    }
    // Any other Apply arranges the mode it lands in with the new settings,
    // with Undo Arrange to get the previous layout (and mode) back.
    handleArrangeGrid(settings);
  }, [gridLayoutDraft, gridLayoutSettings, handleArrangeGrid, flushPendingPositionSave, reactFlowInstance]);

  return (
    <div className="flex flex-col w-full h-full" ref={groupedGraphRef}>
      <div className="flex items-center gap-3 p-3 bg-base border-b border-border shrink-0" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <TextButton
            variant="secondary"
            onClick={handleCreateGroup}
            disabled={localSelectedCollections.size === 0}
          >
            New Group
          </TextButton>
          <TextButton variant="secondary" onClick={() => handleArrangeGrid()}>
            Arrange Grid
          </TextButton>
          {(hasArrangeUndo || activeHidingLayout !== null) && (
            <TextButton variant="secondary" onClick={handleUndoArrange}>
              Undo Arrange
            </TextButton>
          )}
          {selectedNode && !hasMultipleSelection && (
            <TextButton variant="secondary" onClick={handleFocusSelection}>
              Focus Selection
            </TextButton>
          )}
          <TextButton
            variant="secondary"
            onClick={handleToggleHideUnused}
            title="Hides cards and wires not on the highlighted path"
            aria-pressed={hideUnused}
          >
            {hideUnused ? 'Show all' : 'Hide unused'}
          </TextButton>
          <Dropdown
            position="bottom-right"
            onOpenChange={(open) => {
              if (open) {
                setGridLayoutDraft(toGridLayoutDraft(gridLayoutSettings));
              }
            }}
          >
            <Dropdown.Trigger asChild>
              <TextButton variant="secondary">
                Grid Settings
              </TextButton>
            </Dropdown.Trigger>
            <Dropdown.Menu className="min-w-50 p-3">
              <div className="font-semibold mb-3 text-sm">Grid Layout</div>
              <div className="mb-3">
                {/* Edits the draft only, like the gap inputs: Apply saves the
                    mode and arranges, Cancel discards a switch. */}
                <span id="grid-sort-by" className="block text-[11px] mb-1 opacity-70">
                  Sort by
                </span>
                <div aria-labelledby="grid-sort-by" role="group">
                  <SegmentedControl
                    options={SORT_BY_OPTIONS}
                    value={gridLayoutDraft.sortBy}
                    onChange={sortBy => setGridLayoutDraft(prev => ({ ...prev, sortBy }))}
                    fullWidth
                  />
                </div>
              </div>
              <div className="mb-3">
                <label htmlFor="grid-gap-x" className="block text-[11px] mb-1 opacity-70">
                  Horizontal gap
                </label>
                <Input
                  id="grid-gap-x"
                  type="number"
                  min="0"
                  value={gridLayoutDraft.gapX}
                  onChange={e => setGridLayoutDraft(prev => ({ ...prev, gapX: e.target.value }))}
                />
              </div>
              <div className="mb-4">
                <label htmlFor="grid-gap-y" className="block text-[11px] mb-1 opacity-70">
                  Vertical gap
                </label>
                <Input
                  id="grid-gap-y"
                  type="number"
                  min="0"
                  value={gridLayoutDraft.gapY}
                  onChange={e => setGridLayoutDraft(prev => ({ ...prev, gapY: e.target.value }))}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <TextButton
                  variant="ghost"
                  onClick={() => setGridLayoutDraft(toGridLayoutDraft(gridLayoutSettings))}
                >
                  Cancel
                </TextButton>
                <TextButton variant="primary" onClick={handleApplyGridSettings}>
                  Apply
                </TextButton>
              </div>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </div>
      <div className="relative flex-1 w-full flex min-h-0">
        {/* Sidebar */}
        <SidebarFilter
          selectedModeId={selectedModeId}
          onModeChange={handleModeChange}
          selectedTypes={selectedTypes}
          onTypeToggle={handleTypeToggle}
          selectedCollections={localSelectedCollections}
          selectedGroups={selectedGroups}
          onSelectionChange={handleSelectionChange}
          highlightedGroupKey={highlightedGroupKey}
          onFocusPath={handleFocusPath}
          isPathFocusable={isPathFocusable}
          focusedRowKey={focusedRowKey}
          onSelectAllCollections={handleSelectAllCollections}
          showTypeFilters={true}
        />

        {/* Graph content */}
        <div className="flex-1 relative">
          <ReactFlow
          nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChangeWrapped}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={clearHighlight}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView={false}
        minZoom={0.2}
        maxZoom={3}
        defaultViewport={{ x: 50, y: 50, zoom: 1 }}
        proOptions={{ hideAttribution: true }}
        connectionLineStyle={{ stroke: REFERENCE_CONNECTION_COLOR, strokeWidth: 'var(--edge-width)', strokeDasharray: '4 2' }}
        className="w-full h-full bg-canvas!"
        snapToGrid
        snapGrid={[8, 8]}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]}
        panOnScroll
      >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            <MiniMap pannable zoomable />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </div>

      <GraphSearchPalette
        isOpen={searchOpen}
        items={searchItems}
        onClose={closeSearch}
        onActivate={handleSearchActivate}
      />

      {colorMenu.show && (
        <ColorValueMenu
          position={colorMenu.position}
          variableId={colorMenu.variableId}
          currentValue={colorMenu.value}
          onClose={hideColorMenu}
        />
      )}
    </div>
  );
}

// ── Exported component with ReactFlowProvider ──────────────────────

export function GroupedGraph() {
  return (
    <ReactFlowProvider>
      <GroupedGraphInner />
    </ReactFlowProvider>
  );
}
