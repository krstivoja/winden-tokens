// Reusable Button component with support for icons
// Usage:
//   <Button variant="primary">Click me</Button>
//   <Button icon={<Icon />}>With Icon</Button>
//   <Button icon={<Icon />} iconPosition="right">Icon Right</Button>
//   <Button icon={<Icon />} aria-label="Delete" />  // Icon only

import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  children?: React.ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  loading = false,
  icon,
  iconPosition = 'left',
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  // Icon-only button: has icon but no children
  const isIconOnly = icon && !children;

  const classes = [
    isIconOnly ? 'icon-btn' : 'btn',

    // Standard button variants
    !isIconOnly && variant === 'primary' && 'btn-primary',
    !isIconOnly && variant === 'danger' && 'btn-danger',
    !isIconOnly && variant === 'ghost' && 'btn-ghost',

    // Icon button variants
    isIconOnly && variant === 'danger' && 'icon-btn-danger',
    isIconOnly && variant === 'ghost' && 'icon-btn-ghost',

    // Size classes
    size === 'sm' && (isIconOnly ? 'icon-btn-sm' : 'btn-sm'),
    size === 'lg' && (isIconOnly ? 'icon-btn-lg' : 'btn-lg'),

    fullWidth && 'btn-full-width',
    loading && 'btn-loading',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // Icon-only button
  if (isIconOnly) {
    return (
      <button
        type="button"
        className={classes}
        disabled={disabled || loading}
        {...props}
      >
        <span className="icon" aria-hidden="true">
          {loading ? '...' : icon}
        </span>
      </button>
    );
  }

  // Button with icon and text
  if (icon) {
    return (
      <button
        className={classes}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          'Loading...'
        ) : (
          <>
            {iconPosition === 'left' && <span className="icon">{icon}</span>}
            <span>{children}</span>
            {iconPosition === 'right' && <span className="icon">{icon}</span>}
          </>
        )}
      </button>
    );
  }

  // Standard button (no icon)
  return (
    <button
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? 'Loading...' : children}
    </button>
  );
}

// Re-export as IconButton for backwards compatibility
/** @deprecated Use Button with icon prop instead: <Button icon={<Icon />} aria-label="..." /> */
export const IconButton = Button;
