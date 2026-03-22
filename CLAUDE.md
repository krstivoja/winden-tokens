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

### Core Documentation (MUST READ FIRST)
- [TECH_STACK.md](specs/TECH_STACK.md) - **Technology stack, dependencies, and version constraints**
- [ARCHITECTURE.md](specs/ARCHITECTURE.md) - **Plugin architecture and complete component inventory**
- [STYLING.md](specs/STYLING.md) - **Styling approach, Tailwind v4 usage, and design tokens**
- [PLUGIN_FUNCTIONALITY.md](specs/PLUGIN_FUNCTIONALITY.md) - **What the plugin does and how it works**
- [TESTING.md](specs/TESTING.md) - **Testing guide and conventions**

### Component Documentation
- [COMPONENT_QUICK_START.md](specs/COMPONENT_QUICK_START.md) - Quick guide to component development
- [COMPONENTS_COMPLETE.md](specs/COMPONENTS_COMPLETE.md) - Complete component reference
- [COMPONENT_SUMMARY.md](specs/COMPONENT_SUMMARY.md) - Component summary and overview
- [COMPONENT_USAGE_EXAMPLES.md](specs/COMPONENT_USAGE_EXAMPLES.md) - Usage examples and patterns

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

## Mandatory Update Rules

**CRITICAL: You MUST update specifications whenever you make changes to the codebase.**

### When to Update Specifications

#### Update TECH_STACK.md when:
- ✅ Adding or removing a dependency from package.json
- ✅ Updating a major/minor version of any dependency
- ✅ Changing build tools or configuration (Vite, TypeScript, etc.)
- ✅ Modifying the build process or scripts
- ✅ Adding new technology or framework

**How to update:**
1. Read the current [TECH_STACK.md](specs/TECH_STACK.md)
2. Update the relevant sections with changes
3. Update version numbers to match package.json
4. Add new dependencies to appropriate sections
5. Remove deprecated/deleted dependencies

#### Update ARCHITECTURE.md when:
- ✅ Creating a new component
- ✅ Deleting a component
- ✅ Moving a component to a different folder
- ✅ Changing component props or interfaces
- ✅ Modifying the plugin architecture
- ✅ Adding new file structure or folders

**How to update:**
1. Read the current [ARCHITECTURE.md](specs/ARCHITECTURE.md)
2. Add new components to the "Component Inventory" section
3. Update the component list with accurate file paths
4. Update props interfaces if they changed
5. Remove deleted components from the inventory

#### Update STYLING.md when:
- ✅ Adding new design tokens (CSS variables)
- ✅ Changing Tailwind configuration
- ✅ Adding custom Tailwind utilities
- ✅ Modifying the styling approach
- ✅ Adding new CSS files or reorganizing styles

**How to update:**
1. Read the current [STYLING.md](specs/STYLING.md)
2. Add new design tokens to the CSS variables section
3. Update [tailwind.plugin.css](src/tailwind.plugin.css) examples
4. Document new styling patterns
5. Update file organization if structure changed

#### Update PLUGIN_FUNCTIONALITY.md when:
- ✅ Adding new features to the plugin
- ✅ Removing or deprecating features
- ✅ Changing how existing features work
- ✅ Modifying the message protocol
- ✅ Adding new UI views or modals

**How to update:**
1. Read the current [PLUGIN_FUNCTIONALITY.md](specs/PLUGIN_FUNCTIONALITY.md)
2. Add new features to appropriate sections
3. Update feature descriptions if behavior changed
4. Document new message types in the protocol
5. Move completed features out of "Future Features"

#### Update TESTING.md when:
- ✅ Changing testing approach or tools
- ✅ Adding new test patterns
- ✅ Updating test file structure
- ✅ Modifying test scripts

### Storybook Update Rules

**CRITICAL: You MUST update Storybook stories when creating or modifying components.**

#### When to Create/Update Storybook Stories:

**ALWAYS create stories for:**
- ✅ New components in `src/ui/components/common/` (reusable UI components)
- ✅ Components with multiple variants or states
- ✅ Components with complex props

**Update stories when:**
- ✅ Adding new props to a component
- ✅ Adding new variants (e.g., new button style)
- ✅ Changing component behavior or appearance
- ✅ Fixing component bugs that affect visual output

**Story file naming:**
```
ComponentName/
├── ComponentName.tsx
├── ComponentName.stories.tsx  ← MUST create for common components
└── ComponentName.test.tsx     ← MUST create for common components
```

**Example story structure:**
```tsx
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Common/Button',
  component: Button,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Primary Button',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary Button',
  },
};

export const Danger: Story = {
  args: {
    variant: 'danger',
    children: 'Danger Button',
  },
};
```

#### Running Storybook

**During development:**
```bash
npm run storybook
# Opens http://localhost:6006
# Auto-reloads when stories change
```

**Before committing:**
```bash
npm run build-storybook
# Builds static Storybook to verify no errors
```

### Update Workflow Example

**Scenario: Adding a new "Toggle" component**

1. **Create the component**
   ```bash
   src/ui/components/common/Toggle/
   ├── Toggle.tsx
   ├── Toggle.stories.tsx  ← CREATE
   ├── Toggle.test.tsx     ← CREATE
   └── index.ts
   ```

2. **Update ARCHITECTURE.md**
   ```markdown
   #### 11. Toggle
   **File:** `common/Toggle/Toggle.tsx`

   **Props:**
   ```typescript
   interface ToggleProps {
     checked: boolean;
     onChange: (checked: boolean) => void;
     label?: string;
     disabled?: boolean;
   }
   ```

   **Usage:**
   ```tsx
   <Toggle checked={enabled} onChange={setEnabled} label="Enable feature" />
   ```
   ```

3. **Update common/index.ts**
   ```typescript
   export { Toggle } from './Toggle';
   export type { ToggleProps } from './Toggle';
   ```

4. **Create Storybook story**
   ```tsx
   // Toggle.stories.tsx
   export const Default: Story = {
     args: { checked: false, label: 'Toggle me' }
   };
   ```

5. **Test in Storybook**
   ```bash
   npm run storybook
   # Verify Toggle appears in Storybook
   # Test all variants visually
   ```

6. **Verify build**
   ```bash
   npm run build-storybook
   # Ensure no build errors
   ```

### Verification Checklist

Before committing changes, verify:

- [ ] Updated relevant specification files
- [ ] Created/updated Storybook stories for new/modified components
- [ ] Added component to ARCHITECTURE.md inventory
- [ ] Updated TECH_STACK.md if dependencies changed
- [ ] Updated STYLING.md if design tokens added
- [ ] Storybook builds without errors (`npm run build-storybook`)
- [ ] Tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)

### Why These Rules Exist

1. **Prevent duplicate components** - ARCHITECTURE.md lists all components, preventing recreation
2. **Maintain consistency** - TECH_STACK.md ensures we don't add conflicting technologies
3. **Preserve styling approach** - STYLING.md documents the Tailwind v4 patterns
4. **Enable visual testing** - Storybook stories allow UI validation without running plugin
5. **Knowledge continuity** - Specs document decisions for future development

**Remember: Specifications are not just documentation - they are operational rules that must be followed and kept up-to-date.**
