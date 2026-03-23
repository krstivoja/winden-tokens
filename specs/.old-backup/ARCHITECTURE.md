# Architecture Documentation

**Winden Tokens Figma Plugin - Complete Technical Architecture**

Last Updated: 2026-03-23

---

## Overview

Winden Tokens is a Figma plugin for managing design tokens (variables) with a spreadsheet-style interface. Built with React, TypeScript, and Tailwind CSS v4.

### Key Characteristics

- **Two-file architecture** (Figma plugin requirement)
- **Message-based communication** between plugin and UI
- **Real-time synchronization** with Figma variables
- **Bulk editing** via spreadsheet table and JSON editor
- **Type-safe** TypeScript throughout

---

## Core Architecture

### Plugin Files (Figma Sandbox)

#### `code.ts`
**Purpose:** Main plugin code running in Figma's sandboxed environment

**Responsibilities:**
- Access Figma API (`figma.*`)
- CRUD operations on variables and collections
- Poll for external changes (every 2 seconds)
- Message passing with UI

**Key APIs Used:**
- `figma.variables.*` - Variable manipulation
- `figma.ui.postMessage()` - Send data to UI
- `figma.on('run', ...)` - Plugin initialization

### UI Files (Browser Context)

#### `ui.html`
**Purpose:** Single-file build output (inline CSS, JS, HTML)

Built from `src/ui/ui.tsx` using Vite with `vite-plugin-singlefile`.

#### `src/ui/ui.tsx`
**Purpose:** React app entry point

**Responsibilities:**
- Render main App component
- Set up React root
- Initialize message listeners

---

## Message Protocol

### UI → Plugin Messages

```typescript
parent.postMessage({
  pluginMessage: {
    type: string,
    ...data
  }
}, '*')
```

**Message Types:**
- `refresh` - Request full data reload
- `create-collection` - Create new variable collection
- `create-variable` - Create new variable
- `update-variable-name` - Rename variable
- `update-variable-value` - Update variable value
- `delete-variable` - Delete variable
- `duplicate-variable` - Duplicate variable
- `update-from-json` - Bulk update from JSON

### Plugin → UI Messages

```typescript
figma.ui.postMessage({
  type: string,
  ...data
})
```

**Message Types:**
- `data-loaded` - Full data refresh
- `changes-detected` - External changes detected
- `update-success` - Operation succeeded
- `update-error` - Operation failed

---

## Component Inventory

### Common Components (`src/ui/components/common/`)

Reusable UI primitives used throughout the application.

#### Button (`common/Button/Button.tsx`)
**Purpose:** Primary button component with variants

**Props:**
- `variant?: 'primary' | 'secondary' | 'danger'`
- `size?: 'sm' | 'md' | 'lg'`
- `icon?: React.ReactNode`
- `disabled?: boolean`
- All standard button props

**Supports:** forwardRef

#### Input (`common/Input/Input.tsx`)
**Purpose:** Text input with optional label and error state

**Props:**
- `label?: string`
- `error?: string`
- `outlined?: boolean` - Show outline on focus
- All standard input props

**Supports:** forwardRef

#### Select (`common/Select/Select.tsx`)
**Purpose:** Dropdown select with compound component pattern

**Usage:**
```tsx
<Select value={value} onChange={onChange}>
  <Select.Option value="opt1">Option 1</Select.Option>
  <Select.Option value="opt2">Option 2</Select.Option>
  <Select.Group label="Group">
    <Select.Option value="opt3">Option 3</Select.Option>
  </Select.Group>
</Select>
```

**Supports:** forwardRef

#### Checkbox (`common/Checkbox/Checkbox.tsx`)
**Purpose:** Checkbox with optional label

**Props:**
- `label?: React.ReactNode`
- `error?: string`
- All standard input checkbox props

**Supports:** forwardRef

#### Radio (`common/Radio/Radio.tsx`)
**Purpose:** Radio button with optional label

