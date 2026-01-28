# Figma Plugin Refactoring Plan: Preact Migration

## Goal
Convert the current vanilla TypeScript codebase to Preact + Hooks while:
- Keeping **every feature, style, and icon exactly the same**
- Splitting files to 200-300 lines max
- Setting up a maintainable folder structure

---

## Current State

| File | Lines | Issue |
|------|-------|-------|
| `src/ui/main.ts` | 1,124 | God module - handles everything |
| `src/ui/components/shades.ts` | 774 | Complex but cohesive |
| `src/plugin/code.ts` | 719 | All Figma API logic |
| `src/ui/components/steps.ts` | 416 | Borderline |

**Total:** ~3,700 lines

---

## Framework Choice: React

**Why React for Figma plugins:**
- Largest ecosystem and community
- Most developers are already familiar with it
- Excellent TypeScript support
- Robust hooks system for state/logic separation
- Bundle size (~40KB) is negligible for plugins (loaded once, not on every page load)

---

## Phase 1: Build Setup

### New Dependencies
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0"
  }
}
```

### Updated vite.config.ts
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  root: 'src/ui',
  build: {
    outDir: '../../dist',
    emptyOutDir: false,
  },
})
```

### tsconfig.json Updates
```json
{
  "compilerOptions": {
    "jsx": "react-jsx"
  }
}
```

---

## Phase 2: New Folder Structure

```
src/
├── plugin/
│   ├── code.ts              # Entry point only (~50 lines)
│   ├── handlers/
│   │   ├── collections.ts   # Collection CRUD
│   │   ├── variables.ts     # Variable CRUD
│   │   ├── shades.ts        # Shade generation
│   │   ├── steps.ts         # Steps generation
│   │   └── json.ts          # JSON import/export
│   ├── utils/
│   │   ├── format.ts        # Value formatting
│   │   ├── order.ts         # Order persistence
│   │   └── aliases.ts       # Alias resolution
│   └── types.ts
│
├── ui/
│   ├── index.html           # Minimal HTML shell
│   ├── main.tsx             # App entry (~30 lines)
│   ├── App.tsx              # Root component (~100 lines)
│   │
│   ├── components/
│   │   ├── Toolbar/
│   │   │   ├── Toolbar.tsx
│   │   │   ├── SearchInput.tsx
│   │   │   └── AddMenu.tsx
│   │   ├── Table/
│   │   │   ├── Table.tsx
│   │   │   ├── TableRow.tsx
│   │   │   ├── GroupHeader.tsx
│   │   │   ├── ValueCell.tsx
│   │   │   └── ColorSwatch.tsx
│   │   ├── Tabs/
│   │   │   ├── TabBar.tsx
│   │   │   ├── TableTab.tsx
│   │   │   ├── JsonTab.tsx
│   │   │   ├── ShadesTab.tsx
│   │   │   └── StepsTab.tsx
│   │   ├── Modals/
│   │   │   ├── InputModal.tsx
│   │   │   ├── ColorRefModal.tsx
│   │   │   └── BulkEditModal.tsx
│   │   ├── Shades/
│   │   │   ├── ShadesPanel.tsx
│   │   │   ├── CurveEditor.tsx
│   │   │   ├── ColorPicker.tsx
│   │   │   └── ShadePreview.tsx
│   │   └── Steps/
│   │       ├── StepsPanel.tsx
│   │       ├── StepsList.tsx
│   │       └── StepPreview.tsx
│   │
│   ├── hooks/
│   │   ├── usePluginMessages.ts   # Message handler
│   │   ├── useVariables.ts        # Variables state
│   │   ├── useCollections.ts      # Collections state
│   │   ├── useTableNavigation.ts  # Arrow key navigation
│   │   ├── useDragReorder.ts      # Drag-drop logic
│   │   └── useResize.ts           # Window resize handles
│   │
│   ├── context/
│   │   └── AppContext.tsx         # Global state provider
│   │
│   ├── utils/
│   │   ├── color.ts               # Color conversions
│   │   ├── helpers.ts             # post(), esc()
│   │   └── icons.tsx              # SVG icons as components
│   │
│   ├── constants/
│   │   ├── shadePresets.ts        # Shade count presets
│   │   ├── stepPresets.ts         # Ratio presets
│   │   └── messages.ts            # Message type constants
│   │
│   ├── types/
│   │   ├── variables.ts
│   │   ├── messages.ts
│   │   └── shades.ts
│   │
│   └── styles/
│       └── global.css             # All existing CSS (extracted from HTML)
```

---

## Phase 3: Migration Strategy (One-to-One)

### Critical: Preserve Everything

1. **Extract CSS first** - Copy ALL styles from current code to global.css verbatim
2. **Extract icons** - Convert SVG strings to Preact components, keep exact paths
3. **Convert components bottom-up** - Start with leaves (ColorSwatch, icons), move up
4. **Preserve class names** - Keep all existing CSS class names
5. **Preserve message types** - No changes to plugin communication

### Migration Order

