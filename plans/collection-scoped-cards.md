# Cards: loose variables, wrapper membership, and collection-scoped identity

Three faults found on the real file, in increasing size.
They share a root cause — a card is identified by a **group path alone**, with no collection and no way to tell a real group from a variable that merely has no slash.

## 1. A slash-less variable collides with a same-named group

`GroupedGraph.tsx:816`:

```ts
const groupName = parts.length > 1 ? parts.slice(0, -1).join('/') : variable.name;
```

A variable with no `/` uses its own name as its group name.
So variable `test` and the parent path of `test/test2` produce the same bucket key and land in one card, despite being unrelated.
Measured on the real file: 1 of 161 cards is affected, and it is the card that prompted the report.
The same fallback is duplicated for external tokens at `1077` and `1670`.

**Decision: every collection always has a root card, and loose variables are its rows.**
`collection:<id>` cards already exist — `buildEmptyCollectionCards` mints one for a collection with no variables at all, with its own key namespace and its own "+" button.
That condition is the bug: adding the first variable to a collection makes its card disappear, taking with it the only way to add a variable at the collection's root.
So the card is emitted for EVERY collection, unconditionally, with the collection's loose (slash-less) variables as its rows — possibly none.
This is the same "the collection is the root" answer already chosen for part 3.

Consequences, all of which the implementation must handle:
- ~6 new cards on the real file, several with no rows. Intended: the card is the collection's root node and its "+" target.
- `GraphNode.tsx`'s `isEmptyCollectionCard` branch renders a "+" INSTEAD of the normal controls. That was a safe proxy for "collection card" only while such cards were always empty.
- `isCardHidden` must not treat a zero-row collection card as "nothing visible" and park it while its collection is selected.
- `getGroupHeight` must give a zero-row card a sensible minimum.

- [x] Loose variables bucket into `collection:<collectionId>` instead of `group:<variableName>`, and are registered in `varMap` under that key so their reference edges still draw.
- [x] `buildEmptyCollectionCards` becomes `buildCollectionCards`: emits exactly one card per collection, always, carrying that collection's loose variables as rows.
- [x] The card keeps `kind: 'collection'`, so the add-variable path stays as it is. Header: the "+" only — the dropdown (rename/duplicate/edit as text/delete) and level-up all address a group path a collection root does not have. Rows: the ordinary row controls (rename on double-click, delete), which address a variable id and work here unchanged.
- [x] `isCardHidden` short-circuits only for a ROW-LESS collection card; with rows it takes the ordinary type/group rules, so a loose variable still disappears when its type is filtered out. `getGroupHeight` already floors an empty card at one row.
- [x] External-token fallback at `1077`/`1670` left alone, with a comment at `1077`: the fix was to host loose variables on their collection's root card, and a published library token has no local collection card to host it.
- [x] Tests: `tests/ui/components/Relationships/collectionCards.test.ts` (renamed from `emptyCollectionCards.test.ts`), plus new collection-card cases in `GraphNodeCollectionCard.test.tsx`.

## 2. A wrapper frame excludes the card at its own path

`outermostGroupedAncestor` (`utils.ts:551`) tests strict ancestors only:

```ts
for (let depth = 1; depth < parts.length; depth++)   // never tests the path itself
```

So the frame named `test` holds `group:test/test` but not `group:test`.
Measured live: `wrapper:test` at (-360, 6440), `group:test/test` at (-344, 6492) inside it, `group:test` at (920, 10304) — 3,800px away, off screen. It reads as a missing card.

- [x] `outermostGroupedAncestor` and its mirror `deepestGroupedAncestor` (`wrapperLayout.ts:46`) also match the path itself — for CARDS. `deepestGroupedAncestor` gained an `includeSelf` flag: the wrapper→parent walk in `attach()` stays strict, or frame `p` would become its own parent and the deepest-match walk would pick that self-match over the real parent.
- [x] `buildWrapperLayout`'s wrapperPaths walk widened to match, so the frame a card folds into always exists — Arrange and layout have to agree on the unit key.
- [x] `handleLevelUp` still terminates: it requires a `/` in the path and a non-empty parent, so it only ever adds a STRICT ancestor and a card can never group itself into existence.
- [x] Tests: `tests/ui/components/Relationships/wrapperMembership.test.ts` — membership, nesting, acyclicity, parent-before-child array order.

