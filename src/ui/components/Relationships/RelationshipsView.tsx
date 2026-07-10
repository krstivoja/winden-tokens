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

      {/* Instructions */}
      <div className="absolute bottom-3 right-3 z-[5] px-3 py-2 bg-base border border-border rounded text-[11px] opacity-70">
        Drag from point to connect · Click connection to remove
      </div>

      {/* Empty state */}
      {filteredVars.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-[1]">
          <p className="text-sm text-text opacity-50">No variables in selected collections</p>
        </div>
      )}
    </div>
  );
}
