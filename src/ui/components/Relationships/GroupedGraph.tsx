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
import { CollectionData, ShadeGroupData, VariableData } from '../../types';
import { resolveModeIdForCollection } from '../../utils/modes';
import { getCollectionGroupKey, getVariableGroupName, isVariableVisibleForGroupFilters } from '../../utils/groupFilters';
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
  WRAPPER_HEADER_HEIGHT,
  WRAPPER_PADDING,
  WRAPPER_GAP,
} from './GroupedGraph/constants';
import { GroupNodeComponent } from './GroupedGraph/GraphNode';
import { GroupWrapperComponent } from './GroupedGraph/GraphWrapperNode';
import { PropertyNodeComponent, PropertyNodeData, getPropertyCardHeight } from './GroupedGraph/PropertyNode';
import { buildWrapperLayout } from './GroupedGraph/wrapperLayout';
import { CustomEdge } from './GroupedGraph/GraphEdge';
import {
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
} from './GroupedGraph/utils';

// ── Node & Edge type registrations ─────────────────────────────────

const nodeTypes: NodeTypes = {
  groupNode: GroupNodeComponent,
  groupWrapper: GroupWrapperComponent,
  propertyNode: PropertyNodeComponent,
};

const PROPERTY_COLUMN_GAP = 220;

// The selection card's xyflow id is derived from the selected Figma node id so
// that switching elements mounts a *fresh* node. xyflow caches handle geometry
// per node id; reusing one static id across selections leaves stale handle
// bounds, and edges whose target handle can't be located are silently dropped
// (the row's handle still shows, but no connecting line is drawn).
const getSelectionNodeId = (figmaNodeId: string) => `selection:${figmaNodeId}`;

