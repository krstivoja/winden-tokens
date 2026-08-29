// Property node - the currently selected Figma node's card, one row per
// inspected value, shown inline in the Relationships graph.

import React from 'react';
import { Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import { InspectorEntry } from '../../../types';
import { ColorSwatch } from '../../common/ColorSwatch/ColorSwatch';
import { GraphHandle } from './GraphHandle';
import {
  REFERENCE_CONNECTION_COLOR,
  IDLE_HANDLE_FILL_COLOR,
  IDLE_HANDLE_BORDER_COLOR,
} from './constants';

export const PROPERTY_ROW_HEIGHT = 32;
export const PROPERTY_HEADER_HEIGHT = 36;
export const PROPERTY_CARD_WIDTH = 380;

export type PropertyNodeData = {
  nodeName: string;
  nodeType: string;
  entries: InspectorEntry[];
};

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6,8}$/;

const KIND_DOT_CLASS: Record<InspectorEntry['kind'], string> = {
  hardcoded: 'bg-text/30',
  variable: 'bg-primary',
  style: 'bg-secondary',
};

const KIND_TEXT_CLASS: Record<InspectorEntry['kind'], string> = {
  hardcoded: 'text-text/70',
  variable: 'text-primary',
  style: 'text-secondary',
};

const KIND_TITLE: Record<InspectorEntry['kind'], string> = {
  hardcoded: 'Hardcoded value',
  variable: 'Bound to token',
  style: 'Bound to style',
};

export function getPropertyCardHeight(entryCount: number): number {
  return PROPERTY_HEADER_HEIGHT + entryCount * PROPERTY_ROW_HEIGHT + 8;
}

export function PropertyNodeComponent({ data }: NodeProps<Node<PropertyNodeData>>) {
  const { nodeName, nodeType, entries } = data;
  const height = getPropertyCardHeight(entries.length);

  return (
    <div
      className="rf-group-box border border-text/40 rounded-sm bg-base h-fit! shadow-md p-0.5"
      style={{ height, width: PROPERTY_CARD_WIDTH }}
    >
      <div
        className="group-header flex items-center justify-between px-3 cursor-move select-none h-9 bg-base-3"
      >
        <span className="text-[13px] font-semibold text-text overflow-hidden text-ellipsis whitespace-nowrap" title={nodeName}>
          {nodeName}
        </span>
        <span className="text-[10px] text-text/50 shrink-0 ml-2">{nodeType}</span>
      </div>

      <div className="bg-base py-1">
        {entries.length === 0 && (
          <div className="px-3 py-2 text-xs text-text/50">No inspectable properties</div>
        )}
        {entries.map((entry, index) => {
          const bindable = !!entry.bindingTarget;
          const isConnected = entry.kind === 'variable';
          // Always show the real value; when bound, the token name follows it
          // (the color/kind dot plus the connector line already say "bound").
          const valueText = entry.kind === 'variable' && entry.token
            ? `${entry.rawValue} · {${entry.token.name}}`
            : entry.rawValue;
          const valueTitle = entry.kind === 'variable' && entry.token
            ? `${entry.token.name}${entry.token.collectionName ? ` (${entry.token.collectionName})` : ''}`
            : entry.rawValue;
          const label = entry.category !== entry.property ? `${entry.category} · ${entry.property}` : entry.property;

          return (
            <div
              key={`${entry.property}-${index}`}
              className="group relative flex items-center px-2 h-8 border-b border-border last:border-b-0 bg-base hover:bg-base-2 transition-[background] duration-150"
            >
              {bindable && (
                <GraphHandle
                  type="target"
                  position={Position.Left}
                  id={`prop:${index}::in`}
                  isConnected={isConnected}
                  isConnectable={true}
                  connectionColor={REFERENCE_CONNECTION_COLOR}
                  idleColor={IDLE_HANDLE_FILL_COLOR}
                  idleBorderColor={IDLE_HANDLE_BORDER_COLOR}
                />
              )}

              {HEX_COLOR_RE.test(entry.rawValue) && (
                <div className="absolute left-3.5">
                  <ColorSwatch color={entry.rawValue} className="w-4.5 h-4.5" />
                </div>
              )}

              <span
                className="absolute text-xs font-medium text-text overflow-hidden text-ellipsis whitespace-nowrap max-w-32"
                style={{ left: HEX_COLOR_RE.test(entry.rawValue) ? 42 : 14 }}
                title={label}
              >
                {label}
              </span>

              <span
                className={`absolute text-[11px] font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-36 ${KIND_TEXT_CLASS[entry.kind]}`}
                style={{ right: 20 }}
                title={valueTitle}
              >
                {valueText}
              </span>

              <span
                className={`absolute w-1.5 h-1.5 rounded-full ${KIND_DOT_CLASS[entry.kind]}`}
                style={{ right: 6 }}
                title={KIND_TITLE[entry.kind]}
              />

              {bindable && (
                <GraphHandle
                  type="source"
                  position={Position.Right}
                  id={`prop:${index}::out`}
                  isConnected={isConnected}
                  isConnectable={true}
                  connectionColor={REFERENCE_CONNECTION_COLOR}
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
