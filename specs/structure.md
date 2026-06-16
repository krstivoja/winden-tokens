# File Structure

**Project organization and file layout**

---

## Directory Tree

```
winden-tokens/
├── .claude/                         # Agent teams configuration
│   ├── agents/                      # Individual agent specs
│   │   ├── orchestrator.md          # Main coordinator
│   │   ├── components-dev.md        # React component developer
│   │   ├── functionality-dev.md     # Business logic developer
│   │   └── testing-dev.md           # Testing & documentation
│   ├── AGENT_TEAMS.md               # Agent teams guide
│   ├── QUICK_START.md               # Quick reference
│   ├── HOW_TO_VERIFY_AGENTS.md      # Verification guide
│   └── settings.local.json          # Local settings (agent teams enabled)
│
├── docs/                            # Jekyll website (GitHub Pages)
│   ├── _posts/                      # Blog posts (changelog, updates)
│   ├── _layouts/                    # Jekyll layouts
│   ├── decisions/                   # Architectural decision records
│   │   ├── TEMPLATE.md              # Decision doc template
│   │   └── *.md                     # Decision documents
│   ├── _config.yml                  # Jekyll config
│   └── ...                          # Other Jekyll files
│
├── specs/                           # Technical specifications
│   ├── devnotes.md                  # Development guide (this file)
│   ├── structure.md                 # File structure
│   ├── styles.md                    # Styling with Tailwind
│   ├── components.md                # Component inventory
│   ├── functions.md                 # Plugin logic
│   ├── techstack.md                 # Technology stack
│   ├── testing.md                   # Testing guide
│   ├── .conversations/              # Session logs for context
│   │   ├── README.md                # How to use conversation logs
│   │   └── *.md                     # Session log files
│   └── .old-backup/                 # Backup of old spec files
│
├── src/                             # Source code
│   ├── code.ts                      # Figma plugin sandbox code
│   │
│   ├── ui/                          # React UI application
│   │   ├── components/              # React components
│   │   │   ├── common/              # Reusable UI components
│   │   │   │   ├── Button/
│   │   │   │   │   ├── Button.tsx
│   │   │   │   │   ├── Button.test.tsx
│   │   │   │   │   ├── Button.stories.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   ├── Input/
│   │   │   │   ├── Select/
│   │   │   │   ├── Checkbox/
│   │   │   │   ├── Radio/
│   │   │   │   ├── Textarea/
│   │   │   │   ├── Label/
│   │   │   │   ├── FormGroup/
│   │   │   │   ├── Modal/
│   │   │   │   ├── Dropdown/
│   │   │   │   ├── OptionsDropdown/
│   │   │   │   ├── IconButton/
│   │   │   │   ├── IconTextButton/
│   │   │   │   └── TextButton/
│   │   │   │
│   │   │   ├── Table/               # Spreadsheet table components
│   │   │   │   ├── TableView.tsx
│   │   │   │   ├── TableRow.tsx
│   │   │   │   ├── ValueCell.tsx
│   │   │   │   ├── CollectionCell.tsx
│   │   │   │   ├── GroupCollectionCell.tsx
│   │   │   │   ├── GroupHeader.tsx
│   │   │   │   ├── ColorMenu.tsx
│   │   │   │   ├── ColorValueMenu.tsx
│   │   │   │   └── ContrastPicker.tsx
│   │   │   │
│   │   │   ├── Toolbar/             # Top toolbar components
│   │   │   │   ├── Toolbar.tsx
│   │   │   │   ├── CollectionFilters.tsx
│   │   │   │   ├── VariableTypeFilters.tsx
│   │   │   │   ├── ModeSelector.tsx
│   │   │   │   └── AddMenu.tsx
│   │   │   │
│   │   │   ├── Modals/              # Modal dialogs
│   │   │   │   ├── ModalContext.tsx
│   │   │   │   ├── InputModal.tsx
│   │   │   │   ├── ColorPickerModal.tsx
│   │   │   │   ├── StepsModal.tsx
│   │   │   │   ├── ShadesModal.tsx
│   │   │   │   ├── ColorReferenceModal.tsx
│   │   │   │   └── BulkEditModal.tsx
│   │   │   │
│   │   │   ├── Tabs/                # Tab views
│   │   │   │   ├── TabBar.tsx
│   │   │   │   ├── TabButton.tsx
│   │   │   │   ├── TabContent.tsx
│   │   │   │   ├── JsonEditor.tsx
│   │   │   │   └── SettingsView.tsx
│   │   │   │
│   │   │   ├── Relationships/       # Dependency graph view
│   │   │   │   ├── RelationshipsView.tsx
│   │   │   │   └── GroupedGraph.tsx
│   │   │   │
│   │   │   ├── Icons.tsx            # SVG icon components
│   │   │   ├── icons/               # Icon utilities
│   │   │   │   └── Icon.tsx
│   │   │   └── ResizeHandles.tsx    # Panel resize handles
│   │   │
│   │   ├── hooks/                   # Custom React hooks
│   │   │   └── (custom hooks here)
│   │   │
│   │   ├── context/                 # React context providers
│   │   │   └── (context files here)
│   │   │
│   │   ├── styles/                  # Styles
│   │   │   └── main.css             # Tailwind @theme and base styles
│   │   │
│   │   ├── tailwind.plugin.css      # Plugin-specific Tailwind classes
│   │   └── ui.tsx                   # React app entry point
│   │
│   └── types/                       # TypeScript type definitions
│       └── (type files here)
│
├── dist/                            # Build output (gitignored)
│   ├── index.html                   # Bundled UI (single file)
│   └── code.js                      # Compiled plugin code
│
├── node_modules/                    # Dependencies (gitignored)
│
├── .gitignore                       # Git ignore rules
├── CLAUDE.md                        # AI development guide
├── manifest.json                    # Figma plugin manifest
├── package.json                     # NPM dependencies and scripts
├── package-lock.json                # Locked dependency versions
├── tsconfig.json                    # TypeScript config (UI)
├── tsconfig.plugin.json             # TypeScript config (Plugin)
├── vite.config.ts                   # Vite build configuration
└── vitest.config.ts                 # Vitest test configuration
```

