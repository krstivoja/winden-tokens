// Value cell component

import React, { useState, useCallback } from 'react';
import { VariableData } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { getVariableValueForMode, resolveModeIdForCollection } from '../../utils/modes';

interface ValueCellProps {
  variable: VariableData;
  onShowColorMenu: (e: React.MouseEvent, id: string, value: string) => void;
  modifierButton?: React.ReactNode;
}

export function ValueCell({ variable, onShowColorMenu, modifierButton }: ValueCellProps) {
  const { collections, variables, selectedModeId } = useAppContext();

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

    return (
      <div className="flex items-center gap-2 h-full pl-2.5">
        <div
          className="w-6 h-6 rounded border border-border cursor-pointer relative overflow-hidden before:content-[''] before:absolute before:inset-0 before:bg-[linear-gradient(45deg,var(--checker-dark)_25%,transparent_25%),linear-gradient(-45deg,var(--checker-dark)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--checker-dark)_75%),linear-gradient(-45deg,transparent_75%,var(--checker-dark)_75%)] before:[background-size:6px_6px] before:[background-position:0_0,0_3px,3px_-3px,-3px_0px]"
          onClick={(e) => onShowColorMenu(e, variable.id, currentValue)}
        >
          <div
            className="absolute inset-0 z-[1]"
            style={{ background: displayColor }}
          />
        </div>
        <input
          className="flex-1 h-full border-none bg-transparent text-base p-0 px-2.5 outline-none focus:bg-bg-input focus:shadow-[inset_0_0_0_2px_var(--accent)] text-sm font-['SF_Mono',Monaco,monospace]"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onBlur={handleBlur}
        />
        {modifierButton}
      </div>
    );
  }

  if (variable.resolvedType === 'BOOLEAN') {
    return (
      <div className="px-2.5 h-full flex items-center gap-2">
        <div className="flex border border-border rounded overflow-hidden">
          <button
            className={`px-3 py-1 border-none text-xs cursor-pointer border-r border-border ${currentValue === 'true' ? 'bg-accent text-text-on-accent' : 'bg-bg'}`}
            onClick={() => handleValueChange('true')}
          >
            True
          </button>
          <button
            className={`px-3 py-1 border-none text-xs cursor-pointer ${currentValue === 'false' ? 'bg-accent text-text-on-accent' : 'bg-bg'}`}
            onClick={() => handleValueChange('false')}
          >
            False
          </button>
        </div>
        {modifierButton}
      </div>
    );
  }

  return (
    <div className="flex items-center h-full pl-2.5 gap-2">
      <input
        className="flex-1 h-full border-none bg-transparent text-base p-0 px-2.5 outline-none focus:bg-bg-input focus:shadow-[inset_0_0_0_2px_var(--accent)] text-sm font-['SF_Mono',Monaco,monospace]"
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onBlur={handleBlur}
      />
      {modifierButton}
    </div>
  );
}
