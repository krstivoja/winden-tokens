// Variable type filters component

import { useAppContext } from '../../context/AppContext';
import { TypeIcon } from '../Icons';
import { TextButton } from '../common/Button/Button';
import { Checkbox } from '../common/Checkbox';
import { OptionsDropdown } from '../common/OptionsDropdown/OptionsDropdown';

const VARIABLE_TYPES = [
  { type: 'COLOR', label: 'Color' },
  { type: 'FLOAT', label: 'Number' },
  { type: 'STRING', label: 'String' },
  { type: 'BOOLEAN', label: 'Boolean' },
] as const;

export function VariableTypeFilters() {
  const { selectedVariableTypes, toggleVariableType, toggleAllVariableTypes } = useAppContext();

  const selectedCount = selectedVariableTypes.size;
  const totalCount = VARIABLE_TYPES.length;

  return (
    <OptionsDropdown label={`Types (${selectedCount}/${totalCount})`}>
      <div className="variable-type-filters-header">
        <span>Select Variable Types</span>
        <TextButton size="sm" onClick={toggleAllVariableTypes}>
          {selectedCount === totalCount ? 'None' : 'All'}
        </TextButton>
      </div>

      <div className="variable-type-filters-list">
        {VARIABLE_TYPES.map(({ type, label }) => (
          <Checkbox
            key={type}
            className="variable-type-filter-item"
            label={
              <>
                <span className="type-icon">
                  <TypeIcon type={type} />
                </span>
                <span>{label}</span>
              </>
            }
            checked={selectedVariableTypes.has(type)}
            onChange={() => toggleVariableType(type)}
          />
        ))}
      </div>
    </OptionsDropdown>
  );
}
