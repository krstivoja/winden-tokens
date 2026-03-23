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

**Purpose:** Three-dot menu for row actions

**Props:**
- `options: Array<{ label: string, onClick: () => void, icon?: ReactNode }>`

**Usage:**
```tsx
<OptionsDropdown
  options={[
    { label: 'Edit', onClick: handleEdit },
    { label: 'Delete', onClick: handleDelete },
  ]}
/>
```

---

### IconButton
**File:** `common/IconButton/IconButton.tsx`

**Purpose:** Icon-only button

**Props:**
- `icon: React.ReactNode`
- `title?: string`
- Standard button props

**Supports:** forwardRef

**Usage:**
```tsx
<IconButton icon={<TrashIcon />} title="Delete" onClick={handleDelete} />
```

---

### IconTextButton
**File:** `common/IconTextButton/IconTextButton.tsx`

**Purpose:** Button with icon and text

**Props:**
- `icon: React.ReactNode`
- `children: React.ReactNode`
- Standard button props

**Usage:**
```tsx
<IconTextButton icon={<PlusIcon />} onClick={handleAdd}>
  Add Variable
</IconTextButton>
```

---

### TextButton
**File:** `common/TextButton/TextButton.tsx`

**Purpose:** Text-only button (minimal styling)

**Props:**
- Standard button props

**Usage:**
```tsx
<TextButton onClick={handleCancel}>Cancel</TextButton>
```

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

**Purpose:** Color picker popup

**Features:**
- RGB sliders
- Hex input
- Alpha channel

---

### ColorValueMenu
**File:** `Table/ColorValueMenu.tsx`

**Purpose:** Enhanced color picker

**Features:**
- Palette selection
- Recent colors
- Favorites

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

**Purpose:** Full-featured color picker

**Features:**
- RGB/HSL sliders
- Hex input
- Alpha channel
- History

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

---

## Icon Components

### Icons.tsx
**File:** `components/Icons.tsx`

**Purpose:** SVG icon components

**Icons:**
- ChevronDownIcon
- ChevronRightIcon
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
