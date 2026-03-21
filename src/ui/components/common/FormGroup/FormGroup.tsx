// Reusable FormGroup component - wrapper for form fields with label

import React from 'react';
import { Label } from '../Label';

export interface FormGroupProps {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  description?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
  inline?: boolean;
}

export function FormGroup({
  label,
  htmlFor,
  required = false,
  description,
  error,
  children,
  className = '',
  inline = false,
}: FormGroupProps) {
  const classes = [
    'form-group',
    inline && 'form-group-inline',
    error && 'form-group-error',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      {label && (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      )}
      {description && <p className="form-group-description">{description}</p>}
      <div className="form-group-content">{children}</div>
      {error && (
        <span className="form-group-error-message" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
