// Sidebar filter with mode selector, collection tree, and a type filter dropdown

import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { post } from '../../hooks/usePluginMessages';
import { TypeIcon, PlusIcon, FilterIcon } from '../Icons';
import { IconTextButton } from '../common/Button';
import { OptionsDropdown } from '../common/OptionsDropdown/OptionsDropdown';
import { useModalContext } from '../Modals/ModalContext';
import { compareGroupPaths, getCollectionGroupKey, getGroupKeysByCollection, getVariableGroupName } from '../../utils/groupFilters';
import {
  isRootMarked,
  isRowSelected,
  markId,
  ownMarkId,
  selectOnly,
  toggleMark,
  visibleMarks,
  type SidebarRow,
  type SidebarSelection,
  type SidebarUniverse,
} from '../../utils/sidebarSelection';
import { getGroupCardKey } from '../Relationships/GroupedGraph/utils';
import { resolveModeIdForCollection } from '../../utils/modes';
import { VariableData } from '../../types';
import { Search } from '../common/Search';
import { moveCollectionId } from '../../utils/collectionOrder';

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
      // Siblings share their parent path, so this is the label order; the
      // graph's Collection columns stack by the very same comparator.
      .sort((a, b) => compareGroupPaths(a.path, b.path))
      .map(n => ({ path: n.path, label: n.label, isGroup: n.isGroup, children: toArray(n.childrenMap) }));

  return toArray(rootMap);
}

// All real group keys (this node + every descendant) — used for select-all/collapse cascades.
function collectGroupKeys(node: GroupTreeNode, collectionId: string): string[] {
  const own = node.isGroup ? [getCollectionGroupKey(collectionId, node.path)] : [];
  return [...own, ...node.children.flatMap(child => collectGroupKeys(child, collectionId))];
}

// How one row was clicked: Cmd/Ctrl (or Enter/Space with it) adds to / removes
// from the selection, anything else selects only that row.
type RowActivation = { additive: boolean };
const isAdditive = (e: { metaKey: boolean; ctrlKey: boolean }): RowActivation => ({
  additive: e.metaKey || e.ctrlKey,
});

const SELECTED_ROW_CLASS = 'bg-primary/10 ring-1 ring-primary';
// A folder picked only for the variables it holds itself (its subgroups were
// Cmd/Ctrl-clicked out): dashed, so it does not read as the whole folder.
const OWN_SELECTED_ROW_CLASS = 'bg-primary/10 outline-1 outline-dashed outline-primary -outline-offset-1';
// A row under the clicked one: part of the selection, so a fill but no ring.
const DESCENDANT_ROW_CLASS = 'bg-primary/10';

interface TreeRowProps {
  label: string;
  count: number;
  variant: 'root' | 'collection' | 'group';
  /** Drives `aria-selected` and the selected fill. */
  selected: boolean;
  /** Selected only for the folder's own variables: dashed instead of the ring. */
  ownOnly?: boolean;
  /** Part of the selection only through an ancestor row: fill, no ring. */
  descendant?: boolean;
  /** Ringed like a selected row: its card is the one focused on the canvas. */
  highlighted?: boolean;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  expandLabel?: string;
  /** Nothing of this row is visible on the canvas: muted label. */
  muted?: boolean;
  title?: string;
  indent?: number;
  onActivate: (activation: RowActivation) => void;
  /** Collection rows only: the row can be dragged to reorder collections. */
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  /** This row is the one being dragged: dimmed. */
  dragging?: boolean;
  /** Alt+ArrowUp (-1) / Alt+ArrowDown (1) on the focused row. */
  onReorderKey?: (direction: -1 | 1) => void;
  /** Lets the parent find the row again (focus after a keyboard move). */
  dataCollectionId?: string;
}

