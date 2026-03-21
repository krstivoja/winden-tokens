// Global application context

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { CollectionData, ShadeGroupData, VariableData } from '../types';

interface AppState {
  collections: CollectionData[];
  variables: VariableData[];
  shadeGroups: ShadeGroupData[];
  selectedCollectionId: string | null;
  selectedCollectionIds: Set<string>;
  collapsedGroups: Set<string>;
  searchQuery: string;
  groupContrastColors: Record<string, string>;
  singleContrastColors: Record<string, string>;
  selectedVariableTypes: Set<string>;
  selectedModeId: string | null;
}

interface AppContextValue extends AppState {
  setData: (collections: CollectionData[], variables: VariableData[], shadeGroups: ShadeGroupData[]) => void;
  setSelectedCollectionId: (id: string | null) => void;
  toggleCollection: (id: string) => void;
  toggleAllCollections: () => void;
  setSearchQuery: (query: string) => void;
  toggleGroup: (groupName: string) => void;
  isGroupCollapsed: (groupName: string) => boolean;
  filteredVariables: VariableData[];
  colorVariables: VariableData[];
  getShadeGroupBySourceId: (variableId: string) => ShadeGroupData | null;
  getShadeGroupByGroupName: (groupName: string) => ShadeGroupData | null;
  getFilteredCount: () => { shown: number; total: number };
  setGroupContrastColor: (groupName: string, color: string | null) => void;
  getGroupContrastColor: (groupName: string) => string | null;
  setSingleContrastColor: (variableId: string, color: string | null) => void;
  getSingleContrastColor: (variableId: string) => string | null;
  toggleVariableType: (type: string) => void;
  toggleAllVariableTypes: () => void;
  setSelectedModeId: (modeId: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [collections, setCollections] = useState<CollectionData[]>([]);
  const [variables, setVariables] = useState<VariableData[]>([]);
  const [shadeGroups, setShadeGroups] = useState<ShadeGroupData[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQueryState] = useState('');
  const [groupContrastColors, setGroupContrastColors] = useState<Record<string, string>>({});
  const [singleContrastColors, setSingleContrastColors] = useState<Record<string, string>>({});
  const [selectedVariableTypes, setSelectedVariableTypes] = useState<Set<string>>(
    new Set(['COLOR', 'FLOAT', 'STRING', 'BOOLEAN'])
  );
  const [selectedModeId, setSelectedModeIdState] = useState<string | null>(null);

  const setData = useCallback((newCollections: CollectionData[], newVariables: VariableData[], newShadeGroups: ShadeGroupData[]) => {
    setCollections(newCollections);
    setVariables(newVariables);
    setShadeGroups(newShadeGroups);
    setSelectedCollectionId(prev => {
      if (newCollections.length === 0) {
        return null;
      }
      if (!prev || !newCollections.some(collection => collection.id === prev)) {
        return newCollections[0].id;
      }
      return prev;
    });
    // Initialize selectedCollectionIds with all collections
    setSelectedCollectionIds(new Set(newCollections.map(c => c.id)));
    // Initialize selectedModeId with first mode of first collection
    setSelectedModeIdState(prev => {
      const availableModes = newCollections.flatMap(collection => collection.modes);
      if (availableModes.length === 0) {
        return null;
      }
      if (!prev || !availableModes.some(mode => mode.modeId === prev)) {
        return newCollections[0].modes[0].modeId;
      }
      return prev;
    });
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query.toLowerCase().trim());
  }, []);

