// GraphNode component - Custom node for displaying variable groups
//
// The header row, the header actions and the variable rows are exported
// separately because a CONTAINER draws exactly the same three things (see
// GraphWrapperNode). A container IS a card — same header, same rows, same
// actions — and only its outline differs, so there is one copy of each.

import React from 'react';
import { Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import { Icon } from '../../icons/Icon';
import { IconButton } from '../../common/Button/IconButton/IconButton';
import { Dropdown } from '../../common/Dropdown/Dropdown';
import { ColorSwatch } from '../../common/ColorSwatch/ColorSwatch';
import { GroupNodeData } from './types';
import { GraphHandle } from './GraphHandle';
import { getCardTitleSegments, getGroupHeight, isStructurallyEqual } from './utils';
import {
  GENERATED_CONNECTION_COLOR,
  REFERENCE_CONNECTION_COLOR,
  IDLE_HANDLE_FILL_COLOR,
  IDLE_HANDLE_BORDER_COLOR,
} from './constants';

/**
 * The header bar: the title, and whatever actions the caller puts on the
 * right. The drag handle (`.group-header`) lives here, so a card and a
 * container are dragged by exactly the same strip.
 */
export function CardHeaderRow({
  title,
  segments,
  headerFill,
  draggable = true,
  className = '',
  children,
}: {
  /** Full title: the tooltip, and the label when no segments are given. */
  title: string;
  /** Breadcrumb parts (`font › size › body`); one part renders as plain text. */
  segments?: string[];
  headerFill: string;
  /** False on a frozen card (inside a frame): no move cursor, nothing promises a drag. */
  draggable?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const parts = segments && segments.length > 0 ? segments : [title];
  const last = parts.length - 1;
  return (
    <div
      className={`group-header flex items-center justify-between gap-1 px-3 ${draggable ? 'cursor-move' : ''} select-none h-9 ${className}`}
      style={{ background: headerFill }}
    >
      <span
        className="flex min-w-0 flex-1 items-center overflow-hidden whitespace-nowrap text-[13px]"
        title={title}
        data-testid="card-title"
      >
        {parts.map((part, index) => (
          <React.Fragment key={index}>
            {index > 0 && (
              <span className="shrink-0 px-0.5 text-text/40 leading-0" data-testid="card-title-separator">
                <Icon name="chevron-right" size={12} />
              </span>
            )}
            <span
              className={`overflow-hidden text-ellipsis ${
                index === last
                  ? 'min-w-[3ch] shrink-[3] font-semibold text-text'
                  : 'min-w-0 shrink font-normal text-text/60'
              }`}
              data-testid={index === last ? 'card-title-leaf' : 'card-title-ancestor'}
            >
              {part}
            </span>
          </React.Fragment>
        ))}
      </span>
      <div className="flex shrink-0 gap-1 items-center">{children}</div>
    </div>
  );
}

/** Everything the header actions read from a card's data — and so all a
 *  re-render of them is compared on (see CardHeaderActions below). Typed as
 *  a Pick, so reading any other field is a type error, not a stale header. */
const HEADER_ACTION_FIELDS = [
  'group', 'inFrame', 'isHidingUnused', 'onHighlightPath', 'onHideUnused', 'onAddVariable',
  'onRenameGroup', 'onDuplicateGroup', 'onEditAsText', 'onLevelUp', 'onDeleteGroup',
] as const;
type HeaderActionData = Pick<GroupNodeData, typeof HEADER_ACTION_FIELDS[number]>;

/**
 * The header actions of a card: level up, add variable, and the actions
 * dropdown. A container renders these for the card it absorbed, with
 * `showLevelUp={false}` — the container offers the level-up itself (it has
 * one even when it absorbed no card at all), and two buttons firing the same
 * `onLevelUp(collectionId, path)` would just be the old duplication again.
 */
function CardHeaderActionsInner({
  data,
  showLevelUp = true,
}: {
  data: HeaderActionData;
  showLevelUp?: boolean;
}) {
  const {
    group,
    onHighlightPath,
    onHideUnused,
    isHidingUnused,
    onAddVariable,
    onRenameGroup,
    onDuplicateGroup,
    onEditAsText,
    onLevelUp,
    onDeleteGroup,
  } = data;

  const canManageGroupVariables = group.kind === 'standard';
  // The collection's root card. Its header carries the "+" and nothing else:
  // every dropdown action (rename, duplicate, edit as text, delete) and the
  // level-up button address a GROUP PATH, and a collection root has none —
  // renaming or deleting one would mean renaming or deleting the collection,
  // which is not what those messages do.
  //
  // Its ROWS, however, are ordinary variables, so they get the ordinary row
  // controls (rename, delete) — see canRenameVariable/showDeleteAction in
  // CardRows below. Those address a variable id and work here unchanged.
  const isCollectionCard = group.kind === 'collection';

  if (isCollectionCard) {
    return (
      <IconButton
        icon={<Icon name="plus" size={20} />}
        size="sm"
        variant="ghost"
        aria-label={`Add variable to ${group.title}`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onAddVariable(group); }}
      />
    );
  }

  if (!canManageGroupVariables) return null;

  return (
    <>
      {showLevelUp && !data.inFrame && group.canGroup && group.sourceGroupName && (
        <IconButton
          icon={<Icon name="collapse-all" size={18} />}
          size="sm"
          variant="ghost"
          aria-label={`Group ${group.title} with its siblings`}
          title="Group with siblings (level up)"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onLevelUp(group.collectionId, group.sourceGroupName!); }}
        />
      )}
      <IconButton
        icon={<Icon name="plus" size={20} />}
        size="sm"
        variant="ghost"
        aria-label={`Add variable to ${group.title}`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onAddVariable(group); }}
      />
      <Dropdown position="bottom-right">
        <Dropdown.Trigger asChild>
          <IconButton
            icon={<Icon name="menu" size={20} />}
            size="sm"
            variant="ghost"
            aria-label={`Open actions for ${group.title}`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          />
        </Dropdown.Trigger>
        <Dropdown.Menu>
          <Dropdown.Item onClick={() => onHighlightPath(group)}>
            Highlight path
          </Dropdown.Item>
          <Dropdown.Item onClick={() => onRenameGroup(group)}>
            Rename
          </Dropdown.Item>
          <Dropdown.Item onClick={() => onDuplicateGroup(group)}>
            Duplicate
          </Dropdown.Item>
          <Dropdown.Item onClick={() => onEditAsText(group)}>
            Edit as Text
          </Dropdown.Item>
          <Dropdown.Divider />
          <Dropdown.Item onClick={() => onHideUnused(group)}>
            {isHidingUnused ? 'Show all' : 'Hide unused'}
          </Dropdown.Item>
          <Dropdown.Item onClick={() => onDeleteGroup(group)} className="text-danger hover:bg-danger hover:text-white">
            Delete
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    </>
  );
}

