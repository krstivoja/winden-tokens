import React from 'react';
import type { TabId } from './TabBar';
import { TableView } from '../Table/TableView';
import { JsonEditor } from './JsonEditor';
import { RelationshipsView } from '../Relationships/RelationshipsView';
import { SettingsView } from './SettingsView';

interface TabContentProps {
  activeTab: TabId;
  status: { message: string; type: string };
}

export function TabContent({ activeTab, status }: TabContentProps) {
  const renderContent = () => {
    switch (activeTab) {
      case 'table':
        return <TableView status={status} />;
      case 'json':
        return <JsonEditor />;
      case 'relationships':
        return <RelationshipsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return null;
    }
  };

  // Graph views need overflow-hidden to allow ReactFlow to size properly
  const isGraphView = activeTab === 'relationships';

  return (
    <div id={`${activeTab}-tab`} className={`flex-1 ${isGraphView ? 'overflow-hidden' : 'overflow-auto'}`}>
      {renderContent()}
    </div>
  );
}
