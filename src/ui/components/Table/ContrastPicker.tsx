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
        <button
          type="button"
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text bg-transparent hover:bg-base-2 transition-colors text-left"
          onClick={onClear}
        >
          <span className="flex-shrink-0 flex items-center justify-center w-4 h-4">
            <span className="inline-block w-3 h-3 rounded" style={{ background: contrastColor }} />
          </span>
          <span className="flex-1">Clear</span>
        </button>
      )}
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
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text bg-transparent hover:bg-base-2 transition-colors text-left"
        onClick={onReferenceColor}
      >
        <span className="flex-shrink-0 flex items-center justify-center w-4 h-4">{TypeIcons.COLOR}</span>
        <span className="flex-1">Reference Color</span>
      </button>
    </>
  );
}
