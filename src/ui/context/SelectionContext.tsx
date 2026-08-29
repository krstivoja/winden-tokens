// Selection context - tracks the currently selected Figma node for the Inspector tab

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { InspectorNodeData } from '../types';

interface SelectionContextValue {
  selectedNode: InspectorNodeData | null;
  hasMultipleSelection: boolean;
  setSelection: (node: InspectorNodeData | null, multiple: boolean) => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedNode, setSelectedNode] = useState<InspectorNodeData | null>(null);
  const [hasMultipleSelection, setHasMultipleSelection] = useState(false);

  const setSelection = useCallback((node: InspectorNodeData | null, multiple: boolean) => {
    setSelectedNode(node);
    setHasMultipleSelection(multiple);
  }, []);

  const value: SelectionContextValue = {
    selectedNode,
    hasMultipleSelection,
    setSelection,
  };

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelectionContext() {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error('useSelectionContext must be used within SelectionProvider');
  }
  return context;
}
