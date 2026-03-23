// Icon-only button component - all icons are 24x24
// Usage:
//   <IconButton icon={<ExpandIcon />} onClick={handleClick} aria-label="Expand" />
//   <IconButton icon={<TrashIcon />} variant="danger" aria-label="Delete" />

import React from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  variant?: 'default' | 'danger' | 'ghost';
  'aria-label': string; // Required for accessibility
}

export function IconButton({
  icon,
  variant = 'default',
  className = '',
  disabled,
  ...props
}: IconButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center p-0 m-0 border-none bg-transparent cursor-pointer transition-colors leading-none';

  const variantClasses = {
    default: 'text-text hover:text-text',
    danger: 'text-danger hover:text-danger-hover',
    ghost: 'text-text hover:text-text',
  };

  const disabledClasses = disabled ? 'opacity-45 cursor-default pointer-events-none' : '';

  const classes = [
    baseClasses,
    variantClasses[variant],
    disabledClasses,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" className={classes} disabled={disabled} {...props}>
      {icon}
    </button>
  );
}
