# Relationships graph: drag lag on large token files

## Symptom

Dragging a node in the Relationships tab is slow and stutters.
Reproduced by the user on a large real Figma file.

## Real-world size (read live from the user's "Core" file via figma-console, 2026-09-26)

678 variables across 5 collections: `_global` 116, `color` 118 (light/dark), `typography` 51, `components` 342, `dimensions` 51.
443 COLOR, 222 FLOAT, 13 STRING.
The synthetic repro must match this shape, not a smaller invented one.

## Cause (read from source, not yet measured)

Two compounding problems. Neither is React Flow itself.

**1. No custom node or edge component is memoized.**

`GroupNodeComponent`, `PropertyNodeComponent`, `GroupWrapperComponent` and `CustomEdge` are plain functions.
React Flow re-renders every custom node on every store update.
A drag emits position changes at roughly 60/s, so every card in the graph re-renders every frame.

**2. Node and edge `data` objects are rebuilt fresh on every pass of the layout effect.**

The effect ending at `GroupedGraph.tsx:1240` calls `setNodes(newNodes)` / `setEdges(newEdges)` with entirely new objects.
React Flow memoizes its node wrapper on `data` identity, so a new object defeats it even when every field is `===`.
Edge data also carries an inline closure (`onDisconnect`, line 1223), new identity each pass.

Problem 2 defeats the fix for problem 1: adding `memo` while props change identity every rebuild skips nothing.
They must land together.

**3. `savedPositions` is a dependency of that effect (line 1235) and is written by the 300ms debounce after a drag.**

So every drag-end rebuilds every node and edge in the graph, and the rebuild re-reads positions from `savedPositions`.
This is directly on the drag path.

**4. `updateNodeInternals` runs on `[nodes]` (line 1246), scheduling a handle re-measure for every node id on every rebuild.**

## Correction to an earlier assumption

An earlier draft of this plan claimed hovering rebuilds the graph, because `highlightedGroupKey` / `highlightedVarName` are deps of the layout effect.
That was wrong.
Highlight is click-driven only (`highlightTarget`, line 161); there is no hover handler and row hover is pure CSS.
Highlight still causes a full rebuild, but on click, not on mouse move.
It is therefore a click-latency problem, not the drag-lag cause — keep it in scope, but do not expect it to explain the reported stutter.

## Steps

- [x] Baseline measurement. Synthetic large token set on the vite dev server, React Profiler render counts during a drag, frame timing. Record numbers here.
- [x] `memo` on `GroupNodeComponent`, `PropertyNodeComponent`, `GroupWrapperComponent`, `CustomEdge`.
- [x] Take `savedPositions` off the layout effect's dependency list (line 1235) so a drag-end no longer rebuilds every node and edge.
      Positions are already applied per node; the debounce should persist them without triggering a full rebuild.
- [x] Narrow the `updateNodeInternals` effect (line 1246) so it no longer re-measures every node id whenever the `nodes` array identity changes.
- [ ] Stabilize node data identity.
      Extract the highlight derivation at lines 872-922 into its own `useMemo` keyed on `[highlightTarget, connectionData, groupsData, variableMap]`.
      Move the five highlight fields out of node data; nodes subscribe to a per-node slice.
      A React Flow `useStore` selector cannot see `connectionData` / `groupsData` / `variableMap`, so use a small context mounted inside `ReactFlowProvider`, around the `<ReactFlow>` element.
      The slice must be per-node and compared with a custom equality fn, or every node re-renders anyway and the cost has only moved.
- [x] Hoist inline closures out of node/edge data (`onDisconnect`, line 1225) so their identity is stable.
- [x] `useMemo` the `value` objects in `FilterContext`, `DataContext`, `SelectionContext`, `UIStateContext` so unrelated app state stops re-rendering `GroupedGraphInner`.
- [ ] Re-measure against the baseline. Only if still short of target: revisit `MiniMap pannable zoomable` (`GroupedGraph.tsx:1669`), which repaints per frame.
- [x] `npm run build`, `npm test`, `tsc` error count not above baseline. Verified in the main checkout: build OK, 114/114 tests, tsc exactly 251.
- [ ] Manual in Figma on the user's large file: drag is smooth, highlight on click still works, edges still connect and unbind, saved positions survive a reload, Arrange Grid and its undo still re-layout.
      The edge-unbind path (`GraphEdge` -> `onUnbindProperty`) and Arrange/Undo are NOT covered by the test suite and were changed — check those specifically.

## Constraints

- Behavior must not change. Highlight on hover, saved positions, binding and unbinding all keep working.
- Position saving is already debounced 300ms (`handleNodesChangeWrapped`, line 1257) — not a suspect, leave it.
- No new dependency. This is a render-identity fix, not a library swap.

## Risks

- Moving highlight out of node data touches every component that reads it. Regression risk is on the highlight feature, so that gets manual checking.
      Consumers: `GraphNode.tsx:31-35,54,58,141-147` (opacity + ring classes only) and `GraphEdge.tsx:28-35` (stroke + opacity only).
      `PropertyNode`, `GraphWrapperNode` and `GraphHandle` read no highlight fields.
- `SidebarFilter` reads `highlightedGroupKey` as a plain prop (`GroupedGraph.tsx:1629`, used at `SidebarFilter.tsx:99`).
      If highlight moves into a store and `GroupedGraphInner` stops re-rendering on highlight change, the sidebar silently stops showing the highlighted group.
      The key string form `group:${node.path}` (`SidebarFilter.tsx:98`) must be preserved.
