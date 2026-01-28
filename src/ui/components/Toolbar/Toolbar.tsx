// Toolbar component

import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { PlusIcon, ShadesIcon, StepsIcon, SearchIcon } from '../Icons';
import { AddMenu } from './AddMenu';
import { useModalContext } from '../Modals/ModalContext';

interface ToolbarProps {
  status: { message: string; type: string };
}

export function Toolbar({ status }: ToolbarProps) {
  const { collections, selectedCollectionId, setSelectedCollectionId, setSearchQuery, getFilteredCount, searchQuery } = useAppContext();
  const { openInputModal, openShadesModal, openStepsModal } = useModalContext();
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addMenuPosition, setAddMenuPosition] = useState({ top: 0, left: 0 });
  const addBtnRef = useRef<HTMLButtonElement>(null);

  const handleAddCollection = () => {
    openInputModal({
      title: 'New Collection',
      label: 'Collection name',
      confirmText: 'Create',
      onConfirm: (name) => {
        post({ type: 'create-collection', name });
      },
    });
  };

  const handleAddVariable = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setAddMenuPosition({ top: rect.bottom + 4, left: rect.left });
    setShowAddMenu(true);
  };

  const handleCollectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCollectionId(e.target.value);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setSearchQuery('');
      (e.target as HTMLInputElement).value = '';
    }
  };

  const { shown, total } = getFilteredCount();

  // Close add menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#add-menu') && !target.closest('#add-variable-btn')) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <select
          id="collection-select"
          className="collection-select"
          value={selectedCollectionId || ''}
          onChange={handleCollectionChange}
        >
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          id="add-collection-btn"
          className="btn btn-icon"
          title="New Collection"
          onClick={handleAddCollection}
        >
          <span className="icon"><PlusIcon /></span>
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button
          id="add-variable-btn"
          ref={addBtnRef}
          className="btn btn-primary"
          onClick={handleAddVariable}
        >
          <span className="icon"><PlusIcon /></span>
          Add Variable
        </button>
        <button
          id="shades-btn"
          className="btn"
          title="Generate Color Shades"
          onClick={() => openShadesModal()}
        >
          <span className="icon"><ShadesIcon /></span>
          Shades
        </button>
        <button
          id="steps-btn"
          className="btn"
          title="Generate Number Steps"
          onClick={() => openStepsModal()}
        >
          <span className="icon"><StepsIcon /></span>
          Steps
        </button>
      </div>

      <div className="spacer" />

      <div className="search-wrapper">
        <span className="search-icon"><SearchIcon /></span>
        <input
          type="text"
          id="search-input"
          className="search-input"
          placeholder="Search..."
          onChange={handleSearchChange}
          onKeyDown={handleSearchKeyDown}
        />
        <span id="search-count" className="search-count">
          {searchQuery ? `${shown}/${total}` : ''}
        </span>
      </div>

      {status.message && (
        <span id="status" className={`status ${status.type}`}>
          {status.message}
        </span>
      )}

      {showAddMenu && (
        <AddMenu
          position={addMenuPosition}
          onClose={() => setShowAddMenu(false)}
        />
      )}
    </div>
  );
}
