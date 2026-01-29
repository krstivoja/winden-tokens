// Grouped graph component - SVG-based relationships view

import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { VariableData } from '../../types';
import { parseColorToRgb, rgbObjToHex } from '../../utils/color';
import { post } from '../../hooks/usePluginMessages';

interface GroupedGraphProps {
  variables: VariableData[];
  selectedCollectionId: string | null;
  variableType: 'COLOR' | 'FLOAT';
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
}

interface GroupData {
  name: string;
  variables: VariableNode[];
  x: number;
  y: number;
}

interface Connection {
  fromGroup: string;
  fromVar: string;
  toGroup: string;
  toVar: string;
}

const GROUP_WIDTH = 260;
const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 36;
const GROUP_PADDING = 8;
const GROUP_GAP_X = 180;
const GROUP_GAP_Y = 40;

export function GroupedGraph({ variables, selectedCollectionId, variableType }: GroupedGraphProps) {
  const isColorType = variableType === 'COLOR';
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewState, setViewState] = useState({ zoom: 1, panX: 50, panY: 50 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const [groupPositions, setGroupPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [draggingGroup, setDraggingGroup] = useState<{ name: string; offsetX: number; offsetY: number } | null>(null);
  const [dragState, setDragState] = useState<{
    fromGroup: string;
    fromVar: string;
    fromSide: 'left' | 'right'; // left = input (receives), right = output (sends)
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [hoveredVar, setHoveredVar] = useState<string | null>(null);

  // Track space key for pan mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpaceHeld(true);
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
  }, []);

  // Build groups and connections (without auto-positioning)
  const { groupsData, connections, variableMap, groupsLookup } = useMemo(() => {
    const filteredVars = variables.filter(
      v => v.collectionId === selectedCollectionId && v.resolvedType === variableType
    );

    // Build name -> variable map for O(1) reference lookups
    const varsByName = new Map<string, VariableData>();
    filteredVars.forEach(v => varsByName.set(v.name, v));

    const refPattern = /^\{(.+)\}$/;
    const groupsMap = new Map<string, VariableNode[]>();
    const varMap = new Map<string, { group: string; index: number; node: VariableNode }>();

    // Group variables
    filteredVars.forEach(v => {
      const parts = v.name.split('/');
      const groupName = parts.length > 1 ? parts.slice(0, -1).join('/') : v.name;
      const displayName = parts[parts.length - 1];

      const refMatch = v.value.match(refPattern);
      const isReference = !!refMatch;
      const referenceName = refMatch ? refMatch[1] : null;

      let resolvedValue = v.value;
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

      // For colors, convert to hex; for numbers, use the value directly
      let displayColor = '#888888';
      let displayValue = resolvedValue;
      if (isColorType) {
        const rgb = parseColorToRgb(resolvedValue);
        displayColor = rgb ? rgbObjToHex(rgb) : '#888888';
        displayValue = isReference ? `{${referenceName}}` : displayColor.toUpperCase();
      } else {
        displayValue = isReference ? `{${referenceName}}` : resolvedValue;
      }

      const node: VariableNode = {
        id: v.id,
        name: v.name,
        shortName: displayName,
        displayName: displayValue,
        color: displayColor,
        value: v.value,
        resolvedValue: isColorType ? displayColor : resolvedValue,
        isReference,
        referenceName,
      };

      const group = groupsMap.get(groupName) || [];
      varMap.set(v.name, { group: groupName, index: group.length, node });
      group.push(node);
      groupsMap.set(groupName, group);
    });

    // Create groups array (positions will be applied separately)
    const groupsArray: GroupData[] = [];
    groupsMap.forEach((vars, name) => {
      groupsArray.push({ name, variables: vars, x: 0, y: 0 });
    });

    // Build group name -> GroupData map for O(1) lookups during render
    const groupsLookupMap = new Map<string, GroupData>();
    groupsArray.forEach(g => groupsLookupMap.set(g.name, g));

    // Build connections
    const conns: Connection[] = [];
    groupsArray.forEach(g => {
      g.variables.forEach(v => {
        if (v.isReference && v.referenceName) {
          const target = varMap.get(v.referenceName);
          if (target) {
            conns.push({
              fromGroup: g.name,
              fromVar: v.name,
              toGroup: target.group,
              toVar: v.referenceName,
            });
          }
        }
      });
    });

    return { groupsData: groupsArray, connections: conns, variableMap: varMap, groupsLookup: groupsLookupMap };
  }, [variables, selectedCollectionId, variableType, isColorType]);

  // Track which variables have connections (for blue coloring)
  const connectedVars = useMemo(() => {
    const connected = new Map<string, { hasInput: boolean; hasOutput: boolean }>();
    connections.forEach(conn => {
      // fromVar has an input (it references something)
      const from = connected.get(conn.fromVar) || { hasInput: false, hasOutput: false };
      from.hasInput = true;
      connected.set(conn.fromVar, from);
      // toVar has an output (something references it)
      const to = connected.get(conn.toVar) || { hasInput: false, hasOutput: false };
      to.hasOutput = true;
      connected.set(conn.toVar, to);
    });
    return connected;
  }, [connections]);

  // Initialize positions only for new groups
  useEffect(() => {
    setGroupPositions(prev => {
      const newPositions = new Map(prev);
      let needsUpdate = false;

      // Calculate initial layout for groups without positions
      const primitiveGroups: string[] = [];
      const semanticGroups: string[] = [];

      groupsData.forEach(g => {
        if (!newPositions.has(g.name)) {
          needsUpdate = true;
          const hasReferences = g.variables.some(v => v.isReference);
          if (hasReferences) {
            semanticGroups.push(g.name);
          } else {
            primitiveGroups.push(g.name);
          }
        }
      });

      if (!needsUpdate) return prev;

      // Layout new primitive groups on the left
      let y = 0;
      // Find max y of existing primitives
      primitiveGroups.forEach(name => {
        const g = groupsData.find(gd => gd.name === name);
        if (g) {
          newPositions.set(name, { x: 0, y });
          y += HEADER_HEIGHT + g.variables.length * ROW_HEIGHT + GROUP_PADDING * 2 + GROUP_GAP_Y;
        }
      });

      // Layout new semantic groups on the right
      let col = 1;
      y = 0;
      semanticGroups.forEach(name => {
        const g = groupsData.find(gd => gd.name === name);
        if (g) {
          const height = HEADER_HEIGHT + g.variables.length * ROW_HEIGHT + GROUP_PADDING * 2;
          newPositions.set(name, { x: col * (GROUP_WIDTH + GROUP_GAP_X), y });
          y += height + GROUP_GAP_Y;
        }
      });

      return newPositions;
    });
  }, [groupsData]);

  // Apply positions to groups and build lookup map
  const { groups, groupsMap } = useMemo(() => {
    const groupsArray = groupsData.map(g => {
      const pos = groupPositions.get(g.name) || { x: 0, y: 0 };
      return { ...g, x: pos.x, y: pos.y };
    });
    const groupsMapWithPos = new Map<string, GroupData>();
    groupsArray.forEach(g => groupsMapWithPos.set(g.name, g));
    return { groups: groupsArray, groupsMap: groupsMapWithPos };
  }, [groupsData, groupPositions]);

  // Pan handling - start panning on background click or when space is held
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Pan if space is held (anywhere) or clicking directly on background
    if (isSpaceHeld) {
      e.preventDefault();
      setIsPanning(true);
      return;
    }
    // Only pan if clicking directly on the container or SVG background
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
          const newPositions = new Map(prev);
          newPositions.set(draggingGroup.name, { x, y });
          return newPositions;
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
  }, [isPanning, draggingGroup, dragState, viewState]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggingGroup(null);
    setDragState(null);
  }, []);

  // Group drag start
  const handleGroupDragStart = useCallback((e: React.MouseEvent, groupName: string, groupX: number, groupY: number) => {
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseX = (e.clientX - rect.left - viewState.panX) / viewState.zoom;
      const mouseY = (e.clientY - rect.top - viewState.panY) / viewState.zoom;
      setDraggingGroup({
        name: groupName,
        offsetX: mouseX - groupX,
        offsetY: mouseY - groupY,
      });
    }
  }, [viewState]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Zoom with Cmd/Ctrl + scroll
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setViewState(prev => ({
        ...prev,
        zoom: Math.max(0.2, Math.min(3, prev.zoom * delta)),
      }));
    } else {
      // Pan with regular scroll
      e.preventDefault();
      setViewState(prev => ({
        ...prev,
        panX: prev.panX - e.deltaX,
        panY: prev.panY - e.deltaY,
      }));
    }
  }, []);

  // Connection point drag start
  const handleDragStart = useCallback((groupName: string, varName: string, side: 'left' | 'right', x: number, y: number) => {
    setDragState({
      fromGroup: groupName,
      fromVar: varName,
      fromSide: side,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
    });
  }, []);

  // Drop on a variable - handle based on which side the drag started from
  const handleDrop = useCallback((targetGroup: string, targetVar: string, targetSide: 'left' | 'right') => {
    if (!dragState) return;
    if (dragState.fromVar === targetVar) return; // Can't connect to self

    const sourceVarInfo = variableMap.get(dragState.fromVar);
    const targetVarInfo = variableMap.get(targetVar);
    if (!sourceVarInfo || !targetVarInfo) return;

    // Determine which variable becomes the reference based on sides:
    // - LEFT side = INPUT (this variable receives/references another)
    // - RIGHT side = OUTPUT (this variable provides its value)
    //
    // Valid connections:
    // - Drag from RIGHT (output) to LEFT (input): target receives source's value
    // - Drag from LEFT (input) to RIGHT (output): source receives target's value

    if (dragState.fromSide === 'right' && targetSide === 'left') {
      // Dragged from output to input: target references source
      const newValue = `{${dragState.fromVar}}`;
      post({ type: 'update-variable-value', id: targetVarInfo.node.id, value: newValue });
    } else if (dragState.fromSide === 'left' && targetSide === 'right') {
      // Dragged from input to output: source references target
      const newValue = `{${targetVar}}`;
      post({ type: 'update-variable-value', id: sourceVarInfo.node.id, value: newValue });
    }
    // Other combinations (left-to-left, right-to-right) are invalid - do nothing

    setDragState(null);
  }, [dragState, variableMap]);

  // Disconnect a reference
  const handleDisconnect = useCallback((varName: string, resolvedValue: string) => {
    const varInfo = variableMap.get(varName);
    if (varInfo) {
      post({ type: 'update-variable-value', id: varInfo.node.id, value: resolvedValue });
    }
  }, [variableMap]);

  // Calculate connection path (circles are at edges: 0 and GROUP_WIDTH)
  const getConnectionPath = (fromGroup: GroupData, fromVarIdx: number, toGroup: GroupData, toVarIdx: number) => {
    const fromY = fromGroup.y + HEADER_HEIGHT + GROUP_PADDING + fromVarIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
    const toY = toGroup.y + HEADER_HEIGHT + GROUP_PADDING + toVarIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

    let fromX: number, toX: number;

    if (fromGroup.x > toGroup.x) {
      fromX = fromGroup.x;
      toX = toGroup.x + GROUP_WIDTH;
    } else {
      fromX = fromGroup.x + GROUP_WIDTH;
      toX = toGroup.x;
    }

    const dx = Math.abs(toX - fromX);
    const controlOffset = dx / 2; // Smooth S-curve like in mockup

    if (fromX < toX) {
      return `M ${fromX} ${fromY} C ${fromX + controlOffset} ${fromY}, ${toX - controlOffset} ${toY}, ${toX} ${toY}`;
    } else {
      return `M ${fromX} ${fromY} C ${fromX - controlOffset} ${fromY}, ${toX + controlOffset} ${toY}, ${toX} ${toY}`;
    }
  };

  return (
    <div
      ref={containerRef}
      className={`grouped-graph ${isPanning ? 'panning' : ''} ${isSpaceHeld ? 'space-pan' : ''} ${draggingGroup ? 'dragging-group' : ''} ${dragState ? 'dragging' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <svg
        width="100%"
        height="100%"
        style={{ display: 'block', background: 'transparent' }}
      >

        <g transform={`translate(${viewState.panX}, ${viewState.panY}) scale(${viewState.zoom})`}>
          {/* Connection lines */}
          <g className="connections-layer">
            {connections.map((conn, i) => {
              const fromGroup = groupsMap.get(conn.fromGroup);
              const toGroup = groupsMap.get(conn.toGroup);
              if (!fromGroup || !toGroup) return null;

              // Use variableMap for O(1) index lookup
              const fromVarInfo = variableMap.get(conn.fromVar);
              const toVarInfo = variableMap.get(conn.toVar);
              if (!fromVarInfo || !toVarInfo) return null;
              const fromVarIdx = fromVarInfo.index;
              const toVarIdx = toVarInfo.index;

              const path = getConnectionPath(fromGroup, fromVarIdx, toGroup, toVarIdx);

              return (
                <g key={i} className="connection-group">
                  <path
                    d={path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={12}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      const fromVar = fromGroup.variables[fromVarIdx];
                      if (confirm(`Disconnect ${fromVar.name.split('/').pop()}?`)) {
                        handleDisconnect(conn.fromVar, fromVar.resolvedValue);
                      }
                    }}
                  />
                  <path
                    d={path}
                    fill="none"
                    stroke="#1877f2"
                    strokeWidth={2}
                    className="connection-line"
                    style={{ pointerEvents: 'none' }}
                  />
                </g>
              );
            })}
          </g>

          {/* Drag preview line */}
          {dragState && (
            <path
              d={`M ${dragState.startX} ${dragState.startY} L ${dragState.currentX} ${dragState.currentY}`}
              fill="none"
              stroke="#1877f2"
              strokeWidth={2}
              strokeDasharray="4 2"
              className="drag-preview-line"
            />
          )}

          {/* Groups */}
          {groups.map(group => {
            const height = HEADER_HEIGHT + group.variables.length * ROW_HEIGHT + GROUP_PADDING * 2;

            return (
              <g key={group.name} transform={`translate(${group.x}, ${group.y})`} className="group-box">
                {/* Background */}
                <rect
                  width={GROUP_WIDTH}
                  height={height}
                  rx={4}
                  fill="white"
                  stroke="black"
                  strokeWidth={1}
                />

                {/* Header - draggable (inset to not cover border) */}
                <path
                  d={`M 4 1 L ${GROUP_WIDTH - 4} 1 Q ${GROUP_WIDTH - 1} 1 ${GROUP_WIDTH - 1} 4 L ${GROUP_WIDTH - 1} ${HEADER_HEIGHT} L 1 ${HEADER_HEIGHT} L 1 4 Q 1 1 4 1 Z`}
                  fill="#f0f0f0"
                  style={{ cursor: 'move' }}
                  onMouseDown={(e) => handleGroupDragStart(e, group.name, group.x, group.y)}
                />
                <text
                  x={12}
                  y={HEADER_HEIGHT / 2 + 5}
                  fontSize={14}
                  fontWeight={600}
                  fill="#333"
                  style={{ pointerEvents: 'none' }}
                >
                  {group.name.split('/').pop()}
                </text>

                {/* Variables */}
                {group.variables.map((v, idx) => {
                  const rowY = HEADER_HEIGHT + GROUP_PADDING + idx * ROW_HEIGHT;
                  const varConnections = connectedVars.get(v.name);
                  const hasInput = varConnections?.hasInput || false;
                  const hasOutput = varConnections?.hasOutput || false;

                  const isSource = dragState?.fromVar === v.name;
                  const isHoveredTarget = dragState && hoveredVar === v.name && !isSource;

                  return (
                    <g
                      key={v.id}
                      transform={`translate(0, ${rowY})`}
                      className={`variable-row ${isSource ? 'drag-source' : ''} ${isHoveredTarget ? 'drop-target' : ''}`}
                      onMouseEnter={() => setHoveredVar(v.name)}
                      onMouseLeave={() => setHoveredVar(null)}
                    >
                      {/* Hover background */}
                      <rect
                        x={1}
                        y={1}
                        width={GROUP_WIDTH - 2}
                        height={ROW_HEIGHT - 2}
                        rx={2}
                        fill="transparent"
                        className="row-hover-bg"
                      />

                      {/* Left connection point (INPUT - receives value) */}
                      <circle
                        cx={0}
                        cy={ROW_HEIGHT / 2}
                        r={4}
                        fill={hasInput ? '#1877f2' : 'white'}
                        stroke={hasInput ? '#1877f2' : 'black'}
                        strokeWidth={1}
                        className={`connection-point ${hasInput ? 'connected' : ''}`}
                        style={{ cursor: 'crosshair' }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleDragStart(group.name, v.name, 'left', group.x, group.y + rowY + ROW_HEIGHT / 2);
                        }}
                        onMouseUp={(e) => {
                          e.stopPropagation();
                          if (dragState) handleDrop(group.name, v.name, 'left');
                        }}
                      />

                      {/* Color swatch (only for colors) */}
                      {isColorType && (
                        <rect
                          x={14}
                          y={(ROW_HEIGHT - 20) / 2}
                          width={20}
                          height={20}
                          rx={2}
                          fill={v.color}
                          stroke="#ccc"
                          strokeWidth={0.5}
                        />
                      )}

                      {/* Short name */}
                      <text
                        x={isColorType ? 42 : 14}
                        y={ROW_HEIGHT / 2 + 4}
                        fontSize={12}
                        fontFamily="monospace"
                        fill="#333"
                      >
                        {v.shortName}
                      </text>

                      {/* Hex/reference value on right */}
                      <text
                        x={GROUP_WIDTH - 16}
                        y={ROW_HEIGHT / 2 + 4}
                        fontSize={12}
                        fontFamily="monospace"
                        fill={v.isReference ? '#666' : '#999'}
                        textAnchor="end"
                      >
                        {v.displayName}
                      </text>

                      {/* Right connection point (OUTPUT - sends value) */}
                      <circle
                        cx={GROUP_WIDTH}
                        cy={ROW_HEIGHT / 2}
                        r={4}
                        fill={hasOutput ? '#1877f2' : 'white'}
                        stroke={hasOutput ? '#1877f2' : 'black'}
                        strokeWidth={1}
                        className={`connection-point ${hasOutput ? 'connected' : ''}`}
                        style={{ cursor: 'crosshair' }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleDragStart(group.name, v.name, 'right', group.x + GROUP_WIDTH, group.y + rowY + ROW_HEIGHT / 2);
                        }}
                        onMouseUp={(e) => {
                          e.stopPropagation();
                          if (dragState) handleDrop(group.name, v.name, 'right');
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
