// Table view component

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { VariableData } from '../../types';
import { post } from '../../hooks/usePluginMessages';
import { TableRow } from './TableRow';
import { GroupHeader } from './GroupHeader';
import { ColorValueMenu } from './ColorValueMenu';

export function TableView() {
  const { filteredVariables, colorVariables, isGroupCollapsed, getGroupContrastColor, getSingleContrastColor } = useAppContext();
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [colorMenu, setColorMenu] = useState<{
    show: boolean;
    position: { top: number; left: number };
    variableId: string;
    value: string;
  }>({ show: false, position: { top: 0, left: 0 }, variableId: '', value: '' });

  // Drag and drop state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const dragOverRowRef = useRef<HTMLElement | null>(null);

  // Group variables by path prefix
  const { grouped, ungrouped, sortedGroups } = React.useMemo(() => {
    const grouped: Record<string, VariableData[]> = {};
    const ungrouped: VariableData[] = [];

    filteredVariables.forEach(v => {
      const parts = v.name.split('/');
      if (parts.length > 1) {
        const groupName = parts.slice(0, -1).join('/');
        if (!grouped[groupName]) grouped[groupName] = [];
        grouped[groupName].push({ ...v, displayName: parts[parts.length - 1] });
      } else {
        ungrouped.push({ ...v, displayName: v.name });
      }
    });

    return {
      grouped,
      ungrouped,
      sortedGroups: Object.keys(grouped).sort(),
    };
  }, [filteredVariables]);

  const showColorMenu = useCallback((e: React.MouseEvent, variableId: string, value: string) => {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    setColorMenu({
      show: true,
      position: { top: rect.bottom + 4, left: rect.left },
      variableId,
      value,
    });
  }, []);

  const hideColorMenu = useCallback(() => {
    setColorMenu(prev => ({ ...prev, show: false }));
  }, []);

  // Drag and drop handlers using event delegation
  const handleDragStart = useCallback((e: React.DragEvent) => {
    const handle = (e.target as HTMLElement).closest('.drag-handle');
    if (!handle) {
      e.preventDefault();
      return;
    }
    const row = handle.closest('tr');
    if (!row) return;

    const id = row.getAttribute('data-id');
    if (id) {
      setDraggedId(id);
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const row = (e.target as HTMLElement).closest('tr[data-id]') as HTMLElement;
    if (!row || row.getAttribute('data-id') === draggedId) {
      if (dragOverRowRef.current) {
        dragOverRowRef.current.classList.remove('drag-over');
        dragOverRowRef.current = null;
      }
      return;
    }

    if (dragOverRowRef.current !== row) {
      if (dragOverRowRef.current) {
        dragOverRowRef.current.classList.remove('drag-over');
      }
      row.classList.add('drag-over');
      dragOverRowRef.current = row;
    }
  }, [draggedId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const row = (e.target as HTMLElement).closest('tr[data-id]') as HTMLElement;
    if (!row || !draggedId) return;

    const targetId = row.getAttribute('data-id');
    if (targetId && targetId !== draggedId) {
      const rect = row.getBoundingClientRect();
      const insertBefore = e.clientY < rect.top + rect.height / 2;
      post({ type: 'reorder-variable', draggedId, targetId, insertBefore });
    }

    // Cleanup
    if (dragOverRowRef.current) {
      dragOverRowRef.current.classList.remove('drag-over');
      dragOverRowRef.current = null;
    }
    document.querySelectorAll('tr.dragging').forEach(r => r.classList.remove('dragging'));
    setDraggedId(null);
  }, [draggedId]);

  const handleDragEnd = useCallback(() => {
    if (dragOverRowRef.current) {
      dragOverRowRef.current.classList.remove('drag-over');
      dragOverRowRef.current = null;
    }
    document.querySelectorAll('tr.dragging').forEach(r => r.classList.remove('dragging'));
    setDraggedId(null);
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#color-value-menu') && !target.closest('.color-swatch')) {
        hideColorMenu();
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [hideColorMenu]);

  if (!filteredVariables.length) {
    return (
      <div className="table-container">
        <table className="spreadsheet">
          <thead>
            <tr>
              <th className="col-name">NAME</th>
              <th className="col-value">VALUE</th>
              <th className="col-accessibility">ACCESSIBILITY</th>
              <th className="col-actions">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            <tr className="empty-state-row">
              <td colSpan={4}>
                <div className="empty-state">No variables yet</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  let rowIndex = 0;

  return (
    <div className="table-container" ref={tableContainerRef} tabIndex={0}>
      <table className="spreadsheet">
        <thead>
          <tr>
            <th className="col-name">NAME</th>
            <th className="col-value">VALUE</th>
            <th className="col-accessibility">ACCESSIBILITY</th>
            <th className="col-actions">ACTIONS</th>
          </tr>
        </thead>
        <tbody
          id="table-body"
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
        >
          {/* Ungrouped variables */}
          {ungrouped.map(v => (
            <TableRow
              key={v.id}
              variable={v}
              rowIndex={rowIndex++}
              isGrouped={false}
              onShowColorMenu={showColorMenu}
              contrastColor={v.resolvedType === 'COLOR' ? getSingleContrastColor(v.id) : null}
              colorVariables={colorVariables}
            />
          ))}

          {/* Grouped variables */}
          {sortedGroups.map(groupName => {
            const isCollapsed = isGroupCollapsed(groupName);
            const groupVars = grouped[groupName];
            const groupContrastColor = getGroupContrastColor(groupName);

            return (
              <React.Fragment key={groupName}>
                <GroupHeader
                  groupName={groupName}
                  variables={groupVars}
                  isCollapsed={isCollapsed}
                />
                {groupVars.map(v => (
                  <TableRow
                    key={v.id}
                    variable={v}
                    rowIndex={rowIndex++}
                    isGrouped={true}
                    isHidden={isCollapsed}
                    groupName={groupName}
                    onShowColorMenu={showColorMenu}
                    contrastColor={groupContrastColor}
                    colorVariables={colorVariables}
                  />
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {colorMenu.show && (
        <ColorValueMenu
          position={colorMenu.position}
          variableId={colorMenu.variableId}
          currentValue={colorMenu.value}
          onClose={hideColorMenu}
        />
      )}
    </div>
  );
}
