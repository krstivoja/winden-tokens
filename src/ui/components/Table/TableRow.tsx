// Table row component

import React, { useState, useCallback, useMemo, memo } from 'react';
import { VariableData } from '../../types';
import { post } from '../../hooks/usePluginMessages';
import { useAppContext } from '../../context/AppContext';
import { useModalContext } from '../Modals/ModalContext';
import { TypeIcon, CopyIcon, TrashIcon, ShadesIcon, StepsIcon, ChevronDownIcon } from '../Icons';
import { IconButton } from '../common/IconButton/IconButton';
import { IconTextButton } from '../common/Button/Button';
import { OptionsDropdown } from '../common/OptionsDropdown/OptionsDropdown';
import { ValueCell } from './ValueCell';
import { CollectionCell } from './CollectionCell';
import { ContrastPicker } from './ContrastPicker';
import { parseColorToRgb, checkContrast } from '../../utils/color';

interface TableRowProps {
  variable: VariableData;
  isGrouped: boolean;
  isHidden?: boolean;
  groupName?: string;
  onShowColorMenu: (e: React.MouseEvent, id: string, value: string) => void;
  contrastColor: string | null;
  colorVariables: VariableData[];
}

export const TableRow = memo(function TableRow({
  variable,
  isGrouped,
  isHidden = false,
  groupName = '',
  onShowColorMenu,
  contrastColor,
  colorVariables,
}: TableRowProps) {
  const { setSingleContrastColor, getShadeGroupBySourceId } = useAppContext();
  const { openColorPicker, openColorReference, openShadesModal, openStepsModal } = useModalContext();
  const [displayName, setDisplayName] = useState(variable.displayName || variable.name);

  const shadeGroup = useMemo(() => {
    if (isGrouped || variable.resolvedType !== 'COLOR') return null;
    return getShadeGroupBySourceId(variable.id);
  }, [getShadeGroupBySourceId, isGrouped, variable.id, variable.resolvedType]);

  // Calculate contrast for color variables
  const contrastResult = useMemo(() => {
    if (variable.resolvedType !== 'COLOR' || !contrastColor) return null;
    const colorRgb = parseColorToRgb(variable.value);
    const contrastRgb = parseColorToRgb(contrastColor);
    if (!colorRgb || !contrastRgb) return null;
    return checkContrast(colorRgb, contrastRgb);
  }, [variable.value, variable.resolvedType, contrastColor]);

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

  // Contrast picker handlers for ungrouped color variables
  const handlePickContrastColor = useCallback(() => {
    openColorPicker({
      initialColor: contrastColor || '#ffffff',
      onConfirm: (color) => setSingleContrastColor(variable.id, color),
    });
  }, [openColorPicker, contrastColor, setSingleContrastColor, variable.id]);

  const handleReferenceContrastColor = useCallback(() => {
    openColorReference({
      onConfirm: (variableId) => {
        const colorVar = colorVariables.find(v => v.id === variableId);
        if (colorVar) {
          setSingleContrastColor(variable.id, colorVar.value);
        }
      },
    });
  }, [openColorReference, colorVariables, setSingleContrastColor, variable.id]);

  const handleClearContrastColor = useCallback(() => {
    setSingleContrastColor(variable.id, null);
  }, [setSingleContrastColor, variable.id]);

  const handleShadesClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    openShadesModal({ groupName: variable.name });
  }, [openShadesModal, variable.name]);

  const handleStepsClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    openStepsModal({ groupName: variable.name, collectionId: variable.collectionId });
  }, [openStepsModal, variable.collectionId, variable.name]);

  const hiddenClass = isHidden ? 'hidden-by-group' : '';
  const groupedClass = isGrouped ? 'grouped-item' : '';

  // Modifier button (Shades/Steps) to be displayed inside value cell
  const modifierButton = !isGrouped && (
    <>
      {variable.resolvedType === 'COLOR' && (
        <button
          className={`modifier-btn ${shadeGroup?.status === 'dirty' ? 'dirty' : ''}`.trim()}
          onClick={handleShadesClick}
          title={shadeGroup?.status === 'dirty' ? 'Managed shades need refresh' : 'Generate shades'}
        >
          <span className="icon"><ShadesIcon /></span>
          Shades
        </button>
      )}
      {variable.resolvedType === 'FLOAT' && (
        <button
          className="modifier-btn"
          onClick={handleStepsClick}
          title="Generate number steps"
        >
          <span className="icon"><StepsIcon /></span>
          Steps
        </button>
      )}
    </>
  );

  return (
    <tr
      data-id={variable.id}
      className={`group ${groupedClass} ${hiddenClass}`.trim()}
      data-parent-group={groupName || undefined}
    >
      <td>
        <div className="name-cell">
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
          modifierButton={modifierButton}
        />
      </td>
      <td>
        <CollectionCell variable={variable} />
      </td>
      <td className="accessibility-cell">
        {contrastResult ? (
          <OptionsDropdown
            label={
              <>
                <span className="contrast-ratio">{contrastResult.ratio}:1</span>
                <span className={`contrast-badge ${contrastResult.aa ? 'pass' : 'fail'}`}>
                  {contrastResult.aa ? '✓' : '✗'}AA
                </span>
                <span className={`contrast-badge ${contrastResult.aaa ? 'pass' : 'fail'}`}>
                  {contrastResult.aaa ? '✓' : '✗'}AAA
                </span>
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
        ) : !isGrouped && variable.resolvedType === 'COLOR' ? (
          <OptionsDropdown
            label={
              <>
                {contrastColor && (
                  <span className="inline-block w-3 h-3 rounded mr-1" style={{ background: contrastColor }} />
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
        ) : null}
      </td>
      <td className="w-25">
        <div className="row-actions flex gap-2">
          <IconButton
            icon={<CopyIcon />}
            onClick={handleDuplicate}
            title="Duplicate"
            aria-label="Duplicate"
          />
          <IconButton
            icon={<TrashIcon />}
            onClick={handleDelete}
            title="Delete"
            aria-label="Delete"
          />
        </div>
      </td>
    </tr>
  );
});
