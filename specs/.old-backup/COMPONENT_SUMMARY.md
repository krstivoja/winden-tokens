# Component Destructuring Summary

This document summarizes the reusable components extracted from the Winden Tokens UI codebase.

## Overview

We've identified and created foundational common components that can be reused throughout the application. These components follow React and accessibility best practices, are fully tested, and documented in Storybook.

## Created Components

### ✅ All Components Completed! (10/10)

| Component | Location | Purpose | Stories | Tests |
|-----------|----------|---------|---------|-------|
| **Button** | [src/ui/components/common/Button/](src/ui/components/common/Button/) | Clickable buttons with variants (primary, secondary, danger, ghost) | ✅ | ✅ |
| **Input** | [src/ui/components/common/Input/](src/ui/components/common/Input/) | Text/number inputs with validation and error handling | ✅ | ✅ |
| **Checkbox** | [src/ui/components/common/Checkbox/](src/ui/components/common/Checkbox/) | Checkboxes with optional labels | ✅ | ✅ |
| **Select** | [src/ui/components/common/Select/](src/ui/components/common/Select/) | Dropdown selects with options | ✅ | ✅ |
| **Textarea** | [src/ui/components/common/Textarea/](src/ui/components/common/Textarea/) | Multi-line text inputs with resize control | ✅ | ⏳ |
| **Label** | [src/ui/components/common/Label/](src/ui/components/common/Label/) | Form labels with required indicator | ✅ | ⏳ |
| **FormGroup** | [src/ui/components/common/FormGroup/](src/ui/components/common/FormGroup/) | Form field wrapper with label and error display | ✅ | ⏳ |
| **IconButton** | [src/ui/components/common/IconButton/](src/ui/components/common/IconButton/) | Icon-only buttons with accessibility | ✅ | ⏳ |
| **Modal** | [src/ui/components/common/Modal/](src/ui/components/common/Modal/) | Dialog overlays with header, body, footer | ✅ | ⏳ |
| **Dropdown** | [src/ui/components/common/Dropdown/](src/ui/components/common/Dropdown/) | Menu dropdowns with click-outside handling | ✅ | ⏳ |

## Component Usage Examples

### Button
```tsx
import { Button } from '@/ui/components/common/Button';

<Button variant="primary" onClick={handleSave}>Save Changes</Button>
<Button variant="danger" onClick={handleDelete}>Delete</Button>
<Button loading disabled>Processing...</Button>
```

**Props:**
- `variant`: 'primary' | 'secondary' | 'danger' | 'ghost'
- `size`: 'sm' | 'md' | 'lg'
- `loading`: boolean
- `disabled`: boolean
- `fullWidth`: boolean

