// Table row component

import React, { useState, useCallback, useMemo, useEffect, memo } from 'react';
import { VariableData } from '../../types';
import { post } from '../../hooks/usePluginMessages';
import { useAppContext } from '../../context/AppContext';
import { useModalContext } from '../Modals/ModalContext';
import { TypeIcon, DragIcon, CopyIcon, TrashIcon } from '../Icons';
import { ValueCell } from './ValueCell';
import { ContrastPicker } from './ContrastPicker';
import { parseColorToRgb, checkContrast } from '../../utils/color';

interface TableRowProps {
  variable: VariableData;
  rowIndex: number;
  isGrouped: boolean;
  isHidden?: boolean;
  groupName?: string;
  onShowColorMenu: (e: React.MouseEvent, id: string, value: string) => void;
  contrastColor: string | null;
  colorVariables: VariableData[];
}

export const TableRow = memo(function TableRow({
  variable,
  rowIndex,
  isGrouped,
  isHidden = false,
  groupName = '',
  onShowColorMenu,
  contrastColor,
  colorVariables,
}: TableRowProps) {
  const { setSingleContrastColor } = useAppContext();
  const { openColorPicker, openColorReference } = useModalContext();
  const [displayName, setDisplayName] = useState(variable.displayName || variable.name);
  const [showContrastPicker, setShowContrastPicker] = useState(false);
  const [contrastPickerPosition, setContrastPickerPosition] = useState({ top: 0, left: 0 });

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
      onConfirm: (color) => setSingleContrastColor(variable.id, color),
    });
  }, [openColorPicker, contrastColor, setSingleContrastColor, variable.id]);

  const handleReferenceContrastColor = useCallback(() => {
    setShowContrastPicker(false);
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
    setShowContrastPicker(false);
    setSingleContrastColor(variable.id, null);
  }, [setSingleContrastColor, variable.id]);

  // Close picker when clicking outside
  useEffect(() => {
    if (!showContrastPicker) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#contrast-picker') && !target.closest('.single-contrast-trigger')) {
        setShowContrastPicker(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showContrastPicker]);

  const hiddenClass = isHidden ? 'hidden-by-group' : '';
  const groupedClass = isGrouped ? 'grouped-item' : '';

  return (
    <tr
      data-id={variable.id}
      className={`${groupedClass} ${hiddenClass}`.trim()}
      data-parent-group={groupName || undefined}
    >
      <td>
        <div className="name-cell">
          <span className="drag-handle" title="Drag to reorder" draggable="true">
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
      <td className="accessibility-cell">
        {contrastResult ? (
          <div className="contrast-info">
            <span className="contrast-ratio">{contrastResult.ratio}:1</span>
            <span className={`contrast-badge ${contrastResult.aa ? 'pass' : 'fail'}`}>
              {contrastResult.aa ? '✓' : '✗'}AA
            </span>
            <span className={`contrast-badge ${contrastResult.aaa ? 'pass' : 'fail'}`}>
              {contrastResult.aaa ? '✓' : '✗'}AAA
            </span>
          </div>
        ) : !isGrouped && variable.resolvedType === 'COLOR' ? (
          <>
            <div
              className="single-contrast-trigger"
              onClick={handleContrastClick}
              title="Set contrast color"
            >
              {contrastColor && (
                <span className="contrast-swatch" style={{ background: contrastColor }} />
              )}
              <span className="contrast-label">Contrast</span>
              <span className="dropdown-arrow">▾</span>
            </div>
            {showContrastPicker && (
              <ContrastPicker
                position={contrastPickerPosition}
                contrastColor={contrastColor}
                onPickColor={handlePickContrastColor}
                onReferenceColor={handleReferenceContrastColor}
                onClear={handleClearContrastColor}
              />
            )}
          </>
        ) : null}
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
});
