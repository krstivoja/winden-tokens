// Reusable IconButton component - button with only icon

import React from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  variant?: 'default' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  'aria-label': string; // Required for accessibility
}

export function IconButton({
  icon,
  variant = 'default',
  size = 'md',
  className = '',
  ...props
}: IconButtonProps) {
  const classes = [
    'icon-btn',
    variant === 'danger' && 'icon-btn-danger',
    variant === 'ghost' && 'icon-btn-ghost',
    size === 'sm' && 'icon-btn-sm',
    size === 'lg' && 'icon-btn-lg',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" className={classes} {...props}>
      <span className="icon" aria-hidden="true">
        {icon}
      </span>
    </button>
  );
}