```
Step 1: Setup & Utilities
├── Install Preact, configure Vite
├── Extract CSS to global.css
├── Convert icons to components
├── Convert color.ts, helpers.ts
└── Create message types

Step 2: Simple Components
├── ColorSwatch
├── TypeIcon
├── Toolbar (without menus)
├── TabBar
└── InputModal

Step 3: Table Components
├── TableRow
├── GroupHeader
├── ValueCell
├── Table container
└── useTableNavigation hook

Step 4: Complex Features
├── ColorRefModal
├── BulkEditModal
├── useDragReorder hook
├── ColorPicker component
└── Full toolbar with menus

Step 5: Shades & Steps
├── CurveEditor (most complex)
├── ShadesPanel
├── StepsPanel
└── Integration testing

Step 6: Plugin Refactor
├── Split code.ts into handlers
├── Extract utilities
└── Final testing
```

---

## Phase 4: Component Conversion Example

### Before (vanilla): TableRow in table.ts
```typescript
function renderRow(variable: VariableData): string {
  return `
    <tr data-id="${variable.id}">
      <td class="name-cell">${esc(variable.displayName)}</td>
      <td class="value-cell">${formatValue(variable)}</td>
      <td class="actions">
        <button class="delete-btn">Delete</button>
      </td>
    </tr>
  `;
}
```

### After (React): TableRow.tsx
```tsx
import { VariableData } from '../../types/variables'
import { ValueCell } from './ValueCell'

interface Props {
  variable: VariableData
  onDelete: (id: string) => void
}

export function TableRow({ variable, onDelete }: Props) {
  return (
    <tr data-id={variable.id}>
      <td className="name-cell">{variable.displayName}</td>
      <ValueCell variable={variable} />
      <td className="actions">
        <button className="delete-btn" onClick={() => onDelete(variable.id)}>
          Delete
        </button>
      </td>
    </tr>
  )
}
```

---

## Phase 5: Hook Examples

### usePluginMessages.ts
```tsx
import { useEffect } from 'react'

export function usePluginMessages(handlers: Record<string, (data: any) => void>) {
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const { type, ...data } = event.data.pluginMessage || {}
      if (handlers[type]) {
        handlers[type](data)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [handlers])
}
```

### useTableNavigation.ts
```tsx
import { useState, useCallback } from 'react'

export function useTableNavigation(rows: string[]) {
  const [focusedRow, setFocusedRow] = useState<number>(-1)
  const [focusedCol, setFocusedCol] = useState<number>(0)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp':
        setFocusedRow(r => Math.max(0, r - 1))
        break
      case 'ArrowDown':
        setFocusedRow(r => Math.min(rows.length - 1, r + 1))
        break
      // ... rest of navigation
    }
  }, [rows.length])

  return { focusedRow, focusedCol, handleKeyDown }
}
```

---

## Phase 6: Testing Checklist

After each component migration, verify:

- [ ] Visual appearance matches exactly
- [ ] All click handlers work
- [ ] Keyboard navigation works
- [ ] Message passing works
- [ ] No console errors

### Full E2E Test Before Completion

1. **Create collection** - Name input, appears in dropdown
2. **Create variable (all 4 types)** - Color, Float, String, Boolean
3. **Edit variable name** - Double-click, type, Enter
4. **Edit variable value** - Inline editing works
5. **Color picker** - Opens, changes color, saves
6. **Color reference** - Can reference another color
7. **Delete variable** - Confirmation, removes from list
8. **Duplicate variable** - Creates copy with incremented name
9. **Drag reorder** - Variables can be reordered, persists
10. **Bulk edit** - CSV-like editing works
11. **Generate shades** - All presets work, curve editor works
12. **Generate steps** - All algorithms work
13. **JSON import** - Paste JSON, validates, applies
14. **Search** - Filters variables correctly
15. **Collapse/Expand groups** - Works correctly
16. **Arrow key navigation** - Full Excel-like behavior
17. **External changes** - Polling detects Figma changes
18. **Resize handles** - All 8 directions work

---

## Files to Modify

### Build Setup (Phase 1)
- `package.json` - Add Preact dependencies
- `vite.config.ts` - Add Preact plugin
- `tsconfig.json` - JSX settings

### New Files to Create
- All files in the new folder structure above

### Files to Eventually Delete (after migration)
- `src/ui/main.ts` - Replaced by React components
- `src/ui/components/shades.ts` - Split into Shades/
- `src/ui/components/steps.ts` - Split into Steps/
- `src/ui/components/table.ts` - Split into Table/
- `src/ui/components/modals.ts` - Split into Modals/
- `src/ui/components/colorPicker.ts` - Moved to Shades/

---

## Verification

After full migration, the following must be identical:
1. **UI appearance** - Screenshot comparison
2. **All interactions** - Feature-by-feature test
3. **Performance** - No visible lag
4. **Bundle size** - Should be similar or smaller

---

## Next Steps

1. Set up Preact build configuration
2. Extract CSS to global.css
3. Convert utilities (color, helpers, icons)
4. Begin component migration bottom-up
5. Test after each component
