// Table header with actions and search

import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { PlusIcon } from '../Icons';
import { IconTextButton, IconButton } from '../common/Button';
import { Search } from '../common/Search';
import { AddMenu } from '../Toolbar/AddMenu';
import { useModalContext } from '../Modals/ModalContext';

interface TableHeaderProps {
  status: { message: string; type: string };
}

export function TableHeader({ status }: TableHeaderProps) {
  const { setSearchQuery, getFilteredCount, searchQuery } = useAppContext();
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addMenuPosition, setAddMenuPosition] = useState({ top: 0, left: 0 });
  const addBtnRef = useRef<HTMLButtonElement>(null);

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
    <div className="flex items-center justify-between gap-4 p-4 border-b border-border">
      <IconTextButton
        id="add-variable-btn"
        ref={addBtnRef}
        variant="primary"
        icon={<PlusIcon />}
        onClick={handleAddVariable}
      >
        Add Variable
      </IconTextButton>

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
