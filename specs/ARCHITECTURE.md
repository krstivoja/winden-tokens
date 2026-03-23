# Architecture & Component Inventory

This document describes the plugin architecture, file structure, and complete component inventory. **Always check this before creating new components.**

## Plugin Architecture

### Two-File Architecture

Figma plugins use a **sandboxed two-file architecture**:

```
┌─────────────────────────────────────────────┐
│  Figma Plugin Sandbox (code.ts)            │
│                                             │
│  • Access to figma.* API                    │
│  • NO DOM access                            │
│  • Manages variables, collections          │
│  • Polls for changes every 2s               │
│                                             │
│  postMessage ↓                    ↑ onmessage
│                                             │
├─────────────────────────────────────────────┤
│  Plugin UI (ui.html / React)                │
│                                             │
│  • Full DOM access                          │
│  • NO figma.* API access                    │
│  • React components + state                 │
│  • Displays data, handles interactions      │
│                                             │
└─────────────────────────────────────────────┘
```

### Message Passing

**UI → Plugin:**
```typescript
// From React component
parent.postMessage({
  pluginMessage: {
    type: 'create-variable',
    data: { name: 'primary', type: 'COLOR', value: '#FF0000' }
  }
}, '*');
```

**Plugin → UI:**
```typescript
// From code.ts
figma.ui.postMessage({
  type: 'data-loaded',
  data: { variables, collections }
});
```

## File Structure

```
winden-tokens/
├── src/
│   ├── plugin/                # Figma plugin sandbox code
│   │   └── code.ts            # Main plugin file (TS → JS)
│   ├── ui/                    # React UI code
│   │   ├── components/        # React components
│   │   │   ├── common/        # Reusable UI components
│   │   │   ├── Table/         # Table view components
│   │   │   ├── Modals/        # Modal components
│   │   │   ├── Toolbar/       # Toolbar components
│   │   │   ├── Tabs/          # Tab view components
│   │   │   ├── Relationships/ # Graph view components
│   │   │   ├── Icons.tsx      # Icon components
│   │   │   └── ResizeHandles.tsx  # Resize UI
│   │   ├── styles/            # CSS files
│   │   │   ├── main.css       # Main stylesheet + tokens
│   │   │   └── components-extended.css  # Complex components
│   │   ├── main.tsx           # React entry point
│   │   ├── App.tsx            # Root component
│   │   └── index.html         # HTML template
│   └── tailwind.plugin.css    # Tailwind @theme definitions
├── dist/                      # Build output
│   ├── code.js                # Compiled plugin code
│   └── index.html             # Bundled UI (single file)
├── specs/                     # AI specifications
├── .storybook/                # Storybook config
├── manifest.json              # Figma plugin manifest
├── tsconfig.json              # TypeScript config (UI)
├── tsconfig.plugin.json       # TypeScript config (plugin)
├── vite.config.ts             # Vite build config
└── package.json               # Dependencies & scripts
```

## Component Inventory

### Common Components (Reusable UI)

**Location:** `src/ui/components/common/`

These are **foundational components** - DO NOT create duplicates!

#### 1. Button
**File:** `common/Button/Button.tsx`

**Props:**
```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}
```

**Usage:**
```tsx
<Button variant="primary" onClick={handleSave}>
  Save Changes
</Button>
```

**Files:**
- `Button.tsx` - Implementation
- `Button.test.tsx` - Unit tests
- `Button.stories.tsx` - Storybook stories

#### 2. Input
**File:** `common/Input/Input.tsx`

**Props:**
```typescript
interface InputProps {
  type?: 'text' | 'number' | 'email' | 'password';
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
}
```

**Usage:**
```tsx
<Input
  value={variableName}
  placeholder="Enter name"
  onChange={setVariableName}
  error={nameError}
/>
```

#### 3. Checkbox
**File:** `common/Checkbox/Checkbox.tsx`

**Props:**
```typescript
interface CheckboxProps {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}
```

**Usage:**
```tsx
<Checkbox
  label="Auto-generate shades"
  checked={autoGenerate}
  onChange={setAutoGenerate}
/>
```

#### 4. Select
**File:** `common/Select/Select.tsx`

**Props:**
```typescript
interface SelectProps {
  value: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}
```

**Usage:**
```tsx
<Select
  value={selectedType}
  options={[
    { value: 'COLOR', label: 'Color' },
    { value: 'FLOAT', label: 'Number' }
  ]}
  onChange={setSelectedType}
/>
```

#### 5. Textarea
**File:** `common/Textarea/Textarea.tsx`

**Props:**
```typescript
interface TextareaProps {
  value: string;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  error?: string;
  onChange: (value: string) => void;
}
```

#### 6. Label
**File:** `common/Label/Label.tsx`

**Props:**
```typescript
interface LabelProps {
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
}
```

#### 7. FormGroup
**File:** `common/FormGroup/FormGroup.tsx`

