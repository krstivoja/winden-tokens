# Testing Guide

**How we test components and functions**

---

## Testing Stack

### Vitest 1.0
**Purpose:** Test runner

**Why:** Fast, Vite-native, Jest-compatible

**Commands:**
```bash
npm test              # Run once
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run test:ui       # Visual UI
```

---

### React Testing Library 14.1
**Purpose:** Component testing

**Why:** Test user behavior, not implementation

**Philosophy:** Test what users see and do

---

### @testing-library/user-event 14.5
**Purpose:** Simulate user interactions

**Features:**
- Click, type, hover
- Keyboard navigation
- Realistic event sequences

---

### jsdom 23.0
**Purpose:** DOM environment for tests

**Why:** Test React components without browser

---

## Test Organization

### File Placement

**Tests live next to source files:**

```
src/ui/components/common/Button/
├── Button.tsx
├── Button.test.tsx      ← Test file
└── index.ts
```

**Naming convention:** `ComponentName.test.tsx`

---

## Test Patterns

### Component Test Structure

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies variant class', () => {
    const { container } = render(<Button variant="primary">Primary</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('bg-primary');
  });

  it('is disabled when prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

---

### AAA Pattern

**Arrange, Act, Assert:**

```tsx
it('increments counter on button click', () => {
  // Arrange
  render(<Counter initialValue={0} />);

  // Act
  fireEvent.click(screen.getByText('Increment'));

  // Assert
  expect(screen.getByText('Count: 1')).toBeInTheDocument();
});
```

---

### Testing User Interactions

```tsx
import userEvent from '@testing-library/user-event';

it('allows typing in input', async () => {
  const user = userEvent.setup();
  render(<Input />);

  const input = screen.getByRole('textbox');
  await user.type(input, 'Hello');

  expect(input).toHaveValue('Hello');
});
```

**Use `userEvent` instead of `fireEvent`** for realistic interactions.

---

### Testing Props

```tsx
describe('Button props', () => {
  it('renders with icon', () => {
    const Icon = () => <span data-testid="icon">🔍</span>;
    render(<Button icon={<Icon />}>Search</Button>);

    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
  });

  it('supports different sizes', () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-sm');

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-lg');
  });
});
```

---

### Testing State

```tsx
it('toggles checkbox on click', async () => {
  const user = userEvent.setup();
  render(<Checkbox label="Accept terms" />);

  const checkbox = screen.getByRole('checkbox');
  expect(checkbox).not.toBeChecked();

  await user.click(checkbox);
  expect(checkbox).toBeChecked();

  await user.click(checkbox);
  expect(checkbox).not.toBeChecked();
});
```

---

### Testing Callbacks

```tsx
it('calls onSubmit with form data', async () => {
  const handleSubmit = vi.fn();
  const user = userEvent.setup();

  render(<Form onSubmit={handleSubmit} />);

  await user.type(screen.getByLabelText('Name'), 'John');
  await user.click(screen.getByText('Submit'));

  expect(handleSubmit).toHaveBeenCalledWith({ name: 'John' });
});
```

---

### Testing Conditional Rendering

```tsx
it('shows error message when error prop is provided', () => {
  const { rerender } = render(<Input error={undefined} />);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();

  rerender(<Input error="Required field" />);
  expect(screen.getByRole('alert')).toHaveTextContent('Required field');
});
```

---

## Testing Hooks

### Custom Hook Testing

```tsx
import { renderHook, act } from '@testing-library/react';

describe('useCounter', () => {
  it('increments counter', () => {
    const { result } = renderHook(() => useCounter(0));

    expect(result.current.count).toBe(0);

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });

  it('decrements counter', () => {
    const { result } = renderHook(() => useCounter(10));

    act(() => {
      result.current.decrement();
    });

    expect(result.current.count).toBe(9);
  });
});
```

---

## Mocking

### Mocking Functions

```tsx
import { vi } from 'vitest';

it('calls console.log on button click', () => {
  const consoleSpy = vi.spyOn(console, 'log');

  render(<Button onClick={() => console.log('clicked')}>Click</Button>);
  fireEvent.click(screen.getByText('Click'));

  expect(consoleSpy).toHaveBeenCalledWith('clicked');
});
```

---

### Mocking Modules

```tsx
import { vi } from 'vitest';

vi.mock('@/hooks/usePluginMessages', () => ({
  usePluginMessages: () => ({
    sendMessage: vi.fn(),
    onMessage: vi.fn(),
  }),
}));
```

---

### Mocking Message Passing

```tsx
describe('Plugin communication', () => {
  it('sends update message to plugin', () => {
    const mockPost = vi.fn();
    vi.spyOn(window.parent, 'postMessage').mockImplementation(mockPost);

    render(<VariableEditor />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New Name' } });
    fireEvent.click(screen.getByText('Save'));

    expect(mockPost).toHaveBeenCalledWith(
      {
        pluginMessage: {
          type: 'update-variable-name',
          id: expect.any(String),
          name: 'New Name',
        },
      },
      '*'
    );
  });
});
```

---

## Coverage Goals

### Targets

- **Components:** 80%+ coverage
- **Hooks:** 90%+ coverage
- **Utilities:** 95%+ coverage
- **Critical paths:** 100% coverage

### Check Coverage

```bash
npm run test:coverage
```

**Output:**
```
File               | % Stmts | % Branch | % Funcs | % Lines
-------------------|---------|----------|---------|--------
Button.tsx         |   95.00 |    90.00 |  100.00 |   95.00
Input.tsx          |   85.00 |    80.00 |  100.00 |   85.00
useCounter.ts      |  100.00 |   100.00 |  100.00 |  100.00
```

---

## Best Practices

### DO

1. **Test user behavior**
   ```tsx
   // ✅ Good
   expect(screen.getByText('Welcome')).toBeInTheDocument();

   // ❌ Bad
   expect(component.state.isVisible).toBe(true);
   ```

2. **Use semantic queries**
   ```tsx
   // ✅ Good
   screen.getByRole('button', { name: 'Submit' })
   screen.getByLabelText('Email')

   // ❌ Bad
   screen.getByTestId('submit-btn')
   ```

3. **Test accessibility**
   ```tsx
   expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Close');
   ```

4. **Use userEvent over fireEvent**
   ```tsx
   // ✅ Good
   await user.click(button);

   // ❌ Bad
   fireEvent.click(button);
   ```

---

### DON'T

1. **Don't test implementation details**
   ```tsx
   // ❌ Bad
   expect(component.instance().handleClick).toBeDefined();

   // ✅ Good
   fireEvent.click(screen.getByText('Click'));
   expect(handleClick).toHaveBeenCalled();
   ```

2. **Don't use test IDs unless necessary**
   ```tsx
   // ❌ Avoid
   <button data-testid="submit">Submit</button>
   screen.getByTestId('submit')

   // ✅ Better
   <button>Submit</button>
   screen.getByRole('button', { name: 'Submit' })
   ```

3. **Don't test third-party libraries**
   ```tsx
   // ❌ Don't test React itself
   it('useState works', () => { ... });

   // ✅ Test your component's behavior
   it('counter increments on click', () => { ... });
   ```

---

## Query Priority

**Use in this order:**

1. **getByRole** - `screen.getByRole('button')`
2. **getByLabelText** - `screen.getByLabelText('Email')`
3. **getByPlaceholderText** - `screen.getByPlaceholderText('Enter email')`
4. **getByText** - `screen.getByText('Submit')`
5. **getByTestId** - `screen.getByTestId('custom-element')` (last resort)

---

## Async Testing

### Waiting for Elements

```tsx
it('shows success message after submission', async () => {
  render(<Form />);

  fireEvent.click(screen.getByText('Submit'));

  // Wait for success message to appear
  const message = await screen.findByText('Success!');
  expect(message).toBeInTheDocument();
});
```

### Wait For Changes

```tsx
it('loads data on mount', async () => {
  render(<DataDisplay />);

  expect(screen.getByText('Loading...')).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText('Data loaded')).toBeInTheDocument();
  });
});
```

---

## Accessibility Testing

### ARIA Attributes

```tsx
it('has accessible label', () => {
  render(<Button aria-label="Close dialog">✕</Button>);
  expect(screen.getByRole('button')).toHaveAccessibleName('Close dialog');
});
```

### Keyboard Navigation

```tsx
it('submits form on Enter key', async () => {
  const user = userEvent.setup();
  const handleSubmit = vi.fn();

  render(<Form onSubmit={handleSubmit} />);

  const input = screen.getByRole('textbox');
  await user.type(input, 'Test{Enter}');

  expect(handleSubmit).toHaveBeenCalled();
});
```

---

## Snapshot Testing

**Use sparingly** - Prefer explicit assertions.

```tsx
import { render } from '@testing-library/react';

it('matches snapshot', () => {
  const { container } = render(<Button variant="primary">Save</Button>);
  expect(container.firstChild).toMatchSnapshot();
});
```

**When to use:**
- Complex output structures
- Generated HTML/SVG
- Documenting component API

**When NOT to use:**
- Dynamic content
- Implementation testing

---

## Test-Driven Development (TDD)

### Process

1. **Write failing test**
   ```tsx
   it('increments counter', () => {
     // This will fail initially
     render(<Counter />);
     fireEvent.click(screen.getByText('Increment'));
     expect(screen.getByText('Count: 1')).toBeInTheDocument();
   });
   ```

2. **Implement minimum code to pass**
   ```tsx
   export function Counter() {
     const [count, setCount] = useState(0);
     return (
       <div>
         <p>Count: {count}</p>
         <button onClick={() => setCount(count + 1)}>Increment</button>
       </div>
     );
   }
   ```

3. **Refactor**
   - Improve code quality
   - Tests still pass

---

## Running Tests

### Watch Mode

```bash
npm run test:watch
```

**Features:**
- Auto-runs on file save
- Only tests changed files
- Press `a` to run all tests

### Single File

```bash
npm test -- Button.test.tsx
```

### Pattern Matching

```bash
npm test -- --grep="Button"
```

### UI Mode

```bash
npm run test:ui
```

Opens visual interface for debugging tests.

---

## Debugging Tests

### Console Logging

```tsx
import { screen, render } from '@testing-library/react';

it('debugs component', () => {
  render(<Component />);

  // Print entire DOM
  screen.debug();

  // Print specific element
  screen.debug(screen.getByRole('button'));
});
```

### Browser Debugging

```tsx
it('debugs in browser', () => {
  render(<Component />);

  // Opens browser with component
  screen.logTestingPlaygroundURL();
});
```

---

## Related Documentation

- [devnotes.md](devnotes.md) - Development workflow
- [components.md](components.md) - Component patterns
- [techstack.md](techstack.md) - Technologies used
