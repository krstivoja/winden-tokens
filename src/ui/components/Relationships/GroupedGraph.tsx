// Grouped graph component - SVG-based relationships view

import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { ShadeGroupData, VariableData } from '../../types';
import { parseColorToRgb, rgbObjToHex } from '../../utils/color';
import { post } from '../../hooks/usePluginMessages';
import { useModalContext } from '../Modals/ModalContext';

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
}

interface Connection {
  id: string;
  kind: 'reference' | 'generated';
  fromGroup: string;
  fromVar: string;
  toGroup: string;
  toVar: string;
}

interface ConnectionFlags {
  hasInput: boolean;
  hasOutput: boolean;
  inputKind: 'reference' | 'generated' | null;
  outputKind: 'reference' | 'generated' | null;
}

interface GridLayoutSettings {
  gapX: number;
  gapY: number;
}

interface GridLayoutDraft {
  gapX: string;
  gapY: string;
}

const GROUP_WIDTH = 260;
const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 36;
const GROUP_PADDING = 8;
const GROUP_GAP_X = 180;
const GROUP_GAP_Y = 40;
const GENERATED_CONNECTION_COLOR = '#b86e00';
const REFERENCE_CONNECTION_COLOR = '#1877f2';
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;
const DEFAULT_GROUP_CHILD_NAME = 'base';

function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

function getDefaultVariableValue(type: 'COLOR' | 'FLOAT'): string {
  return type === 'COLOR' ? 'rgb(0, 0, 0)' : '0';
}

function normalizePathSegment(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, '');
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
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

function arrangeGroupsByConnectedBlocks(
  groups: GroupData[],
  connections: Connection[],
  gapX: number,
  gapY: number
): Map<string, { x: number; y: number }> {
  const columnStep = GROUP_WIDTH + gapX;
  const positions = new Map<string, { x: number; y: number }>();
  const groupMap = new Map(groups.map(group => [group.key, group]));
  const adjacency = new Map<string, Set<string>>();

  groups.forEach(group => {
    adjacency.set(group.key, new Set());
  });

  connections.forEach(connection => {
    if (!groupMap.has(connection.fromGroup) || !groupMap.has(connection.toGroup)) return;
    adjacency.get(connection.fromGroup)?.add(connection.toGroup);
    adjacency.get(connection.toGroup)?.add(connection.fromGroup);
  });

  const visited = new Set<string>();
  const blocks: GroupData[][] = [];

  groups
    .slice()
    .sort(sortGroupsByPosition)
    .forEach(group => {
      if (visited.has(group.key)) return;

      const stack = [group.key];
      const block: GroupData[] = [];
      visited.add(group.key);

      while (stack.length > 0) {
        const currentKey = stack.pop();
        if (!currentKey) continue;

        const currentGroup = groupMap.get(currentKey);
        if (currentGroup) {
          block.push(currentGroup);
        }

        adjacency.get(currentKey)?.forEach(nextKey => {
          if (visited.has(nextKey)) return;
          visited.add(nextKey);
          stack.push(nextKey);
        });
      }

      blocks.push(block);
    });

  blocks.sort((a, b) => {
    const topA = Math.min(...a.map(group => group.y));
    const topB = Math.min(...b.map(group => group.y));
    if (topA !== topB) return topA - topB;

    const leftA = Math.min(...a.map(group => group.x));
    const leftB = Math.min(...b.map(group => group.x));
    return leftA - leftB;
  });

  let nextBlockY = 0;

  blocks.forEach(block => {
    const sortedBlock = block.slice().sort(sortGroupsByPosition);
    const desiredColumns = new Map<string, number>();

    sortedBlock.forEach(group => {
      desiredColumns.set(group.key, Math.max(0, Math.round(group.x / columnStep)));
    });

    const usedColumns = Array.from(new Set(
      sortedBlock.map(group => desiredColumns.get(group.key) ?? 0)
    )).sort((a, b) => a - b);
    const compactedColumns = new Map<number, number>();
    usedColumns.forEach((column, index) => {
      compactedColumns.set(column, index);
    });

    const startColumn = 0;
    const blockColumns = new Map<number, GroupData[]>();

    sortedBlock.forEach(group => {
      const desiredColumn = desiredColumns.get(group.key) ?? 0;
      const compactedColumn = compactedColumns.get(desiredColumn) ?? 0;
      const targetColumn = startColumn + compactedColumn;
      const columnGroups = blockColumns.get(targetColumn) || [];
      columnGroups.push(group);
      blockColumns.set(targetColumn, columnGroups);
    });

    let blockHeight = 0;

    Array.from(blockColumns.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([columnIndex, columnGroups]) => {
        let nextColumnY = nextBlockY;

        columnGroups
          .sort(sortGroupsByPosition)
          .forEach(group => {
            positions.set(group.key, {
              x: columnIndex * columnStep,
              y: nextColumnY,
            });
            nextColumnY += getGroupHeight(group) + gapY;
          });

        blockHeight = Math.max(blockHeight, nextColumnY - nextBlockY - gapY);
      });

    nextBlockY += Math.max(blockHeight, 0) + gapY;
  });

  return positions;
}

