// ColorSwatch - Color display with checkerboard background for transparency
// Usage:
//   <ColorSwatch color="#FF0000" onClick={handleClick} />
//   <ColorSwatch color="rgb(255, 0, 0)" size="lg" />

import React from 'react';

export interface ColorSwatchProps {
  color: string;
  onClick?: (e: React.MouseEvent) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ColorSwatch({ color, onClick, size = 'md', className = '' }: ColorSwatchProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div
      className={`bg-checkerboard ${sizeClasses[size]} rounded border border-gray-200 ${onClick ? 'cursor-pointer' : ''} relative overflow-hidden ${className}`}
      onClick={onClick}
    >
      <div
        className="absolute inset-0"
        style={{ background: color }}
      />
    </div>
  );
}