  const toggleCollection = useCallback((id: string) => {
    setSelectedCollectionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAllCollections = useCallback(() => {
    setSelectedCollectionIds(prev => {
      if (prev.size === collections.length) {
        return new Set();
      } else {
        return new Set(collections.map(c => c.id));
      }
    });
  }, [collections]);

  const toggleVariableType = useCallback((type: string) => {
    setSelectedVariableTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const toggleAllVariableTypes = useCallback(() => {
    const allTypes = ['COLOR', 'FLOAT', 'STRING', 'BOOLEAN'];
    setSelectedVariableTypes(prev => {
      if (prev.size === allTypes.length) {
        return new Set();
      } else {
        return new Set(allTypes);
      }
    });
  }, []);

  const toggleGroup = useCallback((groupName: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  }, []);

  const isGroupCollapsed = useCallback((groupName: string) => {
    return collapsedGroups.has(groupName);
  }, [collapsedGroups]);

  const filteredVariables = useMemo(() => {
    // Filter by selected collections (multiple)
    let filtered = variables.filter(v => selectedCollectionIds.has(v.collectionId));
    // Filter by selected variable types
    filtered = filtered.filter(v => selectedVariableTypes.has(v.resolvedType));
    if (searchQuery) {
      filtered = filtered.filter(v => v.name.toLowerCase().includes(searchQuery));
    }
    return filtered;
  }, [variables, selectedCollectionIds, selectedVariableTypes, searchQuery]);

  const colorVariables = useMemo(() => {
    return variables.filter(v => v.collectionId === selectedCollectionId && v.resolvedType === 'COLOR');
  }, [variables, selectedCollectionId]);

  const shadeGroupsBySourceId = useMemo(() => {
    const map = new Map<string, ShadeGroupData>();
    for (const group of shadeGroups) {
      map.set(group.sourceVariableId, group);
    }
    return map;
  }, [shadeGroups]);

  const shadeGroupsByGroupName = useMemo(() => {
    const map = new Map<string, ShadeGroupData>();
    for (const group of shadeGroups) {
      map.set(`${group.collectionId}:${group.sourceVariableName}`, group);
    }
    return map;
  }, [shadeGroups]);

  const getShadeGroupBySourceId = useCallback((variableId: string): ShadeGroupData | null => {
    return shadeGroupsBySourceId.get(variableId) || null;
  }, [shadeGroupsBySourceId]);

  const getShadeGroupByGroupName = useCallback((groupName: string): ShadeGroupData | null => {
    if (!selectedCollectionId) return null;
    return shadeGroupsByGroupName.get(`${selectedCollectionId}:${groupName}`) || null;
  }, [shadeGroupsByGroupName, selectedCollectionId]);

  const getFilteredCount = useCallback(() => {
    const total = variables.filter(v => v.collectionId === selectedCollectionId).length;
    return { shown: filteredVariables.length, total };
  }, [variables, selectedCollectionId, filteredVariables.length]);

  const setGroupContrastColor = useCallback((groupName: string, color: string | null) => {
    setGroupContrastColors(prev => {
      if (color === null) {
        const { [groupName]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [groupName]: color };
    });
  }, []);

  const getGroupContrastColor = useCallback((groupName: string): string | null => {
    return groupContrastColors[groupName] || null;
  }, [groupContrastColors]);

  const setSingleContrastColor = useCallback((variableId: string, color: string | null) => {
    setSingleContrastColors(prev => {
      if (color === null) {
        const { [variableId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [variableId]: color };
    });
  }, []);

  const getSingleContrastColor = useCallback((variableId: string): string | null => {
    return singleContrastColors[variableId] || null;
  }, [singleContrastColors]);

  const setSelectedModeId = useCallback((modeId: string) => {
    setSelectedModeIdState(modeId);
  }, []);

  const value: AppContextValue = {
    collections,
    variables,
    shadeGroups,
    selectedCollectionId,
    selectedCollectionIds,
    collapsedGroups,
    searchQuery,
    groupContrastColors,
    singleContrastColors,
    selectedVariableTypes,
    selectedModeId,
    setData,
    setSelectedCollectionId,
    toggleCollection,
    toggleAllCollections,
    setSearchQuery,
    toggleGroup,
    isGroupCollapsed,
    filteredVariables,
    colorVariables,
    getShadeGroupBySourceId,
    getShadeGroupByGroupName,
    getFilteredCount,
    setGroupContrastColor,
    getGroupContrastColor,
    setSingleContrastColor,
    getSingleContrastColor,
    toggleVariableType,
    toggleAllVariableTypes,
    setSelectedModeId,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}
