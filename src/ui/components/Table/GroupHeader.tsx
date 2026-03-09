// Group header component

import React, { useCallback, useState } from 'react';
import { VariableData } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { useModalContext } from '../Modals/ModalContext';
import { post } from '../../hooks/usePluginMessages';
import { TypeIcon, ChevronDownIcon, EditIcon, TrashIcon, ShadesIcon, StepsIcon, RefreshIcon } from '../Icons';
import { ContrastPicker } from './ContrastPicker';
import { refreshManagedShadeGroup } from '../../utils/shadeActions';

interface GroupHeaderProps {
  groupName: string;
  variables: VariableData[];
  isCollapsed: boolean;
}

export function GroupHeader({ groupName, variables, isCollapsed }: GroupHeaderProps) {
  const {
    toggleGroup,
    getGroupContrastColor,
    setGroupContrastColor,
    variables: allVariables,
    selectedCollectionId,
    getShadeGroupByGroupName,
  } = useAppContext();
  const { openBulkEdit, openColorPicker, openColorReference, openShadesModal, openStepsModal } = useModalContext();
  const [showContrastPicker, setShowContrastPicker] = useState(false);
  const [contrastPickerPosition, setContrastPickerPosition] = useState({ top: 0, left: 0 });

  const groupIds = variables.map(v => v.id);
  const groupType = variables[0]?.resolvedType || 'STRING';
  const contrastColor = getGroupContrastColor(groupName);
  const shadeGroup = groupType === 'COLOR' ? getShadeGroupByGroupName(groupName) : null;
  const sourceVariable = shadeGroup
    ? allVariables.find(variable => variable.id === shadeGroup.sourceVariableId) || null
    : null;

  // Get color variables for reference picker
  const colorVariables = React.useMemo(() =>
    allVariables.filter(v => v.collectionId === selectedCollectionId && v.resolvedType === 'COLOR'),
    [allVariables, selectedCollectionId]
  );

  const handleToggle = useCallback(() => {
    toggleGroup(groupName);
  }, [toggleGroup, groupName]);

  const handleBulkEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    openBulkEdit({ groupName });
  }, [openBulkEdit, groupName]);

  const handleDeleteGroup = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (shadeGroup && sourceVariable) {
      if (confirm(`Remove generated shades for ${groupName}?`)) {
        post({
          type: 'remove-shades',
          collectionId: sourceVariable.collectionId,
          deleteIds: shadeGroup.deleteIds,
          source: {
            id: sourceVariable.id,
            name: sourceVariable.name,
            value: sourceVariable.value,
          },
        });
      }
      return;
    }

    if (confirm(`Delete all ${groupIds.length} variables in this group?`)) {
      post({ type: 'delete-group', ids: groupIds });
    }
  }, [groupIds, groupName, shadeGroup, sourceVariable]);

  const handleContrastClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setContrastPickerPosition({ top: rect.bottom + 4, left: rect.left });
    setShowContrastPicker(true);
  }, []);

  const handlePickContrastColor = useCallback(() => {
    setShowContrastPicker(false);
    openColorPicker({
      initialColor: contrastColor || '#ffffff',
      onConfirm: (color) => setGroupContrastColor(groupName, color),
    });
  }, [openColorPicker, contrastColor, setGroupContrastColor, groupName]);

  const handleReferenceContrastColor = useCallback(() => {
    setShowContrastPicker(false);
    openColorReference({
      onConfirm: (variableId) => {
        const colorVar = colorVariables.find(v => v.id === variableId);
        if (colorVar) {
          setGroupContrastColor(groupName, colorVar.value);
        }
      },
    });
  }, [openColorReference, colorVariables, setGroupContrastColor, groupName]);

  const handleClearContrastColor = useCallback(() => {
    setShowContrastPicker(false);
    setGroupContrastColor(groupName, null);
  }, [setGroupContrastColor, groupName]);

  const handleShadesClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();

    if (shadeGroup?.status === 'dirty' && sourceVariable) {
      const refreshed = refreshManagedShadeGroup(shadeGroup, sourceVariable);
      if (refreshed) {
        return;
      }
    }

    openShadesModal({ groupName });
  }, [groupName, openShadesModal, shadeGroup, sourceVariable]);

  const handleStepsClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    openStepsModal({ groupName });
  }, [openStepsModal, groupName]);

  // Close picker when clicking outside
  React.useEffect(() => {
    if (!showContrastPicker) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#contrast-picker') && !target.closest('.group-contrast-trigger')) {
        setShowContrastPicker(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showContrastPicker]);

  return (
    <tr
      className={`group-row ${isCollapsed ? 'collapsed' : ''}`}
      data-group={groupName}
    >
      <td>
        <div className="group-header">
          <span className={`type-icon ${groupType}`}>
            <TypeIcon type={groupType} />
          </span>
          <span onClick={handleToggle} style={{ flex: 1, cursor: 'pointer' }}>
            {groupName}
            <span style={{ color: 'var(--text-dim)', fontWeight: 400, fontSize: '10px' }}>
              {' '}({variables.length})
            </span>
          </span>
          <span
            className={`group-toggle ${isCollapsed ? 'collapsed' : ''}`}
            onClick={handleToggle}
          >
            <ChevronDownIcon />
          </span>
        </div>
      </td>
      <td></td>
      <td className="accessibility-cell">
        {groupType === 'COLOR' && (
          <div
            className="group-contrast-trigger"
            onClick={handleContrastClick}
            title="Set contrast color for this group"
          >
            {contrastColor && (
              <span className="contrast-swatch" style={{ background: contrastColor }} />
            )}
            <span className="contrast-label">Contrast</span>
            <span className="dropdown-arrow">▾</span>
          </div>
        )}
        {showContrastPicker && (
          <ContrastPicker
            position={contrastPickerPosition}
            contrastColor={contrastColor}
            onPickColor={handlePickContrastColor}
            onReferenceColor={handleReferenceContrastColor}
            onClear={handleClearContrastColor}
          />
        )}
      </td>
      <td className="modifier-cell">
        {groupType === 'COLOR' && (
          <button
            className={`modifier-btn ${shadeGroup?.status === 'dirty' ? 'dirty' : ''}`.trim()}
            onClick={handleShadesClick}
            title={shadeGroup?.status === 'dirty' ? 'Refresh generated shades' : 'Generate shades'}
          >
            <span className="icon">
              {shadeGroup?.status === 'dirty' ? <RefreshIcon /> : <ShadesIcon />}
            </span>
            {shadeGroup?.status === 'dirty' ? 'Refresh' : 'Shades'}
          </button>
        )}
        {groupType === 'FLOAT' && (
          <button
            className="modifier-btn"
            onClick={handleStepsClick}
            title="Generate steps"
          >
            <span className="icon"><StepsIcon /></span>
            Steps
          </button>
        )}
      </td>
      <td>
        <div className="row-actions">
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
