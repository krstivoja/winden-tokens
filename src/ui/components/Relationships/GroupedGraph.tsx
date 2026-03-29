// Grouped graph component - @xyflow/react based relationships view

import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
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
import { post } from '../../hooks/usePluginMessages';
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
  GroupedGraphProps,
  GroupNodeData,
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
} from './GroupedGraph/constants';
import { GroupNodeComponent } from './GroupedGraph/GraphNode';
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
};

const edgeTypes: EdgeTypes = {
  customEdge: CustomEdge,
};

// ── Inner component (needs ReactFlowProvider context) ──────────────

function GroupedGraphInner({
  collections,
  variables,
  selectedCollectionIds,
  variableType,
  shadeGroups,
  selectedModeId,
}: GroupedGraphProps) {
  const { openShadesModal, openStepsModal, openInputModal } = useModalContext();
  const isColorType = variableType === 'COLOR';
  const groupedGraphRef = useRef<HTMLDivElement>(null);
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
  const reactFlowInstance = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<GroupNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<CustomEdgeData>>([]);
  const variablesById = useMemo(
    () => new Map(variables.map(variable => [variable.id, variable])),
    [variables]
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
    post({ type: 'select-mode', modeId: modeId || null });
  }, []);

  const handleCollectionToggle = useCallback((collectionId: string) => {
    post({ type: 'toggle-collection', collectionId });
  }, []);

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
        openShadesModal({ groupName: group.sourceGroupName });
      } else {
        openStepsModal({ groupName: group.sourceGroupName, collectionId: group.collectionId });
      }
    }
  }, [isColorType, openShadesModal, openStepsModal]);

  const handleAddVariableToGroup = useCallback((group: GroupData) => {
    if (group.kind !== 'standard' || !group.sourceGroupName) return;

    openInputModal({
      title: `New Variable in ${group.sourceGroupName}`,
      label: 'Variable name',
      confirmText: 'Add',
      onConfirm: value => {
        const variableName = normalizePathSegment(value);
        if (!variableName) return;
        post({
          type: 'create-variable',
          collectionId: group.collectionId,
          name: `${group.sourceGroupName}/${variableName}`,
          varType: variableType,
          value: getDefaultVariableValue(variableType),
        });
      },
    });
  }, [openInputModal, variableType]);

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
      const parts = variable.name.split('/');
      const groupName = parts.length > 1 ? parts.slice(0, -1).join('/') : variable.name;
      const existing = unmanagedGroupsMap.get(groupName) || { nodes: [], collectionId: variable.collectionId };
      existing.nodes.push(formatVariableNode(variable, varsByName, isColorType, collections, selectedModeId));
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

  // Build React Flow nodes/edges when data changes, hiding by selected collections
  useEffect(() => {
    if (!positionsHydrated) return;

    // Determine which groups are visible based on collection filter
    const visibleGroupKeys = new Set<string>();
    groupsData.forEach(group => {
      if (selectedCollectionIds.has(group.collectionId)) {
        visibleGroupKeys.add(group.key);
      }
    });

    const newNodes: Node<GroupNodeData>[] = groupsData.map(group => {
      const savedPos = savedPositions[group.key];
      const position = savedPos || { x: group.initialX, y: group.initialY };
      const isHidden = !visibleGroupKeys.has(group.key);
      return {
        id: group.key,
        type: 'groupNode',
        position,
        hidden: isHidden,
        data: {
          group,
          isColorType,
          variableType,
          connectedVars,
          onGeneratorOpen: handleGeneratorOpen,
          onShowColorMenu: handleShowColorMenu,
          onAddVariable: handleAddVariableToGroup,
          onRenameGroup: handleRenameGroup,
          onDuplicateGroup: handleDuplicateGroup,
          onDeleteGroup: handleDeleteGraphGroup,
          onRenameVariable: handleRenameGraphVariable,
          onDeleteVariable: handleDeleteGraphVariable,
          onDisconnect: handleDisconnect,
        },
        dragHandle: '.group-header',
      };
    });

    // Hide edges where either source or target group is hidden
    const newEdges: Edge<CustomEdgeData>[] = connectionData
      .map(conn => {
        const toVarInfo = variableMap.get(conn.toVar);
        const isHidden = !visibleGroupKeys.has(conn.fromGroup) || !visibleGroupKeys.has(conn.toGroup);
        return {
          id: conn.id,
          source: conn.fromGroup,
          target: conn.toGroup,
          sourceHandle: `${conn.fromVar}::out`,
          targetHandle: `${conn.toVar}::in`,
          type: 'customEdge',
          hidden: isHidden,
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
      handleRenameGroup, handleDuplicateGroup, handleDeleteGraphGroup, handleRenameGraphVariable,
      handleDeleteGraphVariable, handleDisconnect, handleShowColorMenu, setNodes, setEdges]);

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
    const targetVariable = variablesById.get(targetVarInfo.node.id);
    const modeId = targetVariable
      ? resolveModeIdForCollection(collections, targetVariable.collectionId, selectedModeId)
      : selectedModeId;
    post({ type: 'update-variable-value', id: targetVarInfo.node.id, value: newValue, modeId });
  }, [collections, selectedModeId, variableMap, variablesById]);

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
    setSavedPositions(positionsObj);
    post({ type: 'set-client-storage', key: `graph-positions-${variableType}`, value: positionsObj });
  }, [reactFlowInstance, groupsData, connectionData, gridLayoutSettings, setNodes, variableType]);

  const handleApplyGridSettings = useCallback(() => {
    const settings = normalizeGridLayoutSettings({
      gapX: Number.parseInt(gridLayoutDraft.gapX, 10),
      gapY: Number.parseInt(gridLayoutDraft.gapY, 10),
    });
    setGridLayoutSettings(settings);
    setGridLayoutDraft({ gapX: String(settings.gapX), gapY: String(settings.gapY) });
    post({
      type: 'set-client-storage',
      key: `graph-layout-settings-${variableType}`,
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
            disabled={selectedCollectionIds.size === 0}
          >
            New Group
          </TextButton>
          <TextButton variant="secondary" onClick={() => handleArrangeGrid()}>
            Arrange Grid
          </TextButton>
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
      <div className="relative flex-1 w-full flex">
        {/* Sidebar */}
        <SidebarFilter
          selectedModeId={selectedModeId}
          onModeChange={handleModeChange}
          selectedCollections={selectedCollectionIds}
          onCollectionToggle={handleCollectionToggle}
          showTypeFilters={false}
        />

        {/* Graph content */}
        <div className="flex-1 relative">
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
        className="w-full h-full bg-base-2!"
      />
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

export function GroupedGraph(props: GroupedGraphProps) {
  return (
    <ReactFlowProvider>
      <GroupedGraphInner {...props} />
    </ReactFlowProvider>
  );
}
