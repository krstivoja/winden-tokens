// Main App component

import React, { useState, useCallback, useEffect } from 'react';
import { useAppContext } from './context/AppContext';
import { usePluginMessages, post } from './hooks/usePluginMessages';
import { TabBar } from './components/Tabs/TabBar';
import { Toolbar } from './components/Toolbar/Toolbar';
import { TableView } from './components/Table/TableView';
import { JsonEditor } from './components/Tabs/JsonEditor';
import { ShadesModal } from './components/Modals/ShadesModal';
import { StepsModal } from './components/Modals/StepsModal';
import { InputModal } from './components/Modals/InputModal';
import { ColorPickerModal } from './components/Modals/ColorPickerModal';
import { ColorReferenceModal } from './components/Modals/ColorReferenceModal';
import { BulkEditModal } from './components/Modals/BulkEditModal';
import { ResizeHandles } from './components/ResizeHandles';
import { RelationshipsView } from './components/Relationships/RelationshipsView';
import { SettingsView } from './components/Tabs/SettingsView';

export type ActiveTab = 'table' | 'json' | 'node-colors' | 'node-numbers' | 'settings';
export type ThemeMode = 'figma' | 'light' | 'dark';

const THEME_MODE_STORAGE_KEY = 'winden-theme-mode';
function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'figma' || value === 'light' || value === 'dark';
}

export function App() {
  const { setData } = useAppContext();
  const [activeTab, setActiveTab] = useState<ActiveTab>('table');
  const [status, setStatus] = useState<{ message: string; type: string }>({ message: '', type: '' });
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  const [themeMode, setThemeMode] = useState<ThemeMode>('figma');
  const [themeModeHydrated, setThemeModeHydrated] = useState(false);

  const showStatus = useCallback((message: string, type: string) => {
    setStatus({ message, type });
    if (type === 'success') {
      setTimeout(() => setStatus({ message: '', type: '' }), 2000);
    }
  }, []);

  // Handle plugin messages
  const messageHandlers = useCallback(() => ({
    'data-loaded': (msg: any) => {
      console.log('[UI] data-loaded received:', msg.collections?.length, 'collections,', msg.variables?.length, 'variables');
      console.log('[UI] Collections with modes:', msg.collections);
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
    'client-storage-data': (msg: any) => {
      if (msg.key !== THEME_MODE_STORAGE_KEY) {
        return;
      }

      setThemeMode(isThemeMode(msg.value) ? msg.value : 'figma');
      setThemeModeHydrated(true);
    },
  }), [setData, showStatus]);

  usePluginMessages(messageHandlers());

  useEffect(() => {
    post({ type: 'get-history-state' });
    post({ type: 'get-client-storage', key: THEME_MODE_STORAGE_KEY });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === 'figma') {
      root.removeAttribute('data-theme-mode');
    } else {
      root.setAttribute('data-theme-mode', themeMode);
    }
  }, [themeMode]);

  useEffect(() => {
    if (!themeModeHydrated) {
      return;
    }

    post({ type: 'set-client-storage', key: THEME_MODE_STORAGE_KEY, value: themeMode });
  }, [themeMode, themeModeHydrated]);

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

      {activeTab === 'table' && (
        <div id="table-tab" className="tab-content active">
          <Toolbar status={status} />
          <TableView />
        </div>
      )}

      {activeTab === 'json' && (
        <div id="json-tab" className="tab-content active">
          <JsonEditor />
        </div>
      )}

      {activeTab === 'node-colors' && (
        <div id="node-colors-tab" className="tab-content active">
          <RelationshipsView variableType="COLOR" />
        </div>
      )}

      {activeTab === 'node-numbers' && (
        <div id="node-numbers-tab" className="tab-content active">
          <RelationshipsView variableType="FLOAT" />
        </div>
      )}

      {activeTab === 'settings' && (
        <div id="settings-tab" className="tab-content active">
          <SettingsView
            themeMode={themeMode}
            onThemeModeChange={setThemeMode}
          />
        </div>
      )}

      {/* Modals */}
      <ShadesModal />
      <StepsModal />
      <InputModal />
      <ColorPickerModal />
      <ColorReferenceModal />
      <BulkEditModal />

      {/* Resize Handles */}
      <ResizeHandles />
    </>
  );
}
