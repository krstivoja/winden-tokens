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
  const { variables } = useAppContext();
  const [inputValue, setInputValue] = useState(variable.value);

  const handleValueChange = useCallback((newValue: string) => {
    post({ type: 'update-variable-value', id: variable.id, value: newValue });
  }, [variable.id]);

  const handleBlur = useCallback(() => {
    if (inputValue !== variable.value) {
      handleValueChange(inputValue);
    }
  }, [inputValue, variable.value, handleValueChange]);

  // Update local state when prop changes
  React.useEffect(() => {
    setInputValue(variable.value);
  }, [variable.value]);

  if (variable.resolvedType === 'COLOR') {
    // Check if this is a reference (format: {variableName})
    const refMatch = variable.value.match(/^\{(.+)\}$/);
    let displayColor = variable.value;

    if (refMatch) {
      const refName = refMatch[1];
      const refVariable = variables.find(rv => rv.name === refName);
      if (refVariable && refVariable.resolvedType === 'COLOR') {
        displayColor = refVariable.value;
      } else {
        displayColor = '#888888';
      }
    }

    return (
      <div className="color-value-cell">
        <div
          className="color-swatch"
          onClick={(e) => onShowColorMenu(e, variable.id, variable.value)}
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
            className={variable.value === 'true' ? 'active' : ''}
            onClick={() => handleValueChange('true')}
          >
            True
          </button>
          <button
            className={variable.value === 'false' ? 'active' : ''}
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
