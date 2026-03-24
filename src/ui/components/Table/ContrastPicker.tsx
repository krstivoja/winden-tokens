// Contrast color picker menu

import React from 'react';
import { ShadesIcon, TypeIcons } from '../Icons';
import { IconTextButton } from '../common/Button';

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
        <IconTextButton
          icon={<span className="inline-block w-3 h-3 rounded" style={{ background: contrastColor }} />}
          onClick={onClear}
        >
          Clear
        </IconTextButton>
      )}
      <IconTextButton icon={<ShadesIcon />} onClick={onPickColor}>
        Pick Color
      </IconTextButton>
      <IconTextButton icon={TypeIcons.COLOR} onClick={onReferenceColor}>
        Reference Color
      </IconTextButton>
    </div>
  );
}
