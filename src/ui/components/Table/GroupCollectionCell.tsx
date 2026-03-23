// Group collection cell - allows moving entire groups between collections

import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { VariableData } from '../../types';
import { Radio } from '../common/Radio';
import { ChevronDownIcon } from '../Icons';

interface GroupCollectionCellProps {
  variables: VariableData[];
}

export function GroupCollectionCell({ variables }: GroupCollectionCellProps) {
  const { collections } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // All variables in a group should be in the same collection
  const currentCollectionId = variables[0]?.collectionId;
  const currentCollection = collections.find(c => c.id === currentCollectionId);
  const buttonLabel = currentCollection ? currentCollection.name : 'Unknown';

  const handleMoveGroupToCollection = (targetCollectionId: string) => {
    if (targetCollectionId === currentCollectionId) {
      setIsOpen(false);
      return;
    }

    // Move all variables in the group
    const variableIds = variables.map(v => v.id);

    post({
      type: 'move-group-to-collection',
      variableIds,
      targetCollectionId,
    });
    setIsOpen(false);
  };

  // Don't render if no collections available
  if (collections.length === 0) {
    return <div className="collection-cell-empty">—</div>;
  }

  return (
    <div className="collection-cell relative" ref={dropdownRef}>
      <div
        className="collection-cell-trigger"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        title="Move group to collection"
      >
        <span className="collection-label">{buttonLabel}</span>
        <span className="dropdown-arrow"><ChevronDownIcon /></span>
      </div>

      {isOpen && (
        <div className="collection-cell-dropdown">
          <div className="dropdown-list">
            {collections.map(collection => (
              <Radio
                key={collection.id}
                className="dropdown-item"
                name="group-collection-cell"
                label={collection.name}
                checked={currentCollectionId === collection.id}
                onChange={() => handleMoveGroupToCollection(collection.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
