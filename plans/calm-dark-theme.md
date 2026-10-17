# Calm dark theme that tracks Figma's UI

Branch: `feat/calm-dark-theme`

## Problem

Dark mode uses zinc-950/900 (near black), zinc-100 text and saturated `blue-600` wires and handles.
Figma's own dark chrome is `#2C2C2C` panels, `#383838`/`#444444` raised surfaces and borders, a `#1E1E1E` canvas and muted secondary text.
Next to it the plugin looks harsh.

A second, hidden bug: dark mode is driven only by `prefers-color-scheme` (the OS).
`figma.showUI(..., { themeColors: true })` puts `figma-dark` / `figma-light` on `<html>` and injects `--figma-color-*` vars, but the main UI ignores them.
So Figma dark on a light OS shows the plugin light, and the reverse.

## Current state (found)

- All tokens live in `src/ui/styles/main.css` (`@theme` light + `@media (prefers-color-scheme: dark) :root` dark).
- Components use tokens almost everywhere (`text-text`, `bg-base*`, `border-border`); only a few `text-white`/`#EC4899` literals.
- Graph colors come from `GroupedGraph/constants.ts` (`var(--color-primary)` etc.); edge width is a JS literal in `GraphEdge.tsx` (2 / 2.5).
- Graph canvas is `bg-base-2`, cards `bg-base` — in dark both are near black, so cards barely separate from the canvas.
- React Flow chrome (dots, MiniMap, Controls) uses its own `--xy-*` defaults, untouched.
- `json-editor.css` has its own `prefers-color-scheme` block.
- Bridge window (`src/ui/bridge.html`) already uses `--figma-color-*` directly; out of scope.

## Plan

### 1. Theme trigger (main.css, json-editor.css)

- Dark applies on `html.figma-dark`, or on `prefers-color-scheme: dark` when Figma has not set `figma-light` (`:root:not(.figma-light)`).
- In Figma the plugin then follows Figma's theme, not the OS. Browser tab (`npm run dev`) keeps following the OS.
- One shared dark block, written once (CSS nesting / `:is()`), so the two triggers can't drift.

### 2. Dark palette sourced from Figma vars, with fallbacks

Each dark token = `var(--figma-color-…, <UI3 fallback>)`, so the browser tab gets the same look.

| token | dark value | used for |
|---|---|---|
| `--color-base` | `--figma-color-bg` / `#2C2C2C` | panels, cards |
| `--color-base-2` | `--figma-color-bg-secondary` / `#383838` | headers, hover |
| `--color-base-3` | `--figma-color-bg-tertiary` / `#444444` | active/pressed |
| `--color-border` | `--figma-color-border` / `#444444` | all borders |
| `--color-bg-input` | `--figma-color-bg-secondary` / `#383838` | inputs |
| `--color-text` | `--figma-color-text` / `#FFFFFF` at ~0.9 (see decision A) | primary text |
| `--color-primary` | `--figma-color-bg-brand` / `#0C8CE9` | buttons, selection |
| new `--color-canvas` | `#1E1E1E` (light: zinc-100, same as today) | graph canvas only |

- Graph canvas switches from `bg-base-2` to new `bg-canvas`, so cards sit lighter than the canvas, like Figma frames on its canvas.
- Light tokens stay exactly as they are (no light regression).

### 3. Lower-contrast secondary text

- New `--color-text-secondary` token (dark: `--figma-color-text-secondary` / white 70%; light: today's effective `text/60`).
- Apply to data/meta text in the graph cards and sidebar: hex values, `{alias}` values, counts, type labels, "TIER n" captions.
- Existing `text-text/50|60` usages stay (they already read as secondary).

### 4. Graph edges and handles

- New tokens `--color-edge` and `--color-edge-generated`:
  - light: `primary` / `secondary` (unchanged).
  - dark: brand blue / purple mixed down (`color-mix(in oklab, var(--color-primary) 60%, var(--color-canvas))`) — muted, no transparency stacking where many wires overlap.
- New token `--edge-width` (light `2px`, dark `1.5px`); `GraphEdge.tsx` reads it through `style.strokeWidth` instead of the literal; generated edges keep +0.5.
- `REFERENCE_CONNECTION_COLOR` / `GENERATED_CONNECTION_COLOR` point at the edge tokens, so connected handles and the drag connection line get the same muted tone.
- Highlight (pink `#EC4899`) moves into a `--color-highlight-path` token, unchanged value, so traced paths still pop against the calmer wires.

### 5. React Flow chrome

- Map `--xy-background-pattern-color-default`, `--xy-minimap-background-color-default`, `--xy-minimap-mask-background-color-default`, `--xy-controls-button-background-color-default`, `--xy-controls-button-color-default`, `--xy-controls-button-border-color-default` to tokens in main.css.

### 6. Small leftovers

- `.bg-checkerboard` gets a dark tile tone via token.
- `json-editor.css` dark block uses the new trigger.
- Update `specs/styles.md` dark-mode section.

## Verify

- `npm run build`, `npx vitest run`, UI tsc ≤ 251 errors.
- Browser preview (`npm run dev`, mock data), dark + light: before/after screenshots of Relationships, Table, JSON, Settings.
- Figma (built `dist/`): Figma dark and Figma light, incl. Figma theme ≠ OS theme.
- Contrast check: primary text, secondary text, muted edges vs canvas (text ≥ 4.5:1, edges/handles ≥ 3:1).

## Decisions for you

- **A. Primary text in dark**: Figma's own `#FFFFFF` (exact match) or white at 90% (calmer)? Recommend Figma's var as-is, with calm coming from secondary text.
- **B. Edge width in dark**: 1.5px (recommend) or keep 2px and only mute color?
- **C. Light mode**: keep as-is (recommend, this task) or also source it from `--figma-color-*` later?

## Progress

Decisions A/B/C taken at the recommended defaults (Figma text var as-is, 1.5px dark edges, light unchanged).

- [x] 1 trigger (`@custom-variant dark` in main.css; json-editor uses `@variant dark`)
- [x] 2 palette (+ `--color-checker`, MiniMap node color)
- [x] 3 secondary text (also replaced undefined `text-text-muted` in GraphNode + SidebarFilter)
- [x] 4 edges/handles (highlight rings/shadows on `--color-highlight-path`, `ring-offset-canvas`)
- [x] 5 React Flow chrome
- [x] 6 leftovers + spec
- [x] verify: build, 415 tests, UI tsc 251, browser preview figma-dark / figma-light / OS fallback
- [ ] verify in real Figma (dark and light, Figma theme ≠ OS theme)
- [ ] contrast spot-check of muted edges vs canvas
