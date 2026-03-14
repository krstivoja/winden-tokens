// Collection filters component

import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';

export function CollectionFilters() {
  const { collections, selectedCollectionIds, toggleCollection, toggleAllCollections } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedCount = selectedCollectionIds.size;
  const totalCount = collections.length;

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

  if (collections.length === 0) {
    return null;
  }

  return (
    <div className="collection-filters" ref={dropdownRef}>
      <button
        className="collection-filters-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <span>Collections ({selectedCount}/{totalCount})</span>
        <span className="dropdown-arrow" aria-hidden="true">▾</span>
      </button>

      {isOpen && (
        <div className="collection-filters-dropdown">
          <div className="collection-filters-header">
            <span>Select Collections</span>
            <button
              className="btn btn-sm"
              onClick={toggleAllCollections}
            >
              {selectedCount === totalCount ? 'None' : 'All'}
            </button>
          </div>
          <div className="collection-filters-list">
            {collections.map(collection => (
              <label key={collection.id} className="collection-filter-item">
                <input
                  type="checkbox"
                  checked={selectedCollectionIds.has(collection.id)}
                  onChange={() => toggleCollection(collection.id)}
                />
                <span>{collection.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