**Props:**
- `label?: React.ReactNode`
- `error?: string`
- All standard input radio props (except `type`)

**Supports:** forwardRef

#### Textarea (`common/Textarea/Textarea.tsx`)
**Purpose:** Multi-line text input

**Props:**
- `label?: string`
- `error?: string`
- `mono?: boolean` - Use monospace font
- All standard textarea props

**Supports:** forwardRef

#### Label (`common/Label/Label.tsx`)
**Purpose:** Form label with optional required indicator

**Props:**
- `htmlFor?: string`
- `required?: boolean`
- `children: React.ReactNode`

#### FormGroup (`common/FormGroup/FormGroup.tsx`)
**Purpose:** Wrapper for form field with label and error

**Props:**
- `label?: string`
- `error?: string`
- `required?: boolean`
- `children: React.ReactNode`

#### Modal (`common/Modal/Modal.tsx`)
**Purpose:** Base modal component

**Props:**
- `isOpen: boolean`
- `onClose: () => void`
- `title?: string`
- `children: React.ReactNode`

#### Dropdown (`common/Dropdown/Dropdown.tsx`)
**Purpose:** Dropdown menu container

**Props:**
- `trigger: React.ReactNode` - Element that opens dropdown
- `children: React.ReactNode` - Dropdown content
- `isOpen?: boolean`
- `onToggle?: (open: boolean) => void`

#### OptionsDropdown (`common/OptionsDropdown/OptionsDropdown.tsx`)
**Purpose:** Three-dot menu dropdown for row actions

**Props:**
- `options: Array<{ label: string, onClick: () => void, icon?: React.ReactNode }>`

#### IconButton (`common/IconButton/IconButton.tsx`)
**Purpose:** Icon-only button

**Props:**
- `icon: React.ReactNode`
- `title?: string` - Tooltip text
- All standard button props

**Supports:** forwardRef

#### IconTextButton (`common/IconTextButton/IconTextButton.tsx`)
**Purpose:** Button with icon and text

**Props:**
- `icon: React.ReactNode`
- `children: React.ReactNode`
- All standard button props

#### TextButton (`common/TextButton/TextButton.tsx`)
**Purpose:** Text-only button (minimal styling)

**Props:**
- `children: React.ReactNode`
- All standard button props

---

### Table Components (`src/ui/components/Table/`)

Spreadsheet-style variable editor components.

#### TableView (`Table/TableView.tsx`)
**Purpose:** Main table component displaying all variables

**Features:**
- Grouped by collection
- Expandable/collapsible groups
- Inline editing
- Bulk selection
- Context menus

#### TableRow (`Table/TableRow.tsx`)
**Purpose:** Single variable row

**Props:**
- `variable: Variable`
- `collectionId: string`
- `modeId: string`
- `onUpdate: (updates) => void`
- `onDelete: () => void`

#### CollectionCell (`Table/CollectionCell.tsx`)
**Purpose:** Collection name cell with radio for mode selection

**Features:**
- Mode switching per collection
- Visual grouping indicator

#### GroupCollectionCell (`Table/GroupCollectionCell.tsx`)
**Purpose:** Collection header cell for grouped rows

**Features:**
- Expand/collapse toggle
- Collection name display
- Mode selector

#### ValueCell (`Table/ValueCell.tsx`)
**Purpose:** Editable value cell based on variable type

**Handles:**
- COLOR - Color picker trigger
- FLOAT - Number input
- STRING - Text input
- BOOLEAN - Checkbox

#### GroupHeader (`Table/GroupHeader.tsx`)
**Purpose:** Table header with column titles

**Columns:**
- Collection
- Name
- Type
- Value
- Description
- Actions

#### ColorMenu (`Table/ColorMenu.tsx`)
**Purpose:** Color picker popup menu

**Features:**
- RGB sliders
- Hex input
- Alpha channel
- Color presets

#### ColorValueMenu (`Table/ColorValueMenu.tsx`)
**Purpose:** Enhanced color picker with additional features

