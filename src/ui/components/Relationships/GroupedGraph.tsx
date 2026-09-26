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
import { getVariableGroupName } from '../../utils/groupFilters';
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

// Import from extracted files
import {
  CustomEdgeData,
  GroupData,
  VariableNode,
  ConnectionRecord,
  ConnectionFlags,
  GridLayoutSettings,
  GridLayoutDraft,
  TierPlacement,
  GroupNodeData,
  WrapperNodeData,
} from './GroupedGraph/types';
import {
  GROUP_WIDTH,
  ROW_HEIGHT,
  HEADER_HEIGHT,
  GROUP_PADDING,
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
} from './GroupedGraph/constants';
import { GroupNodeComponent } from './GroupedGraph/GraphNode';
import { GroupWrapperComponent } from './GroupedGraph/GraphWrapperNode';
import { TierLabelNode } from './GroupedGraph/TierLabelNode';
import { PropertyNodeComponent, PropertyNodeData, getPropertyHandleId } from './GroupedGraph/PropertyNode';
import { flattenLayers } from './GroupedGraph/propertyLayers';
import { buildWrapperLayout } from './GroupedGraph/wrapperLayout';
import { CustomEdge } from './GroupedGraph/GraphEdge';
import {
  getDefaultVariableValue,
  normalizePathSegment,
  getGroupHeight,
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
  isTierLabelNodeId,
  getWrapperKey,
  getGroupCardKey,
  bucketUnmanagedVariables,
  buildWrapperPathOwners,
  migrateGroupedPaths,
  migrateGraphPositions,
  isAbsorbedCard,
} from './GroupedGraph/utils';
import type { CardVisibilityFilters, WrapperFrameGeometry } from './GroupedGraph/utils';

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

const edgeTypes: EdgeTypes = {
  customEdge: CustomEdge,
};

// ── Inner component (needs ReactFlowProvider context) ──────────────

