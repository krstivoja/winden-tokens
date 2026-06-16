// Value cell component

import React, { useState, useCallback } from 'react';
import { VariableData } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { useModalContext } from '../Modals/ModalContext';
import { post } from '../../hooks/usePluginMessages';
import { getVariableValueForMode, resolveModeIdForCollection } from '../../utils/modes';
import { hexToRgb } from '../../utils/color';
import { TextButton } from '../common/Button';
import { InputTable } from './InputTable';
import { ColorOptionsDropdown } from './ColorOptionsDropdown';

interface ValueCellProps {
  variable: VariableData;
  modifierButton?: React.ReactNode;
}

export function ValueCell({ variable, modifierButton }: ValueCellProps) {
  const { collections, variables, selectedModeId } = useAppContext();
  const { openColorPicker, openColorReference } = useModalContext();

  const currentValue = getVariableValueForMode(collections, variable, selectedModeId);

  const [inputValue, setInputValue] = useState(currentValue);

  const handleValueChange = useCallback((newValue: string) => {
    const modeId = resolveModeIdForCollection(collections, variable.collectionId, selectedModeId);
    post({
      type: 'update-variable-value',
      id: variable.id,
      value: newValue,
      modeId,
    });
  }, [collections, variable.collectionId, variable.id, selectedModeId]);

  const handleBlur = useCallback(() => {
    if (inputValue !== currentValue) {
      handleValueChange(inputValue);
    }
  }, [inputValue, currentValue, handleValueChange]);

  // Update local state when prop changes or mode changes
  React.useEffect(() => {
    setInputValue(currentValue);
  }, [currentValue]);

  // Reusable input component
  const valueInput = (
    <InputTable
      value={inputValue}
      onChange={e => setInputValue(e.target.value)}
      onBlur={handleBlur}
    />
  );

  if (variable.resolvedType === 'COLOR') {
    // Check if this is a reference (format: {variableName})
    const refMatch = currentValue.match(/^\{(.+)\}$/);
    let displayColor = currentValue;

    if (refMatch) {
      const refName = refMatch[1];
      const refVariable = variables.find(rv => rv.name === refName);
      if (refVariable && refVariable.resolvedType === 'COLOR') {
        displayColor = getVariableValueForMode(collections, refVariable, selectedModeId);
      } else {
        displayColor = '#888888';
      }
    }

    const modeId = resolveModeIdForCollection(collections, variable.collectionId, selectedModeId);

    const handlePickColor = () => {
      openColorPicker({
        initialColor: currentValue,
        onConfirm: (hex) => {
          post({ type: 'update-variable-value', id: variable.id, value: hexToRgb(hex), modeId });
        },
      });
    };

    const handleReferenceColor = () => {
      openColorReference({
        currentVariableId: variable.id,
        currentValue,
        onSelect: (refName) => {
          post({ type: 'update-variable-value', id: variable.id, value: `{${refName}}`, modeId });
        },
      });
    };

    return (
      <div className="flex items-center gap-2 h-full">
        <ColorOptionsDropdown
          color={displayColor}
          onPickColor={handlePickColor}
          onReferenceColor={handleReferenceColor}
        />
        {valueInput}
        {modifierButton}
      </div>
    );
  }

  if (variable.resolvedType === 'BOOLEAN') {
    return (
      <div className="px-2.5 h-full flex items-center gap-2">
        <div className="flex border border-border rounded overflow-hidden">
          <TextButton
            size="sm"
            className={`rounded-none border-r border-border ${currentValue === 'true' ? 'bg-primary text-base' : 'bg-transparent'}`}
            onClick={() => handleValueChange('true')}
          >
            True
          </TextButton>
          <TextButton
            size="sm"
            className={`rounded-none ${currentValue === 'false' ? 'bg-primary text-base' : 'bg-transparent'}`}
            onClick={() => handleValueChange('false')}
          >
            False
          </TextButton>
        </div>
        {modifierButton}
      </div>
    );
  }

  return (
    <div className="flex items-center h-full pl-2.5 gap-2">
      {valueInput}
      {modifierButton}
    </div>
  );
}