**Features:**
- Palette selection
- Recent colors
- Favorite colors

#### ContrastPicker (`Table/ContrastPicker.tsx`)
**Purpose:** WCAG contrast ratio checker

**Features:**
- Foreground/background color selection
- Contrast ratio calculation
- WCAG AA/AAA indicators

---

### Toolbar Components (`src/ui/components/Toolbar/`)

Top toolbar with filters and actions.

#### Toolbar (`Toolbar/Toolbar.tsx`)
**Purpose:** Main toolbar container

**Features:**
- Search input
- Collection filters
- Variable type filters
- Mode selector
- Add menu

#### CollectionFilters (`Toolbar/CollectionFilters.tsx`)
**Purpose:** Filter variables by collection

**Features:**
- Checkbox list of collections
- Select all/none
- Active count indicator

#### VariableTypeFilters (`Toolbar/VariableTypeFilters.tsx`)
**Purpose:** Filter variables by type (COLOR, FLOAT, STRING, BOOLEAN)

**Features:**
- Checkbox list with icons
- Visual type indicators

#### ModeSelector (`Toolbar/ModeSelector.tsx`)
**Purpose:** Select active mode for current collection

**Features:**
- Radio button list
- Shows available modes
- Persists selection

#### AddMenu (`Toolbar/AddMenu.tsx`)
**Purpose:** Dropdown menu for creating new items

**Options:**
- Create Variable
- Create Collection
- Import from JSON
- Bulk operations

---

### Modal Components (`src/ui/components/Modals/`)

Dialog windows for complex operations.

#### ModalContext (`Modals/ModalContext.tsx`)
**Purpose:** Global modal state management

**Provides:**
- `openModal(modalId: string, props?: any)`
- `closeModal(modalId: string)`
- Modal registry and state

#### InputModal (`Modals/InputModal.tsx`)
**Purpose:** Simple text input modal

**Use Cases:**
- Rename variable
- Create collection
- Quick text entry

**Props:**
- `title: string`
- `label: string`
- `initialValue?: string`
- `onSubmit: (value: string) => void`

#### ColorPickerModal (`Modals/ColorPickerModal.tsx`)
**Purpose:** Full-featured color picker

**Features:**
- RGB/HSL sliders
- Hex input
- Alpha channel
- Color history
- Eyedropper (browser support)

#### StepsModal (`Modals/StepsModal.tsx`)
**Purpose:** Generate color scale/shades

**Features:**
- Define number of steps
- Set base color
- Lightness/darkness ratio
- Generate intermediate values

**Use Cases:**
- Create color scales (50-900)
- Generate tint/shade variants

#### ShadesModal (`Modals/ShadesModal.tsx`)
**Purpose:** Generate monochromatic shades

**Features:**
- Single color input
- Number of shades
- Lightness distribution
- Preview generated palette

#### ColorReferenceModal (`Modals/ColorReferenceModal.tsx`)
**Purpose:** Link color variable to another color

**Features:**
- Variable alias creation
- Browse available colors
- Preview referenced color

#### BulkEditModal (`Modals/BulkEditModal.tsx`)
**Purpose:** CSV-style bulk editing

**Features:**
- Spreadsheet-like interface
- Copy/paste support
- Multi-row editing
- Validation

**Format:**
```csv
collection, name, type, value
Colors, primary, COLOR, #FF0000
Spacing, base, FLOAT, 8
```

---

### Tab Components (`src/ui/components/Tabs/`)

Main view switcher and tab content.

#### TabBar (`Tabs/TabBar.tsx`)
**Purpose:** Tab navigation bar

**Tabs:**
- Table (default)
- JSON
- Relationships
- Settings

#### TabButton (`Tabs/TabButton.tsx`)
**Purpose:** Individual tab button

**Props:**
- `label: string`
- `isActive: boolean`
- `onClick: () => void`
- `icon?: React.ReactNode`

