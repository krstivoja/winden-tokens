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
  className = '',
  id,
}: ColorMenuProps) {
  const menuClasses = `bg-base border border-border rounded-lg shadow-lg py-1 min-w-[160px] ${className}`;

  return (
    <div
      id={id}
      className={`${menuClasses} absolute z-50`}
      style={{ top: position.top, left: position.left }}
    >
      {options ? (
        options.map((option, index) => (
          <button
            key={index}
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text bg-transparent hover:bg-base-2 transition-colors text-left"
            onClick={option.onClick}
            style={option.style}
          >
            {option.icon && <span className="flex-shrink-0 flex items-center justify-center w-4 h-4">{option.icon}</span>}
            <span className="flex-1">{option.label}</span>
          </button>
        ))
      ) : (
        <>
          {onClear && currentColor && (
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text bg-transparent hover:bg-base-2 transition-colors text-left"
              onClick={onClear}
            >
              <span className="flex-shrink-0 flex items-center justify-center w-4 h-4">
                <span className="inline-block w-3 h-3 rounded" style={{ background: currentColor }} />
              </span>
              <span className="flex-1">Clear</span>
            </button>
          )}
          {onPickColor && (
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text bg-transparent hover:bg-base-2 transition-colors text-left"
              onClick={onPickColor}
            >
              <span className="flex-shrink-0 flex items-center justify-center w-4 h-4">
                <ShadesIcon />
              </span>
              <span className="flex-1">Pick Color</span>
            </button>
          )}
          {onReferenceColor && (
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text bg-transparent hover:bg-base-2 transition-colors text-left"
              onClick={onReferenceColor}
            >
              <span className="flex-shrink-0 flex items-center justify-center w-4 h-4">{TypeIcons.COLOR}</span>
              <span className="flex-1">Reference Color</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
