// Relationships view using grouped graph

import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { GroupedGraph } from './GroupedGraph';

interface RelationshipsViewProps {
  variableType: 'COLOR' | 'FLOAT';
}

export function RelationshipsView({ variableType }: RelationshipsViewProps) {
  const { variables, selectedCollectionId } = useAppContext();

  // Count stats
  const filteredVars = variables.filter(
    v => v.collectionId === selectedCollectionId && v.resolvedType === variableType
  );

  const refPattern = /^\{(.+)\}$/;
  const refCount = filteredVars.filter(v => refPattern.test(v.value)).length;

  const typeLabel = variableType === 'COLOR' ? 'colors' : 'numbers';
  const emptyLabel = variableType === 'COLOR' ? 'color' : 'number';

  return (
    <div className="relationships-view">
      <GroupedGraph
        variables={variables}
        selectedCollectionId={selectedCollectionId}
        variableType={variableType}
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
