// GraphNode component - Custom node for displaying variable groups

import React from 'react';
import { Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import { Icon } from '../../icons/Icon';
import { IconButton } from '../../common/Button/IconButton/IconButton';
import { Dropdown } from '../../common/Dropdown/Dropdown';
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
    isColorType,
    connectedVars,
    onGeneratorOpen,
    onShowColorMenu,
    onAddVariable,
    onRenameGroup,
    onDuplicateGroup,
    onDeleteGroup,
    onRenameVariable,
    onDeleteVariable,
  } = data;

  const height = getGroupHeight(group.variables.length);
  const canManageGroupVariables = group.kind === 'standard';

  return (
    <div
      className={`rf-group-box ${group.kind === 'shader' ? 'border-secondary' : 'border-text/40'} border rounded-sm bg-base h-fit! shadow-md w-65 p-0.5 ${group.kind}`}
      style={{ height }}
    >
      {/* Header */}
      <div
        className="group-header flex items-center justify-between px-3 cursor-move select-none h-9"
        style={{ background: group.headerFill }}
      >
        <span className="text-[13px] font-semibold text-text overflow-hidden text-ellipsis whitespace-nowrap">
          {group.title}
        </span>
        {canManageGroupVariables && (
          <div className="flex gap-1 items-center">
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
                <div onMouseDown={(e) => e.stopPropagation()}>
                  <Dropdown.Item onClick={() => onRenameGroup(group)}>
                    Rename
                  </Dropdown.Item>
                  <Dropdown.Item onClick={() => onDuplicateGroup(group)}>
                    Duplicate
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item onClick={() => onDeleteGroup(group)} className="text-danger hover:bg-danger hover:text-white">
                    Delete
                  </Dropdown.Item>
                </div>
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

          return (
            <div
              key={node.id}
              className={`group relative flex items-center px-2 h-8 border-b border-border last:border-b-0 bg-base hover:bg-base-2 transition-[background] duration-150 ${rowInteractive ? 'cursor-pointer bg-gradient-to-r from-base via-base-2 to-base hover:bg-base-3' : ''}`}
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
              {isColorType && !node.isVirtual && (
                <div
                  className="absolute left-3.5 w-4.5 h-4.5 rounded border border-border cursor-pointer transition-all duration-150 hover:scale-115 hover:shadow-[0_2px_6px_rgba(0,0,0,0.2)]"
                  style={{ background: node.color }}
                  onClick={(e) => onShowColorMenu(e, node)}
                  title="Edit color"
                />
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
                style={{ left: node.isVirtual ? 52 : (isColorType ? 42 : 14) }}
                onDoubleClick={canRenameVariable ? (e) => {
                  e.stopPropagation();
                  onRenameVariable(node);
                } : undefined}
                title={canRenameVariable ? 'Double-click to rename' : undefined}
              >
                {node.shortName}
              </span>

              {/* Value */}
              <span
                className={`absolute text-[11px] font-mono overflow-hidden text-ellipsis whitespace-nowrap max-w-25 ${node.isReference ? 'text-text-secondary' : 'text-text-muted'}`}
                style={{ right: showDeleteAction ? 42 : 16 }}
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
