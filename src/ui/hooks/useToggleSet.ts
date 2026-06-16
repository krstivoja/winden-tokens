// Custom hook for managing Set-based toggle state
// Provides reusable toggle logic to eliminate duplicate code

import { useState, useCallback } from 'react';

export interface UseToggleSetReturn<T> {
  items: Set<T>;
  toggle: (item: T) => void;
  toggleAll: (allItems: T[]) => void;
  clear: () => void;
  setItems: React.Dispatch<React.SetStateAction<Set<T>>>;
}

/**
 * Custom hook for managing a Set with toggle functionality
 *
 * @param initialSet - Initial set of items (default: empty Set)
 * @returns Object with items Set and toggle methods
 *
 * @example
 * ```typescript
 * const { items, toggle, toggleAll } = useToggleSet(new Set(['COLOR', 'FLOAT']));
 *
 * // Toggle individual item
 * toggle('STRING'); // adds STRING
 * toggle('COLOR');  // removes COLOR
 *
 * // Toggle all items (select all / deselect all)
 * toggleAll(['COLOR', 'FLOAT', 'STRING', 'BOOLEAN']);
 * ```
 */
export function useToggleSet<T>(initialSet: Set<T> = new Set()): UseToggleSetReturn<T> {
  const [items, setItems] = useState<Set<T>>(initialSet);

  const toggle = useCallback((item: T) => {
    setItems(prev => {
      const next = new Set(prev);
      if (next.has(item)) {
        next.delete(item);
      } else {
        next.add(item);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback((allItems: T[]) => {
    setItems(prev => {
      // If all items are selected, deselect all
      // Otherwise, select all
      if (prev.size === allItems.length && allItems.every(item => prev.has(item))) {
        return new Set();
      }
      return new Set(allItems);
    });
  }, []);

  const clear = useCallback(() => {
    setItems(new Set());
  }, []);

  return {
    items,
    toggle,
    toggleAll,
    clear,
    setItems,
  };
}
