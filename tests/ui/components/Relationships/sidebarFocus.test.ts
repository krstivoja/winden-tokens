import { describe, it, expect } from 'vitest';
import type { Node } from '@xyflow/react';
import {
  collectFocusableRowKeys,
  isPathInScope,
  selectFocusScope,
} from '../../../../src/ui/components/Relationships/GroupedGraph/sidebarFocus';
import {
  computeHighlightPath,
  computeHighlightPathForKeys,
  isSingleTarget,
  planSidebarUncheck,
} from '../../../../src/ui/components/Relationships/GroupedGraph/hideUnused';
import { STANDARD_GROUP_HEADER_FILL } from '../../../../src/ui/components/Relationships/GroupedGraph/constants';
import type {
  ConnectionRecord,
  GroupData,
  GroupNodeData,
  VariableNode,
  WrapperNodeData,
} from '../../../../src/ui/components/Relationships/GroupedGraph/types';

// ── Fixtures ───────────────────────────────────────────────────────

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

const group = (
  key: string,
  collectionId: string,
  path: string,
  rows: string[],
  kind: GroupData['kind'] = 'standard'
): GroupData => ({
  key,
  title: path || collectionId,
  variables: rows.map(row),
  x: 0,
  y: 0,
  initialX: 0,
  initialY: 0,
  kind,
  ...(kind === 'collection' ? {} : { sourceGroupName: path }),
  headerFill: STANDARD_GROUP_HEADER_FILL,
  collectionId,
});

const cardNode = (g: GroupData, hidden = false): Node => ({
  id: g.key,
  type: 'groupNode',
  position: { x: 0, y: 0 },
  hidden,
  data: { group: g } as unknown as GroupNodeData,
});

const wrapperNode = (
  collectionId: string,
  path: string,
  options: { card?: GroupData; cardHidden?: boolean; hidden?: boolean } = {}
): Node => ({
  id: `wrapper:${collectionId}::${path}`,
  type: 'groupWrapper',
  position: { x: 0, y: 0 },
  hidden: options.hidden ?? false,
  data: {
    path,
    collectionId,
    title: path || collectionId,
    card: options.card ? ({ group: options.card } as unknown as GroupNodeData) : null,
    cardHidden: options.cardHidden ?? !options.card,
  } as unknown as WrapperNodeData,
});

const root = group('collection:c1', 'c1', '', ['loose'], 'collection');
const badge = group('group:c1::badge', 'c1', 'badge', ['badge/size']);
const badgeColor = group('group:c1::badge/color', 'c1', 'badge/color', ['badge/color/bg']);
const badgeError = group('group:c1::badge/color/error', 'c1', 'badge/color/error', ['badge/color/error/fg']);
const badgeX = group('group:c1::badge-x', 'c1', 'badge-x', ['badge-x/a']);
const otherBadge = group('group:c2::badge', 'c2', 'badge', ['badge/size']);
const external = group('ext-group:badge', 'c1', 'badge', ['badge/lib'], 'shader');

const flatNodes = [root, badge, badgeColor, badgeError, badgeX, otherBadge, external].map(g => cardNode(g));

describe('isPathInScope', () => {
  it('matches the path itself and everything below it', () => {
    expect(isPathInScope('badge', 'badge')).toBe(true);
    expect(isPathInScope('badge/color', 'badge')).toBe(true);
    expect(isPathInScope('badge/color/error', 'badge')).toBe(true);
  });

  it('matches segment-wise, so badge never holds badge-x', () => {
    expect(isPathInScope('badge-x', 'badge')).toBe(false);
    expect(isPathInScope('badgex/a', 'badge')).toBe(false);
    expect(isPathInScope('badge', 'badge/color')).toBe(false);
  });

  it('holds everything for the collection row', () => {
    expect(isPathInScope('', '')).toBe(true);
    expect(isPathInScope('badge-x', '')).toBe(true);
  });
});

