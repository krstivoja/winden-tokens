// Reusable color menu component for picking/referencing colors

import React, { ReactNode } from 'react';
import { ShadesIcon, TypeIcons } from '../Icons';
import { IconTextButton } from '../common/Button';

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
          <IconTextButton
            key={index}
            icon={option.icon}
            onClick={option.onClick}
            className={option.className}
            style={option.style}
          >
            {option.label}
          </IconTextButton>
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
        <IconTextButton
          icon={<span className="inline-block w-3 h-3 rounded" style={{ background: currentColor }} />}
          onClick={onClear}
        >
          Clear
        </IconTextButton>
      )}
      {onPickColor && (
        <IconTextButton icon={<ShadesIcon />} onClick={onPickColor}>
          Pick Color
        </IconTextButton>
      )}
      {onReferenceColor && (
        <IconTextButton icon={TypeIcons.COLOR} onClick={onReferenceColor}>
          Reference Color
        </IconTextButton>
      )}
    </div>
  );
}
