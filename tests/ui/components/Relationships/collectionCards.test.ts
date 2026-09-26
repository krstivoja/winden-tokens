import { describe, it, expect } from 'vitest';
import {
  buildCollectionCards,
  getCollectionCardKey,
  getGroupHeight,
  isCardHidden,
} from '../../../../src/ui/components/Relationships/GroupedGraph/utils';
import type { CardVisibilityFilters } from '../../../../src/ui/components/Relationships/GroupedGraph/utils';
import type { CollectionData, VariableData } from '../../../../src/ui/types';
import type { GroupData, VariableNode } from '../../../../src/ui/components/Relationships/GroupedGraph/types';

const collection = (id: string, name: string): CollectionData => ({
  id,
  name,
  modes: [{ modeId: `${id}-mode`, name: 'Mode 1' }],
});

const row = (id: string, name: string): VariableNode => ({
  id,
  name,
  shortName: name.split('/').pop() || name,
  displayName: name,
  color: '#ffffff',
  value: '#ffffff',
  resolvedValue: '#ffffff',
  isReference: false,
  referenceName: null,
});

const loose = (entries: Array<[string, VariableNode[]]>) => new Map(entries);

describe('buildCollectionCards', () => {
  it('emits a root card for a collection that has no variables', () => {
    const cards = buildCollectionCards([collection('c1', 'Marco')], loose([]), 0);

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      key: 'collection:c1',
      title: 'Marco',
      kind: 'collection',
      collectionId: 'c1',
      variables: [],
    });
    // No group path: the "+" must create at the collection root, unprefixed.
    expect(cards[0].sourceGroupName).toBeUndefined();
  });

  it('still emits a root card when every variable of the collection is grouped', () => {
    // The card IS the collection root — the only "+" that can create a
    // slash-less variable. A collection holding only `color/brand/500` would
    // otherwise have no way back to its own root.
    const cards = buildCollectionCards([collection('c1', 'Marco')], loose([]), 0);

    expect(cards.map(c => c.key)).toEqual(['collection:c1']);
    expect(cards[0].variables).toEqual([]);
  });

  it('carries the collection loose (slash-less) variables as its rows', () => {
    const marko = row('v1', 'marko');
    const cards = buildCollectionCards(
      [collection('c1', 'Marco')],
      loose([['c1', [marko]]]),
      0
    );

    expect(cards[0].variables).toEqual([marko]);
  });

  it('emits exactly one card per collection, always', () => {
    const cards = buildCollectionCards(
      [collection('c1', 'Colors'), collection('c2', 'Spacing')],
      loose([['c1', [row('v1', 'test')]]]),
      0
    );

    expect(cards.map(c => c.collectionId)).toEqual(['c1', 'c2']);
    expect(cards.map(c => c.variables.length)).toEqual([1, 0]);
  });

  it('keeps a loose variable off the same-named group card', () => {
    // The bug: variable `test` fell back to its own name as a group name and
    // merged with the parent path of `test/test2`. The loose one now lives on
    // the collection card instead, so the two can never share a key.
    const cards = buildCollectionCards(
      [collection('c1', 'Marco')],
      loose([['c1', [row('v1', 'test')]]]),
      0
    );

    expect(cards[0].key).toBe('collection:c1');
    expect(cards[0].key).not.toBe('group:test');
    expect(cards[0].variables.map(v => v.name)).toEqual(['test']);
  });

  it('orders cards by collection name and stacks them without overlap', () => {
    const cards = buildCollectionCards(
      [collection('c2', 'Zeta'), collection('c1', 'Alpha')],
      loose([['c1', [row('v1', 'one'), row('v2', 'two')]]]),
      100
    );

    expect(cards.map(c => c.title)).toEqual(['Alpha', 'Zeta']);
    expect(cards[0].initialY).toBe(100);
    // Stacking uses the card's real height, so the two-row Alpha card cannot
    // overlap Zeta below it.
    expect(cards[1].initialY).toBeGreaterThan(cards[0].initialY + getGroupHeight(cards[0]) - 1);
    expect(cards.every(c => c.initialX === 0)).toBe(true);
  });

  it('keys cards in their own namespace so they cannot collide with group cards', () => {
    const cards = buildCollectionCards([collection('c1', 'Marco')], loose([]), 0);

    expect(cards[0].key).toBe(getCollectionCardKey('c1'));
    expect(cards[0].key.startsWith('group:')).toBe(false);
    expect(cards[0].key.startsWith('source:')).toBe(false);
    expect(cards[0].key.startsWith('shader:')).toBe(false);
    expect(cards[0].key.startsWith('shades:')).toBe(false);
    expect(cards[0].key.startsWith('ext-group:')).toBe(false);
  });
});

describe('getGroupHeight', () => {
  const card = (variables: GroupData['variables']): GroupData => ({
    key: 'k', title: 't', variables,
    x: 0, y: 0, initialX: 0, initialY: 0,
    kind: 'collection', headerFill: '#000', collectionId: 'c1',
  });

  it('reserves one row of body for an empty card', () => {
    // 36 header + 1 * 32 row + 2 * 8 padding
    expect(getGroupHeight(card([]))).toBe(84);
  });

  it('is unchanged for cards that do have rows', () => {
    expect(getGroupHeight(card([row('v1', 'red')]))).toBe(84);
  });

  it('grows with the rows a collection root card now carries', () => {
    expect(getGroupHeight(card([row('v1', 'a'), row('v2', 'b')]))).toBe(116);
  });
});

describe('isCardHidden — collection root cards', () => {
  const sourceVariable = (id: string, name: string, resolvedType: VariableData['resolvedType']): VariableData => ({
    id, collectionId: 'c1', name, resolvedType, value: '#ffffff', valuesByMode: {},
  });

  const filters = (overrides: Partial<CardVisibilityFilters> = {}): CardVisibilityFilters => ({
    selectedCollections: new Set(['c1']),
    selectedTypes: new Set(['COLOR']),
    selectedGroups: new Set<string>(),
    variablesById: new Map([
      ['v1', sourceVariable('v1', 'marko', 'COLOR')],
      ['v2', sourceVariable('v2', 'gap', 'FLOAT')],
    ]),
    ...overrides,
  });

  it('shows a row-less card whenever its collection is selected', () => {
    // It is the collection's root and its only "+" — an empty `.some()` over
    // the type filter must not park it with the hidden units.
    const [card] = buildCollectionCards([collection('c1', 'Marco')], loose([]), 0);
    expect(isCardHidden(card, filters())).toBe(false);
  });

  it('hides a row-less card when its collection is deselected', () => {
    const [card] = buildCollectionCards([collection('c1', 'Marco')], loose([]), 0);
    expect(isCardHidden(card, filters({ selectedCollections: new Set() }))).toBe(true);
  });

  it('applies the ordinary type filter once it holds rows', () => {
    const [card] = buildCollectionCards(
      [collection('c1', 'Marco')],
      loose([['c1', [row('v2', 'gap')]]]),
      0
    );
    // Only COLOR is selected and the single loose row is a FLOAT.
    expect(isCardHidden(card, filters())).toBe(true);
    expect(isCardHidden(card, filters({ selectedTypes: new Set(['FLOAT']) }))).toBe(false);
  });

  it('is never hidden by the group filter, since loose rows have no group', () => {
    const [card] = buildCollectionCards(
      [collection('c1', 'Marco')],
      loose([['c1', [row('v1', 'marko')]]]),
      0
    );
    // selectedGroups is empty: a grouped card would be hidden here.
    expect(isCardHidden(card, filters())).toBe(false);
  });
});