#### TabContent (`Tabs/TabContent.tsx`)
**Purpose:** Tab content wrapper with animation

**Features:**
- Smooth transitions
- Lazy loading
- Preserve state

#### JsonEditor (`Tabs/JsonEditor.tsx`)
**Purpose:** JSON bulk editor

**Features:**
- Syntax highlighting
- Validation
- Import/export
- Bulk updates

**Format:**
```json
{
  "collections": {
    "Colors": {
      "primary": { "type": "COLOR", "value": "#FF0000" }
    }
  }
}
```

#### SettingsView (`Tabs/SettingsView.tsx`)
**Purpose:** Plugin settings and preferences

**Settings:**
- Theme mode (Light/Dark/Figma)
- Auto-save
- Polling interval
- Export options

---

### Relationship Components (`src/ui/components/Relationships/`)

Variable dependency visualization.

#### RelationshipsView (`Relationships/RelationshipsView.tsx`)
**Purpose:** Main relationships view container

**Features:**
- Graph visualization
- Variable dependencies
- Alias chains
- Circular dependency detection

#### GroupedGraph (`Relationships/GroupedGraph.tsx`)
**Purpose:** Graph visualization using @xyflow/react

**Features:**
- Node grouping by collection
- Edge visualization for aliases
- Interactive pan/zoom
- Auto-layout

**Library:** @xyflow/react (React Flow)

---

### Icon Components

#### Icons.tsx (`components/Icons.tsx`)
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
- More icons...

**Usage:**
```tsx
import { ChevronDownIcon } from '@/components/Icons';
<ChevronDownIcon className="w-4 h-4" />
```

#### Icon.tsx (`components/icons/Icon.tsx`)
**Purpose:** Base icon wrapper component

**Props:**
- `name: string`
- `size?: number`
- `className?: string`

---

### Other Components

#### ResizeHandles (`components/ResizeHandles.tsx`)
**Purpose:** Draggable resize handles for panel splitting

**Features:**
- Horizontal/vertical resizing
- Min/max constraints
- Persist sizes to localStorage

---

## State Management

### Global State

Currently uses **React Context** for state management.

#### AppContext
**Location:** `src/ui/context/AppContext.tsx` (if exists)

**Provides:**
- Variables data
- Collections data
- Selected mode
- Active filters
- CRUD operations

### Local State

Components use **React hooks** for local state:
- `useState` - Component state
- `useEffect` - Side effects
- `useRef` - DOM refs
- `useMemo` - Memoized values
- `useCallback` - Memoized callbacks

### Custom Hooks

#### `usePluginMessages` (if exists)
**Purpose:** Handle message passing with plugin

**Returns:**
- `sendMessage(type, data)` - Send to plugin
- `onMessage(handler)` - Listen for messages

---

## Data Flow

### Initialization

```
1. Plugin starts → code.ts runs
2. Plugin opens UI → ui.html loads
3. UI requests data → postMessage('refresh')
4. Plugin sends data → postMessage('data-loaded', { variables, collections })
5. UI renders table
```

### Variable Update

```
1. User edits value in table
2. UI validates input
3. UI sends update → postMessage('update-variable-value', { id, value })
4. Plugin updates Figma variable
5. Plugin confirms → postMessage('update-success')
6. UI updates local state
```

### External Changes (Polling)

```
1. Plugin polls every 2s → checks for external changes
2. If changes detected → postMessage('changes-detected', { variables })
3. UI merges changes → updates table
4. User sees updated values
```

---

## Styling Architecture

### Tailwind CSS v4

**All styling uses Tailwind utility classes. NO custom CSS files.**

#### Design Tokens

Defined in `src/ui/styles/main.css`:

```css
@theme {
  /* Colors */
  --color-primary: #0066FF;
  --color-bg-primary: #FFFFFF;
  --color-bg-secondary: #F5F5F5;
  --color-border: #E0E0E0;
  --color-text-primary: #000000;
  --color-text-secondary: #666666;

  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  /* Typography */
  --font-family-base: "Inter", sans-serif;
  --font-family-mono: "Courier New", monospace;
  --font-size-sm: 12px;
  --font-size-base: 14px;
  --font-size-lg: 16px;
}
```

