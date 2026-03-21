# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run build      # Compile TypeScript to JavaScript
npm run watch      # Watch mode - recompile on changes
npm run lint       # Run ESLint
npm run lint:fix   # Run ESLint with auto-fix
```

After building, load the plugin in Figma via Plugins > Development > Import plugin from manifest.

## Project Structure

```
/                      # Root - plugin source code
├── docs/              # Project documentation (markdown files)
├── site/              # Jekyll GitHub Pages website (published separately)
├── dist/              # Build output for Figma plugin
└── ...
```

**Important:** The `site/` folder contains the Jekyll GitHub Pages website and should be kept separate from the plugin code. Do not mix plugin files with website files.

## Architecture

This is a Figma plugin for managing design tokens (variables). It uses a two-file architecture required by Figma plugins:

### code.ts (Plugin Sandbox)
Runs in Figma's plugin sandbox with access to the Figma API (`figma.*`). Handles:
- Variable CRUD operations via `figma.variables.*` API
- Collection management
- Polling for external changes (every 2 seconds)
- Message passing to/from UI

### ui.html (UI Layer)
Runs in an iframe with browser APIs. Contains all HTML, CSS, and JS inline. Features:
- Spreadsheet-style table for fast bulk editing
- JSON editor for batch updates
- Communicates with code.ts via `parent.postMessage()` / `figma.ui.postMessage()`

### Message Protocol
UI → Plugin messages: `parent.postMessage({ pluginMessage: { type, ...data } }, '*')`
Plugin → UI messages: `figma.ui.postMessage({ type, ...data })`

Key message types: `refresh`, `create-collection`, `create-variable`, `update-variable-name`, `update-variable-value`, `delete-variable`, `duplicate-variable`, `update-from-json`, `data-loaded`, `changes-detected`, `update-success`, `update-error`

## Variable Types

Figma supports 4 variable types: `COLOR`, `FLOAT`, `STRING`, `BOOLEAN`

Color values use Figma's 0-1 range internally (`{ r, g, b, a }`) but display as `rgb()/rgba()` strings in the UI.

## UI Conventions

- Any control that opens a dropdown menu should include the same downward triangle indicator (`▾`) used by the contrast controls, so menu-triggering actions are visually consistent.

## Project Documentation

All project documentation is organized in the [docs/](docs/) folder:

- [Changelog.md](docs/Changelog.md) - Version history and release notes
- [FEATURES.md](docs/FEATURES.md) - Complete feature documentation and usage guide
- [RELEASE.md](docs/RELEASE.md) - Release process and versioning guidelines
- [STORYBOOK_QUICK_START.md](docs/STORYBOOK_QUICK_START.md) - Quick guide to Storybook setup
- [STORYBOOK_COMPONENTS.md](docs/STORYBOOK_COMPONENTS.md) - Component documentation for Storybook
- [STORYBOOK_AUTOMATION.md](docs/STORYBOOK_AUTOMATION.md) - Storybook automation workflows

**When working on this project, always review relevant documentation files to understand:**
- Existing features and their implementation
- Design decisions and architecture choices
- Release workflows and versioning strategy
- Storybook integration and component structure
