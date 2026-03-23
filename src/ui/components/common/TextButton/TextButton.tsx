// TextButton - Simple text-only button component
// Usage:
//   <TextButton>Click me</TextButton>
//   <TextButton variant="primary">Primary</TextButton>
//   <TextButton variant="danger">Delete</TextButton>

import React, { forwardRef } from 'react';

export interface TextButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}

export const TextButton = forwardRef<HTMLButtonElement, TextButtonProps>(function TextButton({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  loading = false,
  className = '',
  disabled,
  children,
  ...props
}, ref) {
  const baseClasses = 'inline-flex items-center justify-center rounded font-medium transition-colors';

  const variantClasses = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 active:bg-gray-400',
    danger: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const classes = [
    baseClasses,
    variantClasses[variant],
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
