// IconButton - Icon-only button component
// Default variant: 'ghost' - transparent with hover effects
// Usage:
//   <IconButton icon={<TrashIcon />} aria-label="Delete" />
//   <IconButton icon={<EditIcon />} aria-label="Edit" variant="default" />
//   <IconButton icon={<TrashIcon />} aria-label="Delete" variant="danger" />

import React, { forwardRef } from 'react';
import { buttonVariants } from '../buttonVariants';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  variant?: 'default' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  'aria-label': string; // Required for accessibility
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({
  icon,
  variant = 'ghost',
  size = 'md',
  className = '',
  disabled,
  ...props
}, ref) {
  const baseClasses = 'inline-flex items-center justify-center rounded transition-colors';

  // IconButton-specific variants (lighter colors for icon-only buttons)
  const variantClasses = {
    default: buttonVariants.secondary, // Use shared secondary
    danger: 'bg-red-100 text-red-600 hover:bg-red-200 active:bg-red-300', // Lighter danger
    ghost: buttonVariants.ghost, // Use shared ghost
  };

  const sizeClasses = {
    sm: 'w-6 h-6 text-sm',
    md: 'w-8 h-8 text-base',
    lg: 'w-10 h-10 text-lg',
  };

  const classes = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    disabled && 'opacity-50 cursor-not-allowed',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type="button"
      className={classes}
      disabled={disabled}
      {...props}
    >
      <span className="inline-flex items-center justify-center" aria-hidden="true">
        {icon}
      </span>
    </button>
  );
});
