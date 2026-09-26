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

- Card keys become `group:<collectionId>::<groupName>`, reusing the `::` convention already used by `getCollectionGroupKey` for filters. Collection ids contain `:` but never `::`, so the parse is unambiguous.
- Wrapper paths likewise: `wrapper:<collectionId>::<path>`, with the empty path meaning the collection itself — which is what `handleLevelUp` produces for a top-level card, giving the `marko` frame.
- `unmanagedGroupsMap` is keyed by `<collectionId>::<groupName>`, fixing the merge at source.
- `SidebarFilter.tsx:98` builds the same shape; `collectionId` is already in scope there.
- Untouched: `source:`/`shader:`/`shades:`/`steps:`/`selection:` are keyed by variable or node id and are already unique. `collection:` already embeds the id.

### Migration

`graph-positions` (`Record<string,{x,y}>`) holds every card key plus `rel:<key>` for dragged nested cards — on the real file, the layout of 161 cards. `graph-grouped-paths` holds bare paths.

- [ ] Migrate on load: for each old `group:<name>` / `wrapper:<path>` key, resolve the collection that owns that group name. Exactly one owner → rewrite. Several → keep the first-seen (that is the card that existed before) and drop the rest, which are new cards and will be arranged.
- [ ] `rel:` entries rewrite their inner key by the same rule.
- [ ] Idempotent with no version flag: a `group:` key with no `::` is old by construction.
- [ ] Unresolvable keys are dropped, not kept — a stale absolute position is worse than an arranged one.

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
- [ ] After 3: reload with an existing `graph-positions` and confirm the layout survives rather than resetting.
- [ ] NOT verified against Figma for 3a — no plugin connection this session. Still to check there: a top-level card like `test` now shows the level-up button and grouping it draws a frame titled with the COLLECTION name holding every card of that collection; the frame itself offers ungroup but no level-up; two collections that both use path `test` get two separate frames; and a reload with a pre-3a `graph-grouped-paths`/`graph-positions` keeps the frames and their positions.
