// TextButton - Simple text-only button component
// Default variant: 'ghost' - transparent with hover effects
// Usage:
//   <TextButton>Click me</TextButton>
//   <TextButton variant="primary">Save</TextButton>
//   <TextButton variant="danger">Delete</TextButton>

import React, { forwardRef } from 'react';
import { buttonVariants, ButtonVariant } from '../buttonVariants';

export interface TextButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}

export const TextButton = forwardRef<HTMLButtonElement, TextButtonProps>(function TextButton({
  variant = 'ghost',
  size = 'md',
  fullWidth = false,
  loading = false,
  className = '',
  disabled,
  children,
  ...props
}, ref) {
  const baseClasses = 'inline-flex items-center justify-center rounded font-medium transition-colors';

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const classes = [
    baseClasses,
    buttonVariants[variant],
    sizeClasses[size],
    fullWidth && 'w-full',
    (disabled || loading) && 'opacity-50 cursor-not-allowed',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type="button"
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? 'Loading...' : children}
    </button>
  );
});
