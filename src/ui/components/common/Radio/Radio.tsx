// Reusable Radio component

import React, { forwardRef } from 'react';

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ label, description, error, className = '', id, ...props }, ref) => {
    const radioId = id || `radio-${Math.random().toString(36).substr(2, 9)}`;

    if (label) {
      return (
        <div className={`block ${className}`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              ref={ref}
              type="radio"
              id={radioId}
              className="radio-input"
              aria-invalid={!!error}
              aria-describedby={error ? `${radioId}-error` : undefined}
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
            <span id={`${radioId}-error`} className="text-xs text-danger mt-1 ml-8" role="alert">
              {error}
            </span>
          )}
        </div>
      );
    }

    return (
      <input
        ref={ref}
        type="radio"
        id={radioId}
        className={`radio-input ${className}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${radioId}-error` : undefined}
        {...props}
      />
    );
  }
);

Radio.displayName = 'Radio';
