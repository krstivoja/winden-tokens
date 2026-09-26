# Arrange: keep tiers when filtering, and wrap over-tall columns

## Problem

Two separate faults in `arrangeGroupsByConnectedBlocks` (`src/ui/components/Relationships/GroupedGraph/utils.ts`), both visible on the user's 678-variable file.

**1. Tiers collapse when cards are filtered out.**

Column X comes from topological depth: `x = lane * columnStep`, lane derived from `groupDepth` (Kahn's algorithm, longest path).
That is already "how many levels it is connected" — but the depth is computed over the *filtered* connection set.
`handleArrangeGrid` drops any connection with a hidden endpoint before calling the layout:

```ts
if (hiddenByKey.get(conn.fromGroup) || hiddenByKey.get(conn.toGroup)) return acc;
```

So hiding the `_global` collection removes every edge out of the primitives, `color/surface/*` loses its incoming edges, becomes depth 0, and slides into column 1.
The whole graph flattens leftward into two very long columns.

This was introduced by the previous fix (commit "Arrange Grid now skips cards hidden by the filters"), which dropped those edges so hidden cards could not shape the packing.
Correct for packing, wrong for tiers.

**2. Nothing limits column height.**

A tier holding ~60 cards becomes a column roughly 20,000px tall.
Even with correct tiers the result is a ribbon, not something you can look at.

## Decisions

- **Depth is computed over the FULL connection graph** — every group, hidden ones included — so a token keeps the tier it actually occupies.
- **Layout places only visible cards.** A lane left with no visible cards collapses: lanes renumber contiguously, preserving relative order, so no horizontal gap returns.
- **An over-tall lane splits into side-by-side sub-columns within the same tier.** Tiers stay ordered left to right; a tier simply becomes wider.
- **Max column height is a Grid Setting**, next to the existing gap X/Y. Default 2400px.
- **Ordering is computed before splitting.** The barycenter sweeps that reduce edge crossings must run on the full tier order; the split then takes that order in chunks, so crossing reduction is preserved.
- **Managed chains are never split.** `source → shader → shades` are laid out as horizontal rows and must stay intact in one sub-column.

## Steps

- [x] Compute `groupDepth` from the unfiltered connection set. `handleArrangeGrid` keeps dropping hidden-endpoint edges for packing, but must pass the full set for depth — decide the cleanest signature rather than threading a second list everywhere if that gets ugly.
      Done via a trailing `ArrangeGridOptions` bag: `arrangeGroupsByConnectedBlocks(groups, connections, gapX, gapY, { heightOverrides, depthConnections, maxColumnHeight })`.
- [x] Collapse empty lanes after depth assignment, preserving order.
- [x] Split a lane whose stacked height exceeds the max into sub-columns, after the barycenter sweeps, chunking the existing order.
- [x] Shift later tiers right by the extra width a split tier consumes.
- [x] Add max column height to Grid Settings and to the persisted settings shape (`GRID_MAX_COLUMN_HEIGHT = 2400`).
- [x] Keep managed chains whole — chain rows are placed before the wrapping pass and take no part in it.

## Constraints

- Do not reorder the `newNodes` array. React Flow stacks in array order and nested nodes must follow their `parentId` wrapper.
- Do not regress the drag-performance work: `savedPositions` stays behind its ref, out of the layout effect's deps.
- Hidden cards keep their parked saved positions (see the previous commit) — that behaviour stays.
- Reuse existing components for the new setting. No new dependencies.

## Verify

- [x] `npm run build` clean, `npx vitest run` 198 passing (183 + 15 new), `tsc` exactly 251.
- [x] Unit tests in `tests/ui/components/Relationships/arrangeTiers.test.ts`.
- [ ] NOT DONE (cannot run Figma from here) — manual in Figma on the real file: all collections selected, arrange — sensible tiers.
      Then deselect `_global`, arrange — `color/surface` stays in its tier relative to `button/color`, and no column runs off the screen.