- Memoizing `PropertyNodeComponent` interacts with the session state added for component layers (revealed rows, collapsed sections) and its `updateNodeInternals` effect. Verify reveal/collapse still repaint.
      That local state survives only because `getSelectionNodeId` keeps the node id stable (`GroupedGraph.tsx:98`). The refactor must not change node keys.
- **Do not reorder `newNodes`.** There is no `zIndex` anywhere; React Flow stacks in array order, and nested nodes must appear after their `parentId` wrapper (`GroupedGraph.tsx:1052-1074`).
      Raising a highlighted card by sorting it to the end would break nested positioning and reintroduce a full rebuild.
- Once rebuilds stop, the `[nodes]` `updateNodeInternals` effect fires far less often. It may currently be masking handle-geometry bugs.
      Check `AnchoredHandles` (`PropertyNode.tsx:186-212`) and the shader-row output handle (`GraphNode.tsx:136`).
- `handleHighlightFromSidebar` calls `requestAnimationFrame(fitView)` inside a state updater (`GroupedGraph.tsx:505-519`). If highlight moves to an external store, that side effect has to move into an effect.

## Measured baseline (678-variable mock, 153 nodes / 549 edges, dev build)

| metric | before |
|---|---|
| mean frame during drag | 38.4 ms |
| median frame | 28.7 ms |
| p95 / worst frame | 70.6 ms / 77.4 ms |
| effective FPS | 26.0 |
| component renders per frame | mean 70, median 16, max 168 |
| main-thread busy | 78 % |
| single full rebuild (highlight click) | 1161 renders, ~480 ms |
| `updateNodeInternals` in isolation | 153 renders, 50-62 ms |
| hover | 0 renders, 0 ms |

The two dominant causes, both isolated by controlled test, were NOT the two originally suspected:

1. `updateNodeInternals(nodes.map(n => n.id))` inside a `requestAnimationFrame` on `[nodes]`, re-measuring all 153 nodes every drag frame.
   Proof: pacing drag steps with a macrotask loop (which starves rAF) made the 153-render commits vanish entirely, leaving 16 renders / ~18 ms per step.
2. The 300 ms position-save debounce writing `savedPositions`, which was a dependency of the rebuild effect.
   Controlled test: moves 50 ms apart (debounce never fires) cost 13-26 renders; moves 400 ms apart cost 856 renders and ~360 ms each.
   Once frames exceed 300 ms the debounce fires between every frame and every frame becomes a full rebuild — self-reinforcing, which is why a large file falls off a cliff rather than degrading smoothly.

Missing `React.memo` is the multiplier, not the trigger: it sets the cost of each commit (153 or 1161 renders instead of 1), while the two triggers set the number of commits.

## Measured after (same mock, same harness, same method)

| metric | before | after |
|---|---|---|
| mean frame during drag | 38.4 ms | **18.1 ms** |
| median frame | 28.7 ms | 16.1 ms |
| p95 / worst frame | 70.6 / 77.4 ms | 29.9 / 32.7 ms |
| effective FPS | 26.0 | **55.2** |
| frames over 33 ms | 12 / 30 | **0 / 32** |
| renders per frame | mean 70, max 168 | **mean 4.3, max 14** |
| main-thread busy | 78 % | **0 %** (nothing reached the 50 ms longtask threshold) |
| single full rebuild (highlight click) | 1161 renders, ~480 ms | 855 renders, ~305 ms |

The per-frame render pattern changed from `1, 1, 16, 153, 168, 16, 168, ...` to a flat `1, 0, 7, 7, 0, 7, 7, 0` — one node plus its six connected edges, which is what a correct implementation should cost.
No 153-render commit was observed in any after-measurement, so the `updateNodeInternals` trigger no longer fires during drag, highlight or filter changes.

Degraded regime is gone. The paced-drag control at 400 ms spacing, which previously collapsed to 856 renders and ~360 ms per move, is now byte-identical to 50 ms spacing at 7 renders and 0 ms.
A deliberate 24-frame drag at ~1000 ms frame intervals — the exact condition that produced the baseline collapse — held flat at 7 renders per frame.

## Remaining headroom (measured, not speculative)

`React.memo` skipped **zero** edge renders: 549 before, 549 after. Node renders only halved (612 to 306), rather than dropping to near zero.

Cause: the layout effect still builds a fresh `data: { ... }` object literal for every node and edge on each rebuild, so memo's shallow compare fails on `data` every time.
Memo is currently removing duplicate renders *within* a commit, not removing renders of unchanged elements.

Consequence: a highlight click still blocks the main thread for ~305 ms — better than 480 ms, still a perceptible hitch.

The next lever is NOT more `memo` calls. It is either memoizing the per-node and per-edge `data` objects, or giving `memo` a custom comparator that compares the fields that actually drive rendering instead of `data` identity.

## Still open
- The highlight refactor remains deferred, and the after-numbers narrow what it should be.
      `memo` alone cut a click from ~480 ms to ~305 ms, which is not enough to stop it feeling like a hitch.
      Stabilizing the per-node/per-edge `data` identity is the higher-value change and is a prerequisite for the highlight work paying off.
- MiniMap's React render share is unmeasured. Its layout/paint share is on the order of 10-20 % of a rebuild (n small, samples overlap).

## Reusable harness

`<scratchpad>/mock-678-browser.js` (paste into the page console, re-inject with `window.__mock678()`), then Relationships tab + "Select All" under Collections.
`<scratchpad>/measure-harness.js` installs the render counters and longtask observer and exposes `__dragFrames()`, `__measureAction()`, `__pacedDrag()`.
Gotchas recorded in both files: React Flow drags via d3-drag (mouse events, not PointerEvents), cards drag only by `.group-header`, and the preview pane throttles rAF to ~1-2 fps when idle (a screenshot buys ~8 s of real 60 fps).
