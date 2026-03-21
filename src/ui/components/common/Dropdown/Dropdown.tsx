// Reusable Dropdown Menu component with click-outside handling

import React, { useRef, useEffect } from 'react';

export interface DropdownProps {
  trigger: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  onClose?: () => void;
  children: React.ReactNode;
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  align?: 'start' | 'end';
}

export function Dropdown({
  trigger,
  isOpen,
  onToggle,
  onClose,
  children,
  position = 'bottom-left',
  className = '',
  triggerClassName = '',
  menuClassName = '',
  align = 'start',
}: DropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        if (onClose) {
          onClose();
        } else {
          onToggle();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onToggle, onClose]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onClose) {
          onClose();
        } else {
          onToggle();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onToggle, onClose]);

  const dropdownClasses = ['dropdown', className].filter(Boolean).join(' ');
  const triggerClasses = ['dropdown-trigger', triggerClassName].filter(Boolean).join(' ');
  const menuClasses = [
    'dropdown-menu',
    isOpen && 'open',
    `dropdown-${position}`,
    `dropdown-align-${align}`,
    menuClassName,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={dropdownClasses} ref={dropdownRef}>
      <div className={triggerClasses} onClick={onToggle}>
        {trigger}
      </div>
      {isOpen && <div className={menuClasses}>{children}</div>}
    </div>
  );
}

// DropdownItem component for menu items
export interface DropdownItemProps {
  onClick?: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function DropdownItem({ onClick, disabled = false, icon, children, className = '' }: DropdownItemProps) {
  const classes = ['dropdown-item', disabled && 'disabled', className].filter(Boolean).join(' ');

  return (
    <button type="button" className={classes} onClick={onClick} disabled={disabled}>
      {icon && <span className="dropdown-item-icon">{icon}</span>}
      <span className="dropdown-item-text">{children}</span>
    </button>
  );
}

// DropdownDivider component for separators
export function DropdownDivider() {
  return <div className="dropdown-divider" />;
}
