// Group collection cell - allows moving entire groups between collections

import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { VariableData } from '../../types';
import { Radio } from '../common/Radio';
import { OptionsDropdown } from '../common/OptionsDropdown/OptionsDropdown';

interface GroupCollectionCellProps {
  variables: VariableData[];
}

export function GroupCollectionCell({ variables }: GroupCollectionCellProps) {
  const { collections } = useAppContext();

  // All variables in a group should be in the same collection
  const currentCollectionId = variables[0]?.collectionId;
  const currentCollection = collections.find(c => c.id === currentCollectionId);
  const buttonLabel = currentCollection ? currentCollection.name : 'Unknown';

  const handleMoveGroupToCollection = (targetCollectionId: string) => {
    if (targetCollectionId === currentCollectionId) {
      return;
    }

    // Move all variables in the group
    const variableIds = variables.map(v => v.id);

    post({
      type: 'move-group-to-collection',
      variableIds,
      targetCollectionId,
    });
  };

  // Don't render if no collections available
  if (collections.length === 0) {
    return <div className="collection-cell-empty">—</div>;
  }

  return (
    <div className="collection-cell">
      <OptionsDropdown label={buttonLabel}>
        {collections.map(collection => (
          <Radio
            key={collection.id}
            className="dropdown-item"
            name="group-collection-cell"
            label={collection.name}
            checked={currentCollectionId === collection.id}
            onChange={() => handleMoveGroupToCollection(collection.id)}
          />
        ))}
      </OptionsDropdown>
    </div>
  );
}
