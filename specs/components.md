# Components

**Component inventory and reference**

---

## Component Categories

### Common Components
Reusable UI primitives in `src/ui/components/common/`

### Table Components  
Spreadsheet table in `src/ui/components/Table/`

### Toolbar Components
Top toolbar in `src/ui/components/Toolbar/`

### Modal Components
Dialogs in `src/ui/components/Modals/`

### Tab Components
Views in `src/ui/components/Tabs/`

### Relationship Components
Dependency graph in `src/ui/components/Relationships/`

---

## Common Components

### Button
**File:** `common/Button/Button.tsx`

**Purpose:** Primary button with variants

**Props:**
- `variant?: 'primary' | 'secondary' | 'danger'`
- `size?: 'sm' | 'md' | 'lg'`
- `icon?: React.ReactNode`
- Standard button props

**Supports:** forwardRef

**Usage:**
```tsx
<Button variant="primary" onClick={handleClick}>
  Save
</Button>
```

---

### Input
**File:** `common/Input/Input.tsx`

**Purpose:** Text input with label and error

**Props:**
- `label?: string`
- `error?: string`
- `outlined?: boolean`
- Standard input props

**Supports:** forwardRef

**Usage:**
```tsx
<Input
  label="Variable Name"
  value={name}
  onChange={e => setName(e.target.value)}
  error={errors.name}
/>
```

---

### Select
**File:** `common/Select/Select.tsx`

**Purpose:** Dropdown select (compound component)

**Props:**
- `value: string`
- `onChange: (e) => void`
- Standard select props

**Supports:** forwardRef

**Usage:**
```tsx
<Select value={type} onChange={handleChange}>
  <Select.Option value="COLOR">Color</Select.Option>
  <Select.Option value="FLOAT">Number</Select.Option>
  <Select.Group label="Advanced">
    <Select.Option value="STRING">Text</Select.Option>
  </Select.Group>
</Select>
```

---

### Checkbox
**File:** `common/Checkbox/Checkbox.tsx`

**Purpose:** Checkbox with optional label

**Props:**
- `label?: React.ReactNode`
- `error?: string`
- Standard checkbox props

**Supports:** forwardRef

**Usage:**
```tsx
<Checkbox
  label="Include in export"
  checked={includeInExport}
  onChange={e => setIncludeInExport(e.target.checked)}
/>
```

---

### Radio
**File:** `common/Radio/Radio.tsx`

**Purpose:** Radio button with optional label

**Props:**
- `label?: React.ReactNode`
- `error?: string`
- Standard radio props (except `type`)

**Supports:** forwardRef

**Usage:**
```tsx
<Radio
  name="mode"
  label="Light Mode"
  checked={mode === 'light'}
  onChange={() => setMode('light')}
/>
```

---

### Textarea
**File:** `common/Textarea/Textarea.tsx`

**Purpose:** Multi-line text input

**Props:**
- `label?: string`
- `error?: string`
- `mono?: boolean` - Monospace font
- Standard textarea props

**Supports:** forwardRef

**Usage:**
```tsx
<Textarea
  label="Description"
  mono
  value={description}
  onChange={e => setDescription(e.target.value)}
/>
```

---

### Label
**File:** `common/Label/Label.tsx`

**Purpose:** Form label with required indicator

**Props:**
- `htmlFor?: string`
- `required?: boolean`
- `children: React.ReactNode`

**Usage:**
```tsx
<Label htmlFor="name" required>
  Variable Name
</Label>
```

---

### FormGroup
**File:** `common/FormGroup/FormGroup.tsx`

**Purpose:** Wrapper for form field with label and error

**Props:**
- `label?: string`
- `error?: string`
- `required?: boolean`
- `children: React.ReactNode`

**Usage:**
```tsx
<FormGroup label="Name" required error={errors.name}>
  <Input value={name} onChange={e => setName(e.target.value)} />
</FormGroup>
```

---

### Modal
**File:** `common/Modal/Modal.tsx`

**Purpose:** Base modal dialog

**Props:**
- `isOpen: boolean`
- `onClose: () => void`
- `title?: string`
- `children: React.ReactNode`

**Usage:**
```tsx
<Modal isOpen={isOpen} onClose={close} title="Edit Variable">
  <p>Modal content</p>
</Modal>
```

---

### SegmentedControl
**File:** `common/SegmentedControl/SegmentedControl.tsx`

