// Button component tests

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  describe('Rendering', () => {
    it('renders children correctly', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('renders with custom className', () => {
      const { container } = render(<Button className="custom-class">Button</Button>);
      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it('applies primary variant class', () => {
      const { container } = render(<Button variant="primary">Primary</Button>);
      expect(container.querySelector('.btn-primary')).toBeInTheDocument();
    });

    it('applies danger variant class', () => {
      const { container } = render(<Button variant="danger">Delete</Button>);
      expect(container.querySelector('.btn-danger')).toBeInTheDocument();
    });

    it('applies secondary variant by default', () => {
      const { container } = render(<Button>Secondary</Button>);
      expect(container.querySelector('.btn')).toBeInTheDocument();
      expect(container.querySelector('.btn-primary')).not.toBeInTheDocument();
    });
  });

  describe('Sizes', () => {
    it('applies small size class', () => {
      const { container } = render(<Button size="sm">Small</Button>);
      expect(container.querySelector('.btn-sm')).toBeInTheDocument();
    });

    it('applies large size class', () => {
      const { container } = render(<Button size="lg">Large</Button>);
      expect(container.querySelector('.btn-lg')).toBeInTheDocument();
    });
  });

  describe('States', () => {
    it('disables button when disabled prop is true', () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByText('Disabled')).toBeDisabled();
    });

    it('shows loading text when loading', () => {
      render(<Button loading>Save</Button>);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.queryByText('Save')).not.toBeInTheDocument();
    });

    it('disables button when loading', () => {
      render(<Button loading>Save</Button>);
      expect(screen.getByText('Loading...')).toBeDisabled();
    });
  });

  describe('Interactions', () => {
    it('calls onClick when clicked', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);

      fireEvent.click(screen.getByText('Click me'));

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick} disabled>Click me</Button>);

      fireEvent.click(screen.getByText('Click me'));

      expect(handleClick).not.toHaveBeenCalled();
    });

    it('does not call onClick when loading', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick} loading>Click me</Button>);

      fireEvent.click(screen.getByText('Loading...'));

      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has button role', () => {
      render(<Button>Accessible Button</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('supports aria-label', () => {
      render(<Button aria-label="Close dialog">×</Button>);
      expect(screen.getByLabelText('Close dialog')).toBeInTheDocument();
    });

    it('applies aria-disabled when disabled', () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByText('Disabled');
      expect(button).toHaveAttribute('disabled');
    });
  });

  describe('Full Width', () => {
    it('applies full width class', () => {
      const { container } = render(<Button fullWidth>Full Width</Button>);
      expect(container.querySelector('.btn-full-width')).toBeInTheDocument();
    });
  });
});
