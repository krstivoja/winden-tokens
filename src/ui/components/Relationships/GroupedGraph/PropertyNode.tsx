// Property node - the currently selected Figma node's card, one row per
// inspected value, shown inline in the Relationships graph.
//
// Component selections (COMPONENT / COMPONENT_SET / INSTANCE) get one section
// per layer (root + visible descendants), list only bound/valued rows, and
// offer "Add property" to reveal a hidden bindable row so a token can be
// dragged onto it. Other selections render a single, unfiltered section.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Position, useUpdateNodeInternals } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import { InspectorEntry } from '../../../types';
import { ColorSwatch } from '../../common/ColorSwatch/ColorSwatch';
import { Dropdown } from '../../common/Dropdown/Dropdown';
import { IconTextButton } from '../../common/Button';
import { Icon } from '../../icons/Icon';
import { GraphHandle } from './GraphHandle';
import {
  REFERENCE_CONNECTION_COLOR,
  IDLE_HANDLE_FILL_COLOR,
  IDLE_HANDLE_BORDER_COLOR,
} from './constants';
import {
  PropertyLayer,
  PropertyLayerSection,
  PROPERTY_CARD_WIDTH,
  PROPERTY_LAYER_INDENT,
  PROPERTY_ROW_HEIGHT,
  buildLayerSections,
  entryKey,
  getPropertyCardHeight,
  isComponentType,
  isPropertyCardEmpty,
} from './propertyLayers';

export {
  PROPERTY_ROW_HEIGHT,
  PROPERTY_HEADER_HEIGHT,
  PROPERTY_CARD_WIDTH,
  getPropertyCardHeight,
} from './propertyLayers';