**Purpose:** iOS-style tab group for picking one of a few options

**Props:**
- `options: { value, label, badge?, onBadgeClick? }[]`
- `value`, `onChange(value)`
- `variant?: 'bordered' | 'filled'`, `fullWidth?: boolean`, `className?: string`

**Used in:** `ColorPickerModal`, `ShadesModal`, Grid Settings "Sort by" (`GroupedGraph.tsx`)

---

### Dropdown
**File:** `common/Dropdown/Dropdown.tsx`

**Purpose:** Dropdown menu container

**Props:**
- `trigger: React.ReactNode`
- `children: React.ReactNode`
- `isOpen?: boolean`
- `onToggle?: (open: boolean) => void`

**Usage:**
```tsx
<Dropdown trigger={<button>Menu</button>}>
  <div className="dropdown-content">
    Items here
  </div>
</Dropdown>
```

---

### OptionsDropdown
**File:** `common/OptionsDropdown/OptionsDropdown.tsx`

**Purpose:** Dropdown menu with absolute positioning (overlay, doesn't push content). **Standard component for ALL dropdowns in the app.**

**Props:**
- `label: string` - Button label text
- `children: React.ReactNode` - Menu content (Radio buttons, Checkboxes, Buttons, etc.)
- `className?: string` - Additional CSS classes
- `icon?: ReactNode` - Icon-only trigger (IconButton); `label` becomes its `aria-label`
- `align?: 'left' | 'right'` - Menu edge alignment (default `left`)
- `indicator?: boolean` - Dot on the icon-only trigger (e.g. an active filter)

**Features:**
- Absolute positioned menu (overlays content, doesn't push layout)
- Ghost button trigger by default (IconTextButton with ChevronDown icon on right)
- Closes on click outside or Escape key
- Shadow and border styling
- `z-50` for proper layering above content
- Built-in accessibility: `aria-expanded`, `aria-haspopup="menu"`
- Min-width 200px, expandable based on content
- Consistent padding, rounded corners, border

**Used In:**
- SidebarFilter (Table/Relationships sidebar) - Icon-only filter trigger on the Collections header opening the Types checkboxes
- CollectionFilters (toolbar) - Multiple collections with checkboxes
- VariableTypeFilters (toolbar) - Type checkboxes
- ModeSelector (toolbar) - Mode selection
- GroupCollectionCell (table) - Move group to collection (radio buttons)
- CollectionCell (table) - Move variable to collection (radio buttons)
- GroupHeader (table) - Contrast color picker with Pick/Reference/Clear options
- TableRow (table) - Contrast color picker for individual variables (2 instances)

**Pattern:** Use OptionsDropdown for ANY dropdown in the app. Do NOT create custom dropdown implementations.

**Usage:**
```tsx
// With checkboxes
<OptionsDropdown label="Types (4/4)">
  <Checkbox label="Color" checked={true} onChange={...} />
  <Checkbox label="Number" checked={true} onChange={...} />
</OptionsDropdown>

// With radio buttons
<OptionsDropdown label="colors">
  <Radio label="Collection 1" checked={true} onChange={...} />
  <Radio label="Collection 2" checked={false} onChange={...} />
</OptionsDropdown>

// With buttons
<OptionsDropdown label="Actions">
  <TextButton onClick={...}>Edit</TextButton>
  <TextButton onClick={...}>Delete</TextButton>
</OptionsDropdown>
```

---

### IconButton
**File:** `common/IconButton/IconButton.tsx`

**Purpose:** Icon-only button

**Props:**
- `icon: React.ReactNode`
- `variant?: 'default' | 'danger' | 'ghost'` (default: `'ghost'`)
- `size?: 'sm' | 'md' | 'lg'` (default: `'md'`)
- `aria-label: string` (required for accessibility)
- Standard button props

**Supports:** forwardRef

**Default Style:** Ghost variant - `bg-transparent text-gray-700 hover:bg-base-2 active:bg-base-3`

**Usage:**
```tsx
// Ghost (default) - transparent with hover
<IconButton icon={<EditIcon />} aria-label="Edit" />

// Danger variant - for destructive actions
<IconButton
  icon={<TrashIcon />}
  variant="danger"
  aria-label="Delete"
  onClick={handleDelete}
/>

// Default variant - solid background
<IconButton icon={<SettingsIcon />} variant="default" aria-label="Settings" />
```

**Note:** `aria-label` is required for accessibility since icon-only buttons have no visible text.

---

### IconTextButton
**File:** `common/IconTextButton/IconTextButton.tsx`

**Purpose:** Button with icon and text

**Props:**
- `icon: React.ReactNode`
- `iconPosition?: 'left' | 'right'` (default: `'left'`)
- `variant?: 'primary' | 'secondary' | 'danger' | 'ghost'` (default: `'ghost'`)
- `size?: 'sm' | 'md' | 'lg'` (default: `'md'`)
- `fullWidth?: boolean`
- `loading?: boolean`
- `children: React.ReactNode`
- Standard button props

**Supports:** forwardRef

**Default Style:** Ghost variant - `bg-transparent text-gray-700 hover:bg-base-2 active:bg-base-3`

**Usage:**
```tsx
// Ghost (default) - transparent with hover
<IconTextButton icon={<PlusIcon />}>Add Variable</IconTextButton>

// Primary variant - for main actions
<IconTextButton icon={<SaveIcon />} variant="primary">Save</IconTextButton>

// Icon on right
<IconTextButton icon={<ArrowIcon />} iconPosition="right">Next</IconTextButton>
```

---

### TextButton
**File:** `common/TextButton/TextButton.tsx`

**Purpose:** Text-only button

**Props:**
- `variant?: 'primary' | 'secondary' | 'danger' | 'ghost'` (default: `'ghost'`)
- `size?: 'sm' | 'md' | 'lg'` (default: `'md'`)
- `fullWidth?: boolean`
- `loading?: boolean`
- `children: React.ReactNode`
- Standard button props

**Supports:** forwardRef

**Default Style:** Ghost variant - `bg-transparent text-gray-700 hover:bg-base-2 active:bg-base-3`

**Usage:**
```tsx
// Ghost (default) - transparent with hover
<TextButton onClick={handleCancel}>Cancel</TextButton>

// Primary variant - for main actions
<TextButton variant="primary" onClick={handleSave}>Save</TextButton>

// Danger variant - for destructive actions
<TextButton variant="danger" onClick={handleDelete}>Delete</TextButton>
```

---

### ColorSwatch
**File:** `common/ColorSwatch/ColorSwatch.tsx`

**Purpose:** Color display with checkerboard background for transparency visualization

**Props:**
- `color: string` - Color value (hex, rgb, rgba, etc.)
- `onClick?: (e: React.MouseEvent) => void` - Optional click handler
- `size?: 'sm' | 'md' | 'lg'` (default: `'md'`)
- `className?: string` - Additional CSS classes

**Sizes:**
- `sm`: 16px × 16px
- `md`: 24px × 24px (default)
- `lg`: 32px × 32px

**Features:**
- Checkerboard background pattern (shows transparency)
- Border and rounded corners
- Optional click handler with cursor pointer
- Consistent sizing options

**Usage:**
```tsx
// Simple color display
<ColorSwatch color="#FF0000" />

// With transparency (rgba)
<ColorSwatch color="rgba(255, 0, 0, 0.5)" />

// Clickable with custom size
<ColorSwatch
  color={displayColor}
  size="lg"
  onClick={(e) => handleShowColorMenu(e)}
/>
```

**Used In:**
- [ValueCell.tsx](src/ui/components/Table/ValueCell.tsx) - Color variable display

**Replaces:** Massive inline Tailwind checkerboard pattern (saves ~200 characters per usage)

---

## Table Components

### TableView
**File:** `Table/TableView.tsx`

**Purpose:** Main spreadsheet table

**Features:**
- Grouped by collection
- Expandable rows
- Inline editing
- Bulk selection

---

### SidebarFilter
**File:** `Table/SidebarFilter.tsx` (selection math: `utils/sidebarSelection.ts`)

**Purpose:** Left sidebar of the Table and Relationships views: mode picker, Collections tree, Types filter dropdown

**Collections tree (click-to-select, no checkboxes):**
- Rows ("All variables", collections, folders, groups) are `role="treeitem"` inside a `role="tree"`, with `aria-selected`, `tabIndex=0`, Enter/Space to activate
- Plain click on a collection hides nothing (no filter, every collection stays fully visible): it clears any group narrowing and every other mark (`selectOnly` = everything, `onSelectAllCollections` fires so Hide unused ends), rings the row (local `markedCollections` state, `isRowMarked(..., markedCollections)`) and jumps to it via `onFocusPath(id, '')` (graph: fit the collection; table: `TableView` scrolls the collection's first visible row into view via `data-collection-id`, using `scrollIntoView`; group rows do not scroll in the table). Filtering starts at group level: plain click on a group or folder shows only that group (and subgroups) inside its own collection while every other collection stays fully visible and unfiltered; "All variables" selects everything (and fires `onSelectAllCollections`)
- Cmd/Ctrl-click (or Enter/Space with it) on a collection row only flips its mark (`toggleCollectionMark`, no filter, no camera move; the last mark stays while nothing is narrowed). On a group row it toggles the row: a picked row leaves, an unpicked one joins (a group joins within its collection and keeps the other collections visible; a fully visible group narrows its collection to it); the last picked row can never be removed
- Chevrons are separate buttons and never change the selection
- Only rows the user picked are marked (`isRowMarked`), never rows that are merely visible: the clicked row gets `bg-primary/10 ring-1 ring-primary` (also the canvas-focus ring), its descendants only the `bg-primary/10` fill; while everything is selected only "All variables" is marked
- In the graph a plain click also finds the row on the canvas via `onFocusPath`; Cmd/Ctrl-click does not move the camera

**Collection reorder (order saved in the file, see "Collection order" in `functions.md`):**
- Collections come from `useAppContext()` already in the saved order; the tree calls `reorderCollections(orderedIds)` (DataContext), which applies the new order at once and saves it
- Drag a collection row (HTML5 drag and drop; not the "All variables" root, groups or folders). Each collection block is the drop target: the pointer above the row's midpoint drops before it, below it (including over its expanded groups) after it
- Drop line: a 2px `bg-primary` bar in the gap between blocks; the dragged row is `opacity-50`; no line when the drop would change nothing
- Alt+ArrowUp / Alt+ArrowDown on a focused collection row moves it one place; focus stays on the moved row and an `aria-live="polite"` `sr-only` region announces "Moved <name> to position N of M"
- Disabled (not draggable, no keys, no hint) while the search box has text or with fewer than 2 collections
- Row tooltip adds "Drag or Alt+↑/↓ to reorder"; plain click, Cmd/Ctrl-click and Enter/Space are unchanged, and the click a browser may send after a drag is ignored
- Collection rows carry `data-collection-id`; `TreeRow` gains `draggable`, `onDragStart`, `onDragEnd`, `dragging`, `onReorderKey`, `dataCollectionId`
- Move math: `moveCollectionId` in `utils/collectionOrder.ts`

**DataContext (`context/DataContext.tsx`):** `collections` is resolved against the stored order and `variables` are stable-sorted by their collection's rank (raw API-order data stays internal); `setData(collections, variables, shadeGroups, collectionOrder?)`; `reorderCollections(orderedIds)` (optimistic, then `set-collection-order`; the optimistic order holds until every pending request is settled via `settleCollectionOrder(requestId)` from `update-success` / `update-error`, or 10 s pass). The initial selected collection is the first one in the resolved order

**Props:** `selectedCollections`, `selectedGroups`, `onSelectionChange({ collections, groups })` (one atomic write per click), optional `onFocusPath`, `focusNoun` (tooltip, 'graph' default / 'table'), `isPathFocusable`, `focusedRowKey`, `highlightedGroupKey`, `onSelectAllCollections`

**Table filtering:** ungrouped (collection root) variables show only while every group of their collection is selected, so picking a group shows just that group (`isVariableVisibleForGroupFilters` with `getGroupKeysByCollection`)

---

### TableRow
**File:** `Table/TableRow.tsx`

**Purpose:** Single variable row

**Props:**
- `variable: Variable`
- `collectionId: string`
- `modeId: string`
- `onUpdate: (updates) => void`
- `onDelete: () => void`

---

### ValueCell
**File:** `Table/ValueCell.tsx`

**Purpose:** Editable value cell (type-specific)

**Handles:**
- COLOR → Color picker
- FLOAT → Number input
- STRING → Text input
- BOOLEAN → Checkbox

---

### CollectionCell
**File:** `Table/CollectionCell.tsx`

**Purpose:** Collection name with mode selector

**Features:**
- Radio buttons for mode selection
- Visual grouping

---

### GroupCollectionCell
**File:** `Table/GroupCollectionCell.tsx`

**Purpose:** Collection header for grouped rows

**Features:**
- Expand/collapse toggle
- Collection name
- Mode selector

---

### GroupHeader
**File:** `Table/GroupHeader.tsx`

**Purpose:** Table column headers

**Columns:**
- Collection
- Name
- Type
- Value
- Description
- Actions

---

### ColorMenu
**File:** `Table/ColorMenu.tsx`

**Purpose:** Absolutely positioned dropdown menu offering ways to set a color, not a color editor itself

**Features:**
- "Pick Color" action with a `ShadesIcon`
- "Reference Color" action with the color type icon
- Optional "Clear" item, shown only when a current color is set, with a swatch of that color
- Can render a caller-supplied `options` list (label/icon/onClick) instead of the built-in actions
- Used by `ColorValueMenu`; `ContrastPicker` renders its own equivalent buttons rather than using this component

---

### ColorValueMenu
**File:** `Table/ColorValueMenu.tsx`

**Purpose:** Wraps `ColorMenu` to edit a color variable's value for the current mode

**Features:**
- "Pick Color" opens `ColorPickerModal` seeded with the variable's resolved color
- An alias like `{accent/50}` is resolved to the color it points to before seeding the picker
- An alias that resolves to no color opens the picker at neutral gray `#888888`
- Apply writes the picked color as the variable's value for the current mode
- "Reference Color" opens the color reference modal and writes the result as a `{name}` alias
- Used only from the Relationships graph (`GroupedGraph.tsx`), for a graph node's color

---

### ContrastPicker
**File:** `Table/ContrastPicker.tsx`

**Purpose:** WCAG contrast checker

**Features:**
- Foreground/background selection
- Contrast ratio display
- AA/AAA indicators

---

## Toolbar Components

### Toolbar
**File:** `Toolbar/Toolbar.tsx`

**Purpose:** Main toolbar container

**Features:**
- Search input
- Collection filters
- Type filters
- Mode selector
- Add menu

---

### CollectionFilters
**File:** `Toolbar/CollectionFilters.tsx`

**Purpose:** Filter by collection

**Features:**
- Checkbox list
- Select all/none

---

### VariableTypeFilters
**File:** `Toolbar/VariableTypeFilters.tsx`

**Purpose:** Filter by type

**Features:**
- Checkbox list with icons
- COLOR, FLOAT, STRING, BOOLEAN

---

### ModeSelector
**File:** `Toolbar/ModeSelector.tsx`

**Purpose:** Select active mode

**Features:**
- Radio button list
- Shows available modes

---

### AddMenu
**File:** `Toolbar/AddMenu.tsx`

**Purpose:** Create new items

**Options:**
- Create Variable
- Create Collection
- Import JSON
- Bulk operations

---

## Modal Components

### ModalContext
**File:** `Modals/ModalContext.tsx`

**Purpose:** Global modal state

**Provides:**
- `openModal(modalId, props)`
- `closeModal(modalId)`

---

### InputModal
**File:** `Modals/InputModal.tsx`

**Purpose:** Simple text input dialog

**Props:**
- `title: string`
- `label: string`
- `initialValue?: string`
- `onSubmit: (value: string) => void`

**Use cases:**
- Rename variable
- Create collection

---

### ColorPickerModal
**File:** `Modals/ColorPickerModal.tsx`

**Purpose:** react-aria `ColorPicker` modal for picking a single color

**Features:**
- Saturation/brightness `ColorArea` plus a hue `ColorSlider`
- HEX/RGB/HSL segmented tabs that switch between numeric `ColorField` inputs
- Cancel/Apply footer; Apply returns the color as a 6-digit hex string via `onConfirm`
- Resets to `initialColor` every time it opens, so a cancelled edit never carries over
- An unparseable `initialColor` falls back to `#000000` instead of crashing
- No alpha channel, no color history
- Opened via `useModalContext().openColorPicker({ initialColor, onConfirm })`
- Callers: `ValueCell`, `ColorValueMenu`, the contrast color pickers in `TableRow`/`GroupHeader`, and the base color picker in `ShadesModal`

---

### StepsModal
**File:** `Modals/StepsModal.tsx`

**Purpose:** Generate color scale

**Features:**
- Define step count
- Set base color
- Lightness ratio
- Generate values

**Use case:** Create 50-900 scales

---

### ShadesModal
**File:** `Modals/ShadesModal.tsx`

**Purpose:** Generate monochromatic shades

**Features:**
- Single color input
- Number of shades
- Distribution

---

### ColorReferenceModal
**File:** `Modals/ColorReferenceModal.tsx`

**Purpose:** Link color to another variable

**Features:**
- Browse available colors
- Create alias
- Preview

---

### BulkEditModal
**File:** `Modals/BulkEditModal.tsx`

**Purpose:** CSV-style bulk editing

**Features:**
- Spreadsheet interface
- Copy/paste
- Validation

**Format:**
```csv
collection, name, type, value
Colors, primary, COLOR, #FF0000
```

---

## Tab Components

### TabBar
**File:** `Tabs/TabBar.tsx`

**Purpose:** Tab navigation

**Tabs:**
- Table
- JSON
- Relationships
- Settings

---

### TabButton
**File:** `Tabs/TabButton.tsx`

**Purpose:** Individual tab button

**Props:**
- `label: string`
- `isActive: boolean`
- `onClick: () => void`
- `icon?: React.ReactNode`

---

### TabContent
**File:** `Tabs/TabContent.tsx`

**Purpose:** Tab content wrapper

**Features:**
- Smooth transitions
- Lazy loading

---

### JsonEditor
**File:** `Tabs/JsonEditor.tsx`

**Purpose:** JSON bulk editor

**Features:**
- Syntax highlighting
- Validation
- Import/export

---

### SettingsView
**File:** `Tabs/SettingsView.tsx`

**Purpose:** Plugin settings

**Settings:**
- Theme mode
- Auto-save
- Polling interval

---

## Relationship Components

### RelationshipsView
**File:** `Relationships/RelationshipsView.tsx`

**Purpose:** Dependency graph container

**Features:**
- Variable relationships
- Alias chains
- Circular detection

---

### GroupedGraph
**File:** `Relationships/GroupedGraph.tsx`

**Purpose:** Graph visualization

**Library:** @xyflow/react

**Features:**
- Node grouping
- Edge visualization
- Pan/zoom
- Selection card (`GroupedGraph/PropertyNode.tsx`) for the selected Figma node, one row per inspected property; drag a token onto a row to bind it
- Component selections (component, component set, instance) show one collapsible section per visible layer (root + descendants, indented by depth)
- Component sections list only bound/styled rows and rows with a real value; "Add property" (per section) reveals a hidden bindable row for the session
- Rows are pure-helper driven: `GroupedGraph/propertyLayers.ts` (flatten, visibility, card height); handle ids `prop:<layerIndex>:<entryIndex>::in|out`
- Tier mode Arrange Grid (`arrangeGroupsByConnectedBlocks`): one column per tier, columns step by `GROUP_WIDTH + gapX`; depth over the full connection graph, packing over visible cards only
- Tier captions (`GroupedGraph/TierLabelNode.tsx`) sit above each column, one column wide; inert nodes (`tier-label:` ids) that never enter `savedPositions`, arrange or `isCardHidden`
- Collection mode (Grid Settings "Sort by"): `GroupedGraph/columnLayout.ts` — `buildCollectionColumnItems` (top-level units sized as drawn, managed chains as one line), `layoutCollectionColumns` (one column per collection in collection order, path order via `compareGroupPaths` from `utils/groupFilters.ts`, empty root last, widths = widest visible unit, hidden collections collapse), `resolveColumnPositions` (column x always, stored y only) and `lockChangesToColumns` (rewrites `position` changes to the column x before `onNodesChange`: vertical-only drag). Pure, position-independent; the `collectionNaturalLayout` memo in `GroupedGraph.tsx` feeds the layout effect, Arrange (temporary while hiding) and the drag lock (`lockedXRef`)
- Collection column header: `TierLabelNode` with `kind: 'collection'` data (`CollectionHeaderPlacement`: name, x, width; `isCollectionHeader` in `utils.ts`), same chrome as a tier caption, node id `tier-label:collection:<collectionId>` (inside the caption namespace, so saves, undo and unit folding ignore it)
- Positions per mode: `graph-positions` (Tier) and `graph-positions-collection` (Collection; the drag save merges only the moved nodes; Arrange writes `{}`)
- `GroupedGraph/sidebarFocus.ts` `selectFirstCollectionNodeId` / `selectCollectionHeaderNodeId`: Collection mode's camera target for a collection (its header plus the topmost-leftmost visible top-level node, skipping an empty collection-root card unless it is all that is visible); the header is a fit target only, never highlighted
- `wrapperLayout.ts`: `buildWrapperLayout(..., naturalPositions?)` (absent = Tier packing, unchanged) and `measureWrapperFrames` (exact drawn size per top-level unit)
- `GroupedGraph/arrangeUndo.ts`: `takeArrangeSnapshot` / `restoreArrangeSnapshot` — Undo Arrange's snapshot is the saved record plus the tier captions, never live node positions, plus `store` (the mode whose record it is — Undo writes it back there) and the previous `sortBy` when the arrange was an Apply that switched it (Undo restores the mode too)
- `CardHeaderRow` (`GroupedGraph/GraphNode.tsx`) renders the title as a breadcrumb (`font > size > body`): props `title` (full slash path, the tooltip), `segments` (one segment is plain text), `draggable` (false drops the `cursor-move` on a frozen card). Ancestors are dimmed, the leaf is bold and shrinks last, separators use `ChevronRightIcon`, header actions are `shrink-0`
- `GraphWrapperNode` (frame): ONE level, holds cards and never another frame; a multi-segment path shows the same breadcrumb, a single segment or the collection name is plain. It keeps the level-up button (widens the frame)
- `GroupNodeData.inFrame`: the card sits in a frame, so it offers no level-up and its header has no move cursor
- Rebuild reconciliation (`GroupedGraph/utils.ts`): the layout effect hands xyflow `reconcileNodes(prev, next)` / `reconcileEdges(prev, next)` instead of fresh arrays — the previous object for every node/edge whose content is unchanged (`isStructurallyEqual`: plain data, Sets and Maps by content, callbacks by identity; xyflow's `measured` and cleared `selected`/`dragging` ignored), and `carryMeasured` for a changed node (keeps its last size and handle bounds, so it is not hidden to re-measure; not carried across hidden, type or explicit style-size changes)
- A card's `connectedVars` / `highlightedVars` / `highlightedVarSeed` are cut down to its own rows (`cardRowState` in the layout effect), so a change elsewhere in the graph does not change its data
- `CardRows` passes highlight props only to a card on the chain into the memoized `CardRowsList` (content comparator); `CardHeaderActions` is memoized on the fields it reads (`HEADER_ACTION_FIELDS`). A highlight that only dims a card re-renders its box, not its rows or handles

---

## Icon Components

### Icons.tsx
**File:** `components/Icons.tsx`

**Purpose:** SVG icon components

**Icons:**
- ChevronDownIcon
- ChevronRightIcon (custom `chevron-right` icon, `icons/svg/chevron-right.svg`; breadcrumb separator)
- PlusIcon
- TrashIcon
- DuplicateIcon
- EditIcon
- SettingsIcon
- SearchIcon
- FilterIcon
- ColorIcon
- NumberIcon
- TextIcon
- BooleanIcon
- And more...

**Usage:**
```tsx
import { ChevronDownIcon } from '@/components/Icons';

<ChevronDownIcon className="w-4 h-4" />
```

---

## Other Components

### ResizeHandles
**File:** `components/ResizeHandles.tsx`

**Purpose:** Draggable panel resize

**Features:**
- Horizontal/vertical resize
- Min/max constraints
- Persist to localStorage

---

## Component Conventions

### File Structure

```
ComponentName/
├── ComponentName.tsx       # Implementation
├── ComponentName.test.tsx  # Tests
├── ComponentName.stories.tsx # Storybook (optional)
└── index.ts                # Barrel export
```

### forwardRef Support

Most form components support `forwardRef`:
- Button
- Input
- Select
- Checkbox
- Radio
- Textarea
- IconButton

**Usage:**
```tsx
const inputRef = useRef<HTMLInputElement>(null);

<Input ref={inputRef} />
```

### Compound Components

Some components use compound pattern:
- **Select** - `Select.Option`, `Select.Group`

**Why:** Better API, flexible composition

---

## Adding New Components

### Checklist

1. **Check for duplicates** - Review this file first
2. **Create folder** - `components/category/ComponentName/`
3. **Implement component** - `ComponentName.tsx`
4. **Add tests** - `ComponentName.test.tsx`
5. **Export** - Add to `index.ts`
6. **Update this file** - Add to inventory
7. **Testing agent reviews** - Automated

---

## Related Documentation

- [styles.md](styles.md) - How to style components
- [testing.md](testing.md) - How to test components
- [structure.md](structure.md) - File organization
