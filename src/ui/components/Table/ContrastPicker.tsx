// Contrast color picker menu - renders dropdown menu items

import React from 'react';
import { ShadesIcon, TypeIcons } from '../Icons';

interface ContrastPickerProps {
  contrastColor: string | null;
  onPickColor: () => void;
  onReferenceColor: () => void;
  onClear: () => void;
}

export function ContrastPicker({
  contrastColor,
  onPickColor,
  onReferenceColor,
  onClear,
}: ContrastPickerProps) {
  return (
    <>
      {contrastColor && (
        <button type="button" className="dropdown-item" onClick={onClear}>
          <span className="dropdown-item-icon">
            <span className="inline-block w-3 h-3 rounded" style={{ background: contrastColor }} />
          </span>
          <span className="dropdown-item-text">Clear</span>
        </button>
      )}
      <button type="button" className="dropdown-item" onClick={onPickColor}>
        <span className="dropdown-item-icon">
          <ShadesIcon />
        </span>
        <span className="dropdown-item-text">Pick Color</span>
      </button>
      <button type="button" className="dropdown-item" onClick={onReferenceColor}>
        <span className="dropdown-item-icon">{TypeIcons.COLOR}</span>
        <span className="dropdown-item-text">Reference Color</span>
      </button>
    </>
  );
}
