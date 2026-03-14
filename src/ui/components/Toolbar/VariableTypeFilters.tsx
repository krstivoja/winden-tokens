// Variable type filters component

import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { TypeIcon } from '../Icons';

const VARIABLE_TYPES = [
  { type: 'COLOR', label: 'Color' },
  { type: 'FLOAT', label: 'Number' },
  { type: 'STRING', label: 'String' },
  { type: 'BOOLEAN', label: 'Boolean' },
] as const;

export function VariableTypeFilters() {
  const { selectedVariableTypes, toggleVariableType, toggleAllVariableTypes } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedCount = selectedVariableTypes.size;
  const totalCount = VARIABLE_TYPES.length;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="variable-type-filters" ref={dropdownRef}>
      <button
        className="variable-type-filters-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <span>Types ({selectedCount}/{totalCount})</span>
        <span className="dropdown-arrow" aria-hidden="true">▾</span>
      </button>

      {isOpen && (
        <div className="variable-type-filters-dropdown">
          <div className="variable-type-filters-header">
            <span>Select Variable Types</span>
            <button
              className="btn btn-sm"
              onClick={toggleAllVariableTypes}
            >
              {selectedCount === totalCount ? 'None' : 'All'}
            </button>
          </div>
          <div className="variable-type-filters-list">
            {VARIABLE_TYPES.map(({ type, label }) => (
              <label key={type} className="variable-type-filter-item">
                <input
                  type="checkbox"
                  checked={selectedVariableTypes.has(type)}
                  onChange={() => toggleVariableType(type)}
                />
                <span className="type-icon">
                  <TypeIcon type={type} />
                </span>
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
