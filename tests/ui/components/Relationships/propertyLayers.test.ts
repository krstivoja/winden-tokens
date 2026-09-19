import { describe, it, expect } from 'vitest';
import type { InspectorEntry, InspectorNodeData } from '../../../../src/ui/types';
import {
  PROPERTY_ADD_ROW_HEIGHT,
  PROPERTY_CARD_PADDING,
  PROPERTY_HEADER_HEIGHT,
  PROPERTY_LAYER_HEADER_HEIGHT,
  PROPERTY_ROW_HEIGHT,
  buildLayerSections,
  entryKey,
  flattenLayers,
  getPropertyCardHeight,
  getVisibleEntryIndexes,
  isComponentType,
} from '../../../../src/ui/components/Relationships/GroupedGraph/propertyLayers';

const bound = (property: string): InspectorEntry => ({
  category: 'Fill', property, kind: 'variable', rawValue: '#FF0000',
  token: { id: 'v1', name: 'color/red' },
  bindingTarget: { kind: 'paint', prop: 'fills', index: 0 },
});
const style = (property: string): InspectorEntry => ({
  category: 'Text', property, kind: 'style', rawValue: 'Body/Regular',
});
const valued = (field: string, rawValue = '8'): InspectorEntry => ({
  category: 'Layout', property: field, kind: 'hardcoded', rawValue,
  bindingTarget: { kind: 'node-field', field },
});
const defaulted = (field: string, rawValue = '0'): InspectorEntry => ({
  ...valued(field, rawValue), isDefault: true,
});

const node = (id: string, type: string, entries: InspectorEntry[], children?: InspectorNodeData[]): InspectorNodeData => ({
  id, name: `name-${id}`, type, entries, ...(children ? { children } : {}),
});

describe('isComponentType', () => {
  it('matches component, component set and instance only', () => {
    expect(isComponentType('COMPONENT')).toBe(true);
    expect(isComponentType('COMPONENT_SET')).toBe(true);
    expect(isComponentType('INSTANCE')).toBe(true);
    expect(isComponentType('FRAME')).toBe(false);
    expect(isComponentType('TEXT')).toBe(false);
  });
});

describe('flattenLayers', () => {
  it('returns root only for a node without children', () => {
    const layers = flattenLayers(node('1:1', 'FRAME', [valued('paddingLeft')]));
    expect(layers).toHaveLength(1);
    expect(layers[0]).toMatchObject({ layerIndex: 0, depth: 0, id: '1:1', type: 'FRAME' });
  });

  it('flattens descendants in tree (pre-)order with depth', () => {
    const tree = node('c', 'COMPONENT', [], [
      node('f', 'FRAME', [], [node('t1', 'TEXT', []), node('t2', 'TEXT', [])]),
      node('r', 'RECTANGLE', []),
    ]);
    const layers = flattenLayers(tree);
    expect(layers.map(l => [l.layerIndex, l.id, l.depth])).toEqual([
      [0, 'c', 0],
      [1, 'f', 1],
      [2, 't1', 2],
      [3, 't2', 2],
      [4, 'r', 1],
    ]);
  });
});

describe('entryKey', () => {
  it('keys bindable rows by binding target, independent of kind/value', () => {
    expect(entryKey('1:2', bound('Color'))).toBe(entryKey('1:2', { ...bound('Color'), kind: 'hardcoded', token: undefined, rawValue: '#000000' }));
    expect(entryKey('1:2', valued('paddingLeft'))).toBe('1:2|field:paddingLeft');
    expect(entryKey('1:2', { category: 'Effect', property: 'Shadow', kind: 'hardcoded', rawValue: '', bindingTarget: { kind: 'effect', index: 1 } })).toBe('1:2|effect:1');
  });

  it('keys style rows by label and scopes keys by layer', () => {
    expect(entryKey('1:2', style('Text style'))).toBe('1:2|label:Text:Text style');
    expect(entryKey('1:2', valued('x'))).not.toBe(entryKey('1:3', valued('x')));
  });
});

describe('getVisibleEntryIndexes', () => {
  const layer = flattenLayers(node('c', 'COMPONENT', [
    bound('Color'),          // 0 bound
    style('Text style'),     // 1 style
    valued('paddingLeft'),   // 2 real value
    defaulted('opacity', '1'), // 3 default
    defaulted('rotation'),   // 4 default
  ]))[0];

  it('shows every row for non-component selections', () => {
    expect(getVisibleEntryIndexes(layer, false, new Set())).toEqual([0, 1, 2, 3, 4]);
  });

  it('shows bound, style and valued rows but hides defaults for components', () => {
    expect(getVisibleEntryIndexes(layer, true, new Set())).toEqual([0, 1, 2]);
  });

  it('shows revealed default rows', () => {
    const revealed = new Set([entryKey('c', layer.entries[4])]);
    expect(getVisibleEntryIndexes(layer, true, revealed)).toEqual([0, 1, 2, 4]);
  });

  it('keeps a bound row visible even if flagged default', () => {
    const l = { ...layer, entries: [{ ...bound('Color'), isDefault: true }] };
    expect(getVisibleEntryIndexes(l, true, new Set())).toEqual([0]);
  });
});

