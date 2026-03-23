# Styling Guide

This document defines the styling approach, conventions, and rules for the Winden Tokens Figma plugin. **All styling must follow these specifications.**

## Styling System

### Technology: Tailwind CSS v4.2.2

**DO use:**
- ✅ Tailwind v4 utility classes ONLY
- ✅ Inline styles for dynamic values (colors, positions, etc.)
- ✅ CSS custom properties via Tailwind's @theme

**DO NOT use:**
- ❌ Custom CSS classes or stylesheets
- ❌ `@apply` directive
- ❌ SCSS/Sass
- ❌ CSS-in-JS (styled-components, emotion, etc.)
- ❌ Tailwind v3 or earlier
- ❌ PostCSS config files (handled by Tailwind Vite plugin)

## Philosophy

We use **utility-first styling exclusively** with Tailwind classes. No custom CSS files are needed.

- All styling is done directly in components using Tailwind utility classes
- Dynamic values (colors, sizes from Figma) are applied via inline styles
- Component composition and reusability is achieved through React components, not CSS
- Tailwind's design system provides all the primitives we need

## File Organization

```
src/
└── ui/
    └── components/
        └── [ComponentName]/
            └── ComponentName.tsx  # Contains all Tailwind classes
```

No separate CSS files are needed.

## Styling Examples

### Basic Component
```tsx
export function Button({ children, variant = 'primary' }) {
  const baseClasses = 'px-4 py-2 rounded font-medium transition-colors';

  const variantClasses = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
    danger: 'bg-red-500 text-white hover:bg-red-600',
  };

  return (
    <button className={`${baseClasses} ${variantClasses[variant]}`}>
      {children}
    </button>
  );
}
```

### Dynamic Values
```tsx
export function ColorSwatch({ color }) {
  return (
    <div
      className="w-6 h-6 rounded border border-gray-300"
      style={{ backgroundColor: color }}
    />
  );
}
```

### Responsive Design
```tsx
export function Card({ children }) {
  return (
    <div className="p-4 sm:p-6 md:p-8 rounded-lg shadow-sm border border-gray-200">
      {children}
    </div>
  );
}
```

## Common Patterns

### Layout
- Flexbox: `flex`, `flex-col`, `items-center`, `justify-between`, `gap-4`
- Grid: `grid`, `grid-cols-3`, `gap-6`
- Spacing: `p-4`, `px-6`, `py-2`, `m-4`, `mx-auto`, `space-y-4`

### Typography
- Sizes: `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`
- Weight: `font-normal`, `font-medium`, `font-semibold`, `font-bold`
- Color: `text-gray-900`, `text-gray-600`, `text-blue-500`

### Colors
- Background: `bg-white`, `bg-gray-50`, `bg-blue-500`
- Text: `text-gray-900`, `text-white`, `text-red-500`
- Border: `border-gray-200`, `border-blue-500`

### Interactive States
- Hover: `hover:bg-gray-100`, `hover:text-blue-600`
- Focus: `focus:outline-none`, `focus:ring-2`, `focus:ring-blue-500`
- Active: `active:bg-gray-200`
- Disabled: `disabled:opacity-50`, `disabled:cursor-not-allowed`

### Borders & Shadows
- Border: `border`, `border-2`, `border-t`, `border-gray-300`
- Border radius: `rounded`, `rounded-md`, `rounded-lg`, `rounded-full`
- Shadow: `shadow-sm`, `shadow`, `shadow-md`, `shadow-lg`

## Component Class Organization

Keep className strings readable by grouping related utilities:

```tsx
<div className={`
  /* Layout */
  flex items-center justify-between gap-4
  /* Sizing */
  w-full h-12 px-4
  /* Visual */
  bg-white border border-gray-200 rounded-lg shadow-sm
  /* Typography */
  text-sm font-medium text-gray-900
  /* Interactive */
  hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500
  /* State */
  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
`}>
  {children}
</div>
```

## Conditional Classes

Use template literals for dynamic classes:

```tsx
const classes = `
  base-classes-here
  ${variant === 'primary' ? 'bg-blue-500' : 'bg-gray-200'}
  ${isActive ? 'ring-2 ring-blue-500' : ''}
  ${disabled ? 'opacity-50' : ''}
`.trim();

<button className={classes}>Click me</button>
```

## CSS Variables

If you need design tokens accessible from both CSS and JS, define them via Tailwind's @theme system (when needed):

```css
/* src/tailwind.plugin.css */
@theme {
  --color-brand-primary: #3b82f6;
  --color-brand-secondary: #10b981;
}
```

Then use in components:
```tsx
<div className="bg-brand-primary text-white" />
```

## Rules

1. **Never create custom CSS classes** - Use Tailwind utilities only
2. **Use inline styles for dynamic values** - Colors from Figma, positions, etc.
3. **Component composition over CSS composition** - Build reusable React components
4. **Keep utility classes grouped logically** - Layout, sizing, visual, typography, interactive
5. **Use template literals for conditional styling** - Clean and readable
6. **Avoid `@apply`** - It defeats the purpose of utility-first CSS

## Migration Notes

This project was previously using custom CSS with @apply directives. All custom CSS has been removed in favor of pure Tailwind utilities for:

- Better readability (see all styles at component level)
- Easier maintenance (no context switching between files)
- Smaller bundle size (Tailwind tree-shakes unused utilities)
- More predictable styling (no CSS specificity issues)
