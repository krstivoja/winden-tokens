import { describe, it, expect } from 'vitest';
import {
  buildEmptyCollectionCards,
  getCollectionCardKey,
  getGroupHeight,
} from '../../../../src/ui/components/Relationships/GroupedGraph/utils';
import type { CollectionData, VariableData } from '../../../../src/ui/types';
import type { GroupData } from '../../../../src/ui/components/Relationships/GroupedGraph/types';

const collection = (id: string, name: string): CollectionData => ({
  id,
  name,
  modes: [{ modeId: `${id}-mode`, name: 'Mode 1' }],
});

const variable = (id: string, collectionId: string, name: string): VariableData => ({
  id,
  collectionId,
  name,
  resolvedType: 'COLOR',
  value: '#ffffff',
  valuesByMode: {},
});

describe('buildEmptyCollectionCards', () => {
  it('emits a card for a collection that has no variables', () => {
    const cards = buildEmptyCollectionCards(
      [collection('c1', 'Marco')],
      [],
      0
    );

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

  it('emits nothing for a collection that has at least one variable', () => {
    const cards = buildEmptyCollectionCards(
      [collection('c1', 'Marco')],
      [variable('v1', 'c1', 'brand/primary')],
      0
    );

    expect(cards).toEqual([]);
  });

  it('drops the placeholder as soon as the first variable lands in the collection', () => {
    const collections = [collection('c1', 'Marco')];
    expect(buildEmptyCollectionCards(collections, [], 0)).toHaveLength(1);
    // Same derivation, one variable later — the reload that follows the
    // create-variable message removes the card on its own.
    expect(buildEmptyCollectionCards(collections, [variable('v1', 'c1', 'red')], 0)).toEqual([]);
  });

  it('also emits for a root-level variable with no group path', () => {
    // A variable at the collection root still counts as "has variables".
    const cards = buildEmptyCollectionCards(
      [collection('c1', 'Marco'), collection('c2', 'Empty')],
      [variable('v1', 'c1', 'ungrouped')],
      0
    );

    expect(cards.map(c => c.collectionId)).toEqual(['c2']);
  });

  it('only covers collections with zero variables, never merely filtered-out ones', () => {
    // Both collections have variables; a type/search filter hiding them is a
    // render-time concern and must not produce a duplicate placeholder here.
    const cards = buildEmptyCollectionCards(
      [collection('c1', 'Colors'), collection('c2', 'Spacing')],
      [variable('v1', 'c1', 'brand/primary'), variable('v2', 'c2', 'space/1')],
      0
    );

    expect(cards).toEqual([]);
  });

  it('orders cards by collection name and stacks them without overlap', () => {
    const cards = buildEmptyCollectionCards(
      [collection('c2', 'Zeta'), collection('c1', 'Alpha')],
      [],
      100
    );

    expect(cards.map(c => c.title)).toEqual(['Alpha', 'Zeta']);
    expect(cards[0].initialY).toBe(100);
    expect(cards[1].initialY).toBeGreaterThan(cards[0].initialY + getGroupHeight(cards[0]) - 1);
    expect(cards.every(c => c.initialX === 0)).toBe(true);
  });

  it('keys cards in their own namespace so they cannot collide with group cards', () => {
    const cards = buildEmptyCollectionCards([collection('c1', 'Marco')], [], 0);

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
    const oneRow = card([{
      id: 'v1', name: 'red', shortName: 'red', displayName: 'red',
      color: '#f00', value: '#f00', resolvedValue: '#f00',
      isReference: false, referenceName: null,
    }]);
    expect(getGroupHeight(oneRow)).toBe(84);
  });
});
