// Contrast color picker menu

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
    <div className="contrast-picker">
      {contrastColor && (
        <button onClick={onClear}>
          <span className="contrast-item-swatch" style={{ background: contrastColor }} />
          <span>Clear</span>
        </button>
      )}
      <button onClick={onPickColor}>
        <span className="icon"><ShadesIcon /></span>
        <span>Pick Color</span>
      </button>
      <button onClick={onReferenceColor}>
        <span className="icon">{TypeIcons.COLOR}</span>
        <span>Reference Color</span>
      </button>
    </div>
  );
}
