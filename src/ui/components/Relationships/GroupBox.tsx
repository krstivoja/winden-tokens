// Group box component displaying a group of variables

import React from 'react';
import { GroupData, VariableNode } from './types';

interface GroupBoxProps {
  group: GroupData;
  rowHeight: number;
  headerHeight: number;
  padding: number;
  onDragStart?: (variable: VariableNode, pointX: number, pointY: number) => void;
  onDrop?: (variable: VariableNode) => void;
  isDragging?: boolean;
}

const GROUP_WIDTH = 220;

export function GroupBox({
  group,
  rowHeight,
  headerHeight,
  padding,
  onDragStart,
  onDrop,
  isDragging,
}: GroupBoxProps) {
  const height = headerHeight + group.variables.length * rowHeight + padding * 2;

  const handleConnectionPointMouseDown = (
    e: React.MouseEvent,
    variable: VariableNode,
    side: 'left' | 'right'
  ) => {
    e.stopPropagation();
    if (onDragStart) {
      const index = group.variables.indexOf(variable);
      const pointX = side === 'left' ? group.x + 8 : group.x + GROUP_WIDTH - 8;
      const pointY = group.y + headerHeight + padding + index * rowHeight + rowHeight / 2;
      onDragStart(variable, pointX, pointY);
    }
  };

  const handleRowMouseUp = (e: React.MouseEvent, variable: VariableNode) => {
    e.stopPropagation();
    if (isDragging && onDrop) {
      onDrop(variable);
    }
  };

  return (
    <g transform={`translate(${group.x}, ${group.y})`} className="group-box">
      {/* Background */}
      <rect
        x={0}
        y={0}
        width={GROUP_WIDTH}
        height={height}
        rx={6}
        fill="var(--bg)"
        stroke="var(--border)"
        strokeWidth={1}
      />

      {/* Header */}
      <rect
        x={0}
        y={0}
        width={GROUP_WIDTH}
        height={headerHeight}
        rx={6}
        fill="var(--bg-alt)"
      />
      <rect
        x={0}
        y={headerHeight - 6}
        width={GROUP_WIDTH}
        height={6}
        fill="var(--bg-alt)"
      />
      <text
        x={12}
        y={headerHeight / 2 + 5}
        className="group-title"
        fontSize={13}
        fontWeight={600}
        fill="var(--text)"
      >
        {group.name.split('/').pop()}
      </text>

      {/* Variables */}
      {group.variables.map((variable, index) => {
        const y = headerHeight + padding + index * rowHeight;

        return (
          <g
            key={variable.id}
            transform={`translate(0, ${y})`}
            className={`variable-row ${isDragging ? 'drop-target' : ''}`}
            onMouseUp={(e) => handleRowMouseUp(e, variable)}
          >
            {/* Hover/drop target background */}
            <rect
              x={1}
              y={0}
              width={GROUP_WIDTH - 2}
              height={rowHeight}
              fill="transparent"
              className="row-hover-bg"
            />

            {/* Left connection point */}
            <circle
              cx={8}
              cy={rowHeight / 2}
              r={4}
              fill="var(--text)"
              className="connection-point left"
              style={{ cursor: 'crosshair' }}
              onMouseDown={(e) => handleConnectionPointMouseDown(e, variable, 'left')}
            />

            {/* Color swatch */}
            <rect
              x={20}
              y={(rowHeight - 18) / 2}
              width={18}
              height={18}
              rx={3}
              fill={variable.color}
              stroke="var(--border)"
              strokeWidth={0.5}
            />

            {/* Variable name/value */}
            <text
              x={46}
              y={rowHeight / 2 + 4}
              fontSize={11}
              fontFamily="'SF Mono', Monaco, monospace"
              fill={variable.isReference ? 'var(--text-dim)' : 'var(--text)'}
            >
              {variable.displayName}
            </text>

            {/* Right connection point */}
            <circle
              cx={GROUP_WIDTH - 8}
              cy={rowHeight / 2}
              r={4}
              fill="var(--text)"
              className="connection-point right"
              style={{ cursor: 'crosshair' }}
              onMouseDown={(e) => handleConnectionPointMouseDown(e, variable, 'right')}
            />
          </g>
        );
      })}
    </g>
  );
}
