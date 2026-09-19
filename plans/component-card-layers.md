# Component card: bound/valued rows, "Add property", child layer groups

## Goal

When the selected Figma node is a component (`COMPONENT`, `COMPONENT_SET`, `INSTANCE`), the Relationships selection card changes:

- Shows rows that are bound to a token/style or already hold a real value; default/empty values are hidden.
- Each layer offers "+ Add property" to reveal one of its hidden bindable properties, so a token can be dragged onto it.
- Child layers (all descendants, hidden layers skipped) appear as nested, collapsible groups inside the same card.
  Example: frame with text inside → frame group + text group, tokens bindable on both.

Non-component selections keep today's card unchanged (full row list, no children).

## Decisions (confirmed)

- Default rows: bound (`kind === 'variable' | 'style'`) OR value set (`isDefault !== true`).
  Default = opacity 1, other numeric scalars 0, line height AUTO, stroke weight when node has no visible strokes.
  Paints, effects, font family/style/size are never default (only visible ones are listed anyway).
- Scope: component types only.
- Depth: all descendants, indented, each group collapsible.
- Added rows: session only — reset when selection changes.
  Unbinding a row keeps it visible for the session (no row vanishing under the cursor).

## Plugin side — `src/plugin/code.ts`

- [x] Add `children?: InspectorNodeData[]` to `InspectorNodeData` (plugin copy + `src/ui/types.ts`).
- [x] In `getNodeInspectorData`, for component types, recurse into `children` (skip `visible === false`).
  Cap total layers (e.g. 300) and set `truncated: true` on the root when hit, so huge components stay fast.
- [x] Add `isDefault?: boolean` to `InspectorEntry` (both copies), set by the scalar builder per rules above.
- [x] Recursion reuses existing entry builders; each child carries its own `id`, `name`, `type`, `entries`.
- [x] `bindNodeProperty` unchanged — it already takes a `nodeId`, which works for instance sublayers (`I…;…` ids).

## UI — pure helper (new file, testable)

`src/ui/components/Relationships/GroupedGraph/propertyLayers.ts`

- [x] `flattenLayers(node)` → `Array<{ layerIndex, depth, id, name, type, entries }>` in tree order.
- [x] `isComponentType(type)`.
- [x] `getVisibleEntryIndexes(layer, isComponent, revealedKeys)` → bound rows + non-default rows + revealed rows (all rows when not a component).
- [x] `entryKey(layerId, entry)` → stable key from `bindingTarget` (+ property label for style rows).
- [x] `getPropertyCardHeight(layers, visibility, collapsed)` moves here, counting layer headers + visible rows.

## UI — `PropertyNode.tsx`

- [x] Render one section per flattened layer: header row (indent by depth, collapse chevron, name, type) then visible rows.
  Root layer keeps the existing purple card header; child section headers are lighter.
- [x] "+ Add property" per section using existing `Dropdown` + `TextButton`/icon `plus`; menu lists hidden bindable entries (`category · property`), picking one reveals it.
  No menu when nothing hidden remains.
- [x] Collapse chevron uses existing `collapse`/`expand` icons.
- [x] Handle ids change to `prop:<layerIndex>:<entryIndex>::in` (flat index avoids `:`/`;` in Figma ids).
- [x] Revealed/collapsed state: `useState` inside `PropertyNode`, keyed by selection id so it resets per selection (card already remounts per selection via `getSelectionNodeId`).
  Unbind edge callback reveals the row it unbinds (passed down via node data callback).

## UI — `GroupedGraph.tsx`

- [x] Every place iterating `selectedNode.entries` iterates flattened layers instead: external-token cards, prop edges, `handleConnect`, `handleFocusSelection`.
- [x] Edge id `prop-edge:<layerIndex>:<entryIndex>`, target handle as above.
- [x] `handleConnect` parses both indexes and posts `bind-node-property` with the layer's `id`, not the root id.
- [x] Edges to rows inside a collapsed group attach to the group header (or are hidden) — decide during impl, pick whichever renders cleanly.

## Tests

- [x] `tests/ui/components/Relationships/propertyLayers.test.ts` — flatten order/depth, bound/value visibility, reveal, non-component passthrough, height calc.
  (Repo currently colocates tests; this follows the root `tests/` rule. Say if you'd rather colocate.)

## Verify

- [x] `npm run build`, `npm test`, `tsc` error count not above baseline (251, all pre-existing).
- [x] Browser preview with injected selection: groups, default-hiding, Add property, collapse anchoring, both-theme render.
- [ ] Manual in Figma: select component with frame + text → both groups shown with only bound/valued rows; add Fill on text, drag token, binding lands on the text layer; unbind keeps row; reselect resets.

## New UI pieces needing approval

- Layer section header + "Add property" dropdown live inside `PropertyNode.tsx` (no new component file), built from existing `Dropdown`, `TextButton`, `Icon`.

## Resolved

- Collapsed section: bound rows' target handles stack on the section header, edges stay drawn.
- Layer cap: 300; card shows a note when truncated.
