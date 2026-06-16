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
- RGB/HSL sliders
- Hex input
- Alpha channel
- Color history

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
4. **Single-file UI** - Must bundle everything inline

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
