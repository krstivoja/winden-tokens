// Color options dropdown - uses ColorSwatch as trigger
// Wraps OptionsDropdown pattern but with ColorSwatch instead of button

import { useState, useRef, useEffect } from 'react';
import { ColorSwatch } from '../common/ColorSwatch';
import { ShadesIcon, TypeIcons } from '../Icons';

interface ColorOptionsDropdownProps {
  color: string;
  onPickColor: () => void;
  onReferenceColor: () => void;
}

export function ColorOptionsDropdown({ color, onPickColor, onReferenceColor }: ColorOptionsDropdownProps) {
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

  const handlePickColor = () => {
    setIsOpen(false);
    onPickColor();
  };

  const handleReferenceColor = () => {
    setIsOpen(false);
    onReferenceColor();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <ColorSwatch color={color} onClick={() => setIsOpen(!isOpen)} />

      {isOpen && (
        <div className="dropdown-menu absolute top-full left-0 mt-1 z-50">
          <button type="button" className="dropdown-item" onClick={handlePickColor}>
            <span className="dropdown-item-icon">
              <ShadesIcon />
            </span>
            <span className="dropdown-item-text">Pick Color</span>
          </button>
          <button type="button" className="dropdown-item" onClick={handleReferenceColor}>
            <span className="dropdown-item-icon">{TypeIcons.COLOR}</span>
            <span className="dropdown-item-text">Reference Color</span>
          </button>
        </div>
      )}
    </div>
  );
}
