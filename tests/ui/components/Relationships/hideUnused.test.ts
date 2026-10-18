import { describe, it, expect } from 'vitest';
import {
  applySidebarUncheck,
  collectionToggleEndsHiding,
  computeHighlightPath,
  getActiveHidingLayout,
  mergeHidingPositions,
  getHidingPath,
  isCardHiddenByHideUnused,
  isCardOffPath,
  planSidebarUncheck,
  isEdgeOffPath,
  isTierLabelHidden,
} from '../../../../src/ui/components/Relationships/GroupedGraph/hideUnused';
import type { HidingLayout } from '../../../../src/ui/components/Relationships/GroupedGraph/hideUnused';
import { isCardHidden } from '../../../../src/ui/components/Relationships/GroupedGraph/utils';
import type { CardVisibilityFilters } from '../../../../src/ui/components/Relationships/GroupedGraph/utils';
import { STANDARD_GROUP_HEADER_FILL } from '../../../../src/ui/components/Relationships/GroupedGraph/constants';
import type {
  ConnectionRecord,
  GroupData,
  VariableNode,
} from '../../../../src/ui/components/Relationships/GroupedGraph/types';
import type { VariableData } from '../../../../src/ui/types';

// ── Fixtures ───────────────────────────────────────────────────────
//
//   A: a/1 ──e1──▶ B: b/1 ──e2──▶ C: c/1
//   A: a/2 ──e3──▶ D: d/1
//   E: e/1  (unconnected)

const row = (name: string): VariableNode => ({
  id: `v:${name}`,
  name,
  shortName: name.split('/').pop() || name,
  displayName: name,
  color: '#ffffff',
  value: '#ffffff',
  resolvedValue: '#ffffff',
  resolvedType: 'COLOR',
  isReference: false,
  referenceName: null,
});

const card = (key: string, collectionId: string, rows: string[]): GroupData => ({
  key,
  title: key,
  variables: rows.map(row),
  x: 0,
  y: 0,
  initialX: 0,
  initialY: 0,
  kind: 'standard',
  sourceGroupName: key,
  headerFill: STANDARD_GROUP_HEADER_FILL,
  collectionId,
});

const groups = [
  card('A', 'one', ['a/1', 'a/2']),
  card('B', 'two', ['b/1']),
  card('C', 'one', ['c/1']),
  card('D', 'one', ['d/1']),
  card('E', 'one', ['e/1']),
];

const conn = (id: string, fromGroup: string, fromVar: string, toGroup: string, toVar: string): ConnectionRecord => ({
  id, kind: 'reference', fromGroup, fromVar, toGroup, toVar,
});

const connections = [
  conn('e1', 'A', 'a/1', 'B', 'b/1'),
  conn('e2', 'B', 'b/1', 'C', 'c/1'),
  conn('e3', 'A', 'a/2', 'D', 'd/1'),
];

const variableGroup = new Map<string, { group: string }>();
groups.forEach(g => g.variables.forEach(v => variableGroup.set(v.name, { group: g.key })));

const pathFor = (groupKey: string | null, varName: string | null = null) =>
  computeHighlightPath(groupKey, varName, groups, connections, variableGroup);

const hidingFor = (groupKey: string | null, varName: string | null = null) =>
  getHidingPath(true, pathFor(groupKey, varName));

const hiddenCards = (hidingPath: ReturnType<typeof hidingFor>) =>
  groups.map(g => g.key).filter(key => isCardOffPath(key, hidingPath));

const hiddenEdges = (hidingPath: ReturnType<typeof hidingFor>) =>
  connections.map(c => c.id).filter(id => isEdgeOffPath(id, hidingPath));

// ── computeHighlightPath ───────────────────────────────────────────

describe('computeHighlightPath', () => {
  it('is null when nothing is highlighted', () => {
    expect(pathFor(null)).toBeNull();
  });

  it('walks one row upstream and downstream without picking up siblings', () => {
    const path = pathFor('A', 'a/1')!;
    expect([...path.groups].sort()).toEqual(['A', 'B', 'C']);
    expect([...path.edgeIds].sort()).toEqual(['e1', 'e2']);
    expect([...path.selectedCardVars].sort()).toEqual(['a/1', 'a/2']);
  });

  it('walks every row of a highlighted card', () => {
    const path = pathFor('A')!;
    expect([...path.groups].sort()).toEqual(['A', 'B', 'C', 'D']);
    expect([...path.edgeIds].sort()).toEqual(['e1', 'e2', 'e3']);
  });

  it('survives undo/redo recreating every variable id (keyed by card key and name)', () => {
    const recreated = groups.map(g => ({
      ...g,
      variables: g.variables.map(v => ({ ...v, id: `recreated:${v.id}` })),
    }));
    const before = pathFor('A', 'a/1')!;
    const after = computeHighlightPath('A', 'a/1', recreated, connections, variableGroup)!;
    expect([...after.groups].sort()).toEqual([...before.groups].sort());
    expect([...after.edgeIds].sort()).toEqual([...before.edgeIds].sort());
  });

  it('walks upstream from a downstream card', () => {
    const path = pathFor('C')!;
    expect([...path.groups].sort()).toEqual(['A', 'B', 'C']);
    expect([...path.edgeIds].sort()).toEqual(['e1', 'e2']);
  });
});

