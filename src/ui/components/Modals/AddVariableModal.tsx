// Add Variable modal with type selector

import React, { useState, useEffect, useRef } from 'react';
import { useModalContext } from './ModalContext';
import { Input } from '../common/Input';
import { TextButton } from '../common/Button';
import { Modal } from './Modal';

type VariableType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';

export function AddVariableModal() {
  const { modals, closeAddVariableModal } = useModalContext();
  const config = modals.addVariableModal;
  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState<VariableType>('COLOR');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (config) {
      setName('');
      setSelectedType('COLOR');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [config]);

  if (!config) return null;

  const handleConfirm = () => {
    if (name.trim()) {
      config.onConfirm(name.trim(), selectedType);
      closeAddVariableModal();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      closeAddVariableModal();
    }
  };

  return (
    <Modal
      isOpen={!!config}
      onClose={closeAddVariableModal}
      title={config.title}
      width={320}
      footer={
        <>
          <TextButton onClick={closeAddVariableModal}>Cancel</TextButton>
          <TextButton variant="primary" onClick={handleConfirm}>
            {config.confirmText}
          </TextButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-text">Variable name</label>
          <Input
            ref={inputRef}
            type="text"
            placeholder="Enter name..."
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-text">Type</label>
          <div className="flex flex-col gap-1.5">
            {(['COLOR', 'FLOAT', 'STRING', 'BOOLEAN'] as const).map((type) => (
              <label
                key={type}
                className="flex items-center gap-2.5 px-3 py-2 rounded border border-border cursor-pointer hover:bg-base-2 transition-colors"
              >
                <input
                  type="radio"
                  name="variableType"
                  value={type}
                  checked={selectedType === type}
                  onChange={() => setSelectedType(type)}
                  className="w-4 h-4 accent-primary cursor-pointer"
                />
                <span className="text-sm text-text select-none">
                  {type === 'COLOR' && 'Color'}
                  {type === 'FLOAT' && 'Number'}
                  {type === 'STRING' && 'String'}
                  {type === 'BOOLEAN' && 'Boolean'}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
