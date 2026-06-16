// Data context for core data (collections, variables, shade groups)

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { CollectionData, ShadeGroupData, VariableData } from '../types';

interface DataContextValue {
  collections: CollectionData[];
  variables: VariableData[];
  shadeGroups: ShadeGroupData[];
  setData: (collections: CollectionData[], variables: VariableData[], shadeGroups: ShadeGroupData[]) => void;
  selectedCollectionId: string | null;
  setSelectedCollectionId: (id: string | null) => void;
  colorVariables: VariableData[];
  getShadeGroupBySourceId: (variableId: string) => ShadeGroupData | null;
  getShadeGroupByGroupName: (groupName: string) => ShadeGroupData | null;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [collections, setCollections] = useState<CollectionData[]>([]);
  const [variables, setVariables] = useState<VariableData[]>([]);
  const [shadeGroups, setShadeGroups] = useState<ShadeGroupData[]>([]);
  const [selectedCollectionId, setSelectedCollectionIdState] = useState<string | null>(null);

  const setData = useCallback((newCollections: CollectionData[], newVariables: VariableData[], newShadeGroups: ShadeGroupData[]) => {
    setCollections(newCollections);
    setVariables(newVariables);
    setShadeGroups(newShadeGroups);
    setSelectedCollectionIdState(prev => {
      if (newCollections.length === 0) {
        return null;
      }
      if (!prev || !newCollections.some(collection => collection.id === prev)) {
        return newCollections[0].id;
      }
      return prev;
    });
  }, []);

  const setSelectedCollectionId = useCallback((id: string | null) => {
    setSelectedCollectionIdState(id);
  }, []);

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

  const value: DataContextValue = {
    collections,
    variables,
    shadeGroups,
    setData,
    selectedCollectionId,
    setSelectedCollectionId,
    colorVariables,
    getShadeGroupBySourceId,
    getShadeGroupByGroupName,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useDataContext() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useDataContext must be used within DataProvider');
  }
  return context;
}