describe('selectFocusScope', () => {
  it('takes a leaf row as its one card', () => {
    expect(selectFocusScope(flatNodes, 'c1', 'badge/color/error')).toEqual({
      cardKeys: [badgeError.key],
      nodeIds: [badgeError.key],
    });
  });

  it('takes a folder row as every card below it, never a badge-x sibling', () => {
    const scope = selectFocusScope(flatNodes, 'c1', 'badge');
    expect(scope?.cardKeys).toEqual([badge.key, badgeColor.key, badgeError.key]);
  });

  it('stays inside the row\'s collection', () => {
    const scope = selectFocusScope(flatNodes, 'c2', 'badge');
    expect(scope?.cardKeys).toEqual([otherBadge.key]);
  });

  it('takes every card of the collection, root card included, for the collection row', () => {
    const scope = selectFocusScope(flatNodes, 'c1', '');
    expect(scope?.cardKeys).toEqual([root.key, badge.key, badgeColor.key, badgeError.key, badgeX.key]);
  });

  it('never targets a synthetic library card', () => {
    const scope = selectFocusScope(flatNodes, 'c1', '');
    expect(scope?.cardKeys.includes(external.key)).toBe(false);
  });

  it('leaves hidden cards out', () => {
    const nodes = [cardNode(badge), cardNode(badgeColor, true), cardNode(badgeError)];
    expect(selectFocusScope(nodes, 'c1', 'badge')?.cardKeys).toEqual([badge.key, badgeError.key]);
  });

  it('is null — do nothing — when nothing in scope is visible', () => {
    const nodes = [cardNode(badge, true), cardNode(badgeColor, true), cardNode(badgeX)];
    expect(selectFocusScope(nodes, 'c1', 'badge')).toBeNull();
    expect(selectFocusScope(flatNodes, 'c1', 'missing')).toBeNull();
    expect(selectFocusScope(flatNodes, 'nope', '')).toBeNull();
  });

  it('fits a container by its node id and highlights its absorbed card by card key', () => {
    const nodes = [
      wrapperNode('c1', 'badge', { card: badge, cardHidden: false }),
      cardNode(badgeColor),
      cardNode(badgeX),
    ];
    expect(selectFocusScope(nodes, 'c1', 'badge')).toEqual({
      cardKeys: [badge.key, badgeColor.key],
      nodeIds: ['wrapper:c1::badge', badgeColor.key],
    });
  });

  it('fits a container whose own card is filtered out, without highlighting that card', () => {
    const nodes = [wrapperNode('c1', 'badge', { card: badge, cardHidden: true }), cardNode(badgeColor)];
    expect(selectFocusScope(nodes, 'c1', 'badge')).toEqual({
      cardKeys: [badgeColor.key],
      nodeIds: ['wrapper:c1::badge', badgeColor.key],
    });
  });

  it('counts a collection frame for the collection row only', () => {
    const nodes = [wrapperNode('c1', '', { card: root, cardHidden: false }), cardNode(badgeColor)];
    expect(selectFocusScope(nodes, 'c1', '')?.nodeIds).toEqual(['wrapper:c1::', badgeColor.key]);
    expect(selectFocusScope(nodes, 'c1', '')?.cardKeys).toEqual([root.key, badgeColor.key]);
    expect(selectFocusScope(nodes, 'c1', 'badge')?.nodeIds).toEqual([badgeColor.key]);
  });

  it('leaves a hidden container out', () => {
    const nodes = [wrapperNode('c1', 'badge', { card: badge, cardHidden: false, hidden: true })];
    expect(selectFocusScope(nodes, 'c1', 'badge')).toBeNull();
  });
});

describe('collectFocusableRowKeys', () => {
  it('enables each visible card\'s row and every ancestor row', () => {
    const keys = collectFocusableRowKeys([cardNode(badgeError), cardNode(otherBadge)]);
    expect(keys).toEqual([
      'c1::',
      'c1::badge',
      'c1::badge/color',
      'c1::badge/color/error',
      'c2::',
      'c2::badge',
    ]);
  });

  it('agrees with selectFocusScope on every row', () => {
    const nodes = [
      cardNode(root),
      cardNode(badge, true),
      cardNode(badgeColor),
      cardNode(badgeError, true),
      cardNode(badgeX, true),
      wrapperNode('c2', 'badge', { card: otherBadge, cardHidden: false }),
    ];
    const keys = new Set(collectFocusableRowKeys(nodes));
    const rows: Array<[string, string]> = [
      ['c1', ''], ['c1', 'badge'], ['c1', 'badge/color'], ['c1', 'badge/color/error'], ['c1', 'badge-x'],
      ['c2', ''], ['c2', 'badge'],
    ];
    rows.forEach(([cid, path]) => {
      expect(keys.has(`${cid}::${path}`)).toBe(selectFocusScope(nodes, cid, path) !== null);
    });
  });

  it('ignores hidden nodes and library cards', () => {
    expect(collectFocusableRowKeys([cardNode(badge, true), cardNode(external)])).toEqual([]);
  });

  it('is order-independent, so it serves as a stable signature', () => {
    const a = collectFocusableRowKeys([cardNode(badgeError), cardNode(otherBadge), cardNode(root)]);
    const b = collectFocusableRowKeys([cardNode(root), cardNode(otherBadge), cardNode(badgeError)]);
    expect(a.join('\n')).toBe(b.join('\n'));
  });
});

