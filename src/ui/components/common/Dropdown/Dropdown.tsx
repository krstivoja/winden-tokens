// Reusable Dropdown Menu component with compound component pattern
// Usage:
//   <Dropdown>
//     <Dropdown.Trigger>Click me</Dropdown.Trigger>
//     <Dropdown.Menu>
//       <Dropdown.Item onClick={handler}>Option 1</Dropdown.Item>
//       <Dropdown.Divider />
//       <Dropdown.Item icon={<Icon />}>Option 2</Dropdown.Item>
//     </Dropdown.Menu>
//   </Dropdown>

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useClickOutside } from '../../../hooks/useClickOutside';

// Context for sharing state between compound components
interface DropdownContextValue {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
  position: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  align: 'start' | 'end';
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdownContext() {
  const context = useContext(DropdownContext);
  if (!context) {
    throw new Error('Dropdown compound components must be used within <Dropdown>');
  }
  return context;
}

// Root Dropdown component
interface DropdownRootProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  align?: 'start' | 'end';
  className?: string;
}

function DropdownRoot({
  children,
  defaultOpen = false,
  onOpenChange,
  position = 'bottom-left',
  align = 'start',
  className = '',
}: DropdownRootProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const close = useCallback(() => {
    setIsOpen(false);
    onOpenChange?.(false);
  }, [onOpenChange]);

  const toggle = useCallback(() => {
    const newState = !isOpen;
    setIsOpen(newState);
    onOpenChange?.(newState);
  }, [isOpen, onOpenChange]);

  const ref = useClickOutside<HTMLDivElement>(close, isOpen);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  const dropdownClasses = ['dropdown', className].filter(Boolean).join(' ');

  return (
    <DropdownContext.Provider value={{ isOpen, toggle, close, position, align }}>
      <div className={dropdownClasses} ref={ref}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

// Dropdown Trigger component
interface DropdownTriggerProps {
  children: React.ReactNode;
  className?: string;
  asChild?: boolean;
}

function DropdownTrigger({ children, className = '', asChild = false }: DropdownTriggerProps) {
  const { toggle } = useDropdownContext();
  const triggerClasses = ['dropdown-trigger', className].filter(Boolean).join(' ');

  // If asChild is true, clone the child and add onClick handler
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: (e: React.MouseEvent) => {
        toggle();
        (children as React.ReactElement<any>).props.onClick?.(e);
      },
    });
  }

  return (
    <div className={triggerClasses} onClick={toggle}>
      {children}
    </div>
  );
}

// Dropdown Menu component
interface DropdownMenuProps {
  children: React.ReactNode;
  className?: string;
}

function DropdownMenu({ children, className = '' }: DropdownMenuProps) {
  const { isOpen, position, align } = useDropdownContext();

  if (!isOpen) return null;

  const menuClasses = [
    'dropdown-menu',
    'open',
    `dropdown-${position}`,
    `dropdown-align-${align}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={menuClasses}>{children}</div>;
}

// Dropdown Item component
interface DropdownItemProps {
  onClick?: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function DropdownItem({ onClick, disabled = false, icon, children, className = '' }: DropdownItemProps) {
  const { close } = useDropdownContext();

  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
      close();
    }
  };

  const classes = ['dropdown-item', disabled && 'disabled', className].filter(Boolean).join(' ');

  return (
    <button type="button" className={classes} onClick={handleClick} disabled={disabled}>
      {icon && <span className="dropdown-item-icon">{icon}</span>}
      <span className="dropdown-item-text">{children}</span>
    </button>
  );
}

// Dropdown Divider component
function DropdownDivider() {
  return <div className="dropdown-divider" />;
}

// Compound component with namespace exports
export const Dropdown = Object.assign(DropdownRoot, {
  Trigger: DropdownTrigger,
  Menu: DropdownMenu,
  Item: DropdownItem,
  Divider: DropdownDivider,
});

// Legacy export for backwards compatibility (deprecated)
export interface LegacyDropdownProps {
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

/** @deprecated Use compound component pattern instead: <Dropdown><Dropdown.Trigger>...</Dropdown.Trigger><Dropdown.Menu>...</Dropdown.Menu></Dropdown> */
export function LegacyDropdown({
  trigger,
  isOpen,
  onToggle,
  children,
  position = 'bottom-left',
  className = '',
  triggerClassName = '',
  menuClassName = '',
  align = 'start',
}: LegacyDropdownProps) {
  const [controlled] = useState(isOpen);

  return (
    <Dropdown defaultOpen={controlled} onOpenChange={(open) => !open && onToggle()} position={position} align={align} className={className}>
      <Dropdown.Trigger className={triggerClassName}>{trigger}</Dropdown.Trigger>
      <Dropdown.Menu className={menuClassName}>{children}</Dropdown.Menu>
    </Dropdown>
  );
}

// Export individual components for direct imports if needed
export { DropdownItem, DropdownDivider };
