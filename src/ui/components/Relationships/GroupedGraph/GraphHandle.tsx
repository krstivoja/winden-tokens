// GraphHandle component - Reusable handle for graph nodes

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { ROW_HEIGHT } from './constants';

interface GraphHandleProps {
  type: 'source' | 'target';
  position: Position;
  id: string;
  isConnected: boolean;
  isDisabled?: boolean;
  isConnectable: boolean;
  connectionColor: string;
  idleColor: string;
  idleBorderColor: string;
}

export function GraphHandle({
  type,
  position,
  id,
  isConnected,
  isDisabled,
  isConnectable,
  connectionColor,
  idleColor,
  idleBorderColor,
}: GraphHandleProps) {
  return (
    <Handle
      type={type}
      position={position}
      id={id}
      className={`w-2.5! h-2.5! rounded-full border-text/50! cursor-crosshair transition-transform duration-150 hover:scale-150 ${isConnected ? 'scale-125' : ''} ${isDisabled ? 'opacity-30 cursor-not-allowed' : ''}`}
      isConnectable={isConnectable}
      style={{
        top: ROW_HEIGHT / 2,
        background: isConnected ? connectionColor : idleColor,
        borderColor: isConnected ? connectionColor : idleBorderColor,
      }}
    />
  );
}
