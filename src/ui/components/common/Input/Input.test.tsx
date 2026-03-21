// Input component tests

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from './Input';

describe('Input', () => {
  describe('Rendering', () => {
    it('renders input element', () => {
      render(<Input placeholder="Enter text" />);
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });

    it('renders with value', () => {
      render(<Input value="test value" onChange={() => {}} />);
      expect(screen.getByDisplayValue('test value')).toBeInTheDocument();
    });
  });

  describe('Types', () => {
    it('renders text input by default', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'text');
    });

    it('renders number input', () => {
      render(<Input type="number" />);
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('type', 'number');
    });

    it('renders email input', () => {
      render(<Input type="email" />);
      const input = document.querySelector('input[type="email"]');
      expect(input).toBeInTheDocument();
    });

    it('renders password input', () => {
      render(<Input type="password" />);
      const input = document.querySelector('input[type="password"]');
      expect(input).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('applies monospace class', () => {
      const { container } = render(<Input mono />);
      expect(container.querySelector('.mono')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(<Input className="custom-input" />);
      expect(container.querySelector('.custom-input')).toBeInTheDocument();
    });

    it('applies error class when error is present', () => {
      const { container } = render(<Input error="Invalid input" id="test-input" />);
      expect(container.querySelector('.has-error')).toBeInTheDocument();
    });
  });

  describe('States', () => {
    it('disables input when disabled prop is true', () => {
      render(<Input disabled />);
      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('makes input readonly when readonly prop is true', () => {
      render(<Input readOnly value="readonly" onChange={() => {}} />);
      const input = screen.getByDisplayValue('readonly');
      expect(input).toHaveAttribute('readonly');
    });
  });

  describe('Error Handling', () => {
    it('displays error message', () => {
      render(<Input error="This field is required" id="test-input" />);
      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('sets aria-invalid when error is present', () => {
      render(<Input error="Invalid" id="test-input" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('links error message with aria-describedby', () => {
      render(<Input error="Error message" id="test-input" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby', 'test-input-error');
    });
  });

  describe('Interactions', () => {
    it('calls onChange when value changes', () => {
      const handleChange = vi.fn();
      render(<Input onChange={handleChange} />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'new value' } });

      expect(handleChange).toHaveBeenCalledTimes(1);
    });

    it('calls onFocus when focused', () => {
      const handleFocus = vi.fn();
      render(<Input onFocus={handleFocus} />);

      const input = screen.getByRole('textbox');
      fireEvent.focus(input);

      expect(handleFocus).toHaveBeenCalledTimes(1);
    });

    it('calls onBlur when blurred', () => {
      const handleBlur = vi.fn();
      render(<Input onBlur={handleBlur} />);

      const input = screen.getByRole('textbox');
      fireEvent.blur(input);

      expect(handleBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe('Number Input', () => {
    it('respects min and max attributes', () => {
      render(<Input type="number" min={0} max={100} />);
      const input = screen.getByRole('spinbutton');

      expect(input).toHaveAttribute('min', '0');
      expect(input).toHaveAttribute('max', '100');
    });

    it('respects step attribute', () => {
      render(<Input type="number" step={0.1} />);
      const input = screen.getByRole('spinbutton');

      expect(input).toHaveAttribute('step', '0.1');
    });
  });

  describe('Accessibility', () => {
    it('supports aria-label', () => {
      render(<Input aria-label="Search" />);
      expect(screen.getByLabelText('Search')).toBeInTheDocument();
    });

    it('generates unique id when not provided', () => {
      const { container } = render(<Input />);
      const input = container.querySelector('input');
      expect(input).toHaveAttribute('id');
    });

    it('uses provided id', () => {
      render(<Input id="custom-id" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('id', 'custom-id');
    });
  });

  describe('Ref Forwarding', () => {
    it('forwards ref to input element', () => {
      const ref = { current: null as HTMLInputElement | null };
      render(<Input ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLInputElement);
      expect(ref.current?.tagName).toBe('INPUT');
    });
  });

  describe('Full Width', () => {
    it('applies full width class to wrapper', () => {
      const { container } = render(<Input fullWidth />);
      expect(container.querySelector('.full-width')).toBeInTheDocument();
    });
  });
});
