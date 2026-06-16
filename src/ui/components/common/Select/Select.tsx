// Reusable Select component with compound component pattern
// Simple API:
//   <Select options={[{value: '1', label: 'Option 1'}]} />
// Compound API:
//   <Select>
//     <Select.Option value="1">Option 1</Select.Option>
//     <Select.Group label="Group">
//       <Select.Option value="2">Option 2</Select.Option>
//     </Select.Group>
//   </Select>

import React, { forwardRef } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options?: SelectOption[];
  placeholder?: string;
  error?: string;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

// Root Select component
const SelectRoot = forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, placeholder, error, fullWidth = false, className = '', id, children, ...props }, ref) => {
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;

    const classes = [
      // Base styles - match Input component exactly
      'w-full p-2 rounded border bg-base text-text text-sm leading-tight',
      'transition-colors duration-200',
      // Border and focus states
      error ? 'border-danger focus:border-danger' : 'border-border focus:border-primary',
      'focus:outline-1 focus:outline-text focus:outline-offset-2',
      // Hover state
      'hover:border-primary/50',
      // Disabled state
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-base-2',
      // Custom chevron icon (hide default)
      'appearance-none bg-no-repeat bg-right pr-8',
      // Height consistency - match input exactly
      'h-[34px]',
      // Custom class
      className,
    ]
      .filter(Boolean)
      .join(' ');

    // Array-based API (legacy/simple)
    const renderOptionsFromArray = () => (
      <>
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options?.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </>
    );

    // Compound component API (advanced)
    const renderChildren = () => (
      <>
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {children}
      </>
    );

    return (
      <div className="relative w-full">
        <select
          ref={ref}
          id={selectId}
          className={classes}
          aria-invalid={!!error}
          aria-describedby={error ? `${selectId}-error` : undefined}
          autoComplete="off"
          {...props}
        >
          {options ? renderOptionsFromArray() : renderChildren()}
        </select>
        {/* Custom chevron icon */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        {error && (
          <span id={`${selectId}-error`} className="text-xs text-danger mt-1 block" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  }
);

SelectRoot.displayName = 'Select';

// Select.Option component
interface SelectOptionProps extends React.OptionHTMLAttributes<HTMLOptionElement> {
  children: React.ReactNode;
}

function SelectOptionComponent({ children, className = '', ...props }: SelectOptionProps) {
  return (
    <option
      className={`bg-base text-text py-1 ${className}`}
      {...props}
    >
      {children}
    </option>
  );
}

// Select.Group component (optgroup)
interface SelectGroupProps extends React.OptgroupHTMLAttributes<HTMLOptGroupElement> {
  label: string;
  children: React.ReactNode;
}

function SelectGroup({ label, children, className = '', ...props }: SelectGroupProps) {
  return (
    <optgroup
      label={label}
      className={`font-medium text-text-secondary ${className}`}
      {...props}
    >
      {children}
    </optgroup>
  );
}

// Compound component with namespace exports
export const Select = Object.assign(SelectRoot, {
  Option: SelectOptionComponent,
  Group: SelectGroup,
});

// Legacy type exports
export type { SelectOption };
