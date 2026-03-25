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
  className = 'dropdown-menu',
  id,
}: ColorMenuProps) {
  return (
    <div
      id={id}
      className={`${className} absolute z-50`}
      style={{ top: position.top, left: position.left }}
    >
      {options ? (
        options.map((option, index) => (
          <button
            key={index}
            type="button"
            className="dropdown-item"
            onClick={option.onClick}
            style={option.style}
          >
            {option.icon && <span className="dropdown-item-icon">{option.icon}</span>}
            <span className="dropdown-item-text">{option.label}</span>
          </button>
        ))
      ) : (
        <>
          {onClear && currentColor && (
            <button type="button" className="dropdown-item" onClick={onClear}>
              <span className="dropdown-item-icon">
                <span className="inline-block w-3 h-3 rounded" style={{ background: currentColor }} />
              </span>
              <span className="dropdown-item-text">Clear</span>
            </button>
          )}
          {onPickColor && (
            <button type="button" className="dropdown-item" onClick={onPickColor}>
              <span className="dropdown-item-icon">
                <ShadesIcon />
              </span>
              <span className="dropdown-item-text">Pick Color</span>
            </button>
          )}
          {onReferenceColor && (
            <button type="button" className="dropdown-item" onClick={onReferenceColor}>
              <span className="dropdown-item-icon">{TypeIcons.COLOR}</span>
              <span className="dropdown-item-text">Reference Color</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
