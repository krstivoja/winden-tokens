# Graph: "Sort by: Tier / Collection" — collection rows as a second layout

Status: Revision 2 (below) supersedes the row design; Revision 1 was implemented, then replaced. Open: C1 independent verifier, C2 browser QA, C3 manual Figma check, C4 plan deletion.

Related: `plans/arrange-tiers-and-wrapping.md` documents the Tier layout, which stays as it is (its open manual Figma check still applies to Tier mode).

## Revision 2 (user feedback after testing Collection mode) — supersedes the row design below

Problem: with shared rows, a later collection's tier-2 column started far below the previous row's tall tier-1 column, leaving large empty areas.

New Collection-mode design:
- NO rows. Collection mode = the Tier layout with a different in-column sort: the same shared tier columns left to right, every column starts at the top.
- Inside a column, units stack by collection order (the `collections` order from the app context, e.g. `_global`, color, typography, components, dimensions), then by the existing within-collection order (title, then barycenter sweeps — reordering never crosses a collection boundary).
- Managed chains stay one line across lanes 0/1/2, placed in their collection's turn (a chain's top = the lowest bottom of its lanes so far).
- Implemented as one optional input `collectionOrder` on `arrangeGroupsByConnectedBlocks`; absent (Tier mode) the code path and its results are unchanged.
- NO collection labels: the `kind: 'collection'` TierLabelNode variant, `row-label:` nodes, `RowPlacement`, `LayoutLabels` and the `graph-layout-labels` storage key are removed. A stored `graph-layout-labels` record is cleared on load; `row-label:`/`tier-label:` keys are stripped from `graph-positions` by the load migration.
- Tier captions stay once at the top of each column, both modes, in `graph-tier-labels`. Collection mode with no stored captions shows the captions of its live default layout; a drag save freezes them.
- Kept: Sort by (default Tier) with Apply/Cancel/Undo; frames take one slot; filters: hidden units are skipped by the default layout and parked in a spare column right of the grid by Arrange (exactly as Tier mode); Hide unused never moves cards; the Undo overlap fix (snapshot = saved record + tier captions, plus the previous `sortBy` when Apply switched it — Decision 8).
- Sidebar collection click (and quick-search collection jump), Collection mode only: pan to the collection's first card — the topmost visible top-level card/frame of that collection in the leftmost column it appears in, skipping the empty collection-root card ("No variables at the collection root" — no connections, so always tier 1); that card is the target only when nothing else of the collection is visible. Tier mode keeps fitting all of the collection's cards.
- Removed as dead: `rowLayout.ts`, row constants, `isRowLabelHidden`, y-aware caption hiding, `widthOverrides`, `TierPlacement.y`.

Revision 2 steps:
- [x] R1 `arrangeGroupsByConnectedBlocks` `collectionOrder` option (Tier path unchanged) + tests
- [x] R2 Remove row layout, row labels, `graph-layout-labels` (clean on load), dead helpers; strip label keys from saved positions
- [x] R3 Default layout + Arrange in Collection mode via the Tier code path; undo snapshot without layout labels
- [x] R4 Sidebar / quick-search collection focus → first card in Collection mode
- [x] R5 Tests + specs updated; `npm test`, `npm run build`, tsc baseline

## Summary (Revision 1 — superseded by Revision 2)

Grid Settings gains a **Sort by** option: **Tier** (default) or **Collection**.

- **Tier** = today's behaviour, unchanged: the default layout (iterative column propagation in the `groupsData` memo, `GroupedGraph.tsx` ~1073-1205, plus `buildWrapperLayout`'s `naturalPos`/`columnBottoms` packing) and Arrange Grid (`arrangeGroupsByConnectedBlocks`, `GroupedGraph/utils.ts` 295-553) with "Tier N" captions.
- **Collection** = new: the canvas splits into ROWS, one per collection, in the order of `collections` from the app context (top to bottom).
  Inside a row the tier columns stay, left to right; cards of one tier stack vertically in that row's column.
  Row height = tallest column of that row; rows are separated by a row gap.
  A collection name label sits at the start of each row; tier captions sit once above the first row.

