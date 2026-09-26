# Arrange: one column per tier

## Where this landed

Column X comes from topological depth over the **full** connection graph — hidden cards included — so filtering a collection out never changes which tier a token sits in.
Packing runs over the visible cards only; a lane with nothing visible collapses and the rest renumber contiguously, so no horizontal void appears.

One lane == one tier == one column. Columns step uniformly by `GROUP_WIDTH + gapX`.
A "Tier N" caption sits above each column, one card wide.

The max-column-height cap and its sub-column wrapping were built and then removed.
They were a reaction to the graph collapsing into two long columns, but that collapse came from computing depth over the filtered edge set.
Once that was fixed the cap only cost: a column stopped meaning a tier, which is why it needed captions and a 3x tier gap to stay readable, and a 29-card palette still read as four dependency levels.

## Done

- [x] Depth from the unfiltered connection set (`ArrangeGridOptions.depthConnections`).
- [x] Empty lanes collapse, preserving order.
- [x] Barycenter sweeps for crossing reduction, per lane.
- [x] Managed chains placed whole, as horizontal rows across their fixed lanes.
- [x] Hidden cards parked in a spare column, with their saved positions kept.
- [x] Tier captions, inert and non-draggable.
- [x] Cap, `TIER_GAP_MULTIPLIER`, `TierPlacement.columns`, the Grid Setting and its persisted field removed; old persisted records load without throwing.
- [x] `npm run build` clean, `npx vitest run` 200 passing, `tsc` exactly 251 (identical error set to baseline).

## Left

- [ ] NOT DONE (cannot run Figma from here) — manual check on the real file:
      all collections selected, Arrange — `color/*` shares one column, `button/*` one step right.
      Then deselect `_global`, Arrange — tiers keep their relative order and no gap opens where `_global` was.
      Captions sit over the right columns and clear the tallest card.
