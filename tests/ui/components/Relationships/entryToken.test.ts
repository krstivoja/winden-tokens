// Selection tokens match graph cards by variable id, and a broken binding
// relinks to its live namesake only when that is unambiguous.
import { describe, it, expect } from 'vitest';
import type { CollectionData, InspectorEntry, VariableData } from '../../../../src/ui/types';
import {
  findRelinkVariable,
  formatVariableNode,
  getBindingResolvedType,
  resolveEntryToken,
} from '../../../../src/ui/components/Relationships/GroupedGraph/utils';
import type { VariableCardInfo } from '../../../../src/ui/components/Relationships/GroupedGraph/utils';

const collections: CollectionData[] = [
  { id: 'c1', name: 'Colors', modes: [{ modeId: 'm1', name: 'Default' }] },
  { id: 'c2', name: 'Brand', modes: [{ modeId: 'm2', name: 'Default' }] },
];

const variable = (
  id: string,
  collectionId: string,
  name: string,
  value = '#FF0000',
  resolvedType: VariableData['resolvedType'] = 'COLOR'
): VariableData => ({
  id, collectionId, name, resolvedType, value,
  valuesByMode: { [collectionId === 'c1' ? 'm1' : 'm2']: value },
});

const entry = (token: InspectorEntry['token']): InspectorEntry => ({
  category: 'Fill', property: 'Fill', kind: 'variable', rawValue: '#FF0000', token,
  bindingTarget: { kind: 'paint', prop: 'fills', index: 0 },
});

const card = (id: string, name: string, group: string): VariableCardInfo => ({
  group, index: 0,
  node: {
    id, name, shortName: name, displayName: '', color: '', value: '', resolvedValue: '',
    isReference: false, referenceName: null,
  },
});

describe('resolveEntryToken', () => {
  const cards = new Map([
    ['v1', card('v1', 'brand/default', 'c1::brand')],
    ['v2', card('v2', 'brand/default', 'c2::brand')],
  ]);

  it('matches by id, so two collections sharing a name each get their own card', () => {
    expect(resolveEntryToken(entry({ id: 'v2', name: 'brand/default' }), cards))
      .toEqual({ kind: 'local', info: cards.get('v2') });
  });

  it('a missing token matches nothing, even with a live namesake', () => {
    const token = { id: 'dead', name: 'brand/default', missing: true as const };
    expect(resolveEntryToken(entry(token), cards)).toEqual({ kind: 'missing', token });
  });

  it('a token without a local card is external', () => {
    const token = { id: 'lib', name: 'lib/blue' };
    expect(resolveEntryToken(entry(token), cards)).toEqual({ kind: 'external', token });
  });

  it('an unbound row resolves to null', () => {
    expect(resolveEntryToken({ ...entry(undefined), kind: 'hardcoded' }, cards)).toBeNull();
  });
});

describe('findRelinkVariable', () => {
  const dead = { id: 'dead', name: 'brand/default', collectionName: 'Brand', missing: true as const };
  const fill = { kind: 'paint' as const, prop: 'fills' as const, index: 0 };

  it('prefers the namesake in the same-named collection', () => {
    const variables = [variable('v1', 'c1', 'brand/default'), variable('v2', 'c2', 'brand/default')];
    expect(findRelinkVariable(dead, fill, variables, collections)?.id).toBe('v2');
  });

  it('falls back to the only namesake', () => {
    const variables = [variable('v1', 'c1', 'brand/default')];
    expect(findRelinkVariable(dead, fill, variables, collections)?.id).toBe('v1');
  });

  it('is null when ambiguous or when the name is unknown', () => {
    const variables = [variable('v1', 'c1', 'brand/default'), variable('v3', 'c1', 'brand/default')];
    const noCollection = { ...dead, collectionName: undefined };
    expect(findRelinkVariable(noCollection, fill, variables, collections)).toBeNull();
    expect(findRelinkVariable({ ...dead, name: '' }, fill, variables, collections)).toBeNull();
  });

  it('only offers a namesake whose type the binding accepts', () => {
    const variables = [
      variable('color', 'c2', 'brand/default'),
      variable('number', 'c2', 'brand/default-n', '8', 'FLOAT'),
    ];
    // A FLOAT field never takes the COLOR namesake.
    const radius = { kind: 'node-field' as const, field: 'cornerRadius' };
    expect(findRelinkVariable(dead, radius, variables, collections)).toBeNull();
    expect(findRelinkVariable(dead, fill, variables, collections)?.id).toBe('color');

    // A same-named COLOR in the same collection does not make a FLOAT
    // namesake elsewhere ambiguous for a numeric field.
    const mixed = [
      variable('color', 'c2', 'space/md'),
      variable('float', 'c1', 'space/md', '16', 'FLOAT'),
    ];
    const spacing = { ...dead, name: 'space/md' };
    expect(findRelinkVariable(spacing, { kind: 'node-field', field: 'itemSpacing' }, mixed, collections)?.id)
      .toBe('float');
    expect(findRelinkVariable(spacing, { kind: 'effect', index: 0 }, mixed, collections)?.id).toBe('color');

    const font = { ...dead, name: 'font/body' };
    const fonts = [variable('family', 'c1', 'font/body', 'Inter', 'STRING')];
    expect(findRelinkVariable(font, { kind: 'node-field', field: 'fontFamily' }, fonts, collections)?.id)
      .toBe('family');
    expect(findRelinkVariable(font, { kind: 'node-field', field: 'fontSize' }, fonts, collections)).toBeNull();
  });
});

describe('getBindingResolvedType', () => {
  it('maps each binding target to the variable type Figma accepts there', () => {
    expect(getBindingResolvedType({ kind: 'paint', prop: 'strokes', index: 1 })).toBe('COLOR');
    expect(getBindingResolvedType({ kind: 'effect', index: 0 })).toBe('COLOR');
    expect(getBindingResolvedType({ kind: 'node-field', field: 'fontFamily' })).toBe('STRING');
    expect(getBindingResolvedType({ kind: 'node-field', field: 'fontStyle' })).toBe('STRING');
    expect(getBindingResolvedType({ kind: 'node-field', field: 'characters' })).toBe('STRING');
    expect(getBindingResolvedType({ kind: 'node-field', field: 'visible' })).toBe('BOOLEAN');
    for (const field of ['opacity', 'cornerRadius', 'itemSpacing', 'paddingLeft', 'fontSize', 'lineHeight', 'fontWeight']) {
      expect(getBindingResolvedType({ kind: 'node-field', field })).toBe('FLOAT');
    }
  });
});

describe('formatVariableNode broken alias', () => {
  it('flags the shown mode and does not resolve through a live namesake', () => {
    const live = variable('v1', 'c1', 'brand/default', '#3366FF');
    const text = { ...variable('v2', 'c1', 'text/primary', '{brand/default}'), brokenModes: ['m1'] };
    const node = formatVariableNode(text, new Map([[live.name, live]]), true, collections, null);
    expect(node.isBrokenReference).toBe(true);
    expect(node.color).toBe('#888888');
  });

  it('a healthy alias is not flagged', () => {
    const live = variable('v1', 'c1', 'brand/default', '#3366FF');
    const text = variable('v2', 'c1', 'text/primary', '{brand/default}');
    const node = formatVariableNode(text, new Map([[live.name, live]]), true, collections, null);
    expect(node.isBrokenReference).toBeUndefined();
    expect(node.color.toUpperCase()).toBe('#3366FF');
  });
});
