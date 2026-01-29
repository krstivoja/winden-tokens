// Grouped graph component - SVG-based relationships view

import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { VariableData } from '../../types';
import { parseColorToRgb, rgbObjToHex } from '../../utils/color';
import { post } from '../../hooks/usePluginMessages';

interface GroupedGraphProps {
  variables: VariableData[];
  selectedCollectionId: string | null;
}

interface VariableNode {
  id: string;
  name: string;
  displayName: string;
  color: string;
  value: string;
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

export function GroupedGraph({ variables, selectedCollectionId }: GroupedGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewState, setViewState] = useState({ zoom: 1, panX: 50, panY: 50 });
  const [isPanning, setIsPanning] = useState(false);
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

  // Build groups and connections (without auto-positioning)
  const { groupsData, connections, variableMap } = useMemo(() => {
    const colorVars = variables.filter(
      v => v.collectionId === selectedCollectionId && v.resolvedType === 'COLOR'
    );

    const refPattern = /^\{(.+)\}$/;
    const groupsMap = new Map<string, VariableNode[]>();
    const varMap = new Map<string, { group: string; index: number; node: VariableNode }>();

    // Group variables
    colorVars.forEach(v => {
      const parts = v.name.split('/');
      const groupName = parts.length > 1 ? parts.slice(0, -1).join('/') : v.name;
      const displayName = parts[parts.length - 1];

      const refMatch = v.value.match(refPattern);
      const isReference = !!refMatch;
      const referenceName = refMatch ? refMatch[1] : null;

      let displayColor = v.value;
      if (isReference && referenceName) {
        const refVar = colorVars.find(cv => cv.name === referenceName);
        if (refVar) {
          const refRefMatch = refVar.value.match(refPattern);
          if (refRefMatch) {
            const deepRef = colorVars.find(cv => cv.name === refRefMatch[1]);
            if (deepRef) displayColor = deepRef.value;
          } else {
            displayColor = refVar.value;
          }
        }
      }

      const rgb = parseColorToRgb(displayColor);
      const hexColor = rgb ? rgbObjToHex(rgb) : '#888888';

      const node: VariableNode = {
        id: v.id,
        name: v.name,
        displayName: isReference ? `{${referenceName}}` : hexColor.toUpperCase(),
        color: hexColor,
        value: v.value,
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

    return { groupsData: groupsArray, connections: conns, variableMap: varMap };
  }, [variables, selectedCollectionId]);

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

  // Apply positions to groups
  const groups = useMemo(() => {
    return groupsData.map(g => {
      const pos = groupPositions.get(g.name) || { x: 0, y: 0 };
      return { ...g, x: pos.x, y: pos.y };
    });
  }, [groupsData, groupPositions]);

  // Pan handling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('graph-bg')) {
      setIsPanning(true);
    }
  }, []);

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
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setViewState(prev => ({
      ...prev,
      zoom: Math.max(0.2, Math.min(3, prev.zoom * delta)),
    }));
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
  const handleDisconnect = useCallback((varName: string, resolvedColor: string) => {
    const varInfo = variableMap.get(varName);
    if (varInfo) {
      post({ type: 'update-variable-value', id: varInfo.node.id, value: resolvedColor });
    }
  }, [variableMap]);

  // Calculate connection path (circles are now at edge: 0 and GROUP_WIDTH)
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
    const controlOffset = Math.max(40, Math.min(dx * 0.4, 80));

    if (fromX < toX) {
      return `M ${fromX} ${fromY} C ${fromX + controlOffset} ${fromY}, ${toX - controlOffset} ${toY}, ${toX} ${toY}`;
    } else {
      return `M ${fromX} ${fromY} C ${fromX - controlOffset} ${fromY}, ${toX + controlOffset} ${toY}, ${toX} ${toY}`;
    }
  };

  return (
    <div
      ref={containerRef}
      className={`grouped-graph ${isPanning ? 'panning' : ''} ${draggingGroup ? 'dragging-group' : ''} ${dragState ? 'dragging' : ''}`}
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
              const fromGroup = groups.find(g => g.name === conn.fromGroup);
              const toGroup = groups.find(g => g.name === conn.toGroup);
              if (!fromGroup || !toGroup) return null;

              const fromVarIdx = fromGroup.variables.findIndex(v => v.name === conn.fromVar);
              const toVarIdx = toGroup.variables.findIndex(v => v.name === conn.toVar);
              if (fromVarIdx < 0 || toVarIdx < 0) return null;

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
                        handleDisconnect(conn.fromVar, fromVar.color);
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
                  stroke="#333"
                  strokeWidth={1}
                />

                {/* Header - draggable */}
                <rect
                  width={GROUP_WIDTH}
                  height={HEADER_HEIGHT}
                  rx={4}
                  fill="#f0f0f0"
                  style={{ cursor: 'move' }}
                  onMouseDown={(e) => handleGroupDragStart(e, group.name, group.x, group.y)}
                />
                <rect
                  y={HEADER_HEIGHT - 4}
                  width={GROUP_WIDTH}
                  height={4}
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

                  return (
                    <g
                      key={v.id}
                      transform={`translate(0, ${rowY})`}
                      className={`variable-row ${dragState ? 'drop-target' : ''}`}
                    >
                      {/* Hover background */}
                      <rect
                        x={1}
                        width={GROUP_WIDTH - 2}
                        height={ROW_HEIGHT}
                        fill="transparent"
                        className="row-hover-bg"
                      />

                      {/* Left connection point (INPUT - receives value) */}
                      <circle
                        cx={0}
                        cy={ROW_HEIGHT / 2}
                        r={5}
                        fill={hasInput ? '#1877f2' : '#888'}
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

                      {/* Color swatch */}
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

                      {/* Label */}
                      <text
                        x={42}
                        y={ROW_HEIGHT / 2 + 4}
                        fontSize={12}
                        fontFamily="monospace"
                        fill={v.isReference ? '#666' : '#333'}
                      >
                        {v.displayName}
                      </text>

                      {/* Right connection point (OUTPUT - sends value) */}
                      <circle
                        cx={GROUP_WIDTH}
                        cy={ROW_HEIGHT / 2}
                        r={5}
                        fill={hasOutput ? '#1877f2' : '#888'}
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