function isShadeVariableName(name: string): boolean {
  return /^(.+)\/(\d+)$/.test(name);
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
        if (deepRef) {
          resolvedValue = deepRef.value;
        }
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
    displayValue = isReference ? `{${referenceName}}` : resolvedValue;
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
    value: '',
    resolvedValue: '',
    isReference: false,
    referenceName: null,
    isVirtual: true,
    virtualType: 'shader',
    connectionsDisabled: true,
  };
}

function createPaletteNode(shadeGroup: ShadeGroupData, shadeCount: number, color: string): VariableNode {
  return {
    id: `palette:${shadeGroup.sourceVariableId}`,
    name: `palette:${shadeGroup.sourceVariableId}`,
    shortName: 'generated',
    displayName: `${shadeCount} outputs`,
    color,
    value: '',
    resolvedValue: '',
    isReference: false,
    referenceName: null,
    isVirtual: true,
    virtualType: 'palette',
    connectionsDisabled: true,
  };
}

export function GroupedGraph({
  variables,
  selectedCollectionIds,
  variableType,
  shadeGroups,
}: GroupedGraphProps) {
  const { openShadesModal, openInputModal } = useModalContext();
  const isColorType = variableType === 'COLOR';
  const containerRef = useRef<HTMLDivElement>(null);
  const gridSettingsRef = useRef<HTMLDivElement>(null);
  const [viewState, setViewState] = useState({ zoom: 1, panX: 50, panY: 50 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const [groupPositions, setGroupPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
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
  const [draggingGroup, setDraggingGroup] = useState<{ key: string; offsetX: number; offsetY: number } | null>(null);
  const [dragState, setDragState] = useState<{
    fromGroup: string;
    fromVar: string;
    fromSide: 'left' | 'right';
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [hoveredVar, setHoveredVar] = useState<string | null>(null);

  const zoomBy = useCallback((factor: number) => {
    setViewState(prev => ({
      ...prev,
      zoom: clampZoom(prev.zoom * factor),
    }));
  }, []);

  // Load saved positions on mount
  useEffect(() => {
    const storageKey = `graph-positions-${variableType}`;
    setSavedPositions({});
    setGroupPositions(new Map());
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
    setGridLayoutSettings({
      gapX: GROUP_GAP_X,
      gapY: GROUP_GAP_Y,
    });
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
      if (gridSettingsRef.current?.contains(event.target as Node)) return;
      setIsGridSettingsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsGridSettingsOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isGridSettingsOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpaceHeld(true);
        return;
      }

      if (e.key === '+' || e.code === 'NumpadAdd' || (e.key === '=' && e.shiftKey)) {
        e.preventDefault();
        zoomBy(1.1);
        return;
      }

      if (e.key === '-' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        zoomBy(0.9);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpaceHeld(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [zoomBy]);

  const { groupsData, connections, variableMap } = useMemo(() => {
    const filteredVars = variables.filter(
      variable => selectedCollectionIds.has(variable.collectionId) && variable.resolvedType === variableType
    );
    const varsByName = new Map<string, VariableData>();
    filteredVars.forEach(variable => varsByName.set(variable.name, variable));

    const groupsArray: GroupData[] = [];
    const varMap = new Map<string, { group: string; index: number; node: VariableNode }>();
    const conns: Connection[] = [];

    const managedSourceIds = new Set<string>();
    const managedShadeIds = new Set<string>();
    const managedShadeGroups = isColorType
      ? shadeGroups
          .filter(group => selectedCollectionIds.has(group.collectionId))
          .sort((a, b) => a.sourceVariableName.localeCompare(b.sourceVariableName))
      : [];

    managedShadeGroups.forEach((shadeGroup, index) => {
      const sourceVariable = filteredVars.find(variable => variable.id === shadeGroup.sourceVariableId);
      if (!sourceVariable) return;

      managedSourceIds.add(sourceVariable.id);
      shadeGroup.deleteIds.forEach(id => {
        if (id !== sourceVariable.id) {
          managedShadeIds.add(id);
        }
      });

      const sourceNode = formatVariableNode(sourceVariable, varsByName, true);
      const sourceGroupKey = `source:${sourceVariable.id}`;
      const shaderGroupKey = `shader:${sourceVariable.id}`;
      const shadesGroupKey = `shades:${sourceVariable.id}`;
      const sourceColor = sourceNode.color;
      const managedShades = filteredVars
        .filter(variable => shadeGroup.deleteIds.includes(variable.id) && variable.id !== sourceVariable.id)
        .sort((a, b) => extractShadeNumber(a.name) - extractShadeNumber(b.name));
      const shadeNodes = managedShades.map(variable => formatVariableNode(variable, varsByName, true));
      const shaderNode = createShaderNode(shadeGroup, sourceColor);
      const paletteNode = createPaletteNode(shadeGroup, shadeNodes.length, sourceColor);

      const baseY = index * (Math.max(
        HEADER_HEIGHT + ROW_HEIGHT + GROUP_PADDING * 2,
        HEADER_HEIGHT + (shadeNodes.length + 1) * ROW_HEIGHT + GROUP_PADDING * 2
      ) + GROUP_GAP_Y);

      const managedGroups: GroupData[] = [
        {
          key: sourceGroupKey,
          title: sourceVariable.name,
          variables: [sourceNode],
          x: 0,
          y: 0,
          initialX: 0,
          initialY: baseY,
          kind: 'source',
          sourceGroupName: sourceVariable.name,
          headerFill: '#f0f0f0',
        },
        {
          key: shaderGroupKey,
          title: 'Shader',
          variables: [shaderNode],
          x: 0,
          y: 0,
          initialX: GROUP_WIDTH + GROUP_GAP_X,
          initialY: baseY,
          kind: 'shader',
          sourceGroupName: sourceVariable.name,
          headerFill: '#fff4df',
        },
        {
          key: shadesGroupKey,
          title: `${sourceVariable.name} shades`,
          variables: [paletteNode, ...shadeNodes],
          x: 0,
          y: 0,
          initialX: (GROUP_WIDTH + GROUP_GAP_X) * 2,
          initialY: baseY,
          kind: 'shades',
          sourceGroupName: sourceVariable.name,
          headerFill: '#eef4ff',
        },
      ];

      managedGroups.forEach(group => {
        groupsArray.push(group);
        group.variables.forEach((node, variableIndex) => {
          varMap.set(node.name, { group: group.key, index: variableIndex, node });
        });
      });

      conns.push({
        id: `generated:${sourceVariable.id}:source-to-shader`,
        kind: 'generated',
        fromGroup: sourceGroupKey,
        fromVar: sourceNode.name,
        toGroup: shaderGroupKey,
        toVar: shaderNode.name,
      });

      conns.push({
        id: `generated:${sourceVariable.id}:shader-to-palette`,
        kind: 'generated',
        fromGroup: shaderGroupKey,
        fromVar: shaderNode.name,
        toGroup: shadesGroupKey,
        toVar: paletteNode.name,
      });
    });

    const unmanagedVars = filteredVars.filter(
      variable => !managedSourceIds.has(variable.id) && !managedShadeIds.has(variable.id)
    );
    const unmanagedGroupsMap = new Map<string, VariableNode[]>();

    unmanagedVars.forEach(variable => {
      const parts = variable.name.split('/');
      const groupName = parts.length > 1 ? parts.slice(0, -1).join('/') : variable.name;
      const group = unmanagedGroupsMap.get(groupName) || [];
      group.push(formatVariableNode(variable, varsByName, isColorType));
      unmanagedGroupsMap.set(groupName, group);
    });

    const unmanagedStartX = managedShadeGroups.length > 0
      ? (GROUP_WIDTH + GROUP_GAP_X) * 3 + GROUP_GAP_X
      : 0;
    let primitiveY = 0;
    let semanticY = 0;

    Array.from(unmanagedGroupsMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([groupName, groupVariables]) => {
        const groupKey = `group:${groupName}`;
        const hasReferences = groupVariables.some(variable => variable.isReference);
        const initialX = unmanagedStartX + (hasReferences ? GROUP_WIDTH + GROUP_GAP_X : 0);
        const initialY = hasReferences ? semanticY : primitiveY;
        const groupData: GroupData = {
          key: groupKey,
          title: groupName,
          variables: groupVariables,
          x: 0,
          y: 0,
          initialX,
          initialY,
          kind: 'standard',
          sourceGroupName: groupName,
          headerFill: '#f0f0f0',
        };

        groupsArray.push(groupData);
        groupVariables.forEach((node, variableIndex) => {
          varMap.set(node.name, { group: groupKey, index: variableIndex, node });
        });

        if (hasReferences) {
          semanticY += getGroupHeight(groupData) + GROUP_GAP_Y;
        } else {
          primitiveY += getGroupHeight(groupData) + GROUP_GAP_Y;
        }
      });

    groupsArray.forEach(group => {
      group.variables.forEach(node => {
        if (node.isReference && node.referenceName) {
          const provider = varMap.get(node.referenceName);
          const receiver = varMap.get(node.name);
          if (provider && receiver) {
            conns.push({
              id: `reference:${receiver.node.id}->${provider.node.id}`,
              kind: 'reference',
              fromGroup: provider.group,
              fromVar: provider.node.name,
              toGroup: receiver.group,
              toVar: receiver.node.name,
            });
          }
        }
      });
    });

    return { groupsData: groupsArray, connections: conns, variableMap: varMap };
  }, [variables, selectedCollectionIds, variableType, shadeGroups, isColorType]);

  const connectedVars = useMemo(() => {
    const connected = new Map<string, ConnectionFlags>();

    const ensureState = (name: string) => {
      const state = connected.get(name) || {
        hasInput: false,
        hasOutput: false,
        inputKind: null,
        outputKind: null,
      };
      connected.set(name, state);
      return state;
    };

    connections.forEach(connection => {
      const output = ensureState(connection.fromVar);
      output.hasOutput = true;
      output.outputKind = output.outputKind || connection.kind;

      const input = ensureState(connection.toVar);
      input.hasInput = true;
      input.inputKind = input.inputKind || connection.kind;
    });

    return connected;
  }, [connections]);

  useEffect(() => {
    if (!positionsHydrated) return;

    setGroupPositions(prev => {
      const next = new Map(prev);
      let changed = false;

      groupsData.forEach(group => {
        if (!next.has(group.key)) {
          // Use saved position if available, otherwise use initial position
          const savedPos = savedPositions[group.key];
          next.set(group.key, savedPos || { x: group.initialX, y: group.initialY });
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [groupsData, positionsHydrated, savedPositions]);

  // Save positions when they change
  useEffect(() => {
    if (!positionsHydrated || groupsData.length === 0) return;

    const positionsObj: Record<string, { x: number; y: number }> = {};
    groupsData.forEach(group => {
      const position = groupPositions.get(group.key);
      if (position) {
        positionsObj[group.key] = position;
      }
    });

    const storageKey = `graph-positions-${variableType}`;
    post({ type: 'set-client-storage', key: storageKey, value: positionsObj });
  }, [groupPositions, groupsData, positionsHydrated, variableType]);

  const groups = useMemo(() => {
    return groupsData.map(group => {
      const position = groupPositions.get(group.key) || { x: group.initialX, y: group.initialY };
      return {
        ...group,
        x: position.x,
        y: position.y,
      };
    });
  }, [groupPositions, groupsData]);

  const groupsMap = useMemo(() => {
    const map = new Map<string, GroupData>();
    groups.forEach(group => map.set(group.key, group));
    return map;
  }, [groups]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isSpaceHeld) {
      e.preventDefault();
      setIsPanning(true);
      return;
    }

    const tagName = (e.target as Element).tagName.toLowerCase();
    if (e.target === e.currentTarget || tagName === 'svg') {
      setIsPanning(true);
    }
  }, [isSpaceHeld]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setViewState(prev => ({
        ...prev,
        panX: prev.panX + e.movementX,
        panY: prev.panY + e.movementY,
      }));
    }

    if (draggingGroup) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const x = (e.clientX - rect.left - viewState.panX) / viewState.zoom - draggingGroup.offsetX;
        const y = (e.clientY - rect.top - viewState.panY) / viewState.zoom - draggingGroup.offsetY;
        setGroupPositions(prev => {
          const next = new Map(prev);
          next.set(draggingGroup.key, { x, y });
          return next;
        });
      }
    }

    if (dragState) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setDragState(prev => prev ? {
          ...prev,
          currentX: (e.clientX - rect.left - viewState.panX) / viewState.zoom,
          currentY: (e.clientY - rect.top - viewState.panY) / viewState.zoom,
        } : null);
      }
    }
  }, [dragState, draggingGroup, isPanning, viewState]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggingGroup(null);
    setDragState(null);
  }, []);

  const handleGroupDragStart = useCallback((e: React.MouseEvent, groupKey: string, groupX: number, groupY: number) => {
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = (e.clientX - rect.left - viewState.panX) / viewState.zoom;
    const mouseY = (e.clientY - rect.top - viewState.panY) / viewState.zoom;
    setDraggingGroup({
      key: groupKey,
      offsetX: mouseX - groupX,
      offsetY: mouseY - groupY,
    });
  }, [viewState]);

  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      zoomBy(delta);
      return;
    }

    e.preventDefault();
    setViewState(prev => ({
      ...prev,
      panX: prev.panX - e.deltaX,
      panY: prev.panY - e.deltaY,
    }));
  }, [zoomBy]);

  // Use native wheel event listener with passive: false to allow preventDefault
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  const handleDragStart = useCallback((groupKey: string, varName: string, side: 'left' | 'right', x: number, y: number) => {
    setDragState({
      fromGroup: groupKey,
      fromVar: varName,
      fromSide: side,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
    });
  }, []);

  const handleDrop = useCallback((targetVar: string, targetSide: 'left' | 'right') => {
    if (!dragState) return;
    if (dragState.fromVar === targetVar) return;

    const sourceVarInfo = variableMap.get(dragState.fromVar);
    const targetVarInfo = variableMap.get(targetVar);
    if (!sourceVarInfo || !targetVarInfo) return;
    if (sourceVarInfo.node.connectionsDisabled || targetVarInfo.node.connectionsDisabled) return;

    if (dragState.fromSide === 'right' && targetSide === 'left') {
      const newValue = `{${sourceVarInfo.node.name}}`;
      post({ type: 'update-variable-value', id: targetVarInfo.node.id, value: newValue });
    } else if (dragState.fromSide === 'left' && targetSide === 'right') {
      const newValue = `{${targetVarInfo.node.name}}`;
      post({ type: 'update-variable-value', id: sourceVarInfo.node.id, value: newValue });
    }

    setDragState(null);
  }, [dragState, variableMap]);

  const handleDisconnect = useCallback((receiverVarName: string, resolvedValue: string) => {
    const receiverInfo = variableMap.get(receiverVarName);
    if (receiverInfo && !receiverInfo.node.connectionsDisabled) {
      post({ type: 'update-variable-value', id: receiverInfo.node.id, value: resolvedValue });
    }
  }, [variableMap]);

  const handleShaderOpen = useCallback((group: GroupData, node: VariableNode) => {
    if (group.kind === 'shader' && node.virtualType === 'shader' && group.sourceGroupName) {
      openShadesModal({ groupName: group.sourceGroupName });
    }
  }, [openShadesModal]);

  const handleCreateGroup = useCallback(() => {
    // Use first selected collection for creating new variables
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

  const handleOpenGridSettings = useCallback(() => {
    setGridLayoutDraft({
      gapX: String(gridLayoutSettings.gapX),
      gapY: String(gridLayoutSettings.gapY),
    });
    setIsGridSettingsOpen(true);
  }, [gridLayoutSettings]);

  const handleApplyGridSettings = useCallback(() => {
    const settings = normalizeGridLayoutSettings({
      gapX: Number.parseInt(gridLayoutDraft.gapX, 10),
      gapY: Number.parseInt(gridLayoutDraft.gapY, 10),
    });

    setGridLayoutSettings(settings);
    setGridLayoutDraft({
      gapX: String(settings.gapX),
      gapY: String(settings.gapY),
    });
    setIsGridSettingsOpen(false);
    post({
      type: 'set-client-storage',
      key: `graph-layout-settings-${variableType}`,
      value: settings,
    });
  }, [gridLayoutDraft, variableType]);

  const getConnectionPath = useCallback((fromGroup: GroupData, fromVarIdx: number, toGroup: GroupData, toVarIdx: number) => {
    const outputX = fromGroup.x + GROUP_WIDTH;
    const outputY = fromGroup.y + HEADER_HEIGHT + GROUP_PADDING + fromVarIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
    const inputX = toGroup.x;
    const inputY = toGroup.y + HEADER_HEIGHT + GROUP_PADDING + toVarIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
    const dx = Math.abs(outputX - inputX);
    const controlOffset = Math.max(50, dx / 2);

    return `M ${outputX} ${outputY} C ${outputX + controlOffset} ${outputY}, ${inputX - controlOffset} ${inputY}, ${inputX} ${inputY}`;
  }, []);

  return (
    <div
      ref={containerRef}
      className={`grouped-graph ${isPanning ? 'panning' : ''} ${isSpaceHeld ? 'space-pan' : ''} ${draggingGroup ? 'dragging-group' : ''} ${dragState ? 'dragging' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="graph-top-controls" onMouseDown={e => e.stopPropagation()}>
        <button
          type="button"
          className="graph-action-btn"
          onClick={handleCreateGroup}
          disabled={selectedCollectionIds.size === 0}
        >
          New Group
        </button>
        <button
          type="button"
          className="graph-action-btn"
          onClick={() => {
            setGroupPositions(
              arrangeGroupsByConnectedBlocks(
                groups,
                connections,
                gridLayoutSettings.gapX,
                gridLayoutSettings.gapY
              )
            );
          }}
        >
          Arrange Grid
        </button>
        <div
          ref={gridSettingsRef}
          className="graph-settings-menu"
          onMouseDown={e => e.stopPropagation()}
        >
          <button
            type="button"
            className="graph-action-btn"
            onClick={() => {
              if (isGridSettingsOpen) {
                setIsGridSettingsOpen(false);
                return;
              }
              handleOpenGridSettings();
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
                  id="grid-gap-x"
                  type="number"
                  min="0"
                  className="form-input"
                  value={gridLayoutDraft.gapX}
                  onChange={e => setGridLayoutDraft(prev => ({ ...prev, gapX: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label htmlFor="grid-gap-y">Vertical gap</label>
                <input
                  id="grid-gap-y"
                  type="number"
                  min="0"
                  className="form-input"
                  value={gridLayoutDraft.gapY}
                  onChange={e => setGridLayoutDraft(prev => ({ ...prev, gapY: e.target.value }))}
                />
              </div>
              <div className="graph-settings-actions">
                <button
                  type="button"
                  className="graph-action-btn"
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
                <button
                  type="button"
                  className="graph-action-btn"
                  onClick={handleApplyGridSettings}
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="zoom-controls">
          <button type="button" onClick={() => zoomBy(0.9)} aria-label="Zoom out">-</button>
          <span>{Math.round(viewState.zoom * 100)}%</span>
          <button type="button" onClick={() => zoomBy(1.1)} aria-label="Zoom in">+</button>
        </div>
      </div>
      <svg width="100%" height="100%" style={{ display: 'block', background: 'transparent' }}>
        <g transform={`translate(${viewState.panX}, ${viewState.panY}) scale(${viewState.zoom})`}>
          <g className="connections-layer">
            {connections.map(connection => {
              const fromGroup = groupsMap.get(connection.fromGroup);
              const toGroup = groupsMap.get(connection.toGroup);
              const fromVarInfo = variableMap.get(connection.fromVar);
              const toVarInfo = variableMap.get(connection.toVar);

              if (!fromGroup || !toGroup || !fromVarInfo || !toVarInfo) return null;

              const path = getConnectionPath(fromGroup, fromVarInfo.index, toGroup, toVarInfo.index);
              const stroke = connection.kind === 'generated' ? GENERATED_CONNECTION_COLOR : REFERENCE_CONNECTION_COLOR;
              const strokeDasharray = connection.kind === 'generated' ? '7 5' : undefined;

              return (
                <g key={connection.id} className={`connection-group ${connection.kind}`}>
                  {connection.kind === 'reference' && (
                    <path
                      d={path}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={12}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        const receiver = toVarInfo.node;
                        if (confirm(`Disconnect ${receiver.shortName}?`)) {
                          handleDisconnect(receiver.name, receiver.resolvedValue);
                        }
                      }}
                    />
                  )}
                  <path
                    d={path}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={connection.kind === 'generated' ? 2.5 : 2}
                    strokeDasharray={strokeDasharray}
                    className="connection-line"
                    style={{ pointerEvents: 'none' }}
                  />
                </g>
              );
            })}
          </g>

          {dragState && (
            <path
              d={`M ${dragState.startX} ${dragState.startY} L ${dragState.currentX} ${dragState.currentY}`}
              fill="none"
              stroke={REFERENCE_CONNECTION_COLOR}
              strokeWidth={2}
              strokeDasharray="4 2"
              className="drag-preview-line"
            />
          )}

	          {groups.map(group => {
	            const height = getGroupHeight(group);
              const canManageGroupVariables = group.kind === 'standard';

	            return (
	              <g key={group.key} transform={`translate(${group.x}, ${group.y})`} className={`group-box ${group.kind}`}>
                <rect
                  width={GROUP_WIDTH}
                  height={height}
                  rx={4}
                  fill="white"
                  stroke={group.kind === 'shader' ? GENERATED_CONNECTION_COLOR : 'black'}
                  strokeWidth={1}
                />

                <path
                  d={`M 4 1 L ${GROUP_WIDTH - 4} 1 Q ${GROUP_WIDTH - 1} 1 ${GROUP_WIDTH - 1} 4 L ${GROUP_WIDTH - 1} ${HEADER_HEIGHT} L 1 ${HEADER_HEIGHT} L 1 4 Q 1 1 4 1 Z`}
                  fill={group.headerFill}
                  style={{ cursor: 'move' }}
                  onMouseDown={e => handleGroupDragStart(e, group.key, group.x, group.y)}
                />
	                <text
	                  x={12}
                  y={HEADER_HEIGHT / 2 + 5}
                  fontSize={14}
                  fontWeight={600}
                  fill="#333"
                  style={{ pointerEvents: 'none' }}
	                >
	                  {group.title}
	                </text>

                  {canManageGroupVariables && (
                    <g
                      className="group-header-action"
                      transform={`translate(${GROUP_WIDTH - 30}, 8)`}
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => {
                        e.stopPropagation();
                        handleAddVariableToGroup(group);
                      }}
                    >
                      <rect width={20} height={20} rx={4} className="group-header-action-bg" />
                      <text x={10} y={14} textAnchor="middle" className="group-header-action-label">+</text>
                    </g>
                  )}

	                {group.variables.map((node, idx) => {
	                  const rowY = HEADER_HEIGHT + GROUP_PADDING + idx * ROW_HEIGHT;
                  const flags = connectedVars.get(node.name);
                  const hasInput = flags?.hasInput || false;
                  const hasOutput = flags?.hasOutput || false;
                  const isSource = dragState?.fromVar === node.name;
                  const isHoveredTarget = dragState && hoveredVar === node.name && !isSource && !node.connectionsDisabled;
	                  const inputColor = flags?.inputKind === 'generated' ? GENERATED_CONNECTION_COLOR : REFERENCE_CONNECTION_COLOR;
	                  const outputColor = flags?.outputKind === 'generated' ? GENERATED_CONNECTION_COLOR : REFERENCE_CONNECTION_COLOR;
	                  const rowInteractive = group.kind === 'shader' && node.virtualType === 'shader';
                    const showDeleteAction = group.kind === 'standard' && !node.isVirtual;
                    const valueLabelX = showDeleteAction ? GROUP_WIDTH - 42 : GROUP_WIDTH - 16;

	                  return (
                    <g
                      key={node.id}
                      transform={`translate(0, ${rowY})`}
                      className={`variable-row ${isSource ? 'drag-source' : ''} ${isHoveredTarget ? 'drop-target' : ''} ${rowInteractive ? 'shader-row' : ''}`}
                      onMouseEnter={() => setHoveredVar(node.name)}
                      onMouseLeave={() => setHoveredVar(null)}
                      onClick={() => handleShaderOpen(group, node)}
                      style={rowInteractive ? { cursor: 'pointer' } : undefined}
                    >
                      <rect
                        x={1}
                        y={1}
                        width={GROUP_WIDTH - 2}
                        height={ROW_HEIGHT - 2}
                        rx={2}
                        fill="transparent"
                        className="row-hover-bg"
                      />

                      <circle
                        cx={0}
                        cy={ROW_HEIGHT / 2}
                        r={4}
                        fill={hasInput ? inputColor : 'white'}
                        stroke={hasInput ? inputColor : 'black'}
                        strokeWidth={1}
                        className={`connection-point ${hasInput ? 'connected' : ''} ${node.connectionsDisabled ? 'disabled' : ''}`}
                        style={{ cursor: node.connectionsDisabled ? 'default' : 'crosshair' }}
                        onMouseDown={node.connectionsDisabled ? undefined : e => {
                          e.stopPropagation();
                          handleDragStart(group.key, node.name, 'left', group.x, group.y + rowY + ROW_HEIGHT / 2);
                        }}
                        onMouseUp={node.connectionsDisabled ? undefined : e => {
                          e.stopPropagation();
                          if (dragState) {
                            handleDrop(node.name, 'left');
                          }
                        }}
                      />

                      {isColorType && !node.isVirtual && (
                        <rect
                          x={14}
                          y={(ROW_HEIGHT - 20) / 2}
                          width={20}
                          height={20}
                          rx={2}
                          fill={node.color}
                          stroke="#ccc"
                          strokeWidth={0.5}
                        />
                      )}

                      {node.isVirtual && (
                        <rect
                          x={14}
                          y={6}
                          width={28}
                          height={20}
                          rx={10}
                          fill={node.virtualType === 'shader' ? '#ffe4b8' : '#dceaff'}
                        />
                      )}

                      {node.isVirtual && (
                        <text
                          x={28}
                          y={ROW_HEIGHT / 2 + 4}
                          fontSize={10}
                          fontWeight={700}
                          fill={node.virtualType === 'shader' ? '#8a5a00' : '#2457a5'}
                          textAnchor="middle"
                          style={{ pointerEvents: 'none' }}
                        >
                          {node.virtualType === 'shader' ? 'fx' : 'out'}
                        </text>
                      )}

                      <text
                        x={node.isVirtual ? 52 : (isColorType ? 42 : 14)}
                        y={ROW_HEIGHT / 2 + 4}
                        fontSize={12}
                        fontFamily="monospace"
                        fill="#333"
                      >
                        {node.shortName}
                      </text>

	                      <text
	                        x={valueLabelX}
	                        y={ROW_HEIGHT / 2 + 4}
	                        fontSize={12}
	                        fontFamily="monospace"
                        fill={node.isReference ? '#666' : '#999'}
                        textAnchor="end"
	                      >
	                        {node.displayName}
	                      </text>

                        {showDeleteAction && (
                          <g
                            className="row-action delete-variable"
                            transform={`translate(${GROUP_WIDTH - 34}, 8)`}
                            onMouseDown={e => e.stopPropagation()}
                            onClick={e => {
                              e.stopPropagation();
                              handleDeleteGraphVariable(node);
                            }}
                          >
                            <rect width={16} height={16} rx={3} className="row-action-bg" />
                            <text x={8} y={11} textAnchor="middle" className="row-action-label">×</text>
                          </g>
                        )}

	                      <circle
                        cx={GROUP_WIDTH}
                        cy={ROW_HEIGHT / 2}
                        r={4}
                        fill={hasOutput ? outputColor : 'white'}
                        stroke={hasOutput ? outputColor : 'black'}
                        strokeWidth={1}
                        className={`connection-point ${hasOutput ? 'connected' : ''} ${node.connectionsDisabled ? 'disabled' : ''}`}
                        style={{ cursor: node.connectionsDisabled ? 'default' : 'crosshair' }}
                        onMouseDown={node.connectionsDisabled ? undefined : e => {
                          e.stopPropagation();
                          handleDragStart(group.key, node.name, 'right', group.x + GROUP_WIDTH, group.y + rowY + ROW_HEIGHT / 2);
                        }}
                        onMouseUp={node.connectionsDisabled ? undefined : e => {
                          e.stopPropagation();
                          if (dragState) {
                            handleDrop(node.name, 'right');
                          }
                        }}
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
