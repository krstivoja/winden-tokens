// Add variable menu component

import React from 'react';
import { TypeIcons, VariableType } from '../Icons';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { useModalContext } from '../Modals/ModalContext';

interface AddMenuProps {
  position: { top: number; left: number };
  onClose: () => void;
}

const variableTypes: { type: VariableType; label: string }[] = [
  { type: 'COLOR', label: 'Color' },
  { type: 'FLOAT', label: 'Number' },
  { type: 'STRING', label: 'String' },
  { type: 'BOOLEAN', label: 'Boolean' },
];

export function AddMenu({ position, onClose }: AddMenuProps) {
  const { selectedCollectionId } = useAppContext();
  const { openInputModal } = useModalContext();

  const handleAddVariable = (type: VariableType) => {
    onClose();
    openInputModal({
      title: 'New Variable',
      label: 'Variable name',
      confirmText: 'Create',
      onConfirm: (name) => {
        let value = '';
        if (type === 'COLOR') value = 'rgb(0, 0, 0)';
        else if (type === 'FLOAT') value = '0';
        else if (type === 'BOOLEAN') value = 'true';
        post({
          type: 'create-variable',
          collectionId: selectedCollectionId,
          name,
          varType: type,
          value,
        });
      },
    });
  };

  return (
    <div
      id="add-menu"
      className="add-menu open"
      style={{ top: position.top, left: position.left }}
    >
      {variableTypes.map(({ type, label }) => (
        <button key={type} onClick={() => handleAddVariable(type)}>
          <span className="icon">{TypeIcons[type]}</span>
          {label}
        </button>
      ))}
    </div>
  );
}