---

## Key Directories

### `.claude/`
Agent teams configuration and guides.

**Purpose:** Configure Claude Code agent teams for coordinated development.

**Key files:**
- `agents/*.md` - Individual agent specifications
- `settings.local.json` - Enable agent teams feature

### `docs/`
Jekyll website source (built and deployed by GitHub Actions).

**Purpose:** Public documentation, changelog, decision records.

**Do NOT manually build.** GitHub Actions handles compilation and deployment to GitHub Pages.

### `specs/`
Technical specifications for development.

**Purpose:** Guide AI and human developers with accurate, up-to-date documentation.

**Files:**
- `devnotes.md` - Development workflow
- `structure.md` - This file
- `styles.md` - Styling approach
- `components.md` - Component reference
- `functions.md` - Plugin features
- `techstack.md` - Technologies used
- `testing.md` - Testing patterns
- `.conversations/` - Session logs for context preservation
- `.old-backup/` - Backup of old spec files

**Maintenance:** The `@testing-dev` agent keeps these in sync with codebase.

### `specs/.conversations/`
Conversation logs from important AI development sessions.

**Purpose:** Preserve context and decisions across computer restarts.

**What's logged:**
- Major architecture changes
- Documentation restructures
- Important decisions
- Agent team updates
- New conventions

**How agents use this:**
1. Read CLAUDE.md (entry point)
2. Check relevant specs/ files
3. For context on past decisions, read `.conversations/`

**Format:** `YYYY-MM-DD-topic-name.md`

**See:** `.conversations/README.md` for details

### `src/`
All source code.

**Structure:**
- `code.ts` - Plugin sandbox code (Figma API access)
- `ui/` - React application (browser context)

### `src/ui/components/`
React components organized by purpose.

**Organization:**
- `common/` - Reusable UI primitives (Button, Input, etc.)
- `Table/` - Table-specific components
- `Toolbar/` - Toolbar-specific components
- `Modals/` - Modal dialogs
- `Tabs/` - Tab views
- `Relationships/` - Dependency graph view
- `Icons.tsx` - SVG icons
- `ResizeHandles.tsx` - Utility components

