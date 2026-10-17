# Hide unused while a path is highlighted

Branch: `feat/calm-dark-theme` working tree, own commit (decision E).

## Problem

With many connections, highlighting a card or row in the Relationships graph only dims the rest (`opacity-55` cards, `0.45` edges).
The unrelated wires and cards still fill the canvas, so the traced chain is hard to read.
User wants a toggle: while something is selected, hide everything not connected to it.

## Current state (found)

- One highlight state: `highlightTarget { groupKey, varName | null }` (`GroupedGraph.tsx:213`).
- Set by card click, row click, card menu "Highlight path", sidebar group label, search palette; cleared on pane click.
- Connected set computed inline in the layout effect (`GroupedGraph.tsx:1292-1348`): transitive upstream + downstream walk.
  Outputs `highlightedVars`, `highlightedEdgeIds`, `highlightedGroups`, `hasHighlight`.
- React Flow `hidden` already drives the sidebar filters: cards `cardHidden(group)` (:1453), wrappers `!hasVisibleChild` (:1556), edges hidden when an endpoint is hidden (:1657-1674), property edges (:1715).
- Positions are stored per node, so hiding does not reflow anything (except Arrange Grid, which parks hidden cards below the grid).
- Toolbar: `TextButton variant="secondary"` row (:2100-2175). Prefs persist via Figma clientStorage keys (`graph-layout-settings` pattern, :359-375).
- No eye / filter icon in `components/icons/svg/` yet.

## Plan

### 1. State + persistence

- `hideUnused: boolean` in `GroupedGraphInner`, persisted under new clientStorage key `graph-hide-unused` (same load/save pattern as `graph-layout-settings`).
- Off by default.

### 2. Toolbar toggle

- New toolbar control "Hide unused" next to "Focus Selection".
- Always visible; does nothing visible until a highlight exists (tooltip says "Hides cards and wires not on the highlighted path").
- Rendered with an existing component (decision A).

### 3. Hiding rule (layout effect)

When `hideUnused && hasHighlight`:
- Card hidden unless it is in `highlightedGroups` (OR'd with the existing filter `cardHidden`, never un-hides a filtered card).
- Edge hidden unless in `highlightedEdgeIds` (decision B for group-sibling edges).
- Wrapper frames: hidden when no visible child, via the existing `hasVisibleChild`.
- Rows inside a visible card: decision C.
- Tier labels: hidden when every card in that tier is hidden.
- Selection property edges (`prop-edge:*`): keep existing rule (follow source visibility).
- External/synthetic cards: hidden unless an edge on the path touches them.

Implemented as one predicate `isOffPath(group)` combined into the existing `cardHidden`, so filters and hide-unused share one code path.

### 4. Interaction details

- Pane click clears highlight → everything reappears (no extra state).
- Search palette and "Zoom to collection" already skip hidden nodes; check they still find off-path cards when hide-unused is on (palette should still list them; activating one moves the highlight, so it becomes visible).
- Arrange Grid while hiding: disable the button while hide-unused is actively hiding, so it can't park half the graph (decision D).
- After toggling on, `fitView` to the visible nodes (with existing padding/animation) — decision D.

### 5. Tests (`tests/…/Relationships/`)

- Unit test the hiding predicate: card on path visible, off path hidden, filtered card stays hidden, wrapper hides with no visible child, edges.
- Undo/redo: highlight is keyed by group/var name, not id, so it survives recreate — add one assertion.

### 6. Docs

- `specs/functions.md` Relationships section: one bullet for the toggle.

## Verify

- `npm run build`, `npx vitest run`, UI tsc ≤ 251.
- Browser preview with mock data containing a long chain plus unrelated cards: toggle on/off, row vs card highlight, pane click, sidebar filters combined, light + dark screenshots.
- Real Figma on a large file (the 580-variable `components` collection).

## Decisions (approved 2026-10-17)

- **A.** `TextButton variant="secondary"` reading "Hide unused" / "Show all"; no new component, no icon.
- **B.** Group-sibling edges are hidden while hiding.
- **C.** Rows inside visible cards stay, dimmed as today.
- **D.** Toggling on (with a highlight) fits view to the visible path; Arrange Grid disabled while actively hiding.
- **E.** Stacked in the same working tree as the uncommitted `feat/calm-dark-theme` work; split into separate commits at the end.

## Progress

- [x] 1 state + persistence
- [x] 2 toolbar toggle
- [x] 3 hiding rule
- [x] 4 interaction details
- [x] 5 tests
- [x] 6 docs
- [x] card menu item "Hide unused" / "Show all" above Delete (user request, 2026-10-17)
- [x] fix: Dropdown menu clicks bubbled to React Flow node click, so menu "Highlight path" toggled itself off; menu now stops click propagation
- [x] fix: open card menu rendered under the next card; node holding an open dropdown is lifted (`data-dropdown-open`)
- [x] fitView capped at maxZoom 1 (one-card path blew up to 2.5x)
- [x] verify: build, 435 tests, UI tsc 251, browser preview (toolbar + card menu flows)
- [x] sidebar sync (user decision 2026-10-17: "really uncheck"): when hiding activates (toggle on with a highlight, or highlight moves while on), off-path groups are unchecked for real in the Collections filter; "Show all" does not re-check them
  - `planSidebarUncheck` / `applySidebarUncheck` / `isCardHiddenByHideUnused` in `GroupedGraph/hideUnused.ts`; FilterContext exposes `setSelectedGroups` / `setSelectedCollectionIds`
  - A later activation re-checks only what hide-unused itself unchecked (kept across "Show all", dropped once the user re-ticks it), so a moved highlight is never hidden by the previous path's write
  - OR kept only for cards the tree cannot hide (library cards, collection root beside an on-path group, shared group key); off-path wires still hidden
  - Verified in browser preview: toggle, card menu, re-tick while hiding, highlight move, Show all + re-activate
- [ ] verify in real Figma on a large file
