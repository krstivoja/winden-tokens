// Group header component

import React, { useCallback } from 'react';
import { VariableData } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { useModalContext } from '../Modals/ModalContext';
import { post } from '../../hooks/usePluginMessages';
import { TypeIcon, ExpandAllIcon, CollapseAllIcon, EditIcon, TrashIcon, ShadesIcon, StepsIcon, RefreshIcon } from '../Icons';
import { IconButton } from '../common/Button';
import { IconTextButton } from '../common/Button/Button';
import { OptionsDropdown } from '../common/OptionsDropdown/OptionsDropdown';
import { ContrastPicker } from './ContrastPicker';
import { GroupCollectionCell } from './GroupCollectionCell';
import { refreshManagedShadeGroup } from '../../utils/shadeActions';
import { ColorSwatch } from '../common/ColorSwatch/ColorSwatch';

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
    selectedModeId,
  } = useAppContext();
  const { openBulkEdit, openColorPicker, openColorReference, openShadesModal, openStepsModal } = useModalContext();

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

  const handlePickContrastColor = useCallback(() => {
    openColorPicker({
      initialColor: contrastColor || '#ffffff',
      onConfirm: (color) => setGroupContrastColor(groupName, color),
    });
  }, [openColorPicker, contrastColor, setGroupContrastColor, groupName]);

  const handleReferenceContrastColor = useCallback(() => {
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

    openShadesModal({ groupName, modeId: selectedModeId });
  }, [groupName, openShadesModal, shadeGroup, sourceVariable, selectedModeId]);

  const handleStepsClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    openStepsModal({ groupName, collectionId: variables[0]?.collectionId });
  }, [openStepsModal, groupName, variables]);

  return (
    <tr
      className={`group group-row ${isCollapsed ? 'collapsed' : ''}`}
      data-group={groupName}
    >
      <td className="border border-border px-3 py-2">
        <div className="group-header flex items-center gap-2">
          <span className={`type-icon ${groupType}`}>
            <TypeIcon type={groupType} />
          </span>
          <span onClick={handleToggle} className="flex-1 cursor-pointer">
            {groupName}
            <span className="text-text opacity-50 font-normal text-[10px]">
              {' '}({variables.length})
            </span>
          </span>
          <IconButton
            icon={isCollapsed ? <ExpandAllIcon /> : <CollapseAllIcon />}
            onClick={handleToggle}
            aria-label={isCollapsed ? "Expand group" : "Collapse group"}
          />
        </div>
      </td>
      <td className="border border-border px-3 py-2">
        <div className="flex items-center justify-end gap-2 h-full">
          {groupType === 'COLOR' && (
            <IconTextButton
              icon={shadeGroup?.status === 'dirty' ? <RefreshIcon /> : <ShadesIcon />}
              onClick={handleShadesClick}
              title={shadeGroup?.status === 'dirty' ? 'Refresh generated shades' : 'Generate shades'}
              className={shadeGroup?.status === 'dirty' ? 'dirty' : ''}
            >
              {shadeGroup?.status === 'dirty' ? 'Refresh' : 'Shades'}
            </IconTextButton>
          )}
          {groupType === 'FLOAT' && (
            <IconTextButton
              icon={<StepsIcon />}
              onClick={handleStepsClick}
              title="Generate steps"
            >
              Steps
            </IconTextButton>
          )}
        </div>
      </td>
      <td className="border border-border px-3 py-2">
        <GroupCollectionCell variables={variables} />
      </td>
      <td className="accessibility-cell border border-border px-3 py-2">
        {groupType === 'COLOR' && (
          <OptionsDropdown
            label={
              <>
                {contrastColor && (
                  <ColorSwatch color={contrastColor} className="mr-1" />
                )}
                Contrast
              </>
            }
          >
            <ContrastPicker
              contrastColor={contrastColor}
              onPickColor={handlePickContrastColor}
              onReferenceColor={handleReferenceContrastColor}
              onClear={handleClearContrastColor}
            />
          </OptionsDropdown>
        )}
      </td>
      <td className="w-25 border border-border px-3 py-2">
        <div className="row-actions flex gap-2">
          <IconButton
            icon={<EditIcon />}
            onClick={handleBulkEdit}
            title="Edit as text"
            aria-label="Edit as text"
          />
          <IconButton
            icon={<TrashIcon />}
            onClick={handleDeleteGroup}
            title="Delete group"
            aria-label="Delete group"
          />
        </div>
      </td>
    </tr>
  );
}
