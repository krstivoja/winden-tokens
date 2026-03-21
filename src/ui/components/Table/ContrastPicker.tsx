// Contrast color picker menu

import React from 'react';
import { ColorMenu } from './ColorMenu';

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
    <ColorMenu
      id="contrast-picker"
      position={position}
      onPickColor={onPickColor}
      onReferenceColor={onReferenceColor}
      onClear={onClear}
      currentColor={contrastColor}
      className="contrast-picker"
    />
  );
}
