// Search component - Input with search icon and optional count

import React, { useRef } from 'react';
import { SearchIcon } from '../../Icons';
import { Input } from '../Input';

export interface SearchProps {
  value?: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  onEnter?: () => void;
  placeholder?: string;
  count?: string;
  className?: string;
  autoFocus?: boolean;
  fullWidth?: boolean;
  id?: string;
}

export function Search({
  value = '',
  onChange,
  onClear,
  onEnter,
  placeholder = 'Search...',
  count,
  className = '',
  autoFocus = false,
  fullWidth = false,
  id,
}: SearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      onChange('');
      if (onClear) {
        onClear();
      }
    } else if (e.key === 'Enter' && onEnter) {
      onEnter();
    }
  };

  return (
    <div className={`flex items-center gap-2 relative ${fullWidth ? 'w-full' : ''} ${className}`}>
      <span className="absolute left-0 pointer-events-none">
        <SearchIcon />
      </span>
      <Input
        ref={inputRef}
        type="text"
        id={id}
        className="pl-6"
        placeholder={placeholder}
        autoComplete="off"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        autoFocus={autoFocus}
        fullWidth={fullWidth}
      />
      {count && (
        <span className="absolute right-2 text-xs text-text-secondary pointer-events-none">
          {count}
        </span>
      )}
    </div>
  );
}
