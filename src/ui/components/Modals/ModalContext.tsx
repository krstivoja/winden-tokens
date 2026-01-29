// Modal state context

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface InputModalConfig {
  title: string;
  label: string;
  confirmText: string;
  onConfirm: (value: string) => void;
  initialValue?: string;
}

interface ColorPickerConfig {
  initialColor: string;
  onConfirm: (hex: string) => void;
}

interface ColorReferenceConfig {
  currentVariableId?: string;
  currentValue?: string;
  onSelect?: (refName: string) => void;
  onConfirm?: (variableId: string) => void;
}

interface BulkEditConfig {
  groupName: string;
}

interface ModalState {
  inputModal: InputModalConfig | null;
  colorPicker: ColorPickerConfig | null;
  colorReference: ColorReferenceConfig | null;
  bulkEdit: BulkEditConfig | null;
  shadesModal: boolean;
  stepsModal: boolean;
}

interface ModalContextValue {
  modals: ModalState;
  openInputModal: (config: InputModalConfig) => void;
  closeInputModal: () => void;
  openColorPicker: (config: ColorPickerConfig) => void;
  closeColorPicker: () => void;
  openColorReference: (config: ColorReferenceConfig) => void;
  closeColorReference: () => void;
  openBulkEdit: (config: BulkEditConfig) => void;
  closeBulkEdit: () => void;
  openShadesModal: () => void;
  closeShadesModal: () => void;
  openStepsModal: () => void;
  closeStepsModal: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modals, setModals] = useState<ModalState>({
    inputModal: null,
    colorPicker: null,
    colorReference: null,
    bulkEdit: null,
    shadesModal: false,
    stepsModal: false,
  });

  const openInputModal = useCallback((config: InputModalConfig) => {
    setModals(prev => ({ ...prev, inputModal: config }));
  }, []);

  const closeInputModal = useCallback(() => {
    setModals(prev => ({ ...prev, inputModal: null }));
  }, []);

  const openColorPicker = useCallback((config: ColorPickerConfig) => {
    setModals(prev => ({ ...prev, colorPicker: config }));
  }, []);

  const closeColorPicker = useCallback(() => {
    setModals(prev => ({ ...prev, colorPicker: null }));
  }, []);

  const openColorReference = useCallback((config: ColorReferenceConfig) => {
    setModals(prev => ({ ...prev, colorReference: config }));
  }, []);

  const closeColorReference = useCallback(() => {
    setModals(prev => ({ ...prev, colorReference: null }));
  }, []);

  const openBulkEdit = useCallback((config: BulkEditConfig) => {
    setModals(prev => ({ ...prev, bulkEdit: config }));
  }, []);

  const closeBulkEdit = useCallback(() => {
    setModals(prev => ({ ...prev, bulkEdit: null }));
  }, []);

  const openShadesModal = useCallback(() => {
    setModals(prev => ({ ...prev, shadesModal: true }));
  }, []);

  const closeShadesModal = useCallback(() => {
    setModals(prev => ({ ...prev, shadesModal: false }));
  }, []);

  const openStepsModal = useCallback(() => {
    setModals(prev => ({ ...prev, stepsModal: true }));
  }, []);

  const closeStepsModal = useCallback(() => {
    setModals(prev => ({ ...prev, stepsModal: false }));
  }, []);

  const value: ModalContextValue = {
    modals,
    openInputModal,
    closeInputModal,
    openColorPicker,
    closeColorPicker,
    openColorReference,
    closeColorReference,
    openBulkEdit,
    closeBulkEdit,
    openShadesModal,
    closeShadesModal,
    openStepsModal,
    closeStepsModal,
  };

  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
}

export function useModalContext() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModalContext must be used within ModalProvider');
  }
  return context;
}
