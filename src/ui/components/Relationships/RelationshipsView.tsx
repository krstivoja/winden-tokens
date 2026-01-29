// Relationships view using grouped graph

import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { GroupedGraph } from './GroupedGraph';

export function RelationshipsView() {
  const { variables, selectedCollectionId } = useAppContext();

  // Count stats
  const colorVars = variables.filter(
    v => v.collectionId === selectedCollectionId && v.resolvedType === 'COLOR'
  );

  const refPattern = /^\{(.+)\}$/;
  const refCount = colorVars.filter(v => refPattern.test(v.value)).length;

  return (
    <div className="relationships-view">
      <GroupedGraph
        variables={variables}
        selectedCollectionId={selectedCollectionId}
      />

      {/* Stats overlay */}
      <div className="graph-stats">
        <span>{colorVars.length} colors</span>
        <span>{refCount} references</span>
      </div>

      {/* Instructions */}
      <div className="graph-instructions">
        Drag from point to connect · Click connection to remove
      </div>

      {/* Empty state */}
      {colorVars.length === 0 && (
        <div className="graph-empty">
          <p>No color variables in this collection</p>
        </div>
      )}
    </div>
  );
}
