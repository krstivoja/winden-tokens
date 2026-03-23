// Toolbar component

import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { PlusIcon, SearchIcon } from '../Icons';
import { IconButton } from '../common/IconButton';
import { AddMenu } from './AddMenu';
import { CollectionFilters } from './CollectionFilters';
import { VariableTypeFilters } from './VariableTypeFilters';
import { ModeSelector } from './ModeSelector';
import { useModalContext } from '../Modals/ModalContext';

interface ToolbarProps {
  status: { message: string; type: string };
}

export function Toolbar({ status }: ToolbarProps) {
  const { setSearchQuery, getFilteredCount, searchQuery } = useAppContext();
  const { openInputModal } = useModalContext();
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
        <VariableTypeFilters />
        <button
          id="add-variable-btn"
          ref={addBtnRef}
          className="btn btn-primary"
          onClick={handleAddVariable}
        >
          <span className="icon"><PlusIcon /></span>
          Add Variable
        </button>
      </div>

      <div className="spacer" />

      <div className="toolbar-group">
        <CollectionFilters />
        <IconButton
          id="add-collection-btn"
          icon={<PlusIcon />}
          onClick={handleAddCollection}
          title="New Collection"
          aria-label="New Collection"
        />
        <ModeSelector />
      </div>

      <div className="toolbar-divider" />

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
        <span
          id="status"
          className={`status ${status.type} ${status.type === 'warning' ? 'clickable' : ''}`}
          onClick={status.type === 'warning' ? () => {
            console.log('[UI] Refresh clicked from status message');
            post({ type: 'refresh' });
          } : undefined}
          style={status.type === 'warning' ? { cursor: 'pointer' } : undefined}
        >
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
