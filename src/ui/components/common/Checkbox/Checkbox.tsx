// Reusable Checkbox component

import React, { forwardRef } from 'react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, error, className = '', id, ...props }, ref) => {
    const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

    const checkmarkIcon = "data:image/svg+xml,%3Csvg width='12' height='10' viewBox='0 0 12 10' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 5L4.5 8.5L11 1' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

    const checkboxClasses = `appearance-none w-5 h-5 rounded border-2 border-zinc-300 cursor-pointer flex-shrink-0 mt-0.5
      checked:bg-primary checked:border-primary
      focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
      bg-no-repeat bg-center`;

    if (label) {
      return (
        <div className={`block ${className}`}>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              ref={ref}
              type="checkbox"
              id={checkboxId}
              className={checkboxClasses}
              style={{
                backgroundImage: `url("${checkmarkIcon}")`,
                backgroundSize: '0',
              }}
              aria-invalid={!!error}
              aria-describedby={error ? `${checkboxId}-error` : undefined}
              {...props}
            />
            <div className="flex-1">
              <span className="block text-sm font-medium text-text leading-tight">{label}</span>
              {description && (
                <div className="block text-sm text-text opacity-60 mt-0.5 leading-tight">{description}</div>
              )}
            </div>
          </label>
          {error && (
            <span id={`${checkboxId}-error`} className="text-xs text-danger mt-1 ml-8" role="alert">
              {error}
            </span>
          )}
        </div>
      );
    }

    return (
      <input
        ref={ref}
        type="checkbox"
        id={checkboxId}
        className={`${checkboxClasses} ${className}`}
        style={{
          backgroundImage: `url("${checkmarkIcon}")`,
          backgroundSize: '0',
        }}
        aria-invalid={!!error}
        aria-describedby={error ? `${checkboxId}-error` : undefined}
        {...props}
      />
    );
  }
);

Checkbox.displayName = 'Checkbox';