## 3a. Level-up cannot reach the collection

A wrapper is keyed by a bare path from the variable names (`color`, `color/brand`), and `handleLevelUp` drops the last segment:

```ts
const parent = path.split('/').slice(0, -1).join('/');
if (!parent) return;           // top-level card: nothing to group into
```

A collection is never a segment of any variable name, so a top-level card has no parent to rise to and the level-up button is not even offered.
The collection is the obvious parent and it is simply absent from the key space.

Separately, because wrapper paths carry no collection, a frame named `test` would gather `test*` cards from EVERY collection.

**Decision: wrapper keys become `<collectionId>::<path>`, with the empty path meaning the collection itself.**

- [x] Node id `wrapper:<collectionId>::<path>` (`WRAPPER_NODE_PREFIX` + `getWrapperKey`); `<collectionId>::` is the collection's own frame, titled with the collection name (`collectionNameById`, falling back to the id).
- [x] Membership: card belongs to frame `(cid, p)` when `card.collectionId === cid` AND (`p === ''` OR `cardPath === p` OR `cardPath` starts with `p + '/'`). The collection root card (no path) belongs to its collection frame only. The part-2 self-path inclusion is kept: `deepestGroupedAncestor`/`outermostGroupedAncestor` walk depth 0 (the collection) through `parts.length`.
- [x] `handleLevelUp` on a top-level path yields `<cid>::`, which is the collection frame — the case that returned early. Every standard card now sets `canGroup: true`.
- [x] A collection frame has no level-up of its own (`GraphWrapperNode` gates on `data.path !== ''`, was `includes('/')`). A collection ROOT CARD has none either: `GraphNode`'s collection branch renders the "+" alone, unchanged.
- [x] `WrapperNodeData` gains `collectionId`; `onLevelUp`/`onUngroup` take `(collectionId, path)`. `WrapperPlacement.collectionId` is wired through at the wrapper-node construction site.
- [x] The wrapper→parent walk stays strict and terminates: `<cid>::a/b` → `<cid>::a` → `<cid>::` → nothing. The collection frame has no candidates at all (`maxDepth = -1`).
- [x] Arrange folds collection ROOT cards too — `buildWrapperLayout` now nests them, so `buildArrangeUnits` had to widen from `kind === 'standard'` to the same `isStandardLayoutCard` set, or it would move a parent-relative node absolutely.

### Migration for 3a

- [x] `graph-grouped-paths` holds bare paths. Rewritten to `<cid>::<path>` for every collection that actually owns that path — a bare path that two collections both use becomes two entries, which is what the user saw as one frame before.
- [x] `graph-positions` keys `wrapper:<path>` (and `rel:wrapper:<path>`) rewrite the same way; ambiguous ones keep the first collection (collections-prop order) and drop the rest. Card keys pass through untouched — those are 3b.
- [x] Unresolvable entries (a path no collection owns any more) are dropped, not kept.
- [x] Idempotent with no version flag: a `wrapper:` key or grouped path with no `::` is old by construction. A pass-through key wins over a migrated one landing on it, so a half-migrated record never loses the correct entry. The migrated shape is written back only when it actually changed.
- [x] **Where it runs:** ownership needs the variables, and client storage answers long before the plugin sends any — so the raw records are parked in `pendingStorageRef` and applied by a dedicated effect once `collections.length > 0`. Nothing is dropped for arriving early; each record is consumed as it is applied, so the effect runs once per storage response and can never clobber a drag.
- [x] `buildWrapperPathOwners` defines ownership as "some variable of that collection sits at that group path or below it" — exactly when the old collection-blind frame really did draw a card from that collection. Loose (slash-less) variables own nothing.

## 3b. Card identity carries no collection

`unmanagedGroupsMap` (`810-822`) is keyed by group **name alone**, and the bucket's `collectionId` comes from whichever variable arrived first.
Two collections owning `color/brand` therefore merge into ONE card attributed to the first collection — the merge happens before the key is built, so re-keying alone does not fix it.

**Decision (chosen): the collection becomes the real root.**

