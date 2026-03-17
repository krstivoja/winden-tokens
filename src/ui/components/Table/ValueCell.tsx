// Value cell component

import React, { useState, useCallback } from 'react';
import { VariableData } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';

interface ValueCellProps {
  variable: VariableData;
  onShowColorMenu: (e: React.MouseEvent, id: string, value: string) => void;
}

export function ValueCell({ variable, onShowColorMenu }: ValueCellProps) {
  const { variables, selectedModeId } = useAppContext();

  // Get the value for the selected mode, fallback to first mode value
  const currentValue = (selectedModeId && variable.valuesByMode[selectedModeId])
    ? variable.valuesByMode[selectedModeId]
    : variable.value;

  const [inputValue, setInputValue] = useState(currentValue);

  const handleValueChange = useCallback((newValue: string) => {
    post({
      type: 'update-variable-value',
      id: variable.id,
      value: newValue,
      modeId: selectedModeId
    });
  }, [variable.id, selectedModeId]);

  const handleBlur = useCallback(() => {
    if (inputValue !== currentValue) {
      handleValueChange(inputValue);
    }
  }, [inputValue, currentValue, handleValueChange]);

  // Update local state when prop changes or mode changes
  React.useEffect(() => {
    setInputValue(currentValue);
  }, [currentValue]);

  if (variable.resolvedType === 'COLOR') {
    // Check if this is a reference (format: {variableName})
    const refMatch = currentValue.match(/^\{(.+)\}$/);
    let displayColor = currentValue;

    if (refMatch) {
      const refName = refMatch[1];
      const refVariable = variables.find(rv => rv.name === refName);
      if (refVariable && refVariable.resolvedType === 'COLOR') {
        // Get the referenced variable's value for the selected mode
        displayColor = (selectedModeId && refVariable.valuesByMode[selectedModeId])
          ? refVariable.valuesByMode[selectedModeId]
          : refVariable.value;
      } else {
        displayColor = '#888888';
      }
    }

    return (
      <div className="color-value-cell">
        <div
          className="color-swatch"
          onClick={(e) => onShowColorMenu(e, variable.id, currentValue)}
        >
          <div
            className="color-swatch-inner"
            style={{ background: displayColor }}
          />
        </div>
        <input
          className="cell-input mono"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onBlur={handleBlur}
        />
      </div>
    );
  }

  if (variable.resolvedType === 'BOOLEAN') {
    return (
      <div className="cell">
        <div className="bool-toggle">
          <button
            className={currentValue === 'true' ? 'active' : ''}
            onClick={() => handleValueChange('true')}
          >
            True
          </button>
          <button
            className={currentValue === 'false' ? 'active' : ''}
            onClick={() => handleValueChange('false')}
          >
            False
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="value-cell">
      <input
        className="cell-input mono"
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onBlur={handleBlur}
      />
    </div>
  );
}
