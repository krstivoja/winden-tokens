// Table view component

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { VariableData } from '../../types';
import { TableRow } from './TableRow';
import { GroupHeader } from './GroupHeader';
import { SidebarFilter } from './SidebarFilter';
import { TableHeader } from './TableHeader';
import { ExpandAllIcon, CollapseAllIcon } from '../Icons';

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
  } = useAppContext();
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Sidebar filter state
  const [selectedModeId, setSelectedModeId] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize filters - select all types and collections by default
  useEffect(() => {
    if (isInitialized) return;
    if (filteredVariables.length === 0 || collections.length === 0) return;

    const types = new Set<string>();
    filteredVariables.forEach(v => types.add(v.resolvedType));
    setSelectedTypes(types);

    const collectionIds = new Set(collections.map(c => c.id));
    setSelectedCollections(collectionIds);

    setIsInitialized(true);
  }, [filteredVariables, collections, isInitialized]);

  // Toggle handlers
  const handleTypeToggle = useCallback((type: string) => {
    setSelectedTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  }, []);

  const handleCollectionToggle = useCallback((collectionId: string) => {
    setSelectedCollections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(collectionId)) {
        newSet.delete(collectionId);
      } else {
        newSet.add(collectionId);
      }
      return newSet;
    });
  }, []);

  // Apply sidebar filters to variables
  const sidebarFilteredVariables = useMemo(() => {
    return filteredVariables.filter(v => {
      // Type filter
      if (!selectedTypes.has(v.resolvedType)) return false;

      // Collection filter
      if (!selectedCollections.has(v.collectionId)) return false;

      // Mode filter - TODO: implement when mode-specific values are available
      // For now, mode filter is just a selector without filtering logic

      return true;
    });
  }, [filteredVariables, selectedTypes, selectedCollections]);

  // Group variables by path prefix (use sidebar-filtered variables)
  const { grouped, ungrouped, sortedGroups } = React.useMemo(() => {
    const grouped: Record<string, VariableData[]> = {};
    const ungrouped: VariableData[] = [];

    sidebarFilteredVariables.forEach(v => {
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
          )}
        </div>
      </div>
    </div>
  );
}
