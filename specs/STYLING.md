# Styling Guide

This document defines the styling approach, conventions, and rules for the Winden Tokens Figma plugin. **All styling must follow these specifications.**

## Styling System

### Technology: Tailwind CSS v4.2.2

**DO use:**
- ✅ Tailwind v4 utility classes
- ✅ `@apply` directive in CSS for component classes
- ✅ CSS custom properties (variables) for design tokens
- ✅ `@layer` directive for organizing styles

**DO NOT use:**
- ❌ SCSS/Sass (removed from project)
- ❌ CSS-in-JS (styled-components, emotion, etc.)
- ❌ Inline styles (except for dynamic values like colors)
- ❌ Tailwind v3 or earlier
- ❌ PostCSS config files (handled by Tailwind Vite plugin)

## File Organization

```
src/
├── tailwind.plugin.css          # Tailwind @theme definitions
└── ui/
    └── styles/
        ├── main.css              # Main stylesheet with design tokens
        └── components-extended.css  # Complex component styles
```

### Main Stylesheet Structure

**[src/ui/styles/main.css](../src/ui/styles/main.css)**
```css
@import "tailwindcss";
@import "../../tailwind.plugin.css";
@import './components-extended.css';

/* Design tokens as CSS variables */
:root {
  --bg: var(--figma-color-bg, #ffffff);
  --text: var(--figma-color-text, #1e1e1e);
  /* ... 92+ design token variables */
}

@layer base {
  /* Base HTML element styles */
}

@layer components {
  /* Component class definitions using @apply */
}

@layer utilities {
  /* Custom utility classes (rare) */
}
```

## Design Tokens (CSS Variables)

### 92+ Design Token Variables

All design tokens are defined in `:root` and map to Figma's design system:

#### Core Surfaces
```css
--bg: var(--figma-color-bg, #ffffff);
--bg-alt: var(--figma-color-bg-secondary, #f7f7f7);
--bg-hover: var(--figma-color-bg-hover, #f0f0f0);
--bg-selected: var(--figma-color-bg-selected, #e8f4ff);
--bg-input: var(--figma-color-bg, #ffffff);
--bg-menu: var(--figma-color-bg, #ffffff);
--bg-overlay: rgba(0, 0, 0, 0.5);
--bg-danger-hover: rgba(224, 62, 62, 0.12);
```

#### Borders
```css
--border: var(--figma-color-border, #e0e0e0);
--border-strong: var(--figma-color-border-strong, #4a4a4a);
--border-soft: rgba(0, 0, 0, 0.12);
--border-warning: #d9a441;
--border-warning-strong: #c18400;
```

#### Text
```css
--text: var(--figma-color-text, #1e1e1e);
--text-secondary: var(--figma-color-text-secondary, #666666);
--text-dim: var(--figma-color-text-tertiary, #666666);
--text-muted: #999999;
--text-brand: var(--figma-color-text-brand, #18a0fb);
--text-danger: var(--figma-color-text-danger, #e03e3e);
```

#### Actions
```css
--accent: var(--figma-color-bg-brand, #18a0fb);
--accent-hover: var(--figma-color-bg-brand-hover, #0d8de5);
--danger: var(--figma-color-bg-danger, #e03e3e);
--danger-hover: var(--figma-color-bg-danger-hover, #c43030);
--success: #1bc47d;
--warning: #b86e00;
```

#### Data Type Colors
```css
--type-color: #e24a67;
--type-float: #4f7cff;
--type-string: #2fb67a;
--type-boolean: #d9982f;
```

#### Graph/Relationships
```css
--graph-card-bg: var(--bg-alt);
--graph-edge-reference: var(--accent);
--graph-edge-generated: var(--warning);
--graph-edge-delete: var(--danger);
```

### Theme Support

Variables automatically adapt to Figma's theme:

```css
/* Light theme (default) */
:root {
  --bg: #ffffff;
  --text: #1e1e1e;
}

/* Dark theme (overrides) */
:root[data-theme-mode='dark'] {
  --bg: #2c2c2c;
  --text: #ffffff;
}
```

## Tailwind v4 Custom Utilities

### Registering Custom Colors

Custom design token utilities must be registered in `@theme`:

