// Mode selector dropdown

import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';

export function ModeSelector() {
  const { collections, selectedCollectionIds, selectedModeId, setSelectedModeId } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get available modes from selected collections
  const availableModes = React.useMemo(() => {
    const selectedCollections = collections.filter(c => selectedCollectionIds.has(c.id));

    console.log('[ModeSelector] All collections:', collections.map(c => ({
      name: c.name,
      id: c.id,
      modesCount: c.modes?.length || 0,
      modes: c.modes
    })));

    // If no collections selected, return empty array
    if (selectedCollections.length === 0) {
      return [];
    }

    // Find the collection with the most modes
    // This ensures we show the most comprehensive set of modes
    let collectionWithMostModes = selectedCollections[0];
    for (const collection of selectedCollections) {
      if ((collection.modes?.length || 0) > (collectionWithMostModes.modes?.length || 0)) {
        collectionWithMostModes = collection;
      }
    }

    const modes = collectionWithMostModes.modes || [];
    console.log('[ModeSelector] Using collection with most modes:', collectionWithMostModes.name, '- modes:', modes);
    return modes;
  }, [collections, selectedCollectionIds]);

  // Auto-select first mode if current selection is invalid
  useEffect(() => {
    if (availableModes.length > 0) {
      const isValidMode = availableModes.some(m => m.modeId === selectedModeId);
      if (!isValidMode) {
        setSelectedModeId(availableModes[0].modeId);
      }
    }
  }, [availableModes, selectedModeId, setSelectedModeId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedMode = availableModes.find(m => m.modeId === selectedModeId);
  const buttonLabel = selectedMode ? selectedMode.name : 'Mode';

  // Don't render if no modes available
  if (availableModes.length === 0) {
    return null;
  }

  return (
    <div className="mode-selector" ref={dropdownRef}>
      <button
        className="mode-selector-btn"
        onClick={() => setIsOpen(!isOpen)}
      >
        {buttonLabel} ▾
      </button>

      {isOpen && (
        <div className="mode-selector-dropdown">
          <div className="dropdown-list">
            {availableModes.map(mode => (
              <label key={mode.modeId} className="dropdown-item">
                <input
                  type="radio"
                  name="mode"
                  checked={selectedModeId === mode.modeId}
                  onChange={() => {
                    setSelectedModeId(mode.modeId);
                    setIsOpen(false);
                  }}
                />
                <span>{mode.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
