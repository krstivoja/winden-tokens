// Settings view component

import React, { useState } from 'react';
import { post } from '../../hooks/usePluginMessages';
import { useAppContext } from '../../context/AppContext';
import { TextButton } from '../common/Button';
import { Select } from '../common/Select';
import type { ThemeMode } from '../../App';

interface SettingsViewProps {
  themeMode: ThemeMode;
  onThemeModeChange: (themeMode: ThemeMode) => void;
}

export function SettingsView({ themeMode, onThemeModeChange }: SettingsViewProps) {
  const { collections, variables } = useAppContext();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAll = () => {
    const confirmMessage = `Delete ALL variables and collections?\n\nThis will delete:\n- ${collections.length} collections\n- ${variables.length} variables\n\nThis action cannot be undone!`;

    if (confirm(confirmMessage)) {
      setIsDeleting(true);
      post({ type: 'delete-all-variables' });
      // Reset state after a delay to allow the operation to complete
      setTimeout(() => setIsDeleting(false), 2000);
    }
  };

  const handleImportPreset = (presetName: string) => {
    const confirmMessage = `Import "${presetName}" preset?\n\nThis will create new variables and collections.`;

    if (confirm(confirmMessage)) {
      post({ type: 'import-preset', preset: presetName });
    }
  };

  return (
    <div className="settings-view">
      <div className="settings-section">
        <h3 className="settings-heading">Appearance</h3>
        <p className="settings-description">
          Follow Figma automatically, or force a light or dark UI theme for this plugin.
        </p>

        <div className="settings-control">
          <label className="settings-label" htmlFor="theme-mode-select">Theme</label>
          <Select
            id="theme-mode-select"
            className="settings-select"
            value={themeMode}
            onChange={(event) => onThemeModeChange(event.target.value as ThemeMode)}
          >
            <Select.Option value="figma">Follow Figma</Select.Option>
            <Select.Option value="light">Light</Select.Option>
            <Select.Option value="dark">Dark</Select.Option>
          </Select>
        </div>

        <p className="settings-note">
          Follow Figma uses the editor theme passed into the plugin via `themeColors`.
        </p>
      </div>

      <div className="settings-section">
        <h3 className="settings-heading">Danger Zone</h3>
        <p className="settings-description">
          Destructive actions that cannot be undone.
        </p>
        <TextButton
          variant="danger"
          onClick={handleDeleteAll}
          disabled={isDeleting || variables.length === 0}
        >
          {isDeleting ? 'Deleting...' : 'Delete All Variables'}
        </TextButton>
        <p className="settings-note">
          Current: {collections.length} collections, {variables.length} variables
        </p>
      </div>

      <div className="settings-section">
        <h3 className="settings-heading">Import Presets</h3>
        <p className="settings-description">
          Quick start with pre-configured design token sets.
        </p>

        <div className="presets-simple">
          <TextButton
            onClick={() => handleImportPreset('tailwind-complete')}
          >
            Import Tailwind CSS
          </TextButton>
          <TextButton
            onClick={() => handleImportPreset('basic')}
          >
            Import Basic Tokens
          </TextButton>
        </div>
      </div>
    </div>
  );
}