**[src/tailwind.plugin.css](../src/tailwind.plugin.css)**
```css
@theme {
  /* Background colors */
  --color-bg: var(--bg);
  --color-bg-alt: var(--bg-alt);
  --color-bg-hover: var(--bg-hover);

  /* Border colors */
  --color-border: var(--border);
  --color-border-strong: var(--border-strong);

  /* Text colors */
  --color-text: var(--text);
  --color-text-dim: var(--text-dim);

  /* ... all 66+ custom utilities */
}
```

**Usage in components:**
```css
.btn {
  @apply bg-bg border-border text-text;
}
```

### Adding New Design Tokens

When adding a new design token:

1. **Add CSS variable to [main.css](../src/ui/styles/main.css)**
```css
:root {
  --new-token: #value;
}
```

2. **Register in [tailwind.plugin.css](../src/tailwind.plugin.css)**
```css
@theme {
  --color-new-token: var(--new-token);
}
```

3. **Use as utility class**
```css
.component {
  @apply bg-new-token;
}
```

## Component Styling Approaches

### 1. Semantic Class Names (Preferred for Complex Components)

Use `@apply` to create semantic component classes:

```css
/* In main.css */
@layer components {
  .btn {
    @apply flex items-center justify-center gap-1 h-7 px-2.5 border border-border rounded bg-bg text-sm cursor-pointer text-text;
  }

  .btn-primary {
    @apply bg-accent text-text-on-accent border-accent;
  }

  .btn:hover:not(:disabled) {
    @apply bg-bg-hover;
  }
}
```

**When to use:**
- Component has many repeated instances
- Styles are complex (10+ utilities)
- Multiple states (hover, focus, disabled)
- Shared across different components

### 2. Direct Utility Classes (Preferred for Simple Components)

Use Tailwind utilities directly in JSX:

```tsx
<button className="flex items-center gap-2 px-3 py-2 bg-bg border border-border rounded hover:bg-bg-hover">
  Click me
</button>
```

**When to use:**
- Component is unique or rarely used
- Styles are simple (< 10 utilities)
- Quick prototyping
- One-off layouts

### 3. Dynamic Styles (Inline Styles)

Use inline styles **only** for dynamic values:

```tsx
<div
  className="color-swatch"
  style={{ background: colorValue }}  // ✅ Dynamic color
>
  <div className="bg-bg-alt" />  {/* ❌ Don't use inline for static styles */}
</div>
```

**When to use:**
- Color values from variables
- Position calculations
- Animation transforms
- Any runtime-computed value

## Component Class Patterns

### Button Component
```css
.btn {
  @apply flex items-center justify-center gap-1 h-7 px-2.5 border border-border rounded bg-bg text-sm cursor-pointer text-text;
}

.btn-primary { @apply bg-accent text-text-on-accent border-accent; }
.btn-danger { @apply bg-danger text-text-on-danger border-danger; }
.btn-sm { @apply h-6 text-xs px-2; }
.btn-lg { @apply h-9 text-base px-4; }

.btn:hover:not(:disabled) { @apply bg-bg-hover; }
.btn:disabled { @apply opacity-50 cursor-not-allowed; }
```

### Input Component
```css
.input {
  @apply w-full h-8 px-2 border border-border rounded bg-bg text-text text-sm outline-none;
}

.input:focus {
  @apply border-accent shadow-[0_0_0_2px_var(--accent-hover)];
}

.input:disabled {
  @apply bg-bg-alt cursor-not-allowed opacity-50;
}
```

### Modal Component
```css
.modal-overlay {
  @apply fixed inset-0 bg-bg-overlay flex items-center justify-center z-50;
}

.modal-content {
  @apply bg-bg border border-border rounded-lg shadow-lg max-w-md w-full mx-4;
}

.modal-header {
  @apply px-4 py-3 border-b border-border flex items-center justify-between;
}

.modal-body {
  @apply p-4;
}
```

## Styling Rules

### DO ✅

1. **Use design token variables for colors**
```css
.component {
  @apply bg-bg text-text border-border;
}
```

2. **Use @layer to organize styles**
```css
@layer components {
  .btn { /* ... */ }
}
```

3. **Use semantic class names for complex components**
```css
.table-header-cell {
  @apply px-3 py-2 bg-bg-alt font-semibold text-xs;
}
```

4. **Use Tailwind utilities for spacing, layout, typography**
```css
@apply flex flex-col gap-4 p-6 text-sm font-semibold;
```

