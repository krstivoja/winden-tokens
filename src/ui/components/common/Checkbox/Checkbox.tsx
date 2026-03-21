// Reusable Checkbox component

import React, { forwardRef } from 'react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

    if (label) {
      return (
        <div className={`checkbox-wrapper ${className}`}>
          <label className="checkbox-label">
            <input
              ref={ref}
              type="checkbox"
              id={checkboxId}
              className="checkbox-input"
              aria-invalid={!!error}
              aria-describedby={error ? `${checkboxId}-error` : undefined}
              {...props}
            />
            <span className="checkbox-label-text">{label}</span>
          </label>
          {error && (
            <span id={`${checkboxId}-error`} className="checkbox-error" role="alert">
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
        className={`checkbox-input ${className}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${checkboxId}-error` : undefined}
        {...props}
      />
    );
  }
);

Checkbox.displayName = 'Checkbox';
