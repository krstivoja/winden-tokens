# Styling Guide

**How we style with Tailwind CSS v4**

---

## Core Principle

**USE ONLY TAILWIND CSS V4 UTILITY CLASSES. NO CUSTOM CSS FILES.**

- All styling via Tailwind utilities
- Dynamic values (Figma colors, positions) use inline styles
- No `@apply`, no custom CSS beyond `@theme`
- No separate CSS files for components

---

## Tailwind CSS v4

### What's Different in v4

1. **No `tailwind.config.js`** - Configuration via CSS `@theme`
2. **Faster builds** - Native Rust engine (Lightning CSS)
3. **Simpler setup** - Import in CSS, plugin in Vite
4. **CSS-first** - Design tokens in CSS, not JS

### Setup

**`vite.config.ts`:**
```typescript
import tailwindcss from '@tailwindcss/vite';

export default {
  plugins: [tailwindcss()]
}
```

**`src/ui/styles/main.css`:**
```css
@import "tailwindcss";
```

That's it. No config file needed.

---

## Design Tokens (@theme)

### Main Theme File

**Location:** `src/ui/styles/main.css`

```css
@import "tailwindcss";

/* Light mode theme (default) */
@theme {
    --color-primary: var(--color-blue-500);
    --color-secondary: var(--color-purple-500);

    --color-base: white;
    --color-text: black;

    --color-border: var(--color-gray-200);
    --color-bg-input: var(--color-gray-100);
}

/* Dark mode theme (system preference) */
@media (prefers-color-scheme: dark) {
    :root {
        --color-base: black;
        --color-text: white;
        --color-border: var(--color-gray-700);
        --color-bg-input: var(--color-gray-800);
    }
}

body {
    background-color: var(--color-base);
    color: var(--color-text);
    font-size: 12px;
    line-height: 1;
}
```

### How @theme Works

**Define custom tokens:**
```css
@theme {
    --color-primary: var(--color-blue-500);
}
```

**Use in Tailwind classes:**
```tsx
<button className="bg-primary text-white">
  Click me
</button>
```

**Tailwind generates:**
```css
.bg-primary { background-color: var(--color-primary); }
.text-white { color: white; }
```

---

## Available Design Tokens

### Colors

```css
@theme {
    /* Brand colors */
    --color-primary: var(--color-blue-500);
    --color-secondary: var(--color-purple-500);

    /* Base colors */
    --color-base: white;       /* Background */
    --color-text: black;       /* Text color */

    /* UI colors */
    --color-border: var(--color-gray-200);
    --color-bg-input: var(--color-gray-100);
}
```

**Usage:**
```tsx
<div className="bg-base text-text border border-border">
  Content
</div>
```

### Tailwind Default Colors

All Tailwind v4 default colors available:

- `blue-50` through `blue-950`
- `gray-50` through `gray-950`
- `red-50` through `red-950`
- `green-50` through `green-950`
- `purple-50` through `purple-950`
- ... and more

**Usage:**
```tsx
<div className="bg-blue-500 text-white">
  Blue background
</div>
```

---

## Styling Patterns

### Component Example

```tsx
// Button.tsx
export function Button({ variant = 'primary', children }) {
  return (
    <button
      className={`
        px-3 py-1.5 rounded border transition
        ${variant === 'primary' ? 'bg-primary text-white hover:bg-blue-600' : ''}
        ${variant === 'secondary' ? 'bg-base-2 text-text hover:bg-base-3' : ''}
      `}
    >
      {children}
    </button>
  );
}
```

**Key points:**
- All styling via Tailwind classes
- Conditional classes with template literals
- No separate CSS file
- No `@apply` directive

### Dynamic Values

For values from Figma (colors, positions), use **inline styles**:

```tsx
// ❌ Don't try to make Tailwind classes from dynamic values
<div className={`bg-[${figmaColor}]`}>  // Won't work reliably

// ✅ Use inline styles for dynamic values
<div style={{ backgroundColor: figmaColor }}>
  Color from Figma
</div>
```

