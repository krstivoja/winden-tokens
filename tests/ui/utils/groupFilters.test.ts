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

describe('isVariableVisibleForGroupFilters with group keys per collection', () => {
  const root = { collectionId: 'c1', name: 'root-token' };

  it('shows ungrouped variables only while every group of their collection is selected', () => {
    const all = new Set(['c1::color', 'c1::color/dark']);
    expect(isVariableVisibleForGroupFilters(root, all, byCollection)).toBe(true);
    expect(isVariableVisibleForGroupFilters(root, new Set(['c1::color']), byCollection)).toBe(false);
    expect(isVariableVisibleForGroupFilters(root, new Set(), byCollection)).toBe(false);
  });

  it('always shows ungrouped variables of a collection without groups', () => {
    expect(isVariableVisibleForGroupFilters({ collectionId: 'c3', name: 'loose' }, new Set(), byCollection)).toBe(true);
  });

  it('a picked group leaves only that group\'s rows', () => {
    const picked = new Set([getCollectionGroupKey('c1', 'color')]);
    const visible = variables.filter(v => isVariableVisibleForGroupFilters(v, picked, byCollection));
    expect(visible.map(v => v.name)).toEqual(['color/brand', 'loose']);
  });

  it('without the map ungrouped variables always show', () => {
    expect(isVariableVisibleForGroupFilters(root, new Set())).toBe(true);
  });
});

describe('isVariableVisibleForGroupFilters - other collections untouched by a group click', () => {
  it('keeps every variable of the other collections visible, filters only the clicked collection', () => {
    const vars = [
      { collectionId: 'color', name: 'color/background/a' },
      { collectionId: 'color', name: 'checkbox/color/b' },
      { collectionId: 'color', name: 'screen' },
      { collectionId: 'dim', name: 'spacing/s' },
      { collectionId: 'dim', name: 'loose' },
    ];
    const keys = getGroupKeysByCollection(vars);
    // What clicking color/color/background selects: other collections keep all keys.
    const selected = new Set(['color::color/background', 'dim::spacing']);
    const visible = vars.filter(v => isVariableVisibleForGroupFilters(v, selected, keys)).map(v => v.name);
    expect(visible).toEqual(['color/background/a', 'spacing/s', 'loose']);
  });
});

describe('compareGroupPaths', () => {
  it('orders like the sidebar tree: root first, parent before children, segment-wise', () => {
    expect(['b', 'a/z', '', 'a', 'a-b'].sort(compareGroupPaths)).toEqual(['', 'a', 'a/z', 'a-b', 'b']);
    expect(compareGroupPaths('x', 'x')).toBe(0);
  });
});
