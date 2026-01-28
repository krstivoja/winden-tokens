// Group header component

import React, { useCallback } from 'react';
import { VariableData } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { useModalContext } from '../Modals/ModalContext';
import { post } from '../../hooks/usePluginMessages';
import { TypeIcon, ChevronDownIcon, EditIcon, TrashIcon } from '../Icons';

interface GroupHeaderProps {
  groupName: string;
  variables: VariableData[];
  isCollapsed: boolean;
}

export function GroupHeader({ groupName, variables, isCollapsed }: GroupHeaderProps) {
  const { toggleGroup } = useAppContext();
  const { openBulkEdit } = useModalContext();

  const groupIds = variables.map(v => v.id);
  const groupType = variables[0]?.resolvedType || 'STRING';

  const handleToggle = useCallback(() => {
    toggleGroup(groupName);
  }, [toggleGroup, groupName]);

  const handleBulkEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    openBulkEdit({ groupName });
  }, [openBulkEdit, groupName]);

  const handleDeleteGroup = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete all ${groupIds.length} variables in this group?`)) {
      post({ type: 'delete-group', ids: groupIds });
    }
  }, [groupIds]);

  return (
    <tr
      className={`group-row ${isCollapsed ? 'collapsed' : ''}`}
      data-group={groupName}
    >
      <td colSpan={3}>
        <div className="group-header">
          <span
            className={`group-toggle ${isCollapsed ? 'collapsed' : ''}`}
            onClick={handleToggle}
          >
            <ChevronDownIcon />
          </span>
          <span className={`type-icon ${groupType}`}>
            <TypeIcon type={groupType} />
          </span>
          <span onClick={handleToggle} style={{ flex: 1, cursor: 'pointer' }}>
            {groupName}
            <span style={{ color: 'var(--text-dim)', fontWeight: 400, fontSize: '10px' }}>
              {' '}({variables.length})
            </span>
          </span>
          <button
            className="row-action"
            onClick={handleBulkEdit}
            title="Edit as text"
            style={{ opacity: 0 }}
          >
            <EditIcon />
          </button>
          <button
            className="row-action danger"
            onClick={handleDeleteGroup}
            title="Delete group"
            style={{ opacity: 0 }}
          >
            <TrashIcon />
          </button>
        </div>
      </td>
    </tr>
  );
}
