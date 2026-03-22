# Plugin Functionality

This document describes what the Winden Tokens Figma plugin does, its features, and how it works.

## Overview

**Winden Tokens** is a Figma plugin for managing design tokens (Figma Variables) with advanced features like:
- Spreadsheet-style bulk editing
- Color shade generation
- Numeric scale generation
- Variable relationship visualization
- Contrast ratio checking
- JSON import/export

## Core Features

### 1. Variable Management

#### View & Edit Variables
- **Spreadsheet table view** - Edit variables like a spreadsheet
- **Multi-mode support** - Manage Light/Dark themes and other modes
- **Inline editing** - Click cells to edit names and values
- **Type support** - COLOR, FLOAT, STRING, BOOLEAN variables

#### Create Variables
- **Individual creation** - Add single variables via toolbar
- **Bulk creation** - Import multiple variables from JSON
- **Shade generation** - Generate color scales automatically
- **Step generation** - Generate numeric scales (spacing, sizing, etc.)

#### Delete & Duplicate
- **Bulk selection** - Select multiple variables at once
- **Quick actions** - Duplicate or delete selected variables
- **Safe deletion** - Shows warning before deleting

### 2. Collection Management

#### Organize Variables
- **Collection grouping** - Variables organized by collection
- **Mode management** - Create/edit/delete modes per collection
- **Collection filters** - Filter table by collection
- **Rename collections** - Edit collection names inline

#### Create Collections
- **New collections** - Create empty collections
- **Import collections** - Import with variables from JSON

### 3. Color Tools

#### Shade Generator
Generate color palettes with advanced controls:
- **Shade count** - 3 to 20 shades
- **Base index** - Position of source color (e.g., 500 in 100-900 scale)
- **Light/Dark values** - Control lightest and darkest shades
- **Bezier curves** - Fine-tune lightness, saturation, hue curves
- **Live preview** - See shades update in real-time
- **Persistent config** - Save curve settings per variable

**Usage:**
1. Select a COLOR variable
2. Click "Generate Shades" action
3. Configure shades (count, curves, etc.)
4. Preview generated shades
5. Apply to create new variables

#### Color Picker
Full-featured color picker with:
- **Visual picker** - HSV spectrum + alpha slider
- **Format support** - Hex, RGB, HSL, HSV
- **Eyedropper** - Pick colors from canvas (Figma API)
- **Recent colors** - Quick access to recently used
- **Opacity control** - Alpha channel slider

#### Color Reference Picker
Link colors to other variables:
- **Variable aliasing** - Reference another variable
- **Dropdown selection** - Choose from all COLOR variables
- **Live updates** - Changes propagate automatically

#### Contrast Checker
Check WCAG contrast ratios:
- **AA/AAA compliance** - Visual indicators for accessibility
- **Background picker** - Test against different backgrounds
- **Ratio display** - Exact contrast ratio shown
- **Inline in table** - Check contrast without opening modal

### 4. Numeric Tools

#### Step Generator
Generate numeric scales (spacing, sizing, typography):
- **Ratio presets** - Major Third (1.25), Perfect Fourth (1.33), Golden Ratio (1.618), etc.
- **Custom ratio** - Define your own multiplier
- **Step presets** - Common scales (4px, 8px, 100-900, etc.)
- **Custom steps** - Define specific step names
- **Base step** - Which step is the reference value
- **Bidirectional** - Generate steps above and below base

**Usage:**
1. Select a FLOAT variable (e.g., `spacing-md = 16`)
2. Click "Generate Steps"
3. Choose ratio (e.g., 1.5)
4. Choose steps (e.g., xs, sm, md, lg, xl)
5. Set base (e.g., md)
6. Apply to create: xs=7, sm=11, md=16, lg=24, xl=36

### 5. Relationships View

Visualize variable dependencies:
- **Interactive graph** - Node-based visualization using @xyflow/react
- **Reference tracking** - See which variables reference others
- **Grouping** - Collections shown in organized cards
- **Color-coded edges**:
  - Blue: Direct variable reference
  - Yellow: Shader-generated relationship
  - Red: To-be-deleted (when editing)
- **Interactive**:
  - Pan/zoom canvas
  - Click nodes to see details
  - Drag to rearrange

