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
        <div className="absolute top-full left-0 mt-1 z-50 bg-base border border-border rounded-lg shadow-lg py-1 min-w-[160px]">
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text bg-transparent hover:bg-base-2 transition-colors text-left"
            onClick={handlePickColor}
          >
            <span className="flex-shrink-0 flex items-center justify-center w-4 h-4">
              <ShadesIcon />
            </span>
            <span className="flex-1">Pick Color</span>
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text bg-transparent hover:bg-base-2 transition-colors text-left"
            onClick={handleReferenceColor}
          >
            <span className="flex-shrink-0 flex items-center justify-center w-4 h-4">{TypeIcons.COLOR}</span>
            <span className="flex-1">Reference Color</span>
          </button>
        </div>
      )}
    </div>
  );
}
