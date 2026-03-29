// Table sidebar with mode selector, type filters, and collection tree

import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { TypeIcon, PlusIcon } from '../Icons';
import { TextButton, IconTextButton } from '../common/Button';
import { useModalContext } from '../Modals/ModalContext';

interface TableSidebarProps {
  selectedModeId: string | null;
  onModeChange: (modeId: string) => void;
  selectedTypes: Set<string>;
  onTypeToggle: (type: string) => void;
  selectedCollections: Set<string>;
  onCollectionToggle: (collectionId: string) => void;
}

export function TableSidebar({
  selectedModeId,
  onModeChange,
  selectedTypes,
  onTypeToggle,
  selectedCollections,
  onCollectionToggle,
}: TableSidebarProps) {
  const { collections, variables } = useAppContext();
  const { openInputModal } = useModalContext();

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

  // Get unique types from variables
  const availableTypes = React.useMemo(() => {
    const types = new Set<string>();
    variables.forEach(v => types.add(v.resolvedType));
    return Array.from(types).sort();
  }, [variables]);

  // Get all modes from all collections
  const allModes = React.useMemo(() => {
    const modes: Array<{ modeId: string; name: string; collectionName: string }> = [];
    collections.forEach(collection => {
      collection.modes.forEach(mode => {
        modes.push({
          modeId: mode.modeId,
          name: mode.name,
          collectionName: collection.name,
        });
      });
    });
    return modes;
  }, [collections]);

  // Select all / deselect all for types
  const allTypesSelected = availableTypes.every(type => selectedTypes.has(type));
  const handleToggleAllTypes = () => {
    if (allTypesSelected) {
      availableTypes.forEach(type => onTypeToggle(type));
    } else {
      availableTypes.forEach(type => {
        if (!selectedTypes.has(type)) onTypeToggle(type);
      });
    }
  };

  // Select all / deselect all for collections
  const allCollectionsSelected = collections.every(c => selectedCollections.has(c.id));
  const handleToggleAllCollections = () => {
    if (allCollectionsSelected) {
      collections.forEach(c => onCollectionToggle(c.id));
    } else {
      collections.forEach(c => {
        if (!selectedCollections.has(c.id)) onCollectionToggle(c.id);
      });
    }
  };

  return (
    <div className="flex flex-col h-full border-r border-border bg-base w-64">
      {/* Mode Selector */}
      <div className="p-3 border-b border-border">
        <label className="block text-xs font-semibold mb-2">Mode</label>
        <select
          value={selectedModeId || ''}
          onChange={e => onModeChange(e.target.value)}
          className="w-full px-2 py-1.5 border border-border rounded bg-base text-text text-sm"
        >
          <option value="">All Modes</option>
          {allModes.map(mode => (
            <option key={mode.modeId} value={mode.modeId}>
              {mode.name} ({mode.collectionName})
            </option>
          ))}
        </select>
      </div>

      {/* Type Filters */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold">Types</label>
          <TextButton onClick={handleToggleAllTypes} size="sm">
            {allTypesSelected ? 'Deselect All' : 'Select All'}
          </TextButton>
        </div>
        <div className="space-y-1">
          {availableTypes.map(type => (
            <label
              key={type}
              className="flex items-center gap-2 cursor-pointer hover:bg-base-2 px-2 py-1 rounded transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedTypes.has(type)}
                onChange={() => onTypeToggle(type)}
                className="w-4 h-4"
              />
              <TypeIcon type={type} />
              <span className="text-sm flex-1">{type}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Collections Tree */}
      <div className="flex-1 overflow-auto p-3 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold">Collections</label>
          <TextButton onClick={handleToggleAllCollections} size="sm">
            {allCollectionsSelected ? 'Deselect All' : 'Select All'}
          </TextButton>
        </div>
        <div className="space-y-1 overflow-auto">
          {collections.map(collection => {
            const variableCount = variables.filter(v => v.collectionId === collection.id).length;
            return (
              <label
                key={collection.id}
                className="flex items-center gap-2 cursor-pointer hover:bg-base-2 px-2 py-1 rounded transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedCollections.has(collection.id)}
                  onChange={() => onCollectionToggle(collection.id)}
                  className="w-4 h-4"
                />
                <span className="text-sm flex-1">{collection.name}</span>
                <span className="text-xs opacity-60">{variableCount}</span>
              </label>
            );
          })}
        </div>

        {/* Add Collection Button */}
        <div className="pt-3 mt-3 border-t border-border">
          <IconTextButton
            icon={<PlusIcon />}
            onClick={handleAddCollection}
            className="w-full justify-center"
            size="sm"
          >
            Add Collection
          </IconTextButton>
        </div>
      </div>
    </div>
  );
}
