// Input modal component

import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useModalContext } from './ModalContext';
import { Input } from '../common/Input';
import { TextButton } from '../common/Button';
import { Modal } from './Modal';

export function InputModal() {
  const { modals, closeInputModal } = useModalContext();
  const config = modals.inputModal;
  const [value, setValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (config) {
      setValue(config.initialValue || '');
      setShowSuggestions(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [config]);

  const suggestions = config?.suggestions ?? [];

  const filteredSuggestions = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (query.length < 2) return []; // only suggest after 2+ chars
    return suggestions.filter(s => {
      const lower = s.toLowerCase();
      if (lower === query) return false; // hide exact match
      return lower.includes(query);
    });
  }, [suggestions, value]);

  const suggestionsVisible = showSuggestions && filteredSuggestions.length > 0;

  // Measure input position so the dropdown can be portaled outside the
  // overflow-clipped modal body and positioned over the backdrop.
  useLayoutEffect(() => {
    if (!suggestionsVisible) return;
    const measure = () => {
      const el = wrapperRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ left: r.left, top: r.bottom + 4, width: r.width });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [suggestionsVisible, value]);

  if (!config) return null;

  const handleConfirm = () => {
    if (value.trim()) {
      config.onConfirm(value.trim());
      closeInputModal();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      closeInputModal();
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setValue(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  return (
    <Modal
      isOpen={!!config}
      onClose={closeInputModal}
      title={config.title}
      width={300}
      footer={
        <>
          <TextButton onClick={closeInputModal}>Cancel</TextButton>
          <TextButton variant="primary" onClick={handleConfirm}>
            {config.confirmText}
          </TextButton>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-text">{config.label}</label>
        <div ref={wrapperRef}>
          <Input
            ref={inputRef}
            type="text"
            placeholder="Enter name..."
            value={value}
            onChange={e => {
              setValue(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setShowSuggestions(false)}
            onKeyDown={handleKeyDown}
          />
        </div>
        {suggestionsVisible && rect && createPortal(
          <ul
            className="fixed z-[60] max-h-40 overflow-y-auto rounded-lg border border-border bg-base py-1 shadow-lg list-none m-0 p-0"
            style={{ left: rect.left, top: rect.top, width: rect.width }}
          >
            {filteredSuggestions.map(suggestion => (
              <li key={suggestion}>
                <button
                  type="button"
                  className="block w-full cursor-pointer border-0 bg-transparent px-3 py-2 text-left text-xs text-text hover:bg-base-2 transition-colors"
                  onMouseDown={e => {
                    e.preventDefault(); // keep input focus, avoid blur closing first
                    handleSelectSuggestion(suggestion);
                  }}
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )}
      </div>
    </Modal>
  );
}
