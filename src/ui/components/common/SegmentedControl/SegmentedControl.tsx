// Segmented Control component - iOS-style tab group

import React from 'react';

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label: string;
  badge?: React.ReactNode;
  onBadgeClick?: (e: React.MouseEvent) => void;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: 'bordered' | 'filled';
  fullWidth?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  variant = 'bordered',
  fullWidth = false,
  className = '',
}: SegmentedControlProps<T>) {
  const containerClasses = variant === 'bordered'
    ? 'flex gap-1 border border-border rounded p-0.5'
    : 'flex gap-1 bg-base-2 rounded p-1';

  const buttonClasses = (isActive: boolean) => {
    const base = 'flex-1 rounded text-xs font-medium transition-all';

    if (variant === 'bordered') {
      return `${base} px-3 py-1.5 ${
        isActive
          ? 'bg-primary text-base shadow-sm'
          : 'bg-transparent text-text hover:bg-base-2'
      }`;
    } else {
      return `${base} px-3 py-1.5 ${
        isActive
          ? 'bg-primary text-base'
          : 'bg-transparent text-text hover:bg-base-3'
      }`;
    }
  };

  return (
    <div
      className={`${containerClasses} ${fullWidth ? 'w-full' : ''} ${className}`}
      role="tablist"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className={`${buttonClasses(value === option.value)} flex items-center justify-center gap-1`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.badge && (
            <span
              onClick={(e) => {
                if (option.onBadgeClick) {
                  e.stopPropagation();
                  option.onBadgeClick(e);
                }
              }}
              className="inline-flex items-center justify-center w-4 h-4"
            >
              {option.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