5. **Follow mobile-first responsive design**
```css
@apply w-full md:w-1/2 lg:w-1/3;
```

6. **Use arbitrary values sparingly**
```css
@apply w-[26px] top-[2px];  /* Only when Tailwind doesn't have the value */
```

### DON'T ❌

1. **Don't use hardcoded colors**
```css
/* ❌ Bad */
.component {
  @apply bg-[#ffffff] text-[#1e1e1e];
}

/* ✅ Good */
.component {
  @apply bg-bg text-text;
}
```

2. **Don't use `!important`**
```css
/* ❌ Bad */
.component {
  @apply bg-bg !important;
}

/* ✅ Good - Fix specificity instead */
.component {
  @apply bg-bg;
}
```

3. **Don't mix styling approaches in one component**
```tsx
/* ❌ Bad */
<button
  className="btn-primary"
  style={{ background: '#18a0fb', padding: '8px' }}
/>

/* ✅ Good */
<button className="btn-primary" />
```

4. **Don't create utility classes for single-use styles**
```css
/* ❌ Bad - only used once */
.specific-button {
  @apply px-4 py-2 bg-bg;
}

/* ✅ Good - use utilities directly */
<button className="px-4 py-2 bg-bg" />
```

5. **Don't use CSS for what React can do**
```css
/* ❌ Bad */
.btn-hidden {
  display: none;
}

/* ✅ Good */
{isVisible && <Button />}
```

## Responsive Design

### Breakpoints (Tailwind defaults)
```css
sm: 640px   /* Small devices */
md: 768px   /* Medium devices */
lg: 1024px  /* Large devices */
xl: 1280px  /* Extra large */
2xl: 1536px /* 2X Extra large */
```

### Usage
```css
.container {
  @apply w-full sm:w-1/2 lg:w-1/3;
  @apply p-4 md:p-6 lg:p-8;
}
```

## Accessibility

### Focus States
```css
.btn:focus-visible {
  @apply outline-2 outline-offset-2 outline-accent;
}
```

### Contrast
- Use `--text-on-accent` for text on colored backgrounds
- Use `--text-on-danger` for text on danger backgrounds
- Ensure 4.5:1 contrast ratio minimum

### Screen Readers
```tsx
<button
  className="icon-btn"
  aria-label="Close modal"
>
  <CloseIcon />
</button>
```

## Performance

### CSS Bundle Size
- Current: ~150 KB gzipped
- Target: < 200 KB gzipped
- Tailwind v4 automatically purges unused classes

### Best Practices
- Prefer utility classes over custom CSS
- Avoid deep nesting in `@apply`
- Use `@layer` to control cascade
- Let Tailwind handle vendor prefixes

## Common Patterns

### Container
```css
.container {
  @apply mx-auto px-4 max-w-7xl;
}
```

### Card
```css
.card {
  @apply bg-bg border border-border rounded-lg p-4 shadow-sm;
}
```

### Overlay
```css
.overlay {
  @apply fixed inset-0 bg-bg-overlay z-50;
}
```

### Centered Flex
```css
.center {
  @apply flex items-center justify-center;
}
```

### Truncate Text
```css
.truncate-text {
  @apply truncate;  /* Tailwind utility */
}
```

## Debugging

### View Compiled CSS
```bash
npm run build
# Check dist/index.html for final CSS
```

### Check Token Values
Open browser DevTools → Elements → Computed → Filter "var("

### Tailwind IntelliSense
Install "Tailwind CSS IntelliSense" VSCode extension for autocomplete

## Migration Notes

### From SCSS to Tailwind (Completed)
- ✅ All SCSS files removed
- ✅ Converted to Tailwind utilities with `@apply`
- ✅ Design tokens preserved as CSS variables
- ✅ Build working with v4.2.2

### Future Migrations
- When updating Tailwind v4 → v5:
  1. Check `@theme` syntax changes
  2. Test all custom utilities
  3. Verify design token mapping
  4. Update [tailwind.plugin.css](../src/tailwind.plugin.css)

## Resources

- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs/v4-beta)
- [Tailwind @theme Reference](https://tailwindcss.com/docs/v4-beta/theme)
- [CSS Custom Properties (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/--*)
- [Figma Plugin UI Best Practices](https://www.figma.com/plugin-docs/creating-ui/)
