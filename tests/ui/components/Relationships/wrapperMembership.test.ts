import { describe, it, expect } from 'vitest';
import { buildWrapperLayout } from '../../../../src/ui/components/Relationships/GroupedGraph/wrapperLayout';
import type { Placement } from '../../../../src/ui/components/Relationships/GroupedGraph/wrapperLayout';
import {
  buildArrangeUnits,
  isCardHidden,
  outermostGroupedAncestor,
} from '../../../../src/ui/components/Relationships/GroupedGraph/utils';
import type { CardVisibilityFilters } from '../../../../src/ui/components/Relationships/GroupedGraph/utils';
import { STANDARD_GROUP_HEADER_FILL } from '../../../../src/ui/components/Relationships/GroupedGraph/constants';
import type { GroupData, VariableNode } from '../../../../src/ui/components/Relationships/GroupedGraph/types';

// ── Fixtures ───────────────────────────────────────────────────────

const row = (id: string, name: string): VariableNode => ({
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
});

const card = (path: string, extra: Partial<GroupData> = {}): GroupData => ({
  key: `group:${path}`,
  title: path,
  variables: [row(`v:${path}`, `${path}/leaf`)],
  x: 0, y: 0, initialX: 0, initialY: 0,
  kind: 'standard',
  sourceGroupName: path,
  headerFill: STANDARD_GROUP_HEADER_FILL,
  collectionId: 'c1',
  ...extra,
});

const collectionCard = (id = 'c1'): GroupData => ({
  key: `collection:${id}`,
  title: id,
  variables: [],
  x: 0, y: 0, initialX: 0, initialY: 0,
  kind: 'collection',
  headerFill: STANDARD_GROUP_HEADER_FILL,
  collectionId: id,
});

const parentOf = (placements: Placement[], id: string): string | null | undefined =>
  placements.find(p => p.id === id)?.parentId;

// ── The bug ────────────────────────────────────────────────────────

describe('wrapper membership — a frame contains the card at its own path', () => {
  it('puts the card whose own path is the grouped path inside that frame', () => {
    // Live symptom: wrapper `test` held `group:test/test` but not `group:test`,
    // which was parked 3,800px away and read as a missing card.
    const placements = buildWrapperLayout(
      [card('test'), card('test/test')],
      new Set(['test']),
      {}
    );

    expect(parentOf(placements, 'group:test')).toBe('wrapper:test');
    expect(parentOf(placements, 'group:test/test')).toBe('wrapper:test');
    expect(parentOf(placements, 'wrapper:test')).toBeNull();
  });

  it('creates the frame even when the self-path card is the only member', () => {
    // Otherwise attach() would look for a wrapper that was never built and
    // the card would pop back out, while Arrange still folded it into the
    // missing frame's unit key.
    const placements = buildWrapperLayout([card('test')], new Set(['test']), {});

    expect(placements.some(p => p.id === 'wrapper:test')).toBe(true);
    expect(parentOf(placements, 'group:test')).toBe('wrapper:test');
  });

  it('never makes a frame its own parent, at any nesting depth', () => {
    const placements = buildWrapperLayout(
      [card('a'), card('a/b'), card('a/b/c')],
      new Set(['a', 'a/b']),
      {}
    );

    // Wrappers nest strictly: a/b under a, a at the top.
    expect(parentOf(placements, 'wrapper:a/b')).toBe('wrapper:a');
    expect(parentOf(placements, 'wrapper:a')).toBeNull();
    // Cards join the frame named after their own path.
    expect(parentOf(placements, 'group:a')).toBe('wrapper:a');
    expect(parentOf(placements, 'group:a/b')).toBe('wrapper:a/b');
    expect(parentOf(placements, 'group:a/b/c')).toBe('wrapper:a/b');
    // No placement is its own parent, and the chain terminates at a root.
    placements.forEach(p => expect(p.parentId).not.toBe(p.id));
    const byId = new Map(placements.map(p => [p.id, p]));
    placements.forEach(p => {
      const seen = new Set<string>();
      let current: Placement | undefined = p;
      while (current?.parentId) {
        expect(seen.has(current.parentId)).toBe(false);
        seen.add(current.parentId);
        current = byId.get(current.parentId);
      }
    });
  });

  it('emits every nested node after its parent frame', () => {
    // React Flow stacks in array order and requires a child to follow its
    // parentId node.
    const placements = buildWrapperLayout(
      [card('a'), card('a/b'), card('a/b/c')],
      new Set(['a', 'a/b']),
      {}
    );

    placements.forEach((p, index) => {
      if (!p.parentId) return;
      const parentIndex = placements.findIndex(q => q.id === p.parentId);
      expect(parentIndex).toBeGreaterThanOrEqual(0);
      expect(parentIndex).toBeLessThan(index);
    });
  });

  it('leaves a collection root card (empty path) at the top level', () => {
    const placements = buildWrapperLayout(
      [collectionCard(), card('test')],
      new Set(['test']),
      {}
    );

    expect(parentOf(placements, 'collection:c1')).toBeNull();
  });
});

describe('outermostGroupedAncestor', () => {
  it('matches the path itself', () => {
    expect(outermostGroupedAncestor('test', new Set(['test']))).toBe('test');
  });

  it('still prefers the shallowest ancestor over the path itself', () => {
    expect(outermostGroupedAncestor('a/b', new Set(['a', 'a/b']))).toBe('a');
  });

  it('returns null for an unwrapped path and for the empty path', () => {
    expect(outermostGroupedAncestor('test', new Set(['other']))).toBeNull();
    // The empty path is what collection root cards carry — it must never
    // match the empty prefix and get swallowed by a frame.
    expect(outermostGroupedAncestor('', new Set([''] ))).toBeNull();
  });
});

describe('Arrange folds the self-path card into the same frame', () => {
  const filters: CardVisibilityFilters = {
    selectedCollections: new Set(['c1']),
    selectedTypes: new Set(['COLOR']),
    selectedGroups: new Set(['c1::test', 'c1::test/test']),
    variablesById: new Map([
      ['v:test', { id: 'v:test', collectionId: 'c1', name: 'test/leaf', resolvedType: 'COLOR', value: '#fff', valuesByMode: {} }],
      ['v:test/test', { id: 'v:test/test', collectionId: 'c1', name: 'test/test/leaf', resolvedType: 'COLOR', value: '#fff', valuesByMode: {} }],
    ]),
  };

  it('gives both cards the same unit key, so the frame moves as one block', () => {
    const cards = [card('test'), card('test/test')];
    // Sanity: both cards are visible, so neither is parked as hidden.
    cards.forEach(c => expect(isCardHidden(c, filters)).toBe(false));

    const { unitKeyByGroupKey, units } = buildArrangeUnits(
      cards,
      new Set(['test']),
      filters,
      new Map()
    );

    expect(unitKeyByGroupKey.get('group:test')).toBe('wrapper:test');
    expect(unitKeyByGroupKey.get('group:test/test')).toBe('wrapper:test');
    expect(units.map(u => u.key)).toEqual(['wrapper:test']);
  });
});
