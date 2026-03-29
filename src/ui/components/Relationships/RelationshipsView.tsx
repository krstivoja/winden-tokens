// Relationships view using grouped graph

import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { GroupedGraph } from './GroupedGraph';

interface RelationshipsViewProps {
  variableType: 'COLOR' | 'FLOAT';
}

export function RelationshipsView({ variableType }: RelationshipsViewProps) {
  const { collections, variables, selectedCollectionIds, shadeGroups, selectedModeId } = useAppContext();

  // Count stats - filter by selected collections
  const filteredVars = variables.filter(
    v => selectedCollectionIds.has(v.collectionId) && v.resolvedType === variableType
  );

  const refPattern = /^\{(.+)\}$/;
  const refCount = filteredVars.filter(v => refPattern.test(v.value)).length;

  const typeLabel = variableType === 'COLOR' ? 'colors' : 'numbers';
  const emptyLabel = variableType === 'COLOR' ? 'color' : 'number';

  return (
    <div className="relative w-full h-full">
      <GroupedGraph
        collections={collections}
        variables={variables}
        selectedCollectionIds={selectedCollectionIds}
        variableType={variableType}
        shadeGroups={shadeGroups}
        selectedModeId={selectedModeId}
      />

      {/* Stats overlay */}
      <div className="absolute bottom-3 left-3 z-[5] flex gap-3 px-3 py-2 bg-base border border-border rounded text-[11px] opacity-80">
        <span>{filteredVars.length} {typeLabel}</span>
        <span>{refCount} references</span>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-3 right-3 z-[5] px-3 py-2 bg-base border border-border rounded text-[11px] opacity-70">
        Drag from point to connect · Click connection to remove
      </div>

      {/* Empty state */}
      {filteredVars.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-[1]">
          <p className="text-sm opacity-50">No {emptyLabel} variables in this collection</p>
        </div>
      )}
    </div>
  );
}
