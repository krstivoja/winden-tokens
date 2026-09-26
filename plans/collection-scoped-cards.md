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

## 3. Card identity carries no collection

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

1 and 2 are independent bug fixes and land first, smallest first.
3 lands after, because it rewrites the same keys that 1 and 2 touch and would otherwise force both to be written twice.

## Verify

- [x] Parts 1 and 2: `npm run build` clean (0 `WebSocket` in `dist/index.html`), `npx vitest run` 217 passing (was 200), `tsc` 251 — identical error set.
- [x] Verified live in the browser against the mock dataset, which carries the same shape: the slash-less variable `red` now renders as a row of the `colors` collection card (`collection:VariableCollectionId:5:2`), no `group:red` card exists, the header keeps its "+" and the row keeps its delete. `red` used to be a card of its own.
- [ ] NOT verified against the real Figma file — the plugin disconnected mid-session, so the browser tab had no data. Still to check there: the `marko` card holds `test`; the `test` card holds only `test/test2`; the `test` frame holds both `test` and `test/test`; the five other collections each gain a row-less root card.
- [ ] After 3: reload with an existing `graph-positions` and confirm the layout survives rather than resetting.
