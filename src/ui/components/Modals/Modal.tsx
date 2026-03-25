// Reusable modal components with Tailwind styling

import React, { useEffect, useRef } from 'react';
import { CloseIcon } from '../Icons';

// Modal Overlay - backdrop with centered content
interface ModalOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function ModalOverlay({ isOpen, onClose, children }: ModalOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap - keep focus within modal
  useEffect(() => {
    if (!isOpen) return;

    const modalElement = overlayRef.current;
    if (!modalElement) return;

    // Get all focusable elements
    const focusableElements = modalElement.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element when modal opens
    firstElement?.focus();

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab - moving backwards
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab - moving forwards
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabKey);
    return () => document.removeEventListener('keydown', handleTabKey);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>
  );
}

// Modal Container - white box with shadow
interface ModalContainerProps {
  width?: number | string;
  children: React.ReactNode;
  className?: string;
}

export function ModalContainer({ width = 400, children, className = '' }: ModalContainerProps) {
  const widthStyle = typeof width === 'number' ? `${width}px` : width;

  return (
    <div
      className={`bg-white rounded-lg shadow-xl flex flex-col ${className}`}
      style={{ width: widthStyle, maxHeight: '90vh' }}
      role="document"
      aria-labelledby="modal-title"
    >
      {children}
    </div>
  );
}

// Modal Header - title with close button
interface ModalHeaderProps {
  title: string | React.ReactNode;
  onClose: () => void;
}

export function ModalHeader({ title, onClose }: ModalHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
      <h3 id="modal-title" className="text-sm font-semibold text-gray-900">{title}</h3>
      <button
        type="button"
        className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
        onClick={onClose}
        aria-label="Close modal"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

// Modal Body - scrollable content area
interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalBody({ children, className = '' }: ModalBodyProps) {
  return (
    <div className={`px-6 py-4 overflow-y-auto flex-1 ${className}`}>
      {children}
    </div>
  );
}

// Modal Footer - button actions
interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalFooter({ children, className = '' }: ModalFooterProps) {
  return (
    <div className={`flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 ${className}`}>
      {children}
    </div>
  );
}

// Complete Modal - combines all parts for convenience
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string | React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number | string;
}

export function Modal({ isOpen, onClose, title, children, footer, width }: ModalProps) {
  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <ModalContainer width={width}>
        <ModalHeader title={title} onClose={onClose} />
        <ModalBody>{children}</ModalBody>
        {footer && <ModalFooter>{footer}</ModalFooter>}
      </ModalContainer>
    </ModalOverlay>
  );
}