// A highlight dims or un-dims every card without changing what its header
// actions show, so they compare on their own fields only (Hide unused does
// re-render them: `isHidingUnused` picks the menu label).
export const CardHeaderActions = React.memo(CardHeaderActionsInner, (prev, next) => (
  prev.showLevelUp === next.showLevelUp
  && HEADER_ACTION_FIELDS.every(key => isStructurallyEqual(prev.data[key], next.data[key]))
));

/**
 * The variable rows, with their connection handles. Identical on a card and
 * on a container: the rows a container shows are the rows of the card it
 * absorbed, and their handles are what the reference edges attach to.
 *
 * `showEmptyState` is off in a container: the empty-root line is true of a
 * row-less collection CARD, but noise on a container that holds children.
 *
 * `keepLastBorder` restores the bottom border of the LAST row. On a card the
 * last row is the last thing in the box, so its separator is suppressed; in a
 * container the child cards follow it, and without the line the rows and the
 * children read as one undifferentiated stack.
 */
export function CardRows({
  data,
  showEmptyState = true,
  keepLastBorder = false,
}: {
  data: GroupNodeData;
  showEmptyState?: boolean;
  keepLastBorder?: boolean;
}) {
  // Row-level highlight only applies inside a card that is itself on the
  // highlighted chain; everywhere else the rows look the same whatever is
  // highlighted. Passing the highlight props only in that case lets the
  // memoized rows (and their ~2 handles each) skip re-rendering when a
  // highlight merely dims or un-dims the card as a whole.
  const rowsHighlighted = !!(data.highlightActive && data.isHighlighted);
  return (
    <CardRowsList
      group={data.group}
      connectedVars={data.connectedVars}
      rowsHighlighted={rowsHighlighted}
      highlightedVars={rowsHighlighted ? data.highlightedVars : undefined}
      highlightedVarSeed={rowsHighlighted ? data.highlightedVarSeed ?? null : null}
      onHighlightVariable={data.onHighlightVariable}
      onGeneratorOpen={data.onGeneratorOpen}
      onShowColorMenu={data.onShowColorMenu}
      onRenameVariable={data.onRenameVariable}
      onDeleteVariable={data.onDeleteVariable}
      showEmptyState={showEmptyState}
      keepLastBorder={keepLastBorder}
    />
  );
}