- [x] Card keys become `group:<collectionId>::<groupName>` (`getGroupCardKey`, `GROUP_NODE_PREFIX`), reusing the `::` convention already used by `getCollectionGroupKey` for filters. Collection ids contain `:` but never `::`, so the parse is unambiguous.
- [x] Wrapper paths likewise: `wrapper:<collectionId>::<path>` — landed in 3a.
- [x] `unmanagedGroupsMap` is keyed by `<collectionId>::<groupName>`, fixing the merge at source. The bucketing loop moved out of the layout effect into `bucketUnmanagedVariables` (`utils.ts`), a pure rule that takes the caller's row formatter as a callback — the merge was the whole bug and had no test harness while it sat inline.
- [x] `SidebarFilter.tsx:98` calls `getGroupCardKey` instead of building the string by hand, so the sidebar row and the card it highlights cannot drift. `highlightedGroupKey` is whole-string equality against a card key, so it keeps matching.
- [x] Untouched: `source:`/`shader:`/`shades:`/`steps:`/`selection:` are keyed by variable or node id and are already unique. `collection:` already embeds the id.
- [x] `ext-group:` **left unscoped**, both construction sites. The only id available is the PUBLISHING library's, which no local collection, ownership map or wrapper frame can resolve, and a token with none at all falls back to the literal `'external'`. Scoping it would also make every saved `ext-group:` position unmigratable — nothing local can resolve the owner — so it stays a bare path and its position survives untouched. Same reasoning as part 1's decision to leave the slash-less fallback there alone.
- [x] Card initial stacking order is unchanged for a single-collection file: the entries are still sorted by group NAME, with the collection id only as a tie-break. Sorting by the composite key would have ordered cards by raw Figma id.

### Consequence, NOT fixed here (reported, not silently widened)

`varMap` (`GroupedGraph.tsx`) is keyed by variable NAME alone, globally. Two collections holding the identical full variable name now land in two different cards, but `varMap` keeps only the last one — so a reference edge to that name can attach to the wrong collection's card. Before 3b both rows lived in one merged card, so the group key was at least right. Fixing it means resolving references by the alias target's collection, not by name, which is a separate change (`varsByName` is collection-blind throughout).

### Migration

`graph-positions` (`Record<string,{x,y}>`) holds every card key plus `rel:<key>` for dragged nested cards — on the real file, the layout of 161 cards. `graph-grouped-paths` holds bare paths.

- [x] Migrate on load, in the SAME `pendingStorageRef` effect 3a added (gated on `collections.length > 0`), not a second pass: `migrateGraphPositions` now handles the `group:` prefix alongside `wrapper:`. Exactly one owner → rewrite. Several → first owner (collection order) keeps the position, the rest are dropped as genuinely new cards.
- [x] `rel:` entries rewrite their inner key by the same rule — the `rel:` prefix is stripped and re-applied around whichever prefix matched.
- [x] Idempotent with no version flag: a `group:` key with no `::` is old by construction, and an already-scoped key passes through and wins over a migrated one landing on it.
- [x] Unresolvable keys are dropped, not kept.
- [x] **Ownership is EXACT-path for cards**, at-or-below for frames. `buildWrapperPathOwners` gained an `{ exactPathOnly }` option rather than a second map: a collection whose only variable is `test/test2/leaf` sits INSIDE the frame `test` but has no CARD at `test`, so it must not be handed the old `group:test` position. Without this the ambiguous case would hand the layout to a card that does not exist and arrange the one that does — the 3a fixture (`c1` at `test/test2`, `c2` at `test`) is exactly that case.
- [x] `graph-grouped-paths` needs nothing here: it holds wrapper paths only, migrated in 3a.

### Blast radius (measured, not estimated)

- 2 construction sites for `group:`, 2 for `ext-group:` (hand-mirrored, must stay in sync), 1 in `SidebarFilter`.
- 1 structural parse (`utils.ts:639`, `slice('wrapper:'.length)`); everything else is prefix tests or whole-string equality.
- Card keys never reach the plugin sandbox except as opaque `set-client-storage` payload. No plugin changes.
- ~38 assertions across `arrangeVisibility.test.ts`, `arrangeTiers.test.ts`, `emptyCollectionCards.test.ts` pin the current shapes.
- `WrapperNodeData` has no `collectionId` even though `WrapperPlacement` computes one and drops it at `GroupedGraph.tsx:1216`.

## Order

