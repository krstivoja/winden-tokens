import { describe, it, expect } from 'vitest';
import {
  arrangeGroupsByConnectedBlocks,
  buildArrangeUnits,
  getGroupHeight,
  isCardHidden,
} from '../../../../src/ui/components/Relationships/GroupedGraph/utils';
import type { CardVisibilityFilters } from '../../../../src/ui/components/Relationships/GroupedGraph/utils';
import {
  GROUP_GAP_X,
  GROUP_GAP_Y,
  GROUP_WIDTH,
  STANDARD_GROUP_HEADER_FILL,
  WRAPPER_GAP,
  WRAPPER_HEADER_HEIGHT,
  WRAPPER_PADDING,
} from '../../../../src/ui/components/Relationships/GroupedGraph/constants';
import type {
  GroupData,
  VariableNode,
} from '../../../../src/ui/components/Relationships/GroupedGraph/types';
import type { VariableData } from '../../../../src/ui/types';

// ── Fixtures ───────────────────────────────────────────────────────

const variable = (
  id: string,
  collectionId: string,
  name: string,
  resolvedType: VariableData['resolvedType'] = 'COLOR'
): VariableData => ({
  id,
  collectionId,
  name,
  resolvedType,
  value: '#ffffff',
  valuesByMode: {},
});

const row = (id: string, name: string, extra: Partial<VariableNode> = {}): VariableNode => ({
  id,
  name,
  shortName: name.split('/').pop() || name,
  displayName: name,
  color: '#ffffff',
  value: '#ffffff',
  resolvedValue: '#ffffff',
  resolvedType: 'COLOR',
  isReference: false,
  referenceName: null,
  ...extra,
});

const card = (
  key: string,
  collectionId: string,
  sourceGroupName: string,
  rows: VariableNode[],
  extra: Partial<GroupData> = {}
): GroupData => ({
  key,
  title: key,
  variables: rows,
  x: 0,
  y: 0,
  initialX: 0,
  initialY: 0,
  kind: 'standard',
  sourceGroupName,
  headerFill: STANDARD_GROUP_HEADER_FILL,
  collectionId,
  ...extra,
});

/**
 * The repro from the bug report, as data: a `_global` collection and a `color`
 * collection, each with one card.
 */
const globalCard = card('group:_global/spacing', '_global', '_global/spacing', [
  row('v-global-1', '_global/spacing/sm'),
  row('v-global-2', '_global/spacing/md'),
]);
const colorCard = card('group:color/brand', 'color', 'color/brand', [
  row('v-color-1', 'color/brand/primary'),
]);

const allVariables = new Map<string, VariableData>([
  ['v-global-1', variable('v-global-1', '_global', '_global/spacing/sm', 'FLOAT')],
  ['v-global-2', variable('v-global-2', '_global', '_global/spacing/md', 'FLOAT')],
  ['v-color-1', variable('v-color-1', 'color', 'color/brand/primary')],
]);

const filters = (overrides: Partial<CardVisibilityFilters> = {}): CardVisibilityFilters => ({
  selectedCollections: new Set(['_global', 'color']),
  selectedTypes: new Set(['COLOR', 'FLOAT']),
  selectedGroups: new Set(['_global::_global/spacing', 'color::color/brand']),
  variablesById: allVariables,
  ...overrides,
});

// ── The shared visibility predicate ────────────────────────────────

describe('isCardHidden', () => {
  it('shows a card that passes every filter', () => {
    expect(isCardHidden(globalCard, filters())).toBe(false);
    expect(isCardHidden(colorCard, filters())).toBe(false);
  });

  it('hides a card whose collection is deselected (the Arrange Grid repro)', () => {
    const only = filters({ selectedCollections: new Set(['color']) });
    expect(isCardHidden(globalCard, only)).toBe(true);
    expect(isCardHidden(colorCard, only)).toBe(false);
  });

  it('hides a card with no row of a selected type', () => {
    expect(isCardHidden(globalCard, filters({ selectedTypes: new Set(['COLOR']) }))).toBe(true);
    expect(isCardHidden(colorCard, filters({ selectedTypes: new Set(['COLOR']) }))).toBe(false);
  });

  it('hides a card whose variable group is deselected', () => {
    const only = filters({ selectedGroups: new Set(['color::color/brand']) });
    expect(isCardHidden(globalCard, only)).toBe(true);
    expect(isCardHidden(colorCard, only)).toBe(false);
  });

  it('matches a virtual row against the type filter but not the group filter', () => {
    const shader = card(
      'shader:v-color-1',
      'color',
      'color/brand',
      [row('shader:v-color-1', 'shader:v-color-1', { isVirtual: true, virtualType: 'shader' })],
      { kind: 'shader' }
    );
    // Virtual rows always satisfy the type filter...
    expect(isCardHidden(shader, filters({ selectedTypes: new Set() }))).toBe(false);
    // ...but a managed card's group match comes from sourceGroupName.
    expect(isCardHidden(shader, filters({ selectedGroups: new Set() }))).toBe(true);
  });

  it('keeps an empty-collection placeholder visible on the collection filter alone', () => {
    const placeholder = card('collection:new', 'new', '', [], {
      kind: 'collection',
      sourceGroupName: undefined,
    });
    // No rows at all: the type and group filters cannot meaningfully apply.
    expect(isCardHidden(placeholder, filters({
      selectedCollections: new Set(['new']),
      selectedTypes: new Set(),
      selectedGroups: new Set(),
    }))).toBe(false);
    expect(isCardHidden(placeholder, filters())).toBe(true);
  });

  it('force-shows a card that provides a token to the current selection', () => {
    const hiddenByCollection = filters({ selectedCollections: new Set(['color']) });
    expect(isCardHidden(globalCard, hiddenByCollection)).toBe(true);
    expect(isCardHidden(globalCard, {
      ...hiddenByCollection,
      selectionProviderGroupKeys: new Set([globalCard.key]),
    })).toBe(false);
  });
});