function GroupedGraphInner() {
  const { collections, variables, selectedCollectionIds, shadeGroups, selectedModeId, selectedNode, hasMultipleSelection } = useAppContext();
  const { openShadesModal, openStepsModal, openInputModal, openAddVariableModal, openBulkEdit } = useModalContext();
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
  // Tier captions from the last Arrange Grid run. Pure wayfinding chrome:
  // they carry no graph meaning, never reach `savedPositions`, and are
  // replaced only by Arrange, its undo, or hydration. The element objects are
  // handed to the caption nodes as `data` unchanged, so the layout effect
  // does not mint a fresh data identity on every pass.
  const [tierLabels, setTierLabels] = useState<TierPlacement[]>([]);
  const [positionsHydrated, setPositionsHydrated] = useState(false);
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
  // Highlight target: a group card (varName null = whole card's chain) or a
  // single variable row inside it (varName set = only that row's chain).
  const [highlightTarget, setHighlightTarget] = useState<{ groupKey: string; varName: string | null } | null>(null);
  const highlightedGroupKey = highlightTarget?.groupKey ?? null;
  const highlightedVarName = highlightTarget?.varName ?? null;
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
    groupedPaths: unknown;
  }>({ positions: null, groupedPaths: null });
  const [pendingStorageRevision, setPendingStorageRevision] = useState(0);
  const reactFlowInstance = useReactFlow();
  // One-step undo for the last "Arrange Grid" run: the top-level positions it
  // overwrote, so a single click can put everything back. Cleared after use
  // or once superseded by a fresh arrange.
  const lastArrangeUndoRef = useRef<Record<string, { x: number; y: number }> | null>(null);
  // The captions that were on screen before that arrange, restored with it.
  const lastArrangeTierLabelsRef = useRef<TierPlacement[]>([]);
  const [hasArrangeUndo, setHasArrangeUndo] = useState(false);

  // Get filter state from context
  const {
    setSelectedModeId: setGlobalModeId,
    selectedVariableTypes: selectedTypes,
    selectedCollectionIds: localSelectedCollections,
    selectedGroups,
    toggleVariableType,
    toggleCollection,
    toggleSelectedGroup,
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

  // Stats for the sidebar footer (based on currently selected collections)
  const sidebarStats = useMemo(() => {
    const filtered = variables.filter(v => localSelectedCollections.has(v.collectionId));
    const refPattern = /^\{(.+)\}$/;
    return {
      total: filtered.length,
      colors: filtered.filter(v => v.resolvedType === 'COLOR').length,
      numbers: filtered.filter(v => v.resolvedType === 'FLOAT').length,
      references: filtered.filter(v => refPattern.test(v.value)).length,
    };
  }, [variables, localSelectedCollections]);
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

  const handleCollectionToggle = useCallback((collectionId: string) => {
    toggleCollection(collectionId);
  }, [toggleCollection]);

  const handleTypeToggle = useCallback((type: string) => {
    toggleVariableType(type);
  }, [toggleVariableType]);

  const handleGroupToggle = useCallback((groupName: string) => {
    toggleSelectedGroup(groupName);
  }, [toggleSelectedGroup]);

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

  useEffect(() => {
    const storageKey = `graph-layout-settings`;
    setGridLayoutSettings(normalizeGridLayoutSettings({}));
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
    if (pending.positions === null && pending.groupedPaths === null) return;
    if (collections.length === 0) return;

    const owners = buildWrapperPathOwners(collections, variables);
    // Cards need EXACT-path ownership, frames need at-or-below — see
    // buildWrapperPathOwners. A collection whose only variable is
    // `test/test2/leaf` is inside the frame `test` but has no CARD there.
    const cardOwners = buildWrapperPathOwners(collections, variables, { exactPathOnly: true });

    if (pending.groupedPaths !== null) {
      const raw = pending.groupedPaths;
      const migrated = migrateGroupedPaths(raw, owners);
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
      const migrated = migrateGraphPositions(raw, owners, cardOwners);
      pending.positions = null;
      setSavedPositions(migrated);
      setSavedPositionsRevision(rev => rev + 1);
      if (JSON.stringify(raw) !== JSON.stringify(migrated)) {
        post({ type: 'set-client-storage', key: `graph-positions`, value: migrated });
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

  // Mutate + persist grouped-path state in one step.
  const persistGroupedPaths = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    setGroupedPaths(prev => {
      const next = updater(prev);
      post({ type: 'set-client-storage', key: `graph-grouped-paths`, value: Array.from(next) });
      return next;
    });
  }, []);

  // "Level up": wrap a card/wrapper together with its siblings into a frame
  // for their shared parent.
  //
  // A top-level path yields the EMPTY parent, which is the collection's own
  // frame — the case that used to return early and leave a card like `test`
  // with nowhere to rise to. The empty path itself has no parent (a
  // collection frame is the root), which is also why neither the collection
  // frame nor the collection root card offers the button.
  const handleLevelUp = useCallback((collectionId: string, path: string) => {
    if (!collectionId || !path) return;
    const parent = path.split('/').slice(0, -1).join('/');
    persistGroupedPaths(prev => {
      const next = new Set(prev);
      next.add(getWrapperKey(collectionId, parent));
      return next;
    });
  }, [persistGroupedPaths]);

  // Remove a wrapper frame (its cards/sub-wrappers pop back out).
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

  // Highlight the full connected chain of a group (toggle off if re-selected)
  const handleHighlightPath = useCallback((group: GroupData) => {
    setHighlightTarget(prev => (
      prev?.groupKey === group.key && prev.varName === null
        ? null
        : { groupKey: group.key, varName: null }
    ));
  }, []);

  // Highlight only one variable row's chain (toggle off if re-selected).
  const handleHighlightVariable = useCallback((group: GroupData, node: VariableNode) => {
    setHighlightTarget(prev => (
      prev?.groupKey === group.key && prev.varName === node.name
        ? null
        : { groupKey: group.key, varName: node.name }
    ));
  }, []);

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.type !== 'groupNode') return;
    // A collection root card with no loose variables has no chain to
    // highlight — clicking it would just dim the whole graph. One that does
    // hold rows behaves like any other card.
    const clickedGroup = (node.data as { group?: GroupData } | undefined)?.group;
    if (clickedGroup?.kind === 'collection' && clickedGroup.variables.length === 0) return;
    setHighlightTarget(prev => (
      prev?.groupKey === node.id && prev.varName === null
        ? null
        : { groupKey: node.id, varName: null }
    ));
  }, []);

  const clearHighlight = useCallback(() => setHighlightTarget(null), []);

  // Sidebar label click — same toggle behavior as clicking the card in the graph,
  // plus panning the canvas to it since (unlike a card click) it may be off-screen.
  const handleHighlightFromSidebar = useCallback((graphGroupKey: string) => {
    setHighlightTarget(prev => {
      const next = prev?.groupKey === graphGroupKey && prev.varName === null
        ? null
        : { groupKey: graphGroupKey, varName: null };
      if (next) {
        requestAnimationFrame(() => {
          try {
            // An absorbed card is drawn by its container, so pan to that node.
            reactFlowInstance.fitView({ nodes: [{ id: nodeIdForCard(graphGroupKey) }], duration: 400, padding: 0.5, maxZoom: 1 });
          } catch {
            // Node may not be rendered (filtered out) — highlight state still applies.
          }
        });
      }
      return next;
    });
  }, [reactFlowInstance, nodeIdForCard]);

  // Sidebar → canvas for a whole collection. No highlight: `highlightTarget`
  // addresses one group key, and a collection is a set of cards.
  const handleZoomToCollection = useCallback((collectionId: string) => {
    // Live nodes off the instance rather than the `nodes` state, so this
    // callback keeps one identity across layout passes (see the drag-perf work).
    const targets = reactFlowInstance
      .getNodes()
      .filter(node => {
        // Filtered-out cards stay in the node list as `hidden`. Zooming to one
        // would park the canvas on empty space.
        if (node.hidden) return false;
        if (node.type === 'groupNode') {
          return (node.data as { group?: GroupData } | undefined)?.group?.collectionId === collectionId;
        }
        // A container is a card too, and for a collection whose cards are all
        // grouped it may be the only node that collection has.
        if (node.type === 'groupWrapper') {
          return (node.data as WrapperNodeData | undefined)?.collectionId === collectionId;
        }
        return false;
      })
      .map(node => ({ id: node.id }));

    // Nothing visible to move to. Silent: the collection's own checkbox is in
    // the same row and is the reason.
    if (targets.length === 0) return;

    try {
      reactFlowInstance.fitView({ nodes: targets, duration: 400, padding: 0.2, maxZoom: 1 });
    } catch {
      // Same defence as the group case — a node can leave between read and fit.
    }
  }, [reactFlowInstance]);

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

      const baseY = index * (Math.max(
        HEADER_HEIGHT + ROW_HEIGHT + GROUP_PADDING * 2,
        HEADER_HEIGHT + (shadeNodes.length + 1) * ROW_HEIGHT + GROUP_PADDING * 2
      ) + GROUP_GAP_Y);

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

      const baseY = index * (Math.max(
        HEADER_HEIGHT + ROW_HEIGHT + GROUP_PADDING * 2,
        HEADER_HEIGHT + (stepNodes.length + 1) * ROW_HEIGHT + GROUP_PADDING * 2
      ) + GROUP_GAP_Y);

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

  // The one definition of "is this card on screen right now", shared by the
  // layout effect (which renders the answer as node.hidden) and Arrange Grid
  // (which must skip hidden cards instead of reserving empty grid slots).
  const cardVisibilityFilters = useMemo<CardVisibilityFilters>(() => ({
    selectedCollections: localSelectedCollections,
    selectedTypes,
    selectedGroups,
    variablesById,
    selectionProviderGroupKeys,
  }), [localSelectedCollections, selectedTypes, selectedGroups, variablesById, selectionProviderGroupKeys]);

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

  // Build React Flow nodes/edges when data changes
  // Note: Filtering applied here to hide nodes/edges without removing connections
  useEffect(() => {
    if (!positionsHydrated) return;
    // Read through the ref: see savedPositionsRef above.
    const savedPositions = savedPositionsRef.current;

    // Resolve the highlighted lineage of the selected card. References are
    // per-variable (row), so we trace the chain at the VARIABLE level using
    // fromVar/toVar — otherwise passing through an intermediate card would fan
    // out to every row's provider instead of staying on the one chain.
    // Walk upstream (providers, follow edges backward) and downstream
    // (dependents, forward) independently so siblings are never picked up.
    const highlightedGroups = new Set<string>();
    const highlightedVars = new Set<string>();
    const highlightedEdgeIds = new Set<string>();
    // All variables in the selected card — used to tint its off-chain edges
    // in a faded highlight color (group membership vs. actual selection).
    const selectedCardVars = new Set<string>();
    if (highlightedGroupKey) {
      const varOutgoing = new Map<string, Array<{ edgeId: string; varName: string }>>();
      const varIncoming = new Map<string, Array<{ edgeId: string; varName: string }>>();
      connectionData.forEach(conn => {
        if (!varOutgoing.has(conn.fromVar)) varOutgoing.set(conn.fromVar, []);
        varOutgoing.get(conn.fromVar)!.push({ edgeId: conn.id, varName: conn.toVar });
        if (!varIncoming.has(conn.toVar)) varIncoming.set(conn.toVar, []);
        varIncoming.get(conn.toVar)!.push({ edgeId: conn.id, varName: conn.fromVar });
      });

      // Seed with the single selected row, or every variable in the card.
      const selectedGroup = groupsData.find(g => g.key === highlightedGroupKey);
      selectedGroup?.variables.forEach(v => selectedCardVars.add(v.name));
      const seedVars = highlightedVarName
        ? [highlightedVarName]
        : (selectedGroup?.variables || []).map(v => v.name);
      seedVars.forEach(v => highlightedVars.add(v));

      const walk = (adjacency: Map<string, Array<{ edgeId: string; varName: string }>>) => {
        const visited = new Set<string>(seedVars);
        const stack = [...seedVars];
        while (stack.length > 0) {
          const current = stack.pop()!;
          (adjacency.get(current) || []).forEach(({ edgeId, varName }) => {
            highlightedEdgeIds.add(edgeId);
            highlightedVars.add(varName);
            if (!visited.has(varName)) {
              visited.add(varName);
              stack.push(varName);
            }
          });
        }
      };

      walk(varIncoming); // upstream providers (where it comes from)
      walk(varOutgoing); // downstream dependents (what uses it)

      // Cards containing any highlighted variable get emphasized.
      highlightedVars.forEach(varName => {
        const info = variableMap.get(varName);
        if (info) highlightedGroups.add(info.group);
      });
      highlightedGroups.add(highlightedGroupKey);
    }
    const hasHighlight = highlightedGroupKey !== null;

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

    // Visibility comes from the shared predicate (GroupedGraph/utils) so that
    // Arrange Grid applies exactly the same rule — see cardVisibilityFilters.
    const cardHidden = (group: GroupData) => isCardHidden(group, cardVisibilityFilters);

    // One card's worth of node data. Shared, because a CONTAINER renders the
    // card it absorbed from exactly this object — same header, same rows,
    // same actions (part 4).
    const buildCardData = (group: GroupData): GroupNodeData => {
      const firstRealVar = group.variables.find(v => !v.isVirtual);
      const sourceVariable = firstRealVar ? variablesById.get(firstRealVar.id) : null;
      const groupIsColorType = sourceVariable?.resolvedType === 'COLOR';
      return {
        group,
        isColorType: groupIsColorType,
        variableType: groupIsColorType ? 'COLOR' : 'FLOAT',
        connectedVars,
        isHighlighted: hasHighlight && highlightedGroups.has(group.key),
        isDimmed: hasHighlight && !highlightedGroups.has(group.key),
        highlightActive: hasHighlight,
        highlightedVars,
        highlightedVarSeed: highlightedVarName,
        onHighlightPath: handleHighlightPath,
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
      ...(parentId ? { parentId, extent: 'parent' as const } : {}),
      data: buildCardData(group),
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
    tierLabels.forEach(label => {
      newNodes.push({
        id: `${TIER_LABEL_NODE_PREFIX}${label.tier}`,
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
    const placements = buildWrapperLayout(standardCards, groupedPaths, savedPositions);
    const cardHiddenByKey = new Map<string, boolean>();
    standardCards.forEach(g => cardHiddenByKey.set(g.key, cardHidden(g)));

    // Card key → the node that draws it. A card a container absorbed is no
    // longer a node of its own, and every edge endpoint names a CARD key, so
    // this is what keeps those edges attached to something that exists.
    const cardNodeId = new Map<string, string>();
    // Containers that actually hold something below their own rows — the
    // separator between the two depends on it.
    const containerChildCount = new Map<string, number>();
    placements.forEach(p => {
      if (p.kind === 'wrapper' && p.group) cardNodeId.set(p.group.key, p.id);
      if (p.parentId) {
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
          ...(p.parentId ? { parentId: p.parentId, extent: 'parent' as const } : {}),
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
      const maxRight = groupsData.reduce((max, g) => Math.max(max, g.initialX + GROUP_WIDTH), 0);
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
          hidden: false,
          data: {
            group,
            isColorType: bucket.nodes.every(n => n.resolvedType === 'COLOR'),
            variableType: 'FLOAT',
            connectedVars,
            isHighlighted: false,
            isDimmed: false,
            highlightActive: hasHighlight,
            highlightedVars,
            highlightedVarSeed: highlightedVarName,
            onHighlightPath: handleHighlightPath,
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
        const edgeHidden = !sourceVisible || !targetVisible;

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

    setNodes(newNodes);
    setEdges(newEdges);
  }, [groupsData, connectionData, connectedVars, variableMap, positionsHydrated, savedPositionsRevision, groupedPaths,
      tierLabels,
      cardVisibilityFilters, variablesById, collectionNameById, selectedNode, selectedLayers,
      isColorType, variableType, handleGeneratorOpen, handleAddVariableToGroup,
      handleRenameGroup, handleDuplicateGroup, handleEditGroupAsText, handleLevelUp, handleUngroup, handleDeleteGraphGroup, handleRenameGraphVariable,
      handleDeleteGraphVariable, handleDisconnect, handleUnbindProperty, handleShowColorMenu, handleHighlightPath,
      handleHighlightVariable, highlightedGroupKey, highlightedVarName, setNodes, setEdges]);

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
    // A container withholds its rows while its own card is filtered out. That
    // adds and removes handles under a node id that STAYS MOUNTED — unlike a
    // hidden card node, which xyflow removes wholesale — so the handle bounds
    // would go stale without a re-measure. A leaf card's visibility is
    // deliberately NOT in here: hiding it removes the node and its handles
    // with it.
    const containers = groupsData
      .filter(g => isAbsorbedCard(g, groupedPaths))
      .map(g => `${g.key}|${isCardHidden(g, cardVisibilityFilters) ? 0 : 1}`)
      .join(',');
    const selection = selectedNode
      ? `${getSelectionNodeId(selectedNode.id)}[${selectedLayers
        .map(layer => `${layer.layerIndex}:${layer.entries
          .map(e => `${e.kind}|${e.bindingTarget ? 1 : 0}|${e.token?.name || ''}`)
          .join(',')}`)
        .join(';')}]`
      : '';
    return `${cards}#${containers}#${selection}`;
  }, [groupsData, selectedNode, selectedLayers, groupedPaths, cardVisibilityFilters]);

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

  const handleNodesChangeWrapped = useCallback((changes: Parameters<typeof onNodesChange>[0]) => {
    onNodesChange(changes);

    const hasPositionChanges = changes.some(c => c.type === 'position' && c.position);
    if (hasPositionChanges) {
      if (savePositionsTimeoutRef.current) clearTimeout(savePositionsTimeoutRef.current);
      savePositionsTimeoutRef.current = setTimeout(() => {
        const currentNodes = reactFlowInstance.getNodes();
        const positionsObj: Record<string, { x: number; y: number }> = {};
        currentNodes.forEach(n => {
          // Tier captions are not part of the graph and must never enter the
          // persisted record: on the next hydration they would come back as
          // phantom cards.
          if (isTierLabelNodeId(n.id)) return;
          // Top-level nodes save their absolute position as-is. Nested
          // cards/wrappers are normally auto-stacked inside their parent each
          // render, but a manual drag is remembered under a `rel:` key (same
          // record, namespaced) so buildWrapperLayout can honor it instead —
          // applies uniformly at every nesting depth.
          if (n.parentId) {
            positionsObj[`rel:${n.id}`] = { x: n.position.x, y: n.position.y };
          } else {
            positionsObj[n.id] = { x: n.position.x, y: n.position.y };
          }
        });
        const storageKey = `graph-positions`;
        setSavedPositions(positionsObj);
        post({ type: 'set-client-storage', key: storageKey, value: positionsObj });
      }, 300);
    }
  }, [onNodesChange, reactFlowInstance, variableType, setSavedPositions]);

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

  const handleArrangeGrid = useCallback((overrideSettings?: GridLayoutSettings) => {
    const settings = overrideSettings || gridLayoutSettings;
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
    // `node.hidden` (cardVisibilityFilters, selection-provider force-show
    // included), so a card that isn't on screen never reserves a grid slot —
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
    } = buildArrangeUnits(currentGroups, groupedPaths, cardVisibilityFilters, wrapperFrames);

    // Remap connections onto their unit keys; a connection that becomes a
    // self-loop within one unit (both ends now the same wrapper) is dropped.
    // Two lists come out of this, and the difference matters:
    //  - `visibleConnections` drives the packing. An edge that isn't drawn
    //    must not shape where the cards land.
    //  - `allConnections` drives the tier (topological depth) each card sits
    //    in, hidden endpoints included. Dropping those edges here is what made
    //    deselecting `_global` turn every token that references it into a root
    //    and flatten the graph into two very long columns.
    const allConnections: ConnectionRecord[] = [];
    const visibleConnections: ConnectionRecord[] = [];
    connectionData.forEach(conn => {
      const fromUnit = unitKeyByGroupKey.get(conn.fromGroup);
      const toUnit = unitKeyByGroupKey.get(conn.toGroup);
      if (!fromUnit || !toUnit) return;
      if (fromUnit === toUnit) return;
      const remapped: ConnectionRecord = { ...conn, fromGroup: fromUnit, toGroup: toUnit };
      allConnections.push(remapped);
      if (hiddenByKey.get(conn.fromGroup) || hiddenByKey.get(conn.toGroup)) return;
      visibleConnections.push(remapped);
    });

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

    // Hidden units get no slot, but they must keep an entry in the saved
    // record. Dropping it would re-seed them from their natural origin on the
    // next layout pass and drop them straight on top of the arranged grid the
    // moment the filter is lifted. Park them in a spare column just right of
    // the arranged content, ordered by their pre-arrange position so the
    // result is deterministic. Undo restores their real positions anyway (the
    // snapshot below covers every top-level node, hidden ones included).
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

    // Snapshot current top-level positions for one-step undo before applying.
    const previousPositions: Record<string, { x: number; y: number }> = {};
    currentNodes.forEach(n => {
      if (n.parentId) return;
      // Captions are chrome, not positions — keeping them out here keeps them
      // out of `savedPositions` when the undo writes this record back.
      if (isTierLabelNodeId(n.id)) return;
      previousPositions[n.id] = { x: n.position.x, y: n.position.y };
    });
    lastArrangeUndoRef.current = previousPositions;
    lastArrangeTierLabelsRef.current = tierLabels;
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
    setSavedPositions(positionsObj);
    // Arrange also drops the `rel:` overrides of manually moved nested cards,
    // so the graph must be re-laid out from the new record.
    setSavedPositionsRevision(rev => rev + 1);
    post({ type: 'set-client-storage', key: `graph-positions`, value: positionsObj });

    setTierLabels(tiers);
    post({ type: 'set-client-storage', key: `graph-tier-labels`, value: tiers });

    // Deferred so the new positions are committed before we measure for fit.
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.15, duration: 400 });
    }, 50);
  }, [reactFlowInstance, groupsData, connectionData, gridLayoutSettings, groupedPaths, cardVisibilityFilters, setNodes, variableType, tierLabels, nodeIdForCard]);

  const handleUndoArrange = useCallback(() => {
    const previousPositions = lastArrangeUndoRef.current;
    if (!previousPositions) return;

    setNodes(prevNodes =>
      prevNodes.map(rfNode => {
        if (rfNode.parentId) return rfNode;
        const pos = previousPositions[rfNode.id];
        return pos ? { ...rfNode, position: { x: pos.x, y: pos.y } } : rfNode;
      })
    );
    setSavedPositions(previousPositions);
    setSavedPositionsRevision(rev => rev + 1);
    post({ type: 'set-client-storage', key: `graph-positions`, value: previousPositions });

    const previousTierLabels = lastArrangeTierLabelsRef.current;
    setTierLabels(previousTierLabels);
    post({ type: 'set-client-storage', key: `graph-tier-labels`, value: previousTierLabels });

    lastArrangeUndoRef.current = null;
    lastArrangeTierLabelsRef.current = [];
    setHasArrangeUndo(false);
  }, [setNodes]);

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

  const handleApplyGridSettings = useCallback(() => {
    const settings = normalizeGridLayoutSettings({
      gapX: Number.parseInt(gridLayoutDraft.gapX, 10),
      gapY: Number.parseInt(gridLayoutDraft.gapY, 10),
    });
    setGridLayoutSettings(settings);
    setGridLayoutDraft(toGridLayoutDraft(settings));
    post({
      type: 'set-client-storage',
      key: `graph-layout-settings`,
      value: settings,
    });
    handleArrangeGrid(settings);
  }, [gridLayoutDraft, variableType, handleArrangeGrid]);

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
          {hasArrangeUndo && (
            <TextButton variant="secondary" onClick={handleUndoArrange}>
              Undo Arrange
            </TextButton>
          )}
          {selectedNode && !hasMultipleSelection && (
            <TextButton variant="secondary" onClick={handleFocusSelection}>
              Focus Selection
            </TextButton>
          )}
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
          onCollectionToggle={handleCollectionToggle}
          selectedGroups={selectedGroups}
          onGroupToggle={handleGroupToggle}
          highlightedGroupKey={highlightedGroupKey}
          onHighlightGroup={handleHighlightFromSidebar}
          onZoomToCollection={handleZoomToCollection}
          showTypeFilters={true}
          footer={
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] opacity-70">
              <span>{sidebarStats.total} variables</span>
              <span>{sidebarStats.colors} colors</span>
              <span>{sidebarStats.numbers} numbers</span>
              <span>{sidebarStats.references} references</span>
            </div>
          }
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
        connectionLineStyle={{ stroke: REFERENCE_CONNECTION_COLOR, strokeWidth: 2, strokeDasharray: '4 2' }}
        className="w-full h-full bg-base-2!"
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
