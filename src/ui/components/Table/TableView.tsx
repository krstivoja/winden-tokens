// Table view component

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { VariableData } from '../../types';
import { TableRow } from './TableRow';
import { GroupHeader } from './GroupHeader';
import { ColorValueMenu } from './ColorValueMenu';
import { ExpandAllIcon, CollapseAllIcon } from '../Icons';

export function TableView() {
  const {
    filteredVariables,
    colorVariables,
    isGroupCollapsed,
    collapseGroups,
    expandGroups,
    getGroupContrastColor,
    getSingleContrastColor,
  } = useAppContext();
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [colorMenu, setColorMenu] = useState<{
    show: boolean;
    position: { top: number; left: number };
    variableId: string;
    value: string;
  }>({ show: false, position: { top: 0, left: 0 }, variableId: '', value: '' });

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

    // Account for table container scroll position
    const container = tableContainerRef.current;
    const scrollTop = container?.scrollTop || 0;
    const containerRect = container?.getBoundingClientRect();
    const containerTop = containerRect?.top || 0;

    // Calculate position relative to the container
    const top = rect.bottom - containerTop + scrollTop + 4;
    const left = rect.left - (containerRect?.left || 0);

    setColorMenu({
      show: true,
      position: { top, left },
      variableId,
      value,
    });
  }, []);

  const hideColorMenu = useCallback(() => {
    setColorMenu(prev => ({ ...prev, show: false }));
  }, []);

  const canExpandAllGroups = sortedGroups.some(groupName => isGroupCollapsed(groupName));
  const canCollapseAllGroups = sortedGroups.some(groupName => !isGroupCollapsed(groupName));

  const handleExpandAllGroups = useCallback(() => {
    expandGroups(sortedGroups);
  }, [expandGroups, sortedGroups]);

  const handleCollapseAllGroups = useCallback(() => {
    collapseGroups(sortedGroups);
  }, [collapseGroups, sortedGroups]);

  const nameHeader = (
    <div className="table-header-content flex justify-between items-center">
      <span>Name</span>
      {sortedGroups.length > 0 && (
        <div className="table-header-actions">
          <button
            type="button"
            className="table-header-action"
            onClick={canExpandAllGroups ? handleExpandAllGroups : handleCollapseAllGroups}
            title={canExpandAllGroups ? "Expand all groups" : "Collapse all groups"}
            aria-label={canExpandAllGroups ? "Expand all groups" : "Collapse all groups"}
          >
            {canExpandAllGroups ? <ExpandAllIcon /> : <CollapseAllIcon />}
          </button>
        </div>
      )}
    </div>
  );

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
        <table className="spreadsheet w-full border border-gray-200 border-collapse">
          <thead>
            <tr>
              <th className="col-name text-left font-semibold border border-gray-200 px-3 py-2 bg-gray-50">{nameHeader}</th>
              <th className="col-value text-left font-semibold border border-gray-200 px-3 py-2 bg-gray-50">Value</th>
              <th className="col-collection text-left font-semibold border border-gray-200 px-3 py-2 bg-gray-50">Collection</th>
              <th className="col-accessibility text-left font-semibold border border-gray-200 px-3 py-2 bg-gray-50">Accessibility</th>
              <th className="col-actions w-25 text-left font-semibold border border-gray-200 px-3 py-2 bg-gray-50">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr className="empty-state-row">
              <td colSpan={5}>
                <div className="empty-state">No variables yet</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="table-container" ref={tableContainerRef} tabIndex={0}>
      <table className="spreadsheet w-full border border-gray-200 border-collapse">
        <thead>
          <tr>
            <th className="col-name text-left font-semibold border border-gray-200 px-3 py-2 bg-gray-50">{nameHeader}</th>
            <th className="col-value text-left font-semibold border border-gray-200 px-3 py-2 bg-gray-50">Value</th>
            <th className="col-collection text-left font-semibold border border-gray-200 px-3 py-2 bg-gray-50">Collection</th>
            <th className="col-accessibility text-left font-semibold border border-gray-200 px-3 py-2 bg-gray-50">Accessibility</th>
            <th className="col-actions w-25 text-left font-semibold border border-gray-200 px-3 py-2 bg-gray-50">Actions</th>
          </tr>
        </thead>
        <tbody id="table-body">
          {/* Ungrouped variables */}
          {ungrouped.map(v => (
            <TableRow
              key={v.id}
              variable={v}
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
