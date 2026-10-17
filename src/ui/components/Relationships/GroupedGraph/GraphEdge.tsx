// GraphEdge component - Custom edge for graph connections

import React from 'react';
import { getBezierPath, Position } from '@xyflow/react';
import type { EdgeProps, Edge } from '@xyflow/react';
import { CustomEdgeData } from './types';
import { GENERATED_CONNECTION_COLOR, REFERENCE_CONNECTION_COLOR, HIGHLIGHT_COLOR } from './constants';

function CustomEdgeInner({
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
  const isDimmed = data?.isDimmed || false;
  const isHighlighted = data?.isHighlighted || false;
  const isGroupSibling = data?.isGroupSibling || false;
  const defaultStroke = kind === 'generated' ? GENERATED_CONNECTION_COLOR : REFERENCE_CONNECTION_COLOR;
  const stroke = isHighlighted || isGroupSibling ? HIGHLIGHT_COLOR : defaultStroke;
  const strokeDasharray = kind === 'generated' ? '7 5' : undefined;
  // --edge-width is theme-dependent (thinner in dark mode); generated edges stay half a pixel heavier.
  const baseWidth = kind === 'generated' ? 'calc(var(--edge-width) + 0.5px)' : 'var(--edge-width)';
  const opacity = isHighlighted ? 1 : isGroupSibling ? 0.35 : isDimmed ? 0.45 : 1;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (kind !== 'reference' || !data) return;
    if (!confirm(`Disconnect ${data.receiverShortName}?`)) return;
    // Property-row edges carry the unbind target as plain values plus a stable
    // callback (see GroupedGraph's handleUnbindProperty); token-to-token edges
    // still go through onDisconnect.
    if (data.onUnbindProperty && data.unbindNodeId && data.unbindTarget) {
      data.onUnbindProperty(data.unbindNodeId, data.unbindTarget);
    } else {
      data.onDisconnect?.(data.receiverName, data.resolvedValue);
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
        strokeDasharray={strokeDasharray}
        style={{ pointerEvents: 'none', strokeWidth: baseWidth, opacity, transition: 'opacity 150ms, stroke 150ms' }}
      />
    </g>
  );
}

// Memoized: only the edges attached to the node being dragged get new
// coordinates, so the rest skip re-rendering entirely.
export const CustomEdge = React.memo(CustomEdgeInner);
