# Tokens Manager

A Figma plugin for managing design tokens (variables) with a spreadsheet-style interface. Quickly create, edit, and organize your design system variables.

![Figma Plugin](https://img.shields.io/badge/Figma-Plugin-blueviolet)

## Features

- **Spreadsheet-style editing** - Edit variables inline with a familiar table interface
- **Search & filter** - Quickly find variables by name with instant search
- **Color picker** - Visual HSV color picker with saturation-value panel and hue slider
- **Color shades generator** - Generate color scales (50-950) from any base color
- **Multi-edit / CSV editor** - Edit groups as text, paste from spreadsheets
- **Auto-sync** - Automatically detects and syncs changes made in Figma's native variables panel
- **JSON editor** - Bulk edit variables via JSON for power users
- **Variable types** - Support for Color, Number, String, and Boolean variables
- **Grouped variables** - Organize variables with path-based naming (e.g., `blue/500`)
- **Resizable window** - Drag the corner to resize the plugin window

## Installation

### From Figma Community
1. Open Figma
2. Go to **Plugins** > **Browse plugins in Community**
3. Search for "Tokens Manager"
4. Click **Install**

### Development / Local Install
1. Clone this repository:
   ```bash
   git clone https://github.com/nicvlk/tokens-manager.git
   cd tokens-manager
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
- For colors, click the color swatch to open the color picker
- For booleans, use the True/False toggle buttons

### Search & Filter
- Use the search box in the toolbar to filter variables by name
- Results update instantly as you type

### Generating Color Shades
1. Click the **Shades** button
2. Select an existing color from the dropdown
3. Adjust lightness range and number of shades
4. Click **Generate** to create the shade palette

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
npm run dev           # Development mode with hot reload
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
- Create a ZIP package with `manifest.json` and `dist/` folder
- Create a GitHub release with the downloadable package
- Store build artifacts for 90 days

## Project Structure

```
tokens-manager/
├── manifest.json   # Figma plugin manifest
├── code.ts         # Plugin sandbox code (Figma API access)
├── ui.html         # Plugin UI (HTML/CSS/JS)
├── package.json    # Dependencies and scripts
└── tsconfig.json   # TypeScript configuration
```

## Roadmap

See [TODO.md](TODO.md) for planned features including:
- Duplicate group functionality
- Contrast checker for accessibility
- Multi-mode support (Light/Dark themes)
- Export to CSS/Tailwind/JSON

## License

MIT