1 and 2 are independent bug fixes and landed first, smallest first (commit `7f7fa59`).
3a next: it is what makes the collection reachable by level-up, and it touches only wrapper keys.
3b last, because it rewrites card keys, which are the noisiest part and the one with a real migration cost.

## Verify

- [x] Parts 1 and 2: `npm run build` clean (0 `WebSocket` in `dist/index.html`), `npx vitest run` 217 passing (was 200), `tsc` 251 — identical error set.
- [x] Part 3a: `npm run build` clean (0 `WebSocket` in `dist/index.html`), `npx vitest run` 243 passing (was 217), `tsc` 251 — identical error set, nothing in a touched file.
- [x] Verified live in the browser against the mock dataset, which carries the same shape: the slash-less variable `red` now renders as a row of the `colors` collection card (`collection:VariableCollectionId:5:2`), no `group:red` card exists, the header keeps its "+" and the row keeps its delete. `red` used to be a card of its own.
- [ ] NOT verified against the real Figma file — the plugin disconnected mid-session, so the browser tab had no data. Still to check there: the `marko` card holds `test`; the `test` card holds only `test/test2`; the `test` frame holds both `test` and `test/test`; the five other collections each gain a row-less root card.
- [x] Part 3b: `npm run build` clean (0 `WebSocket` in `dist/index.html`), `npx vitest run` 255 passing (was 243), `tsc` 251 — identical error set (the two `SidebarFilter.tsx` errors are the pre-existing ones at HEAD lines 517/691, shifted by the added import).
- [ ] After 3: reload with an existing `graph-positions` and confirm the layout survives rather than resetting.
- [ ] NOT verified against Figma for 3b — no plugin connection this session. Still to check there: two collections that both own `color/brand` render as TWO cards, each attributed to its own collection; clicking either group name in the sidebar highlights the card of THAT collection; and a reload with a pre-3b `graph-positions` keeps ~161 cards where they were instead of re-arranging.
- [ ] NOT verified against Figma for 3a — no plugin connection this session. Still to check there: a top-level card like `test` now shows the level-up button and grouping it draws a frame titled with the COLLECTION name holding every card of that collection; the frame itself offers ungroup but no level-up; two collections that both use path `test` get two separate frames; and a reload with a pre-3a `graph-grouped-paths`/`graph-positions` keeps the frames and their positions.

---

# 4. Nested cards: the card IS the container

Agreed shape (from the reference mock, which is our own UI nested by hand):

```
marko                      ← container: header, its own rows, then its children. DASHED outline.
  test  {color/border/low}     ← the collection's loose variable, a row of the container
  test/test                    ← leaf card, solid outline
  test                         ← container (has children): DASHED
    test2 {color/on-surface/3} ← its own row
    test/test                  ← leaf card, solid
```

One object, not two. Today a group is a card (`group:test`) AND a frame (`wrapper:<cid>::test`) that are really the same thing; this merges them.
A card with children is drawn dashed; a leaf card solid. No separate frame chrome and no second header.

## Why 3b is a prerequisite

A container is identified per collection (`<cid>::<path>`) — that is what makes `marko`'s `test` distinct from another collection's `test`.
A card is `group:<path>`, collection-blind. For the card to BE the container the two identities have to be the same string, so cards must carry their collection first.

## Identity: keep the `wrapper:` node id, absorb the card