export type PropertyNodeData = {
  nodeName: string;
  nodeType: string;
  // Flattened layers (see flattenLayers); a single entry for non-components.
  layers: PropertyLayer[];
  // Plugin stopped collecting descendants at its layer cap.
  truncated?: boolean;
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

export const getPropertyHandleId = (layerIndex: number, entryIndex: number, side: 'in' | 'out') =>
  `prop:${layerIndex}:${entryIndex}::${side}`;

const entryLabel = (entry: InspectorEntry) =>
  entry.category !== entry.property ? `${entry.category} · ${entry.property}` : entry.property;

function PropertyRow({ layerIndex, entryIndex, entry, depth }: {
  layerIndex: number;
  entryIndex: number;
  entry: InspectorEntry;
  depth: number;
}) {
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
  const label = entryLabel(entry);
  const isColor = HEX_COLOR_RE.test(entry.rawValue);
  const indent = depth * PROPERTY_LAYER_INDENT;

  return (
    <div className="group relative flex items-center px-2 h-8 border-b border-border last:border-b-0 bg-base hover:bg-base-2 transition-[background] duration-150">
      {bindable && (
        <GraphHandle
          type="target"
          position={Position.Left}
          id={getPropertyHandleId(layerIndex, entryIndex, 'in')}
          isConnected={isConnected}
          isConnectable={true}
          connectionColor={REFERENCE_CONNECTION_COLOR}
          idleColor={IDLE_HANDLE_FILL_COLOR}
          idleBorderColor={IDLE_HANDLE_BORDER_COLOR}
        />
      )}

      {/* Label takes the free space; value keeps its natural width up to ~half the row. */}
      <div className="flex items-center gap-2.5 min-w-0 w-full" style={{ paddingLeft: 6 + indent, paddingRight: 12 }}>
        {isColor && <ColorSwatch color={entry.rawValue} className="w-4.5 h-4.5 shrink-0" />}

        <span className="flex-1 min-w-0 text-xs font-medium text-text overflow-hidden text-ellipsis whitespace-nowrap" title={label}>
          {label}
        </span>

        <span
          className={`shrink-0 max-w-[55%] text-[11px] font-mono whitespace-nowrap overflow-hidden text-ellipsis ${KIND_TEXT_CLASS[entry.kind]}`}
          title={valueTitle}
        >
          {valueText}
        </span>
      </div>

      <span
        className={`absolute w-1.5 h-1.5 rounded-full ${KIND_DOT_CLASS[entry.kind]}`}
        style={{ right: 6 }}
        title={KIND_TITLE[entry.kind]}
      />

      {bindable && (
        <GraphHandle
          type="source"
          position={Position.Right}
          id={getPropertyHandleId(layerIndex, entryIndex, 'out')}
          isConnected={isConnected}
          isConnectable={true}
          connectionColor={REFERENCE_CONNECTION_COLOR}
          idleColor={IDLE_HANDLE_FILL_COLOR}
          idleBorderColor={IDLE_HANDLE_BORDER_COLOR}
        />
      )}
    </div>
  );
}

function AddPropertyRow({ layer, entryIndexes, onReveal }: {
  layer: PropertyLayer;
  entryIndexes: number[];
  onReveal: (key: string) => void;
}) {
  return (
    <div
      className="flex items-center h-7 border-b border-border last:border-b-0"
      style={{ paddingLeft: 8 + layer.depth * PROPERTY_LAYER_INDENT }}
    >
      <Dropdown position="bottom-left">
        <Dropdown.Trigger asChild>
          <IconTextButton
            icon={<Icon name="plus" size={16} />}
            className="nodrag"
            title={`Add a property of ${layer.name}`}
          >
            Add property
          </IconTextButton>
        </Dropdown.Trigger>
        <Dropdown.Menu className="nowheel nodrag max-h-60 overflow-y-auto">
          {entryIndexes.map(index => {
            const entry = layer.entries[index];
            return (
              <Dropdown.Item key={index} onClick={() => onReveal(entryKey(layer.id, entry))}>
                {`${entry.category} · ${entry.property}`}
              </Dropdown.Item>
            );
          })}
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
}

// Target handles of bound rows that are hidden inside a collapsed section,
// stacked on that section's header so their token edges stay attached.
function AnchoredHandles({ sections, anchorLayerIndex }: {
  sections: PropertyLayerSection[];
  anchorLayerIndex: number;
}) {
  return (
    <>
      {sections
        .filter(section => section.anchorLayerIndex === anchorLayerIndex)
        .flatMap(section => section.visibleEntryIndexes
          .filter(index => {
            const entry = section.layer.entries[index];
            return entry.kind === 'variable' && !!entry.bindingTarget;
          })
          .map(index => (
            <GraphHandle
              key={`${section.layer.layerIndex}:${index}`}
              type="target"
              position={Position.Left}
              id={getPropertyHandleId(section.layer.layerIndex, index, 'in')}
              isConnected={true}
              isConnectable={false}
              connectionColor={REFERENCE_CONNECTION_COLOR}
              idleColor={IDLE_HANDLE_FILL_COLOR}
              idleBorderColor={IDLE_HANDLE_BORDER_COLOR}
            />
          )))}
    </>
  );
}

function PropertyNodeComponentInner({ id, data }: NodeProps<Node<PropertyNodeData>>) {
  const { nodeName, nodeType, layers, truncated } = data;
  const isComponent = isComponentType(nodeType);
  const updateNodeInternals = useUpdateNodeInternals();

  // Session state. The card remounts per selection (its xyflow id derives from
  // the Figma node id), so both reset when the selection changes.
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(() => new Set());
  const [collapsedLayerIds, setCollapsedLayerIds] = useState<Set<string>>(() => new Set());

  // Every row key ever shown in this session. Unbinding a token flips its row
  // to an unbound default value, which the filter would otherwise hide right
  // under the cursor; remembering shown rows keeps it on screen. Only ever
  // grows by keys derived from props/state, so writing it during render is
  // idempotent (safe under StrictMode double renders).
  const shownKeysRef = useRef<Set<string>>(new Set());

  const sections = useMemo(() => {
    const keys = new Set([...revealedKeys, ...shownKeysRef.current]);
    const built = buildLayerSections(layers, isComponent, keys, collapsedLayerIds);
    built.forEach(section => {
      section.visibleEntryIndexes.forEach(index => {
        shownKeysRef.current.add(entryKey(section.layer.id, section.layer.entries[index]));
      });
    });
    return built;
  }, [layers, isComponent, revealedKeys, collapsedLayerIds]);

  // Revealing rows or collapsing sections moves handles inside this node —
  // xyflow must re-measure them or edges keep pointing at stale positions.
  useEffect(() => {
    const raf = requestAnimationFrame(() => updateNodeInternals(id));
    return () => cancelAnimationFrame(raf);
  }, [id, sections, updateNodeInternals]);

  const height = getPropertyCardHeight(sections) + (truncated ? PROPERTY_ROW_HEIGHT : 0);

  const revealEntry = (key: string) => {
    setRevealedKeys(prev => new Set(prev).add(key));
  };

  const toggleCollapsed = (layerId: string) => {
    setCollapsedLayerIds(prev => {
      const next = new Set(prev);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  };

  return (
    <div
      className="rf-group-box border border-text/40 rounded-sm bg-base h-fit! shadow-md p-0.5"
      style={{ height, width: PROPERTY_CARD_WIDTH }}
    >
      <div
        className={`group-header flex items-center justify-between px-3 cursor-move select-none h-9 ${isComponent ? 'bg-component' : 'bg-base-3'}`}
      >
        <span className={`text-[13px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap ${isComponent ? 'text-white' : 'text-text'}`} title={nodeName}>
          {nodeName}
        </span>
        <span className={`text-[10px] shrink-0 ml-2 ${isComponent ? 'text-white/70' : 'text-text/50'}`}>{nodeType}</span>
      </div>

      <div className="bg-base py-1">
        {isPropertyCardEmpty(sections) && (
          <div className="px-3 py-2 text-xs text-text/50">No inspectable properties</div>
        )}
        {sections.map(section => {
          const { layer } = section;
          if (!section.headerVisible) return null;
          const isRoot = layer.layerIndex === 0;

          return (
            <React.Fragment key={`${layer.layerIndex}:${layer.id}`}>
              {!isRoot && (
                <div
                  className="relative flex items-center gap-1 h-8 pr-3 bg-base-2 border-b border-border select-none"
                  style={{ paddingLeft: 4 + (layer.depth - 1) * PROPERTY_LAYER_INDENT }}
                >
                  {section.collapsed && (
                    <AnchoredHandles sections={sections} anchorLayerIndex={layer.layerIndex} />
                  )}
                  <button
                    type="button"
                    className="nodrag w-5 h-5 shrink-0 flex items-center justify-center rounded text-text/60 hover:text-text hover:bg-base-3 cursor-pointer"
                    aria-expanded={!section.collapsed}
                    aria-label={`${section.collapsed ? 'Expand' : 'Collapse'} ${layer.name}`}
                    onClick={() => toggleCollapsed(layer.id)}
                  >
                    <Icon
                      name="triangle"
                      size={16}
                      className={`transition-transform duration-150 ${section.collapsed ? '-rotate-90' : ''}`}
                    />
                  </button>
                  <span className="text-xs font-medium text-text overflow-hidden text-ellipsis whitespace-nowrap" title={layer.name}>
                    {layer.name}
                  </span>
                  <span className="text-[10px] text-text/50 shrink-0 ml-auto pl-2">{layer.type}</span>
                </div>
              )}

              {section.rowsVisible && section.visibleEntryIndexes.map(index => (
                <PropertyRow
                  key={`${layer.layerIndex}:${index}:${layer.entries[index].property}`}
                  layerIndex={layer.layerIndex}
                  entryIndex={index}
                  entry={layer.entries[index]}
                  depth={layer.depth}
                />
              ))}

              {section.rowsVisible && section.addableEntryIndexes.length > 0 && (
                <AddPropertyRow
                  layer={layer}
                  entryIndexes={section.addableEntryIndexes}
                  onReveal={revealEntry}
                />
              )}
            </React.Fragment>
          );
        })}
        {truncated && (
          <div className="px-3 py-2 text-xs text-text/50">Large component: only the first layers are listed</div>
        )}
      </div>
    </div>
  );
}

// See GraphNode.tsx. The card's session state (revealedKeys, collapsedLayerIds)
// and its own updateNodeInternals effect live inside the memoized component, so
// reveal/collapse still repaint normally.
export const PropertyNodeComponent = React.memo(PropertyNodeComponentInner);