### Responsive Design

```tsx
<div className="
  w-full           /* Mobile: full width */
  md:w-1/2         /* Tablet: half width */
  lg:w-1/3         /* Desktop: third width */
">
  Responsive
</div>
```

### Dark Mode

```tsx
<div className="
  bg-base         /* Light mode */
  dark:bg-gray-900 /* Dark mode */
  text-black
  dark:text-white
">
  Adapts to dark mode
</div>
```

**Note:** We use system preference (`prefers-color-scheme`), not manual toggle.

---

## Common Utilities

### Layout

```tsx
// Flexbox
<div className="flex items-center justify-between gap-2">
  <span>Left</span>
  <span>Right</span>
</div>

// Grid
<div className="grid grid-cols-3 gap-4">
  <div>1</div>
  <div>2</div>
  <div>3</div>
</div>
```

### Spacing

```tsx
// Padding
<div className="p-4">          /* All sides: 1rem */
<div className="px-4 py-2">    /* Horizontal + Vertical */
<div className="pt-2 pb-4">    /* Top + Bottom */

// Margin
<div className="m-4">          /* All sides */
<div className="mx-auto">      /* Horizontal centering */
<div className="mt-2 mb-4">    /* Top + Bottom */

// Gap (for flex/grid)
<div className="flex gap-2">   /* Space between children */
```

### Typography

```tsx
<p className="text-sm">        /* Small text */
<p className="text-base">      /* Normal text */
<p className="text-lg">        /* Large text */

<p className="font-bold">      /* Bold */
<p className="font-medium">    /* Medium weight */
<p className="font-normal">    /* Normal weight */

<p className="text-text">      /* Use theme color */
<p className="text-gray-600">  /* Specific color */
```

### Borders

```tsx
<div className="border">                     /* All sides */
<div className="border-t border-b">          /* Top + Bottom */
<div className="border border-border">       /* Custom color */
<div className="rounded">                    /* Border radius */
<div className="rounded-lg">                 /* Larger radius */
```

### States

```tsx
<button className="
  bg-primary
  hover:bg-blue-600        /* Hover state */
  focus:outline-2          /* Focus outline width */
  focus:outline-primary    /* Focus outline color */
  disabled:opacity-50      /* Disabled state */
  disabled:cursor-not-allowed
">
  Interactive
</button>
```

---

## Rules and Conventions

### ✅ DO

1. **Use Tailwind utilities exclusively**
   ```tsx
   <div className="flex items-center gap-2">
   ```

2. **Use inline styles for dynamic values**
   ```tsx
   <div style={{ backgroundColor: figmaColor }}>
   ```

3. **Use theme tokens**
   ```tsx
   <div className="bg-base text-text border-border">
   ```

4. **Group related classes**
   ```tsx
   <button className="
     px-3 py-1.5 rounded
     bg-primary text-white
     hover:bg-blue-600
     transition
   ">
   ```

### ❌ DON'T

1. **No custom CSS files for components**
   ```css
   /* ❌ Don't create Button.css */
   .button {
     padding: 0.5rem 1rem;
   }
   ```

2. **No @apply directive**
   ```css
   /* ❌ Don't use @apply */
   .btn {
     @apply px-3 py-1.5 rounded;
   }
   ```

3. **No inline <style> tags**
   ```tsx
   {/* ❌ Don't do this */}
   <style>{`.custom { color: red; }`}</style>
   ```

4. **No className for dynamic values**
   ```tsx
   {/* ❌ Won't work */}
   <div className={`bg-[${color}]`}>
   ```

---

## Dark Mode Strategy

### System Preference

We follow the system's dark mode preference:

```css
@media (prefers-color-scheme: dark) {
    :root {
        --color-base: black;
        --color-text: white;
        --color-border: var(--color-gray-700);
        --color-bg-input: var(--color-gray-800);
    }
}
```

**Components automatically adapt** using theme tokens:

