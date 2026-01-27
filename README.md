# Winden Tokens

A Figma plugin for managing design tokens (variables) with a spreadsheet-style interface. Quickly create, edit, and organize your design system variables.

![Figma Plugin](https://img.shields.io/badge/Figma-Plugin-blueviolet)

## Features

<img width="1920" height="1080" alt="Cover 1" src="https://github.com/user-attachments/assets/7f332cbf-75f0-4858-a41a-2add6d7a3342" />

### Create shades
<img width="1920" height="1080" alt="Cover 2" src="https://github.com/user-attachments/assets/8ee45fd0-1e33-4efa-9792-9533a22b1f0b" />

### Scale ratio
<img width="1920" height="1080" alt="Cover 3" src="https://github.com/user-attachments/assets/087330a2-fcf1-44c8-a332-090d3a32dd8c" />

### Bulk editing
<img width="1920" height="1080" alt="Cover 4" src="https://github.com/user-attachments/assets/eaacdeaf-6509-46a3-8b6e-9226582ba3b3" />




- **Spreadsheet-style editing** - Edit variables inline with a familiar table interface
- **Search & filter** - Quickly find variables by name with instant search
- **Color picker** - Visual HSV color picker with saturation-value panel and hue slider
- **Color shades generator** - Generate color scales (50-950) with adjustable curves for lightness, saturation, and hue
- **Number steps generator** - Create spacing/sizing scales with preset ratios (minor third, golden ratio, etc.) and naming conventions (t-shirt sizes, numeric)
- **Color references** - Link colors to other variables for semantic token relationships
- **Multi-edit / CSV editor** - Edit groups as text, paste from spreadsheets with preview
- **Auto-sync** - Automatically detects and syncs changes made in Figma's native variables panel
- **JSON editor** - Bulk edit variables via JSON for power users
- **Variable types** - Support for Color, Number, String, and Boolean variables
- **Grouped variables** - Organize variables with path-based naming (e.g., `blue/500`)
- **Resizable window** - Drag any edge or corner to resize the plugin window

## Installation

### From Figma Community
1. Open Figma
2. Go to **Plugins** > **Browse plugins in Community**
3. Search for "Winden Tokens"
4. Click **Install**

### Development / Local Install
1. Clone this repository:
   ```bash
   git clone https://github.com/nicvlk/winden-tokens.git
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

### Creating Variables
1. Select a collection from the dropdown (or create a new one with the + button)
2. Click **Add Variable** and choose a type (Color, Number, String, Boolean)
3. Enter a name and value

### Editing Variables
- Click on any cell to edit the name or value
- For colors, click the color swatch to open the color picker or reference another color
- For booleans, use the True/False toggle buttons

### Search & Filter
- Use the search box in the toolbar to filter variables by name
- Results update instantly as you type

### Generating Color Shades
1. Click the **Shades** button in the toolbar
2. Select an existing color or enter a custom hex value
3. Adjust the curve for lightness, saturation, or hue using drag points
4. Set the number of shades and group name
5. Click **Generate** to create the shade palette

### Generating Number Steps
1. Click the **Steps** button in the toolbar
2. Select an existing number variable or set a base value
3. Choose a scale ratio (Minor Third, Golden Ratio, etc.)
4. Select a naming preset (T-shirt sizes, Numeric, Gutenberg) or define custom steps
5. Click **Generate** to create the scale

### Color References
1. Click a color cell and select **Reference Color**
2. Search and select another color variable
3. The color will now reference that variable (updates automatically)

### Multi-Edit (CSV Editor)
1. Click **Edit as Text** on any group header
2. Edit variables as text (one per line: `name, value`)
3. Paste directly from spreadsheets (tab or comma separated)
4. Preview changes before applying

### Grouping Variables
Name variables with forward slashes to create groups:
- `blue/50`, `blue/100`, `blue/200` will be grouped under "blue"
- Groups can be collapsed/expanded by clicking the group header

### JSON Editing
1. Switch to the **JSON** tab
2. Edit the JSON directly
3. Click **Update** to apply changes

## Build Commands

```bash
npm run build         # Build the plugin (UI + plugin code)
npm run dev           # Development mode with watch
npm run build:ui      # Build UI only
npm run build:plugin  # Build plugin code only
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
│       ├── index.html      # UI entry point
│       ├── main.ts         # Main UI logic
│       ├── state.ts        # State management
│       ├── components/     # UI components
│       ├── styles/         # SCSS styles
│       └── utils/          # Helper utilities
├── dist/                   # Build output
├── package.json
└── tsconfig.json
```

## Roadmap

See [TODO.md](TODO.md) for planned features including:
- Duplicate group functionality
- Contrast checker for accessibility
- Multi-mode support (Light/Dark themes)
- Export to CSS/Tailwind/JSON

## Author

Marko Krstic

## License

MIT