// ── Hide-unused predicates ─────────────────────────────────────────

describe('hide unused', () => {
  it('hides nothing while the toggle is off', () => {
    const hidingPath = getHidingPath(false, pathFor('A', 'a/1'));
    expect(hidingPath).toBeNull();
    expect(hiddenCards(hidingPath)).toEqual([]);
    expect(hiddenEdges(hidingPath)).toEqual([]);
  });

  it('hides nothing with no highlight, even with the toggle on', () => {
    const hidingPath = hidingFor(null);
    expect(hidingPath).toBeNull();
    expect(hiddenCards(hidingPath)).toEqual([]);
    expect(hiddenEdges(hidingPath)).toEqual([]);
  });

  it('keeps on-path cards and hides off-path ones', () => {
    expect(hiddenCards(hidingFor('C'))).toEqual(['D', 'E']);
  });

  it('keeps only the walked edges', () => {
    expect(hiddenEdges(hidingFor('C'))).toEqual(['e3']);
  });

  it('hides the highlighted card\'s own off-chain (group sibling) edges on a row highlight', () => {
    // e3 leaves a/2 — same card as the highlighted row, different chain.
    expect(hiddenEdges(hidingFor('A', 'a/1'))).toEqual(['e3']);
    expect(hiddenCards(hidingFor('A', 'a/1'))).toEqual(['D', 'E']);
  });

  it('keeps everything the path reaches on a whole-card highlight', () => {
    expect(hiddenCards(hidingFor('A'))).toEqual(['E']);
    expect(hiddenEdges(hidingFor('A'))).toEqual([]);
  });

  it('keeps the highlighted card even when it has no connections', () => {
    expect(hiddenCards(hidingFor('E'))).toEqual(['A', 'B', 'C', 'D']);
    expect(hiddenEdges(hidingFor('E'))).toEqual(['e1', 'e2', 'e3']);
  });

  it('hides a synthetic library card unless it is the highlighted one', () => {
    expect(isCardOffPath('ext-group:brand', hidingFor('A'))).toBe(true);
    const onExternal = getHidingPath(true, computeHighlightPath(
      'ext-group:brand', null, groups, connections, variableGroup
    ));
    expect(isCardOffPath('ext-group:brand', onExternal)).toBe(false);
  });

  it('never un-hides a filtered card (OR\'d with isCardHidden)', () => {
    const variablesById = new Map<string, VariableData>();
    groups.forEach(g => g.variables.forEach(v => variablesById.set(v.id, {
      id: v.id, collectionId: g.collectionId, name: v.name, resolvedType: 'COLOR', value: '#ffffff', valuesByMode: {},
    })));
    // Collection `two` (card B) deselected; B is on the path from C.
    const filters: CardVisibilityFilters = {
      selectedCollections: new Set(['one']),
      selectedTypes: new Set(['COLOR']),
      // Every row's own group (`a/1` → `a`), so only the collection filter bites.
      selectedGroups: new Set(groups.flatMap(g => g.variables.map(v => `${g.collectionId}::${v.name.split('/')[0]}`))),
      variablesById,
    };
    const hidingPath = hidingFor('C');
    const hidden = (g: GroupData) => isCardHidden(g, filters) || isCardOffPath(g.key, hidingPath);
    expect(groups.filter(hidden).map(g => g.key)).toEqual(['B', 'D', 'E']);
  });
});

// ── Sidebar uncheck ────────────────────────────────────────────────

