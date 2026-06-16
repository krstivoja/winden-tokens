// Input modal component

import React, { useState, useEffect, useRef } from 'react';
import { useModalContext } from './ModalContext';
import { Input } from '../common/Input';
import { TextButton } from '../common/Button';
import { Modal } from './Modal';

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
        <Input
          ref={inputRef}
          type="text"
          placeholder="Enter name..."
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
    </Modal>
  );
}
