// Collection cell component - displays collection selector and allows moving variables between collections

import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { VariableData } from '../../types';
import { Radio } from '../common/Radio';
import { OptionsDropdown } from '../common/OptionsDropdown/OptionsDropdown';

interface CollectionCellProps {
  variable: VariableData;
}

export function CollectionCell({ variable }: CollectionCellProps) {
  const { collections } = useAppContext();

  const currentCollection = collections.find(c => c.id === variable.collectionId);
  const buttonLabel = currentCollection ? currentCollection.name : 'Unknown';

  const handleMoveToCollection = (targetCollectionId: string) => {
    if (targetCollectionId === variable.collectionId) {
      return;
    }

    post({
      type: 'move-variable-to-collection',
      variableId: variable.id,
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
            name="collection-cell"
            label={collection.name}
            checked={variable.collectionId === collection.id}
            onChange={() => handleMoveToCollection(collection.id)}
          />
        ))}
      </OptionsDropdown>
    </div>
  );
}
