// Tab bar component

import React from 'react';
import { RefreshIcon, ExpandIcon, CollapseIcon, UndoIcon, RedoIcon } from '../Icons';
import { IconButton } from '../common/IconButton/IconButton';
import { TabButton } from './TabButton';
import { post } from '../../hooks/usePluginMessages';

const TABS = [
  { id: 'table' as const, label: 'Table' },
  { id: 'node-colors' as const, label: 'Node Colors' },
  { id: 'node-numbers' as const, label: 'Node Numbers' },
  { id: 'json' as const, label: 'JSON' },
  { id: 'settings' as const, label: 'Settings' },
] as const;

export type TabId = typeof TABS[number]['id'];

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  canUndo: boolean;
  canRedo: boolean;
}

const DEFAULT_WINDOW_SIZE = { width: 750, height: 500 };

export function TabBar({ activeTab, onTabChange, canUndo, canRedo }: TabBarProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [lastSize, setLastSize] = React.useState(DEFAULT_WINDOW_SIZE);

  React.useEffect(() => {
    const maxWidth = Math.max(400, window.screen.availWidth - 20);
    const maxHeight = Math.max(300, window.screen.availHeight - 100);
    post({ type: 'resize', width: maxWidth, height: maxHeight });
    setIsExpanded(true);
  }, []);

  const handleRefresh = () => {
    post({ type: 'refresh' });
  };

  const handleUndo = () => {
    if (!canUndo) return;
    post({ type: 'undo' });
  };

  const handleRedo = () => {
    if (!canRedo) return;
    post({ type: 'redo' });
  };

  const handleToggleExpand = () => {
    if (!isExpanded) {
      setLastSize({ width: window.innerWidth, height: window.innerHeight });
      const maxWidth = Math.max(400, window.screen.availWidth - 20);
      const maxHeight = Math.max(300, window.screen.availHeight - 100);
      post({ type: 'resize', width: maxWidth, height: maxHeight });
      setIsExpanded(true);
    } else {
      const width = lastSize.width || DEFAULT_WINDOW_SIZE.width;
      const height = lastSize.height || DEFAULT_WINDOW_SIZE.height;
      post({ type: 'resize', width, height });
      setIsExpanded(false);
    }
  };

  return (
    <div className="tabs flex items-center justify-between border-b border-border">
      <div>
        {TABS.map((tab) => (
          <TabButton
            key={tab.id}
            label={tab.label}
            isActive={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
          />
        ))}

      </div>

      <div className="flex mr-4 gap-2">


        <IconButton
          id="undo-btn"
          icon={<UndoIcon />}
          onClick={handleUndo}
          disabled={!canUndo}
          title="Undo (Ctrl/Cmd+Z)"
          aria-label="Undo"
        />
        <IconButton
          id="redo-btn"
          icon={<RedoIcon />}
          onClick={handleRedo}
          disabled={!canRedo}
          title="Redo (Ctrl/Cmd+Shift+Z)"
          aria-label="Redo"
        />
        <IconButton
          id="refresh-btn"
          icon={<RefreshIcon />}
          onClick={handleRefresh}
          title="Refresh"
          aria-label="Refresh"
        />
        <IconButton
          id="expand-btn"
          icon={isExpanded ? <CollapseIcon /> : <ExpandIcon />}
          onClick={handleToggleExpand}
          title={isExpanded ? 'Collapse' : 'Expand'}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        />
      </div>
    </div>
  );
}
