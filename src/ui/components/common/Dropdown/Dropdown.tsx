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

  return (
    <DropdownContext.Provider value={{ isOpen, toggle, close, position, align }}>
      <div className={`relative ${className}`} ref={ref}>
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
    <div className={className} onClick={toggle}>
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

  const positionClasses = {
    'bottom-left': 'top-full left-0 mt-1',
    'bottom-right': 'top-full right-0 mt-1',
    'top-left': 'bottom-full left-0 mb-1',
    'top-right': 'bottom-full right-0 mb-1',
  };

  return (
    <div
      className={`absolute ${positionClasses[position]} z-50 bg-base border border-border rounded-lg shadow-lg py-1 min-w-[160px] ${className}`}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
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

  return (
    <button
      type="button"
      className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-text bg-transparent hover:bg-base-2 transition-colors text-left ${disabled ? 'opacity-50 cursor-not-allowed hover:bg-transparent' : ''} ${className}`}
      onClick={handleClick}
      disabled={disabled}
    >
      {icon && <span className="flex-shrink-0 flex items-center justify-center w-4 h-4">{icon}</span>}
      <span className="flex-1">{children}</span>
    </button>
  );
}

// Dropdown Divider component
function DropdownDivider() {
  return <div className="h-px bg-border my-1" />;
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
