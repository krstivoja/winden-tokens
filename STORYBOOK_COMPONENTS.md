# Winden Tokens - Storybook Component Documentation

This document provides an overview of all Storybook stories created for the Winden Tokens Figma plugin.

## 📚 Story Organization

```
Foundation/
  └─ Icons                    (IconsGallery.stories.tsx)

Components/
  ├─ Toolbar                  (Toolbar.stories.tsx)
  ├─ TabBar                   (TabBar.stories.tsx)
  ├─ Modals/
  │   ├─ InputModal          (Modals.stories.tsx)
  │   ├─ ColorPickerModal    (Modals.stories.tsx)
  │   ├─ ShadesModal         (Modals.stories.tsx)
  │   └─ StepsModal          (Modals.stories.tsx)
  └─ Toolbar/
      ├─ AddMenu             (ToolbarComponents.stories.tsx)
      ├─ CollectionFilters   (ToolbarComponents.stories.tsx)
      ├─ ModeSelector        (ToolbarComponents.stories.tsx)
      └─ VariableTypeFilters (ToolbarComponents.stories.tsx)

Views/
  ├─ Table                    (TableView.stories.tsx)
  ├─ Relationships            (RelationshipsView.stories.tsx)
  └─ Tabs/
      ├─ JsonEditor          (TabComponents.stories.tsx)
      └─ SettingsView        (TabComponents.stories.tsx)
```

## 📖 Story Files

### 1. IconsGallery.stories.tsx
**Path:** `src/ui/stories/IconsGallery.stories.tsx`
**Category:** Foundation/Icons

Showcases all icons used throughout the plugin:
- **Type Icons:** COLOR, FLOAT, STRING, BOOLEAN
- **Action Icons:** Plus, Close, Refresh, Undo, Redo, Expand, Collapse, ChevronDown, Shades, Steps, Copy, Trash, Search, Edit, Folder, Relationships

**Stories:**
- `Gallery` - Complete icon gallery view

---

### 2. Toolbar.stories.tsx
**Path:** `src/ui/stories/Toolbar.stories.tsx`
**Category:** Components/Toolbar

Main toolbar component with search, filters, and action buttons.

**Stories:**
- `Default` - Default state with no status
- `WithWarning` - Warning status (e.g., "Changes detected - click Refresh")

**Features:**
- Search input
- Collection filters
- Variable type filters
- Mode selector
- Add variable/collection buttons

---

### 3. TabBar.stories.tsx
**Path:** `src/ui/stories/TabBar.stories.tsx`
**Category:** Components/TabBar

Tab navigation with action buttons (Refresh, Undo, Redo, Expand/Collapse).

**Stories:**
- `Default` - Interactive tab switching
- `TableTabActive` - Table tab selected
- `NodeColorsTabActive` - Node Colors tab selected
- `JSONTabActive` - JSON tab selected
- `SettingsTabActive` - Settings tab selected
- `WithUndoDisabled` - Undo button disabled
- `WithRedoDisabled` - Redo button disabled
- `WithBothUndoRedoDisabled` - Both disabled

**Tabs:**
- Table
- Node Colors
- Node Numbers
- JSON
- Settings

---

### 4. Modals.stories.tsx
**Path:** `src/ui/stories/Modals.stories.tsx`
**Category:** Components/Modals

Modal dialogs for user input and color picking.

#### InputModal Stories:
- `CreateCollection` - Modal for creating new collections
- `CreateVariable` - Modal for creating new variables
- `RenameItem` - Modal for renaming items

