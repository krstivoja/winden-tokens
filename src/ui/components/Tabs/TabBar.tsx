// Tab bar component

import React from 'react';
import { RefreshIcon, ExpandIcon, CollapseIcon } from '../Icons';
import { post } from '../../hooks/usePluginMessages';

interface TabBarProps {
  activeTab: 'table' | 'json' | 'node-colors' | 'node-numbers' | 'settings';
  onTabChange: (tab: 'table' | 'json' | 'node-colors' | 'node-numbers' | 'settings') => void;
}

const DEFAULT_WINDOW_SIZE = { width: 750, height: 500 };

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
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
    <div className="tabs">
      <button
        className={`tab ${activeTab === 'table' ? 'active' : ''}`}
        onClick={() => onTabChange('table')}
      >
        Table
      </button>
      <button
        className={`tab ${activeTab === 'node-colors' ? 'active' : ''}`}
        onClick={() => onTabChange('node-colors')}
      >
        Node Colors
      </button>
      <button
        className={`tab ${activeTab === 'node-numbers' ? 'active' : ''}`}
        onClick={() => onTabChange('node-numbers')}
      >
        Node Numbers
      </button>
      <button
        className={`tab ${activeTab === 'json' ? 'active' : ''}`}
        onClick={() => onTabChange('json')}
      >
        JSON
      </button>
      <button
        className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
        onClick={() => onTabChange('settings')}
      >
        Settings
      </button>
      <div className="spacer" />
      <button
        id="refresh-btn"
        className="btn btn-icon"
        title="Refresh"
        onClick={handleRefresh}
      >
        <span className="icon"><RefreshIcon /></span>
      </button>
      <button
        id="expand-btn"
        className="btn btn-icon"
        title={isExpanded ? 'Collapse' : 'Expand'}
        onClick={handleToggleExpand}
      >
        <span className="icon">
          {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
        </span>
      </button>
    </div>
  );
}
