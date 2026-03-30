// Table view component

import React, { useRef, useMemo, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { VariableData } from '../../types';
import { TableRow } from './TableRow';
import { GroupHeader } from './GroupHeader';
import { SidebarFilter } from './SidebarFilter';
import { TableHeader } from './TableHeader';
import { ExpandAllIcon, CollapseAllIcon } from '../Icons';
import { getVariableGroupName, isVariableVisibleForGroupFilters } from '../../utils/groupFilters';

interface TableViewProps {
  status: { message: string; type: string };
}

export function TableView({ status }: TableViewProps) {
  const {
    filteredVariables,
    colorVariables,
    isGroupCollapsed,
    collapseGroups,
    expandGroups,
    getGroupContrastColor,
    getSingleContrastColor,
    collections,
    selectedModeId,
    setSelectedModeId,
    selectedVariableTypes: selectedTypes,
    selectedCollectionIds: selectedCollections,
    selectedGroups,
    toggleVariableType: handleTypeToggle,
    toggleCollection: handleCollectionToggle,
    toggleSelectedGroup: handleGroupToggle,
  } = useAppContext();
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Apply sidebar group filter to variables (type and collection filters are applied in AppContext)
  const sidebarFilteredVariables = useMemo(() => {
    return filteredVariables.filter(v => isVariableVisibleForGroupFilters(v, selectedGroups));
  }, [filteredVariables, selectedGroups]);

  // Group variables by path prefix (use sidebar-filtered variables)
  const { grouped, ungrouped, sortedGroups } = React.useMemo(() => {
    const grouped: Record<string, VariableData[]> = {};
    const ungrouped: VariableData[] = [];

    sidebarFilteredVariables.forEach(v => {
      const groupName = getVariableGroupName(v.name);
      if (groupName) {
        const parts = v.name.split('/');
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
  }, [sidebarFilteredVariables]);

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

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <SidebarFilter
        selectedModeId={selectedModeId}
        onModeChange={setSelectedModeId}
        selectedTypes={selectedTypes}
        onTypeToggle={handleTypeToggle}
        selectedCollections={selectedCollections}
        onCollectionToggle={handleCollectionToggle}
        selectedGroups={selectedGroups}
        onGroupToggle={handleGroupToggle}
      />

      {/* Main content area with header and table */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with actions */}
        <TableHeader status={status} />

        {/* Table content */}
        <div className="flex-1 overflow-auto border-l-0">
          {!sidebarFilteredVariables.length ? (
            <div className="table-container">
              <table className="spreadsheet w-full border border-l-0 border-border border-collapse">
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
                    <div className="empty-state">No variables match the selected filters</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          ) : (
            <div className="table-container relative" ref={tableContainerRef} tabIndex={0}>
              <table className="spreadsheet w-full border border-l-0 border-border border-collapse">
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
                    selectedModeId={selectedModeId}
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
                          selectedModeId={selectedModeId}
                        />
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
