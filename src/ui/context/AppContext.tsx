// Composite application context that combines all focused contexts
// This provides backward compatibility while we migrate components to use focused contexts

import React, { ReactNode } from 'react';
import { DataProvider, useDataContext } from './DataContext';
import { FilterProvider, useFilterContext } from './FilterContext';
import { UIStateProvider, useUIStateContext } from './UIStateContext';
import { SelectionProvider, useSelectionContext } from './SelectionContext';

// Composite AppProvider that composes all contexts
export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <DataProvider>
      <FilterProvider>
        <UIStateProvider>
          <SelectionProvider>
            {children}
          </SelectionProvider>
        </UIStateProvider>
      </FilterProvider>
    </DataProvider>
  );
}

// Composite hook that combines all context values
// Provides backward compatibility for components still using useAppContext
export function useAppContext() {
  const dataContext = useDataContext();
  const filterContext = useFilterContext();
  const uiStateContext = useUIStateContext();
  const selectionContext = useSelectionContext();

  return {
    ...dataContext,
    ...filterContext,
    ...uiStateContext,
    ...selectionContext,
  };
}

// Export individual context hooks for components that want to use focused contexts
export { useDataContext } from './DataContext';
export { useFilterContext } from './FilterContext';
export { useUIStateContext } from './UIStateContext';
export { useSelectionContext } from './SelectionContext';
