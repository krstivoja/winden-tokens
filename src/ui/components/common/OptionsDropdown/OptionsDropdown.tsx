// Simple dropdown component - button + menu in one UI
//
// Usage:
//   <OptionsDropdown label="Actions">
//     <Button onClick={...}>Action 1</Button>
//     <Button onClick={...}>Action 2</Button>
//   </OptionsDropdown>

import { useState, useRef, useEffect, ReactNode } from 'react';
import { IconTextButton } from '../Button/Button';
import { ChevronDownIcon } from '../../Icons';

interface OptionsDropdownProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function OptionsDropdown({ label, children, className = '' }: OptionsDropdownProps) {
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
    <div className={`options-dropdown ${className}`.trim()} ref={dropdownRef}>
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

      {isOpen && (
        <div className="options-dropdown-menu">
          {children}
        </div>
      )}
    </div>
  );
}
