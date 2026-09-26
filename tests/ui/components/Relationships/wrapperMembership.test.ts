import { describe, it, expect } from 'vitest';
import { buildWrapperLayout } from '../../../../src/ui/components/Relationships/GroupedGraph/wrapperLayout';
import type { Placement } from '../../../../src/ui/components/Relationships/GroupedGraph/wrapperLayout';
import {
  buildArrangeUnits,
  isCardHidden,
  outermostGroupedAncestor,
  getWrapperKey,
  parseWrapperKey,
  buildWrapperPathOwners,
  migrateGroupedPaths,
  migrateGraphPositions,
  getGroupCardKey,
  bucketUnmanagedVariables,
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

// Part 4: the card at a frame's own path is ABSORBED — the frame renders its
// header, rows and actions, and the card is not a placement of its own. This
// is the successor to the part-2 assertion that the card was a CHILD of that
// frame: same requirement (the card is drawn by that frame, not parked
// thousands of pixels away), one node instead of two.
const absorbedBy = (placements: Placement[], cardKey: string): string | null => {
  const holder = placements.find(p => p.kind === 'wrapper' && p.group?.key === cardKey);
  return holder ? holder.id : null;
};

const isEmitted = (placements: Placement[], id: string): boolean =>
  placements.some(p => p.id === id);

// ── The bug ────────────────────────────────────────────────────────

// Every acyclicity assertion in this file runs through here: no placement is
// its own parent, and every parent chain terminates at a root rather than
// looping. `<cid>::a/b` → `<cid>::a` → `<cid>::` → nothing.
const expectAcyclic = (placements: Placement[]) => {
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
};

describe('wrapper membership — a frame contains the card at its own path', () => {
  it('absorbs the card whose own path is the grouped path', () => {
    // Live symptom before part 2: wrapper `test` held `group:test/test` but
    // not `group:test`, which was parked 3,800px away and read as a missing
    // card. Part 2 made it a child; part 4 makes it the frame ITSELF — a
    // group is one thing, not a dashed frame around a card with the same
    // name and a second header.
    const placements = buildWrapperLayout(
      [card('test'), card('test/test')],
      new Set(['c1::test']),
      {}
    );

    expect(absorbedBy(placements, 'group:test')).toBe('wrapper:c1::test');
    // …and it is NOT also drawn as a card of its own.
    expect(isEmitted(placements, 'group:test')).toBe(false);
    expect(parentOf(placements, 'group:test/test')).toBe('wrapper:c1::test');
    expect(parentOf(placements, 'wrapper:c1::test')).toBeNull();
  });

  it('is a container with rows and no children when it is the only card', () => {
    // The frame still exists — Arrange (outermostGroupedAncestor) folds the
    // card into it either way, so the two walks have to agree.
    const placements = buildWrapperLayout([card('test')], new Set(['c1::test']), {});

    expect(isEmitted(placements, 'wrapper:c1::test')).toBe(true);
    expect(absorbedBy(placements, 'group:test')).toBe('wrapper:c1::test');
    expect(placements).toHaveLength(1);
  });

  it('never makes a frame its own parent, at any nesting depth', () => {
    const placements = buildWrapperLayout(
      [card('a'), card('a/b'), card('a/b/c')],
      new Set(['c1::a', 'c1::a/b']),
      {}
    );

    // Wrappers nest strictly: a/b under a, a at the top.
    expect(parentOf(placements, 'wrapper:c1::a/b')).toBe('wrapper:c1::a');
    expect(parentOf(placements, 'wrapper:c1::a')).toBeNull();
    // A card whose own path is framed IS that frame…
    expect(absorbedBy(placements, 'group:a')).toBe('wrapper:c1::a');
    expect(absorbedBy(placements, 'group:a/b')).toBe('wrapper:c1::a/b');
    // …and one whose path is not framed stays a leaf card inside the deepest
    // frame that contains it.
    expect(absorbedBy(placements, 'group:a/b/c')).toBeNull();
    expect(parentOf(placements, 'group:a/b/c')).toBe('wrapper:c1::a/b');
    expectAcyclic(placements);
  });

  it('emits every nested node after its parent frame', () => {
    // React Flow stacks in array order and requires a child to follow its
    // parentId node.
    const placements = buildWrapperLayout(
      [card('a'), card('a/b'), card('a/b/c')],
      new Set(['c1::a', 'c1::a/b']),
      {}
    );

    placements.forEach((p, index) => {
      if (!p.parentId) return;
      const parentIndex = placements.findIndex(q => q.id === p.parentId);
      expect(parentIndex).toBeGreaterThanOrEqual(0);
      expect(parentIndex).toBeLessThan(index);
    });
  });

  it('leaves a collection root card at the top level while its collection is not framed', () => {
    const placements = buildWrapperLayout(
      [collectionCard(), card('test')],
      new Set(['c1::test']),
      {}
    );

    expect(parentOf(placements, 'collection:c1')).toBeNull();
  });
});

// ── 3a: the collection is part of the key space ────────────────────

describe('collection frames', () => {
  it('holds every card of its collection, at any depth, plus the root card', () => {
    const placements = buildWrapperLayout(
      [collectionCard(), card('test'), card('test/test2'), card('other')],
      new Set(['c1::']),
      {}
    );

    // The collection's ROOT card is the collection container: header = the
    // collection, rows = its loose variables.
    expect(absorbedBy(placements, 'collection:c1')).toBe('wrapper:c1::');
    expect(isEmitted(placements, 'collection:c1')).toBe(false);
    expect(parentOf(placements, 'group:test')).toBe('wrapper:c1::');
    expect(parentOf(placements, 'group:test/test2')).toBe('wrapper:c1::');
    expect(parentOf(placements, 'group:other')).toBe('wrapper:c1::');
    expect(parentOf(placements, 'wrapper:c1::')).toBeNull();
    expectAcyclic(placements);
  });

  it('nests a path frame inside its collection frame, deepest wins for cards', () => {
    const placements = buildWrapperLayout(
      [collectionCard(), card('test'), card('test/test2'), card('other')],
      new Set(['c1::', 'c1::test']),
      {}
    );

    expect(parentOf(placements, 'wrapper:c1::test')).toBe('wrapper:c1::');
    expect(parentOf(placements, 'wrapper:c1::')).toBeNull();
    // The collection frame is the root: it never becomes its own parent even
    // though depth 0 is a match for it too. It absorbs the collection's root
    // card instead.
    expect(absorbedBy(placements, 'collection:c1')).toBe('wrapper:c1::');
    // The `test` card IS the nested container, not a card inside it.
    expect(absorbedBy(placements, 'group:test')).toBe('wrapper:c1::test');
    expect(parentOf(placements, 'group:test/test2')).toBe('wrapper:c1::test');
    expect(parentOf(placements, 'group:other')).toBe('wrapper:c1::');
    expectAcyclic(placements);
  });

  it('keeps one collection out of another collection\'s frame', () => {
    // Pre-3a, a frame named `test` gathered `test*` cards from EVERY
    // collection, because the key carried no collection at all.
    const placements = buildWrapperLayout(
      [card('test'), card('test', { key: 'group:c2:test', collectionId: 'c2' })],
      new Set(['c1::test']),
      {}
    );

    expect(absorbedBy(placements, 'group:test')).toBe('wrapper:c1::test');
    // c2's card is not framed at all, so it stays a leaf card at the top level.
    expect(absorbedBy(placements, 'group:c2:test')).toBeNull();
    expect(parentOf(placements, 'group:c2:test')).toBeNull();
    expect(isEmitted(placements, 'wrapper:c2::test')).toBe(false);
  });

  it('gives each collection its own frame for the same bare path', () => {
    const placements = buildWrapperLayout(
      [card('test'), card('test', { key: 'group:c2:test', collectionId: 'c2' })],
      new Set(['c1::test', 'c2::test']),
      {}
    );

    expect(absorbedBy(placements, 'group:test')).toBe('wrapper:c1::test');
    expect(absorbedBy(placements, 'group:c2:test')).toBe('wrapper:c2::test');
    expectAcyclic(placements);
  });

  it('emits nested nodes after their parent even with a collection frame', () => {
    const placements = buildWrapperLayout(
      [collectionCard(), card('a'), card('a/b')],
      new Set(['c1::', 'c1::a']),
      {}
    );

    placements.forEach((p, index) => {
      if (!p.parentId) return;
      const parentIndex = placements.findIndex(q => q.id === p.parentId);
      expect(parentIndex).toBeGreaterThanOrEqual(0);
      expect(parentIndex).toBeLessThan(index);
    });
  });
});

describe('wrapper keys', () => {
  it('round-trips, and splits on the FIRST :: so a Figma id keeps its colons', () => {
    const key = getWrapperKey('VariableCollectionId:5:2', 'color/brand');
    expect(key).toBe('VariableCollectionId:5:2::color/brand');
    expect(parseWrapperKey(key)).toEqual({
      collectionId: 'VariableCollectionId:5:2',
      path: 'color/brand',
    });
  });

  it('represents the collection itself as the empty path', () => {
    expect(parseWrapperKey(getWrapperKey('c1', ''))).toEqual({ collectionId: 'c1', path: '' });
  });

  it('reports a bare (pre-3a) path as unparseable', () => {
    expect(parseWrapperKey('color/brand')).toBeNull();
  });
});

describe('outermostGroupedAncestor', () => {
  it('matches the path itself', () => {
    expect(outermostGroupedAncestor('c1', 'test', new Set(['c1::test']))).toBe('c1::test');
  });

  it('still prefers the shallowest ancestor over the path itself', () => {
    expect(outermostGroupedAncestor('c1', 'a/b', new Set(['c1::a', 'c1::a/b']))).toBe('c1::a');
  });

  it('prefers the collection frame over every path frame', () => {
    expect(outermostGroupedAncestor('c1', 'a/b', new Set(['c1::', 'c1::a']))).toBe('c1::');
  });

  it('puts a collection root card (empty path) in its collection frame only', () => {
    expect(outermostGroupedAncestor('c1', '', new Set(['c1::']))).toBe('c1::');
    expect(outermostGroupedAncestor('c1', '', new Set(['c1::test']))).toBeNull();
    // Another collection's frame never claims it.
    expect(outermostGroupedAncestor('c1', '', new Set(['c2::']))).toBeNull();
  });

  it('returns null for an unwrapped path and ignores another collection', () => {
    expect(outermostGroupedAncestor('c1', 'test', new Set(['c1::other']))).toBeNull();
    expect(outermostGroupedAncestor('c1', 'test', new Set(['c2::test']))).toBeNull();
  });
});

// ── 3a migration ───────────────────────────────────────────────────

describe('3a migration — bare wrapper paths become collection-scoped', () => {
  const collections = [{ id: 'c1' }, { id: 'c2' }];
  const variables = [
    { collectionId: 'c1', name: 'test/test2/leaf' },
    { collectionId: 'c1', name: 'only1/leaf' },
    { collectionId: 'c2', name: 'test/leaf' },
    { collectionId: 'c2', name: 'only2/leaf' },
    // Loose variables carry no group path and own nothing.
    { collectionId: 'c1', name: 'loose' },
  ];
  const owners = buildWrapperPathOwners(collections, variables);
  const cardOwners = buildWrapperPathOwners(collections, variables, { exactPathOnly: true });

  it('lists owners in collection order, and only real ones', () => {
    expect(owners.get('test')).toEqual(['c1', 'c2']);
    expect(owners.get('test/test2')).toEqual(['c1']);
    expect(owners.get('only1')).toEqual(['c1']);
    expect(owners.get('only2')).toEqual(['c2']);
    expect(owners.get('loose')).toBeUndefined();
    expect(owners.get('gone')).toBeUndefined();
  });

  it('splits a shared bare path into one entry per owning collection', () => {
    // Honest: the one old frame really did hold cards from both.
    expect(migrateGroupedPaths(['test'], owners).sort()).toEqual(['c1::test', 'c2::test']);
  });

  it('drops a path no collection owns any more', () => {
    expect(migrateGroupedPaths(['gone'], owners)).toEqual([]);
  });

  it('is idempotent — a second run is a no-op', () => {
    const once = migrateGroupedPaths(['test', 'only1'], owners);
    expect(migrateGroupedPaths(once, owners).sort()).toEqual(once.sort());
    expect(once.sort()).toEqual(['c1::only1', 'c1::test', 'c2::test']);
  });

  it('tolerates a junk record', () => {
    expect(migrateGroupedPaths(null, owners)).toEqual([]);
    expect(migrateGroupedPaths(['', 42 as unknown as string], owners)).toEqual([]);
  });

  it('rewrites wrapper positions, keeping the FIRST owner of an ambiguous path', () => {
    const migrated = migrateGraphPositions({
      'wrapper:test': { x: 1, y: 2 },
      'wrapper:only2': { x: 3, y: 4 },
      'rel:wrapper:test/test2': { x: 5, y: 6 },
    }, owners, cardOwners);

    // One position, not two: two frames on one coordinate is worse than one
    // arranged frame.
    expect(migrated).toEqual({
      'wrapper:c1::test': { x: 1, y: 2 },
      'wrapper:c2::only2': { x: 3, y: 4 },
      'rel:wrapper:c1::test/test2': { x: 5, y: 6 },
    });
  });

  it('leaves the already-scoped and the unscopable key spaces alone', () => {
    const stored = {
      // `collection:` already embeds the id; the rest are keyed by variable
      // or node id; `ext-group:` is a published library token with no local
      // collection to scope to.
      'collection:c1': { x: 3, y: 3 },
      'source:v1': { x: 4, y: 4 },
      'shader:v1': { x: 5, y: 5 },
      'shades:v1': { x: 6, y: 6 },
      'steps:v1': { x: 7, y: 7 },
      'selection:42:7': { x: 8, y: 8 },
      'ext-group:test': { x: 9, y: 9 },
      'tier-label:0': { x: 10, y: 10 },
    };
    expect(migrateGraphPositions(stored, owners, cardOwners)).toEqual(stored);
  });

  it('drops an unresolvable wrapper position rather than keeping it stale', () => {
    expect(migrateGraphPositions({ 'wrapper:gone': { x: 1, y: 2 } }, owners, cardOwners)).toEqual({});
  });

  it('is idempotent for positions too, and never loses an already-scoped key', () => {
    const once = migrateGraphPositions({ 'wrapper:test': { x: 1, y: 2 } }, owners, cardOwners);
    expect(migrateGraphPositions(once, owners, cardOwners)).toEqual(once);
    // A half-migrated record: the scoped entry wins over the bare one.
    expect(migrateGraphPositions({
      'wrapper:c1::test': { x: 9, y: 9 },
      'wrapper:test': { x: 1, y: 2 },
    }, owners, cardOwners)).toEqual({ 'wrapper:c1::test': { x: 9, y: 9 } });
  });

  it('tolerates a junk record', () => {
    expect(migrateGraphPositions(null, owners, cardOwners)).toEqual({});
    expect(migrateGraphPositions([], owners, cardOwners)).toEqual({});
  });
});

// ── 3b: card identity carries a collection ─────────────────────────

describe('3b — card keys are collection-scoped', () => {
  const collections = [{ id: 'c1' }, { id: 'c2' }];
  const variables = [
    // Both collections own the group `color/brand` — the merge this fixes.
    { collectionId: 'c1', name: 'color/brand/500' },
    { collectionId: 'c2', name: 'color/brand/700' },
    // c1 is INSIDE the frame `test` but has no CARD there; c2 has the card.
    { collectionId: 'c1', name: 'test/test2/leaf' },
    { collectionId: 'c2', name: 'test/leaf' },
    // Loose: lives on its collection's root card, owns no group path.
    { collectionId: 'c1', name: 'loose' },
  ];
  const owners = buildWrapperPathOwners(collections, variables);
  const cardOwners = buildWrapperPathOwners(collections, variables, { exactPathOnly: true });

  it('builds `group:<collectionId>::<groupName>`, splitting on the FIRST `::`', () => {
    expect(getGroupCardKey('c1', 'color/brand')).toBe('group:c1::color/brand');
    // Real Figma ids carry single colons; only `::` separates the halves.
    const key = getGroupCardKey('VariableCollectionId:5:2', 'color/brand');
    expect(key).toBe('group:VariableCollectionId:5:2::color/brand');
    expect(parseWrapperKey(key.slice('group:'.length))).toEqual({
      collectionId: 'VariableCollectionId:5:2',
      path: 'color/brand',
    });
  });

  it('separates two collections that own the same group name', () => {
    expect(getGroupCardKey('c1', 'color/brand')).not.toBe(getGroupCardKey('c2', 'color/brand'));
  });

  it('owns a card only at the EXACT path, unlike a frame', () => {
    // A frame named `test` contains c1's `test/test2` card…
    expect(owners.get('test')).toEqual(['c1', 'c2']);
    // …but c1 has no CARD at `test`, so it must not inherit its position.
    expect(cardOwners.get('test')).toEqual(['c2']);
    expect(cardOwners.get('test/test2')).toEqual(['c1']);
    expect(cardOwners.get('color/brand')).toEqual(['c1', 'c2']);
    // `color` is a frame path only: no variable sits directly under it.
    expect(cardOwners.get('color')).toBeUndefined();
    expect(cardOwners.get('loose')).toBeUndefined();
  });

  it('rewrites saved card positions, including the nested-drag `rel:` form', () => {
    expect(migrateGraphPositions({
      'group:test': { x: 1, y: 2 },
      'rel:group:test/test2': { x: 3, y: 4 },
    }, owners, cardOwners)).toEqual({
      'group:c2::test': { x: 1, y: 2 },
      'rel:group:c1::test/test2': { x: 3, y: 4 },
    });
  });

  it('gives an ambiguous card to the FIRST owner and drops the rest', () => {
    // The one old card was attributed to one collection; the other is a
    // genuinely new card and Arrange will place it.
    expect(migrateGraphPositions({ 'group:color/brand': { x: 5, y: 6 } }, owners, cardOwners))
      .toEqual({ 'group:c1::color/brand': { x: 5, y: 6 } });
  });

  it('drops a card key no collection owns rather than keeping it stale', () => {
    expect(migrateGraphPositions({
      'group:gone': { x: 1, y: 1 },
      // A frame path with no card of its own resolves to nothing either.
      'group:color': { x: 2, y: 2 },
    }, owners, cardOwners)).toEqual({});
  });

  it('is idempotent with no version flag, and a scoped key wins', () => {
    const once = migrateGraphPositions({ 'group:test': { x: 1, y: 2 } }, owners, cardOwners);
    expect(migrateGraphPositions(once, owners, cardOwners)).toEqual(once);
    expect(migrateGraphPositions({
      'group:c2::test': { x: 9, y: 9 },
      'group:test': { x: 1, y: 2 },
    }, owners, cardOwners)).toEqual({ 'group:c2::test': { x: 9, y: 9 } });
  });

  it('never mistakes `ext-group:` for `group:`', () => {
    const stored = { 'ext-group:test': { x: 1, y: 2 }, 'rel:ext-group:test': { x: 3, y: 4 } };
    expect(migrateGraphPositions(stored, owners, cardOwners)).toEqual(stored);
  });
});

describe('3b — two collections owning one group name get two cards', () => {
  // The rows carry their variable id so a bucket can be identified without
  // caring how a row is formatted.
  const toNode = (v: { collectionId: string; name: string }) => row(`${v.collectionId}:${v.name}`, v.name);

  it('never merges same-named groups from different collections', () => {
    const { groups } = bucketUnmanagedVariables([
      { collectionId: 'c1', name: 'color/brand/500' },
      { collectionId: 'c2', name: 'color/brand/700' },
    ], toNode);

    // One bucket each, attributed to its OWN collection — the old bucket took
    // whichever collection arrived first and swallowed both rows.
    expect(Array.from(groups.keys()).sort()).toEqual(['c1::color/brand', 'c2::color/brand']);
    expect(groups.get('c1::color/brand')).toMatchObject({ collectionId: 'c1', groupName: 'color/brand' });
    expect(groups.get('c2::color/brand')).toMatchObject({ collectionId: 'c2', groupName: 'color/brand' });
    expect(groups.get('c1::color/brand')!.nodes.map(n => n.name)).toEqual(['color/brand/500']);
    expect(groups.get('c2::color/brand')!.nodes.map(n => n.name)).toEqual(['color/brand/700']);
  });

  it('still merges the same group name within ONE collection', () => {
    const { groups } = bucketUnmanagedVariables([
      { collectionId: 'c1', name: 'color/brand/500' },
      { collectionId: 'c1', name: 'color/brand/700' },
    ], toNode);
    expect(Array.from(groups.keys())).toEqual(['c1::color/brand']);
    expect(groups.get('c1::color/brand')!.nodes).toHaveLength(2);
  });

  it('routes loose variables to their own collection, never to a group', () => {
    const { groups, loose } = bucketUnmanagedVariables([
      { collectionId: 'c1', name: 'test' },
      { collectionId: 'c2', name: 'test' },
      { collectionId: 'c1', name: 'test/test2' },
    ], toNode);

    // `test` the variable and `test` the group path no longer collide, and
    // the two collections' loose `test` stay apart.
    expect(loose.get('c1')!.map(n => n.name)).toEqual(['test']);
    expect(loose.get('c2')!.map(n => n.name)).toEqual(['test']);
    expect(Array.from(groups.keys())).toEqual(['c1::test']);
  });

  it('keeps the bucket key and the card key in the same shape', () => {
    const { groups } = bucketUnmanagedVariables(
      [{ collectionId: 'c1', name: 'color/brand/500' }], toNode
    );
    const [bucketKey, bucket] = Array.from(groups.entries())[0];
    expect(getGroupCardKey(bucket.collectionId, bucket.groupName)).toBe(`group:${bucketKey}`);
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
      new Set(['c1::test']),
      filters,
      new Map()
    );

    expect(unitKeyByGroupKey.get('group:test')).toBe('wrapper:c1::test');
    expect(unitKeyByGroupKey.get('group:test/test')).toBe('wrapper:c1::test');
    expect(units.map(u => u.key)).toEqual(['wrapper:c1::test']);
  });

  it('folds the collection ROOT card into the collection frame too', () => {
    // buildWrapperLayout nests it, so Arrange has to agree — otherwise it
    // would move a parent-relative node with absolute coordinates.
    const cards = [collectionCard(), card('test')];
    const { unitKeyByGroupKey, units } = buildArrangeUnits(
      cards,
      new Set(['c1::']),
      filters,
      new Map()
    );

    expect(unitKeyByGroupKey.get('collection:c1')).toBe('wrapper:c1::');
    expect(unitKeyByGroupKey.get('group:test')).toBe('wrapper:c1::');
    expect(units.map(u => u.key)).toEqual(['wrapper:c1::']);
  });
});