#### ColorPickerModal Stories:
- `PickRed` - Color picker initialized with red (#ff0000)
- `PickBlue` - Color picker initialized with blue (#0000ff)
- `PickGreen` - Color picker initialized with green (#00ff00)
- `PickWhite` - Color picker initialized with white (#ffffff)
- `PickBlack` - Color picker initialized with black (#000000)
- `PickPurple` - Color picker initialized with purple (#8b5cf6)

**ColorPicker Features:**
- SV (Saturation/Value) panel with drag interaction
- Hue slider
- HEX/RGB/HSL input modes
- Real-time color preview

#### ShadesModal Stories:
- `GenerateShades` - Opens shade generator modal
- `GenerateShadesForGroup` - Opens with pre-selected group (primary)

**Shades Generator Features:**
- Interactive curve editor for lightness, saturation, and hue adjustments
- Drag bezier curve handles to customize shade progression
- Live shade preview with color swatches
- Base color selection with color picker integration
- Configurable shade count (2-20 shades)
- Three independent curves: Lightness, Saturation, Hue
- Reset buttons for each curve property
- Update or remove existing shade groups
- Visual feedback for base shade position
- Grid overlay for precise positioning

#### StepsModal Stories:
- `GenerateSteps` - Opens steps calculator modal
- `GenerateStepsForGroup` - Opens with pre-selected group (spacing)

**Steps Calculator Features:**
- Ratio-based scale generation (Minor Second 1.125, Golden Ratio 1.618, etc.)
- Pre-configured step presets:
  - T-shirt sizing (xs, sm, md, lg, xl, 2xl, 3xl, 4xl)
  - Numeric (1-10)
  - Gutenberg (xs-ultra)
  - Custom step names
- Drag-to-reorder steps functionality
- Base step selection with variable reference support
- Individual step value override
- Reset individual steps to calculated values
- Add/delete steps dynamically
- Update or remove existing step groups
- Real-time value calculation preview

---

### 5. ToolbarComponents.stories.tsx
**Path:** `src/ui/stories/ToolbarComponents.stories.tsx`
**Category:** Components/Toolbar

Individual toolbar sub-components.

#### AddMenu:
- `Default` - Dropdown menu for adding variables (COLOR, FLOAT, STRING, BOOLEAN)

#### CollectionFilters:
- `CollectionFiltersDefault` - Multi-select collection filter dropdown

#### ModeSelector:
- `ModeSelectorDefault` - Mode selection dropdown (Light/Dark/etc.)

#### VariableTypeFilters:
- `VariableTypeFiltersDefault` - Type filter toggles

---

### 6. TableView.stories.tsx
**Path:** `src/ui/stories/TableView.stories.tsx`
**Category:** Views/Table

Main spreadsheet-style table for managing design tokens.

**Stories:**
- `Default` - Full table view with all features

**Features:**
- Editable variable names and values
- Grouping and collapsing
- Contrast ratio checking (WCAG AA/AAA)
- Generate shades/steps
- Duplicate/delete actions
- Collection display
- Type icons

**Components Included:**
- TableRow
- GroupHeader
- ValueCell
- CollectionCell
- ContrastPicker

---

### 7. RelationshipsView.stories.tsx
**Path:** `src/ui/stories/RelationshipsView.stories.tsx`
**Category:** Views/Relationships

Interactive graph visualization of variable relationships.

**Stories:**
- `Colors` - Color variable relationships
- `Numbers` - Number variable relationships

**Features:**
- D3-based graph visualization
- Drag nodes to create connections
- Click to remove connections
- Stats overlay

---

### 8. TabComponents.stories.tsx
**Path:** `src/ui/stories/TabComponents.stories.tsx`
**Category:** Views/Tabs

Content views for different tabs.

#### JsonEditor:
- `Default` - JSON editor with current data
- `WithMockData` - JSON editor with mock data

**Features:**
- Syntax-highlighted JSON textarea
- Format button
- Update button
- Error state highlighting

#### SettingsView:
- `SettingsDefault` - Settings with Figma theme (auto)
- `LightTheme` - Settings with light theme selected
- `DarkTheme` - Settings with dark theme selected
- `FigmaTheme` - Settings following Figma's theme

**Settings Sections:**
- **Appearance:** Theme mode selector (Follow Figma, Light, Dark)
- **Danger Zone:** Delete all variables button
- **Import Presets:** Quick import buttons (Tailwind CSS, Basic Tokens)

---

## 🎨 Component Coverage

### Total Components Documented: 33+

**Context/Providers:**
- AppContext
- ModalContext

**Layout:**
- Toolbar
- TabBar
- ResizeHandles

**Table:**
- TableView
- TableRow
- GroupHeader
- ValueCell
- CollectionCell
- GroupCollectionCell
- ColorValueMenu
- ContrastPicker

**Toolbar Sub-components:**
- AddMenu
- CollectionFilters
- VariableTypeFilters
- ModeSelector

**Tabs:**
- JsonEditor
- SettingsView
- RelationshipsView
- GroupedGraph

**Modals:**
- InputModal
- ColorPickerModal
- ColorReferenceModal
- ShadesModal
- StepsModal
- BulkEditModal

**Icons:**
- TypeIcons (COLOR, FLOAT, STRING, BOOLEAN)
- 16+ Action Icons

---

## 🚀 Running Storybook

### Development Mode:
```bash
npm run storybook
```
Opens at: http://localhost:6006

### Build Static Version:
```bash
npm run build-storybook
```
Output: `storybook-static/`

### Serve Built Version:
```bash
npx http-server storybook-static
```

---

## 🔧 Technical Details

### Decorators Used:
- **AppProvider** - Provides global application context
- **ModalProvider** - Provides modal state management
- Custom wrappers for layout and styling

### Interactive Features:
- Real-time state updates
- Form validation
- Mouse drag interactions (color picker, graph)
- Keyboard shortcuts (Enter, Escape)
- Dropdown menus with click-outside detection

### Styling:
- CSS-in-JS via inline styles
- CSS classes from main plugin stylesheet
- Responsive layouts
- Dark/light theme support

---

## 📝 Notes

1. **Context Requirements:** Most components require `AppProvider` and/or `ModalProvider` wrappers to function properly.

2. **Plugin Communication:** Components that normally communicate with the Figma plugin sandbox (`post()` calls) will log to console in Storybook.

3. **Mock Data:** TableView and JsonEditor use live context data. To see populated views, mock data can be added to the AppContext provider.

4. **Icon System:** All icons are SVG-based React components with currentColor support for theming.

5. **Accessibility:** Components include WCAG contrast checking, keyboard navigation, and ARIA attributes.

---

## 🎯 Use Cases

### For Developers:
- Component API documentation
- Visual regression testing
- Interactive development environment
- Isolated component testing

### For Designers:
- Design system reference
- Component behavior documentation
- UI consistency verification
- Theme/style exploration

### For QA:
- Visual testing scenarios
- State combinations
- Edge case exploration
- Cross-browser testing

---

## 📦 Build Output

**Latest Build:**
- Modules: 405
- Build time: ~5 seconds
- Output size: 3.2 MB (959 KB gzipped)
- Format: Static HTML/JS/CSS

**Browser Support:**
- Modern browsers (ES2015+)
- Chrome, Firefox, Safari, Edge

---

## 🔗 Related Files

- **Storybook Config:** `.storybook/main.ts`
- **Preview Config:** `.storybook/preview.ts`
- **Mock Data:** `src/ui/stories/mockData.ts`
- **Component Source:** `src/ui/components/`

---

**Last Updated:** March 21, 2025
**Storybook Version:** 10.3.1
**Plugin Version:** 1.0.0