type CardRowsListProps = Pick<GroupNodeData,
  'group' | 'connectedVars' | 'onHighlightVariable' | 'onGeneratorOpen'
  | 'onShowColorMenu' | 'onRenameVariable' | 'onDeleteVariable'> & {
  rowsHighlighted: boolean;
  highlightedVars: Set<string> | undefined;
  highlightedVarSeed: string | null;
  showEmptyState: boolean;
  keepLastBorder: boolean;
};

/**
 * Rows re-render only when something they draw changed. Compared by content,
 * not identity: the layout effect rebuilds each card's `connectedVars` /
 * `highlightedVars` (cut down to the card's own rows) on every pass, so a
 * card that is merely dimmed or un-dimmed hands over equal but new
 * collections. Callbacks still compare by identity.
 */
const areCardRowsPropsEqual = (prev: CardRowsListProps, next: CardRowsListProps) => {
  const cache = new WeakMap<object, WeakSet<object>>();
  return (Object.keys(next) as Array<keyof CardRowsListProps>)
    .every(key => isStructurallyEqual(prev[key], next[key], cache));
};

const CardRowsList = React.memo(function CardRowsList({
  group,
  connectedVars,
  rowsHighlighted,
  highlightedVars,
  highlightedVarSeed,
  onHighlightVariable,
  onGeneratorOpen,
  onShowColorMenu,
  onRenameVariable,
  onDeleteVariable,
  showEmptyState,
  keepLastBorder,
}: CardRowsListProps) {
  const isCollectionCard = group.kind === 'collection';
  // True when the row-level highlight seed lives in THIS card — its sibling
  // rows get a faded highlight marker to show group membership.
  const seedInCard = !!highlightedVarSeed && group.variables.some(v => v.name === highlightedVarSeed);

  // Nothing to draw: a container whose absorbed card has no rows must not
  // contribute a padded strip — and so no stray line — above its children.
  const showEmptyLine = showEmptyState && isCollectionCard && group.variables.length === 0;
  if (group.variables.length === 0 && !showEmptyLine) return null;

  return (
    <div className="bg-base py-2">
      {showEmptyLine && (
        <div className="flex items-center justify-center h-8 px-2 text-xs text-text-secondary select-none">
          {/* Not "no variables": since every collection gets a root card, a
              collection with 116 variables — all of them grouped — lands here
              too. What is actually empty is the collection's ROOT. */}
          No variables at the collection root
        </div>
      )}
      {group.variables.map((node) => {
        const flags = connectedVars.get(node.name);
        const hasInput = flags?.hasInput || false;
        const hasOutput = flags?.hasOutput || false;
        const inputColor = flags?.inputKind === 'generated' ? GENERATED_CONNECTION_COLOR : REFERENCE_CONNECTION_COLOR;
        const outputColor = flags?.outputKind === 'generated' ? GENERATED_CONNECTION_COLOR : REFERENCE_CONNECTION_COLOR;
        const rowInteractive = group.kind === 'shader' && node.virtualType === 'shader';
        const canRenameVariable = !node.isVirtual
          && (group.kind === 'standard' || group.kind === 'source' || isCollectionCard);
        const showDeleteAction = (group.kind === 'standard' || isCollectionCard) && !node.isVirtual;
        const showOutputHandle = !node.connectionsDisabled || node.virtualType === 'shader';
        // Dim off-chain rows only within a card that's on the chain; fully
        // off-chain cards are already dimmed as a whole.
        const rowDimmed = rowsHighlighted && !highlightedVars?.has(node.name);
        const isSeedRow = rowsHighlighted && highlightedVarSeed === node.name;
        const isSiblingRow = rowDimmed && seedInCard;

        return (
          <div
            key={node.id}
            className={`group relative flex items-center px-2 h-8 border-b border-border ${keepLastBorder ? '' : 'last:border-b-0'} bg-base hover:bg-base-2 transition-[background,opacity] duration-150 cursor-pointer ${rowInteractive ? 'bg-gradient-to-r from-base via-base-2 to-base hover:bg-base-3' : ''} ${isSiblingRow ? 'opacity-45 shadow-[inset_2px_0_0_color-mix(in_oklab,var(--color-highlight-path)_45%,transparent)]' : rowDimmed ? 'opacity-30' : ''} ${isSeedRow ? 'bg-base-2 shadow-[inset_2px_0_0_var(--color-highlight-path)]' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (rowInteractive) onGeneratorOpen(group, node);
              else onHighlightVariable(group, node);
            }}
          >
            {/* Left handle (target) */}
            <GraphHandle
              type="target"
              position={Position.Left}
              id={`${node.name}::in`}
              isConnected={hasInput}
              isDisabled={node.connectionsDisabled}
              isConnectable={!node.connectionsDisabled}
              connectionColor={inputColor}
              idleColor={IDLE_HANDLE_FILL_COLOR}
              idleBorderColor={IDLE_HANDLE_BORDER_COLOR}
            />

            {/* Color swatch */}
            {node.resolvedType === 'COLOR' && !node.isVirtual && (
              <div className="absolute left-3.5">
                <ColorSwatch
                  color={node.color}
                  onClick={(e) => { e.stopPropagation(); onShowColorMenu(e, node); }}
                  className="w-4.5 h-4.5 transition-all duration-150 hover:scale-115 hover:shadow-[0_2px_6px_rgba(0,0,0,0.2)]"
                  title="Edit color"
                />
              </div>
            )}

            {/* Virtual badge */}
            {node.isVirtual && (
              <span className={`absolute left-3.5 w-7 h-4.5 flex items-center justify-center rounded text-[10px] font-semibold uppercase border ${node.virtualType === 'shader' ? 'bg-secondary text-white border-secondary' : 'bg-primary text-white border-primary'}`}>
                {node.virtualType === 'shader' ? 'fx' : 'out'}
              </span>
            )}

            {/* Name */}
            <span
              className={`absolute text-xs font-medium text-text overflow-hidden text-ellipsis whitespace-nowrap max-w-30 ${canRenameVariable ? 'cursor-pointer hover:text-primary' : ''}`}
              style={{ left: node.isVirtual ? 52 : (node.resolvedType === 'COLOR' ? 42 : 14) }}
              onDoubleClick={canRenameVariable ? (e) => {
                e.stopPropagation();
                onRenameVariable(node);
              } : undefined}
              title={canRenameVariable ? `${node.name} (double-click to rename)` : node.name}
            >
              {node.shortName}
            </span>

            {/* Value */}
            <span
              className="absolute text-[11px] font-mono overflow-hidden text-ellipsis whitespace-nowrap max-w-25 text-text-secondary"
              style={{ right: showDeleteAction ? 42 : 16 }}
              title={node.displayName}
            >
              {node.displayName}
            </span>

            {/* Delete button */}
            {showDeleteAction && (
              <button
                type="button"
                className="absolute right-3.5 w-5 h-5 flex items-center justify-center rounded border border-transparent bg-transparent cursor-pointer text-[16px] text-text opacity-0 group-hover:opacity-50 hover:opacity-100! hover:bg-danger hover:text-white hover:border-danger transition-all duration-150"
                onClick={(e) => { e.stopPropagation(); onDeleteVariable(node); }}
              >
                &times;
              </button>
            )}

            {/* Right handle (source) */}
            {showOutputHandle && (
              <GraphHandle
                type="source"
                position={Position.Right}
                id={`${node.name}::out`}
                isConnected={hasOutput}
                isDisabled={node.connectionsDisabled}
                isConnectable={!node.connectionsDisabled}
                connectionColor={outputColor}
                idleColor={IDLE_HANDLE_FILL_COLOR}
                idleBorderColor={IDLE_HANDLE_BORDER_COLOR}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}, areCardRowsPropsEqual);

function GroupNodeComponentInner({ data }: NodeProps<Node<GroupNodeData>>) {
  const { group, isHighlighted, isDimmed } = data;

  // The layout's estimate of this card's height. `h-fit!` lets the markup
  // win, so this only seeds the box; getGroupHeight matches the drawn height.
  const height = getGroupHeight(group);

  return (
    <div
      className={`rf-group-box ${group.kind === 'shader' ? 'border-secondary' : 'border-text/40'} border rounded-sm bg-base h-fit! shadow-xs w-65 p-0.5 ${group.kind} transition-[opacity,box-shadow] duration-150 ${isDimmed ? 'opacity-55' : ''} ${isHighlighted ? 'ring-1 ring-highlight-path ring-offset-2 ring-offset-canvas' : ''}`}
      style={{ height }}
    >
      <CardHeaderRow
        title={group.title}
        segments={getCardTitleSegments(group)}
        headerFill={group.headerFill}
        draggable={!data.inFrame}
      >
        <CardHeaderActions data={data} />
      </CardHeaderRow>
      <CardRows data={data} />
    </div>
  );
}

// React Flow re-renders every custom node on each store update, and a drag
// emits one per frame. Node `data` identity is rebuilt only by the layout
// effect, so memoizing here skips every card that is not itself moving.
export const GroupNodeComponent = React.memo(GroupNodeComponentInner);