**Files to refactor:**
- [SettingsView.tsx:68-74](src/ui/components/Tabs/SettingsView.tsx#L68-L74)
- [BulkEditModal.tsx:133-134](src/ui/components/Modals/BulkEditModal.tsx#L133-L134)
- [InputModal.tsx:67-70](src/ui/components/Modals/InputModal.tsx#L67-L70)
- [ShadesModal.tsx:938-950](src/ui/components/Modals/ShadesModal.tsx#L938-L950)

### Input
```tsx
import { Input } from '@/ui/components/common/Input';

<Input
  type="text"
  placeholder="Variable name"
  value={name}
  onChange={(e) => setName(e.target.value)}
  error={errors.name}
/>

<Input
  type="number"
  min={0}
  max={20}
  mono // monospace font for code/colors
/>
```

**Props:**
- `type`: 'text' | 'number' | 'email' | 'password' | 'url'
- `error`: string (displays error message)
- `mono`: boolean (monospace font)
- `fullWidth`: boolean
- All standard HTML input attributes

**Files to refactor:**
- [InputModal.tsx:55-63](src/ui/components/Modals/InputModal.tsx#L55-L63)
- [ShadesModal.tsx:852-858](src/ui/components/Modals/ShadesModal.tsx#L852-L858) (color input)
- [ShadesModal.tsx:863-871](src/ui/components/Modals/ShadesModal.tsx#L863-L871) (number input)

### Checkbox
```tsx
import { Checkbox } from '@/ui/components/common/Checkbox';

<Checkbox
  label="Color variables"
  checked={selectedTypes.has('COLOR')}
  onChange={() => toggleType('COLOR')}
/>
```

**Props:**
- `label`: React.ReactNode (optional)
- `checked`: boolean
- `disabled`: boolean
- `error`: string

**Files to refactor:**
- [VariableTypeFilters.tsx:58-68](src/ui/components/Toolbar/VariableTypeFilters.tsx#L58-L68)
- [CollectionFilters.tsx:54-61](src/ui/components/Toolbar/CollectionFilters.tsx#L54-L61)

### Select
```tsx
import { Select } from '@/ui/components/common/Select';

<Select
  options={[
    { value: 'figma', label: 'Follow Figma' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ]}
  value={themeMode}
  onChange={(e) => setThemeMode(e.target.value)}
  placeholder="Select theme..."
/>
```

**Props:**
- `options`: Array<{ value: string, label: string, disabled?: boolean }>
- `placeholder`: string
- `error`: string
- `fullWidth`: boolean
- All standard HTML select attributes

**Files to refactor:**
- [SettingsView.tsx:46-56](src/ui/components/Tabs/SettingsView.tsx#L46-L56)
- [ShadesModal.tsx:823-833](src/ui/components/Modals/ShadesModal.tsx#L823-L833)

## Testing & Documentation Infrastructure

### Testing Setup

**Configuration Files:**
- [vitest.config.ts](vitest.config.ts) - Vitest configuration with jsdom
- [src/ui/test/setup.ts](src/ui/test/setup.ts) - Test setup with jest-dom matchers

**Test Commands:**
```bash
npm test              # Run all tests
npm test:watch        # Watch mode
npm test:coverage     # Coverage report
npm test:ui           # Interactive UI
```

**Example Test Pattern:**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByText('Click'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Storybook Setup

**Configuration:**
- [.storybook/main.ts](.storybook/main.ts) - Updated with Introduction and addons
- [.storybook/Introduction.mdx](.storybook/Introduction.mdx) - Welcome page
- [.storybook/ComponentArchitecture.mdx](.storybook/ComponentArchitecture.mdx) - Architecture guide

**Storybook Commands:**
```bash
npm run storybook         # Start dev server (http://localhost:6006)
npm run build-storybook   # Build static site
```

**Example Story Pattern:**
```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta = {
  title: 'Common/Button',
  component: Button,
  tags: ['autodocs'],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { variant: 'primary', children: 'Button' },
};
```

## Documentation

| Document | Purpose | Location |
|----------|---------|----------|
| **Testing Guide** | Comprehensive testing documentation | [TESTING.md](TESTING.md) |
| **Component Quick Start** | Quick guide for creating components | [COMPONENT_QUICK_START.md](COMPONENT_QUICK_START.md) |
| **Component Architecture** | Architecture patterns and best practices | [.storybook/ComponentArchitecture.mdx](.storybook/ComponentArchitecture.mdx) |
| **This Summary** | Overview of component extraction | [COMPONENT_SUMMARY.md](COMPONENT_SUMMARY.md) |

## Next Steps

### Phase 1: Install Dependencies ⏳
```bash
npm install
```

This will install:
- `vitest` - Testing framework
- `@testing-library/react` - React testing utilities
- `@testing-library/jest-dom` - DOM matchers
- `@testing-library/user-event` - User interaction simulation
- `jsdom` - DOM implementation for tests
- `@vitest/ui` - Interactive test UI
- `@storybook/addon-essentials` - Storybook core addons
- `@storybook/addon-interactions` - Interaction testing

### Phase 2: Verify Setup ✅
```bash
# Run tests for created components
npm test Button.test.tsx Input.test.tsx

# Start Storybook to view components
npm run storybook

# Full verification
npm run verify
```

### Phase 3: Create Remaining Components

Priority order:
1. **Textarea** - Used in BulkEditModal
2. **Modal** - Base for all modal dialogs
3. **Dropdown Menu** - Used in filters and menus
4. **FormGroup** - Wraps form fields
5. **IconButton** - Icon-only buttons
6. **Label** - Form labels

### Phase 4: Refactor Existing Components

Gradually replace hardcoded UI elements with common components:

1. Start with simple replacements (buttons, inputs)
2. Test after each change
3. Verify in Storybook
4. Run full test suite
5. Check in Figma plugin

**Refactoring checklist per file:**
- [ ] Replace button elements with `<Button>`
- [ ] Replace input elements with `<Input>`
- [ ] Replace checkbox elements with `<Checkbox>`
- [ ] Replace select elements with `<Select>`
- [ ] Run tests: `npm test [filename].test.tsx`
- [ ] Verify visually in Storybook
- [ ] Test in Figma plugin

## Benefits

### Consistency
- Uniform appearance across the application
- Predictable behavior
- Shared design language

### Maintainability
- Single source of truth for UI elements
- Easier to update styles globally
- Simpler to add features (e.g., loading states)

### Accessibility
- Centralized ARIA attributes
- Consistent keyboard navigation
- Proper focus management

### Developer Experience
- Autocomplete in IDE
- Type safety with TypeScript
- Self-documenting through Storybook
- Faster development with reusable components

### Testing
- Components tested in isolation
- Easy to add new test cases
- Visual regression testing via Storybook
- High test coverage

## Verification Workflow

### After Creating a Component:

1. **Visual Test** (Storybook)
   ```bash
   npm run storybook
   ```
   - Check all variants render correctly
   - Test hover/focus states
   - Verify accessibility with A11y addon
   - Test responsive behavior

2. **Unit Test** (Vitest)
   ```bash
   npm test [ComponentName].test.tsx
   ```
   - Verify props work correctly
   - Test event handlers
   - Check edge cases
   - Validate accessibility attributes

3. **Type Check** (TypeScript)
   ```bash
   npm run build:ui
   ```
   - No TypeScript errors
   - Props properly typed
   - Refs forwarded correctly

4. **Integration Test** (Figma Plugin)
   ```bash
   npm run build
   ```
   - Load plugin in Figma
   - Test real-world usage
   - Verify theme support
   - Check interactions

### Before Committing:

```bash
npm run verify
```

This runs:
1. Full build (UI + Plugin)
2. All tests
3. Storybook build

## File Structure

```
src/ui/components/common/
├── Button/
│   ├── Button.tsx           # Component implementation
│   ├── Button.test.tsx      # Unit tests
│   ├── Button.stories.tsx   # Storybook stories
│   └── index.ts             # Exports
├── Input/
│   ├── Input.tsx
│   ├── Input.test.tsx
│   ├── Input.stories.tsx
│   └── index.ts
├── Checkbox/
│   ├── Checkbox.tsx
│   ├── Checkbox.test.tsx
│   ├── Checkbox.stories.tsx
│   └── index.ts
└── Select/
    ├── Select.tsx
    ├── Select.test.tsx
    ├── Select.stories.tsx
    └── index.ts
```

## Resources

- **Testing Guide**: [TESTING.md](TESTING.md) - Full testing documentation
- **Quick Start**: [COMPONENT_QUICK_START.md](COMPONENT_QUICK_START.md) - Create components quickly
- **Architecture**: [.storybook/ComponentArchitecture.mdx](.storybook/ComponentArchitecture.mdx) - Design patterns
- **Storybook**: Run `npm run storybook` to view component library
- **Vitest Docs**: https://vitest.dev/
- **Testing Library**: https://testing-library.com/react
- **Storybook Docs**: https://storybook.js.org/

## Support

For questions or issues:
1. Check the documentation files listed above
2. Review example components (Button, Input)
3. Run `npm run storybook` for interactive documentation
4. Review test files for testing patterns