**Convention:** Each component in its own folder with:
```
ComponentName/
├── ComponentName.tsx       # Component implementation
├── ComponentName.test.tsx  # Tests
├── ComponentName.stories.tsx # Storybook (optional)
└── index.ts                # Barrel export
```

### `src/ui/styles/`
Tailwind configuration and base styles.

**Files:**
- `main.css` - Tailwind @theme, base styles, utilities

### `dist/`
Build output (created by `npm run build`).

**Gitignored:** Never commit these files.

**Contents:**
- `index.html` - Bundled UI (single file with inline CSS/JS)
- `code.js` - Compiled plugin code

---

## File Naming Conventions

### Components
- **PascalCase:** `Button.tsx`, `ColorPicker.tsx`
- **Test files:** `Button.test.tsx`
- **Stories:** `Button.stories.tsx`
- **Index exports:** `index.ts` (lowercase)

### Utilities/Hooks
- **camelCase:** `usePluginMessages.ts`, `formatColor.ts`
- **Test files:** `usePluginMessages.test.ts`

### Types
- **PascalCase:** `Variable.ts`, `Collection.ts`
- **Suffix:** `types.ts` for type-only files

### Styles
- **lowercase:** `main.css`, `tailwind.plugin.css`

---

## Import Conventions

### Absolute Imports
Use `@/` for all imports (configured in `tsconfig.json`):

```typescript
// ✅ Good
import { Button } from '@/components/common/Button';
import { usePluginMessages } from '@/hooks/usePluginMessages';

// ❌ Bad
import { Button } from '../../../common/Button';
```

### Barrel Exports
Components export via `index.ts`:

```typescript
// components/common/Button/index.ts
export { Button } from './Button';
export type { ButtonProps } from './Button';
```

Usage:
```typescript
import { Button } from '@/components/common/Button';
```

---

## Special Files

### `manifest.json`
Figma plugin manifest (defines plugin metadata).

**Key fields:**
- `name` - Plugin name
- `id` - Unique plugin ID
- `main` - Entry point (`dist/code.js`)
- `ui` - UI file path (`dist/index.html`)
- `editorType` - `["figma"]`

**Important:** Version must match `package.json`.

### `code.ts`
Plugin sandbox code (runs in Figma).

**Access:**
- `figma.*` API
- No DOM APIs
- No browser APIs

**Responsibilities:**
- Variable CRUD operations
- Collection management
- Message passing to UI
- Polling for external changes

### `ui.tsx`
React app entry point (runs in browser iframe).

**Access:**
- DOM APIs
- Browser APIs
- No `figma.*` API

**Responsibilities:**
- Render UI
- Handle user interactions
- Message passing to plugin

---

## Configuration Files

### TypeScript

**Two configs:**

1. **`tsconfig.json`** - UI code
   - Includes: `src/ui/**/*`
   - Lib: `["ES2020", "DOM"]`
   - JSX: React

2. **`tsconfig.plugin.json`** - Plugin code
   - Includes: `src/code.ts`
   - Lib: `["ES2020"]` (no DOM)
   - Types: `@figma/plugin-typings`

### Vite

**`vite.config.ts`**

Key plugins:
- `@vitejs/plugin-react` - React support
- `@tailwindcss/vite` - Tailwind v4
- `vite-plugin-singlefile` - Inline CSS/JS into HTML

### Vitest

**`vitest.config.ts`**

- Environment: `jsdom`
- Setup: `@testing-library/jest-dom`
- Coverage: included

---

## Ignored Files

### `.gitignore`

```
node_modules/
dist/
*.log
.DS_Store
.env.local
```

**Never commit:**
- `node_modules/` - Dependencies (install via npm)
- `dist/` - Build output (generate via `npm run build`)
- `.env.local` - Local environment variables

---

## Package Scripts

See `package.json`:

```json
{
  "scripts": {
    "dev": "vite + tsc watch",
    "dev:build": "vite build --watch + tsc watch",
    "build": "vite build + tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest --coverage",
    "verify": "build + test"
  }
}
```

---

## Related Documentation

- [devnotes.md](devnotes.md) - How to develop
- [components.md](components.md) - Component reference
- [styles.md](styles.md) - Styling approach
- [techstack.md](techstack.md) - Technologies
