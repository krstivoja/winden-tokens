// Filter context for filtering state (mode, types, collections, groups, search)

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import { CollectionData, VariableData } from '../types';
import { useToggleSet } from '../hooks/useToggleSet';
import { useDataContext } from './DataContext';
import { getCollectionGroupKey, getVariableGroupName } from '../utils/groupFilters';

interface FilterContextValue {
  selectedModeId: string | null;
  setSelectedModeId: (modeId: string) => void;
  selectedVariableTypes: Set<string>;
  toggleVariableType: (type: string) => void;
  toggleAllVariableTypes: () => void;
  selectedCollectionIds: Set<string>;
  toggleCollection: (id: string) => void;
  toggleAllCollections: () => void;
  selectedGroups: Set<string>;
  toggleSelectedGroup: (groupName: string) => void;
  toggleAllGroups: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredVariables: VariableData[];
  getFilteredCount: () => { shown: number; total: number };
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const { collections, variables, selectedCollectionId } = useDataContext();
  const [searchQuery, setSearchQueryState] = useState('');
  const [selectedModeId, setSelectedModeIdState] = useState<string | null>(null);

  // Use custom hook for Set-based toggle states
  const collectionFilter = useToggleSet<string>(new Set());
  const typeFilter = useToggleSet<string>(new Set(['COLOR', 'FLOAT', 'STRING', 'BOOLEAN']));
  const groupFilter = useToggleSet<string>(new Set());

  // Track if filters have been initialized
  const hasInitialized = React.useRef(false);

  // Initialize filters when data is first loaded
  useEffect(() => {
    // Only initialize once when we first receive data
    if (hasInitialized.current || collections.length === 0) {
      return;
    }

    hasInitialized.current = true;

    // Initialize selectedCollectionIds with all collections
    collectionFilter.setItems(new Set(collections.map(c => c.id)));

    // Initialize selectedGroups with all groups from variables
    const groups = new Set<string>();
    variables.forEach(v => {
      const groupName = getVariableGroupName(v.name);
      if (groupName) {
        groups.add(getCollectionGroupKey(v.collectionId, groupName));
      }
    });
    groupFilter.setItems(groups);

    // Initialize selectedModeId with first mode of first collection
    const availableModes = collections.flatMap(collection => collection.modes);
    if (availableModes.length > 0) {
      if (!selectedModeId || !availableModes.some(mode => mode.modeId === selectedModeId)) {
        setSelectedModeIdState(collections[0]?.modes[0]?.modeId || null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collections, variables]);

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query.toLowerCase().trim());
  }, []);

  const toggleCollection = collectionFilter.toggle;

  const toggleAllCollections = useCallback(() => {
    collectionFilter.toggleAll(collections.map(c => c.id));
  }, [collections, collectionFilter.toggleAll]);

  const toggleVariableType = typeFilter.toggle;

  const toggleAllVariableTypes = useCallback(() => {
    typeFilter.toggleAll(['COLOR', 'FLOAT', 'STRING', 'BOOLEAN']);
  }, [typeFilter.toggleAll]);

  const toggleSelectedGroup = useCallback((groupName: string) => {
    groupFilter.toggle(groupName);
  }, [groupFilter.toggle]);

  const toggleAllGroups = useCallback(() => {
    const allGroups: string[] = [];
    variables.forEach(v => {
      const groupName = getVariableGroupName(v.name);
      if (!groupName) {
        return;
      }

      const groupKey = getCollectionGroupKey(v.collectionId, groupName);
      if (!allGroups.includes(groupKey)) {
        allGroups.push(groupKey);
      }
    });
    groupFilter.toggleAll(allGroups);
  }, [variables, groupFilter.toggleAll]);

  const setSelectedModeId = useCallback((modeId: string) => {
    setSelectedModeIdState(modeId);
  }, []);

  const filteredVariables = useMemo(() => {
    // Filter by selected collections (multiple)
    let filtered = variables.filter(v => collectionFilter.items.has(v.collectionId));
    // Filter by selected variable types
    filtered = filtered.filter(v => typeFilter.items.has(v.resolvedType));
    if (searchQuery) {
      filtered = filtered.filter(v => v.name.toLowerCase().includes(searchQuery));
    }
    return filtered;
  }, [variables, collectionFilter.items, typeFilter.items, searchQuery]);

  const getFilteredCount = useCallback(() => {
    const total = variables.filter(v => v.collectionId === selectedCollectionId).length;
    return { shown: filteredVariables.length, total };
  }, [variables, selectedCollectionId, filteredVariables.length]);

  const value: FilterContextValue = {
    selectedModeId,
    setSelectedModeId,
    selectedVariableTypes: typeFilter.items,
    toggleVariableType,
    toggleAllVariableTypes,
    selectedCollectionIds: collectionFilter.items,
    toggleCollection,
    toggleAllCollections,
    selectedGroups: groupFilter.items,
    toggleSelectedGroup,
    toggleAllGroups,
    searchQuery,
    setSearchQuery,
    filteredVariables,
    getFilteredCount,
  };

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilterContext() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilterContext must be used within FilterProvider');
  }
  return context;
}
