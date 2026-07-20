// Sidebar filter with mode selector, type filters, and collection tree

import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { TypeIcon, PlusIcon } from '../Icons';
import { TextButton, IconTextButton } from '../common/Button';
import { useModalContext } from '../Modals/ModalContext';
import { getCollectionGroupKey, getVariableGroupName } from '../../utils/groupFilters';
import { VariableData } from '../../types';
import { Search } from '../common/Search';

// A group name like "color/on-surface/1" is split into a nested tree so
// siblings sharing a prefix (on-surface/1, /2, /accent, ...) collapse together.
interface GroupTreeNode {
  path: string;
  label: string;
  isGroup: boolean; // true if `path` itself is a real group (has its own graph card)
  children: GroupTreeNode[];
}

function buildGroupTree(groupNames: string[]): GroupTreeNode[] {
  interface MutableNode {
    path: string;
    label: string;
    isGroup: boolean;
    childrenMap: Map<string, MutableNode>;
  }
  const rootMap = new Map<string, MutableNode>();

  groupNames.forEach(name => {
    const parts = name.split('/');
    let map = rootMap;
    let prefix = '';
    parts.forEach((seg, i) => {
      prefix = prefix ? `${prefix}/${seg}` : seg;
      if (!map.has(seg)) {
        map.set(seg, { path: prefix, label: seg, isGroup: false, childrenMap: new Map() });
      }
      const node = map.get(seg)!;
      if (i === parts.length - 1) {
        node.isGroup = true;
      }
      map = node.childrenMap;
    });
  });

  const toArray = (map: Map<string, MutableNode>): GroupTreeNode[] =>
    Array.from(map.values())
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(n => ({ path: n.path, label: n.label, isGroup: n.isGroup, children: toArray(n.childrenMap) }));

  return toArray(rootMap);
}

// All real group keys (this node + every descendant) — used for select-all/collapse cascades.
function collectGroupKeys(node: GroupTreeNode, collectionId: string): string[] {
  const own = node.isGroup ? [getCollectionGroupKey(collectionId, node.path)] : [];
  return [...own, ...node.children.flatMap(child => collectGroupKeys(child, collectionId))];
}

interface GroupNodeRowProps {
  node: GroupTreeNode;
  depth: number;
  collectionId: string;
  variables: VariableData[];
  selectedGroups: Set<string>;
  onGroupToggle: (groupKey: string) => void;
  selectedCollections: Set<string>;
  onCollectionToggle: (collectionId: string) => void;
  collapsedGroups: Set<string>;
  setCollapsedGroups: React.Dispatch<React.SetStateAction<Set<string>>>;
  highlightedGroupKey?: string | null;
  onHighlightGroup?: (graphGroupKey: string) => void;
  forceExpanded?: boolean;
}

