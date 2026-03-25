// ColorSwatch - Color display with checkerboard background for transparency
// Usage:
//   <ColorSwatch color="#FF0000" onClick={handleClick} />
//   <ColorSwatch color="rgb(255, 0, 0)" />

import React from 'react';

export interface ColorSwatchProps {
  color: string;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

export function ColorSwatch({ color, onClick, className = '' }: ColorSwatchProps) {
  return (
    <div
      className={`bg-checkerboard w-5 h-5 rounded border border-border ${onClick ? 'cursor-pointer' : ''} relative overflow-hidden shrink-0 ${className}`}
      onClick={onClick}
    >
      <div
        className="absolute inset-0"
        style={{ background: color }}
      />
    </div>
  );
}