// One selectable row of the tree (root, collection, group or folder). The
// chevron is its own button and never changes the selection.
function TreeRow({
  label,
  count,
  variant,
  selected,
  ownOnly = false,
  highlighted = false,
  descendant = false,
  expandable = false,
  expanded = false,
  onToggleExpand,
  expandLabel,
  muted = false,
  title,
  indent = 0,
  onActivate,
  draggable = false,
  onDragStart,
  onDragEnd,
  dragging = false,
  onReorderKey,
  dataCollectionId,
}: TreeRowProps) {
  const textClass =
    variant === 'root' ? 'text-sm font-semibold' : variant === 'collection' ? 'text-sm' : 'text-xs';
  return (
    <div
      role="treeitem"
      tabIndex={0}
      aria-selected={selected || descendant}
      aria-expanded={expandable ? expanded : undefined}
      title={title}
      data-collection-id={dataCollectionId}
      draggable={draggable || undefined}
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      onClick={e => onActivate(isAdditive(e))}
      onKeyDown={e => {
        if (onReorderKey && e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          // Would otherwise scroll the tree.
          e.preventDefault();
          onReorderKey(e.key === 'ArrowUp' ? -1 : 1);
          return;
        }
        if (e.key !== 'Enter' && e.key !== ' ') return;
        // Space would otherwise scroll the tree.
        e.preventDefault();
        onActivate(isAdditive(e));
      }}
      className={`flex items-center gap-2 px-2 py-1 rounded transition-colors cursor-pointer select-none focus-visible:outline-1 focus-visible:outline-solid focus-visible:outline-text focus-visible:outline-offset-2 ${
        highlighted || (selected && !ownOnly)
          ? SELECTED_ROW_CLASS
          : selected
            ? OWN_SELECTED_ROW_CLASS
            : descendant
            ? DESCENDANT_ROW_CLASS
            : 'hover:bg-base-2'
      }${dragging ? ' opacity-50' : ''}`}
      style={indent ? { marginLeft: indent } : undefined}
    >
      {expandable ? (
        <button
          type="button"
          aria-label={expandLabel}
          aria-expanded={expanded}
          onClick={e => {
            e.stopPropagation();
            onToggleExpand?.();
          }}
          onKeyDown={e => e.stopPropagation()}
          className="w-4 h-4 shrink-0 flex items-center justify-center text-text-secondary hover:text-text transition-colors"
        >
          {expanded ? '▼' : '▶'}
        </button>
      ) : (
        <div className="w-4 shrink-0" />
      )}
      <span className={`${textClass} flex-1 ${muted ? 'text-text-secondary' : ''}`}>{label}</span>
      <span className="text-xs opacity-60">{count}</span>
    </div>
  );
}

interface GroupNodeRowProps {
  node: GroupTreeNode;
  depth: number;
  collectionId: string;
  variables: VariableData[];
  selection: SidebarSelection;
  universe: SidebarUniverse;
  /** Marked rows (`markId`) that are shown: the rows the user clicked. */
  marks: ReadonlySet<string>;
  /** Some ancestor row (collection or group) is marked. */
  ancestorMarked: boolean;
  onActivate: (row: SidebarRow, activation: RowActivation, focusPath: string | null) => void;
  collapsedGroups: Set<string>;
  setCollapsedGroups: React.Dispatch<React.SetStateAction<Set<string>>>;
  highlightedGroupKey?: string | null;
  focusedRowKey?: string | null;
  canFocus: boolean;
  focusNoun: string;
  isPathFocusable?: (collectionId: string, path: string) => boolean;
  forceExpanded?: boolean;
}