Arrange Grid and the default layout both follow the chosen mode.
Saved manual positions still win in both modes.
Undo Arrange keeps working in both modes, and its snapshot is fixed (known overlap bug, applies to both modes).

The Tier code path stays untouched wherever possible: Collection mode is a new pure function plus one optional input to `buildWrapperLayout`, selected by the setting.
Existing Tier tests (`arrangeTiers.test.ts`, `arrangeVisibility.test.ts`, `wrapperMembership.test.ts`, `oneLevelFrames.test.tsx`, …) must pass without changes to their expectations.

## Decisions

From the user:
1. Both layouts exist; Tier is not replaced. `Sort by: Tier / Collection` in Grid Settings, persisted with the other grid settings, default Tier.
2. Collection mode: rows per collection in collection order; tier columns inside each row; same-tier cards stack vertically; row height = tallest column; gap between rows.
3. Collection label at the start of each row, styled like the tier caption, no background band.
4. Arrange Grid and the default layout use the chosen mode; saved positions win; Undo Arrange works.
5. The Undo overlap fix is part of this change and applies to both modes.

Setting and switching:

6. **`GridLayoutSettings.sortBy: 'tier' | 'collection'`**, normalized in `normalizeGridLayoutSettings` (missing/unknown → `'tier'`, so every stored record loads as Tier), mirrored in `GridLayoutDraft` / `toGridLayoutDraft`, written in the same `graph-layout-settings` client-storage record.
7. **Control:** a "Sort by" row at the top of the existing Grid Settings dropdown, using the existing `common/SegmentedControl` (already used by `ColorPickerModal`/`ShadesModal`; options `Tier`, `Collection`; `fullWidth`), same label markup as "Horizontal gap"/"Vertical gap". No new component.
8. **Switching takes effect on Apply (recommended)**: Apply already saves the settings and runs Arrange, so switching the mode re-arranges immediately, with Undo Arrange available to get the previous positions back. When the Apply switched the mode, the undo snapshot also records the previous `sortBy` and Undo Arrange restores it (state + `graph-layout-settings`) along with the positions — otherwise `{}` positions under the new mode would still draw the new mode's layout. A plain Arrange (no mode change) records no mode, and its Undo leaves the mode alone. The gaps stay as applied.
   The segmented control only edits the draft (like the gap inputs), so Cancel discards a switch.
   Undo restores positions and labels only; the mode stays what was applied (it is a setting, like the gaps).
   When nothing is saved yet (pure default layout), Apply's Arrange simply saves the new mode's layout; the default layout itself also follows the mode, so a user who never arranges sees the switch too.

Collection mode design (recommendations 1-7, accepted):

9. **Tier = global depth, columns aligned across rows.**
   Depth = today's: longest path over the FULL connection graph (`depthConnections`, hidden endpoints included), remapped onto units.
   Every row uses the same column grid, so every edge (also between rows) flows strictly left to right.
   A row whose cards are all high-tier starts with blank columns; accepted, it shows the collection sits downstream.
   Empty-column collapse is global: a column survives if any visible row has a unit in it.
10. **Column width = widest unit in that column across all rows** (a one-level frame is 312px, a card 260px); column x = running sum of (width + `gapX`); tier caption width = its column width. Collection mode only — Tier mode keeps the fixed `GROUP_WIDTH` step.
11. **Tier captions once, above the first visible row** (y = first row top − `TIER_LABEL_HEIGHT − TIER_LABEL_GAP_Y`).
12. **Row label in a left gutter**, one per visible row, top-aligned with the row (row headers + column headers = a matrix).
    Constants `ROW_LABEL_WIDTH` (≈160), `ROW_LABEL_GAP_X` (≈40); label x = −(`ROW_LABEL_WIDTH` + `ROW_LABEL_GAP_X`).
    Reuse `TierLabelNode`: optional `kind: 'collection'` variant (name only, ellipsis), same classes and `border-b`; the tier variant renders exactly as today.
    Name resolved at render time from `collectionNameById` (renames update it).
    Same inert node rules as tier captions; id namespace `row-label:<collectionId>`; `isTierLabelNodeId` also accepts that prefix so the drag save, undo snapshot, unit folding and `isCardHidden` keep ignoring labels.