#### Plugin-specific Classes

Defined in `src/tailwind.plugin.css`:

```css
@layer components {
  .btn {
    @apply px-3 py-1.5 rounded border transition;
  }

  .btn-primary {
    @apply bg-primary text-white hover:bg-blue-600;
  }

  .form-input {
    @apply px-2 py-1 border border-border rounded;
  }
}
```

**Important:** These are the ONLY custom classes allowed. All other styling uses utilities.

---

## File Structure

```
winden-tokens/
├── .claude/
│   ├── agents/
│   │   ├── orchestrator.md
│   │   ├── components-dev.md
│   │   ├── functionality-dev.md
│   │   └── testing-dev.md
│   ├── AGENT_TEAMS.md
│   ├── QUICK_START.md
│   ├── HOW_TO_VERIFY_AGENTS.md
│   └── settings.local.json
├── docs/
│   ├── decisions/
│   │   └── TEMPLATE.md
│   ├── _posts/
│   └── ...
├── specs/
│   ├── ARCHITECTURE.md (this file)
│   ├── TECH_STACK.md
│   ├── STYLING.md
│   ├── PLUGIN_FUNCTIONALITY.md
│   ├── TESTING.md
│   ├── COMPONENT_QUICK_START.md
│   ├── COMPONENTS_COMPLETE.md
│   ├── COMPONENT_SUMMARY.md
│   └── COMPONENT_USAGE_EXAMPLES.md
├── src/
│   ├── code.ts
│   ├── ui/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   ├── Table/
│   │   │   ├── Toolbar/
│   │   │   ├── Modals/
│   │   │   ├── Tabs/
│   │   │   ├── Relationships/
│   │   │   ├── Icons.tsx
│   │   │   ├── icons/
│   │   │   └── ResizeHandles.tsx
│   │   ├── hooks/
│   │   ├── context/
│   │   ├── styles/
│   │   │   └── main.css
│   │   ├── tailwind.plugin.css
│   │   └── ui.tsx
│   └── types/
├── dist/
│   └── index.html (build output)
├── manifest.json
├── package.json
├── tsconfig.json
├── tsconfig.plugin.json
├── vite.config.ts
└── CLAUDE.md
```

---

## Build Process

### Development

```bash
npm run dev
```

1. **Vite dev server** starts on `http://localhost:5173`
2. **TypeScript watch** compiles `code.ts` → `dist/code.js`
3. Hot reload enabled
4. Changes reflect instantly

### Production

```bash
npm run build
```

1. **Vite build** bundles UI → `dist/index.html` (single file)
2. **TypeScript compile** builds `code.ts` → `dist/code.js`
3. **Inlining** via `vite-plugin-singlefile`
4. Ready for Figma plugin

**Output:**
- `dist/index.html` - UI (HTML + inline CSS + inline JS)
- `dist/code.js` - Plugin code

---

## Testing Architecture

### Testing Stack

- **Vitest** - Test runner
- **React Testing Library** - Component testing
- **@testing-library/user-event** - User interactions
- **jsdom** - DOM environment

### Test Organization

```
src/ui/components/common/Button/
├── Button.tsx
├── Button.test.tsx
└── Button.stories.tsx (optional)
```

**Convention:** Test files live next to source files with `.test.tsx` extension.

### Running Tests

```bash
npm test              # Run once
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run test:ui       # Vitest UI
```

---

## Key Design Decisions

### Why Two-File Architecture?

**Reason:** Figma plugin requirement.
- `code.ts` runs in secure sandbox with Figma API access
- `ui.html` runs in iframe with browser APIs
- Communication via `postMessage` only

### Why Single-File Build?

