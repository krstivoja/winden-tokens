// IconTextButton - Button with text and icon (left or right)
// Default variant: 'ghost' - transparent with hover effects
// Usage:
//   <IconTextButton icon={<PlusIcon />}>Add Item</IconTextButton>
//   <IconTextButton icon={<ArrowIcon />} iconPosition="right">Next</IconTextButton>
//   <IconTextButton icon={<SaveIcon />} variant="primary">Save</IconTextButton>

import React, { forwardRef } from 'react';
import { buttonVariants, ButtonVariant } from '../buttonVariants';

export interface IconTextButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  iconPosition?: 'left' | 'right';
  variant?: ButtonVariant;
  fullWidth?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}

export const IconTextButton = forwardRef<HTMLButtonElement, IconTextButtonProps>(function IconTextButton({
  icon,
  iconPosition = 'left',
  variant = 'ghost',
  fullWidth = false,
  loading = false,
  className = '',
  disabled,
  children,
  ...props
}, ref) {
  const baseClasses = 'inline-flex items-center justify-center gap-1 rounded font-medium transition-colors text-xs';

  // Padding - remove padding on icon side
  const paddingClass = iconPosition === 'left' ? 'pl-1 pr-3 py-1' : 'pl-3 pr-1 py-1';

  const classes = [
    baseClasses,
    buttonVariants[variant],
    paddingClass,
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
      {loading ? (
        'Loading...'
      ) : (
        <>
          {iconPosition === 'left' && <span className="inline-flex items-center">{icon}</span>}
          <span>{children}</span>
          {iconPosition === 'right' && <span className="inline-flex items-center">{icon}</span>}
        </>
      )}
    </button>
  );
});
