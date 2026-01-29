// Color reference modal component

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useModalContext } from './ModalContext';
import { useAppContext } from '../../context/AppContext';
import { CloseIcon } from '../Icons';

export function ColorReferenceModal() {
  const { modals, closeColorReference } = useModalContext();
  const { variables } = useAppContext();
  const config = modals.colorReference;
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (config) {
      setSearchQuery('');
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [config]);

  const colorVariables = useMemo(() => {
    if (!config) return [];
    return variables.filter(v =>
      v.resolvedType === 'COLOR' && v.id !== (config.currentVariableId || '')
    );
  }, [variables, config]);

  const { grouped, ungrouped, sortedGroups } = useMemo(() => {
    const grouped: Record<string, typeof colorVariables> = {};
    const ungrouped: typeof colorVariables = [];

    colorVariables.forEach(v => {
      const parts = v.name.split('/');
      if (parts.length > 1) {
        const groupName = parts.slice(0, -1).join('/');
        if (!grouped[groupName]) grouped[groupName] = [];
        grouped[groupName].push(v);
      } else {
        ungrouped.push(v);
      }
    });

    return { grouped, ungrouped, sortedGroups: Object.keys(grouped).sort() };
  }, [colorVariables]);

  const getDisplayColor = (v: typeof colorVariables[0]) => {
    const refMatch = v.value.match(/^\{(.+)\}$/);
    if (refMatch) {
      const refVariable = variables.find(rv => rv.name === refMatch[1]);
      if (refVariable?.resolvedType === 'COLOR') {
        return refVariable.value;
      }
      return '#888888';
    }
    return v.value;
  };

  const matchesSearch = (name: string) => {
    if (!searchQuery) return true;
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const handleSelect = (variable: typeof colorVariables[0]) => {
    if (config?.onConfirm) {
      config.onConfirm(variable.id);
    } else if (config?.onSelect) {
      config.onSelect(variable.name);
    }
    closeColorReference();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const firstMatch = [...ungrouped, ...sortedGroups.flatMap(g => grouped[g])]
        .find(v => matchesSearch(v.name));
      if (firstMatch) {
        handleSelect(firstMatch);
      }
    } else if (e.key === 'Escape') {
      closeColorReference();
    }
  };

  if (!config) return null;

  const currentRefMatch = config.currentValue?.match(/^\{(.+)\}$/);
  const currentRefName = currentRefMatch?.[1];

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && closeColorReference()}>
      <div className="modal" style={{ width: 360 }}>
        <div className="modal-header">
          <h3>Reference Color</h3>
          <button className="modal-close" onClick={closeColorReference}>
            <span className="icon"><CloseIcon /></span>
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Select a color variable</label>
            <input
              ref={searchRef}
              type="text"
              className="form-input"
              placeholder="Search colors..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="color-reference-list">
            {/* Ungrouped */}
            {ungrouped.some(v => matchesSearch(v.name)) && (
              <div className="color-reference-group">
                {sortedGroups.length > 0 && (
                  <div className="color-reference-group-header">Variables</div>
                )}
                {ungrouped.filter(v => matchesSearch(v.name)).map(v => (
                  <div
                    key={v.id}
                    className={`color-reference-item ${v.name === currentRefName ? 'selected' : ''}`}
                    onClick={() => handleSelect(v)}
                  >
                    <div className="color-reference-swatch">
                      <div
                        className="color-reference-swatch-inner"
                        style={{ background: getDisplayColor(v) }}
                      />
                    </div>
                    <span className="color-reference-name">{v.name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Grouped */}
            {sortedGroups.map(groupName => {
              const groupVars = grouped[groupName].filter(v => matchesSearch(v.name));
              if (groupVars.length === 0) return null;

              return (
                <div key={groupName} className="color-reference-group">
                  <div className="color-reference-group-header">{groupName}</div>
                  {groupVars.map(v => {
                    const displayName = v.name.split('/').pop();
                    return (
                      <div
                        key={v.id}
                        className={`color-reference-item ${v.name === currentRefName ? 'selected' : ''}`}
                        onClick={() => handleSelect(v)}
                      >
                        <div className="color-reference-swatch">
                          <div
                            className="color-reference-swatch-inner"
                            style={{ background: getDisplayColor(v) }}
                          />
                        </div>
                        <span className="color-reference-name">{displayName}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={closeColorReference}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
