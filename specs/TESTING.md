# Testing Guide for Winden Tokens Plugin

This guide explains how to test components and verify changes in the Winden Tokens Figma plugin.

## Quick Start

```bash
# Install testing dependencies (first time only)
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom

# Run tests
npm test

# Run tests in watch mode (auto-reload on changes)
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run Storybook (visual testing)
npm run storybook
```

## Testing Approaches

### 1. Visual Testing with Storybook (Recommended for UI Components)

**Best for:** Verifying visual appearance, interactions, and states

```bash
# Start Storybook development server
npm run storybook

# Build static Storybook for deployment
npm run build-storybook
```

**How to use:**
1. Start Storybook: `npm run storybook`
2. Open http://localhost:6006 in your browser
3. Navigate to your component (e.g., "Common/Button")
4. Test different variants using the Controls panel
5. Check accessibility with the A11y addon

**Example workflow:**
- Make changes to [Button.tsx](src/ui/components/common/Button/Button.tsx)
- Storybook auto-reloads
- Verify visually in the browser
- Test all variants (Primary, Secondary, Danger, etc.)
- Check responsive behavior and accessibility

### 2. Unit Testing with Vitest

**Best for:** Testing component logic, props, events, and edge cases

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test Button.test.tsx

# Run tests with coverage report
npm test -- --coverage
```

**Example test file structure:**

```typescript
// Button.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies primary variant class', () => {
    const { container } = render(<Button variant="primary">Primary</Button>);
    expect(container.querySelector('.btn-primary')).toBeInTheDocument();
  });

  it('disables button when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByText('Disabled')).toBeDisabled();
  });
});
```

### 3. Testing in Figma (Plugin Integration Testing)

**Best for:** Testing full plugin functionality in real Figma environment

**Steps:**
1. Build the plugin: `npm run build`
2. Open Figma Desktop
3. Go to Plugins → Development → Import plugin from manifest
4. Select the [manifest.json](manifest.json) file from this project
5. Test the plugin functionality

**What to test:**
- Variable creation/editing/deletion
- Collection management
- Color picker functionality
- Shade generation
- Theme switching
- Contrast checking

### 4. Type Checking

**Best for:** Catching TypeScript errors before runtime

```bash
# Check types for UI code
npm run build:ui

# Check types for plugin code
npm run build:plugin

# Check all types
npm run build
```

## Component Testing Checklist

When creating or modifying a component, verify:

### Visual Tests (Storybook)
- [ ] Component renders correctly in all variants
- [ ] Hover states work properly
- [ ] Focus states are visible (keyboard navigation)
- [ ] Disabled states look correct
- [ ] Responsive behavior works
- [ ] Dark/light theme support
- [ ] Accessibility check passes (A11y addon)

### Unit Tests (Vitest)
- [ ] Component renders with default props
- [ ] All props are applied correctly
- [ ] Event handlers are called
- [ ] Edge cases are handled (empty state, error state, etc.)
- [ ] Accessibility attributes are present (aria-*, role, etc.)

### Integration Tests (Figma Plugin)
- [ ] Component works in real plugin context
- [ ] Plugin messages are sent/received correctly
- [ ] Figma API calls work as expected
- [ ] State updates correctly

### Type Safety
- [ ] No TypeScript errors
- [ ] Props are properly typed
- [ ] Ref forwarding works (if applicable)

## Test File Organization

```
src/ui/components/common/
├── Button/
│   ├── Button.tsx           # Component implementation
│   ├── Button.test.tsx      # Unit tests
│   ├── Button.stories.tsx   # Storybook stories
│   └── index.ts             # Exports
```

## Running Tests Before Commit

Add this to your workflow:

```bash
# Full verification before committing
npm run build && npm test && npm run build-storybook
```

## CI/CD Integration

The project uses GitHub Actions for automated testing. See [.github/workflows/](.github/workflows/) for configuration.

Tests run automatically on:
- Pull requests
- Pushes to main branch
- Manual workflow dispatch

## Common Testing Patterns

### Testing Button Clicks
```typescript
const handleClick = vi.fn();
render(<Button onClick={handleClick}>Click</Button>);
fireEvent.click(screen.getByText('Click'));
expect(handleClick).toHaveBeenCalled();
```

### Testing Input Changes
```typescript
const handleChange = vi.fn();
render(<Input onChange={handleChange} />);
const input = screen.getByRole('textbox');
fireEvent.change(input, { target: { value: 'test' } });
expect(handleChange).toHaveBeenCalled();
```

### Testing Checkbox Toggle
```typescript
const handleChange = vi.fn();
render(<Checkbox label="Accept" onChange={handleChange} />);
const checkbox = screen.getByLabelText('Accept');
fireEvent.click(checkbox);
expect(handleChange).toHaveBeenCalled();
```

### Testing Async Behavior
```typescript
it('shows loading state', async () => {
  render(<Button loading>Save</Button>);
  expect(screen.getByText('Loading...')).toBeInTheDocument();
});
```

## Debugging Tests

### Visual Debugging in Storybook
- Use the browser DevTools while Storybook is running
- Use the "Actions" addon to log events
- Use the "Controls" addon to test different prop combinations

### Unit Test Debugging
```typescript
import { screen } from '@testing-library/react';

// Print current DOM
screen.debug();

// Print specific element
screen.debug(screen.getByText('Button'));
```

### Figma Plugin Debugging
- Open Figma DevTools: Right-click → Inspect
- Check Console for errors
- Use `console.log()` in [code.ts](src/plugin/code.ts) or [ui components](src/ui/)

## Best Practices

1. **Test user behavior, not implementation**
   - ✅ Test that clicking a button calls a function
   - ❌ Test that setState was called with specific arguments

2. **Use accessibility selectors**
   - ✅ `screen.getByRole('button', { name: 'Submit' })`
   - ❌ `container.querySelector('.btn-primary')`

3. **Keep tests simple and focused**
   - One test = one behavior
   - Avoid testing multiple things in one test

4. **Use Storybook for visual regression**
   - Create stories for all visual states
   - Review changes visually before committing

5. **Mock external dependencies**
   - Mock Figma API calls in unit tests
   - Use Storybook for isolated component testing

## Troubleshooting

### Storybook won't start
```bash
# Clear cache and reinstall
rm -rf node_modules .storybook-cache
npm install
npm run storybook
```

### Tests failing after dependency update
```bash
# Clear test cache
npm test -- --clearCache
```

### TypeScript errors in tests
```bash
# Regenerate types
npm run build:plugin
```

### Plugin not loading in Figma
```bash
# Rebuild and check manifest
npm run build
# Verify manifest.json is valid JSON
# Check that "main" and "ui" paths in manifest.json exist in dist/
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Storybook Documentation](https://storybook.js.org/)
- [Figma Plugin API](https://www.figma.com/plugin-docs/)
- [WCAG Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
