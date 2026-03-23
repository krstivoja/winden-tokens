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
      'form-select',
      fullWidth && 'full-width',
      error && 'has-error',
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
      <div className={fullWidth ? 'select-wrapper full-width' : 'select-wrapper'}>
        <select
          ref={ref}
          id={selectId}
          className={classes}
          aria-invalid={!!error}
          aria-describedby={error ? `${selectId}-error` : undefined}
          {...props}
        >
          {options ? renderOptionsFromArray() : renderChildren()}
        </select>
        {error && (
          <span id={`${selectId}-error`} className="select-error" role="alert">
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

function SelectOptionComponent({ children, ...props }: SelectOptionProps) {
  return <option {...props}>{children}</option>;
}

// Select.Group component (optgroup)
interface SelectGroupProps extends React.OptgroupHTMLAttributes<HTMLOptGroupElement> {
  label: string;
  children: React.ReactNode;
}

function SelectGroup({ label, children, ...props }: SelectGroupProps) {
  return (
    <optgroup label={label} {...props}>
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
