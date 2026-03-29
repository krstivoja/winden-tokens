// Relationships view using grouped graph

import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { GroupedGraph } from './GroupedGraph';

export function RelationshipsView() {
  const { collections, variables, selectedCollectionIds, shadeGroups, selectedModeId } = useAppContext();

  // Count stats - filter by selected collections (all types)
  const filteredVars = variables.filter(v => selectedCollectionIds.has(v.collectionId));

  const refPattern = /^\{(.+)\}$/;
  const refCount = filteredVars.filter(v => refPattern.test(v.value)).length;

  // Count by type
  const colorCount = filteredVars.filter(v => v.resolvedType === 'COLOR').length;
  const numberCount = filteredVars.filter(v => v.resolvedType === 'FLOAT').length;

  return (
    <div className="relative w-full h-full">
      <GroupedGraph
        collections={collections}
        variables={variables}
        selectedCollectionIds={selectedCollectionIds}
        shadeGroups={shadeGroups}
        selectedModeId={selectedModeId}
      />

      {/* Stats overlay */}
      <div className="absolute bottom-3 left-3 z-[5] flex gap-3 px-3 py-2 bg-base border border-border rounded text-[11px] opacity-80">
        <span>{filteredVars.length} variables</span>
        <span>{colorCount} colors</span>
        <span>{numberCount} numbers</span>
        <span>{refCount} references</span>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-3 right-3 z-[5] px-3 py-2 bg-base border border-border rounded text-[11px] opacity-70">
        Drag from point to connect · Click connection to remove
      </div>

      {/* Empty state */}
      {filteredVars.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-[1]">
          <p className="text-sm opacity-50">No variables in selected collections</p>
        </div>
      )}
    </div>
  );
}
