# Click a collection name to find it in the graph

## Problem

The sidebar can already find a **group**: clicking its name runs `fitView` on that card (`handleHighlightFromSidebar`, GroupedGraph.tsx).
Collection rows have no equivalent, so a collection's cards can only be found by panning the canvas by eye — which on a 678-variable file means hunting.

## Decision

Extend the existing affordance rather than add a control: the collection name becomes clickable exactly like a group name, and zooms to every card that collection owns.

- No highlight. `highlightTarget` addresses a single group key; a collection is a set of cards and does not fit that state. Zoom only.
- Only cards that are actually on screen are targeted. Filtered-out cards are rendered with `hidden: true`, and zooming to something invisible would move the canvas to nothing.
- Nothing happens when a collection has no visible card — silent, because the collection's own checkbox is right there and explains why.
- `TableView` passes no handler, so the name keeps toggling the checkbox there. The behaviour changes only in the graph, where the group rows already work this way.

## Steps

- [x] `SidebarFilter`: optional `onZoomToCollection?: (collectionId: string) => void`. When present, the collection name is a clickable span (`preventDefault` so the surrounding `<label>` does not toggle the checkbox).
- [x] `GroupedGraph`: `handleZoomToCollection` — reads live nodes off the React Flow instance, keeps `groupNode`s whose `data.group.collectionId` matches and are not hidden, and calls `fitView` on them.
- [x] Read nodes from `reactFlowInstance.getNodes()` rather than the `nodes` state, so the callback identity stays stable and the drag-performance work is not regressed.

## Verify

- [x] `npm run build`, `npx vitest run`, `tsc` at baseline 251.
- [x] Verified live against the real open file through the dev bridge (678 variables, 164 nodes, 6 collections):
      clicking `marko` moved the viewport from `translate(50px, 50px)` to `translate(-600px, -9945px)` and put `group:test` in the middle of the canvas, with the checkbox still checked.
      Clicking `_global` fit its cards at scale 0.2, 54 nodes on screen.
      With `typography` deselected, clicking its name left the transform byte-identical.
- [ ] NOT verified: the Table tab, whose tab bar the browser client hides. It passes no handler, so the name has no `onClick` and the `<label>` toggles as before — read from the code, not seen.
