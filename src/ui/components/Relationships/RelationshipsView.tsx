// Relationships view using grouped graph

import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { GroupedGraph } from './GroupedGraph';
import { CollectionFilters } from '../Toolbar/CollectionFilters';
import { ModeSelector } from '../Toolbar/ModeSelector';

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
    <div className="relationships-view">
      {/* Collection filter toolbar */}
      <div className="relationships-toolbar">
        <CollectionFilters />
        <ModeSelector />
      </div>

      <GroupedGraph
        collections={collections}
        variables={variables}
        selectedCollectionIds={selectedCollectionIds}
        variableType={variableType}
        shadeGroups={shadeGroups}
        selectedModeId={selectedModeId}
      />

      {/* Stats overlay */}
      <div className="graph-stats">
        <span>{filteredVars.length} {typeLabel}</span>
        <span>{refCount} references</span>
      </div>

      {/* Instructions */}
      <div className="graph-instructions">
        Drag from point to connect · Click connection to remove
      </div>

      {/* Empty state */}
      {filteredVars.length === 0 && (
        <div className="graph-empty">
          <p>No {emptyLabel} variables in this collection</p>
        </div>
      )}
    </div>
  );
}
