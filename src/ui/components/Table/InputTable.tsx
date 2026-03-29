// Reusable table input component

import React from 'react';

interface InputTableProps extends React.InputHTMLAttributes<HTMLInputElement> {
  // All standard input props are inherited
}

export const InputTable = React.forwardRef<HTMLInputElement, InputTableProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`flex-1 max-w-full py-1.5 h-full border-none bg-transparent outline-none focus:bg-bg-input ${className}`}
        {...props}
      />
    );
  }
);

InputTable.displayName = 'InputTable';
