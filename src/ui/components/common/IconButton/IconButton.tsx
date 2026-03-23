// IconButton - Icon-only button component
// Usage:
//   <IconButton icon={<TrashIcon />} aria-label="Delete" />
//   <IconButton icon={<EditIcon />} aria-label="Edit" variant="ghost" />

import React, { forwardRef } from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  variant?: 'default' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  'aria-label': string; // Required for accessibility
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({
  icon,
  variant = 'default',
  size = 'md',
  className = '',
  disabled,
  ...props
}, ref) {
  const baseClasses = 'inline-flex items-center justify-center rounded transition-colors';

  const variantClasses = {
    default: 'bg-gray-200 text-gray-900 hover:bg-gray-300 active:bg-gray-400',
    danger: 'bg-red-100 text-red-600 hover:bg-red-200 active:bg-red-300',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200',
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
