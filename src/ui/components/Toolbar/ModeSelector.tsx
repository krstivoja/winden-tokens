// Mode selector dropdown

import React, { useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { OptionsDropdown } from '../common/OptionsDropdown/OptionsDropdown';

export function ModeSelector() {
  const { collections, selectedCollectionIds, selectedModeId, setSelectedModeId } = useAppContext();

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

  const selectedMode = availableModes.find(m => m.modeId === selectedModeId);
  const buttonLabel = selectedMode ? selectedMode.name : 'Mode';

  // Don't render if no modes available
  if (availableModes.length === 0) {
    return null;
  }

  return (
    <OptionsDropdown label={buttonLabel}>
      <div className="dropdown-list">
        {availableModes.map(mode => (
          <label key={mode.modeId} className="dropdown-item">
            <input
              type="radio"
              name="mode"
              checked={selectedModeId === mode.modeId}
              onChange={() => setSelectedModeId(mode.modeId)}
            />
            <span>{mode.name}</span>
          </label>
        ))}
      </div>
    </OptionsDropdown>
  );
}