// ── Union highlight ────────────────────────────────────────────────
//
//   A: a/1 ──e1──▶ B: b/1 ──e2──▶ C: c/1
//   D: d/1 ──e3──▶ E: e/1
//   F: f/1  (unconnected)

const cards = [
  group('A', 'one', 'a', ['a/1']),
  group('B', 'one', 'b', ['b/1']),
  group('C', 'one', 'c', ['c/1']),
  group('D', 'one', 'd', ['d/1']),
  group('E', 'one', 'e', ['e/1']),
  group('F', 'one', 'f', ['f/1']),
];

const conn = (id: string, fromGroup: string, fromVar: string, toGroup: string, toVar: string): ConnectionRecord => ({
  id, kind: 'reference', fromGroup, fromVar, toGroup, toVar,
});

const connections = [
  conn('e1', 'A', 'a/1', 'B', 'b/1'),
  conn('e2', 'B', 'b/1', 'C', 'c/1'),
  conn('e3', 'D', 'd/1', 'E', 'e/1'),
];

const variableGroup = new Map<string, { group: string }>();
cards.forEach(g => g.variables.forEach(v => variableGroup.set(v.name, { group: g.key })));

const forKeys = (keys: string[], varName: string | null = null) =>
  computeHighlightPathForKeys(keys, varName, cards, connections, variableGroup);
const single = (key: string | null, varName: string | null = null) =>
  computeHighlightPath(key, varName, cards, connections, variableGroup);

const sorted = (set: Set<string> | undefined) => Array.from(set ?? []).sort();

describe('computeHighlightPathForKeys', () => {
  it('is null for no keys', () => {
    expect(forKeys([])).toBeNull();
  });

  it('equals the single-card path for one key', () => {
    ['A', 'B', 'D', 'F'].forEach(key => {
      expect(forKeys([key])).toEqual(single(key));
    });
    expect(forKeys(['B'], 'b/1')).toEqual(single('B', 'b/1'));
  });

  it('is the union of both chains for two keys', () => {
    const path = forKeys(['A', 'D']);
    const a = single('A')!;
    const d = single('D')!;
    expect(sorted(path?.groups)).toEqual(sorted(new Set([...a.groups, ...d.groups])));
    expect(sorted(path?.vars)).toEqual(sorted(new Set([...a.vars, ...d.vars])));
    expect(sorted(path?.edgeIds)).toEqual(sorted(new Set([...a.edgeIds, ...d.edgeIds])));
    expect(sorted(path?.groups)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(sorted(path?.edgeIds)).toEqual(['e1', 'e2', 'e3']);
  });

  it('keeps an unconnected card and a card with no rows on the path', () => {
    const empty = group('collection:one', 'one', '', [], 'collection');
    const path = computeHighlightPathForKeys(['F', empty.key], null, [...cards, empty], connections, variableGroup);
    expect(sorted(path?.groups)).toEqual(['F', 'collection:one']);
    expect(path?.edgeIds.size).toBe(0);
  });

  it('hides against the union: nothing on either chain is unchecked', () => {
    const plan = planSidebarUncheck(cards, forKeys(['A', 'D']));
    expect(Array.from(plan.coveredCards)).toEqual(['F']);
  });
});

describe('isSingleTarget', () => {
  it('matches exactly one card (and row)', () => {
    expect(isSingleTarget({ groupKeys: ['A'], varName: null }, 'A', null)).toBe(true);
    expect(isSingleTarget({ groupKeys: ['A'], varName: 'a/1' }, 'A', 'a/1')).toBe(true);
    expect(isSingleTarget({ groupKeys: ['A'], varName: 'a/1' }, 'A', null)).toBe(false);
    expect(isSingleTarget(null, 'A', null)).toBe(false);
  });

  it('does not match a wider focus that includes the card, so a click narrows instead of clearing', () => {
    expect(isSingleTarget({ groupKeys: ['A', 'D'], varName: null }, 'A', null)).toBe(false);
  });
});
