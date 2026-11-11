import { describe, it, expect } from 'vitest';
import {
  isEverythingSelected,
  isRootMarked,
  isRowSelected,
  markId,
  markRow,
  pruneMarks,
  rowKeys,
  selectOnly,
  toggleMark,
  visibleMarks,
  type SidebarRow,
  type SidebarUniverse,
} from '../../../src/ui/utils/sidebarSelection';

// c1: groups color + color/dark (nested), c2: groups space, c3: no groups,
// c4: folder `action` (no group of its own) holding only group `action/height`,
// next to group `size`; c5: folder `btn` with groups `btn/primary` and
// `btn/ghost`, next to group `link`.
const universe: SidebarUniverse = {
  collectionIds: ['c1', 'c2', 'c3', 'c4', 'c5'],
  groupKeysByCollection: new Map([
    ['c1', ['c1::color', 'c1::color/dark']],
    ['c2', ['c2::space']],
    ['c4', ['c4::action/height', 'c4::size']],
    ['c5', ['c5::btn/primary', 'c5::btn/ghost', 'c5::link']],
  ]),
};
const ALL_GROUPS = [
  'c1::color', 'c1::color/dark', 'c2::space', 'c4::action/height', 'c4::size',
  'c5::btn/primary', 'c5::btn/ghost', 'c5::link',
];
const everything = {
  collections: new Set(['c1', 'c2', 'c3', 'c4', 'c5']),
  groups: new Set(ALL_GROUPS),
};
const without = (...keys: string[]) => new Set(ALL_GROUPS.filter(key => !keys.includes(key)));
const root: SidebarRow = { kind: 'root' };
const c1: SidebarRow = { kind: 'collection', collectionId: 'c1' };
const c3: SidebarRow = { kind: 'collection', collectionId: 'c3' };
const colorFolder: SidebarRow = { kind: 'group', collectionId: 'c1', groupKeys: ['c1::color', 'c1::color/dark'] };
const colorDark: SidebarRow = { kind: 'group', collectionId: 'c1', groupKeys: ['c1::color/dark'] };

describe('rowKeys', () => {
  it('root covers everything, a collection its own groups, a group its subtree', () => {
    expect(rowKeys(root, universe).collectionIds).toEqual(['c1', 'c2', 'c3', 'c4', 'c5']);
    expect(rowKeys(root, universe).groupKeys).toEqual(ALL_GROUPS);
    expect(rowKeys(c1, universe)).toEqual({ collectionIds: ['c1'], groupKeys: ['c1::color', 'c1::color/dark'] });
    expect(rowKeys(c3, universe)).toEqual({ collectionIds: ['c3'], groupKeys: [] });
    expect(rowKeys(colorDark, universe)).toEqual({ collectionIds: ['c1'], groupKeys: ['c1::color/dark'] });
  });
});

