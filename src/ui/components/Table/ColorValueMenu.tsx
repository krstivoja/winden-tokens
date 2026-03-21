// Color value menu component

import React from 'react';
import { useModalContext } from '../Modals/ModalContext';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { ShadesIcon, TypeIcons } from '../Icons';
import { hexToRgb } from '../../utils/color';
import { resolveModeIdForCollection } from '../../utils/modes';

interface ColorValueMenuProps {
  position: { top: number; left: number };
  variableId: string;
  currentValue: string;
  onClose: () => void;
}

export function ColorValueMenu({ position, variableId, currentValue, onClose }: ColorValueMenuProps) {
  const { openColorPicker, openColorReference } = useModalContext();
  const { collections, variables, selectedModeId } = useAppContext();
  const variable = variables.find(candidate => candidate.id === variableId);
  const modeId = variable
    ? resolveModeIdForCollection(collections, variable.collectionId, selectedModeId)
    : selectedModeId;

  const handlePickColor = () => {
    onClose();
    openColorPicker({
      initialColor: currentValue,
      onConfirm: (hex) => {
        post({ type: 'update-variable-value', id: variableId, value: hexToRgb(hex), modeId });
      },
    });
  };

  const handleReferenceColor = () => {
    onClose();
    openColorReference({
      currentVariableId: variableId,
      currentValue,
      onSelect: (refName) => {
        post({ type: 'update-variable-value', id: variableId, value: `{${refName}}`, modeId });
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
