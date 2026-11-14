import { describe, it, expect } from 'vitest';
import {
  compareGroupPaths,
  getCollectionGroupKey,
  getGroupKeysByCollection,
  isVariableVisibleForGroupFilters,
} from '../../../src/ui/utils/groupFilters';

const variables = [
  { collectionId: 'c1', name: 'root-token' },
  { collectionId: 'c1', name: 'color/brand' },
  { collectionId: 'c1', name: 'color/dark/bg' },
  { collectionId: 'c2', name: 'space/1' },
  { collectionId: 'c3', name: 'loose' },
];
const byCollection = getGroupKeysByCollection(variables);

describe('getGroupKeysByCollection', () => {
  it('lists each collection\'s real group keys, none for ungrouped-only collections', () => {
    expect(byCollection.get('c1')).toEqual(['c1::color', 'c1::color/dark']);
    expect(byCollection.get('c2')).toEqual(['c2::space']);
    expect(byCollection.has('c3')).toBe(false);
  });
});

describe('isVariableVisibleForGroupFilters', () => {
  const root = { collectionId: 'c1', name: 'root-token' };

  it('always shows ungrouped (collection root) variables, whatever groups are selected', () => {
    expect(isVariableVisibleForGroupFilters(root, new Set(['c1::color', 'c1::color/dark']))).toBe(true);
    expect(isVariableVisibleForGroupFilters(root, new Set(['c1::color']))).toBe(true);
    expect(isVariableVisibleForGroupFilters(root, new Set())).toBe(true);
  });

  it('shows a grouped variable only while its own group is selected', () => {
    const brand = { collectionId: 'c1', name: 'color/brand' };
    expect(isVariableVisibleForGroupFilters(brand, new Set(['c1::color']))).toBe(true);
    expect(isVariableVisibleForGroupFilters(brand, new Set(['c1::color/dark']))).toBe(false);
    expect(isVariableVisibleForGroupFilters(brand, new Set(['c2::color']))).toBe(false);
  });

  it('a checked group keeps its rows and every loose row', () => {
    const picked = new Set([getCollectionGroupKey('c1', 'color')]);
    const visible = variables.filter(v => isVariableVisibleForGroupFilters(v, picked));
    expect(visible.map(v => v.name)).toEqual(['root-token', 'color/brand', 'loose']);
  });
});

describe('compareGroupPaths', () => {
  it('orders like the sidebar tree: root first, parent before children, segment-wise', () => {
    expect(['b', 'a/z', '', 'a', 'a-b'].sort(compareGroupPaths)).toEqual(['', 'a', 'a/z', 'a-b', 'b']);
    expect(compareGroupPaths('x', 'x')).toBe(0);
  });
});