describe('selectOnly', () => {
  it('root selects everything', () => {
    expect(selectOnly(root, universe)).toEqual(everything);
  });
  it('a collection hides nothing: it clears every narrowing and selects everything', () => {
    expect(selectOnly(c1, universe)).toEqual(everything);
    expect(selectOnly(c3, universe)).toEqual(everything);
  });
  it('a group keeps every collection selected and narrows only its own collection', () => {
    expect(selectOnly(colorDark, universe)).toEqual({
      collections: everything.collections,
      groups: without('c1::color'),
    });
    // A folder row brings its whole subtree.
    expect(selectOnly(colorFolder, universe).groups).toEqual(everything.groups);
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

const height = markId('c4', 'action/height');
const action = markId('c4', 'action');
const sizeMark = markId('c4', 'size');
const rowOf = (id: string) => markRow(id, universe) as SidebarRow;

describe('markId / markRow', () => {
  it('a collection row is "<id>::", a group row covers its own group and every descendant', () => {
    expect(markId('c1')).toBe('c1::');
    expect(markRow('c1::', universe)).toEqual(c1);
    expect(markRow('c1::color', universe)).toEqual(colorFolder);
    expect(markRow('c1::color/dark', universe)).toEqual(colorDark);
    // A folder with no group of its own still stands for its descendants.
    expect(markRow(action, universe)).toEqual({ kind: 'group', collectionId: 'c4', groupKeys: ['c4::action/height'] });
  });
  it('is null once the row no longer exists', () => {
    expect(markRow('gone::', universe)).toBe(null);
    expect(markRow('c1::nope', universe)).toBe(null);
    // `color/da` is a prefix of a key, not a folder.
    expect(markRow('c1::color/da', universe)).toBe(null);
    expect(markRow('junk', universe)).toBe(null);
  });
});

describe('visibleMarks / isRootMarked', () => {
  it('a folder whose only child was clicked is not marked with it (same variables)', () => {
    const sel = selectOnly(rowOf(height), universe);
    expect(visibleMarks(new Set([height]), sel, universe)).toEqual(new Set([height]));
    // Clicking the parent instead marks only the parent.
    expect(visibleMarks(new Set([action]), selectOnly(rowOf(action), universe), universe)).toEqual(new Set([action]));
  });
  it('hides a mark whose keys are no longer all selected, or whose row is gone', () => {
    const sel = { collections: everything.collections, groups: without('c4::action/height', 'c4::size') };
    expect(visibleMarks(new Set([height, 'old::', 'c1::']), sel, universe)).toEqual(new Set(['c1::']));
    const noC1 = { collections: new Set(['c2', 'c3', 'c4']), groups: everything.groups };
    expect(visibleMarks(new Set(['c1::', 'c1::color']), noC1, universe)).toEqual(new Set());
    // A collection mark needs only its collection: a group picked inside it narrows it.
    expect(visibleMarks(new Set(['c4::']), selectOnly(rowOf(height), universe), universe)).toEqual(new Set(['c4::']));
  });
  it('hides group marks that no longer narrow their fully shown collection (Show all after a Cmd-click)', () => {
    expect(visibleMarks(new Set([height, 'c1::']), everything, universe)).toEqual(new Set(['c1::']));
    expect(isRootMarked(everything, universe, visibleMarks(new Set([height]), everything, universe))).toBe(true);
    // Group marks that together cover their whole collection still show.
    expect(visibleMarks(new Set([height, sizeMark]), everything, universe)).toEqual(new Set([height, sizeMark]));
    // So does a folder that is a collection's only top-level row.
    const one: SidebarUniverse = { collectionIds: ['k'], groupKeysByCollection: new Map([['k', ['k::a/x', 'k::a/y']]]) };
    const all = { collections: new Set(['k']), groups: new Set(['k::a/x', 'k::a/y']) };
    expect(visibleMarks(new Set(['k::a']), all, one)).toEqual(new Set(['k::a']));
  });
  it('All variables is marked only while everything is selected and no row is', () => {
    expect(isRootMarked(everything, universe, new Set())).toBe(true);
    expect(isRootMarked(everything, universe, new Set(['c1::']))).toBe(false);
    expect(isRootMarked(selectOnly(colorDark, universe), universe, new Set())).toBe(false);
  });
});

describe('pruneMarks', () => {
  it('drops marks of rows that no longer exist (plugin undo recreates every id)', () => {
    expect(pruneMarks(new Set(['c1::', 'old::', 'old::color', 'c1::gone']), universe)).toEqual(new Set(['c1::']));
  });
  it('returns the same set when nothing is stale', () => {
    const marks = new Set(['c1::', height]);
    expect(pruneMarks(marks, universe)).toBe(marks);
  });
});

describe('toggleMark', () => {
  it('a group joins a collection that has no group mark by narrowing it to itself', () => {
    const out = toggleMark(everything, new Set(), height, universe)!;
    expect(out.marks).toEqual(new Set([height]));
    expect(out.selection.groups).toEqual(without('c4::size'));
    expect(out.selection.collections).toEqual(everything.collections);
  });
  it('a group joins a collection narrowed by another mark by adding its keys', () => {
    const sel = selectOnly(rowOf(height), universe);
    const out = toggleMark(sel, new Set([height]), sizeMark, universe)!;
    expect(out.marks).toEqual(new Set([height, sizeMark]));
    expect(out.selection.groups).toEqual(everything.groups);
  });
  it('a parent covering the same variables takes over the ring of the row under it', () => {
    const sel = selectOnly(rowOf(height), universe);
    const out = toggleMark(sel, new Set([height, 'c1::']), action, universe)!;
    expect(out.marks).toEqual(new Set([action, 'c1::']));
    expect(out.selection).toBe(sel);
    // Taking the parent out takes the rows under it along.
    const back = toggleMark(out.selection, out.marks, action, universe)!;
    expect(back.marks).toEqual(new Set(['c1::']));
    expect(back.selection.groups).toEqual(everything.groups);
  });
  it('a group leaves: its keys go unless another mark covers them', () => {
    const sel = { collections: everything.collections, groups: everything.groups };
    const out = toggleMark(sel, new Set([height, sizeMark]), sizeMark, universe)!;
    expect(out.marks).toEqual(new Set([height]));
    expect(out.selection.groups).toEqual(without('c4::size'));
  });
  it('the last group mark of a collection leaves: the collection is fully visible again', () => {
    const sel = { collections: everything.collections, groups: without('c4::size') };
    const out = toggleMark(sel, new Set([height, 'c2::']), height, universe)!;
    expect(out.marks).toEqual(new Set(['c2::']));
    expect(out.selection.groups).toEqual(everything.groups);
  });
  it('in a collection subset the last group mark takes its collection with it', () => {
    const sel = { collections: new Set(['c1', 'c4']), groups: new Set(['c1::color/dark', 'c4::size']) };
    const out = toggleMark(sel, new Set([markId('c1', 'color/dark'), sizeMark]), markId('c1', 'color/dark'), universe)!;
    expect(out.selection.collections).toEqual(new Set(['c4']));
    expect(out.selection.groups).toEqual(new Set(['c4::size']));
  });
  it('never removes the last visible mark', () => {
    const sel = selectOnly(rowOf(height), universe);
    expect(toggleMark(sel, new Set([height]), height, universe)).toBe(null);
    expect(toggleMark(everything, new Set(['c1::']), 'c1::', universe)).toBe(null);
    // A hidden mark does not count as another pick.
    expect(toggleMark(sel, new Set([height, 'old::']), height, universe)).toBe(null);
  });
  it('a collection mark never filters, also next to a group picked inside it', () => {
    const one = toggleMark(everything, new Set(), 'c1::', universe)!;
    expect(one.selection).toBe(everything);
    expect(one.marks).toEqual(new Set(['c1::']));
    const sel = selectOnly(rowOf(height), universe);
    const both = toggleMark(sel, new Set([height]), 'c4::', universe)!;
    expect(both.selection).toBe(sel);
    expect(both.marks).toEqual(new Set([height, 'c4::']));
    // A collection that is off (Hide unused) cannot be marked.
    const off = { collections: new Set(['c1', 'c2']), groups: everything.groups };
    expect(toggleMark(off, new Set(['c1::']), 'c4::', universe)).toBe(null);
    // Leaving drops only the mark.
    const two = toggleMark(everything, new Set(['c1::', 'c2::']), 'c1::', universe)!;
    expect(two.selection).toBe(everything);
    expect(two.marks).toEqual(new Set(['c2::']));
  });
  it('a group joining a marked collection narrows it; the collection mark stays', () => {
    const out = toggleMark(everything, new Set(['c4::', 'c1::']), height, universe)!;
    expect(out.marks).toEqual(new Set(['c4::', 'c1::', height]));
    expect(out.selection.groups).toEqual(without('c4::size'));
  });
  it('a group of a collection that was off brings it back', () => {
    const sel = { collections: new Set(['c1']), groups: new Set(['c1::color', 'c1::color/dark']) };
    const out = toggleMark(sel, new Set(['c1::']), markId('c2', 'space'), universe)!;
    expect(out.selection.collections).toEqual(new Set(['c1', 'c2']));
    expect(out.selection.groups).toEqual(new Set(['c1::color', 'c1::color/dark', 'c2::space']));
  });
  it('ignores rows that no longer exist and drops their marks', () => {
    expect(toggleMark(everything, new Set(), 'old::', universe)).toBe(null);
    const out = toggleMark(everything, new Set(['old::', 'c1::']), 'c2::', universe)!;
    expect(out.marks).toEqual(new Set(['c1::', 'c2::']));
  });
});

const btn = markId('c5', 'btn');
const primary = markId('c5', 'btn/primary');
const ghost = markId('c5', 'btn/ghost');

describe('toggleMark on a row under a marked folder', () => {
  it('takes the child out of the selection; the folder ring moves to the children left', () => {
    const sel = selectOnly(rowOf(btn), universe);
    const out = toggleMark(sel, new Set([btn]), primary, universe)!;
    expect(out.selection.groups).toEqual(without('c5::btn/primary', 'c5::link'));
    expect(out.marks).toEqual(new Set([ghost]));
    // Cmd-click again: it joins back, ringed next to its sibling.
    const back = toggleMark(out.selection, out.marks, primary, universe)!;
    expect(back.selection.groups).toEqual(sel.groups);
    expect(back.marks).toEqual(new Set([ghost, primary]));
  });
  it('also when the child is ringed itself', () => {
    const sel = selectOnly(rowOf(btn), universe);
    const out = toggleMark(sel, new Set([btn, primary]), primary, universe)!;
    expect(out.selection.groups).toEqual(without('c5::btn/primary', 'c5::link'));
    expect(out.marks).toEqual(new Set([ghost]));
  });
  it('keeps the last pick: the only child of the only marked folder cannot leave', () => {
    const sel = selectOnly(rowOf(action), universe);
    expect(toggleMark(sel, new Set([action]), height, universe)).toBe(null);
    // With a pick elsewhere it leaves and its collection is fully shown again.
    const out = toggleMark(sel, new Set([action, 'c1::']), height, universe)!;
    expect(out.selection.groups).toEqual(everything.groups);
    expect(out.marks).toEqual(new Set(['c1::']));
  });
  it('a collection mark does not cover its groups: a group still narrows it', () => {
    const out = toggleMark(everything, new Set(['c5::']), primary, universe)!;
    expect(out.selection.groups).toEqual(without('c5::btn/ghost', 'c5::link'));
  });
});

describe('toggleMark keeps hidden marks', () => {
  it('a mark hidden by Hide unused survives a Cmd-click and shows again after Show all', () => {
    const narrowed = selectOnly(rowOf(height), universe);
    // Hide unused unchecks height (and c4 with it).
    const hiding = { collections: new Set(['c1', 'c2', 'c3', 'c5']), groups: without('c4::action/height', 'c4::size') };
    const out = toggleMark(hiding, new Set([height, 'c1::']), 'c2::', universe)!;
    expect(out.marks).toEqual(new Set([height, 'c1::', 'c2::']));
    expect(visibleMarks(out.marks, narrowed, universe)).toEqual(new Set([height, 'c1::', 'c2::']));
  });
});

// c: folder `a` (`a/b/c`, `a/b/d`, `a/e`) next to group `f`.
const hideUniverse: SidebarUniverse = {
  collectionIds: ['c', 'o'],
  groupKeysByCollection: new Map([
    ['c', ['c::a/b/c', 'c::a/b/d', 'c::a/e', 'c::f']],
    ['o', ['o::x']],
  ]),
};
const hRow = (id: string) => markRow(id, hideUniverse) as SidebarRow;
const cKeys = (sel: { groups: Set<string> }) => Array.from(sel.groups).filter(key => key.startsWith('c::')).sort();
const hiding = (sel: { collections: Set<string>; groups: Set<string> }, ...unchecked: string[]) => ({
  collections: sel.collections,
  groups: new Set(Array.from(sel.groups).filter(key => !unchecked.includes(key))),
});

describe('toggleMark while Hide unused hides a ringed row', () => {
  const picked = selectOnly(hRow('c::a'), hideUniverse);
  const hidden = hiding(picked, 'c::a/b/c');

  it('a hidden ring still narrows its collection: a Cmd-clicked group joins it', () => {
    const out = toggleMark(hidden, new Set(['c::a']), 'c::f', hideUniverse)!;
    expect(cKeys(out.selection)).toEqual(['c::a/b/d', 'c::a/e', 'c::f']);
    expect(visibleMarks(out.marks, out.selection, hideUniverse)).toEqual(new Set(['c::f']));
    // Show all re-checks a/b/c: both rings are back.
    const shown = { collections: out.selection.collections, groups: new Set([...out.selection.groups, 'c::a/b/c']) };
    expect(visibleMarks(out.marks, shown, hideUniverse)).toEqual(new Set(['c::a', 'c::f']));
  });
  it('a group under the hidden ring leaves, the ring moves to the rest', () => {
    const out = toggleMark(hidden, new Set(['c::a']), 'c::a/e', hideUniverse)!;
    expect(cKeys(out.selection)).toEqual(['c::a/b/d']);
    expect(out.marks).toEqual(new Set(['c::a/b']));
    const shown = { collections: out.selection.collections, groups: new Set([...out.selection.groups, 'c::a/b/c']) };
    expect(visibleMarks(out.marks, shown, hideUniverse)).toEqual(new Set(['c::a/b']));
  });
  it('does not show the whole collection again while a hidden pick of it remains', () => {
    // Plain-click a/e, Cmd-click f, Hide unused unchecks f, Cmd-click a/e.
    const ae = selectOnly(hRow('c::a/e'), hideUniverse);
    const both = toggleMark(ae, new Set(['c::a/e']), 'c::f', hideUniverse)!;
    const hidingF = hiding(both.selection, 'c::f');
    const out = toggleMark(hidingF, both.marks, 'c::a/e', hideUniverse)!;
    expect(cKeys(out.selection)).toEqual([]);
    expect(out.marks).toEqual(new Set(['c::f']));
    // Show all re-checks f: C shows f, ringed.
    const shown = { collections: out.selection.collections, groups: new Set([...out.selection.groups, 'c::f']) };
    expect(visibleMarks(out.marks, shown, hideUniverse)).toEqual(new Set(['c::f']));
    expect(cKeys(shown)).toEqual(['c::f']);
  });
  it('taking the last shown group out does not re-check what Hide unused holds unchecked', () => {
    const two = toggleMark(hidden, new Set(['c::a']), 'c::f', hideUniverse)!;
    const out = toggleMark(two.selection, two.marks, 'c::f', hideUniverse)!;
    expect(cKeys(out.selection)).toEqual(['c::a/b/d', 'c::a/e']);
    expect(out.marks).toEqual(new Set(['c::a']));
  });
});

// k: folder `btn` with variables of its own (group `btn`) and subgroups.
const ownUniverse: SidebarUniverse = {
  collectionIds: ['k'],
  groupKeysByCollection: new Map([['k', ['k::btn', 'k::btn/a', 'k::btn/b', 'k::z']]]),
};

describe('toggleMark on a folder with variables of its own', () => {
  it('keeps the folder ringed for its own variables when a subgroup leaves', () => {
    const sel = selectOnly(markRow('k::btn', ownUniverse) as SidebarRow, ownUniverse);
    const one = toggleMark(sel, new Set(['k::btn']), 'k::btn/a', ownUniverse)!;
    expect(Array.from(one.selection.groups).sort()).toEqual(['k::btn', 'k::btn/b']);
    expect(one.marks).toEqual(new Set(['k::btn/', 'k::btn/b']));
    expect(markRow('k::btn/', ownUniverse)).toEqual({ kind: 'group', collectionId: 'k', groupKeys: ['k::btn'] });
    const two = toggleMark(one.selection, one.marks, 'k::btn/b', ownUniverse)!;
    expect(Array.from(two.selection.groups)).toEqual(['k::btn']);
    expect(visibleMarks(two.marks, two.selection, ownUniverse)).toEqual(new Set(['k::btn/']));
    // It is the last pick: Cmd-clicking the folder row cannot take it out.
    expect(toggleMark(two.selection, two.marks, 'k::btn', ownUniverse)).toBe(null);
  });
  it('Cmd-click on a folder ringed for its own variables takes them out, like any ringed row', () => {
    const sel = selectOnly(markRow('k::btn', ownUniverse) as SidebarRow, ownUniverse);
    const one = toggleMark(sel, new Set(['k::btn']), 'k::btn/a', ownUniverse)!;
    const out = toggleMark(one.selection, one.marks, 'k::btn', ownUniverse)!;
    expect(Array.from(out.selection.groups)).toEqual(['k::btn/b']);
    expect(out.marks).toEqual(new Set(['k::btn/b']));
  });
});

describe('no rings inside rings', () => {
  it('ringing a folder drops the rings under it', () => {
    const sel = selectOnly(rowOf(height), universe);
    expect(toggleMark(sel, new Set([height]), action, universe)!.marks).toEqual(new Set([action]));
  });
  it('a ring under a shown ring is not shown', () => {
    const sel = selectOnly(hRow('c::a'), hideUniverse);
    expect(visibleMarks(new Set(['c::a', 'c::a/e']), sel, hideUniverse)).toEqual(new Set(['c::a']));
  });
});