// Shallowest (outermost) grouped ancestor of `path` — the top-level wrapper
// that ultimately contains it, even when wrappers are nested inside one
// another. Mirrors wrapperLayout.ts's path-prefix walk but stops at the
// FIRST match (ascending depth) instead of the deepest one, since Arrange
// treats a whole nested wrapper frame as a single movable unit.
const outermostGroupedAncestor = (path: string, grouped: Set<string>): string | null => {
  const parts = path.split('/');
  for (let depth = 1; depth < parts.length; depth++) {
    const prefix = parts.slice(0, depth).join('/');
    if (grouped.has(prefix)) return prefix;
  }
  return null;
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

  // Support both COLOR and FLOAT variables - groups are typed individually based on their variables
  // Storage keys are now type-independent since we show all types together
  // Default to COLOR type for backwards compatibility with color-specific features (can be mixed now)
  const hasColorVars = variables.some(v => v.resolvedType === 'COLOR');
  const hasNumberVars = variables.some(v => v.resolvedType === 'FLOAT');
  // For features that need a type, prefer COLOR if available (for color menu, shades, etc.)
  const variableType: 'COLOR' | 'FLOAT' = hasColorVars ? 'COLOR' : 'FLOAT';
  const isColorType = variableType === 'COLOR';
  const [savedPositions, setSavedPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [gridLayoutSettings, setGridLayoutSettings] = useState<GridLayoutSettings>({
    gapX: GROUP_GAP_X,
    gapY: GROUP_GAP_Y,
  });
  const [gridLayoutDraft, setGridLayoutDraft] = useState<GridLayoutDraft>({
    gapX: String(GROUP_GAP_X),
    gapY: String(GROUP_GAP_Y),
  });
  const [positionsHydrated, setPositionsHydrated] = useState(false);
  // Highlight target: a group card (varName null = whole card's chain) or a
  // single variable row inside it (varName set = only that row's chain).
  const [highlightTarget, setHighlightTarget] = useState<{ groupKey: string; varName: string | null } | null>(null);
  const highlightedGroupKey = highlightTarget?.groupKey ?? null;
  const highlightedVarName = highlightTarget?.varName ?? null;
  // Parent paths the user has wrapped into a group frame. Empty = flat leaf
  // cards. A path here draws a wrapper around all cards sharing that parent.
  const [groupedPaths, setGroupedPaths] = useState<Set<string>>(new Set());
  const reactFlowInstance = useReactFlow();
  // One-step undo for the last "Arrange Grid" run: the top-level positions it
  // overwrote, so a single click can put everything back. Cleared after use
  // or once superseded by a fresh arrange.
  const lastArrangeUndoRef = useRef<Record<string, { x: number; y: number }> | null>(null);
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
    post({ type: 'get-client-storage', key: storageKey });

    const handleStorage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (msg?.type === 'client-storage-data' && msg.key === storageKey) {
        setSavedPositions(msg.value || {});
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

  // Load grouped-path state (per variable type)
  useEffect(() => {
    const storageKey = `graph-grouped-paths`;
    setGroupedPaths(new Set());
    post({ type: 'get-client-storage', key: storageKey });

    const handleStorage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (msg?.type === 'client-storage-data' && msg.key === storageKey) {
        setGroupedPaths(new Set(Array.isArray(msg.value) ? msg.value : []));
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
  // for their shared parent path.
  const handleLevelUp = useCallback((path: string) => {
    if (!path || !path.includes('/')) return;
    const parent = path.split('/').slice(0, -1).join('/');
    if (!parent) return;
    persistGroupedPaths(prev => {
      const next = new Set(prev);
      next.add(parent);
      return next;
    });
  }, [persistGroupedPaths]);

  // Remove a wrapper frame (its cards/sub-wrappers pop back out).
  const handleUngroup = useCallback((path: string) => {
    if (!path) return;
    persistGroupedPaths(prev => {
      const next = new Set(prev);
      next.delete(path);
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
    if (group.kind !== 'standard' || !group.sourceGroupName) return;

    openAddVariableModal({
      title: `New Variable in ${group.sourceGroupName}`,
      confirmText: 'Add',
      onConfirm: (name, type) => {
        const variableName = normalizePathSegment(name);
        if (!variableName) return;
        post({
          type: 'create-variable',
          collectionId: group.collectionId,
          name: `${group.sourceGroupName}/${variableName}`,
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
            reactFlowInstance.fitView({ nodes: [{ id: graphGroupKey }], duration: 400, padding: 0.5, maxZoom: 1 });
          } catch {
            // Node may not be rendered (filtered out) — highlight state still applies.
          }
        });
      }
      return next;
    });
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
    const unmanagedGroupsMap = new Map<string, { nodes: VariableNode[]; collectionId: string }>();

    unmanagedVars.forEach(variable => {
      // Cards are leaf groups (one per parent path) — wrappers group cards
      // visually without merging their variables.
      const parts = variable.name.split('/');
      const groupName = parts.length > 1 ? parts.slice(0, -1).join('/') : variable.name;
      const existing = unmanagedGroupsMap.get(groupName) || { nodes: [], collectionId: variable.collectionId };
      // Use the actual variable's type instead of global isColorType
      const varIsColorType = variable.resolvedType === 'COLOR';
      existing.nodes.push(formatVariableNode(variable, varsByName, varIsColorType, collections, selectedModeId));
      unmanagedGroupsMap.set(groupName, existing);
    });

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
    Array.from(unmanagedGroupsMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([groupName, { nodes: groupVariables, collectionId }]) => {
        const hasReferences = groupVariables.some(v => v.isReference);
        unmanagedEntries.push({ groupName, groupVariables, collectionId, hasReferences });
      });

    // Primitives (no references) go at column 0, stacked below managed source groups
    let primitiveY = managedLaneBottoms.get(0) || 0;
    unmanagedEntries.filter(e => !e.hasReferences).forEach(entry => {
      const groupKey = `group:${entry.groupName}`;
      const groupData: GroupData = {
        key: groupKey, title: entry.groupName, variables: entry.groupVariables,
        x: 0, y: 0, initialX: 0, initialY: primitiveY,
        kind: 'standard', sourceGroupName: entry.groupName, headerFill: STANDARD_GROUP_HEADER_FILL,
        collectionId: entry.collectionId,
        canGroup: entry.groupName.includes('/'),
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
    let semanticY = 0;
    unmanagedEntries.filter(e => e.hasReferences).forEach(entry => {
      const groupKey = `group:${entry.groupName}`;
      const groupData: GroupData = {
        key: groupKey, title: entry.groupName, variables: entry.groupVariables,
        x: 0, y: 0, initialX: 0, initialY: semanticY,
        kind: 'standard', sourceGroupName: entry.groupName, headerFill: STANDARD_GROUP_HEADER_FILL,
        collectionId: entry.collectionId,
        canGroup: entry.groupName.includes('/'),
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

    // Resolve the highlighted lineage of the selected card. References are
    // per-variable (row), so we trace the chain at the VARIABLE level using
    // fromVar/toVar — otherwise passing through an intermediate card would fan
    // out to every row's provider instead of staying on the one chain.
    // Walk upstream (providers, follow edges backward) and downstream
    // (dependents, forward) independently so siblings are never picked up.
    const highlightedGroups = new Set<string>();
    const highlightedVars = new Set<string>();
    const highlightedEdgeIds = new Set<string>();
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
    const selectionProviderGroupKeys = new Set<string>();
    const externalTokenCardKey = new Map<string, string>();
    const externalTokensByCard = new Map<string, { title: string; collectionId: string; nodes: VariableNode[] }>();
    if (selectedNode) {
      selectedNode.entries.forEach(entry => {
        if (entry.kind !== 'variable' || !entry.token) return;
        const info = variableMap.get(entry.token.name);
        if (info) {
          selectionProviderGroupKeys.add(info.group);
          return;
        }
        // No local match — bucket into a synthetic card by path prefix.
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
    }

    // Determine whether a card is hidden by the active filters.
    const isCardHidden = (group: GroupData): boolean => {
      if (!localSelectedCollections.has(group.collectionId)) return true;

      const hasMatchingType = group.variables.some(v => {
        if (v.isVirtual) return true;
        const sourceVar = variablesById.get(v.id);
        return sourceVar && selectedTypes.has(sourceVar.resolvedType);
      });
      if (!hasMatchingType) return true;

      let hasMatchingGroup = false;
      if (group.kind === 'shader' || group.kind === 'shades') {
        if (group.sourceGroupName) {
          hasMatchingGroup = selectedGroups.has(
            getCollectionGroupKey(group.collectionId, group.sourceGroupName)
          );
        }
      } else {
        hasMatchingGroup = group.variables.some(v => {
          if (v.isVirtual) return false;
          return isVariableVisibleForGroupFilters(
            { collectionId: group.collectionId, name: v.name },
            selectedGroups
          );
        });
      }
      return !hasMatchingGroup;
    };

    const buildCardNode = (
      group: GroupData,
      position: { x: number; y: number },
      parentId: string | null
    ): Node => {
      const firstRealVar = group.variables.find(v => !v.isVirtual);
      const sourceVariable = firstRealVar ? variablesById.get(firstRealVar.id) : null;
      const groupIsColorType = sourceVariable?.resolvedType === 'COLOR';
      const groupVariableType = groupIsColorType ? 'COLOR' : 'FLOAT';
      return {
        id: group.key,
        type: 'groupNode',
        position,
        // Force-show cards that provide a value to the current selection,
        // even when the active filters would otherwise hide them.
        hidden: isCardHidden(group) && !selectionProviderGroupKeys.has(group.key),
        ...(parentId ? { parentId, extent: 'parent' as const } : {}),
        data: {
          group,
          isColorType: groupIsColorType,
          variableType: groupVariableType,
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
        },
        dragHandle: '.group-header',
      };
    };

    const standardCards = groupsData.filter(g => g.kind === 'standard');
    const managedGroups = groupsData.filter(g => g.kind !== 'standard');

    const newNodes: Node[] = [];

    // Managed groups (shader/steps/source) stay top-level and absolute.
    managedGroups.forEach(group => {
      const position = savedPositions[group.key] || { x: group.initialX, y: group.initialY };
      newNodes.push(buildCardNode(group, position, null));
    });

    // Standard cards, nested inside wrapper frames for expanded groups.
    const placements = buildWrapperLayout(standardCards, groupedPaths, savedPositions);
    const cardHiddenByKey = new Map<string, boolean>();
    standardCards.forEach(g => cardHiddenByKey.set(g.key, isCardHidden(g) && !selectionProviderGroupKeys.has(g.key)));

    placements.forEach(p => {
      if (p.kind === 'card') {
        newNodes.push(buildCardNode(p.group, p.position, p.parentId));
      } else {
        // Wrapper hidden when every card it contains is filtered out.
        const hasVisibleChild = standardCards.some(g => {
          const path = g.sourceGroupName || '';
          const within = path === p.path || path.startsWith(p.path + '/');
          return within && !cardHiddenByKey.get(g.key);
        });
        newNodes.push({
          id: p.id,
          type: 'groupWrapper',
          position: p.position,
          ...(p.parentId ? { parentId: p.parentId, extent: 'parent' as const } : {}),
          hidden: !hasVisibleChild,
          selectable: false,
          style: { width: p.width, height: p.height },
          data: { path: p.path, title: p.path, onLevelUp: handleLevelUp, onUngroup: handleUngroup },
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
          entries: selectedNode.entries,
        } as PropertyNodeData,
        dragHandle: '.group-header',
      });
    }

    // Create visibility map for groups (cards only; edges connect cards).
    const groupVisibility = new Map<string, boolean>();
    newNodes.forEach(node => {
      if (node.type === 'groupNode') groupVisibility.set(node.id, !node.hidden);
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
          source: conn.fromGroup,
          target: conn.toGroup,
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
            onDisconnect: handleDisconnect,
          },
        };
      });

    // Edges from a bound token straight to the selected node's own property
    // row — same visual language as reference connections, but the receiver
    // is a live Figma property instead of another variable.
    if (selectedNode) {
      selectedNode.entries.forEach((entry, index) => {
        if (entry.kind !== 'variable' || !entry.token || !entry.bindingTarget) return;
        // Prefer the real token card; fall back to the synthetic external card
        // when the token has no local match (library variable, etc.).
        const tokenInfo = variableMap.get(entry.token.name);
        const sourceGroupKey = tokenInfo ? tokenInfo.group : externalTokenCardKey.get(entry.token.name);
        if (!sourceGroupKey) return;
        const sourceVisible = groupVisibility.get(sourceGroupKey) ?? false;
        const bindingTarget = entry.bindingTarget;
        const nodeId = selectedNode.id;

        newEdges.push({
          id: `prop-edge:${index}`,
          source: sourceGroupKey,
          target: getSelectionNodeId(nodeId),
          sourceHandle: `${entry.token.name}::out`,
          targetHandle: `prop:${index}::in`,
          type: 'customEdge',
          hidden: !sourceVisible,
          data: {
            kind: 'reference',
            receiverName: entry.property,
            receiverShortName: entry.property,
            resolvedValue: '',
            onDisconnect: () => {
              post({ type: 'unbind-node-property', nodeId, target: bindingTarget });
            },
          },
        });
      });
    }

    setNodes(newNodes);
    setEdges(newEdges);
  }, [groupsData, connectionData, connectedVars, variableMap, positionsHydrated, savedPositions, groupedPaths,
      localSelectedCollections, selectedTypes, selectedGroups, variablesById, selectedNode,
      isColorType, variableType, handleGeneratorOpen, handleAddVariableToGroup,
      handleRenameGroup, handleDuplicateGroup, handleEditGroupAsText, handleLevelUp, handleUngroup, handleDeleteGraphGroup, handleRenameGraphVariable,
      handleDeleteGraphVariable, handleDisconnect, handleShowColorMenu, handleHighlightPath,
      handleHighlightVariable, highlightedGroupKey, highlightedVarName, setNodes, setEdges]);

  // The selection card now carries a per-element id (see getSelectionNodeId),
  // so switching elements mounts a fresh node with correctly measured handles.
  // We still refresh internals here to cover in-place changes — e.g. rebinding a
  // property on the *same* selected element adds/removes handles under one id.
  useEffect(() => {
    if (nodes.length === 0) return;
    const raf = requestAnimationFrame(() => {
      updateNodeInternals(nodes.map(n => n.id));
    });
    return () => cancelAnimationFrame(raf);
  }, [nodes, updateNodeInternals]);

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
      if (sourceIsProp === targetIsProp || !selectedNode) return;

      const propHandle = sourceIsProp ? connection.sourceHandle : connection.targetHandle;
      const tokenHandle = sourceIsProp ? connection.targetHandle : connection.sourceHandle;

      const entryIndexMatch = propHandle.match(/^prop:(\d+)::/);
      if (!entryIndexMatch) return;
      const entry = selectedNode.entries[parseInt(entryIndexMatch[1], 10)];
      if (!entry || !entry.bindingTarget) return;

      const tokenVarName = tokenHandle.replace('::out', '').replace('::in', '');
      const tokenVarInfo = variableMap.get(tokenVarName);
      if (!tokenVarInfo || tokenVarInfo.node.connectionsDisabled) return;

      post({ type: 'bind-node-property', nodeId: selectedNode.id, target: entry.bindingTarget, variableId: tokenVarInfo.node.id });
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
  }, [collections, selectedModeId, variableMap, variablesById, selectedNode]);

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

    // A wrapped card can't be arranged on its own — its coordinates are
    // parent-relative, and the wrapper frame itself never moves otherwise.
    // Fold each card into its outermost wrapper's unit key so the whole
    // frame is arranged as one block; standalone cards are their own unit.
    // Only 'standard' cards can ever be wrapped (buildWrapperLayout never
    // nests managed source/shader/shades groups), so leave those alone even
    // if their sourceGroupName happens to share a prefix with a grouped path.
    const unitKeyForGroup = (group: GroupData): string => {
      if (group.kind !== 'standard') return group.key;
      const outermost = outermostGroupedAncestor(group.sourceGroupName || '', groupedPaths);
      return outermost ? `wrapper:${outermost}` : group.key;
    };

    // One pseudo GroupData per top-level unit. For a wrapper unit, reuse its
    // first member card and override key/title/position — only those plus
    // the height override matter to the arrange algorithm.
    const unitGroups = new Map<string, GroupData>();
    const wrapperMemberHeightSum = new Map<string, number>();
    currentGroups.forEach(group => {
      const unitKey = unitKeyForGroup(group);
      if (unitKey === group.key) {
        unitGroups.set(unitKey, group);
        return;
      }
      if (!unitGroups.has(unitKey)) {
        const wrapperNode = currentNodes.find(n => n.id === unitKey);
        unitGroups.set(unitKey, {
          ...group,
          key: unitKey,
          title: unitKey.slice('wrapper:'.length),
          x: wrapperNode?.position.x ?? group.x,
          y: wrapperNode?.position.y ?? group.y,
        });
      }
      wrapperMemberHeightSum.set(unitKey, (wrapperMemberHeightSum.get(unitKey) || 0) + getGroupHeight(group) + WRAPPER_GAP);
    });

    // Wrapper units use the measured frame height when xyflow has it;
    // otherwise fall back to summing member card heights + gaps, wrapped in
    // the same chrome buildWrapperLayout adds (header + top/bottom padding).
    const heightOverrides = new Map<string, number>();
    unitGroups.forEach((group, unitKey) => {
      if (!unitKey.startsWith('wrapper:')) return;
      const wrapperNode = currentNodes.find(n => n.id === unitKey);
      const measured = wrapperNode?.measured?.height;
      if (typeof measured === 'number' && measured > 0) {
        heightOverrides.set(unitKey, measured);
      } else {
        const memberSum = wrapperMemberHeightSum.get(unitKey) || 0;
        heightOverrides.set(
          unitKey,
          memberSum > 0
            ? memberSum - WRAPPER_GAP + WRAPPER_HEADER_HEIGHT + WRAPPER_PADDING * 2
            : WRAPPER_HEADER_HEIGHT + WRAPPER_PADDING * 2
        );
      }
    });

    const arrangeUnits = Array.from(unitGroups.values());

    // Remap connections onto their unit keys; a connection that becomes a
    // self-loop within one unit (both ends now the same wrapper) is dropped.
    const remappedConnections = connectionData.reduce<ConnectionRecord[]>((acc, conn) => {
      const fromGroup = currentGroups.find(g => g.key === conn.fromGroup);
      const toGroup = currentGroups.find(g => g.key === conn.toGroup);
      if (!fromGroup || !toGroup) return acc;
      const fromUnit = unitKeyForGroup(fromGroup);
      const toUnit = unitKeyForGroup(toGroup);
      if (fromUnit === toUnit) return acc;
      acc.push({ ...conn, fromGroup: fromUnit, toGroup: toUnit });
      return acc;
    }, []);

    const newPositions = arrangeGroupsByConnectedBlocks(
      arrangeUnits, remappedConnections, settings.gapX, settings.gapY, heightOverrides
    );

    // Snapshot current top-level positions for one-step undo before applying.
    const previousPositions: Record<string, { x: number; y: number }> = {};
    currentNodes.forEach(n => {
      if (n.parentId) return;
      previousPositions[n.id] = { x: n.position.x, y: n.position.y };
    });
    lastArrangeUndoRef.current = previousPositions;
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
    post({ type: 'set-client-storage', key: `graph-positions`, value: positionsObj });

    // Deferred so the new positions are committed before we measure for fit.
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.15, duration: 400 });
    }, 50);
  }, [reactFlowInstance, groupsData, connectionData, gridLayoutSettings, groupedPaths, setNodes, variableType]);

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
    post({ type: 'set-client-storage', key: `graph-positions`, value: previousPositions });

    lastArrangeUndoRef.current = null;
    setHasArrangeUndo(false);
  }, [setNodes]);

  const handleFocusSelection = useCallback(() => {
    if (!selectedNode) return;
    const wanted = new Set<string>([getSelectionNodeId(selectedNode.id)]);
    selectedNode.entries.forEach(entry => {
      if (entry.kind !== 'variable' || !entry.token) return;
      const info = variableMap.get(entry.token.name);
      if (info) {
        wanted.add(info.group);
      } else {
        // Mirror the synthetic external-card key built during node layout.
        const parts = entry.token.name.split('/');
        const groupName = parts.length > 1 ? parts.slice(0, -1).join('/') : entry.token.name;
        wanted.add(`ext-group:${groupName}`);
      }
    });

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
  }, [selectedNode, variableMap, reactFlowInstance]);

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
    setGridLayoutDraft({ gapX: String(settings.gapX), gapY: String(settings.gapY) });
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
                setGridLayoutDraft({
                  gapX: String(gridLayoutSettings.gapX),
                  gapY: String(gridLayoutSettings.gapY),
                });
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
                  onClick={() => {
                    setGridLayoutDraft({
                      gapX: String(gridLayoutSettings.gapX),
                      gapY: String(gridLayoutSettings.gapY),
                    });
                  }}
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