```tsx
<div className="bg-base text-text">
  {/* Light mode: white bg, black text */}
  {/* Dark mode: black bg, white text */}
</div>
```

### Manual Dark Mode Classes

For specific overrides:

```tsx
<div className="bg-base dark:bg-gray-900">
  {/* Force specific colors per mode */}
</div>
```

---

## Adding New Design Tokens

### When to Add Tokens

**Add tokens when:**
- Color/value used in 3+ places
- Part of design system (brand colors, spacing scale)
- Needs dark mode support

**Don't add tokens for:**
- One-off values
- Dynamic Figma colors
- Temporary/experimental styles

### How to Add Tokens

1. **Edit `src/ui/styles/main.css`:**

```css
@theme {
    /* Existing tokens... */

    /* New token */
    --color-success: var(--color-green-500);
    --color-error: var(--color-red-500);
}

/* Dark mode override if needed */
@media (prefers-color-scheme: dark) {
    :root {
        --color-success: var(--color-green-400);
        --color-error: var(--color-red-400);
    }
}
```

2. **Use in components:**

```tsx
<div className="text-success">Success message</div>
<div className="text-error">Error message</div>
```

3. **Update this file** (styles.md) with new tokens

4. **`@testing-dev` agent will review and verify**

---

## Figma Plugin Specifics

### Figma Color Format

Figma uses 0-1 range for colors:

```typescript
// Figma format
{ r: 1, g: 0, b: 0, a: 1 }  // Red

// Convert to CSS
const cssColor = `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a})`;
```

**Use inline styles for Figma colors:**

```tsx
<div style={{
  backgroundColor: `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a})`
}}>
```

### Plugin UI Constraints

- **No external stylesheets** - All CSS must be inline
- **No @import from CDN** - Bundle everything
- **Small bundle size** - Tailwind v4 helps (purges unused)

---

## Performance

### Tailwind v4 Optimizations

1. **Automatic purging** - Unused classes removed
2. **Lightning CSS** - Faster than PostCSS
3. **On-demand generation** - Only generate used classes

### Bundle Size

Current CSS bundle: ~15KB gzipped

**Keep it small:**
- Don't use every Tailwind class
- Avoid arbitrary values when possible
- Reuse classes across components

---

## Examples

### Form Input

```tsx
<input
  type="text"
  className="
    w-full px-2 py-1
    border border-border rounded
    bg-bg-input
    text-text
    focus:outline-2 focus:outline-primary
    focus:ring-2 focus:ring-primary
  "
/>
```

### Modal

```tsx
<div className="
  fixed inset-0 z-50
  flex items-center justify-center
  bg-black/50
">
  <div className="
    bg-base
    border border-border
    rounded-lg
    p-4
    max-w-md w-full
  ">
    Modal content
  </div>
</div>
```

### Table Row

```tsx
<tr className="
  border-b border-border
  hover:bg-base-2
  dark:hover:bg-gray-800
">
  <td className="px-2 py-1">Cell</td>
</tr>
```

---

## Troubleshooting

### Class Not Working

1. **Check spelling:** `bg-primry` → `bg-primary`
2. **Check if token exists:** Look in `@theme` in main.css
3. **Check Tailwind defaults:** [tailwindcss.com/docs](https://tailwindcss.com/docs)
4. **Use browser DevTools:** Inspect element to see applied styles

### Dark Mode Not Working

1. **Check system preference:** OS set to dark mode?
2. **Check token defined:** Does `@media (prefers-color-scheme: dark)` override exist?
3. **Use `dark:` classes:** `<div className="bg-base dark:bg-gray-900">`

### Dynamic Value Not Applying

1. **Don't use Tailwind classes for dynamic values**
2. **Use inline styles:** `style={{ color: dynamicColor }}`

---

## Related Documentation

- [components.md](components.md) - Component styling patterns
- [devnotes.md](devnotes.md) - Development workflow
- [techstack.md](techstack.md) - Tailwind v4 setup