// ── Arrange units ──────────────────────────────────────────────────

describe('buildArrangeUnits', () => {
  it('gives no unit to a card the filters hide', () => {
    const { units, hiddenUnits, hiddenByKey } = buildArrangeUnits(
      [globalCard, colorCard],
      new Set(),
      filters({ selectedCollections: new Set(['color']) }),
      new Map()
    );

    expect(units.map(u => u.key)).toEqual([colorCard.key]);
    expect(hiddenUnits.map(u => u.key)).toEqual([globalCard.key]);
    expect(hiddenByKey.get(globalCard.key)).toBe(true);
  });

  it('gives a slot to a card that is force-shown for the selection', () => {
    const { units } = buildArrangeUnits(
      [globalCard, colorCard],
      new Set(),
      filters({
        selectedCollections: new Set(['color']),
        selectionProviderGroupKeys: new Set([globalCard.key]),
      }),
      new Map()
    );

    expect(units.map(u => u.key).sort()).toEqual([colorCard.key, globalCard.key].sort());
  });

  it('folds wrapped cards into their outermost wrapper unit', () => {
    const inner = card('group:color/brand/deep', 'color', 'color/brand/deep', [row('v-color-1', 'color/brand/deep/x')]);
    const { units, unitKeyByGroupKey } = buildArrangeUnits(
      [colorCard, inner],
      new Set(['color', 'color/brand']),
      filters(),
      new Map()
    );

    // Outermost grouped ancestor wins, not the deepest one.
    expect(unitKeyByGroupKey.get(inner.key)).toBe('wrapper:color');
    expect(unitKeyByGroupKey.get(colorCard.key)).toBe('wrapper:color');
    expect(units.map(u => u.key)).toEqual(['wrapper:color']);
  });

  it('keeps a wrapper unit whose members are only PARTLY hidden, sized for all of them', () => {
    const visible = card('group:color/brand', 'color', 'color/brand', [row('v-color-1', 'color/brand/primary')]);
    const hidden = card('group:color/spacing', 'color', 'color/spacing', [
      row('v-global-1', 'color/spacing/sm'),
      row('v-global-2', 'color/spacing/md'),
    ]);

    const { units, hiddenUnits, heightOverrides } = buildArrangeUnits(
      [visible, hidden],
      new Set(['color']),
      filters({ selectedGroups: new Set(['color::color/brand']) }),
      new Map()
    );

    expect(units.map(u => u.key)).toEqual(['wrapper:color']);
    expect(hiddenUnits).toEqual([]);
    // buildWrapperLayout stacks hidden members too, so the frame on screen is
    // as tall as ALL of its members — the override must say so.
    expect(heightOverrides.get('wrapper:color')).toBe(
      getGroupHeight(visible) + WRAPPER_GAP + getGroupHeight(hidden)
      + WRAPPER_HEADER_HEIGHT + WRAPPER_PADDING * 2
    );
  });

  it('drops a wrapper unit only when every member is hidden', () => {
    const a = card('group:color/brand', 'color', 'color/brand', [row('v-color-1', 'color/brand/primary')]);
    const b = card('group:color/spacing', 'color', 'color/spacing', [row('v-global-1', 'color/spacing/sm')]);

    const { units, hiddenUnits } = buildArrangeUnits(
      [a, b, globalCard],
      new Set(['color']),
      filters({ selectedCollections: new Set(['_global']) }),
      new Map()
    );

    expect(units.map(u => u.key)).toEqual([globalCard.key]);
    expect(hiddenUnits.map(u => u.key)).toEqual(['wrapper:color']);
  });

  it('prefers the measured frame height over the summed fallback', () => {
    const { heightOverrides } = buildArrangeUnits(
      [colorCard],
      new Set(['color']),
      filters(),
      new Map([['wrapper:color', { position: { x: 12, y: 34 }, measuredHeight: 999 }]])
    );

    expect(heightOverrides.get('wrapper:color')).toBe(999);
  });

  it('seeds a wrapper unit from its live frame position', () => {
    const { units } = buildArrangeUnits(
      [colorCard],
      new Set(['color']),
      filters(),
      new Map([['wrapper:color', { position: { x: 12, y: 34 } }]])
    );

    expect(units[0]).toMatchObject({ key: 'wrapper:color', title: 'color', x: 12, y: 34 });
  });
});