describe('planSidebarUncheck', () => {
  const sorted = (set: Set<string>) => [...set].sort();

  it('plans nothing without a hiding path', () => {
    const plan = planSidebarUncheck(groups, null);
    expect(plan.groupKeys.size + plan.collectionIds.size + plan.coveredCards.size).toBe(0);
  });

  it('unchecks the off-path groups and keeps collections that still hold the path', () => {
    const plan = planSidebarUncheck(groups, hidingFor('C'));
    expect(sorted(plan.groupKeys)).toEqual(['one::d', 'one::e']);
    expect(sorted(plan.collectionIds)).toEqual([]);
    expect(sorted(plan.coveredCards)).toEqual(['D', 'E']);
  });

  it('unchecks a collection with nothing on the path, together with its groups', () => {
    const plan = planSidebarUncheck(groups, hidingFor('E'));
    expect(sorted(plan.groupKeys)).toEqual(['one::a', 'one::c', 'one::d', 'two::b']);
    expect(sorted(plan.collectionIds)).toEqual(['two']);
    expect(sorted(plan.coveredCards)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('works at the finest group level, so an on-path group survives its unchecked siblings', () => {
    const nested = [
      card('brand', 'one', ['color/brand/1']),
      card('accent', 'one', ['color/brand/accent/1']),
      card('other', 'one', ['color/other/1']),
    ];
    const path = getHidingPath(true, computeHighlightPath('accent', null, nested, [], new Map(
      nested.flatMap(g => g.variables.map(v => [v.name, { group: g.key }] as const))
    )));
    const plan = planSidebarUncheck(nested, path);
    expect(sorted(plan.groupKeys)).toEqual(['one::color/brand', 'one::color/other']);
  });

  it('leaves a collection root next to an on-path group to hide-unused itself', () => {
    const rootOne: GroupData = { ...card('collection:one', 'one', ['loose']), kind: 'collection', sourceGroupName: undefined };
    const rootTwo: GroupData = { ...card('collection:two', 'two', []), kind: 'collection', sourceGroupName: undefined };
    const withRoots = [...groups, rootOne, rootTwo];
    const hidingPath = getHidingPath(true, computeHighlightPath('C', null, withRoots, connections, variableGroup));
    const plan = planSidebarUncheck(withRoots, hidingPath);
    // `one` holds the path, so its checkbox stays — and with it the root card.
    expect(plan.coveredCards.has('collection:one')).toBe(false);
    expect(isCardHiddenByHideUnused('collection:one', hidingPath, plan.coveredCards)).toBe(true);
    // `two` holds the path too (B), so its empty root is not covered either.
    expect(plan.coveredCards.has('collection:two')).toBe(false);
  });

  it('leaves a card that shares its group key with an on-path card to hide-unused itself', () => {
    const shades: GroupData = { ...card('shades:c', 'one', ['c/100']), kind: 'shades', sourceGroupName: 'c' };
    const withShades = [...groups, shades];
    const plan = planSidebarUncheck(withShades, hidingFor('C'));
    expect(plan.groupKeys.has('one::c')).toBe(false);
    expect(plan.coveredCards.has('shades:c')).toBe(false);
    expect(isCardHiddenByHideUnused('shades:c', hidingFor('C'), plan.coveredCards)).toBe(true);
  });

  it('never covers a library card — the tree has no checkbox for it', () => {
    const plan = planSidebarUncheck(groups, hidingFor('A'));
    expect(isCardHiddenByHideUnused('ext-group:brand', hidingFor('A'), plan.coveredCards)).toBe(true);
  });
});

describe('applySidebarUncheck', () => {
  const none = () => ({ groups: new Set<string>(), collections: new Set<string>() });
  const allGroups = () => new Set(['one::a', 'two::b', 'one::c', 'one::d', 'one::e']);

  it('unchecks the plan and records what it unchecked', () => {
    const { selection, own } = applySidebarUncheck(
      planSidebarUncheck(groups, hidingFor('C')),
      { groups: allGroups(), collections: new Set(['one', 'two']) },
      none()
    );
    expect([...selection.groups].sort()).toEqual(['one::a', 'one::c', 'two::b']);
    expect([...own.groups].sort()).toEqual(['one::d', 'one::e']);
  });

  it('does not claim a group the user had already unchecked', () => {
    const userUnchecked = allGroups();
    userUnchecked.delete('one::e');
    const { own } = applySidebarUncheck(
      planSidebarUncheck(groups, hidingFor('C')),
      { groups: userUnchecked, collections: new Set(['one', 'two']) },
      none()
    );
    expect([...own.groups]).toEqual(['one::d']);
  });

  it('re-checks only its own unchecks once a moved highlight puts them on the path', () => {
    const userUnchecked = allGroups();
    userUnchecked.delete('one::a');
    // Hiding from E unchecked a, b, c, d — but `a` was the user's already.
    const first = applySidebarUncheck(
      planSidebarUncheck(groups, hidingFor('E')),
      { groups: userUnchecked, collections: new Set(['one', 'two']) },
      none()
    );
    expect([...first.selection.groups]).toEqual(['one::e']);
    expect([...first.selection.collections]).toEqual(['one']);
    // Highlight moves to C (path A, B, C): b, c and collection two come back;
    // the user's `a` does not; e goes.
    const second = applySidebarUncheck(planSidebarUncheck(groups, hidingFor('C')), first.selection, first.own);
    expect([...second.selection.groups].sort()).toEqual(['one::c', 'two::b']);
    expect([...second.selection.collections].sort()).toEqual(['one', 'two']);
    expect([...second.own.groups].sort()).toEqual(['one::d', 'one::e']);
  });

  it('keeps the selection identity when nothing changes', () => {
    const selection = { groups: new Set(['one::a', 'two::b', 'one::c']), collections: new Set(['one', 'two']) };
    const result = applySidebarUncheck(planSidebarUncheck(groups, hidingFor('C')), selection, none());
    expect(result.selection.groups).toBe(selection.groups);
    expect(result.selection.collections).toBe(selection.collections);
  });

  it('hides the same cards through the filter, and a re-ticked group shows again', () => {
    const variablesById = new Map<string, VariableData>();
    groups.forEach(g => g.variables.forEach(v => variablesById.set(v.id, {
      id: v.id, collectionId: g.collectionId, name: v.name, resolvedType: 'COLOR', value: '#ffffff', valuesByMode: {},
    })));
    const hidingPath = hidingFor('C');
    const plan = planSidebarUncheck(groups, hidingPath);
    const { selection } = applySidebarUncheck(
      plan,
      { groups: allGroups(), collections: new Set(['one', 'two']) },
      none()
    );
    const hiddenWith = (selectedGroups: Set<string>) => groups.filter(g => isCardHidden(g, {
      selectedCollections: selection.collections,
      selectedTypes: new Set(['COLOR']),
      selectedGroups,
      variablesById,
    }) || isCardHiddenByHideUnused(g.key, hidingPath, plan.coveredCards)).map(g => g.key);
    expect(hiddenWith(selection.groups)).toEqual(['D', 'E']);
    // The user re-ticks `d` while hiding stays on.
    expect(hiddenWith(new Set([...selection.groups, 'one::d']))).toEqual(['E']);
  });
});

// ── Tier captions ──────────────────────────────────────────────────

describe('isTierLabelHidden', () => {
  const label = { tier: 2, x: 400, width: 300 };

  it('stays while a visible node overlaps its column', () => {
    expect(isTierLabelHidden(label, [{ x: 400, width: 300 }])).toBe(false);
    // A frame wider than one column, starting in the previous one.
    expect(isTierLabelHidden(label, [{ x: 0, width: 500 }])).toBe(false);
  });

  it('hides once nothing visible is left in its column', () => {
    expect(isTierLabelHidden(label, [])).toBe(true);
    // Neighbouring columns touch the edges but do not overlap.
    expect(isTierLabelHidden(label, [{ x: 100, width: 300 }, { x: 700, width: 300 }])).toBe(true);
  });
});

// ── Temporary arrange while hiding ─────────────────────────────────

describe('getActiveHidingLayout', () => {
  const layout: HidingLayout = { activation: '["A",null]', positions: {}, tierLabels: [] };

  it('applies only within the activation it was made in', () => {
    expect(getActiveHidingLayout(layout, '["A",null]')).toBe(layout);
    // Highlight moved to another card, or onto one row of the same card.
    expect(getActiveHidingLayout(layout, '["B",null]')).toBe(null);
    expect(getActiveHidingLayout(layout, '["A","a/1"]')).toBe(null);
    // Hiding ended.
    expect(getActiveHidingLayout(layout, null)).toBe(null);
  });

  it('is null with no layout', () => {
    expect(getActiveHidingLayout(null, '["A",null]')).toBe(null);
    expect(getActiveHidingLayout(null, null)).toBe(null);
  });
});

describe('mergeHidingPositions', () => {
  const saved = {
    A: { x: 0, y: 0 },
    'wrapper:one::b': { x: 400, y: 0 },
    'rel:B': { x: 10, y: 40 },
    E: { x: 1320, y: 0 },
  };

  it('returns the saved record itself without a temporary layout', () => {
    expect(mergeHidingPositions(saved, null)).toBe(saved);
  });

  it('lays the temporary positions over the saved ones, leaving the rest', () => {
    const merged = mergeHidingPositions(saved, {
      activation: '["A",null]',
      positions: { A: { x: 0, y: 200 }, 'wrapper:one::b': { x: 300, y: 0 } },
      tierLabels: [],
    });
    expect(merged).toEqual({
      A: { x: 0, y: 200 },
      'wrapper:one::b': { x: 300, y: 0 },
      // Nested override and the hidden card keep their saved spot.
      'rel:B': { x: 10, y: 40 },
      E: { x: 1320, y: 0 },
    });
    // Never written into the saved record.
    expect(saved.A).toEqual({ x: 0, y: 0 });
  });
});

describe('collectionToggleEndsHiding', () => {
  const selected = new Set(['one']);

  it('ends hiding when a collection is ticked on while hiding', () => {
    expect(collectionToggleEndsHiding(true, 'two', selected)).toBe(true);
  });

  it('keeps hiding when a collection is ticked off', () => {
    expect(collectionToggleEndsHiding(true, 'one', selected)).toBe(false);
  });

  it('does nothing while not hiding', () => {
    expect(collectionToggleEndsHiding(false, 'two', selected)).toBe(false);
  });
});
