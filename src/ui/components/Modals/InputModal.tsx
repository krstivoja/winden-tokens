// Input modal component

import React, { useState, useEffect, useRef } from 'react';
import { useModalContext } from './ModalContext';
import { CloseIcon } from '../Icons';

export function InputModal() {
  const { modals, closeInputModal } = useModalContext();
  const config = modals.inputModal;
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (config) {
      setValue(config.initialValue || '');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [config]);

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

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeInputModal();
    }
  };

  return (
    <div className="modal-overlay open" onClick={handleOverlayClick}>
      <div className="modal" style={{ width: 300 }}>
        <div className="modal-header">
          <h3>{config.title}</h3>
          <button className="modal-close" onClick={closeInputModal}>
            <span className="icon"><CloseIcon /></span>
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>{config.label}</label>
            <input
              ref={inputRef}
              type="text"
              className="form-input"
              placeholder="Enter name..."
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={closeInputModal}>Cancel</button>
          <button className="btn btn-primary" onClick={handleConfirm}>
            {config.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
