# Changelog

All notable changes to Winden Tokens are documented in this file.

## 2026-08-29

### Relationships graph

#### Added

- Row-level path highlighting: clicking a variable row highlights only that variable's connected chain (upstream and downstream), instead of every connection in the group.
  Clicking the card header or sidebar still highlights the whole group.
  The selected row gets a pink marker; its group siblings and their edges render in faded pink, so selection and group membership stay visually distinct.
- Canvas quality-of-life: snap-to-grid (8px), marquee multi-select (pan via middle/right drag or scroll), dotted background, minimap, and zoom controls.
- "Undo Arrange" button restores the layout from before the last Arrange, and the view animates to fit after arranging.

#### Fixed

- Arrange is deterministic — pressing it twice gives the same layout — and orders each column by connected neighbors (barycenter sweeps) to reduce edge crossings.
- Arrange moves wrapper frames as single units instead of scattering the cards inside them.
- Dragging a card inside a wrapper frame sticks instead of snapping back on the next redraw.

### Mode switching

#### Changed

- Replaced the flat mode dropdown (every mode of every collection in one list) with a two-level tag picker: collection tags on top, that collection's mode tags beneath a labeled subgroup.
  The mode a collection actually displays is always marked solid — the misleading "All Modes" default is gone.
  Collections with a single mode show no mode row.
  Picking a mode still cascades to same-named modes in other collections.

### Variables

#### Fixed

- Moving a variable or group to another collection no longer breaks references: all mode values are copied (modes matched by name, then position), aliases across the document are rewired to the new variable, and canvas bindings (fills, strokes, effects, node fields) are re-bound.
  Previously the move deleted the original first — dangling every reference — and kept only the first mode's value.

### JSON tab

#### Changed

- JSON is presented as a nested tree (collections → groups → tokens, DTCG-style `$type`/`$value`/`$id`) instead of flat internal arrays.
  Editing still round-trips: value changes, renames by moving a leaf, and subtree deletions all apply.
  Legacy flat JSON pastes still work.
- Editor replaced with CodeMirror: fold arrows in the gutter collapse and expand any collection or group block, with line numbers and proper JSON highlighting.

#### Fixed

- Edits are debounced before syncing, so momentarily-valid JSON typed mid-edit can no longer transiently delete variables.
