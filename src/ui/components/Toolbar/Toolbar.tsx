// Toolbar component

import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { PlusIcon } from '../Icons';
import { IconTextButton, IconButton } from '../common/Button';
import { Search } from '../common/Search';
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
    <div className="toolbar flex justify-between gap-4 p-4">
      <div className="flex gap-4">
        <IconTextButton
          id="add-variable-btn"
          ref={addBtnRef}
          variant="primary"
          icon={<PlusIcon />}
          onClick={handleAddVariable}
        >
          Add Variable
        </IconTextButton>

        <VariableTypeFilters />

      </div>

      <div className="flex gap-4">
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


      <Search
        id="search-input"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search..."
        count={searchQuery ? `${shown}/${total}` : ''}
      />

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
