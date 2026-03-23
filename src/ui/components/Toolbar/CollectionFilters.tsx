// Collection filters component

import { useAppContext } from '../../context/AppContext';
import { TextButton } from '../common/Button/Button';
import { Checkbox } from '../common/Checkbox';
import { OptionsDropdown } from '../common/OptionsDropdown/OptionsDropdown';

export function CollectionFilters() {
  const { collections, selectedCollectionIds, toggleCollection, toggleAllCollections } = useAppContext();

  const selectedCount = selectedCollectionIds.size;
  const totalCount = collections.length;

  if (collections.length === 0) {
    return null;
  }

  return (
    <OptionsDropdown label={`Collections (${selectedCount}/${totalCount})`}>
      <div className="collection-filters-header">
        <span>Select Collections</span>
        <TextButton size="sm" onClick={toggleAllCollections}>
          {selectedCount === totalCount ? 'None' : 'All'}
        </TextButton>
      </div>

      <div className="collection-filters-list">
        {collections.map(collection => (
          <Checkbox
            key={collection.id}
            className="collection-filter-item"
            label={collection.name}
            checked={selectedCollectionIds.has(collection.id)}
            onChange={() => toggleCollection(collection.id)}
          />
        ))}
      </div>
    </OptionsDropdown>
  );
}
