// Global application context

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { CollectionData, ShadeGroupData, VariableData } from '../types';

interface AppState {
  collections: CollectionData[];
  variables: VariableData[];
  shadeGroups: ShadeGroupData[];
  selectedCollectionId: string | null;
  collapsedGroups: Set<string>;
  searchQuery: string;
  groupContrastColors: Record<string, string>;
  singleContrastColors: Record<string, string>;
}

interface AppContextValue extends AppState {
  setData: (collections: CollectionData[], variables: VariableData[], shadeGroups: ShadeGroupData[]) => void;
  setSelectedCollectionId: (id: string | null) => void;
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
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [collections, setCollections] = useState<CollectionData[]>([]);
  const [variables, setVariables] = useState<VariableData[]>([]);
  const [shadeGroups, setShadeGroups] = useState<ShadeGroupData[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQueryState] = useState('');
  const [groupContrastColors, setGroupContrastColors] = useState<Record<string, string>>({});
  const [singleContrastColors, setSingleContrastColors] = useState<Record<string, string>>({});

  const setData = useCallback((newCollections: CollectionData[], newVariables: VariableData[], newShadeGroups: ShadeGroupData[]) => {
    setCollections(newCollections);
    setVariables(newVariables);
    setShadeGroups(newShadeGroups);
    setSelectedCollectionId(prev => {
      if (!prev && newCollections.length) {
        return newCollections[0].id;
      }
      return prev;
    });
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query.toLowerCase().trim());
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
    let filtered = variables.filter(v => v.collectionId === selectedCollectionId);
    if (searchQuery) {
      filtered = filtered.filter(v => v.name.toLowerCase().includes(searchQuery));
    }
    return filtered;
  }, [variables, selectedCollectionId, searchQuery]);

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

  const value: AppContextValue = {
    collections,
    variables,
    shadeGroups,
    selectedCollectionId,
    collapsedGroups,
    searchQuery,
    groupContrastColors,
    singleContrastColors,
    setData,
    setSelectedCollectionId,
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
