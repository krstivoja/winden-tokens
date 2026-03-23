# Technology Stack

This document defines the complete technology stack used in the Winden Tokens Figma plugin. Follow these specifications strictly to maintain consistency and avoid introducing conflicting technologies.

## Core Technologies

### Language
- **TypeScript 5.3+** - Primary language for all code
  - Strict mode enabled
  - No implicit any
  - Isolated modules
  - Target: ES2020
  - Module: ESNext

### UI Framework
- **React 18.2** - UI library
  - Functional components only (no class components)
  - Hooks for state management
  - JSX/TSX for templating
  - React DOM for rendering

### Build Tools
- **Vite 5.0+** - Build tool and dev server
  - `@vitejs/plugin-react` for React support
  - `vite-plugin-singlefile` for bundling to single HTML
  - ESM module system
  - Fast HMR (Hot Module Replacement)

- **TypeScript Compiler (tsc)** - Type checking and plugin code compilation
  - Separate configs for UI and plugin code
  - Path aliases: `@/*` → `src/*`

### Styling
- **Tailwind CSS v4.2.2** - Utility-first CSS framework
  - `@tailwindcss/vite` plugin for v4 integration
  - Custom `@theme` definitions for design tokens
  - No PostCSS config needed (handled by Vite plugin)
  - **DO NOT use v3 or earlier**
  - **DO NOT add PostCSS or Autoprefixer** (already handled)

- **CSS Custom Properties (CSS Variables)** - Design tokens
  - 92+ design token variables defined in `:root`
  - Theme switching support (light/dark)
  - Figma color variable integration

### Testing

#### Unit Testing
- **Vitest 1.0+** - Test runner (Vite-native)
  - Fast, ESM-native testing
  - Compatible with Vite's module resolution
  - Coverage reporting built-in

#### Component Testing
- **@testing-library/react 14.1+** - React component testing
- **@testing-library/jest-dom 6.1+** - DOM matchers
- **@testing-library/user-event 14.5+** - User interaction simulation
- **jsdom 23.0+** - DOM environment for tests

#### Visual Testing
- **Storybook 8.6.18** - Component development and visual testing
  - **DO NOT upgrade to v10+** (breaking changes, incompatible addons)
  - Addons:
    - `@storybook/addon-a11y` - Accessibility testing
    - `@storybook/addon-docs` - Auto documentation
    - `@storybook/addon-essentials` - Core addon bundle
    - `@storybook/addon-interactions` - Interaction testing
  - `@storybook/react-vite` - Vite integration

### Graph Visualization
- **@xyflow/react 12.10+** - Flow diagram library
  - For variable relationships view
  - Handles node-based graph rendering
  - Interactive panning/zooming

### Figma Integration
- **@figma/plugin-typings 1.123+** - Figma Plugin API types
  - Type definitions for `figma.*` API
  - Updated regularly for new Figma features

## Package Manager
- **npm** - Package management
  - Lock file: `package-lock.json`
  - **DO NOT use yarn or pnpm**
  - Node version: 20.x recommended

## Development Dependencies

### Type Definitions
```json
{
  "@figma/plugin-typings": "^1.123.0",
  "@types/node": "^20.19.37",
  "@types/react": "^18.3.28",
  "@types/react-dom": "^18.3.7"
}
```

### Build & Dev Tools
```json
{
  "concurrently": "^8.2.2",
  "typescript": "^5.3.2",
  "vite": "^5.0.4",
  "vite-plugin-singlefile": "^0.13.5"
}
```

## Module System
- **ES Modules (ESM)** - Module format
  - `"type": "module"` in package.json
  - Use `import`/`export` syntax
  - **NO CommonJS** (`require`/`module.exports`)

## Browser Targets
- **Modern browsers** - ES2020+ support required
- **Figma Desktop app** - Chromium-based
  - No need for legacy browser polyfills
  - Full ES2020 feature support

## Prohibited Technologies

### DO NOT Add These:
- ❌ **SCSS/Sass** - Removed in favor of Tailwind
- ❌ **PostCSS** (standalone) - Handled by Tailwind Vite plugin
- ❌ **Autoprefixer** (standalone) - Handled by Tailwind v4
- ❌ **CSS-in-JS libraries** (styled-components, emotion, etc.) - Use Tailwind
- ❌ **State management libraries** (Redux, MobX, Zustand) - Use React hooks
- ❌ **UI component libraries** (Material-UI, Ant Design, etc.) - We have custom components
- ❌ **Alternative frameworks** (Vue, Svelte, Angular) - React only
- ❌ **jQuery** - Use vanilla JS or React
- ❌ **Lodash** - Use native ES2020+ methods
- ❌ **Moment.js** - Use native `Date` or `Intl`
- ❌ **Webpack** - Use Vite
- ❌ **Rollup** (standalone) - Vite uses Rollup internally
- ❌ **Jest** - Use Vitest

## Version Constraints

### Keep These at Current Versions:
- **React**: Stay on v18.x (v19+ has breaking changes)
- **Vite**: Stay on v5.x (v6+ major changes)
- **Storybook**: Stay on v8.x (v10+ incompatible addons)
- **Vitest**: Stay on v1.x (v4+ breaking changes)
- **Tailwind**: Use v4.2.2 (latest stable)

