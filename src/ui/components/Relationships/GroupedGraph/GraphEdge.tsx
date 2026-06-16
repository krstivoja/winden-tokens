// GraphEdge component - Custom edge for graph connections

import React from 'react';
import { getBezierPath, Position } from '@xyflow/react';
import type { EdgeProps, Edge } from '@xyflow/react';
import { CustomEdgeData } from './types';
import { GENERATED_CONNECTION_COLOR, REFERENCE_CONNECTION_COLOR } from './constants';

export function CustomEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<Edge<CustomEdgeData>>) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const kind = data?.kind || 'reference';
  const stroke = kind === 'generated' ? GENERATED_CONNECTION_COLOR : REFERENCE_CONNECTION_COLOR;
  const strokeDasharray = kind === 'generated' ? '7 5' : undefined;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (kind !== 'reference' || !data) return;
    if (confirm(`Disconnect ${data.receiverShortName}?`)) {
      data.onDisconnect(data.receiverName, data.resolvedValue);
    }
  };

  return (
    <g>
      {kind === 'reference' && (
        <path
          d={edgePath}
          fill="none"
          stroke="transparent"
          strokeWidth={12}
          style={{ cursor: 'pointer' }}
          onClick={handleClick}
        />
      )}
      <path
        d={edgePath}
        fill="none"
        stroke={stroke}
        strokeWidth={kind === 'generated' ? 2.5 : 2}
        strokeDasharray={strokeDasharray}
        style={{ pointerEvents: 'none' }}
      />
    </g>
  );
}
