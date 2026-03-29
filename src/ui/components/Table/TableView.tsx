// Table view component

import React, { useRef, useEffect, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { VariableData } from '../../types';
import { TableRow } from './TableRow';
import { GroupHeader } from './GroupHeader';
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

  if (!filteredVariables.length) {
    return (
      <div className="table-container">
        <table className="spreadsheet w-full border border-border border-collapse">
          <thead>
            <tr>
              <th className="text-left font-semibold border border-border px-3 py-2 bg-base-2">{nameHeader}</th>
              <th className="text-left font-semibold border border-border px-3 py-2 bg-base-2">Value</th>
              <th className="text-left font-semibold border border-border px-3 py-2 bg-base-2">Collection</th>
              <th className="text-left font-semibold border border-border px-3 py-2 bg-base-2">Accessibility</th>
              <th className="w-[100px] min-w-[100px] max-w-[100px] text-left font-semibold border border-border px-3 py-2 bg-base-2">Actions</th>
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
    <div className="table-container relative" ref={tableContainerRef} tabIndex={0}>
      <table className="spreadsheet w-full border border-border border-collapse">
        <thead>
          <tr>
            <th className="text-left font-semibold border border-border px-3 py-2 bg-base-2">{nameHeader}</th>
            <th className="text-left font-semibold border border-border px-3 py-2 bg-base-2">Value</th>
            <th className="text-left font-semibold border border-border px-3 py-2 bg-base-2">Collection</th>
            <th className="text-left font-semibold border border-border px-3 py-2 bg-base-2">Accessibility</th>
            <th className="w-[100px] min-w-[100px] max-w-[100px] text-left font-semibold border border-border px-3 py-2 bg-base-2">Actions</th>
          </tr>
        </thead>
        <tbody id="table-body">
          {/* Ungrouped variables */}
          {ungrouped.map(v => (
            <TableRow
              key={v.id}
              variable={v}
              isGrouped={false}
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
                {groupVars.map((v, index) => (
                  <TableRow
                    key={v.id}
                    variable={v}
                    isGrouped={true}
                    isHidden={isCollapsed}
                    groupName={groupName}
                    isLastInGroup={index === groupVars.length - 1}
                    contrastColor={groupContrastColor}
                    colorVariables={colorVariables}
                  />
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
