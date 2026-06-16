# Technology Stack

**What we use and how we write code**

---

## Core Technologies

### React 18.2
**Purpose:** UI framework

**Why:** Component-based, declarative, industry standard

**Usage:**
- Functional components only
- Hooks for state and effects
- No class components

**Example:**
```tsx
export function Button({ children, onClick }: ButtonProps) {
  return <button onClick={onClick}>{children}</button>;
}
```

---

### TypeScript 5.3
**Purpose:** Type safety

**Why:** Catch errors at compile time, better IDE support

**Rules:**
- All files use `.ts` or `.tsx`
- No `any` type (use `unknown` if needed)
- Explicit return types on functions
- Props interfaces for all components

**Example:**
```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary';
  onClick?: () => void;
  children: React.ReactNode;
}

export function Button({ variant = 'primary', onClick, children }: ButtonProps): JSX.Element {
  return <button onClick={onClick}>{children}</button>;
}
```

---

### Tailwind CSS v4.2
**Purpose:** Styling

**Why:** Utility-first, no CSS files, fast

**Approach:**
- Only Tailwind utilities
- No custom CSS (except `@theme`)
- Inline styles for dynamic values

See [styles.md](styles.md) for details.

---

### Vite 5.0
**Purpose:** Build tool

**Why:** Fast, modern, ESM-native

**Features:**
- Hot module reload (< 1s)
- Single-file build output
- Tailwind v4 plugin
- TypeScript support

**Config:** `vite.config.ts`

---

### Vitest 1.0
**Purpose:** Testing framework

**Why:** Vite-native, fast, Jest-compatible API

**Features:**
- Hot reload in watch mode
- Coverage reports
- UI mode for debugging
- jsdom for React testing

See [testing.md](testing.md) for patterns.

---

## React Libraries

### React Testing Library 14.1
**Purpose:** Component testing

**Why:** Tests user behavior, not implementation

**Philosophy:** Test what users see and do

---

### @xyflow/react 12.10
**Purpose:** Graph visualization (Relationships view)

**Why:** Interactive node graphs, pan/zoom, layout

**Usage:** Dependency graph for variable aliases

---

## Development Tools

### TypeScript Compiler (tsc)
**Purpose:** Compile plugin code

**Two configs:**
- `tsconfig.json` - UI (React, DOM)
- `tsconfig.plugin.json` - Plugin (Figma API, no DOM)

---

### Concurrently 8.2
**Purpose:** Run multiple commands

**Usage:**
```bash
concurrently "vite" "tsc --watch"
```

---

### @figma/plugin-typings 1.98
**Purpose:** TypeScript types for Figma API

**Provides:** Types for `figma.*` objects

---

## Build Plugins

### @tailwindcss/vite 4.2
**Purpose:** Tailwind v4 support in Vite

**Features:**
- Lightning CSS engine
- Automatic purging
- `@theme` support

---

### @vitejs/plugin-react 4.2
**Purpose:** React support in Vite

**Features:**
- JSX transformation
- Fast refresh
- React DevTools

---

### vite-plugin-singlefile 0.13
**Purpose:** Inline CSS/JS into HTML

**Why:** Figma plugins need single-file UI

**Output:** `dist/index.html` with everything inline

---

## Coding Standards

### Components

**Rules:**
1. Functional components only
2. Use `forwardRef` for form elements
3. Export props interface
4. One component per file

**Example:**
```tsx
import { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, ...props }, ref) {
    return (
      <div>
        {label && <label>{label}</label>}
        <input ref={ref} {...props} />
        {error && <span>{error}</span>}
      </div>
    );
  }
);
```

---

### Hooks

**Rules:**
1. Prefix with `use`
2. Put in `src/ui/hooks/`
3. One hook per file
4. Export hook and return type

**Example:**
```tsx
export function useCounter(initial: number = 0) {
  const [count, setCount] = useState(initial);

  const increment = () => setCount(c => c + 1);
  const decrement = () => setCount(c => c - 1);

  return { count, increment, decrement };
}
```

---

### Types

**Rules:**
1. Define interfaces for all props
2. Export interfaces
3. Use `type` for unions/intersections
4. Use `interface` for objects

**Example:**
```typescript
// Props interface
export interface ButtonProps {
  variant: 'primary' | 'secondary';
  children: React.ReactNode;
}

// Union type
export type VariableType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';

// Object interface
export interface Variable {
  id: string;
  name: string;
  type: VariableType;
  value: unknown;
}
```

---

### Imports

**Rules:**
1. Use absolute imports with `@/`
2. Group imports: external, internal, types
3. Use barrel exports

**Example:**
```tsx
// External
import { useState } from 'react';

// Internal
import { Button } from '@/components/common/Button';
import { useCounter } from '@/hooks/useCounter';

// Types
import type { Variable } from '@/types/Variable';
```

---

### File Naming

**Conventions:**
- **Components:** PascalCase (`Button.tsx`)
- **Hooks:** camelCase (`useCounter.ts`)
- **Types:** PascalCase (`Variable.ts`)
- **Tests:** Match source + `.test` (`Button.test.tsx`)

---

## Code Style

### Formatting

**No formatter config** - Use defaults

**Guidelines:**
- 2 spaces indentation
- Single quotes
- Trailing commas
- Semicolons

---

### Best Practices

1. **DRY (Don't Repeat Yourself)**
   - Extract repeated code into components/functions
   - If repeated > 2 times, extract immediately

2. **Single Responsibility**
   - One component, one job
   - Keep components small (< 150 lines)

3. **Composition over Inheritance**
   - Use component composition
   - No class inheritance

4. **Explicit over Implicit**
   - Explicit types
   - Explicit return types
   - Named exports (not default)

---

## Package Management

### NPM

**Scripts:**
```json
{
  "dev": "Vite dev server + tsc watch",
  "build": "Vite build + tsc",
  "test": "Vitest run",
  "test:watch": "Vitest watch",
  "verify": "Build + test"
}
```

**Dependencies:**
- `react`, `react-dom` - UI framework
- `@xyflow/react` - Graph visualization

**DevDependencies:**
- All build tools, testing, types

---

## Version Requirements

### Node.js
**Required:** Node 18+

**Check:**
```bash
node --version  # Should be v18.x or higher
```

### NPM
**Required:** NPM 9+

**Check:**
```bash
npm --version  # Should be 9.x or higher
```

---

## Dependency Updates

### When to Update

**Update immediately:**
- Security patches
- Bug fixes

**Update carefully:**
- Major versions
- Breaking changes

**Test after updating:**
```bash
npm install
npm run verify
```

---

## Browser Support

**Target:** Modern browsers (last 2 versions)

**Figma Desktop:** Chromium-based (always latest)

**No need for:**
- IE11 support
- Polyfills
- Babel

---

## Related Documentation

- [devnotes.md](devnotes.md) - Development workflow
- [styles.md](styles.md) - Tailwind CSS usage
- [components.md](components.md) - Component patterns
- [testing.md](testing.md) - Testing approach
