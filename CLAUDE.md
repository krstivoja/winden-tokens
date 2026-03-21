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
├── specs/             # AI specifications (markdown files)
├── docs/              # Jekyll website (compiled & published via GitHub Actions)
│   ├── _posts/        # Blog posts for changelog and updates
│   ├── _layouts/      # Jekyll layouts
│   ├── _config.yml    # Jekyll configuration
│   └── ...
├── dist/              # Build output for Figma plugin
└── ...
```

**Important:**
- The `docs/` folder contains the Jekyll website source (built via GitHub Actions)
- Blog posts go in `docs/_posts/` with format: `YYYY-MM-DD-title.md`
- The `specs/` folder contains AI specifications (features, guides, etc.)
- GitHub Actions compiles Jekyll and deploys to GitHub Pages automatically

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

## AI Specifications

All AI specifications are organized in the [specs/](specs/) folder:

### Component Documentation
- [COMPONENT_QUICK_START.md](specs/COMPONENT_QUICK_START.md) - Quick guide to component development
- [COMPONENTS_COMPLETE.md](specs/COMPONENTS_COMPLETE.md) - Complete component reference
- [COMPONENT_SUMMARY.md](specs/COMPONENT_SUMMARY.md) - Component summary and overview
- [COMPONENT_USAGE_EXAMPLES.md](specs/COMPONENT_USAGE_EXAMPLES.md) - Usage examples and patterns
- [TESTING.md](specs/TESTING.md) - Testing guide and conventions

### Feature & Release Documentation
- [Changelog.md](specs/Changelog.md) - Version history and release notes
- [FEATURES.md](specs/FEATURES.md) - Complete feature documentation and usage guide
- [RELEASE.md](specs/RELEASE.md) - Release process and versioning guidelines

### Storybook Documentation
- [STORYBOOK_QUICK_START.md](specs/STORYBOOK_QUICK_START.md) - Quick guide to Storybook setup
- [STORYBOOK_COMPONENTS.md](specs/STORYBOOK_COMPONENTS.md) - Component documentation for Storybook
- [STORYBOOK_AUTOMATION.md](specs/STORYBOOK_AUTOMATION.md) - Storybook automation workflows

**When working on this project, always review relevant specification files to understand:**
- Component structure and development patterns
- Testing approaches and conventions
- Existing features and their implementation
- Design decisions and architecture choices
- Release workflows and versioning strategy
- Storybook integration and component structure
