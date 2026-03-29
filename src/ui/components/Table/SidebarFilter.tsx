// Sidebar filter with mode selector, type filters, and collection tree

import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { TypeIcon, PlusIcon } from '../Icons';
import { TextButton, IconTextButton } from '../common/Button';
import { useModalContext } from '../Modals/ModalContext';

interface SidebarFilterProps {
  selectedModeId: string | null;
  onModeChange: (modeId: string) => void;
  selectedTypes?: Set<string>;
  onTypeToggle?: (type: string) => void;
  selectedCollections: Set<string>;
  onCollectionToggle: (collectionId: string) => void;
  selectedGroups?: Set<string>;
  onGroupToggle?: (groupName: string) => void;
  showTypeFilters?: boolean;
}

export function SidebarFilter({
  selectedModeId,
  onModeChange,
  selectedTypes,
  onTypeToggle,
  selectedCollections,
  onCollectionToggle,
  selectedGroups,
  onGroupToggle,
  showTypeFilters = true,
}: SidebarFilterProps) {
  const { collections, variables } = useAppContext();
  const { openInputModal } = useModalContext();
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const hasInitializedExpanded = React.useRef(false);

  // Auto-expand collections with groups when group filtering is enabled (only on first render)
  React.useEffect(() => {
    if (selectedGroups && onGroupToggle && !hasInitializedExpanded.current) {
      const collectionsWithGroups = new Set<string>();
      collections.forEach(collection => {
        const hasGroups = variables.some(v => {
          if (v.collectionId !== collection.id) return false;
          const parts = v.name.split('/');
          return parts.length > 1;
        });
        if (hasGroups) {
          collectionsWithGroups.add(collection.id);
        }
      });
      setExpandedCollections(collectionsWithGroups);
      hasInitializedExpanded.current = true;
    }
  }, [collections, variables, selectedGroups, onGroupToggle]);

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

  // Extract groups from variables (grouped by collection)
  const groupsByCollection = React.useMemo(() => {
    const map = new Map<string, Set<string>>();
    variables.forEach(v => {
      const parts = v.name.split('/');
      if (parts.length > 1) {
        const groupName = parts[0];
        if (!map.has(v.collectionId)) {
          map.set(v.collectionId, new Set());
        }
        map.get(v.collectionId)!.add(groupName);
      }
    });
    return map;
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
  const allTypesSelected = selectedTypes ? availableTypes.every(type => selectedTypes.has(type)) : false;
  const handleToggleAllTypes = () => {
    if (!selectedTypes || !onTypeToggle) return;
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
      {showTypeFilters && selectedTypes && onTypeToggle && (
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
                <span className="text-sm flex-1">{type}</span>
                <TypeIcon type={type} />
              </label>
            ))}
          </div>
        </div>
      )}

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
            const groups = groupsByCollection.get(collection.id);
            const hasGroups = groups && groups.size > 0;
            const isExpanded = expandedCollections.has(collection.id);

            return (
              <div key={collection.id} className="space-y-0.5">
                {/* Collection checkbox */}
                <div className="flex items-center gap-2 hover:bg-base-2 px-2 py-1 rounded transition-colors">
                  {hasGroups && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedCollections(prev => {
                          const next = new Set(prev);
                          if (next.has(collection.id)) {
                            next.delete(collection.id);
                          } else {
                            next.add(collection.id);
                          }
                          return next;
                        });
                      }}
                      className="w-4 h-4 flex items-center justify-center text-text-muted hover:text-text transition-colors"
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                  )}
                  {!hasGroups && <div className="w-4" />}
                  <label className="flex items-center gap-2 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={selectedCollections.has(collection.id)}
                      onChange={() => onCollectionToggle(collection.id)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm flex-1">{collection.name}</span>
                    <span className="text-xs opacity-60">{variableCount}</span>
                  </label>
                </div>

                {/* Groups (nested) */}
                {hasGroups && isExpanded && selectedGroups && onGroupToggle && (
                  <div className="ml-8 space-y-0.5">
                    {Array.from(groups).sort().map(groupName => {
                      const groupVariableCount = variables.filter(
                        v => v.collectionId === collection.id && v.name.startsWith(`${groupName}/`)
                      ).length;
                      return (
                        <label
                          key={groupName}
                          className="flex items-center gap-2 cursor-pointer hover:bg-base-2 px-2 py-1 rounded transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedGroups.has(groupName)}
                            onChange={() => onGroupToggle(groupName)}
                            className="w-3.5 h-3.5"
                          />
                          <span className="text-xs flex-1">{groupName}</span>
                          <span className="text-xs opacity-60">{groupVariableCount}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
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
