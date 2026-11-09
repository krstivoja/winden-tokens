import { describe, it, expect } from 'vitest';
import {
  buildCollectionCards,
  isCardHidden,
} from '../../../../src/ui/components/Relationships/GroupedGraph/utils';
import type { CardVisibilityFilters } from '../../../../src/ui/components/Relationships/GroupedGraph/utils';
import {
  planSidebarUncheck,
  applySidebarUncheck,
  getHideUnusedGroupKeys,
} from '../../../../src/ui/components/Relationships/GroupedGraph/hideUnused';
import type { HighlightPath } from '../../../../src/ui/components/Relationships/GroupedGraph/hideUnused';
import { getGroupKeysByCollection } from '../../../../src/ui/utils/groupFilters';
import type { VariableData } from '../../../../src/ui/types';
import type { GroupData, VariableNode } from '../../../../src/ui/components/Relationships/GroupedGraph/types';

const source = (id: string, collectionId: string, name: string): VariableData => ({
  id, collectionId, name, resolvedType: 'COLOR', value: '#ffffff', valuesByMode: {},
});

const node = (id: string, name: string): VariableNode => ({
  id, name, shortName: name.split('/').pop() || name, displayName: name,
  color: '#fff', value: '#fff', resolvedValue: '#fff', isReference: false, referenceName: null,
});

const card = (collectionId: string, groupName: string, ids: string[], names: string[]): GroupData => ({
  key: `group:${collectionId}::${groupName}`,
  title: groupName,
  variables: names.map((n, i) => node(ids[i], n)),
  x: 0, y: 0, initialX: 0, initialY: 0,
  kind: 'standard',
  headerFill: '#000',
  collectionId,
});

// Collection "c1" ("color"): two groups plus loose variables. "c2" is another collection.
const variables = [
  source('a', 'c1', 'color/background/primary'),
  source('b', 'c1', 'checkbox/color/unchecked'),
  source('l', 'c1', 'screen'),
  source('o', 'c2', 'spacing/small'),
];
const byId = new Map(variables.map(v => [v.id, v]));
const keys = getGroupKeysByCollection(variables);

const bg = card('c1', 'color/background', ['a'], ['color/background/primary']);
const checkbox = card('c1', 'checkbox/color', ['b'], ['checkbox/color/unchecked']);
const other = card('c2', 'spacing', ['o'], ['spacing/small']);
const [rootC1] = buildCollectionCards(
  [{ id: 'c1', name: 'color', modes: [] }],
  new Map([['c1', [node('l', 'screen')]]]),
  0
);
const [rootC2] = buildCollectionCards([{ id: 'c2', name: 'spacing', modes: [] }], new Map(), 0);

const filters = (selectedGroups: string[], extra: Partial<CardVisibilityFilters> = {}): CardVisibilityFilters => ({
  selectedCollections: new Set(['c1', 'c2']),
  selectedTypes: new Set(['COLOR']),
  selectedGroups: new Set(selectedGroups),
  variablesById: byId,
  groupKeysByCollection: keys,
  ...extra,
});

// What a click on c1's "color/background" row selects: that key, plus all of c2's.
const clickedBackground = ['c1::color/background', 'c2::spacing'];

describe('graph cards follow the sidebar group selection', () => {
  it('keeps only the clicked group inside its collection', () => {
    const f = filters(clickedBackground);
    expect(isCardHidden(bg, f)).toBe(false);
    expect(isCardHidden(checkbox, f)).toBe(true);
  });

  it('hides the collection root card with loose variables until every group is selected', () => {
    expect(isCardHidden(rootC1, filters(clickedBackground))).toBe(true);
    expect(isCardHidden(rootC1, filters(['c1::color/background', 'c1::checkbox/color', 'c2::spacing']))).toBe(false);
  });

  it('leaves other collections fully visible', () => {
    const f = filters(clickedBackground);
    expect(isCardHidden(other, f)).toBe(false);
    expect(isCardHidden(rootC2, f)).toBe(false);
  });

  it('does not hide a root card for keys that Hide unused unchecked', () => {
    const f = filters(['c1::color/background', 'c2::spacing'], {
      hideUnusedGroupKeys: new Set(['c1::checkbox/color']),
    });
    expect(isCardHidden(rootC1, f)).toBe(false);
    // The group card itself is still the filter's to hide.
    expect(isCardHidden(checkbox, f)).toBe(true);
  });
});

describe('Hide unused keeps the sidebar narrowing', () => {
  const vars = [
    source('a1', 'A', 'accent/x'),
    source('a2', 'A', 'neutral/x'),
    source('a3', 'A', 'card'),
    source('b1', 'B', 'brand/x'),
    source('b2', 'B', 'btn/x'),
    source('b3', 'B', 'card'),
  ];
  const aKeys = getGroupKeysByCollection(vars);
  const accent = card('A', 'accent', ['a1'], ['accent/x']);
  const neutral = card('A', 'neutral', ['a2'], ['neutral/x']);
  const brand = card('B', 'brand', ['b1'], ['brand/x']);
  const btn = card('B', 'btn', ['b2'], ['btn/x']);
  const [rootA] = buildCollectionCards([{ id: 'A', name: 'A', modes: [] }], new Map([['A', [node('a3', 'card')]]]), 0);
  const [rootB] = buildCollectionCards([{ id: 'B', name: 'B', modes: [] }], new Map([['B', [node('b3', 'card')]]]), 0);
  const cards = [accent, neutral, rootA, brand, btn, rootB];
  const path = { groups: new Set([brand.key]) } as unknown as HighlightPath;

  it('does not widen a collection the user narrowed', () => {
    const plan = planSidebarUncheck(cards, path);
    // User narrowed A to accent; B is fully selected.
    const selection = {
      groups: new Set(['A::accent', 'B::brand', 'B::btn']),
      collections: new Set(['A', 'B']),
    };
    const { selection: next, own } = applySidebarUncheck(
      plan, selection, { groups: new Set(), collections: new Set() }
    );
    const f: CardVisibilityFilters = {
      selectedCollections: next.collections,
      selectedTypes: new Set(['COLOR']),
      selectedGroups: next.groups,
      variablesById: new Map(vars.map(v => [v.id, v])),
      groupKeysByCollection: aKeys,
      hideUnusedGroupKeys: getHideUnusedGroupKeys(true, own),
    };
    expect(isCardHidden(rootA, f)).toBe(true);
    // What Hide unused itself unchecked in B still keeps B's root card.
    expect(isCardHidden(rootB, f)).toBe(false);
  });
});
