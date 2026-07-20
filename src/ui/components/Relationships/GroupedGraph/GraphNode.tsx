// GraphNode component - Custom node for displaying variable groups

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

// Helper function to calculate group height
function getGroupHeight(variableCount: number): number {
  const HEADER_HEIGHT = 36;
  const ROW_HEIGHT = 32;
  const GROUP_PADDING = 8;
  return HEADER_HEIGHT + variableCount * ROW_HEIGHT + GROUP_PADDING * 2;
}

export function GroupNodeComponent({ data }: NodeProps<Node<GroupNodeData>>) {
  const {
    group,
    connectedVars,
    isHighlighted,
    isDimmed,
    highlightActive,
    highlightedVars,
    onHighlightPath,
    onGeneratorOpen,
    onShowColorMenu,
    onAddVariable,
    onRenameGroup,
    onDuplicateGroup,
    onEditAsText,
    onLevelUp,
    onDeleteGroup,
    onRenameVariable,
    onDeleteVariable,
  } = data;

  const height = getGroupHeight(group.variables.length);
  const canManageGroupVariables = group.kind === 'standard';

  return (
    <div
      className={`rf-group-box ${group.kind === 'shader' ? 'border-secondary' : 'border-text/40'} border rounded-sm bg-base h-fit! shadow-md w-65 p-0.5 ${group.kind} transition-[opacity,box-shadow] duration-150 ${isDimmed ? 'opacity-55' : ''} ${isHighlighted ? 'ring-1 ring-[#EC4899] ring-offset-2 ring-offset-base-2' : ''}`}
      style={{ height }}
    >
      {/* Header */}
      <div
        className="group-header flex items-center justify-between px-3 cursor-move select-none h-9"
        style={{ background: group.headerFill }}
      >
        <span
          className="text-[13px] font-semibold text-text overflow-hidden text-ellipsis whitespace-nowrap"
          title={group.title}
        >
          {group.title}
        </span>
        {canManageGroupVariables && (
          <div className="flex gap-1 items-center">
            {group.canGroup && group.sourceGroupName && (
              <IconButton
                icon={<Icon name="collapse-all" size={18} />}
                size="sm"
                variant="ghost"
                aria-label={`Group ${group.title} with its siblings`}
                title="Group with siblings (level up)"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onLevelUp(group.sourceGroupName!); }}
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
          </div>
        )}
      </div>

      {/* Variable rows */}
      <div className="bg-base py-2">
        {group.variables.map((node) => {
          const flags = connectedVars.get(node.name);
          const hasInput = flags?.hasInput || false;
          const hasOutput = flags?.hasOutput || false;
          const inputColor = flags?.inputKind === 'generated' ? GENERATED_CONNECTION_COLOR : REFERENCE_CONNECTION_COLOR;
          const outputColor = flags?.outputKind === 'generated' ? GENERATED_CONNECTION_COLOR : REFERENCE_CONNECTION_COLOR;
          const rowInteractive = group.kind === 'shader' && node.virtualType === 'shader';
          const canRenameVariable = !node.isVirtual && (group.kind === 'standard' || group.kind === 'source');
          const showDeleteAction = group.kind === 'standard' && !node.isVirtual;
          const showOutputHandle = !node.connectionsDisabled || node.virtualType === 'shader';
          // Dim off-chain rows only within a card that's on the chain; fully
          // off-chain cards are already dimmed as a whole.
          const rowDimmed = highlightActive && isHighlighted && !highlightedVars?.has(node.name);

          return (
            <div
              key={node.id}
              className={`group relative flex items-center px-2 h-8 border-b border-border last:border-b-0 bg-base hover:bg-base-2 transition-[background,opacity] duration-150 ${rowInteractive ? 'cursor-pointer bg-gradient-to-r from-base via-base-2 to-base hover:bg-base-3' : ''} ${rowDimmed ? 'opacity-30' : ''}`}
              onClick={rowInteractive ? () => onGeneratorOpen(group, node) : undefined}
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
                    onClick={(e) => onShowColorMenu(e, node)}
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
    </div>
  );
}
