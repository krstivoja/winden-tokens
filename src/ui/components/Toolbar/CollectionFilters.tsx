// Collection filters component

import { useAppContext } from '../../context/AppContext';
import { Button } from '../common/Button/Button';
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
        <Button size="sm" onClick={toggleAllCollections}>
          {selectedCount === totalCount ? 'None' : 'All'}
        </Button>
      </div>

      <div className="collection-filters-list">
        {collections.map(collection => (
          <label key={collection.id} className="collection-filter-item">
            <input
              type="checkbox"
              checked={selectedCollectionIds.has(collection.id)}
              onChange={() => toggleCollection(collection.id)}
            />
            <span>{collection.name}</span>
          </label>
        ))}
      </div>
    </OptionsDropdown>
  );
}
