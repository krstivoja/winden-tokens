// Contrast color picker menu

import React from 'react';
import { ShadesIcon } from '../Icons';

interface ContrastPickerProps {
  position: { top: number; left: number };
  contrastColor: string | null;
  onPickColor: () => void;
  onReferenceColor: () => void;
  onClear: () => void;
}

export function ContrastPicker({
  position,
  contrastColor,
  onPickColor,
  onReferenceColor,
  onClear,
}: ContrastPickerProps) {
  return (
    <div
      id="contrast-picker"
      className="contrast-picker"
      style={{ top: position.top, left: position.left }}
    >
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
        <span className="icon">⟳</span>
        <span>Reference Color</span>
      </button>
    </div>
  );
}
