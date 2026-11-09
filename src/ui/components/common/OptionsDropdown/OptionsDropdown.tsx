// Simple dropdown component - button + menu in one UI
// Menu appears as absolute positioned overlay (doesn't push content)
//
// Usage:
//   <OptionsDropdown label="Actions">
//     <Button onClick={...}>Action 1</Button>
//     <Button onClick={...}>Action 2</Button>
//   </OptionsDropdown>
//
// Icon-only trigger (label becomes the aria-label), menu aligned to the right edge:
//   <OptionsDropdown label="Filter" icon={<FilterIcon />} align="right" indicator={isFiltered}>
//     ...
//   </OptionsDropdown>

import { useState, useRef, useEffect, ReactNode } from 'react';
import { IconButton, IconTextButton } from '../Button/Button';
import { ChevronDownIcon } from '../../Icons';

interface OptionsDropdownProps {
  label: string;
  children: ReactNode;
  className?: string;
  /** Icon-only trigger: renders an IconButton, `label` is its aria-label. */
  icon?: ReactNode;
  /** Which edge of the trigger the menu lines up with. */
  align?: 'left' | 'right';
  /** Shows a small dot on an icon-only trigger (e.g. a filter is active). */
  indicator?: boolean;
}

export function OptionsDropdown({
  label,
  children,
  className = '',
  icon,
  align = 'left',
  indicator = false,
}: OptionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <div className={`relative ${className}`.trim()} ref={dropdownRef}>
      {icon ? (
        <>
          <IconButton
            variant="ghost"
            size="sm"
            icon={icon}
            aria-label={label}
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            aria-haspopup="menu"
          />
          {indicator && (
            <span
              data-testid="options-dropdown-indicator"
              className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-primary pointer-events-none"
            />
          )}
        </>
      ) : (
        <IconTextButton
          variant="ghost"
          icon={<ChevronDownIcon />}
          iconPosition="right"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="menu"
        >
          {label}
        </IconTextButton>
      )}

      {isOpen && (
        <div className={`absolute top-full ${align === 'right' ? 'right-0' : 'left-0'} mt-1 bg-base border border-border rounded shadow-lg z-50 min-w-[200px] p-2`}>
          {children}
        </div>
      )}
    </div>
  );
}
