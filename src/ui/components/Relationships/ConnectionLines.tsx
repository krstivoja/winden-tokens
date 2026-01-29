// Connection lines between variables (bezier curves)

import React from 'react';
import { GroupData, Connection } from './types';

interface ConnectionLinesProps {
  groups: GroupData[];
  connections: Connection[];
  rowHeight: number;
  headerHeight: number;
  padding: number;
  onDisconnect: (variableId: string, resolvedColor: string) => void;
}

const GROUP_WIDTH = 220;

export function ConnectionLines({
  groups,
  connections,
  rowHeight,
  headerHeight,
  padding,
  onDisconnect,
}: ConnectionLinesProps) {
  return (
    <g className="connections-layer">
      {connections.map(conn => {
        const fromGroup = groups[conn.fromGroupIndex];
        const toGroup = groups[conn.toGroupIndex];

        if (!fromGroup || !toGroup) return null;

        const fromVar = fromGroup.variables[conn.fromVarIndex];
        const toVar = toGroup.variables[conn.toVarIndex];

        if (!fromVar || !toVar) return null;

        // Calculate Y positions
        const fromY = fromGroup.y + headerHeight + padding + conn.fromVarIndex * rowHeight + rowHeight / 2;
        const toY = toGroup.y + headerHeight + padding + conn.toVarIndex * rowHeight + rowHeight / 2;

        // Connection points: FROM left side of referencing var, TO right side of referenced var
        let fromX: number;
        let toX: number;

        if (fromGroup.x > toGroup.x) {
          // Referencing group is on the right, referenced on the left
          fromX = fromGroup.x + 8; // Left side of from group
          toX = toGroup.x + GROUP_WIDTH - 8; // Right side of to group
        } else if (fromGroup.x < toGroup.x) {
          // Referencing group is on the left, referenced on the right
          fromX = fromGroup.x + GROUP_WIDTH - 8; // Right side of from group
          toX = toGroup.x + 8; // Left side of to group
        } else {
          // Same column - connect right to right with curve
          fromX = fromGroup.x + GROUP_WIDTH - 8;
          toX = toGroup.x + GROUP_WIDTH - 8;
        }

        // Calculate control points for smooth bezier curve
        const dx = Math.abs(toX - fromX);
        const controlOffset = Math.max(40, Math.min(dx * 0.5, 100));

        let path: string;
        if (fromGroup.x === toGroup.x) {
          // Same column - curve outward
          const curveOut = 60;
          path = `M ${fromX} ${fromY} C ${fromX + curveOut} ${fromY}, ${toX + curveOut} ${toY}, ${toX} ${toY}`;
        } else if (fromX < toX) {
          // Left to right
          path = `M ${fromX} ${fromY} C ${fromX + controlOffset} ${fromY}, ${toX - controlOffset} ${toY}, ${toX} ${toY}`;
        } else {
          // Right to left
          path = `M ${fromX} ${fromY} C ${fromX - controlOffset} ${fromY}, ${toX + controlOffset} ${toY}, ${toX} ${toY}`;
        }

        const handleClick = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (confirm(`Disconnect ${fromVar.name.split('/').pop()} from ${toVar.name}?`)) {
            onDisconnect(fromVar.id, toVar.color);
          }
        };

        return (
          <g key={conn.id} className="connection-group">
            {/* Invisible wider path for easier clicking */}
            <path
              d={path}
              fill="none"
              stroke="transparent"
              strokeWidth={12}
              style={{ cursor: 'pointer' }}
              onClick={handleClick}
            />
            {/* Visible path */}
            <path
              d={path}
              fill="none"
              stroke="var(--text)"
              strokeWidth={1.5}
              opacity={0.5}
              className="connection-line"
              style={{ pointerEvents: 'none' }}
            />
          </g>
        );
      })}
    </g>
  );
}
