import { describe, it, expect } from 'vitest';
import {
  isEverythingSelected,
  isRowMarked,
  isRowSelected,
  rowKeys,
  selectOnly,
  toggleRow,
  type SidebarRow,
  type SidebarUniverse,
} from '../../../src/ui/utils/sidebarSelection';

// c1: groups color + color/dark (nested), c2: groups space, c3: no groups.
const universe: SidebarUniverse = {
  collectionIds: ['c1', 'c2', 'c3'],
  groupKeysByCollection: new Map([
    ['c1', ['c1::color', 'c1::color/dark']],
    ['c2', ['c2::space']],
  ]),
};
const everything = {
  collections: new Set(['c1', 'c2', 'c3']),
  groups: new Set(['c1::color', 'c1::color/dark', 'c2::space']),
};
const root: SidebarRow = { kind: 'root' };
const c1: SidebarRow = { kind: 'collection', collectionId: 'c1' };
const c3: SidebarRow = { kind: 'collection', collectionId: 'c3' };
const colorFolder: SidebarRow = { kind: 'group', collectionId: 'c1', groupKeys: ['c1::color', 'c1::color/dark'] };
const colorDark: SidebarRow = { kind: 'group', collectionId: 'c1', groupKeys: ['c1::color/dark'] };

describe('rowKeys', () => {
  it('root covers everything, a collection its own groups, a group its subtree', () => {
    expect(rowKeys(root, universe).collectionIds).toEqual(['c1', 'c2', 'c3']);
    expect(rowKeys(root, universe).groupKeys).toEqual(['c1::color', 'c1::color/dark', 'c2::space']);
    expect(rowKeys(c1, universe)).toEqual({ collectionIds: ['c1'], groupKeys: ['c1::color', 'c1::color/dark'] });
    expect(rowKeys(c3, universe)).toEqual({ collectionIds: ['c3'], groupKeys: [] });
    expect(rowKeys(colorDark, universe)).toEqual({ collectionIds: ['c1'], groupKeys: ['c1::color/dark'] });
  });
});

describe('selectOnly', () => {
  it('root selects everything', () => {
    expect(selectOnly(root, universe)).toEqual(everything);
  });
  it('a collection selects it and all its groups only', () => {
    expect(selectOnly(c1, universe)).toEqual({
      collections: new Set(['c1']),
      groups: new Set(['c1::color', 'c1::color/dark']),
    });
  });
  it('a group keeps every collection selected and narrows only its own collection', () => {
    expect(selectOnly(colorDark, universe)).toEqual({
      collections: new Set(['c1', 'c2', 'c3']),
      groups: new Set(['c1::color/dark', 'c2::space']),
    });
    // A folder row brings its whole subtree.
    expect(selectOnly(colorFolder, universe).groups).toEqual(
      new Set(['c1::color', 'c1::color/dark', 'c2::space'])
    );
  });
  it('a collection without groups selects just the collection', () => {
    expect(selectOnly(c3, universe)).toEqual({ collections: new Set(['c3']), groups: new Set() });
  });
});

describe('isRowSelected / isEverythingSelected', () => {
  it('needs the collection and every group key', () => {
    expect(isRowSelected(everything, c1, universe)).toBe(true);
    expect(isRowSelected({ collections: new Set(['c1']), groups: new Set(['c1::color']) }, c1, universe)).toBe(false);
    expect(isRowSelected({ collections: new Set(), groups: new Set(['c1::color/dark']) }, colorDark, universe)).toBe(false);
    expect(isRowSelected({ collections: new Set(['c3']), groups: new Set() }, c3, universe)).toBe(true);
  });
  it('is everything only when all collections and groups are in', () => {
    expect(isEverythingSelected(everything, universe)).toBe(true);
    expect(isEverythingSelected({ ...everything, groups: new Set(['c1::color']) }, universe)).toBe(false);
    expect(isEverythingSelected({ ...everything, collections: new Set(['c1']) }, universe)).toBe(false);
  });
});

