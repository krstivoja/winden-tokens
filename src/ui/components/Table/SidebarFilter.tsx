// Sidebar filter with mode selector, type filters, and collection tree

import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { TypeIcon, PlusIcon } from '../Icons';
import { TextButton, IconTextButton } from '../common/Button';
import { useModalContext } from '../Modals/ModalContext';
import { getCollectionGroupKey, getVariableGroupName } from '../../utils/groupFilters';
import { getGroupCardKey } from '../Relationships/GroupedGraph/utils';
import { resolveModeIdForCollection } from '../../utils/modes';
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

// Label props for a sidebar row that focuses its cards on the graph. Without
// `onFocusPath` (Table view) the label stays plain text. A disabled row (nothing
// of it visible on the canvas) is muted and out of the Tab order, and its click
// is swallowed so a collection label inside its <label> never ticks the checkbox.
function getFocusLabelProps(
  collectionId: string,
  path: string,
  onFocusPath?: (collectionId: string, path: string) => void,
  isPathFocusable?: (collectionId: string, path: string) => boolean
): { props: React.HTMLAttributes<HTMLSpanElement>; className: string } {
  if (!onFocusPath) return { props: {}, className: '' };

  if (isPathFocusable && !isPathFocusable(collectionId, path)) {
    return {
      props: {
        tabIndex: -1,
        'aria-disabled': true,
        title: 'Not shown in graph',
        onClick: (e) => {
          e.preventDefault();
          e.stopPropagation();
        },
      },
      className: 'text-text-secondary cursor-default',
    };
  }

  return {
    props: {
      role: 'button',
      tabIndex: 0,
      title: 'Click to find in graph',
      // preventDefault: inside the collection <label> the click would also
      // toggle the checkbox, and Space would scroll the tree.
      onClick: (e) => {
        e.preventDefault();
        e.stopPropagation();
        onFocusPath(collectionId, path);
      },
      onKeyDown: (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        e.stopPropagation();
        onFocusPath(collectionId, path);
      },
    },
    className:
      'cursor-pointer hover:underline rounded-sm focus-visible:outline-1 focus-visible:outline-text focus-visible:outline-offset-2',
  };
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
  focusedRowKey?: string | null;
  onFocusPath?: (collectionId: string, path: string) => void;
  isPathFocusable?: (collectionId: string, path: string) => boolean;
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
  focusedRowKey,
  onFocusPath,
  isPathFocusable,
  forceExpanded = false,
}: GroupNodeRowProps) {
  const nodeKey = `${collectionId}::${node.path}`;
  const hasChildren = node.children.length > 0;
  const isCollapsed = forceExpanded ? false : collapsedGroups.has(nodeKey);
  // Graph cards are keyed `group:<collectionId>::<groupName>`. Built through
  // the same helper the graph uses, so this sidebar row and the card it
  // highlights can never drift apart.
  const graphGroupKey = getGroupCardKey(collectionId, node.path);
  // Ringed when its card was clicked on the canvas, or when this row was the
  // last one focused from the sidebar (folder rows have no card of their own).
  const isHighlighted =
    (node.isGroup && highlightedGroupKey === graphGroupKey) || focusedRowKey === nodeKey;
  const focusLabel = getFocusLabelProps(collectionId, node.path, onFocusPath, isPathFocusable);

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
            className="w-4 h-4 flex items-center justify-center text-text-secondary hover:text-text transition-colors"
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
        <span {...focusLabel.props} className={`text-xs flex-1 ${focusLabel.className}`}>
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
              focusedRowKey={focusedRowKey}
              onFocusPath={onFocusPath}
              isPathFocusable={isPathFocusable}
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
  /** Focus the graph on every card under a row: `path` is '' for the
   *  collection row, otherwise the tree node's path ('badge', 'badge/color').
   *  Absent in views with no canvas, where labels stay plain text and the
   *  collection name keeps toggling its checkbox. */
  onFocusPath?: (collectionId: string, path: string) => void;
  /** False when nothing under the row is visible on the canvas: the label is
   *  then muted and inert. Absent = every row is focusable. */
  isPathFocusable?: (collectionId: string, path: string) => boolean;
  /** `${collectionId}::${path}` of the row last focused; that row is ringed. */
  focusedRowKey?: string | null;
  /** Fired once by "Select All" (never by "Deselect All"), after the
   *  per-collection and per-group toggles. The graph turns "Hide unused" off
   *  here; views without it get the plain toggles. */
  onSelectAllCollections?: () => void;
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
  onFocusPath,
  isPathFocusable,
  focusedRowKey,
  onSelectAllCollections,
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

  // Two-level mode picker: a collection tag opens that collection's mode
  // tags. `null` falls back to the collection owning the current mode.
  const [modePickerCollectionId, setModePickerCollectionId] = useState<string | null>(null);
  const modeOwnerCollectionId = React.useMemo(
    () => collections.find(c => c.modes.some(m => m.modeId === selectedModeId))?.id ?? null,
    [collections, selectedModeId]
  );
  const activePickerCollectionId =
    modePickerCollectionId ?? modeOwnerCollectionId ?? collections[0]?.id ?? null;
  const activePickerCollection = collections.find(c => c.id === activePickerCollectionId) || null;
  // Mode this collection would actually display: exact pick, or the
  // same-named cascade from a pick made under another collection.
  const activeResolvedModeId = activePickerCollection
    ? resolveModeIdForCollection(collections, activePickerCollection.id, selectedModeId)
    : null;

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
  // A group unticked under a ticked collection counts too: otherwise the
  // button reads "Deselect All" while cards are still hidden (Hide unused
  // unticks groups only, when every collection keeps a card on the path), and
  // "Select All" could never be reached.
  const allCollectionsSelected = collections.every(c => selectedCollections.has(c.id))
    && (!selectedGroups || allGroupKeys.every(key => selectedGroups.has(key)));
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
      onSelectAllCollections?.();
    }
  };

  return (
    <div
      className="relative flex flex-col h-full border-r border-border bg-base shrink-0"
      style={{ width: sidebarWidth }}
    >
      {/* Mode Selector — collection tags on top, that collection's mode
          tags below. Picking a mode cascades to same-named modes in other
          collections (see resolveModeIdForCollection). */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold">Mode</label>
          {selectedModeId && (
            <button
              type="button"
              className="text-[11px] text-text-secondary hover:text-text cursor-pointer bg-transparent border-none p-0"
              onClick={() => onModeChange('')}
            >
              Reset
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {collections.map(collection => {
            const isActive = collection.id === activePickerCollectionId;
            return (
              <button
                key={collection.id}
                type="button"
                className={`px-2 py-1 rounded text-xs font-medium border cursor-pointer transition-all ${
                  isActive
                    ? 'bg-selected text-on-selected border-selected'
                    : 'bg-base-2 text-text border-border hover:bg-base-3'
                }`}
                onClick={() => setModePickerCollectionId(collection.id)}
              >
                {collection.name}
              </button>
            );
          })}
        </div>
        {activePickerCollection && activePickerCollection.modes.length > 1 && (
          <div className="ml-2 mt-2 pt-3 border-t border-border">
            <label className="block text-[11px] font-semibold text-text-secondary mb-1.5">
              {activePickerCollection.name} modes
            </label>
            <div className="flex flex-wrap gap-1.5">
              {activePickerCollection.modes.map(mode => {
                // Binary state: solid = the mode this collection displays
                // right now (explicit pick, cascade, or default — same thing
                // from the user's point of view).
                const isActive = mode.modeId === activeResolvedModeId;
                return (
                  <button
                    key={mode.modeId}
                    type="button"
                    className={`px-2 py-1 rounded text-xs font-medium border cursor-pointer transition-all ${
                      isActive
                        ? 'bg-selected text-on-selected border-selected'
                        : 'bg-base-2 text-text border-border hover:bg-base-3'
                    }`}
                    onClick={() => onModeChange(mode.modeId)}
                  >
                    {mode.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
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

            const collectionLabel = getFocusLabelProps(collection.id, '', onFocusPath, isPathFocusable);
            const isCollectionFocused = focusedRowKey === `${collection.id}::`;

            return (
              <div key={collection.id} className="space-y-0.5">
                {/* Collection checkbox */}
                <div
                  className={`flex items-center gap-2 px-2 py-1 rounded transition-colors ${
                    isCollectionFocused ? 'bg-brand/10 ring-1 ring-brand' : 'hover:bg-base-2'
                  }`}
                >
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
                      className="w-4 h-4 flex items-center justify-center text-text-secondary hover:text-text transition-colors"
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
                    <span
                      {...collectionLabel.props}
                      className={`text-sm flex-1 ${collectionLabel.className}`}
                    >
                      {collection.name}
                    </span>
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
                        focusedRowKey={focusedRowKey}
                        onFocusPath={onFocusPath}
                        isPathFocusable={isPathFocusable}
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