**Shows:**
- Variable aliases (A → B means A references B)
- Shade generations (parent → children)
- Cross-collection references
- Orphaned variables

### 6. JSON Editor

Import/export variables as JSON:

#### Export
```json
{
  "Collections": {
    "Primitives": {
      "Modes": ["Light", "Dark"],
      "Variables": {
        "color/blue/500": {
          "type": "COLOR",
          "values": {
            "Light": "#3b82f6",
            "Dark": "#60a5fa"
          }
        }
      }
    }
  }
}
```

#### Import
- **Merge mode** - Add to existing collections
- **Replace mode** - Overwrite collections
- **Validation** - Checks JSON structure before import
- **Error reporting** - Shows specific errors

### 7. Filtering & Search

#### Collection Filter
- **Multi-select** - Show variables from specific collections
- **Select all/none** - Quick toggles
- **Visual tags** - Collections shown as chips

#### Type Filter
- **COLOR** - Show only color variables
- **FLOAT** - Show only numeric variables
- **STRING** - Show only text variables
- **BOOLEAN** - Show only boolean variables
- **Multi-select** - Combine filters

#### Search (Planned)
- Name search
- Value search
- Filter by mode

### 8. Settings

Configure plugin behavior:
- **Theme switching** - Light/Dark mode (follows Figma)
- **Default mode** - Which mode to show first
- **Auto-save** - Save changes immediately vs on blur
- **Keyboard shortcuts** - Configure hotkeys

## User Interface

### Layout

```
┌─────────────────────────────────────────────┐
│ Toolbar                                     │
│ [+ Add] [Filters] [Mode Selector]           │
├─────────────────────────────────────────────┤
│ Tabs                                        │
│ [Table] [Relationships] [JSON] [Settings]   │
├─────────────────────────────────────────────┤
│                                             │
│ Main Content Area                           │
│                                             │
│ (Table / Graph / JSON / Settings)           │
│                                             │
│                                             │
└─────────────────────────────────────────────┘
```

### Table View

**Columns:**
1. **Collection** - Collection name (grouped)
2. **Name** - Variable name (editable)
3. **Type** - COLOR | FLOAT | STRING | BOOLEAN
4. **[Mode columns]** - One column per mode (editable)
5. **Actions** - Shade/Step generator, Contrast, Duplicate, Delete

**Features:**
- **Group headers** - Collections collapsible
- **Inline editing** - Click to edit
- **Color swatches** - Visual preview for colors
- **Type badges** - Color-coded badges
- **Hover actions** - Quick access to tools
- **Keyboard navigation** - Tab, Enter, Escape

### Modals

All modals share consistent UI:
- **Overlay** - Semi-transparent backdrop
- **Centered** - Modal centered on screen
- **Keyboard** - ESC to close, Enter to submit
- **Validation** - Inline error messages
- **Cancel/Submit** - Clear actions

**Modal Types:**
1. **Input Modal** - Single text input (rename, create)
2. **Color Picker Modal** - Color selection
3. **Color Reference Modal** - Variable alias selection
4. **Shades Modal** - Shade generation configuration
5. **Steps Modal** - Step generation configuration
6. **Bulk Edit Modal** - JSON batch update

## Message Protocol

### Plugin ↔ UI Communication

Plugin (code.ts) and UI (React) communicate via messages:

#### UI → Plugin Messages
```typescript
parent.postMessage({
  pluginMessage: {
    type: 'create-variable',
    data: { name, type, value, collectionId, modeId }
  }
}, '*');
```

**Message Types:**
- `refresh` - Reload all data
- `create-collection` - Create new collection
- `rename-collection` - Rename collection
- `delete-collection` - Delete collection
- `create-variable` - Create new variable
- `update-variable-name` - Rename variable
- `update-variable-value` - Change variable value
- `delete-variable` - Delete variable
- `duplicate-variable` - Clone variable
- `update-from-json` - Batch update from JSON
- `generate-shades` - Generate color shades
- `generate-steps` - Generate numeric steps

#### Plugin → UI Messages
```typescript
figma.ui.postMessage({
  type: 'data-loaded',
  data: { variables, collections }
});
```