**Props:**
```typescript
interface FormGroupProps {
  label?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}
```

**Usage:**
```tsx
<FormGroup label="Variable Name" required error={nameError}>
  <Input value={name} onChange={setName} />
</FormGroup>
```

#### 8. IconButton
**File:** `common/IconButton/IconButton.tsx`

**Props:**
```typescript
interface IconButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  ariaLabel: string;
}
```

#### 9. Modal
**File:** `common/Modal/Modal.tsx`

**Props:**
```typescript
interface ModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  children: React.ReactNode;
}
```

**Usage:**
```tsx
<Modal
  isOpen={showModal}
  title="Create Variable"
  onClose={() => setShowModal(false)}
  onSubmit={handleCreate}
>
  <FormGroup label="Name">
    <Input value={name} onChange={setName} />
  </FormGroup>
</Modal>
```

#### 10. Dropdown
**File:** `common/Dropdown/Dropdown.tsx`

**Props:**
```typescript
interface DropdownProps {
  trigger: React.ReactNode;
  items: Array<{
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    danger?: boolean;
  }>;
  align?: 'left' | 'right';
}
```

### Feature Components

**Location:** `src/ui/components/[Feature]/`

#### Table View

**Location:** `src/ui/components/Table/`

1. **TableView.tsx** - Main table component
2. **TableRow.tsx** - Variable row
3. **GroupHeader.tsx** - Collection group header
4. **ValueCell.tsx** - Editable value cell
5. **CollectionCell.tsx** - Collection selector cell
6. **GroupCollectionCell.tsx** - Group collection display
7. **ColorMenu.tsx** - Color picker menu
8. **ColorValueMenu.tsx** - Color value editor
9. **ContrastPicker.tsx** - Contrast checker

#### Modals

**Location:** `src/ui/components/Modals/`

1. **ModalContext.tsx** - Modal state management
2. **InputModal.tsx** - Generic text input modal
3. **ColorPickerModal.tsx** - Full color picker
4. **ColorReferenceModal.tsx** - Variable alias picker
5. **ShadesModal.tsx** - Shade generator
6. **StepsModal.tsx** - Step generator
7. **BulkEditModal.tsx** - JSON batch editor

#### Toolbar

**Location:** `src/ui/components/Toolbar/`

1. **Toolbar.tsx** - Main toolbar
2. **AddMenu.tsx** - Add variable/collection menu
3. **CollectionFilters.tsx** - Collection filter chips
4. **VariableTypeFilters.tsx** - Type filter buttons
5. **ModeSelector.tsx** - Mode dropdown

#### Tabs

**Location:** `src/ui/components/Tabs/`

1. **TabBar.tsx** - Tab navigation
   - Uses array-based loop to render tab buttons
   - Integrates with TabButton component
2. **TabButton.tsx** - Individual tab button component
   - Props: `label`, `isActive`, `onClick`
   - Used by TabBar in a `.map()` loop
3. **JsonEditor.tsx** - JSON import/export view
4. **SettingsView.tsx** - Settings panel

#### Relationships

**Location:** `src/ui/components/Relationships/`

1. **RelationshipsView.tsx** - Main graph view
2. **GroupedGraph.tsx** - Grouped node layout

#### Utility Components

**Location:** `src/ui/components/`

1. **Icons.tsx** - All icon components
2. **ResizeHandles.tsx** - Window resize UI

## Component Guidelines

### Before Creating a New Component

**ASK THESE QUESTIONS:**

1. ✅ **Does a similar component already exist?**
   - Check `common/` folder first
   - Check feature folders
   - Review this document

2. ✅ **Can I use/extend an existing component?**
   - Add a prop to existing component
   - Compose existing components
   - Create a variant of existing

3. ✅ **Is this component truly reusable?**
   - Used in 3+ places? → `common/`
   - Used in 1-2 places? → Feature folder
   - Used once? → Inline in parent

4. ✅ **Have I checked Storybook?**
   - Run `npm run storybook`
   - Browse existing components
   - See all variants and props

### Component Creation Rules

#### DO ✅

1. **Reuse existing components**
```tsx
// ✅ Good - compose existing
<FormGroup label="Name">
  <Input value={name} onChange={setName} />
</FormGroup>

// ❌ Bad - recreate
const NameInput = () => (
  <div className="form-group">
    <label>Name</label>
    <input value={name} onChange={(e) => setName(e.target.value)} />
  </div>
);
```

2. **Use TypeScript interfaces for props**
```tsx
export interface ButtonProps {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
}
```

3. **Export from index.ts**
```typescript
// common/Button/index.ts
export { Button } from './Button';
export type { ButtonProps } from './Button';
```

4. **Create Storybook stories for reusable components**
```tsx
// Button.stories.tsx
export default {
  title: 'Common/Button',
  component: Button,
};
```