function GroupNodeRow({
  node,
  depth,
  collectionId,
  variables,
  selection,
  universe,
  marks,
  ancestorMarked,
  onActivate,
  collapsedGroups,
  setCollapsedGroups,
  highlightedGroupKey,
  focusedRowKey,
  canFocus,
  focusNoun,
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
  // A highlight set from a sidebar row rings only that row: a folder whose
  // only card is this group must not ring the group too.
  const isFocusTarget =
    (!focusedRowKey && node.isGroup && highlightedGroupKey === graphGroupKey) || focusedRowKey === nodeKey;

  const count = variables.filter(
    v => v.collectionId === collectionId && v.name.startsWith(`${node.path}/`)
  ).length;

  const row = React.useMemo<SidebarRow>(
    () => ({ kind: 'group', collectionId, groupKeys: collectGroupKeys(node, collectionId) }),
    [node, collectionId]
  );
  // Only a row the user clicked gets the ring, never one that is merely
  // visible or covers the same variables; rows under it just a fill. An own
  // mark rings the folder for the variables it holds itself, without the fill
  // below it.
  const wholeMarked = marks.has(nodeKey);
  const ownOnly = !wholeMarked && marks.has(ownMarkId(collectionId, node.path));
  const selected = wholeMarked || ownOnly;
  // No focus ring on a row whose variables are no longer selected (e.g. it
  // was Cmd/Ctrl-clicked out of the selection after being focused), nor a
  // sidebar focus ring inside a ringed folder (no rings inside rings).
  const sidebarFocusUnderRing = focusedRowKey === nodeKey && ancestorMarked;
  const isHighlighted = isFocusTarget && !sidebarFocusUnderRing && isRowSelected(selection, row, universe);
  const muted = canFocus && !!isPathFocusable && !isPathFocusable(collectionId, node.path);

  return (
    <div className="space-y-0.5">
      <TreeRow
        variant="group"
        label={node.label}
        count={count}
        selected={selected}
        ownOnly={ownOnly}
        descendant={!selected && ancestorMarked}
        highlighted={isHighlighted}
        indent={depth * 16}
        expandable={hasChildren}
        expanded={!isCollapsed}
        expandLabel={`${isCollapsed ? 'Expand' : 'Collapse'} ${node.label}`}
        onToggleExpand={() =>
          setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(nodeKey)) {
              next.delete(nodeKey);
            } else {
              next.add(nodeKey);
            }
            return next;
          })
        }
        muted={muted}
        title={canFocus ? (muted ? 'Not shown in graph' : `Click to select and find in ${focusNoun}`) : undefined}
        onActivate={activation => onActivate(row, activation, node.path)}
      />

      {hasChildren && !isCollapsed && (
        <div>
          {node.children.map(child => (
            <GroupNodeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              collectionId={collectionId}
              variables={variables}
              selection={selection}
              universe={universe}
              marks={marks}
              ancestorMarked={ancestorMarked || wholeMarked}
              onActivate={onActivate}
              collapsedGroups={collapsedGroups}
              setCollapsedGroups={setCollapsedGroups}
              highlightedGroupKey={highlightedGroupKey}
              focusedRowKey={focusedRowKey}
              canFocus={canFocus}
              focusNoun={focusNoun}
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
  selectedGroups: Set<string>;
  /** Fired once per row click with the whole next selection (both sets), so a
   *  click is one atomic write. Plain click selects only that row (root =
   *  everything), Cmd/Ctrl-click toggles it. Never fired for a click that
   *  would empty the selection. */
  onSelectionChange: (next: SidebarSelection) => void;
  highlightedGroupKey?: string | null;
  /** Focus the graph on every card under a row: `path` is '' for the
   *  collection row, otherwise the tree node's path ('badge', 'badge/color').
   *  A plain row click selects, then calls this. Absent in views with no
   *  canvas, where a click only selects. */
  onFocusPath?: (collectionId: string, path: string) => void;
  /** What a click finds the row in, for the tooltip ('graph' or 'table'). */
  focusNoun?: string;
  /** False when nothing under the row is visible on the canvas: the label is
   *  then muted (a click still selects it, which may bring it back). Absent =
   *  every row is focusable. */
  isPathFocusable?: (collectionId: string, path: string) => boolean;
  /** `${collectionId}::${path}` of the row last focused; that row is ringed. */
  focusedRowKey?: string | null;
  /** Fired by a click on "All variables", after `onSelectionChange`. The graph
   *  turns "Hide unused" off here. */
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
  selectedGroups,
  onSelectionChange,
  highlightedGroupKey,
  onFocusPath,
  focusNoun = 'graph',
  isPathFocusable,
  focusedRowKey,
  onSelectAllCollections,
  showTypeFilters = true,
  footer,
}: SidebarFilterProps) {
  const { collections, variables, reorderCollections, sidebarMarks, setSidebarMarks } = useAppContext();
  const { openInputModal } = useModalContext();
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [rootExpanded, setRootExpanded] = useState(true);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;
  const hasInitializedExpanded = React.useRef(false);

  // Collection reorder (drag a collection row, or Alt+ArrowUp/Down on it).
  // Off while searching: the visible rows are not the whole order.
  const canReorder = collections.length >= 2 && !isSearching;
  const [draggedCollectionId, setDraggedCollectionId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: 'before' | 'after' } | null>(null);
  const [reorderAnnouncement, setReorderAnnouncement] = useState('');
  // The browser may follow a drag with a click on the source row: ignore it.
  const suppressClickRef = React.useRef(false);
  const treeRef = React.useRef<HTMLDivElement>(null);
  const pendingFocusIdRef = React.useRef<string | null>(null);

  const collectionIds = React.useMemo(() => collections.map(c => c.id), [collections]);
  const sameOrder = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

  const clearDrag = () => {
    setDraggedCollectionId(null);
    setDropTarget(null);
  };

  const handleCollectionDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      // Firefox only starts a drag that carries data.
      e.dataTransfer.setData('text/plain', id);
    }
    setDraggedCollectionId(id);
  };

  const handleCollectionDragEnd = () => {
    clearDrag();
    suppressClickRef.current = true;
    requestAnimationFrame(() => {
      suppressClickRef.current = false;
    });
  };

  // Before/after by the collection row's vertical midpoint; the block's
  // expanded groups sit below it, so they count as "after".
  const dropPositionOf = (e: React.DragEvent<HTMLDivElement>): 'before' | 'after' => {
    const row = e.currentTarget.querySelector('[role="treeitem"]') ?? e.currentTarget;
    const rect = row.getBoundingClientRect();
    return e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  };

  const handleBlockDragOver = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    // Only collection drags started here (not OS files or text).
    if (!draggedCollectionId) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const position = dropPositionOf(e);
    const changes = !sameOrder(moveCollectionId(collectionIds, draggedCollectionId, targetId, position), collectionIds);
    const next = changes ? { id: targetId, position } : null;
    setDropTarget(prev =>
      prev?.id === next?.id && prev?.position === next?.position ? prev : next
    );
  };

  const handleBlockDragLeave = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    setDropTarget(prev => (prev?.id === targetId ? null : prev));
  };

  const handleBlockDrop = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    if (!draggedCollectionId) return;
    e.preventDefault();
    const next = moveCollectionId(collectionIds, draggedCollectionId, targetId, dropPositionOf(e));
    clearDrag();
    if (!sameOrder(next, collectionIds)) reorderCollections(next);
  };

  const handleReorderKey = (id: string, direction: -1 | 1) => {
    const index = collectionIds.indexOf(id);
    const neighbor = collectionIds[index + direction];
    if (index === -1 || !neighbor) return;
    const next = moveCollectionId(collectionIds, id, neighbor, direction === -1 ? 'before' : 'after');
    if (sameOrder(next, collectionIds)) return;
    const name = collections[index].name;
    pendingFocusIdRef.current = id;
    reorderCollections(next);
    setReorderAnnouncement(`Moved ${name} to position ${next.indexOf(id) + 1} of ${next.length}`);
  };

  // A moved DOM node can lose focus: put it back on the row moved by keyboard.
  React.useLayoutEffect(() => {
    const id = pendingFocusIdRef.current;
    if (!id) return;
    pendingFocusIdRef.current = null;
    const row = Array.from(
      treeRef.current?.querySelectorAll<HTMLElement>('[data-collection-id]') ?? []
    ).find(el => el.dataset.collectionId === id);
    if (row && document.activeElement !== row) row.focus();
  }, [collections]);

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

  // Auto-expand collections with groups (only on first render)
  React.useEffect(() => {
    if (!hasInitializedExpanded.current) {
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
  }, [collections, variables]);

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

  // The filter trigger shows a dot while some available type is unticked.
  const hasTypeFilter = showTypeFilters && !!selectedTypes && !!onTypeToggle && availableTypes.length > 0;
  const typesFiltered = hasTypeFilter && availableTypes.some(type => !selectedTypes!.has(type));

  // What a row click can select: every collection and its group keys.
  const universe = React.useMemo<SidebarUniverse>(
    () => ({
      collectionIds: collections.map(c => c.id),
      groupKeysByCollection: getGroupKeysByCollection(variables),
    }),
    [collections, variables]
  );
  const selection = React.useMemo<SidebarSelection>(
    () => ({ collections: selectedCollections, groups: selectedGroups }),
    [selectedCollections, selectedGroups]
  );
  // Rows the user clicked (plain or Cmd/Ctrl), ringed only while the row
  // still exists and is fully selected: a selection changed elsewhere (Hide
  // unused, Show all, plugin undo) never rings a row that is not shown.
  const marks = React.useMemo(
    () => visibleMarks(sidebarMarks, selection, universe),
    [sidebarMarks, selection, universe]
  );
  const rootMarked = collections.length > 0 && isRootMarked(selection, universe, marks);

  // Plain click: select only the row, mark it, then find it in the graph.
  // Cmd/Ctrl: toggle it in the selection and the marks and leave the camera
  // alone. "All variables" always means everything and clears every mark.
  const handleRowActivate = (
    row: SidebarRow,
    { additive }: RowActivation,
    focus: { collectionId: string; path: string } | null
  ) => {
    if (row.kind === 'root') {
      setSidebarMarks(new Set());
      onSelectionChange(selectOnly(row, universe));
      onSelectAllCollections?.();
      return;
    }
    const id = markId(row.collectionId, focus?.path ?? '');
    if (additive) {
      // A collection mark never filters; a group one narrows its collection.
      const next = toggleMark(selection, sidebarMarks, id, universe);
      if (!next) return;
      setSidebarMarks(next.marks);
      if (next.selection !== selection) onSelectionChange(next.selection);
      return;
    }
    // A collection row never filters: it clears every narrowing.
    setSidebarMarks(new Set([id]));
    onSelectionChange(selectOnly(row, universe));
    if (row.kind === 'collection') onSelectAllCollections?.();
    if (focus) onFocusPath?.(focus.collectionId, focus.path);
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

      {/* Collections Tree */}
      <div className="flex-1 p-3 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold">Collections</label>
          {hasTypeFilter && (
            <OptionsDropdown
              label="Filter by type"
              icon={<FilterIcon />}
              align="right"
              indicator={typesFiltered}
            >
              <div className="text-xs font-semibold mb-1 px-2">Types</div>
              <div className="space-y-1">
                {availableTypes.map(type => (
                  <label
                    key={type}
                    className="flex items-center gap-2 cursor-pointer hover:bg-base-2 px-2 py-1 rounded transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTypes!.has(type)}
                      onChange={() => onTypeToggle!(type)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm flex-1">{type}</span>
                    <TypeIcon type={type} />
                  </label>
                ))}
              </div>
            </OptionsDropdown>
          )}
        </div>
        <Search
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search collections & groups..."
          className="mb-2"
          fullWidth
        />
        <div ref={treeRef} role="tree" aria-multiselectable className="space-y-1 overflow-auto flex-1 min-h-0">
          {collections.length > 0 && (
            <TreeRow
              variant="root"
              label="All variables"
              count={variables.length}
              selected={rootMarked}
              expandable
              expanded={rootExpanded || isSearching}
              expandLabel={rootExpanded || isSearching ? 'Collapse all variables' : 'Expand all variables'}
              onToggleExpand={() => setRootExpanded(prev => !prev)}
              onActivate={() => handleRowActivate({ kind: 'root' }, { additive: false }, null)}
            />
          )}
          {(rootExpanded || isSearching) && (
          <div className="ml-4 space-y-1">
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
            const collectionRow: SidebarRow = { kind: 'collection', collectionId: collection.id };
            const collectionSelected = marks.has(markId(collection.id));
            const collectionMuted = !!onFocusPath && !!isPathFocusable && !isPathFocusable(collection.id, '');

            const indicator = dropTarget?.id === collection.id ? dropTarget.position : null;
            const focusTitle = onFocusPath
              ? collectionMuted
                ? 'Not shown in graph'
                : `Click to select and find in ${focusNoun}`
              : undefined;
            const reorderTitle = canReorder ? 'Drag or Alt+↑/↓ to reorder' : undefined;

            return (
              <div
                key={collection.id}
                className="relative space-y-0.5"
                onDragOver={canReorder ? e => handleBlockDragOver(e, collection.id) : undefined}
                onDragLeave={canReorder ? e => handleBlockDragLeave(e, collection.id) : undefined}
                onDrop={canReorder ? e => handleBlockDrop(e, collection.id) : undefined}
              >
                {indicator && (
                  // Centred in the 4px gap between collection blocks; `my-0`
                  // beats the block's `space-y-0.5` margin on this first child.
                  <span
                    aria-hidden
                    className={`pointer-events-none absolute left-0 right-0 my-0 h-0.5 rounded-full bg-primary ${
                      indicator === 'before' ? '-top-[3px]' : '-bottom-[3px]'
                    }`}
                  />
                )}
                <TreeRow
                  variant="collection"
                  label={collection.name}
                  count={variableCount}
                  selected={collectionSelected}
                  highlighted={focusedRowKey === markId(collection.id) && selection.collections.has(collection.id)}
                  expandable={!!hasGroups}
                  expanded={isExpanded}
                  expandLabel={`${isExpanded ? 'Collapse' : 'Expand'} ${collection.name}`}
                  onToggleExpand={() =>
                    setExpandedCollections(prev => {
                      const next = new Set(prev);
                      if (next.has(collection.id)) {
                        next.delete(collection.id);
                      } else {
                        next.add(collection.id);
                      }
                      return next;
                    })
                  }
                  muted={collectionMuted}
                  title={[focusTitle, reorderTitle].filter(Boolean).join(' · ') || undefined}
                  onActivate={activation => {
                    if (suppressClickRef.current) return;
                    handleRowActivate(collectionRow, activation, { collectionId: collection.id, path: '' });
                  }}
                  dataCollectionId={collection.id}
                  draggable={canReorder}
                  dragging={draggedCollectionId === collection.id}
                  onDragStart={e => handleCollectionDragStart(e, collection.id)}
                  onDragEnd={handleCollectionDragEnd}
                  onReorderKey={canReorder ? direction => handleReorderKey(collection.id, direction) : undefined}
                />

                {/* Groups (nested, collapsible subgroups) */}
                {hasGroups && isExpanded && (
                  <div className="ml-8 space-y-0.5">
                    {buildGroupTree(visibleGroupNames).map(node => (
                      <GroupNodeRow
                        key={node.path}
                        node={node}
                        depth={0}
                        collectionId={collection.id}
                        variables={variables}
                        selection={selection}
                        universe={universe}
                        marks={marks}
                        ancestorMarked={collectionSelected}
                        onActivate={(row, activation, path) =>
                          handleRowActivate(row, activation, path === null ? null : { collectionId: collection.id, path })
                        }
                        collapsedGroups={collapsedGroups}
                        setCollapsedGroups={setCollapsedGroups}
                        highlightedGroupKey={highlightedGroupKey}
                        focusedRowKey={focusedRowKey}
                        canFocus={!!onFocusPath}
                        focusNoun={focusNoun}
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
          )}
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

      <div aria-live="polite" className="sr-only">
        {reorderAnnouncement}
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary transition-colors z-10"
      />
    </div>
  );
}