**Reason:** Simpler deployment and faster loading.
- Figma plugins must reference HTML files
- Inline CSS/JS eliminates network requests
- Faster initialization in Figma

### Why Message Passing?

**Reason:** Security and isolation.
- Plugin code cannot access DOM
- UI cannot access Figma API
- `postMessage` is only communication channel

### Why Polling?

**Reason:** Detect external changes.
- Multiple users can edit same file
- Figma doesn't provide real-time change events
- Polling every 2s balances responsiveness and performance

### Why Tailwind v4?

**Reason:** Rapid development with zero CSS overhead.
- Utility-first approach
- No CSS naming conflicts
- Purged unused styles
- Smaller bundle size

### Why No Redux/Zustand?

**Reason:** Complexity not needed.
- React Context sufficient for current scale
- Message passing already provides centralized updates
- Keep it simple

---

## Performance Considerations

### Optimizations

1. **Memoization**
   - Use `React.memo` for expensive components
   - `useMemo` for computed values
   - `useCallback` for handlers in lists

2. **Virtualization**
   - Table virtualization for 1000+ variables (future)
   - Currently handles ~500 variables well

3. **Debouncing**
   - Search input debounced (300ms)
   - Auto-save debounced (1s)

4. **Code Splitting**
   - Not currently used (single-file build)
   - Consider if bundle > 500KB

---

## Security

### CSP (Content Security Policy)

Figma enforces strict CSP:
- No inline `<script>` tags
- No `eval()`
- No external scripts
- All JS must be bundled

### Data Validation

- All user input validated before sending to plugin
- Type guards for variable values
- Sanitize JSON imports

---

## Accessibility

### Standards

- **WCAG 2.1 Level AA** compliance
- Keyboard navigation for all interactive elements
- Screen reader support via ARIA attributes
- Focus management in modals

### Implementation

- Semantic HTML
- ARIA labels on icon buttons
- Focus trapping in modals
- Skip links (future)

---

## Deployment

### Figma Plugin Submission

1. Build production bundle: `npm run build`
2. Test in Figma: Import manifest
3. Verify all features work
4. Submit to Figma Community

### Versioning

- **Semantic Versioning** (semver)
- Version in `manifest.json` must match `package.json`
- Update changelog in `docs/_posts/`

---

## Future Architecture Considerations

### Potential Improvements

1. **State Management**
   - Consider Zustand if complexity grows
   - Persist state to localStorage

2. **Real-time Sync**
   - Investigate Figma plugin WebSocket support
   - Reduce polling overhead

3. **Offline Support**
   - Cache data in IndexedDB
   - Queue operations when offline

4. **Performance**
   - Virtual scrolling for large datasets
   - Web Workers for heavy computations

5. **Testing**
   - E2E tests with Playwright
   - Visual regression testing

---

## Maintenance Guidelines

### When Adding Components

1. **Check ARCHITECTURE.md** - Ensure not duplicating
2. **Use forwardRef** - If component wraps native elements
3. **Export from index.ts** - Consistent imports
4. **Write tests** - Minimum 80% coverage
5. **Update this file** - Add to Component Inventory
6. **Update COMPONENTS_COMPLETE.md** - If reusable

### When Modifying Architecture

1. **Document decision** - Create `docs/decisions/YYYY-MM-DD-title.md`
2. **Update specs** - Keep all specs in sync
3. **Communicate** - Discuss with team (or agents)
4. **Test thoroughly** - Ensure no regressions

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Development guide
- [TECH_STACK.md](TECH_STACK.md) - Dependencies and versions
- [STYLING.md](STYLING.md) - Styling guidelines
- [PLUGIN_FUNCTIONALITY.md](PLUGIN_FUNCTIONALITY.md) - Features
- [TESTING.md](TESTING.md) - Testing guide
- [Agent Teams](./.claude/AGENT_TEAMS.md) - Agent coordination

---

**This document is maintained by the `@testing-dev` agent and updated automatically when architectural changes occur.**
