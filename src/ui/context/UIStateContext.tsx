// UI state context for UI-specific state (collapsed groups, contrast colors)

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface UIStateContextValue {
  collapsedGroups: Set<string>;
  toggleGroup: (groupName: string) => void;
  collapseGroups: (groupNames: string[]) => void;
  expandGroups: (groupNames: string[]) => void;
  isGroupCollapsed: (groupName: string) => boolean;
  groupContrastColors: Record<string, string>;
  setGroupContrastColor: (groupName: string, color: string | null) => void;
  getGroupContrastColor: (groupName: string) => string | null;
  singleContrastColors: Record<string, string>;
  setSingleContrastColor: (variableId: string, color: string | null) => void;
  getSingleContrastColor: (variableId: string) => string | null;
}

const UIStateContext = createContext<UIStateContextValue | null>(null);

export function UIStateProvider({ children }: { children: ReactNode }) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [groupContrastColors, setGroupContrastColors] = useState<Record<string, string>>({});
  const [singleContrastColors, setSingleContrastColors] = useState<Record<string, string>>({});

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

  const collapseGroups = useCallback((groupNames: string[]) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      groupNames.forEach(groupName => next.add(groupName));
      return next;
    });
  }, []);

  const expandGroups = useCallback((groupNames: string[]) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      groupNames.forEach(groupName => next.delete(groupName));
      return next;
    });
  }, []);

  const isGroupCollapsed = useCallback((groupName: string) => {
    return collapsedGroups.has(groupName);
  }, [collapsedGroups]);

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

  const value: UIStateContextValue = {
    collapsedGroups,
    toggleGroup,
    collapseGroups,
    expandGroups,
    isGroupCollapsed,
    groupContrastColors,
    setGroupContrastColor,
    getGroupContrastColor,
    singleContrastColors,
    setSingleContrastColor,
    getSingleContrastColor,
  };

  return <UIStateContext.Provider value={value}>{children}</UIStateContext.Provider>;
}

export function useUIStateContext() {
  const context = useContext(UIStateContext);
  if (!context) {
    throw new Error('useUIStateContext must be used within UIStateProvider');
  }
  return context;
}