### Safe to Update (Minor/Patch):
- `@figma/plugin-typings` - Update regularly for new Figma API features
- `@types/*` packages - Safe to update within major version
- `typescript` - Safe within v5.x
- Testing library packages - Safe within major versions

## TypeScript Configuration

### UI Code (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "strict": true,
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

### Plugin Code (`tsconfig.plugin.json`)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "outDir": "dist",
    "strict": true,
    "types": ["@figma/plugin-typings"]
  },
  "include": ["src/plugin/**/*"]
}
```

## Build Scripts

```json
{
  "scripts": {
    "dev": "concurrently \"vite\" \"tsc --watch --project tsconfig.plugin.json\"",
    "dev:build": "concurrently \"vite build --watch\" \"tsc --watch --project tsconfig.plugin.json\"",
    "build": "vite build && tsc --project tsconfig.plugin.json",
    "build:ui": "vite build",
    "build:plugin": "tsc --project tsconfig.plugin.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "verify": "npm run build && npm test"
  }
}
```

### Development Modes

**`npm run dev`** - Hot reload development (Recommended)
- Starts Vite dev server with HMR at `http://localhost:5173`
- Watches plugin TypeScript files
- **Auto-reloads browser** when you change Tailwind classes or components
- Best for UI development

**`npm run dev:build`** - Build watch mode (For testing production build)
- Builds to `dist/` on file changes
- Watches plugin TypeScript files
- Requires manual browser reload
- Use when you need to test the actual bundled output

**`npm run build`** - Production build
- Bundles UI to single `dist/index.html`
- Compiles plugin to `dist/code.js`
- Use for final Figma plugin testing

## File Structure Conventions

```
src/
├── plugin/           # Figma plugin sandbox code
│   └── code.ts       # Main plugin file (TypeScript)
├── ui/               # React UI code
│   ├── components/   # React components
│   ├── styles/       # CSS files
│   ├── main.tsx      # React entry point
│   └── index.html    # HTML template
└── tailwind.plugin.css  # Tailwind @theme definitions

dist/                 # Build output
├── code.js           # Compiled plugin code
└── index.html        # Bundled UI (single file)
```

## Code Style

### Linting & Formatting
- **ESLint** - Code linting (if configured)
- **Prettier** - Code formatting (optional)
- Consistent 2-space indentation
- Single quotes for strings (except JSX)
- Trailing commas in multiline

### Naming Conventions
- **Components**: PascalCase (e.g., `Button.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useModal.ts`)
- **Utilities**: camelCase (e.g., `formatColor.ts`)
- **Types/Interfaces**: PascalCase (e.g., `ButtonProps`)
- **CSS classes**: kebab-case (e.g., `btn-primary`)
- **CSS variables**: kebab-case with `--` prefix (e.g., `--bg-alt`)

## Runtime Environment

### Figma Plugin Sandbox (code.ts)
- **Sandboxed environment** - No DOM access
- **Figma API access** - Full `figma.*` API
- **Node.js globals** - Limited (no `fs`, `path`, etc.)
- **Communication** - Message passing to UI via `figma.ui.postMessage`

### Figma Plugin UI (ui.html / React)
- **Browser environment** - Full DOM access
- **No Figma API access** - Must request via messages
- **Communication** - Message passing to plugin via `parent.postMessage`

## Dependencies Summary

### Production Dependencies (3 total)
```json
{
  "@xyflow/react": "^12.10.1",  // Graph visualization
  "react": "^18.2.0",            // UI framework
  "react-dom": "^18.2.0"         // React DOM renderer
}
```

### Development Dependencies (18 total)
- Build: Vite, TypeScript, Tailwind, Vite plugins
- Testing: Vitest, Testing Library, jsdom
- Storybook: Core + addons
- Types: @figma/plugin-typings, @types/*
- Utilities: concurrently

## Adding New Dependencies

### Before Adding a Dependency, Ask:
1. **Is it necessary?** - Can we achieve this with existing tools?
2. **Is it compatible?** - Works with React 18, Vite 5, TypeScript 5?
3. **Is it maintained?** - Last update within 6 months?
4. **Size impact?** - Will it significantly increase bundle size?
5. **Conflicts?** - Does it conflict with prohibited technologies?

### Approval Required For:
- Any new production dependency
- Any new framework/library
- Major version updates
- Alternative to existing tool

### Pre-Approved:
- Type definitions (`@types/*`)
- Figma plugin types updates
- Security patches
- Minor/patch updates within constraints

## Version Update Policy

### Immediate Updates (Security)
- Security vulnerabilities (run `npm audit`)
- Critical bug fixes

### Regular Updates (Monthly)
- `@figma/plugin-typings` - New Figma API features
- `@types/*` packages - Type improvements
- Patch versions of all packages

### Careful Updates (Quarterly)
- Minor version updates
- Review breaking changes
- Test thoroughly before updating

### Avoid Updates (Until Necessary)
- Major version updates
- Dependencies marked as "keep current version"
- Experimental/beta packages

## Resources

- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs/v4-beta)
- [Vitest Documentation](https://vitest.dev/)
- [Storybook Documentation](https://storybook.js.org/)
- [Figma Plugin API](https://www.figma.com/plugin-docs/)