**Message Types:**
- `data-loaded` - Initial data sent
- `changes-detected` - External changes detected
- `update-success` - Operation succeeded
- `update-error` - Operation failed
- `shade-preview` - Preview generated shades
- `step-preview` - Preview generated steps

### Change Detection

Plugin polls Figma every 2 seconds for external changes:
- Tracks data hash
- Detects variable additions/deletions/modifications
- Notifies UI to refresh
- Prevents overwriting user's in-progress edits

## Data Persistence

### Plugin Data
Variables are stored in Figma's native Variables API:
- Collections: `figma.variables.getLocalVariableCollections()`
- Variables: `figma.variables.getLocalVariables()`
- No custom storage needed - Figma handles it

### Generator Configs
Shade/Step configurations stored in `figma.root.setPluginData()`:
- `shade-config-{variableId}` - Shade generator settings
- `step-config-{variableId}` - Step generator settings
- Persists between plugin sessions
- Per-file storage (not global)

### UI State
UI state is ephemeral (not persisted):
- Active tab
- Filter selections
- Expanded groups
- Resets on plugin close

## Permissions

Required Figma permissions:
- **Read** - View variables and collections
- **Write** - Create/update/delete variables
- **Plugin data** - Store generator configs
- None required for:
  - Network access (all local)
  - File access
  - User data

## Performance

### Optimization Strategies
- **Polling** - Check changes every 2s (not on every Figma event)
- **Data hashing** - Only refresh if data actually changed
- **Virtual scrolling** - Large tables don't render all rows
- **Debounced inputs** - Wait for typing to finish before saving
- **Lazy loading** - Relationships graph only loads when viewed
- **Single-file bundle** - Vite bundles UI to one HTML file

### Constraints
- **Variable limit** - Figma supports 1000s of variables
- **Collection limit** - No practical limit
- **Mode limit** - 4 modes per collection (Figma limitation on Free plan)
- **UI size** - 750x500px default (resizable)

## Error Handling

### User-Facing Errors
- **Invalid input** - Inline validation messages
- **Duplicate names** - Warn before creating
- **API failures** - Toast notifications
- **JSON parse errors** - Specific error location

### Developer Errors
- **Console logging** - All errors logged to DevTools
- **Type safety** - TypeScript catches errors at build time
- **Graceful degradation** - Plugin doesn't crash on errors

## Browser Compatibility

Plugin runs in Figma Desktop (Chromium-based):
- **ES2020+** - Full support
- **No polyfills needed** - Modern JS features available
- **CSS Grid/Flexbox** - Full support
- **CSS Variables** - Full support

## Accessibility

- **Keyboard navigation** - Tab, Enter, Escape
- **Focus indicators** - Visible focus states
- **ARIA labels** - Screen reader support
- **Color contrast** - WCAG AA compliance
- **Focus trapping** - Modals trap focus

## Limitations

### Figma API Limitations
- **4 modes max** - On Free plan (unlimited on paid)
- **No variable groups** - Collections are the only grouping
- **No variable descriptions** - Figma doesn't support metadata
- **No undo/redo API** - Can't trigger Figma's undo

### Plugin Limitations
- **No remote sync** - All data stored locally in Figma file
- **No version control** - No built-in version history
- **No team collaboration** - Multiple users can conflict
- **No cloud backup** - Relies on Figma file backups

## Future Features (Potential)

- [ ] Variable search and filtering
- [ ] Bulk rename with regex
- [ ] Variable description support (when Figma adds it)
- [ ] Export to CSS/SCSS/JS
- [ ] Import from design tokens JSON (W3C standard)
- [ ] Variable usage tracking (where used in designs)
- [ ] Diff view (compare versions)
- [ ] Keyboard shortcuts customization
- [ ] Custom column ordering
- [ ] Column resizing
- [ ] Freeze columns
- [ ] Variable templates
- [ ] Formula support (calculated values)

## Resources

- [Figma Variables API](https://www.figma.com/plugin-docs/api/variables/)
- [Figma Plugin UI Guide](https://www.figma.com/plugin-docs/creating-ui/)
- [Design Tokens W3C](https://design-tokens.github.io/community-group/)
