# Plugin Functions

**What the plugin does and how it works**

---

## Overview

**Winden Tokens** is a Figma plugin for managing design tokens (variables) with a spreadsheet-style interface.

**Core capability:** CRUD operations on Figma variables with bulk editing support.

---

## Key Features

### 1. Spreadsheet Table View

**Purpose:** Edit variables like a spreadsheet

**Features:**
- Inline editing (click cell to edit)
- Grouped by collection
- Expandable/collapsible groups
- Bulk selection and operations
- Search and filtering
- Mode switching per collection

**Use case:** Quickly edit variable names, values, descriptions

---

### 2. JSON Bulk Editor

**Purpose:** Edit all variables as JSON

**Features:**
- Syntax validation
- Import from JSON
- Export to JSON
- Bulk updates

**Format:**
```json
{
  "collections": {
    "Colors": {
      "primary": {
        "type": "COLOR",
        "value": "#FF0000",
        "description": "Primary brand color"
      }
    }
  }
}
```

**Use case:** Import design tokens from external systems

---

### 3. Variable Creation

**Create individual variables:**
- Name
- Type (COLOR, FLOAT, STRING, BOOLEAN)
- Value
- Collection
- Description

**Bulk creation:**
- CSV import
- JSON import
- Color scale generation

---

### 4. Color Tools

**Color Picker:**
- Saturation/brightness area and hue slider
- HEX/RGB/HSL inputs
- Opens at the variable's resolved color (aliases followed)
- Resets on every open; Cancel discards edits

**Color Scales:**
- Generate 50-900 scales
- Custom step count
- Lightness distribution

**Color Shades:**
- Monochromatic palette generation
- Tint/shade variants

**Contrast Checker:**
- WCAG contrast ratios
- AA/AAA indicators
- Foreground/background testing

---

### 5. Variable Relationships