describe('buildLayerSections', () => {
  const tree = node('c', 'COMPONENT', [bound('Color'), defaulted('opacity', '1')], [
    node('f', 'FRAME', [defaulted('paddingLeft'), valued('itemSpacing')], [
      node('t', 'TEXT', [{ ...bound('Color'), category: 'Text fill' }, style('Text style')]),
    ]),
    node('r', 'RECTANGLE', [defaulted('cornerRadius')]),
  ]);
  const layers = flattenLayers(tree);

  it('lists hidden bindable rows as addable for components', () => {
    const sections = buildLayerSections(layers, true, new Set(), new Set());
    expect(sections.map(s => s.visibleEntryIndexes)).toEqual([[0], [1], [0, 1], []]);
    expect(sections.map(s => s.addableEntryIndexes)).toEqual([[1], [0], [], [0]]);
    expect(sections.every(s => s.headerVisible && s.rowsVisible && s.anchorLayerIndex === -1)).toBe(true);
  });

  it('never offers addable rows for non-components', () => {
    const flat = flattenLayers(node('n', 'FRAME', [defaulted('opacity', '1'), valued('x')]));
    const [section] = buildLayerSections(flat, false, new Set(), new Set());
    expect(section.visibleEntryIndexes).toEqual([0, 1]);
    expect(section.addableEntryIndexes).toEqual([]);
  });

  it('hides a collapsed section\'s rows and its descendants, anchoring them on its header', () => {
    const sections = buildLayerSections(layers, true, new Set(), new Set(['f']));
    const [root, frame, text, rect] = sections;
    expect(root).toMatchObject({ headerVisible: true, rowsVisible: true, anchorLayerIndex: -1 });
    expect(frame).toMatchObject({ headerVisible: true, collapsed: true, rowsVisible: false, anchorLayerIndex: 1 });
    expect(text).toMatchObject({ headerVisible: false, rowsVisible: false, anchorLayerIndex: 1 });
    expect(rect).toMatchObject({ headerVisible: true, rowsVisible: true, anchorLayerIndex: -1 });
  });

  it('anchors nested collapsed sections on the outermost collapsed ancestor', () => {
    const sections = buildLayerSections(layers, true, new Set(), new Set(['f', 't']));
    expect(sections[2].anchorLayerIndex).toBe(1);
  });

  it('ignores collapse on the root layer', () => {
    const sections = buildLayerSections(layers, true, new Set(), new Set(['c']));
    expect(sections[0]).toMatchObject({ collapsed: false, rowsVisible: true });
  });
});

describe('getPropertyCardHeight', () => {
  const base = PROPERTY_HEADER_HEIGHT + PROPERTY_CARD_PADDING;

  it('matches the legacy formula for non-component cards', () => {
    const layers = flattenLayers(node('n', 'FRAME', [valued('a'), valued('b'), defaulted('c')]));
    const sections = buildLayerSections(layers, false, new Set(), new Set());
    expect(getPropertyCardHeight(sections)).toBe(base + 3 * PROPERTY_ROW_HEIGHT);
  });

  it('reserves an empty-state row when there is nothing to list', () => {
    const sections = buildLayerSections(flattenLayers(node('n', 'FRAME', [])), false, new Set(), new Set());
    expect(getPropertyCardHeight(sections)).toBe(base + PROPERTY_ROW_HEIGHT);
  });

  it('counts layer headers, visible rows and add rows; skips collapsed content', () => {
    const tree = node('c', 'COMPONENT', [bound('Color'), defaulted('opacity', '1')], [
      node('t', 'TEXT', [valued('fontSize', '14'), defaulted('letterSpacing')]),
    ]);
    const layers = flattenLayers(tree);
    const open = buildLayerSections(layers, true, new Set(), new Set());
    // root: 1 row + add row; child: header + 1 row + add row
    expect(getPropertyCardHeight(open)).toBe(
      base + PROPERTY_ROW_HEIGHT + PROPERTY_ADD_ROW_HEIGHT
      + PROPERTY_LAYER_HEADER_HEIGHT + PROPERTY_ROW_HEIGHT + PROPERTY_ADD_ROW_HEIGHT
    );
    const collapsed = buildLayerSections(layers, true, new Set(), new Set(['t']));
    expect(getPropertyCardHeight(collapsed)).toBe(
      base + PROPERTY_ROW_HEIGHT + PROPERTY_ADD_ROW_HEIGHT + PROPERTY_LAYER_HEADER_HEIGHT
    );
  });
});
