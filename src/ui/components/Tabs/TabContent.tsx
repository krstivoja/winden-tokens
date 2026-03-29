import React from 'react';
import type { TabId } from './TabBar';
import { TableView } from '../Table/TableView';
import { JsonEditor } from './JsonEditor';
import { RelationshipsView } from '../Relationships/RelationshipsView';
import { SettingsView } from './SettingsView';
import type { ThemeMode } from '../../App';

interface TabContentProps {
  activeTab: TabId;
  status: { message: string; type: string };
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
}

export function TabContent({ activeTab, status, themeMode, onThemeModeChange }: TabContentProps) {
  const renderContent = () => {
    switch (activeTab) {
      case 'table':
        return <TableView status={status} />;
      case 'json':
        return <JsonEditor />;
      case 'node-colors':
        return <RelationshipsView variableType="COLOR" />;
      case 'node-numbers':
        return <RelationshipsView variableType="FLOAT" />;
      case 'settings':
        return (
          <SettingsView
            themeMode={themeMode}
            onThemeModeChange={onThemeModeChange}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div id={`${activeTab}-tab`} className="flex-1 overflow-auto">
      {renderContent()}
    </div>
  );
}
