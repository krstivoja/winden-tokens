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

export type ActiveTab = 'table' | 'json' | 'node-colors' | 'node-numbers';

export function App() {
  const { setData } = useAppContext();
  const [activeTab, setActiveTab] = useState<ActiveTab>('table');
  const [status, setStatus] = useState<{ message: string; type: string }>({ message: '', type: '' });

  // Handle plugin messages
  const messageHandlers = useCallback(() => ({
    'data-loaded': (msg: any) => {
      console.log('[UI] data-loaded received:', msg.collections?.length, 'collections,', msg.variables?.length, 'variables');
      setData(msg.collections || [], msg.variables || []);
      setStatus({ message: '', type: '' }); // Clear any warning status after refresh
    },
    'update-success': () => {
      showStatus('Saved', 'success');
    },
    'update-error': (msg: any) => {
      showStatus('Error: ' + msg.error, 'warning');
    },
    'changes-detected': () => {
      showStatus('Changes detected - click Refresh', 'warning');
    },
  }), [setData]);

  usePluginMessages(messageHandlers());

  const showStatus = useCallback((message: string, type: string) => {
    setStatus({ message, type });
    if (type === 'success') {
      setTimeout(() => setStatus({ message: '', type: '' }), 2000);
    }
  }, []);

  return (
    <>
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

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
