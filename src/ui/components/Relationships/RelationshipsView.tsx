// Relationships view using grouped graph

import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { GroupedGraph } from './GroupedGraph';

export function RelationshipsView() {
  const { variables, selectedCollectionIds } = useAppContext();

  // Filter by selected collections (used for empty state)
  const filteredVars = variables.filter(v => selectedCollectionIds.has(v.collectionId));

  return (
    <div className="relative w-full h-full">
      <GroupedGraph />

      {/* Empty state */}
      {filteredVars.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-[1]">
          <p className="text-sm text-text opacity-50">No variables in selected collections</p>
        </div>
      )}
    </div>
  );
}
