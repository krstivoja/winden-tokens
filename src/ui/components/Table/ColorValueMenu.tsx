// Color value menu component

import React from 'react';
import { useModalContext } from '../Modals/ModalContext';
import { post } from '../../hooks/usePluginMessages';
import { ShadesIcon, TypeIcons } from '../Icons';
import { hexToRgb } from '../../utils/color';

interface ColorValueMenuProps {
  position: { top: number; left: number };
  variableId: string;
  currentValue: string;
  onClose: () => void;
}

export function ColorValueMenu({ position, variableId, currentValue, onClose }: ColorValueMenuProps) {
  const { openColorPicker, openColorReference } = useModalContext();

  const handlePickColor = () => {
    onClose();
    openColorPicker({
      initialColor: currentValue,
      onConfirm: (hex) => {
        post({ type: 'update-variable-value', id: variableId, value: hexToRgb(hex) });
      },
    });
  };

  const handleReferenceColor = () => {
    onClose();
    openColorReference({
      currentVariableId: variableId,
      currentValue,
      onSelect: (refName) => {
        post({ type: 'update-variable-value', id: variableId, value: `{${refName}}` });
      },
    });
  };

  return (
    <div
      id="color-value-menu"
      className="color-value-menu open"
      style={{ top: position.top, left: position.left }}
    >
      <button onClick={handlePickColor}>
        <span className="icon"><ShadesIcon /></span>
        Pick Color
      </button>
      <button onClick={handleReferenceColor}>
        <span className="icon">{TypeIcons.COLOR}</span>
        Reference Color
      </button>
    </div>
  );
}