13. **Row gap = `2 * gapY`**, no new setting. `gapX` = column gap, `gapY` = card gap in a column and scales the row gap.
14. **Hidden units at a Collection-mode Arrange are parked below the last visible row**, laid out by the same row function (per collection, no labels). Tier mode keeps today's spare column on the right.
15. **Collection-row focus includes the row label**: sidebar collection click and quick-search collection jump add the visible `row-label:<collectionId>` node to the fit (`nodeIds`, never `cardKeys`). Group clicks unchanged; nothing changes in Tier mode (no row labels exist).

Collection mode details:

16. Default layout in Collection mode is filter-aware (`cardVisibilityFilters`: collections, types, groups, selection force-show) so hidden collections collapse their row and a group filter shrinks only its own row — but NOT hide-unused-aware (Hide unused never moves cards; only its temporary arrange does, as today).
17. Ordering inside a column is position-independent (title, then barycenter sweeps against the adjacent column of the SAME row), so Collection-mode Arrange on a fresh graph equals the Collection default layout. `arrangeGroupsByConnectedBlocks` is not touched.
18. Managed chains (source → shader → shades) go in their source's collection row, at the top of that row, across lanes 0/1/2; `reserveGeneratorLane` is global so columns stay aligned.
19. External/library cards and the selection card stay outside the rows, right of the widest row (`maxRight` from the row layout in Collection mode; unchanged in Tier mode).
20. Default layout uses the saved Grid Settings in Collection mode (gaps + mode); the layout effect waits for settings hydration as well as positions so it does not jump. Tier default layout keeps its constants (untouched).

Labels:

