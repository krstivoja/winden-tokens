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
import {
  GENERATED_CONNECTION_COLOR,
  REFERENCE_CONNECTION_COLOR,
  IDLE_HANDLE_FILL_COLOR,
  IDLE_HANDLE_BORDER_COLOR,
} from './constants';

// Helper function to calculate group height.
// Mirrors getGroupHeight() in ./utils, including its one-row floor for the
// empty collection placeholder — keep the two in step.
function getGroupHeight(variableCount: number): number {
  const HEADER_HEIGHT = 36;
  const ROW_HEIGHT = 32;
  const GROUP_PADDING = 8;
  return HEADER_HEIGHT + Math.max(variableCount, 1) * ROW_HEIGHT + GROUP_PADDING * 2;
}

/**
 * The header bar: the title, and whatever actions the caller puts on the
 * right. The drag handle (`.group-header`) lives here, so a card and a
 * container are dragged by exactly the same strip.
 */
export function CardHeaderRow({
  title,
  headerFill,
  className = '',
  children,
}: {
  title: string;
  headerFill: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`group-header flex items-center justify-between px-3 cursor-move select-none h-9 ${className}`}
      style={{ background: headerFill }}
    >
      <span
        className="text-[13px] font-semibold text-text overflow-hidden text-ellipsis whitespace-nowrap"
        title={title}
      >
        {title}
      </span>
      <div className="flex gap-1 items-center">{children}</div>
    </div>
  );
}

/**
 * The header actions of a card: level up, add variable, and the actions
 * dropdown. A container renders these for the card it absorbed, with
 * `showLevelUp={false}` — the container offers the level-up itself (it has
 * one even when it absorbed no card at all), and two buttons firing the same
 * `onLevelUp(collectionId, path)` would just be the old duplication again.
 */
export function CardHeaderActions({
  data,
  showLevelUp = true,
}: {
  data: GroupNodeData;
  showLevelUp?: boolean;
}) {
  const {
    group,
    onHighlightPath,
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
      {showLevelUp && group.canGroup && group.sourceGroupName && (
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
          <Dropdown.Item onClick={() => onDeleteGroup(group)} className="text-danger hover:bg-danger hover:text-white">
            Delete
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    </>
  );
}

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
  const {
    group,
    connectedVars,
    isHighlighted,
    highlightActive,
    highlightedVars,
    highlightedVarSeed,
    onHighlightVariable,
    onGeneratorOpen,
    onShowColorMenu,
    onRenameVariable,
    onDeleteVariable,
  } = data;

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
        <div className="flex items-center justify-center h-8 px-2 text-xs text-text-muted select-none">
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
        const rowDimmed = highlightActive && isHighlighted && !highlightedVars?.has(node.name);
        const isSeedRow = highlightActive && isHighlighted && highlightedVarSeed === node.name;
        const isSiblingRow = rowDimmed && seedInCard;

        return (
          <div
            key={node.id}
            className={`group relative flex items-center px-2 h-8 border-b border-border ${keepLastBorder ? '' : 'last:border-b-0'} bg-base hover:bg-base-2 transition-[background,opacity] duration-150 cursor-pointer ${rowInteractive ? 'bg-gradient-to-r from-base via-base-2 to-base hover:bg-base-3' : ''} ${isSiblingRow ? 'opacity-45 shadow-[inset_2px_0_0_rgba(236,72,153,0.45)]' : rowDimmed ? 'opacity-30' : ''} ${isSeedRow ? 'bg-base-2 shadow-[inset_2px_0_0_#EC4899]' : ''}`}
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
              className={`absolute text-[11px] font-mono overflow-hidden text-ellipsis whitespace-nowrap max-w-25 ${node.isReference ? 'text-text-secondary' : 'text-text-muted'}`}
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
}

function GroupNodeComponentInner({ data }: NodeProps<Node<GroupNodeData>>) {
  const { group, isHighlighted, isDimmed } = data;

  const height = getGroupHeight(group.variables.length);

  return (
    <div
      className={`rf-group-box ${group.kind === 'shader' ? 'border-secondary' : 'border-text/40'} border rounded-sm bg-base h-fit! shadow-xs w-65 p-0.5 ${group.kind} transition-[opacity,box-shadow] duration-150 ${isDimmed ? 'opacity-55' : ''} ${isHighlighted ? 'ring-1 ring-[#EC4899] ring-offset-2 ring-offset-base-2' : ''}`}
      style={{ height }}
    >
      <CardHeaderRow title={group.title} headerFill={group.headerFill}>
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
