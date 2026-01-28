// Tab bar component

import React from 'react';
import { RefreshIcon, ExpandIcon, CollapseIcon } from '../Icons';
import { post } from '../../hooks/usePluginMessages';

interface TabBarProps {
  activeTab: 'table' | 'json';
  onTabChange: (tab: 'table' | 'json') => void;
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [lastSize, setLastSize] = React.useState({ width: 0, height: 0 });

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
      const width = lastSize.width || 600;
      const height = lastSize.height || 500;
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
        className={`tab ${activeTab === 'json' ? 'active' : ''}`}
        onClick={() => onTabChange('json')}
      >
        JSON
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
