// Reusable Radio component

import React, { forwardRef } from 'react';

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  error?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const radioId = id || `radio-${Math.random().toString(36).substr(2, 9)}`;

    if (label) {
      return (
        <div className={`radio-wrapper ${className}`}>
          <label className="radio-label">
            <input
              ref={ref}
              type="radio"
              id={radioId}
              className="radio-input"
              aria-invalid={!!error}
              aria-describedby={error ? `${radioId}-error` : undefined}
              {...props}
            />
            <span className="radio-label-text">{label}</span>
          </label>
          {error && (
            <span id={`${radioId}-error`} className="radio-error" role="alert">
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