The container node KEEPS its existing id, `wrapper:<cid>::<path>` (and the collection's is `wrapper:<cid>::`).
The card whose path matches a container stops being emitted as its own node; its header, rows and header actions render as the container's own.

The alternative — making the container BE the card node, `group:<cid>::<path>` — reads better on paper but forces a second `graph-positions` migration one commit after the last one, over the same keys, for no visible gain. A container's saved position is already stored under its `wrapper:` id and stays valid. The absorbed card's own stored position simply goes unused.

So, per grouped path `p` in collection `c`:
- `wrapper:<c>::<p>` renders as a CARD: header `p`, the absorbed card's rows, then its child cards. Dashed.
- The collection's container `wrapper:<c>::` renders header = collection NAME, rows = the collection root card's loose variables. Dashed.
- A leaf card keeps its own `group:<c>::<p>` node. Solid.
- A grouped path with no card of its own is a container with a header and no rows. Same chrome, dashed — no special case in the markup.

## Done

- [x] `buildWrapperLayout` ABSORBS the card at a frame's own `(collection, path)`: it becomes `WrapperPlacement.group` instead of a child unit, and is no longer emitted as a `CardPlacement`. The collection's container absorbs the collection ROOT card (empty path).
- [x] The container keeps its `wrapper:<cid>::<path>` node id, so no second `graph-positions` migration. `getCardNodeId`/`isAbsorbedCard` (`utils.ts`) resolve a card key to the node that draws it; every edge endpoint goes through it, or xyflow would silently drop edges pointing at an id that no longer exists.
- [x] `GraphWrapperNode` is the CONTAINER renderer, not redundant chrome. The header row, the header actions and the variable rows moved out of `GraphNode` into `CardHeaderRow` / `CardHeaderActions` / `CardRows`, exported from `GraphNode.tsx` and used by both — one copy of each, not a second header.
- [x] Level-up is offered ONCE, by the container (`CardHeaderActions showLevelUp={false}`). The card's own button and the frame's fired the identical `onLevelUp(collectionId, path)`.
- [x] A container with rows and no children is exactly a card's box — header plus rows, no trailing dead space. Only the DASHED outline tells the two apart.
- [x] The last own row keeps its bottom border when the container has children (`CardRows keepLastBorder`), so the rows and the children do not read as one stack. `CardRows` returns null when there is nothing to draw, so a row-less container contributes no strip and no stray line.
- [x] "No variables yet" → "No variables at the collection root". Since part 1 every collection has a root card, so a collection with 116 grouped variables landed on the old wording too.
- [x] Shadows: containers have none (the dashed outline is the cue and stacking shadows was the problem), leaf cards and `PropertyNode` are `shadow-xs`.
- [x] `getGroupHeight` did NOT become recursive. Given the chosen identity, a `GroupData` is still one card's own box and has no children; the recursion is `sizeUnit` in `wrapperLayout.ts`, where it already was. Arrange and the tier work therefore see an unchanged `getGroupHeight`. What is new is `getCardRowsHeight` — the same body WITHOUT the one-row floor, because a container never draws the empty-root line.
- [x] `wrapperMemberHeightSum` in `buildArrangeUnits` kept, split into `wrapperStackHeight` + `wrapperOwnRowsHeight` so an absorbed card counts as ROWS rather than a stacked card. It is only the first-pass estimate — from the first paint on, `measuredHeight` wins, and `buildWrapperLayout` sets the frame's exact height as its node style. Making it a true recursion would mean importing `buildWrapperLayout` into `utils.ts`, which `wrapperLayout.ts` already imports from.
- [x] `handleSignature` gained a container term: a container withholds its rows while its own card is filtered out, which adds/removes handles under a node id that STAYS MOUNTED — unlike a hidden card node, which xyflow removes wholesale.
- [x] `groupVisibility` is keyed by CARD key, with a container contributing the card it absorbed, so edge visibility still follows the filters.
- [x] Tests: `tests/ui/components/Relationships/containerCard.test.tsx` (22 cases); `wrapperMembership.test.ts`'s seven "card is a child of its own frame" assertions rewritten to the absorbed shape, parent-before-child array order kept.

## Verify

- [x] `npm run build` clean, 0 `WebSocket` in `dist/index.html`; `npx vitest run` 277 passing (was 255); `npx tsc --noEmit` 251 — identical error set.
- [ ] NOT verified in the browser or against Figma: the dev server is the user's (`npm run dev:bridge`, ports 5173/9337) and was off limits. Still to check there: a container's edges still draw to its own rows; dragging a container moves its whole subtree at an acceptable frame rate; a filtered-out container card's rows disappear and come back with their edges intact.

## Open
- Re-measure drag performance: dragging a container now moves its whole subtree. The numbers in the drag-perf work were taken with at most one level of nesting. Nothing in the memoization changed — per-node `data` is still rebuilt only by the layout effect, `savedPositions` is still read through its ref — but a container drag now moves N descendant nodes per frame instead of one.
- Clicking a container's body does NOT toggle the highlight the way clicking a card does. Left out deliberately: a container's body is mostly the area its children sit in, and making all of it a highlight target would fight click-to-deselect. The header's "Highlight path" and the rows still work.
- A container that absorbed NO card (a grouped path no variable sits directly under) offers no "+". Adding one there would create the card that is missing — worth deciding separately.
