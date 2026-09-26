# Quick search palette (Cmd+K / Ctrl+K)

Jump the Relationships viewport to a collection, a card or a single variable row without hunting for it on a 161-card canvas.

## Scope

Lives inside `GroupedGraphInner`, so it exists only while the Relationships view is mounted.
No global handler in `App.tsx`, and `App.tsx` / `useBridge.ts` are not touched.

## Files

- `src/ui/components/Relationships/GroupedGraph/GraphSearchPalette.tsx` — new, the only new source file.
- `src/ui/components/Relationships/GroupedGraph.tsx` — open/close state, the index, the activate handler.
- `tests/ui/components/Relationships/quickSearch.test.tsx` — new.
- `plans/quick-search.md` — this file, deleted when the gates pass.

## Decisions

### Which Modal do we reuse?

The brief names `src/ui/components/common/Modal`.
That component does not compile: it imports `../IconButton/IconButton`, which does not exist (`IconButton` lives under `common/Button/IconButton`), and it is already two of the 251 baseline `tsc` errors.
It also styles itself with `.modal-overlay` / `.modal` / `.modal-header`, none of which exist in `src/ui/styles`, so it would render unstyled.
Nothing in the app imports it; every real modal uses `src/ui/components/Modals/Modal.tsx` (`ModalOverlay` / `ModalContainer` / `ModalHeader` / `ModalBody` / `ModalFooter`).

So we reuse `Modals/Modal.tsx` — the working shared modal — plus `common/Search`.
No new shared UI component is invented.

`ModalHeader` is deliberately left out: `ModalOverlay` focuses the first focusable child on open, and a header would put its close button ahead of the search input and steal the focus.
A command palette has no title bar anyway.

### Escape and focus

`ModalOverlay` already closes on Escape from a document listener, and `Search` clears its own value on Escape and calls `onClear`.
Both fire; `onClear` closes the palette too, so Escape always closes regardless of ordering.

### Keyboard

`Search` exposes no `onKeyDown`, so Up/Down/Enter are handled on the wrapping element and reach it by bubbling from the input.
`onEnter` is deliberately not passed to `Search`, so Enter is handled exactly once.

The open handler:

- macOS → `metaKey`, elsewhere → `ctrlKey` (never both).
- reacts only to `k`, so the `Cmd+Z` / `Cmd+Shift+Z` handler in `App.tsx` is untouched.
- ignores the event when the target is an editable element outside the palette, and when any modal in `ModalContext` is open — read through a ref so the listener is attached once.

### The absorbed-card trap

A grouped card is absorbed into its container and has no node of its own (commit `1c59262`).
Every card and variable target therefore resolves through `nodeIdForCard` (`cardNodeIdRef`, the map the layout effect writes) before `fitView`.
A raw `group:<cid>::<path>` would silently do nothing.

Four target shapes:

| Result | Target | Action |
| --- | --- | --- |
| Collection | `{ collectionId }` | existing `handleZoomToCollection` |
| Card | `{ cardKey }` | `highlightTarget = { groupKey, varName: null }` + `fitView` on `nodeIdForCard(cardKey)` |
| Container (grouped path with no card of its own) | `{ nodeId }` | `fitView` only |
| Variable | `{ cardKey, varName }` | `highlightTarget = { groupKey, varName }` + `fitView` on `nodeIdForCard(cardKey)` |

A collection ROOT card with no loose rows is not offered at all: highlighting it would dim every other card and light up nothing (the case `handleNodeClick` already refuses), and the Collection result carries the same name and is the better jump.

A card-less container zooms without highlighting on purpose: `highlightTarget` addresses CARD keys, and the layout effect does `highlightedGroups.add(highlightedGroupKey)` after failing to find a matching group — feeding it a `wrapper:` id would leave every card dimmed and nothing highlighted.

Unlike `handleHighlightFromSidebar`, activation does not toggle.
Searching for the card that is already highlighted must still move the viewport to it.

### Hidden cards

Filtered-out cards stay in the node list as `hidden: true`.
**We do not offer them.** A result that cannot be shown is a dead end — `fitView` on a hidden node parks the canvas on empty space, exactly the failure `handleZoomToCollection` already guards against.
Instead the palette counts them and prints one line under the results: `N more hidden by the current filters`, so a user whose search "finds nothing" learns why instead of concluding the card does not exist.

Visibility for a card comes from `isCardHidden(group, cardVisibilityFilters)` — the same predicate the layout effect renders as `node.hidden` and Arrange Grid uses. A card-less container uses its node's own `hidden` flag.
A collection is hidden when it has no visible card.

### Empty query

**Collections, all of them.**
Chosen over "most recently arranged / top-level cards" because there is no recency to read: `savedPositions` is a bare `{id: {x,y}}` record with no timestamps, and it sits behind `savedPositionsRef` precisely so nothing new reads it per render.
Collections are also the coarsest, always-meaningful jump and the shortest list.

### Drag performance

- Query state lives **inside** the palette; `GroupedGraphInner` only holds the `boolean`. Typing never re-renders the graph.
- The index is a `useMemo` gated on that boolean, so it costs nothing while the palette is closed, and it is not in the layout effect.
- No new work in the layout effect, `savedPositions` stays behind its ref, no per-node/per-edge `data` or callback identity changes.
- `handleHighlightFromSidebar` is refactored onto a shared `zoomToNodeId` helper whose only dep is `reactFlowInstance`, so its identity stays as stable as before.

## Steps

- [x] Read `CLAUDE.md`, `specs/`, `GroupedGraph.tsx`, `Modal`, `Search`, theme tokens
- [x] Confirm baselines: 277 tests, 251 `tsc` errors
- [x] `GraphSearchPalette.tsx` — types, `isMacPlatform`, `matchGraphSearchItems`, the component
- [x] `GroupedGraph.tsx` — `zoomToNodeId`, `focusCard`, `searchOpen`, index memo, activate handler, Cmd+K listener, render
- [x] `tests/ui/components/Relationships/quickSearch.test.tsx`
- [x] Gates: build, vitest, tsc, `grep -c "WebSocket" dist/index.html`

## Notes

- `text-base` is a COLOUR here (`--color-base`), and `--font-size-base` also exists, so the utility is ambiguous. The palette uses `text-sm` / `text-xs` for size and `text-text` for colour, never `text-base`.
- Synthetic `ext-group:` cards (library tokens bound to the Figma selection) are built inside the layout effect from `selectedNode`, not in `groupsData`, so they are not indexed. They only exist while something is selected, and the selection auto-frames itself already.
