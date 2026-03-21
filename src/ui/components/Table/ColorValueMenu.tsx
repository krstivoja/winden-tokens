// Color value menu component

import React from 'react';
import { useModalContext } from '../Modals/ModalContext';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { hexToRgb } from '../../utils/color';
import { resolveModeIdForCollection } from '../../utils/modes';
import { ColorMenu } from './ColorMenu';

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
    <ColorMenu
      id="color-value-menu"
      position={position}
      onPickColor={handlePickColor}
      onReferenceColor={handleReferenceColor}
      className="color-value-menu"
    />
  );
}
