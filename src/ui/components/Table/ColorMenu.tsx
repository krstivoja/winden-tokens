// Reusable color menu component for picking/referencing colors

import React, { ReactNode } from 'react';
import { ShadesIcon, TypeIcons } from '../Icons';

export interface ColorMenuOption {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  className?: string;
  style?: React.CSSProperties;
}

interface ColorMenuProps {
  position: { top: number; left: number };
  options?: ColorMenuOption[];
  onPickColor?: () => void;
  onReferenceColor?: () => void;
  onClear?: () => void;
  currentColor?: string | null;
  className?: string;
  id?: string;
}

export function ColorMenu({
  position,
  options,
  onPickColor,
  onReferenceColor,
  onClear,
  currentColor,
  className = 'color-value-menu',
  id,
}: ColorMenuProps) {
  // If custom options provided, use those
  if (options) {
    return (
      <div
        id={id}
        className={`${className} open`}
        style={{ top: position.top, left: position.left }}
      >
        {options.map((option, index) => (
          <button
            key={index}
            onClick={option.onClick}
            className={option.className}
            style={option.style}
          >
            {option.icon && <span className="icon">{option.icon}</span>}
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    );
  }

  // Default: standard Pick/Reference pattern
  return (
    <div
      id={id}
      className={`${className} open`}
      style={{ top: position.top, left: position.left }}
    >
      {onClear && currentColor && (
        <button onClick={onClear}>
          <span className="contrast-item-swatch" style={{ background: currentColor }} />
          <span>Clear</span>
        </button>
      )}
      {onPickColor && (
        <button onClick={onPickColor}>
          <span className="icon"><ShadesIcon /></span>
          <span>Pick Color</span>
        </button>
      )}
      {onReferenceColor && (
        <button onClick={onReferenceColor}>
          <span className="icon">{TypeIcons.COLOR}</span>
          <span>Reference Color</span>
        </button>
      )}
    </div>
  );
}