// ── Arrange Grid end result ────────────────────────────────────────

describe('Arrange Grid over filtered cards', () => {
  // Same composition handleArrangeGrid performs: fold into units, then pack.
  const arrange = (groups: GroupData[], visibility: CardVisibilityFilters) => {
    const { units, heightOverrides } = buildArrangeUnits(groups, new Set(), visibility, new Map());
    return arrangeGroupsByConnectedBlocks(units, [], GROUP_GAP_X, GROUP_GAP_Y, heightOverrides);
  };

  const three = [
    card('group:a', 'color', 'color/a', [row('v-color-1', 'color/a/one')]),
    card('group:b', '_global', '_global/b', [row('v-global-1', '_global/b/one'), row('v-global-2', '_global/b/two')]),
    card('group:c', 'color', 'color/c', [row('v-color-1', 'color/c/one')]),
  ];
  const threeFilters = filters({
    selectedGroups: new Set(['color::color/a', '_global::_global/b', 'color::color/c']),
  });

  it('packs the visible cards with no gap where a hidden card used to sit', () => {
    // `_global` deselected: only the two color cards remain on screen.
    const positions = arrange(three, { ...threeFilters, selectedCollections: new Set(['color']) });

    expect(Array.from(positions.keys()).sort()).toEqual(['group:a', 'group:c']);
    const a = positions.get('group:a')!;
    const c = positions.get('group:c')!;
    // One unconnected column, stacked by exactly height + gap — no void left
    // behind by the hidden `_global` card that used to own the middle slot.
    expect(a).toEqual({ x: 0, y: 0 });
    expect(c).toEqual({ x: 0, y: getGroupHeight(three[0]) + GROUP_GAP_Y });
  });

  it('left the gap before the fix: arranging the unfiltered set strands the visible cards', () => {
    const positions = arrange(three, threeFilters);
    const c = positions.get('group:c')!;
    const gapIfHiddenCounted = getGroupHeight(three[0]) + GROUP_GAP_Y
      + getGroupHeight(three[1]) + GROUP_GAP_Y;

    // This is the old behaviour, reproduced deliberately: with the hidden card
    // in the input set, the still-visible card below it sits a whole card
    // height lower than it should.
    expect(c.y).toBe(gapIfHiddenCounted);
    expect(c.y).toBeGreaterThan(getGroupHeight(three[0]) + GROUP_GAP_Y);
  });

  it('still arranges a partly hidden wrapper as one block', () => {
    const visible = card('group:w/one', 'color', 'w/one', [row('v-color-1', 'w/one/x')]);
    const hidden = card('group:w/two', 'color', 'w/two', [row('v-global-1', 'w/two/x')]);
    const other = card('group:other', 'color', 'color/a', [row('v-color-1', 'color/a/one')]);

    const visibility = filters({
      selectedGroups: new Set(['color::w/one', 'color::color/a']),
    });
    const { units, heightOverrides } = buildArrangeUnits(
      [visible, hidden, other],
      new Set(['w']),
      visibility,
      new Map()
    );
    const positions = arrangeGroupsByConnectedBlocks(units, [], GROUP_GAP_X, GROUP_GAP_Y, heightOverrides);

    expect(Array.from(positions.keys()).sort()).toEqual(['group:other', 'wrapper:w']);
    // The wrapper is first in the column (title 'other' vs 'w'), and the card
    // after it clears the frame's FULL height, hidden member included.
    const wrapperHeight = heightOverrides.get('wrapper:w')!;
    expect(positions.get('group:other')).toEqual({ x: 0, y: 0 });
    expect(positions.get('wrapper:w')).toEqual({
      x: 0,
      y: getGroupHeight(other) + GROUP_GAP_Y,
    });
    expect(wrapperHeight).toBe(
      getGroupHeight(visible) + WRAPPER_GAP + getGroupHeight(hidden)
      + WRAPPER_HEADER_HEIGHT + WRAPPER_PADDING * 2
    );
  });

  it('keeps the arranged grid clear of cards parked for being hidden', () => {
    const visibility = { ...threeFilters, selectedCollections: new Set(['color']) };
    const { units, hiddenUnits, heightOverrides } = buildArrangeUnits(three, new Set(), visibility, new Map());
    const positions = arrangeGroupsByConnectedBlocks(units, [], GROUP_GAP_X, GROUP_GAP_Y, heightOverrides);

    // Mirrors the parking pass in handleArrangeGrid.
    const parkX = Math.max(...Array.from(positions.values(), p => p.x)) + GROUP_WIDTH + GROUP_GAP_X;
    hiddenUnits.forEach(unit => positions.set(unit.key, { x: parkX, y: 0 }));

    // Every card keeps an entry, and the hidden one sits clear of the grid.
    expect(Array.from(positions.keys()).sort()).toEqual(['group:a', 'group:b', 'group:c']);
    expect(positions.get('group:b')!.x).toBeGreaterThanOrEqual(GROUP_WIDTH + GROUP_GAP_X);
  });
});
