// Table row component

import React, { useState, useCallback } from 'react';
import { VariableData } from '../../types';
import { post } from '../../hooks/usePluginMessages';
import { useAppContext } from '../../context/AppContext';
import { TypeIcon, DragIcon, CopyIcon, TrashIcon } from '../Icons';
import { ValueCell } from './ValueCell';

interface TableRowProps {
  variable: VariableData;
  rowIndex: number;
  isGrouped: boolean;
  isHidden?: boolean;
  groupName?: string;
  onShowColorMenu: (e: React.MouseEvent, id: string, value: string) => void;
}

export function TableRow({
  variable,
  rowIndex,
  isGrouped,
  isHidden = false,
  groupName = '',
  onShowColorMenu,
}: TableRowProps) {
  const [displayName, setDisplayName] = useState(variable.displayName || variable.name);

  const handleNameBlur = useCallback(() => {
    const parts = variable.name.split('/');
    let newFullName: string;
    if (parts.length > 1) {
      parts[parts.length - 1] = displayName;
      newFullName = parts.join('/');
    } else {
      newFullName = displayName;
    }
    if (newFullName !== variable.name) {
      post({ type: 'update-variable-name', id: variable.id, name: newFullName });
    }
  }, [variable.id, variable.name, displayName]);

  const handleDelete = useCallback(() => {
    if (confirm('Delete this variable?')) {
      post({ type: 'delete-variable', id: variable.id });
    }
  }, [variable.id]);

  const handleDuplicate = useCallback(() => {
    post({ type: 'duplicate-variable', id: variable.id });
  }, [variable.id]);

  const hiddenClass = isHidden ? 'hidden-by-group' : '';
  const groupedClass = isGrouped ? 'grouped-item' : '';

  return (
    <tr
      data-id={variable.id}
      className={`${groupedClass} ${hiddenClass}`.trim()}
      data-parent-group={groupName || undefined}
      draggable
    >
      <td>
        <div className="name-cell">
          <span className="drag-handle" title="Drag to reorder">
            <DragIcon />
          </span>
          <span className={`type-icon ${variable.resolvedType}`}>
            <TypeIcon type={variable.resolvedType} />
          </span>
          <input
            className="cell-input"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            onBlur={handleNameBlur}
            data-full-name={variable.name}
          />
        </div>
      </td>
      <td>
        <ValueCell
          variable={variable}
          onShowColorMenu={onShowColorMenu}
        />
      </td>
      <td>
        <div className="row-actions">
          <button
            className="row-action"
            onClick={handleDuplicate}
            title="Duplicate"
          >
            <CopyIcon />
          </button>
          <button
            className="row-action danger"
            onClick={handleDelete}
            title="Delete"
          >
            <TrashIcon />
          </button>
        </div>
      </td>
    </tr>
  );
}