21. Tier mode keeps `graph-tier-labels` exactly as today.
    Collection mode persists `graph-layout-labels` = `{ tiers: TierPlacement[] (with y), rows: RowPlacement[] }`, `RowPlacement = { collectionId, x, y, width, height }`; `TierPlacement` gets an optional `y` (absent → today's `TIER_LABEL_Y`, so Tier captions render unchanged).
    An Arrange in either mode writes its own key and clears the other, so only the labels matching the saved positions show.
    Shown labels, in order: temporary hide-unused arrange → persisted record → in Collection mode with no record, derived live from the natural row layout (Tier mode with no record: none, as today).
    A drag save that freezes a live-derived Collection layout (a drag saves ALL top-level positions) also persists the labels shown at that moment.
    Row labels whose collection no longer exists are hidden (plugin undo/redo recreates every collection id).
22. Row label hidden when no visible top-level node of its collection exists; tier caption hiding gets y extents in Collection mode (geometry-only x test kept for Tier mode).

## Known bug: Arrange with a filter on → Undo → clear filter → frames overlap ~24px (both modes)

Where: `handleArrangeGrid` snapshot (`GroupedGraph.tsx` ~2230-2241) and `handleUndoArrange` (~2267-2296).

Hypothesis (confirm by reproducing first, per the E2E rule):
The snapshot copies EVERY live top-level node position, including units that had no saved position and were placed by the natural packing.
Under the filter, frames are sized from visible cards only (`buildWrapperLayout` `hiddenCardKeys`) and the natural packing stacked them by that shrunken height.
Undo writes the whole snapshot to `savedPositions`, so those filter-dependent natural positions become saved and stop re-flowing.
Clearing the filter grows the frames back while their positions stay frozen → each frame overlaps the next one in its column.

The Collection layout does not fix this by itself; the snapshot must change, in both modes:
- Snapshot = a copy of the saved record before the arrange (`savedPositionsRef.current`, after flushing a pending drag save the way the hide-unused branch already does), plus the label records before the arrange.
- Undo writes them back verbatim (possibly `{}`), so units that were natural stay natural and re-flow on the filter change.
- Pure helper (functions in `hideUnused.ts` or a small `arrangeUndo.ts` next to it) so the bug gets a unit test.

Related, NOT fixed here: Arrange with a filter on, then lifting the filter WITHOUT Undo, also grows partly-filtered frames into the next unit (positions saved under a filter). Recommendation: accept; the user re-Arranges. Reserving full frame height would bring back the gaps the "frames from visible cards" fix removed.

## Open questions

None blocking — recommendations 1-7 are accepted, rec 8 superseded (Tier layout stays, its plan stays).
Confirm Decision 8: switch takes effect on Apply (with Undo), not on the next manual Arrange.

## Files to change

- `src/ui/components/Relationships/GroupedGraph/rowLayout.ts` (NEW, pure): `layoutCollectionRows(units, connections, opts)` → `{ positions, tiers, rows, parked }`. Own copy of the full-graph depth walk (or a small `computeDepths` extracted from `arrangeGroupsByConnectedBlocks` with zero behaviour change — implementer's call, Tier tests must stay green).
- `src/ui/components/Relationships/GroupedGraph/wrapperLayout.ts`: optional `naturalPositions?: Map<unitId, {x,y}>` argument; when present it replaces `naturalPos` + `columnBottoms`; when absent (Tier mode) the code path is byte-for-byte today's. Export the frame sizing so the row layout uses exact frame sizes.
- `src/ui/components/Relationships/GroupedGraph/utils.ts`: `normalizeGridLayoutSettings` / `toGridLayoutDraft` carry `sortBy`; `isTierLabelNodeId` also matches `row-label:`; `buildArrangeUnits` additionally returns `widthOverrides` (additive). `arrangeGroupsByConnectedBlocks` unchanged.
- `src/ui/components/Relationships/GroupedGraph/types.ts`: `GridLayoutSettings.sortBy`, `GridLayoutDraft.sortBy`, `TierPlacement.y?`, `RowPlacement`, label node data `kind?`.
- `src/ui/components/Relationships/GroupedGraph/constants.ts`: `ROW_LABEL_NODE_PREFIX`, `ROW_LABEL_WIDTH`, `ROW_LABEL_GAP_X`, `ROW_GAP_MULTIPLIER = 2`.
- `src/ui/components/Relationships/GroupedGraph/TierLabelNode.tsx`: `kind: 'collection'` variant.
- `src/ui/components/Relationships/GroupedGraph/hideUnused.ts`: row-label hiding rule; y-aware caption hiding for Collection mode; `HidingLayout` carries row labels too; undo snapshot helper (if not its own file).
- `src/ui/components/Relationships/GroupedGraph/sidebarFocus.ts`: collection scope adds the visible row label.
- `src/ui/components/Relationships/GroupedGraph.tsx`:
  - Grid Settings dropdown: "Sort by" `SegmentedControl` bound to the draft.
  - `naturalRowLayout` memo, Collection mode only (deps: `groupsData`, `connectionData`, `groupedPaths`, `cardVisibilityFilters`, `gridLayoutSettings`, `collections` order — never node positions, per `plans/graph-drag-perf.md`).
  - Layout effect: in Collection mode, managed groups and `buildWrapperLayout` take natural positions from it, row label nodes are added, `maxRight` from it; Tier mode unchanged.
  - `handleArrangeGrid`: branch on `settings.sortBy` (the override passed by Apply wins); Tier branch = today's code; Collection branch = `layoutCollectionRows` + parking below rows + `graph-layout-labels`. Both branches use the new undo snapshot.
  - `handleUndoArrange`: restore saved record + both label records verbatim.
  - Drag save: freeze live-derived Collection labels.
  - Storage load: `graph-layout-labels` alongside `graph-tier-labels`.
- `specs/functions.md`, `specs/components.md`, `specs/structure.md`.

## Steps

Implementation notes:
- Known bug reproduced first, end to end: `tests/ui/components/Relationships/GroupedGraph.test.tsx` renders the whole graph with real xyflow, clicks Arrange Grid → Undo Arrange, lifts the filter; before the fix c2's frame sat at y=312 inside c1's frame (bottom 348). Passes now in both modes.
- Depth walk: own copy in `rowLayout.ts` (`arrangeGroupsByConnectedBlocks` untouched).
- Undo helper: `GroupedGraph/arrangeUndo.ts`; Undo no longer writes live positions into nodes, the revision bump re-lays out from the restored record.
- `remapConnectionsToUnits` extracted into utils.ts (Arrange + `naturalRowLayout` share it); Tier arrange behaviour unchanged.
- While hiding is active the `naturalRowLayout` filters are frozen at what they were before (hiding unchecks sidebar groups for real), so Hide unused never re-flows Collection mode.
- `arrangeTiers.test.ts`: the three `normalizeGridLayoutSettings`/`toGridLayoutDraft` `toEqual` expectations gained `sortBy: 'tier'` (unavoidable with the new field); no layout expectation changed.

Phase A — pure pieces (parallel)
- [x] A1 [parallel] `rowLayout.ts` + types/constants: Decisions 9-14, 17, 18. Tests T1.
- [x] A2 [parallel] `wrapperLayout.ts` `naturalPositions` input + exported frame sizing; `buildArrangeUnits` `widthOverrides`. Tests T2.
- [x] A3 [parallel] Undo snapshot/restore helper. Tests T3.
- [x] A4 [parallel] `TierLabelNode` collection variant; `hideUnused.ts` label rules; `sidebarFocus.ts` row label. Tests T4, T5, T6.
- [x] A5 [parallel] `sortBy` in settings types + `normalizeGridLayoutSettings`/`toGridLayoutDraft`. Tests T7.

Phase B — wiring in `GroupedGraph.tsx` (sequential, one agent, after A)
- [x] B1 Grid Settings "Sort by" control (draft only; Apply saves + arranges).
- [x] B2 Collection-mode default layout (`naturalRowLayout` memo, layout effect branch, settings-hydration gate).
- [x] B3 Arrange Grid mode branch, Collection parking, label persistence (both keys, clear the other).
- [x] B4 Undo Arrange on the A3 helper (both modes); flush pending drag save before snapshot.
- [x] B5 Drag save freezes live-derived Collection labels; sidebar/quick-search collection focus includes the row label.

Phase C — verification (separate agents, never the implementer)
- [ ] C1 Verifier: diff review (confirm the Tier path is unchanged: `arrangeGroupsByConnectedBlocks` untouched, `buildWrapperLayout` without `naturalPositions` untouched), `npm run build`, `npx vitest run` (existing Tier tests green with unchanged expectations), `tsc` count vs a baseline re-measured on this branch before starting (last recorded 251), lint if configured.
- [ ] C2 QA in the browser bridge with mock data (pixel-level): Tier mode identical to before (screenshot diff against the pre-change build); switch to Collection + Apply → rows in collection order, aligned columns, frames in their tier slot, labels clear cards; Undo → previous layout; filters collapse rows; group filter shrinks one row; Hide unused + temporary arrange + Show all in both modes; reload keeps mode, positions and labels; the known-bug repro in both modes (Arrange with a filter → Undo → clear filter → no overlap).
- [ ] C3 Manual Figma check (user): the real file in both modes, plus the open Tier check in `plans/arrange-tiers-and-wrapping.md`.
- [ ] C4 Spec updates (DONE: functions/components/structure); delete this plan once everything passes (keep `plans/arrange-tiers-and-wrapping.md`).

## Tests (under `tests/ui/components/Relationships/`, mirroring `src/ui/components/Relationships/GroupedGraph/`; `fireEvent`, not `userEvent`; plain matchers, no jest-dom)

- T1 `rowLayout.test.ts`: rows follow collection order; row top = previous top + tallest column + `2 * gapY`; same-tier cards stack in one column with `gapY`; tier columns align across rows; a cross-collection consumer sits one column right of its provider in another row; a collection with no visible unit gets no row/label/gap; a group filter shortens only its row; a frame occupies its tier slot and widens its column for every row; hiding `_global` keeps `color` in its tier (full-graph depth); a managed chain stays one line in its row across lanes 0/1/2; deterministic under shuffled input and different seed x/y; hidden units parked below the last visible row; one tier caption per surviving column above the first row, one row label per visible row in the gutter.
- T2 `wrapperMembership.test.ts` / `oneLevelFrames.test.tsx`: new cases only — `naturalPositions` wins over the old packing, saved positions win over both; no `naturalPositions` → identical to today (existing cases untouched).
- T3 `arrangeUndo.test.ts`: the known bug — filtered natural layout → snapshot → restore → lift filter → no frame overlap; plus a counter-test showing the old live-position snapshot overlaps.
- T4 `hideUnused.test.ts`: row label hidden when its collection has no visible top-level node or no longer exists; y-aware caption hiding in Collection mode; Tier captions unchanged.
- T5 `sidebarFocus.test.ts`: collection scope includes the visible row label in `nodeIds`, never in `cardKeys`; group scope unchanged.
- T6 `TierLabelNode.test.tsx`: collection variant renders the name, no qualifier; tier variant unchanged.
- T7 `gridLayoutSettings.test.ts`: `sortBy` missing/garbage → `'tier'`; round-trips through the draft; a Grid Settings render test switches the `SegmentedControl` with `fireEvent.click`, Cancel discards, Apply saves.
- Existing `arrangeTiers.test.ts`, `arrangeVisibility.test.ts`: no expectation changes (they are the Tier-mode regression guard).

## Spec updates

- `specs/functions.md` § Variable Relationships: Grid Settings "Sort by" (Tier default / Collection), what Collection mode looks like, switching on Apply with Undo, Hide unused never re-flows, undo restores the saved record (both modes).
- `specs/components.md` § GroupedGraph: Collection row layout + `rowLayout.ts`; `TierLabelNode` collection variant; fix the two stale Tier bullets (`TIER_GAP_MULTIPLIER`, wrapped sub-columns — already wrong today); § Common: add `SegmentedControl` (exists, undocumented).
- `specs/structure.md`: `GroupedGraph/rowLayout.ts` (and `arrangeUndo.ts` if separate).

## Risks

- Biggest diff is in `GroupedGraph.tsx` (2.5k lines): B1-B5 sequential, one agent.
- Tier regression: kept low by not touching `arrangeGroupsByConnectedBlocks` and keeping `buildWrapperLayout`'s old path when `naturalPositions` is absent; C1/C2 verify explicitly.
- Collection natural layout re-flows on filter changes for every UNSAVED unit; saved units do not, so a half-saved canvas can still overlap after a filter change (pre-existing class).
- A drag saves every top-level position (existing behaviour), freezing the natural layout of the moment — same root as the undo bug; not changed here.
- Switching modes on a canvas with saved positions only shows the new mode after Apply (which arranges); the default layout alone would not move saved cards.
- Collection mode is taller (N collections × tallest column); first fit zooms out further.
- Performance: `naturalRowLayout` must not depend on node positions (drag-perf regression).
- Barycenter limited to same-row neighbours may leave more crossings on cross-row wires; check on the real file in C3.