function GroupNodeRow({
  node,
  depth,
  collectionId,
  variables,
  selectedGroups,
  onGroupToggle,
  selectedCollections,
  onCollectionToggle,
  collapsedGroups,
  setCollapsedGroups,
  highlightedGroupKey,
  onHighlightGroup,
  forceExpanded = false,
}: GroupNodeRowProps) {
  const nodeKey = `${collectionId}::${node.path}`;
  const hasChildren = node.children.length > 0;
  const isCollapsed = forceExpanded ? false : collapsedGroups.has(nodeKey);
  // Graph cards are keyed `group:<groupName>` (see GroupedGraph) — no collectionId scoping there.
  const graphGroupKey = `group:${node.path}`;
  const isHighlighted = node.isGroup && highlightedGroupKey === graphGroupKey;

  const count = variables.filter(
    v => v.collectionId === collectionId && v.name.startsWith(`${node.path}/`)
  ).length;

  const descendantGroupKeys = React.useMemo(
    () => collectGroupKeys(node, collectionId),
    [node, collectionId]
  );
  const allChecked = descendantGroupKeys.every(k => selectedGroups.has(k));
  const someChecked = descendantGroupKeys.some(k => selectedGroups.has(k));
  const indeterminate = someChecked && !allChecked;

  const handleToggle = () => {
    const collSelected = selectedCollections.has(collectionId);
    if (allChecked) {
      descendantGroupKeys.forEach(k => {
        if (selectedGroups.has(k)) onGroupToggle(k);
      });
    } else {
      descendantGroupKeys.forEach(k => {
        if (!selectedGroups.has(k)) onGroupToggle(k);
      });
      if (!collSelected) onCollectionToggle(collectionId);
    }
  };

  return (
    <div className="space-y-0.5">
      <div
        className={`flex items-center gap-2 px-2 py-1 rounded transition-colors ${
          isHighlighted ? 'bg-brand/10 ring-1 ring-brand' : 'hover:bg-base-2'
        }`}
        style={{ marginLeft: depth * 16 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCollapsedGroups(prev => {
                const next = new Set(prev);
                if (next.has(nodeKey)) {
                  next.delete(nodeKey);
                } else {
                  next.add(nodeKey);
                }
                return next;
              });
            }}
            className="w-4 h-4 flex items-center justify-center text-text-muted hover:text-text transition-colors"
          >
            {isCollapsed ? '▶' : '▼'}
          </button>
        ) : (
          <div className="w-4 shrink-0" />
        )}
        <input
          type="checkbox"
          ref={el => {
            if (el) el.indeterminate = indeterminate;
          }}
          checked={allChecked}
          onChange={handleToggle}
          className="w-3.5 h-3.5 cursor-pointer"
        />
        <span
          onClick={
            node.isGroup && onHighlightGroup
              ? () => onHighlightGroup(graphGroupKey)
              : undefined
          }
          title={node.isGroup ? 'Click to find in graph' : undefined}
          className={`text-xs flex-1 ${
            node.isGroup && onHighlightGroup ? 'cursor-pointer hover:underline' : ''
          }`}
        >
          {node.label}
        </span>
        <span className="text-xs opacity-60">{count}</span>
      </div>

      {hasChildren && !isCollapsed && (
        <div>
          {node.children.map(child => (
            <GroupNodeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              collectionId={collectionId}
              variables={variables}
              selectedGroups={selectedGroups}
              onGroupToggle={onGroupToggle}
              selectedCollections={selectedCollections}
              onCollectionToggle={onCollectionToggle}
              collapsedGroups={collapsedGroups}
              setCollapsedGroups={setCollapsedGroups}
              highlightedGroupKey={highlightedGroupKey}
              onHighlightGroup={onHighlightGroup}
              forceExpanded={forceExpanded}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SidebarFilterProps {
  selectedModeId: string | null;
  onModeChange: (modeId: string) => void;
  selectedTypes?: Set<string>;
  onTypeToggle?: (type: string) => void;
  selectedCollections: Set<string>;
  onCollectionToggle: (collectionId: string) => void;
  selectedGroups?: Set<string>;
  onGroupToggle?: (groupName: string) => void;
  highlightedGroupKey?: string | null;
  onHighlightGroup?: (graphGroupKey: string) => void;
  showTypeFilters?: boolean;
  footer?: React.ReactNode;
}

export function SidebarFilter({
  selectedModeId,
  onModeChange,
  selectedTypes,
  onTypeToggle,
  selectedCollections,
  onCollectionToggle,
  selectedGroups,
  onGroupToggle,
  highlightedGroupKey,
  onHighlightGroup,
  showTypeFilters = true,
  footer,
}: SidebarFilterProps) {
  const { collections, variables } = useAppContext();
  const { openInputModal } = useModalContext();
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;
  const hasInitializedExpanded = React.useRef(false);

  // Sidebar width — draggable via the handle on the right edge, persisted across sessions.
  const SIDEBAR_MIN_WIDTH = 200;
  const SIDEBAR_MAX_WIDTH = 560;
  const SIDEBAR_WIDTH_STORAGE_KEY = 'sidebar-filter-width';
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const isResizingRef = React.useRef(false);
  const resizeStartRef = React.useRef({ x: 0, width: 256 });

  React.useEffect(() => {
    post({ type: 'get-client-storage', key: SIDEBAR_WIDTH_STORAGE_KEY });

    const handleStorage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (msg?.type === 'client-storage-data' && msg.key === SIDEBAR_WIDTH_STORAGE_KEY) {
        if (typeof msg.value === 'number') {
          setSidebarWidth(Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, msg.value)));
        }
      }
    };

    window.addEventListener('message', handleStorage);
    return () => window.removeEventListener('message', handleStorage);
  }, []);

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = e.clientX - resizeStartRef.current.x;
      const next = Math.min(
        SIDEBAR_MAX_WIDTH,
        Math.max(SIDEBAR_MIN_WIDTH, resizeStartRef.current.width + delta)
      );
      setSidebarWidth(next);
    };

    const handleMouseUp = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setSidebarWidth(current => {
        post({ type: 'set-client-storage', key: SIDEBAR_WIDTH_STORAGE_KEY, value: current });
        return current;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    resizeStartRef.current = { x: e.clientX, width: sidebarWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  // Auto-expand collections with groups when group filtering is enabled (only on first render)
  React.useEffect(() => {
    if (selectedGroups && onGroupToggle && !hasInitializedExpanded.current) {
      const collectionsWithGroups = new Set<string>();
      collections.forEach(collection => {
        const hasGroups = variables.some(v => {
          if (v.collectionId !== collection.id) return false;
          const parts = v.name.split('/');
          return parts.length > 1;
        });
        if (hasGroups) {
          collectionsWithGroups.add(collection.id);
        }
      });
      setExpandedCollections(collectionsWithGroups);
      hasInitializedExpanded.current = true;
    }
  }, [collections, variables, selectedGroups, onGroupToggle]);

  const handleAddCollection = () => {
    openInputModal({
      title: 'New Collection',
      label: 'Collection name',
      confirmText: 'Create',
      onConfirm: (name) => {
        post({ type: 'create-collection', name });
      },
    });
  };

  // Get unique types from variables
  const availableTypes = React.useMemo(() => {
    const types = new Set<string>();
    variables.forEach(v => types.add(v.resolvedType));
    return Array.from(types).sort();
  }, [variables]);

  // Extract groups from variables (grouped by collection)
  const groupsByCollection = React.useMemo(() => {
    const map = new Map<string, Set<string>>();
    variables.forEach(v => {
      const groupName = getVariableGroupName(v.name);
      if (groupName) {
        if (!map.has(v.collectionId)) {
          map.set(v.collectionId, new Set());
        }
        map.get(v.collectionId)!.add(groupName);
      }
    });
    return map;
  }, [variables]);

  // Get all modes from all collections
  const allModes = React.useMemo(() => {
    const modes: Array<{ modeId: string; name: string; collectionName: string }> = [];
    collections.forEach(collection => {
      collection.modes.forEach(mode => {
        modes.push({
          modeId: mode.modeId,
          name: mode.name,
          collectionName: collection.name,
        });
      });
    });
    return modes;
  }, [collections]);

  // Select all / deselect all for types
  const allTypesSelected = selectedTypes ? availableTypes.every(type => selectedTypes.has(type)) : false;
  const handleToggleAllTypes = () => {
    if (!selectedTypes || !onTypeToggle) return;
    if (allTypesSelected) {
      availableTypes.forEach(type => onTypeToggle(type));
    } else {
      availableTypes.forEach(type => {
        if (!selectedTypes.has(type)) onTypeToggle(type);
      });
    }
  };

  // All group keys across every collection (for tri-state / select-all)
  const allGroupKeys = React.useMemo(() => {
    const keys: string[] = [];
    groupsByCollection.forEach((groups, collectionId) => {
      groups.forEach(groupName => keys.push(getCollectionGroupKey(collectionId, groupName)));
    });
    return keys;
  }, [groupsByCollection]);

  // Select all / deselect all for collections (drives nested groups too)
  const allCollectionsSelected = collections.every(c => selectedCollections.has(c.id));
  const handleToggleAllCollections = () => {
    if (allCollectionsSelected) {
      collections.forEach(c => onCollectionToggle(c.id));
      if (selectedGroups && onGroupToggle) {
        allGroupKeys.forEach(key => {
          if (selectedGroups.has(key)) onGroupToggle(key);
        });
      }
    } else {
      collections.forEach(c => {
        if (!selectedCollections.has(c.id)) onCollectionToggle(c.id);
      });
      if (selectedGroups && onGroupToggle) {
        allGroupKeys.forEach(key => {
          if (!selectedGroups.has(key)) onGroupToggle(key);
        });
      }
    }
  };

  return (
    <div
      className="relative flex flex-col h-full border-r border-border bg-base shrink-0"
      style={{ width: sidebarWidth }}
    >
      {/* Mode Selector */}
      <div className="p-3 border-b border-border">
        <label className="block text-xs font-semibold mb-2">Mode</label>
        <select
          value={selectedModeId || ''}
          onChange={e => onModeChange(e.target.value)}
          className="w-full px-2 py-1.5 border border-border rounded bg-base text-text text-sm"
        >
          <option value="">All Modes</option>
          {allModes.map(mode => (
            <option key={mode.modeId} value={mode.modeId}>
              {mode.name} ({mode.collectionName})
            </option>
          ))}
        </select>
      </div>

      {/* Type Filters */}
      {showTypeFilters && selectedTypes && onTypeToggle && (
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold">Types</label>
            <TextButton onClick={handleToggleAllTypes} size="sm">
              {allTypesSelected ? 'Deselect All' : 'Select All'}
            </TextButton>
          </div>
          <div className="space-y-1">
            {availableTypes.map(type => (
              <label
                key={type}
                className="flex items-center gap-2 cursor-pointer hover:bg-base-2 px-2 py-1 rounded transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedTypes.has(type)}
                  onChange={() => onTypeToggle(type)}
                  className="w-4 h-4"
                />
                <span className="text-sm flex-1">{type}</span>
                <TypeIcon type={type} />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Collections Tree */}
      <div className="flex-1 p-3 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold">Collections</label>
          <TextButton onClick={handleToggleAllCollections} size="sm">
            {allCollectionsSelected ? 'Deselect All' : 'Select All'}
          </TextButton>
        </div>
        <Search
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search collections & groups..."
          className="mb-2"
          fullWidth
        />
        <div className="space-y-1 overflow-auto flex-1 min-h-0">
          {collections.map(collection => {
            const variableCount = variables.filter(v => v.collectionId === collection.id).length;
            const groups = groupsByCollection.get(collection.id);
            const hasGroups = groups && groups.size > 0;

            // While searching: only show groups that match by name, or that contain a
            // matching variable, and force the whole matched path open regardless of
            // manual collapse state.
            const visibleGroupNames = isSearching
              ? Array.from(groups ?? []).filter(groupName =>
                  groupName.toLowerCase().includes(normalizedQuery) ||
                  variables.some(v =>
                    v.collectionId === collection.id &&
                    v.name.startsWith(`${groupName}/`) &&
                    v.name.toLowerCase().includes(normalizedQuery)
                  )
                )
              : Array.from(groups ?? []);

            const collectionMatches =
              !isSearching ||
              collection.name.toLowerCase().includes(normalizedQuery) ||
              visibleGroupNames.length > 0 ||
              variables.some(v =>
                v.collectionId === collection.id &&
                !getVariableGroupName(v.name) &&
                v.name.toLowerCase().includes(normalizedQuery)
              );

            if (!collectionMatches) return null;

            const isExpanded = isSearching ? true : expandedCollections.has(collection.id);
            const collSelected = selectedCollections.has(collection.id);
            const canFilterGroups = !!hasGroups && !!selectedGroups && !!onGroupToggle;

            // Tri-state parent: derived from collection + its nested group checkboxes
            const groupKeys = canFilterGroups
              ? Array.from(groups!).map(g => getCollectionGroupKey(collection.id, g))
              : [];
            const allGroupsSelected =
              groupKeys.length > 0 && groupKeys.every(k => selectedGroups!.has(k));
            const parentChecked = canFilterGroups ? collSelected && allGroupsSelected : collSelected;
            const parentIndeterminate = canFilterGroups && collSelected && !allGroupsSelected;

            // One click: fully-on -> off (collection + all groups), otherwise -> on
            const handleParentToggle = () => {
              if (!canFilterGroups) {
                onCollectionToggle(collection.id);
                return;
              }
              if (parentChecked) {
                onCollectionToggle(collection.id);
                groupKeys.forEach(k => {
                  if (selectedGroups!.has(k)) onGroupToggle!(k);
                });
              } else {
                if (!collSelected) onCollectionToggle(collection.id);
                groupKeys.forEach(k => {
                  if (!selectedGroups!.has(k)) onGroupToggle!(k);
                });
              }
            };

            return (
              <div key={collection.id} className="space-y-0.5">
                {/* Collection checkbox */}
                <div className="flex items-center gap-2 hover:bg-base-2 px-2 py-1 rounded transition-colors">
                  {hasGroups && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedCollections(prev => {
                          const next = new Set(prev);
                          if (next.has(collection.id)) {
                            next.delete(collection.id);
                          } else {
                            next.add(collection.id);
                          }
                          return next;
                        });
                      }}
                      className="w-4 h-4 flex items-center justify-center text-text-muted hover:text-text transition-colors"
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                  )}
                  {!hasGroups && <div className="w-4" />}
                  <label className="flex items-center gap-2 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      ref={el => {
                        if (el) el.indeterminate = parentIndeterminate;
                      }}
                      checked={parentChecked}
                      onChange={handleParentToggle}
                      className="w-4 h-4"
                    />
                    <span className="text-sm flex-1">{collection.name}</span>
                    <span className="text-xs opacity-60">{variableCount}</span>
                  </label>
                </div>

                {/* Groups (nested, collapsible subgroups) */}
                {hasGroups && isExpanded && selectedGroups && onGroupToggle && (
                  <div className="ml-8 space-y-0.5">
                    {buildGroupTree(visibleGroupNames).map(node => (
                      <GroupNodeRow
                        key={node.path}
                        node={node}
                        depth={0}
                        collectionId={collection.id}
                        variables={variables}
                        selectedGroups={selectedGroups}
                        onGroupToggle={onGroupToggle}
                        selectedCollections={selectedCollections}
                        onCollectionToggle={onCollectionToggle}
                        collapsedGroups={collapsedGroups}
                        setCollapsedGroups={setCollapsedGroups}
                        highlightedGroupKey={highlightedGroupKey}
                        onHighlightGroup={onHighlightGroup}
                        forceExpanded={isSearching}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add Collection Button */}
        <div className="pt-3 mt-3 border-t border-border">
          <IconTextButton
            icon={<PlusIcon />}
            onClick={handleAddCollection}
            className="w-full justify-center"
            size="sm"
          >
            Add Collection
          </IconTextButton>
        </div>
      </div>

      {/* Optional footer (e.g. stats info) */}
      {footer && (
        <div className="p-3 border-t border-border">
          {footer}
        </div>
      )}

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-brand/50 active:bg-brand transition-colors z-10"
      />
    </div>
  );
}