describe('isRowMarked', () => {
  const groupClick = selectOnly(colorDark, universe);
  it('marks nothing while everything is selected', () => {
    expect(isRowMarked(everything, c1, universe)).toBe(false);
    expect(isRowMarked(everything, root, universe)).toBe(true);
  });
  it('after a group click only that group is marked, not the other collections', () => {
    expect(isRowMarked(groupClick, colorDark, universe)).toBe(true);
    expect(isRowMarked(groupClick, colorFolder, universe)).toBe(false);
    expect(isRowMarked(groupClick, c1, universe)).toBe(false);
    expect(isRowMarked(groupClick, { kind: 'collection', collectionId: 'c2' }, universe)).toBe(false);
    expect(isRowMarked(groupClick, { kind: 'group', collectionId: 'c2', groupKeys: ['c2::space'] }, universe)).toBe(false);
  });
  it('after a collection click the collection and its groups are marked', () => {
    const sel = selectOnly(c1, universe);
    expect(isRowMarked(sel, c1, universe)).toBe(true);
    expect(isRowMarked(sel, colorDark, universe)).toBe(true);
    expect(isRowMarked(sel, { kind: 'collection', collectionId: 'c2' }, universe)).toBe(false);
  });
});

describe('toggleRow', () => {
  const groupClick = selectOnly(colorDark, universe);
  it('adding a group keeps the other collections visible', () => {
    const next = toggleRow(groupClick, { kind: 'group', collectionId: 'c2', groupKeys: ['c2::space'] }, universe);
    expect(next.collections).toEqual(new Set(['c1', 'c2', 'c3']));
    expect(next.groups).toEqual(new Set(['c1::color/dark', 'c2::space']));
  });
  it('a fully visible group narrows its collection to that group', () => {
    const colorLeaf: SidebarRow = { kind: 'group', collectionId: 'c1', groupKeys: ['c1::color'] };
    const next = toggleRow(groupClick, colorLeaf, universe);
    expect(next.groups).toEqual(new Set(['c1::color/dark', 'c1::color', 'c2::space']));
    const narrowed = toggleRow(everything, colorDark, universe);
    expect(narrowed.groups).toEqual(new Set(['c1::color/dark', 'c2::space']));
  });
  it('adds a collection to a collection subset with all its groups', () => {
    const next = toggleRow(selectOnly(c1, universe), { kind: 'collection', collectionId: 'c2' }, universe);
    expect(next.collections).toEqual(new Set(['c1', 'c2']));
    expect(next.groups).toEqual(new Set(['c1::color', 'c1::color/dark', 'c2::space']));
  });
  it('removes a picked collection with its groups', () => {
    const two = toggleRow(selectOnly(c1, universe), { kind: 'collection', collectionId: 'c2' }, universe);
    const next = toggleRow(two, c1, universe);
    expect(next.collections).toEqual(new Set(['c2']));
    expect(next.groups).toEqual(new Set(['c2::space']));
  });
  it('removing a picked group removes the collection in a subset', () => {
    const sel = { collections: new Set(['c1', 'c2']), groups: new Set(['c1::color/dark', 'c2::space']) };
    const next = toggleRow(sel, colorDark, universe);
    expect(next.collections).toEqual(new Set(['c2']));
  });
  it('never removes the last picked row', () => {
    expect(toggleRow(groupClick, colorDark, universe)).toBe(groupClick);
    const only = selectOnly(c1, universe);
    expect(toggleRow(only, c1, universe)).toBe(only);
    const single = selectOnly({ kind: 'collection', collectionId: 'c2' }, universe);
    expect(toggleRow(single, { kind: 'collection', collectionId: 'c2' }, universe)).toBe(single);
  });
  it('a collection that is merely visible next to the others is a no-op', () => {
    expect(toggleRow(everything, c3, universe)).toBe(everything);
  });
});