5. **Write tests for common components**
```tsx
// Button.test.tsx
describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click</Button>);
    expect(screen.getByText('Click')).toBeInTheDocument();
  });
});
```

#### DON'T ❌

1. **Don't duplicate existing components**
```tsx
// ❌ Bad - Button already exists
const MyButton = ({ children }) => (
  <button className="btn">{children}</button>
);
```

2. **Don't create "wrapper" components unnecessarily**
```tsx
// ❌ Bad - just use Button directly
const SaveButton = () => <Button>Save</Button>;

// ✅ Good - compose at usage site
<Button onClick={handleSave}>Save</Button>
```

3. **Don't create components for single use**
```tsx
// ❌ Bad - only used once
const TableTitle = () => <h2 className="title">Variables</h2>;

// ✅ Good - inline
<h2 className="title">Variables</h2>
```

4. **Don't mix concerns in components**
```tsx
// ❌ Bad - UI + business logic
const VariableRow = () => {
  const saveToFigma = () => { /* ... */ };  // Business logic
  return <tr>{/* ... */}</tr>;
};

// ✅ Good - separate concerns
const VariableRow = ({ onSave }) => {  // UI only
  return <tr onClick={onSave}>{/* ... */}</tr>
};
```

### Component File Structure

```
ComponentName/
├── ComponentName.tsx         # Implementation
├── ComponentName.test.tsx    # Unit tests (for common components)
├── ComponentName.stories.tsx # Storybook stories (for common components)
└── index.ts                  # Exports
```

### Naming Conventions

- **Component files:** PascalCase (e.g., `Button.tsx`)
- **Component names:** PascalCase (e.g., `export function Button()`)
- **Props interfaces:** PascalCase with `Props` suffix (e.g., `ButtonProps`)
- **Event handlers:** camelCase with `handle` prefix (e.g., `handleClick`)
- **Boolean props:** Use `is`, `has`, `should` prefix (e.g., `isOpen`, `hasError`)

## State Management

### No External State Libraries

**DO NOT use:**
- ❌ Redux
- ❌ MobX
- ❌ Zustand
- ❌ Recoil

**DO use:**
- ✅ React useState
- ✅ React useReducer (for complex state)
- ✅ React Context (for shared state)
- ✅ Props drilling (for simple cases)

### State Location Rules

1. **Local state** - Component-specific
```tsx
const [isOpen, setIsOpen] = useState(false);
```

2. **Lifted state** - Shared between siblings
```tsx
// In parent
const [selectedMode, setSelectedMode] = useState('Light');

// Pass to children
<ModeSelector value={selectedMode} onChange={setSelectedMode} />
<TableView mode={selectedMode} />
```

3. **Context** - Shared across many components
```tsx
// ModalContext.tsx
export const ModalContext = createContext<ModalContextValue>({});

export function ModalProvider({ children }) {
  const [modals, setModals] = useState<Modal[]>([]);
  return (
    <ModalContext.Provider value={{ modals, setModals }}>
      {children}
    </ModalContext.Provider>
  );
}
```

4. **Plugin data** - Managed by Figma
```typescript
// In code.ts
const variables = figma.variables.getLocalVariables();
figma.ui.postMessage({ type: 'data-loaded', data: { variables } });
```

## Data Flow

### Unidirectional Data Flow

```
Figma API
    ↓
code.ts (Plugin sandbox)
    ↓ postMessage
App.tsx (Root component)
    ↓ props
Feature components
    ↓ props
Common components
```

### Update Flow

```
User interaction
    ↓
Event handler
    ↓
parent.postMessage({ type: 'update-variable', ... })
    ↓
code.ts receives message
    ↓
figma.variables.* API call
    ↓
Success/Error
    ↓
figma.ui.postMessage({ type: 'update-success' })
    ↓
UI updates
```

## Build Process

### Development
```bash
npm run dev
# Runs concurrently:
# 1. vite build --watch (UI)
# 2. tsc --watch (plugin)
```

### Production
```bash
npm run build
# 1. vite build → dist/index.html
# 2. tsc → dist/code.js
```

### Output Files

```
dist/
├── code.js          # Plugin sandbox code
└── index.html       # UI bundle (single file, ~534 KB, gzipped: 150 KB)
```

**Bundle includes:**
- React + React DOM
- @xyflow/react
- All components
- All styles (Tailwind + custom)
- No external dependencies

## Testing Strategy

See [TESTING.md](./TESTING.md) for complete testing guide.

**Summary:**
- **Unit tests** - Vitest + Testing Library (common components)
- **Visual tests** - Storybook (all common components)
- **Integration tests** - Manual testing in Figma
- **Type checking** - TypeScript compilation

## Resources

- [Figma Plugin API](https://www.figma.com/plugin-docs/)
- [React Documentation](https://react.dev/)
- [Component patterns](./COMPONENT_USAGE_EXAMPLES.md)
- [Testing guide](./TESTING.md)
