// Reusable Textarea component

import React, { forwardRef } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  fullWidth?: boolean;
  mono?: boolean;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, fullWidth = false, mono = false, resize = 'vertical', className = '', id, ...props }, ref) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;

    const classes = [
      'w-full px-3 py-2 border border-border rounded bg-base text-text',
      'focus:outline focus:outline-2 focus:outline-primary focus:outline-offset-2',
      'leading-relaxed',
      mono && 'font-mono',
      error && 'border-danger',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const style = {
      resize,
      ...props.style,
    };

    return (
      <div className={fullWidth ? 'w-full' : ''}>
        <textarea
          ref={ref}
          id={textareaId}
          className={classes}
          style={style}
          aria-invalid={!!error}
          aria-describedby={error ? `${textareaId}-error` : undefined}
          {...props}
        />
        {error && (
          <span id={`${textareaId}-error`} className="text-xs text-danger mt-1 block" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
