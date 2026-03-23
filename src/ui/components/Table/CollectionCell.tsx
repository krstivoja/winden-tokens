// Collection cell component - displays collection selector and allows moving variables between collections

import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { VariableData } from '../../types';
import { Radio } from '../common/Radio';
import { ChevronDownIcon } from '../Icons';

interface CollectionCellProps {
  variable: VariableData;
}

export function CollectionCell({ variable }: CollectionCellProps) {
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

  const currentCollection = collections.find(c => c.id === variable.collectionId);
  const buttonLabel = currentCollection ? currentCollection.name : 'Unknown';

  const handleMoveToCollection = (targetCollectionId: string) => {
    if (targetCollectionId === variable.collectionId) {
      setIsOpen(false);
      return;
    }

    post({
      type: 'move-variable-to-collection',
      variableId: variable.id,
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
        onClick={() => setIsOpen(!isOpen)}
        title="Move to collection"
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
                name="collection-cell"
                label={collection.name}
                checked={variable.collectionId === collection.id}
                onChange={() => handleMoveToCollection(collection.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
