// Main App component

import React, { useState, useCallback, useEffect } from 'react';
import { useAppContext } from './context/AppContext';
import { usePluginMessages, post } from './hooks/usePluginMessages';
import { TabBar, type TabId } from './components/Tabs/TabBar';
import { TabContent } from './components/Tabs/TabContent';
import { ShadesModal } from './components/Modals/ShadesModal';
import { StepsModal } from './components/Modals/StepsModal';
import { InputModal } from './components/Modals/InputModal';
import { AddVariableModal } from './components/Modals/AddVariableModal';
import { ColorPickerModal } from './components/Modals/ColorPickerModal';
import { ColorReferenceModal } from './components/Modals/ColorReferenceModal';
import { BulkEditModal } from './components/Modals/BulkEditModal';
import { ResizeHandles } from './components/ResizeHandles';

export type ActiveTab = TabId;

export function App() {
  const { setData } = useAppContext();
  const [activeTab, setActiveTab] = useState<ActiveTab>('table');
  const [status, setStatus] = useState<{ message: string; type: string }>({ message: '', type: '' });
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  const showStatus = useCallback((message: string, type: string) => {
    setStatus({ message, type });
    if (type === 'success') {
      setTimeout(() => setStatus({ message: '', type: '' }), 2000);
    }
  }, []);

  // Handle plugin messages
  const messageHandlers = useCallback(() => ({
    'data-loaded': (msg: any) => {
      setData(msg.collections || [], msg.variables || [], msg.shadeGroups || []);
      setStatus({ message: '', type: '' }); // Clear any warning status after refresh
    },
    'update-success': () => {
      showStatus('Saved', 'success');
    },
    'update-error': (msg: any) => {
      showStatus('Error: ' + msg.error, 'warning');
    },
    'history-state': (msg: any) => {
      setHistoryState({
        canUndo: !!msg.canUndo,
        canRedo: !!msg.canRedo,
      });
    },
    'history-applied': (msg: any) => {
      showStatus(msg.direction === 'redo' ? 'Redid' : 'Undid', 'success');
    },
    'history-error': (msg: any) => {
      showStatus(msg.error, 'warning');
    },
    'changes-detected': () => {
      showStatus('Changes detected - click Refresh', 'warning');
    },
  }), [setData, showStatus]);

  usePluginMessages(messageHandlers());

  useEffect(() => {
    post({ type: 'get-history-state' });
  }, []);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return target.isContentEditable
        || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) {
        return;
      }

      const hasModifier = event.metaKey || event.ctrlKey;
      if (!hasModifier) {
        return;
      }

      const key = event.key.toLowerCase();
      const wantsRedo = key === 'y' || (key === 'z' && event.shiftKey);
      const wantsUndo = key === 'z' && !event.shiftKey;

      if (wantsUndo && historyState.canUndo) {
        event.preventDefault();
        post({ type: 'undo' });
      } else if (wantsRedo && historyState.canRedo) {
        event.preventDefault();
        post({ type: 'redo' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyState.canRedo, historyState.canUndo]);

  return (
    <>
      <TabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        canUndo={historyState.canUndo}
        canRedo={historyState.canRedo}
      />

      <TabContent
        activeTab={activeTab}
        status={status}
      />

      {/* Modals */}
      <ShadesModal />
      <StepsModal />
      <InputModal />
      <AddVariableModal />
      <ColorPickerModal />
      <ColorReferenceModal />
      <BulkEditModal />

      {/* Resize Handles */}
      <ResizeHandles />
    </>
  );
}