**Dependency Graph:**
- Visualize variable aliases
- Show reference chains
- Detect circular dependencies
- Sidebar Collections tree is click-to-select (no checkboxes), at every level (All variables, collection, folder such as `badge` or `badge > color`, group): a plain click or Enter/Space on a collection hides nothing (it clears any group narrowing, rings the row and pans the graph / scrolls the table to it), on a group or folder it shows only that group (and subgroups) within its own collection while all other collections stay fully visible; Cmd/Ctrl-click on a collection only toggles its ring mark, on a group it toggles it in the selection: a selected group (ringed, or under a ringed folder) leaves, anything else joins (the last picked row stays). Cmd/Ctrl-click on a child of a ringed folder takes the child out and moves the folder's ring to what is still shown (the other children, and the folder row itself, with a dashed ring, for variables it holds directly; Cmd/Ctrl-click on that dashed row takes those out too); a ring Hide unused hides for now still counts, so a Cmd/Ctrl-clicked group joins that collection instead of narrowing it, and the ring returns after Show all. Ringing a folder takes over the rings under it (no rings inside rings). "All variables" selects everything and clears every ring
- In the graph a plain click then highlights every visible card under that row, fits the view to them, and rings the row once the new selection is laid out; it always focuses, never toggles (click the empty canvas to clear). Cmd/Ctrl-click does not move the camera. The Table view only selects
- Sidebar "Collapse all" / "Expand all" icon button right of the search box (like Figma's Layers panel): while any collection or folder is open it folds every collection and every folder, otherwise it opens them all; "All variables" stays as it is, marks and selection are untouched, and it is disabled while searching
- Exactly the rows the user clicked are ringed (primary fill and ring), each Cmd/Ctrl-clicked row too; their descendants get only the fill, merely visible rows nothing. A folder is never ringed for a click on its child, even when both cover the same variables (folder `action` holding only group `height`), and the other way round. "All variables" is ringed while everything is selected and no row is. The rings (marks, `FilterContext.sidebarMarks`) are kept apart from the selection, so they survive switching tabs; a ringed row whose variables are unchecked elsewhere (Hide unused) loses its ring until they come back (Show all), a group whose collection is shown in full again loses it, and rings of rows that no longer exist (deleted, plugin undo) are dropped. A row with nothing visible on the canvas has a muted label but still selects. Expand arrows never change the selection
- Table and graph (same helper): ungrouped (collection root) variables, and the root card holding them, show only while all groups of their collection are selected; other collections are never affected by a group click. Group keys Hide unused unchecked count as selected for this rule, so Hide unused never hides root cards by itself
- "Hide unused" toolbar toggle (not saved: off again after every reload): while a card or row is highlighted, hides every card, wire and tier caption not on its path and fits the view to what is left; filtered cards stay hidden
- Arrange Grid while Hide unused hides is temporary: it packs only the visible path, leaves the hidden cards where they are, and saves nothing (no positions, no card order, no tier captions, no change to the saved Undo Arrange step); in Collection mode it shows a temporary natural order (path order, not the saved one), and dragging cards while it is up reorders only that temporary order
- Undo Arrange drops a temporary arrange; one made by an Apply that switched "Sort by" also switches the mode back (saved) and gives back the saved Undo Arrange step of that mode, which the switch had set aside; hiding stays on. Ending the hiding for any reason ("Show all", card menu "Show all", clearing or moving the highlight, sidebar "All variables", selecting a collection that was off) drops it too, brings back the saved layout exactly as it was, and fits the view
- Sidebar "All variables" also clears the previous row's ring and canvas highlight; it, and selecting a collection that was off, turn Hide unused off; picking a group inside an already selected collection keeps it on
- Hide unused unchecks the off-path groups for real in the sidebar Collections tree (shared with the Table view, so their rows hide there too), at group level; a collection goes only when nothing of it is on the path
- The uncheck is one write per activation (toggle on with a highlight, card menu, or the highlight moving while on); re-ticking a group while hiding shows it again, and ending the hiding ("Show all", card menu "Show all", clearing the highlight) re-checks exactly what Hide unused unchecked and still holds, so the sidebar view from before comes back (a sidebar group selection narrows its own collection again, everything else visible); selecting a collection that was off (a plain click on the collection, or a plain or Cmd/Ctrl-click on one of its groups; Cmd/Ctrl-click on the collection row only toggles its ring mark) is the user's whole choice for that collection, so nothing of it is re-checked on top of it, while what Hide unused unchecked in the other collections comes back
- What Hide unused re-checks is limited to collections and group keys that still exist, so keys from before a plugin undo (which recreates every id) never reach the selection
- A later activation re-checks only groups Hide unused itself unchecked that are now on the path; groups the user unchecked are never re-checked
- What the tree cannot express stays hidden by Hide unused itself: library cards, a collection root card next to an on-path group, a card sharing its group with an on-path card; off-path wires stay hidden too
- Frames (`graph-grouped-paths`, keys `<collectionId>::<path>`) are ONE level: a frame holds cards and never another frame. Level-up on a card outside a frame creates the parent frame and silently swallows deeper frames under it (`addFrame`); level-up on a frame header widens it the same way; a card inside a frame has no level-up. Ungroup removes only that frame (swallowed frames do not come back)
- Cards inside a frame are fixed (`draggable: false`, auto-stacked); only the whole frame moves. Positions of cards in frames are never saved
- On load `graph-grouped-paths` is flattened to the outermost key per collection (`flattenGroupedPaths`) and `rel:*` entries of `graph-positions` are dropped (`stripRelPositions`), each written back only when changed. A frame promoted to top level without a saved position appears at its natural position; there is no auto-arrange
- Card and frame titles are breadcrumbs (`font > size > body`), the tooltip is the full slash path; collection and managed/external cards stay plain
- Card menu "Hide unused" (just above Delete): highlights that card's path and turns hiding on in one step; reads "Show all" while hiding is active
- Grid Settings "Sort by": Tier (default) or Collection, persisted with the gaps in `graph-layout-settings` (a record without it loads as Tier)
- Tier: one column per dependency tier, left to right, every column starting at the top, with a "Tier N" caption above each (`graph-tier-labels`, Tier mode only); inside a column, cards by title (collection root cards stay alphabetical, the collection order does not apply to Tier mode), then reordered to reduce wire crossings; free drag
- Collection: one column per collection, left to right in the collection order (Winden's saved order, the same as the sidebar; see Collection order), each headed by the collection's name (derived live, never saved; a rename updates it)
- Collection: inside a column, cards and frames form one ordered list, top to bottom, always packed from the column's top with exactly the Grid Settings vertical gap (`gapY`) between units; until a unit is moved the list is the sidebar tree's path order (segment-wise, `compareGroupPaths`): the collection root card first, an empty root card ("No variables at the collection root") last; a managed chain (source → shader → shades/steps) is one unit, stays one horizontal line at its source's path slot and widens its column
- Collection: every column starts at the top; a column is as wide as its widest visible unit; columns are `gapX` apart (Grid Settings)
- Collection: library cards and the selection card stay right of the last column and move freely (free position, any direction)
- Collection drag: a card, frame or chain moves vertically only (x is locked to its column) and freely while dragging; nothing shifts during the drag
  - On drop (mouse release) the dropped unit is reinserted into its column's list at the index implied by the centre of the dropped block: it goes after every remaining visible unit whose centre is above that centre; dropped above the column it becomes first, below the column last; the column then repacks with exactly `gapY`, so a drop in empty space snaps into the list and a drop that implies the same index snaps back (nothing is written)
  - Arrow keys (Up/Down, with or without Shift) move the unit one visible slot up or down per press; Left/Right do nothing; at the top or bottom the unit stays
  - A multi-selection dropped together is inserted as one contiguous block keeping its relative order; units in other columns cannot be reached, each column's dropped units reorder within that column
  - A frame is one unit: its cards move with it and the stored key is the frame's path; dragging the collection's own frame (the whole column) does nothing
  - A managed chain is one unit: dragging any card of it reorders the whole chain
  - Hidden units (filters, Hide unused) keep their place in the list and take no room
- Each mode keeps its own saved layout. Tier: `graph-positions` (free x/y). Collection: the card order per column in `graph-order-collection` (never a y position), plus `graph-positions-collection`, which now holds only the free library cards and the selection card. Switching modes never changes the other mode's layout
  - `graph-order-collection` is `{ v: 1, columns: [{ id, name, items }] }` in client storage (per user, like the other `graph-*` keys); `items` are the unit keys in list order: `path:<path>` for a card or a frame (one shared namespace, so level-up and ungroup keep the slot; `path:` with an empty path is the root card or the collection's own frame) and `chain:<sourceGroupName>` for a managed chain
  - Columns are matched to the live collections by id first, then unmatched entries claim the first unclaimed collection with the same name, so the order survives a Winden undo (which recreates every id); every write stores the current id and name. A column without an entry, or `columns: []`, is natural path order; a malformed record is ignored
  - Units missing from a stored list (a new card) are slotted in by natural order right after their nearest natural predecessor, a new empty root card goes last, a new frame takes the slot of the first stored key under its path; stored keys with no live unit are skipped on load and pruned the next time that column is written
  - One-time migration: when `graph-order-collection` is absent and the old `graph-positions-collection` holds column keys (`group:`, `wrapper:`, `collection:`, `source:` ids), each column's order is derived from the stored y (units without one use their natural y, ties keep natural order) and written once; the old record is rewritten holding only the free library and selection cards; later loads write nothing
- Collection layout follows the filters: hidden units take no room and a collection with nothing visible collapses (no header, no gap); filters and Hide unused always repack the column from the top with exactly `gapY`, so a column never has holes. Hide unused may therefore move cards (and columns, when it empties one) while it lasts; showing all restores the full order
- The "Sort by" control only edits the dropdown's draft: Cancel discards a switch; an Apply that only switches the mode just switches (no arrange, nothing saved but the setting, the Undo Arrange step is dropped); an Apply that also changes a gap arranges the new mode, and its Undo Arrange also switches the mode back (saved) and restores that mode's order, the gaps stay as applied; in Collection mode an Apply that only changes a gap keeps the order and repacks with the new gaps (no arrange, no Undo Arrange step); Undo after a plain Arrange never touches the mode
- Arrange Grid follows the mode. Tier: arranges and saves every unit, hidden (filtered) units parked in a spare column right of the grid. Collection: resets the card order to natural path order (`graph-order-collection` becomes `{ v: 1, columns: [] }`) and clears the free library/selection positions, every column repacked with the current gaps
- Undo Arrange restores the SAVED layout of that mode (Tier: the positions and the captions; Collection: the card order and the free library/selection record) from before the arrange, never the live positions: cards that had no saved position re-flow with the filters again (Arrange with a filter → Undo → clear the filter no longer overlaps frames). Known and accepted: Tier Arrange with a filter, then clearing the filter WITHOUT Undo can still grow a partly-filtered frame into the next unit — Arrange again
- Overlap nudge (`resolveOverlaps.ts`, Tier mode; in Collection mode columns are always packed, so it only moves free library and selection cards and never a column unit): no two cards or frames on screen overlap; it fixes layouts saved before the card-height fix (a frame running into the card below)
  - Walking top to bottom, a top-level card or frame (a frame and its cards are one block) that overlaps one above it in the same column (horizontal overlap of at least half the narrower box) moves down to exactly the Grid Settings vertical gap below it (Tier mode; the drop and swap rules below are Tier-only too, Collection mode reorders its list instead, see Collection drag)
  - Nothing moves up or sideways, a push can push the next box, and boxes that collide with nothing stay put (a gap smaller than the setting is left alone)
  - A pushed box keeps the full gap: once a push is involved, a box closer than the gap to the next one in the column counts as a collision and goes to the gap below it, so a cascade never leaves boxes touching
  - Hidden cards (filters, Hide unused) push nothing
  - It runs in every layout pass (never per drag tick) and is display only: nothing is written to storage on load, Arrange + Undo restores the saved record exactly (shown nudged again)
  - Tier mode: a drop (mouse release or arrow key, one card, a frame with its cards, or every box of a multi-selection) is resolved at once. The dropped boxes of one column move as one block and keep their offsets
  - A drop that passes boxes in its column swaps with them, like a reorder, so the column stays packed. Up: a box is passed when it started above the block and the block's new top is inside it or above it. One arrow key press into the card above is enough. The block takes the top of the top-most passed box, also when dropped above it; only a block dropped clear of every passed box (free space above them) stays where it was dropped. The passed boxes stack below it at the gap, in their order
  - Down is the mirror image: a box is passed when it started below the block and the block's new bottom is inside it or below it, so one arrow key press into the card below is enough. The passed boxes move up by the block's height plus the gap (into its old slot in a packed column, never above its old top), keeping their order, and the block sits the gap below the last one. A block dropped clear of every passed box (free space below them) stays where it was dropped; the boxes it crossed still move up
  - Arrow keys walk a card along its column smoothly: the presses that only move it into the gap keep its slot, so a swap always fills the slot and the column never grows
  - Anything else a drop or a swap lands on (a block moved into another column swaps nothing) moves down to the gap below the dropped boxes, cascading, vertical only
  - Dropped boxes that overlap each other (only possible when they overlapped before) fall back to "higher top stays" among themselves
  - The whole canvas is stored after the drop, so the stored layout has no overlap left and a reload shows it unchanged
  - A dropped box placed close to another one without overlapping it stays as dropped and pushes nothing
  - Known, left alone: a frame wider than its Tier column sticks into the next column by a sliver at a small horizontal gap (also on HEAD); that is not a same-column overlap
- Collection mode: a sidebar collection click and the quick-search collection jump fit the collection's column header plus its first card with variables (topmost, leftmost; an empty collection-root card is the target only when nothing else of the collection is visible) instead of fitting the whole column; Tier mode fits all its cards
- Known, accepted for now: in Collection mode, aliases inside one collection and aliases to a collection further right draw backward wires (handles stay in on the left, out on the right)
- `graph-layout-labels` (collection row labels of an earlier Collection design) is retired: a stored record is cleared on load, and label ids are stripped from `graph-positions`

**Selection card:**
- The selected Figma node appears as a card; bound tokens are connected to its property rows
- Dragging a token onto a row binds it (`bind-node-property`); disconnecting an edge unbinds it (`unbind-node-property`), always on that row's own layer id
- Components/instances: child layers are listed as collapsible sections, default/empty values are hidden, "Add property" reveals one for binding
- Revealed rows and collapsed sections reset when the selection changes; an unbound row stays visible until then

**Library:** @xyflow/react for graph visualization

---

### 6. Filtering and Search

**Search:**
- By variable name
- Debounced input (300ms)
- Case-insensitive

**Filters:**
- By collection (multi-select)
- By type (COLOR, FLOAT, STRING, BOOLEAN)
- Combine filters

---

### 7. Mode Management

**What are modes:**
Figma variables can have different values per mode (e.g., Light/Dark themes).

**Plugin features:**
- Switch active mode per collection
- Edit values for specific modes
- Visual mode indicators

---

### 8. Bulk Operations

**Supported operations:**
- Duplicate variables
- Delete multiple variables
- Update from CSV
- Update from JSON
- Generate color scales

---

### 9. Browser Bridge

**"Bridge to browser" window:**
- Status strip that relays this file to the local `npx winden-tokens` relay (pairing code, attached tab count, Retry)
- "Open in browser" link while connected or pairing: opens `http://localhost:9337/` in the system default browser via `figma.openExternal` (the sandbox owns the URL)

---

## Plugin Architecture

### Two-File System

**code.ts** (Plugin Sandbox):
- Runs in Figma's secure sandbox
- Access to `figma.*` API
- Variable CRUD operations
- Polls for external changes (2s)

**ui.html** (UI Iframe):
- Runs in browser context
- React UI
- User interactions
- Message passing to plugin

### Message Protocol

**UI → Plugin:**
```typescript
parent.postMessage({
  pluginMessage: {
    type: 'update-variable-value',
    id: 'var-123',
    value: '#FF0000'
  }
}, '*');
```

**Plugin → UI:**
```typescript
figma.ui.postMessage({
  type: 'update-success',
  variable: { ... }
});
```

**Collection order messages:**
- `set-collection-order` (UI → plugin): `{ order: { v: 1, entries: [{ id, name }] }, requestId }`. Undoable: it runs through `runMutationWithHistory`, so each reorder is its own undo step. The plugin keeps only entries whose id is a live collection and writes their names from the live collections, never from the UI.
- Every reply comes after a fresh `data-loaded` with the stored order and echoes `requestId`: `update-success`, or `update-error` for an invalid payload or a failed write (view-only file)
- History operations (every `runMutationWithHistory` mutation, undo, redo) run one at a time in arrival order (`runSerializedHistoryOperation`), because `figma.ui.onmessage` does not wait for the previous handler
- `data-loaded` (plugin → UI) carries `collectionOrder` (the stored order, or `null`) next to `collections` and `variables`. `collections` and `variables` stay in API order on the wire; the UI applies the order
- `refresh` clears the variable order but keeps the collection order (shared, saved in the file; Figma's own panel order cannot be read back)

---

## Figma Variables

### Variable Types

Figma supports 4 types:

1. **COLOR** - RGBA color
   - Internal: `{ r: 1, g: 0, b: 0, a: 1 }` (0-1 range)
   - UI display: `rgb(255, 0, 0)` or `#FF0000`

2. **FLOAT** - Numeric value
   - Example: `8`, `16.5`, `1.5`
   - Use case: Spacing, opacity, line height

3. **STRING** - Text value
   - Example: `"Helvetica"`, `"16px"`
   - Use case: Font names, text content

4. **BOOLEAN** - True/false
   - Example: `true`, `false`
   - Use case: Feature flags, visibility

### Variable Collections

Variables are organized in collections:
- Collection = group of related variables
- Example: "Colors", "Spacing", "Typography"

#### Collection order

Figma's plugin API returns collections in creation order and exposes no collection order, so Winden keeps its own.
It is saved in the Figma file, so it is shared with everyone who opens the file.

**Storage:**
- `figma.root` plugin data key `collectionOrder`: `{ v: 1, entries: [{ id, name }] }` (sandbox: `readCollectionOrder` / `writeCollectionOrder`; at most 1000 entries, duplicate ids keep the first; an empty list deletes the key)
- Validation is the same on both sides (sandbox `sanitizeCollectionOrderEntries`, UI `parseCollectionOrder`): one malformed entry rejects the whole value
- A value this build cannot read (bad JSON, another version) reads as "no order" and is never overwritten by reads; undo/redo puts it back verbatim

**Resolution (`utils/collectionOrder.ts`, `resolveCollectionOrder`):**
- Each entry first claims the collection with the same id; each entry still unmatched then claims the first unclaimed collection with the same name
- Collections come in entry order; new or unknown collections go last, in API order
- Because of the name fallback the order survives Winden undo/redo (which recreates every collection with a new id) and renames
- No stored order, or no match, means API order

**Where it applies:**
- `DataContext` exposes the resolved `collections` and `variables` stable-sorted by their collection's rank, so the sidebar, mode tags, table rows, graph Collection columns, JSON tab and move-to-collection dropdowns all follow it
- Tier mode root cards stay alphabetical; MCP `list_collections` stays in API order
- `reorderCollections(orderedIds)` applies the order optimistically, then posts `set-collection-order` with a new `requestId`; a no-op reorder posts nothing
- While any reorder is unanswered the optimistic order wins over the stored order of incoming `data-loaded` messages (their collections still apply, so creates, deletes and renames show at once), so rapid moves build on each other
- `update-success` / `update-error` settle a request by its `requestId` (`settleCollectionOrder`); once none is pending the last stored order shows, so a failed save reverts
- With no answer for 10 s (`COLLECTION_ORDER_ACK_TIMEOUT_MS`, e.g. an older plugin build that ignores the message) the stored order shows again

**Undo / redo / sync:**
- The order is part of the history snapshot; a pure reorder undo (same collections, only the order differs) takes an order-only fast path: nothing is deleted or recreated, so ids, graph state and canvas bindings survive
- Any other undo restores the order with the ids remapped to the recreated collections
- Delete all and Refresh keep the order
- The change poll hashes the raw stored value, so a collaborator's reorder shows up on the next poll

**Sidebar:** drag collection rows or press Alt+↑/↓ (see SidebarFilter in `components.md`)

### Modes

Each collection can have multiple modes:
- Mode = variant of variable values
- Example: "Light", "Dark", "High Contrast"
- Each variable has different value per mode

---

## Data Flow

### Initialization

```
1. Plugin starts (code.ts)
2. UI opens (ui.html loads)
3. UI requests data (postMessage 'refresh')
4. Plugin fetches variables from Figma
5. Plugin sends data to UI (postMessage 'data-loaded')
6. UI renders table
```

### Update Flow

```
1. User edits value in table
2. UI validates input
3. UI sends update (postMessage 'update-variable-value')
4. Plugin updates Figma variable
5. Plugin sends confirmation (postMessage 'update-success')
6. UI updates local state
7. Table reflects new value
```

### External Changes

```
1. Plugin polls every 2s
2. Checks for changes made outside plugin
3. If changes detected → postMessage 'changes-detected'
4. UI merges changes
5. Table updates automatically
```

**Why polling?**
Figma doesn't provide real-time change events. Polling is the only way to detect external edits.

---

## Key Functions

### Variable CRUD

**Create:**
```typescript
figma.variables.createVariable(name, collectionId, resolvedType);
```

**Read:**
```typescript
const allVariables = figma.variables.getLocalVariables();
const variable = figma.variables.getVariableById(id);
```

**Update:**
```typescript
variable.name = newName;
variable.setValueForMode(modeId, newValue);
variable.description = newDescription;
```

**Delete:**
```typescript
variable.remove();
```

### Collection Management

**Create collection:**
```typescript
const collection = figma.variables.createVariableCollection(name);
```

**Get collections:**
```typescript
const collections = figma.variables.getLocalVariableCollections();
```

**Add mode:**
```typescript
const modeId = collection.addMode(modeName);
```

---

## Features in Detail

### Inline Editing

**How it works:**
1. Click cell → becomes editable input
2. Type new value
3. Press Enter or blur → saves
4. Escape → cancels

**Validation:**
- COLOR: Must be valid hex or rgb()
- FLOAT: Must be valid number
- STRING: Any text
- BOOLEAN: Checkbox toggle

### Search

**Implementation:**
- Debounced input (300ms)
- Filters variables by name
- Case-insensitive
- Updates table in real-time

### Filtering

**By collection:**
- Checkbox list of collections
- Multi-select
- Show only variables in selected collections

**By type:**
- Checkbox list with icons
- COLOR, FLOAT, STRING, BOOLEAN
- Show only selected types

**Combine filters:**
- Search + Collection + Type
- All filters applied simultaneously

---

## Settings

**Available settings:**

1. **Theme mode**
   - Follow Figma
   - Light
   - Dark

2. **Auto-save** (future)
   - Save changes automatically
   - Or require manual save

3. **Polling interval** (future)
   - How often to check for external changes
   - Default: 2000ms

---

## Limitations

### Figma API Limitations

1. **No real-time updates** - Must poll
2. **No undo/redo API** - Can't hook into Figma's undo
3. **No batch operations** - Must update variables one by one
4. **No collection order** - The API returns collections in creation order and offers no way to read or set the order shown in Figma's panel; Winden stores its own order in the file (see Collection order)
5. **Single-file UI** - Must bundle everything inline

### Plugin Limitations

1. **Local variables only** - Can't edit library variables
2. **No style management** - Only variables, not text/color styles
3. **No auto-save** - Changes apply immediately (no undo)

---

## Future Features

**Planned:**
- Auto-save toggle
- Undo/redo support
- Export to CSS/SCSS/JSON
- Import from design token standards
- Variable templates
- Bulk rename with regex
- Variable grouping/tags
- History/audit log

---

## Related Documentation

- [devnotes.md](devnotes.md) - How to develop
- [components.md](components.md) - UI components
- [techstack.md](techstack.md) - Technologies
- [testing.md](testing.md) - Testing
