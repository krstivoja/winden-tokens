// Reusable Label component

import React from 'react';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  children: React.ReactNode;
}

export function Label({ required = false, className = '', children, ...props }: LabelProps) {
  const classes = ['form-label', className].filter(Boolean).join(' ');

  return (
    <label className={classes} {...props}>
      {children}
      {required && <span className="label-required" aria-label="required">*</span>}
    </label>
  );
}
