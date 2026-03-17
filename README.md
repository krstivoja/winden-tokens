# Winden Tokens

A powerful Figma plugin for managing design tokens (variables) with advanced features for color generation, scale management, visual relationship editing, and bulk operations.

![Figma Plugin](https://img.shields.io/badge/Figma-Plugin-blueviolet)

## Features

<img width="1920" height="1080" alt="Cover 1" src="https://github.com/user-attachments/assets/7f332cbf-75f0-4858-a41a-2add6d7a3342" />

### Create shades
<img width="1920" height="1080" alt="Cover - Shades" src="https://github.com/user-attachments/assets/4f643f95-0d10-43f4-88a4-f7bc6fc3e60a" />

### Scale ratio
<img width="1920" height="1080" alt="Cover - Scale" src="https://github.com/user-attachments/assets/5e1f2af4-db22-4787-b85f-2edf14df4ffd" />

### Bulk editing
<img width="1920" height="1080" alt="Cover - Bulk Edit" src="https://github.com/user-attachments/assets/6607bdc9-8d1a-4c3d-a5c6-f6a8623159d3" />

### Nodes
<img width="1920" height="1080" alt="Cover - Nodes" src="https://github.com/user-attachments/assets/56ba62b0-4d8b-4041-bc63-8bba162331bb" />

### Contrast checker
<img width="1920" height="1080" alt="Cover - Contrast checker" src="https://github.com/user-attachments/assets/ba86420b-6cb1-4af3-b355-f9862914ce7f" />

## Core Features

### Spreadsheet-Style Editing
- **Inline editing** - Edit variables directly in a familiar table interface
- **Collection selector** - Move individual variables or entire groups between collections via dropdown
- **Multi-mode support** - Switch between modes (Light/Dark) with global mode selector
- **Search & filter** - Instantly find variables by name or filter by type (Color, Number, String, Boolean)
- **Auto-sync** - Automatically detects and syncs changes made in Figma's native variables panel (2-second polling)

### Color Management
- **Color shades generator** - Generate complete shade palettes (50-950) from any base color
  - Advanced Bezier curve editor for lightness, saturation, and hue control
  - Real-time preview of generated shades
  - Managed shades with automatic refresh when source color changes
- **Color picker** - Visual HSV color picker with saturation-value panel and hue slider
- **Color references** - Link colors to other variables using `{variableName}` syntax for semantic tokens
- **Contrast checker** - WCAG 2.1 compliance verification
  - Set contrast color per variable or per group
  - Real-time contrast ratio calculation (AA/AAA badges)
  - Pick custom colors or reference other variables

### Number Scale Generation
- **Number steps generator** - Create spacing/sizing scales with mathematical precision
  - Preset ratios: Minor Third (1.2), Major Third (1.25), Perfect Fourth (1.333), Golden Ratio (1.618), and more
  - Preset naming conventions: T-shirt sizes (xs-4xl), Numeric (1-10), Gutenberg, or fully custom
  - Reference existing number variables as base values
  - Managed steps with automatic refresh when base value changes

### Visual Relationship Editing
- **Node Colors** - Interactive graph for color variable relationships
  - Visual node layout showing all color variables and their connections
  - Drag from output to input points to create variable aliases
  - Click connections to remove references
  - Group-based organization with collapsible sections
  - Pan/zoom controls with mouse and keyboard shortcuts
- **Node Numbers** - Same powerful interface for numeric (FLOAT) variables
  - Visualize spacing, sizing, and typography scale relationships
  - Create and manage number variable aliases visually
  - Trace dependencies at a glance

### Bulk Operations
- **Multi-edit / CSV editor** - Edit groups as text
  - One variable per line format: `name, value`
  - Paste directly from spreadsheets (tab or comma separated)
  - Preview changes before applying
  - Perfect for importing existing token sets
- **JSON editor** - Power user interface for batch updates
  - Edit all variables as JSON
  - Import/export entire token sets
  - Schema validation

### Organization
- **Grouped variables** - Path-based naming (e.g., `blue/500`, `spacing/md`)
  - Automatic grouping by forward-slash prefixes
  - Collapse/expand groups by clicking headers
  - Bulk operations on entire groups
  - Move entire groups between collections
- **Collection management** - Create and organize multiple collections
  - Filter by collection(s) using checkboxes
  - Move variables between collections with dropdown in table
  - Duplicate variables across collections

### Settings & Presets
- **Import presets** - Quick-start templates
  - Basic tokens (primary, secondary, neutral colors + base font sizes)
  - Full design system tokens
  - Delete all variables for fresh start
- **Multi-mode collections** - Support for Light/Dark themes and responsive breakpoints

## Variable Types

Supports all Figma variable types:
- **COLOR** — Displayed as rgb()/rgba() in UI, stored as Figma's 0-1 range internally
- **FLOAT** — Numeric values for spacing, sizing, typography
- **STRING** — Text values
- **BOOLEAN** — True/False toggle buttons

## Installation

### From Figma Community
1. Open Figma
2. Go to **Plugins** > **Browse plugins in Community**
3. Search for "Winden Tokens"
4. Click **Install**

### Development / Local Install
1. Clone this repository:
   ```bash
   git clone https://github.com/krstivoja/winden-tokens.git
   cd winden-tokens
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the plugin:
   ```bash
   npm run build
   ```

4. Import into Figma:
   - Open Figma Desktop
   - Go to **Plugins** > **Development** > **Import plugin from manifest...**
   - Select the `manifest.json` file from this folder

## Usage

### Table View

#### Creating Variables
1. Select a collection from the dropdown (or create a new one with the + button)
2. Click **Add Variable** and choose a type (Color, Number, String, Boolean)
3. Enter a name and value

#### Editing Variables
- Click on any cell to edit the name or value
- For colors, click the color swatch to open the color picker or reference another color
- For booleans, use the True/False toggle buttons
- Use the **Collection** column dropdown to move variables between collections

#### Moving Variables Between Collections
- **Individual variables**: Click the Collection dropdown in any row
- **Entire groups**: Click the Collection dropdown in the group header row
- All variables in the group will move together

#### Search & Filter
- Use the search box in the toolbar to filter variables by name
- Click variable type icons (Color, Float, String, Boolean) to filter by type
- Use collection checkboxes to show/hide variables from specific collections
- Results update instantly as you type

### Generating Color Shades
1. Click the **Shades** button on any ungrouped color variable row
2. Adjust the curve for lightness, saturation, or hue using drag points
   - Click "Add Point" to add control points to the Bezier curve
   - Drag points to adjust the curve shape
   - Click "Remove Point" when hovering over a point to delete it
3. Set the number of shades and group name
4. Click **Generate** to create the shade palette
5. Generated shades are "managed" - if you change the source color and click Shades again, click **Refresh** to update all shades

### Generating Number Steps
1. Click the **Steps** button on any ungrouped number variable row
2. Select an existing number variable as base reference (optional)
3. Choose a scale ratio from presets or enter custom value
4. Choose a naming convention:
   - **T-shirt sizes**: xs, sm, md, lg, xl, 2xl, 3xl, 4xl
   - **Numeric**: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
   - **Gutenberg**: Predefined spacing scale
   - **Custom**: Define your own step names
5. Click **Generate** to create the scale
6. Generated steps are "managed" - they track changes to the base reference value

### Color References & Aliases
1. Click a color cell and select **Reference Color**
2. Search and select another color variable
3. The color will now reference that variable as `{variableName}`
4. Reference updates automatically when the source color changes
5. In Node Colors view, references show as visual connections

### Contrast Checking
**For individual variables:**
1. Click **Contrast** in the accessibility column
2. Choose **Pick Color** for custom color or **Reference Color** for variable
3. View real-time contrast ratio with AA/AAA badges
4. Click **Clear** to remove contrast color

**For groups:**
1. Click **Contrast** in the group header row
2. All variables in the group will use the same contrast color
3. Perfect for checking a color palette against a common background

### Multi-Edit (CSV Editor)
1. Click **Edit as Text** on any group header (appears on hover)
2. Edit variables as text (one per line: `name, value`)
3. Paste directly from spreadsheets (tab or comma separated)
4. Preview shows what will be added/updated/deleted
5. Click **Update** to apply changes

### Grouping Variables
Name variables with forward slashes to create groups:
- `blue/50`, `blue/100`, `blue/200` will be grouped under "blue"
- `spacing/xs`, `spacing/sm`, `spacing/md` will be grouped under "spacing"
- Groups can be collapsed/expanded by clicking the group header
- Click the Collection dropdown in group header to move all variables at once

### Node Colors View
1. Switch to the **Node Colors** tab
2. View all color variables as nodes with connection points
3. **Create reference**: Drag from a variable's output point (right) to another's input point (left)
4. **Remove reference**: Click on the connection line
5. **Organize**: Drag group headers to rearrange layout
6. **Navigate**:
   - Mouse wheel or trackpad to zoom
   - Shift + drag to pan
   - Keyboard: +/- to zoom, arrows to pan

### Node Numbers View
1. Switch to the **Node Numbers** tab
2. Same interface as Node Colors, but for FLOAT variables
3. Visualize spacing scales, typography progressions, sizing systems
4. Create and manage numeric variable references visually

### JSON Editing
1. Switch to the **JSON** tab
2. Edit the JSON directly (all variables in selected collection(s))
3. Click **Update** to apply changes
4. Great for batch imports or syncing with external tools

### Settings
1. Switch to the **Settings** tab
2. **Import Preset**:
   - **Basic Tokens**: Imports starter color palette and font sizes
   - **Delete All**: Removes all variables from current collection (destructive!)
3. **Multi-mode support**:
   - Collections with multiple modes show mode selector in toolbar
   - Switch modes to edit values for Light/Dark themes or responsive breakpoints

## Build Commands

```bash
npm run build         # Build the plugin (UI + plugin code)
npm run watch         # Development mode with watch
npm run lint          # Run ESLint
npm run lint:fix      # Run ESLint with auto-fix
```

## Releasing

This project uses GitHub Actions for automated builds and releases.

### Creating a Release

1. **Tag-based release** (recommended):
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
   This will automatically trigger the release workflow.

2. **Manual release**:
   - Go to **Actions** tab in GitHub
   - Select **Build and Release** workflow
   - Click **Run workflow**
   - Enter the version (e.g., `v1.0.0`)

The workflow will:
- Build the plugin
- Create a ZIP package with `manifest.json`, `icon.png`, and `dist/` folder
- Create a GitHub release with the downloadable package
- Store build artifacts for 90 days

## Project Structure

```
winden-tokens/
├── manifest.json           # Figma plugin manifest
├── icon.png                # Plugin icon (128x128)
├── src/
│   ├── plugin/
│   │   └── code.ts         # Plugin sandbox code (Figma API)
│   └── ui/
│       ├── components/     # React components
│       │   ├── Table/      # Spreadsheet table view
│       │   ├── Modals/     # Shades, Steps, ColorPicker, etc.
│       │   ├── Relationships/  # Node Colors/Numbers view
│       │   └── Toolbar/    # Top toolbar with filters
│       ├── context/        # React context (AppContext)
│       ├── styles/         # SCSS styles
│       ├── utils/          # Helper utilities
│       ├── types.ts        # TypeScript types
│       └── App.tsx         # Main app component
├── dist/                   # Build output
├── CLAUDE.md              # Build instructions for Claude Code
├── FEATURES.md            # Detailed feature documentation
└── README.md              # This file
```

## Architecture

This is a Figma plugin using a two-file architecture required by Figma:

### code.ts (Plugin Sandbox)
Runs in Figma's plugin sandbox with access to the Figma API (`figma.*`). Handles:
- Variable CRUD operations via `figma.variables.*` API
- Collection management
- Polling for external changes (every 2 seconds)
- Message passing to/from UI

### ui.html (UI Layer)
Runs in an iframe with browser APIs. Contains React app with:
- Spreadsheet-style table for fast bulk editing
- Node graph editor (React Flow) for visual relationship editing
- Modals for shades, steps, color picker, etc.
- JSON editor for batch updates
- Communicates with code.ts via `parent.postMessage()` / `figma.ui.postMessage()`

## Keyboard Shortcuts

### Node Views (Colors/Numbers)
- **+/-** - Zoom in/out
- **0** - Reset zoom to 100%
- **Arrow keys** - Pan view
- **Shift + Drag** - Pan with mouse

## Tips & Best Practices

1. **Use semantic naming**: Create primitive tokens (e.g., `blue/500`) and semantic tokens (e.g., `primary` → `{blue/500}`)
2. **Leverage grouping**: Use forward slashes in names to auto-group related variables
3. **Managed shades**: After generating shades, you can update the source color and refresh all shades at once
4. **Contrast checking**: Set a contrast color for color groups to quickly verify all shades meet accessibility standards
5. **Node views**: Use Node Colors/Numbers to understand and debug complex token relationships
6. **CSV import**: Paste from spreadsheets for quick bulk token creation
7. **Multi-mode**: Use modes for Light/Dark themes or responsive breakpoints (mobile/tablet/desktop)

## Author

Marko Krstic

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Links

- **GitHub**: https://github.com/krstivoja/winden-tokens
- **Issues**: https://github.com/krstivoja/winden-tokens/issues
- **Figma Community**: [Coming soon]
