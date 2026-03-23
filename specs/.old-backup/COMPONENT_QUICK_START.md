# Component Quick Start Guide

This guide will walk you through creating, testing, and verifying new common components.

## Setup (One-time)

Install testing dependencies:

```bash
npm install
```

## Creating a New Component (5 Steps)

### Step 1: Create the Component File

Create your component in `src/ui/components/common/[ComponentName]/[ComponentName].tsx`

Example structure:
```typescript
// src/ui/components/common/Button/Button.tsx
import React from 'react';

export interface ButtonProps {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
}

export function Button({ variant = 'secondary', children }: ButtonProps) {
  return <button className={`btn btn-${variant}`}>{children}</button>;
}
```

### Step 2: Create Storybook Story

Create `[ComponentName].stories.tsx` in the same folder:

```typescript
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta = {
  title: 'Common/Button',
  component: Button,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { variant: 'primary', children: 'Primary Button' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Secondary Button' },
};
```

### Step 3: Create Test File

Create `[ComponentName].test.tsx` in the same folder:

```typescript
// Button.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByText('Click'));
    expect(handleClick).toHaveBeenCalled();
  });
});
```

### Step 4: Create Index Export

Create `index.ts` in the same folder:

```typescript
// index.ts
export { Button } from './Button';
export type { ButtonProps } from './Button';
```

### Step 5: Verify Your Component

Run all verification steps:

```bash
# 1. Visual testing (opens browser)
npm run storybook

# 2. Unit tests
npm test

# 3. Type checking
npm run build

# 4. Full verification
npm run verify
```

## Workflow for Iterating on Components

### Live Development with Storybook

```bash
# Terminal 1: Start Storybook
npm run storybook

# Terminal 2: Run tests in watch mode
npm test:watch
```

Now make changes to your component:
1. **Storybook** auto-reloads to show visual changes
2. **Tests** auto-run when you save files
3. Check both for instant feedback

### Quick Verification Commands

```bash
# Run tests once
npm test

# Run tests with coverage
npm test:coverage

# Run specific test file
npm test Button.test.tsx

# Type check only
npm run build:ui
```

## Testing Checklist for New Components

When you create a new component, test these scenarios:

### Visual Testing (Storybook)
- [ ] Component renders correctly
- [ ] All variants display properly
- [ ] Hover states work
- [ ] Focus states are visible
- [ ] Disabled states look correct
- [ ] Responsive behavior works
- [ ] Accessibility check passes (A11y addon)

### Unit Testing (Vitest)
- [ ] Component renders with default props
- [ ] Props are applied correctly
- [ ] Event handlers are called
- [ ] Edge cases are handled
- [ ] Accessibility attributes present

## Common Patterns

### Testing Button Clicks
```typescript
const handleClick = vi.fn();
render(<Button onClick={handleClick}>Click</Button>);
fireEvent.click(screen.getByText('Click'));
expect(handleClick).toHaveBeenCalledTimes(1);
```

### Testing Input Changes
```typescript
const handleChange = vi.fn();
render(<Input onChange={handleChange} />);
fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
expect(handleChange).toHaveBeenCalled();
```

### Testing with User Event (More Realistic)
```typescript
import { userEvent } from '@testing-library/user-event';

it('types into input', async () => {
  const user = userEvent.setup();
  render(<Input />);
  const input = screen.getByRole('textbox');
  await user.type(input, 'Hello');
  expect(input).toHaveValue('Hello');
});
```

### Testing Accessibility
```typescript
it('has correct aria attributes', () => {
  render(<Button aria-label="Close">×</Button>);
  expect(screen.getByLabelText('Close')).toBeInTheDocument();
});
```

## Example: Complete Component with Tests

See these reference implementations:
- [Button](src/ui/components/common/Button/) - Complete example with all variants
- [Input](src/ui/components/common/Input/) - Ref forwarding example
- [Checkbox](src/ui/components/common/Checkbox/) - Label composition example

## Debugging Tips

### Visual Debugging
```typescript
import { screen } from '@testing-library/react';

// Print current DOM
screen.debug();

// Print specific element
screen.debug(screen.getByText('Button'));
```

### Storybook Debugging
- Open browser DevTools (F12)
- Use "Actions" addon to log events
- Use "Controls" addon to test props
- Use "Accessibility" addon to check a11y

### Test Debugging
```bash
# Run tests with verbose output
npm test -- --reporter=verbose

# Run single test in UI mode
npm run test:ui
```

## Next Steps

After creating your component:

1. **Use it in existing components** - Refactor components to use your new common component
2. **Document edge cases** - Add stories for error states, loading states, etc.
3. **Add interaction tests** - Use `@storybook/addon-interactions` for complex flows
4. **Update this guide** - If you find new patterns, document them here

## Common Issues

### Tests failing with "not wrapped in act(...)"
```typescript
// Fix: Use async/await with user events
import { userEvent } from '@testing-library/user-event';

it('clicks button', async () => {
  const user = userEvent.setup();
  render(<Button>Click</Button>);
  await user.click(screen.getByText('Click'));
});
```

### Storybook not showing component
```bash
# Regenerate stories
npm run generate-stories

# Clear cache
rm -rf node_modules/.cache storybook-static
npm run storybook
```

### TypeScript errors in tests
```bash
# Rebuild types
npm run build:plugin
```

## Resources

- [Full Testing Guide](TESTING.md) - Comprehensive testing documentation
- [Vitest Docs](https://vitest.dev/)
- [Testing Library Docs](https://testing-library.com/react)
- [Storybook Docs](https://storybook.js.org/)
