// Reusable Input component

import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  fullWidth?: boolean;
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, fullWidth = false, mono = false, className = '', ...props }, ref) => {
    const classes = [
      'form-input w-full bg-base text-text border-border border border-solid p-2 rounded focus:outline-1 focus:outline-text focus:outline-offset-2 focus:ring-0 h-[34px] leading-tight text-sm',
      mono && 'mono',
      fullWidth && 'full-width',
      error && 'has-error',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={fullWidth ? 'input-wrapper w-full' : 'input-wrapper'}>
        <input
          ref={ref}
          className={classes}
          aria-invalid={!!error}
          aria-describedby={error ? `${props.id}-error` : undefined}
          {...props}
        />
        {error && (
          <span id={`${props.id}-error`} className="input-error" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
