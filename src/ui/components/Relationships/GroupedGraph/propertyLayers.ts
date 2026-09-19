// Pure helpers for the Relationships selection card (PropertyNode).
//
// A component selection (COMPONENT / COMPONENT_SET / INSTANCE) arrives with
// its visible descendant layers nested under `children`. The card renders one
// section per layer, so the tree is flattened into a list whose position
// (`layerIndex`) is used in handle/edge ids — Figma ids contain `:` and `;`,
// which would clash with the `prop:<layer>:<entry>::in` handle id format.

import type { InspectorEntry, InspectorNodeData } from '../../../types';

export const PROPERTY_ROW_HEIGHT = 32;
export const PROPERTY_HEADER_HEIGHT = 36;
export const PROPERTY_LAYER_HEADER_HEIGHT = 32;
export const PROPERTY_ADD_ROW_HEIGHT = 28;
export const PROPERTY_CARD_PADDING = 8;
export const PROPERTY_CARD_WIDTH = 380;
// Horizontal indent per nesting level for child layer sections.
export const PROPERTY_LAYER_INDENT = 12;

export interface PropertyLayer {
  layerIndex: number;
  depth: number;
  id: string;
  name: string;
  type: string;
  entries: InspectorEntry[];
}

export interface PropertyLayerSection {
  layer: PropertyLayer;
  // Entry indexes rendered as rows (in entry order).
  visibleEntryIndexes: number[];
  // Hidden entries that can be revealed via "Add property" (bindable only).
  addableEntryIndexes: number[];
  // False when an ancestor section is collapsed (whole section hidden).
  headerVisible: boolean;
  // This section itself is collapsed (header shown, rows hidden).
  collapsed: boolean;
  // Rows are drawn only when the header is visible and not collapsed.
  rowsVisible: boolean;
  // Layer whose header hosts this section's bound-row handles while its rows
  // are hidden (the outermost collapsed ancestor-or-self), or -1 when the rows
  // are drawn. Keeps token edges attached to something on screen.
  anchorLayerIndex: number;
}

// Figma paints components, component sets and instances purple, and only
// these selections get the layered, filtered card.
const COMPONENT_NODE_TYPES = new Set(['COMPONENT', 'COMPONENT_SET', 'INSTANCE']);

export function isComponentType(type: string): boolean {
  return COMPONENT_NODE_TYPES.has(type);
}

// Depth-first, pre-order (tree order): root is layer 0 at depth 0.
export function flattenLayers(node: InspectorNodeData): PropertyLayer[] {
  const layers: PropertyLayer[] = [];
  const walk = (current: InspectorNodeData, depth: number) => {
    layers.push({
      layerIndex: layers.length,
      depth,
      id: current.id,
      name: current.name,
      type: current.type,
      entries: current.entries,
    });
    current.children?.forEach(child => walk(child, depth + 1));
  };
  walk(node, 0);
  return layers;
}

// Stable per-session key for a row. Bindable rows are keyed by where the
// binding lands (survives kind/value changes such as bind → unbind); style
// rows carry no binding target, so their label identifies them instead.
export function entryKey(layerId: string, entry: InspectorEntry): string {
  const target = entry.bindingTarget;
  if (!target) return `${layerId}|label:${entry.category}:${entry.property}`;
  switch (target.kind) {
    case 'node-field':
      return `${layerId}|field:${target.field}`;
    case 'paint':
      return `${layerId}|paint:${target.prop}:${target.index}`;
    case 'effect':
      return `${layerId}|effect:${target.index}`;
  }
}

export function isEntryBound(entry: InspectorEntry): boolean {
  return entry.kind === 'variable' || entry.kind === 'style';
}

// Rows shown for a layer. Non-component selections show everything (today's
// card). Component selections show bound rows, rows holding a real value, and
// rows the user revealed (or that were already shown) this session.
export function getVisibleEntryIndexes(
  layer: PropertyLayer,
  isComponent: boolean,
  revealedKeys: ReadonlySet<string>
): number[] {
  const indexes: number[] = [];
  layer.entries.forEach((entry, index) => {
    if (
      !isComponent
      || isEntryBound(entry)
      || entry.isDefault !== true
      || revealedKeys.has(entryKey(layer.id, entry))
    ) {
      indexes.push(index);
    }
  });
  return indexes;
}

// Everything the card needs to lay out its sections. `collapsedLayerIds`
// holds Figma layer ids; the root section is never collapsible.
export function buildLayerSections(
  layers: PropertyLayer[],
  isComponent: boolean,
  revealedKeys: ReadonlySet<string>,
  collapsedLayerIds: ReadonlySet<string>
): PropertyLayerSection[] {
  // Stack of open ancestors: [depth, layerIndex, collapsed-anchor or -1].
  const ancestors: Array<{ depth: number; anchor: number }> = [];

  return layers.map(layer => {
    while (ancestors.length > 0 && ancestors[ancestors.length - 1].depth >= layer.depth) {
      ancestors.pop();
    }
    const inheritedAnchor = ancestors.length > 0 ? ancestors[ancestors.length - 1].anchor : -1;
    const collapsed = layer.layerIndex > 0 && collapsedLayerIds.has(layer.id);
    const headerVisible = inheritedAnchor === -1;
    const anchorLayerIndex = inheritedAnchor !== -1
      ? inheritedAnchor
      : collapsed ? layer.layerIndex : -1;
    ancestors.push({ depth: layer.depth, anchor: anchorLayerIndex });

    const visibleEntryIndexes = getVisibleEntryIndexes(layer, isComponent, revealedKeys);
    const visibleSet = new Set(visibleEntryIndexes);
    const addableEntryIndexes = isComponent
      ? layer.entries
        .map((entry, index) => (!visibleSet.has(index) && entry.bindingTarget ? index : -1))
        .filter(index => index !== -1)
      : [];

    return {
      layer,
      visibleEntryIndexes,
      addableEntryIndexes,
      headerVisible,
      collapsed,
      rowsVisible: headerVisible && !collapsed,
      anchorLayerIndex,
    };
  });
}

// True when the card has nothing to list at all (shows the empty-state row).
export function isPropertyCardEmpty(sections: PropertyLayerSection[]): boolean {
  return sections.length === 1
    && sections[0].visibleEntryIndexes.length === 0
    && sections[0].addableEntryIndexes.length === 0;
}

export function getPropertyCardHeight(sections: PropertyLayerSection[]): number {
  let height = PROPERTY_HEADER_HEIGHT + PROPERTY_CARD_PADDING;
  sections.forEach(section => {
    if (section.layer.layerIndex > 0 && section.headerVisible) {
      height += PROPERTY_LAYER_HEADER_HEIGHT;
    }
    if (!section.rowsVisible) return;
    height += section.visibleEntryIndexes.length * PROPERTY_ROW_HEIGHT;
    if (section.addableEntryIndexes.length > 0) height += PROPERTY_ADD_ROW_HEIGHT;
  });
  if (isPropertyCardEmpty(sections)) height += PROPERTY_ROW_HEIGHT;
  return height;
}
