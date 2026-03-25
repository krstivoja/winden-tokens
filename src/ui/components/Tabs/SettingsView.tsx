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
    <div className="flex flex-col gap-8 p-6 max-w-2xl mx-auto">
      {/* Appearance Section */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-bold text-text">Appearance</h3>
        <p className="text-sm text-text/60 leading-relaxed">
          Follow Figma automatically, or force a light or dark UI theme for this plugin.
        </p>

        <div className="flex flex-col gap-2 mt-1">
          <label className="text-sm font-semibold text-text" htmlFor="theme-mode-select">
            Theme
          </label>
          <Select
            id="theme-mode-select"
            value={themeMode}
            onChange={(event) => onThemeModeChange(event.target.value as ThemeMode)}
          >
            <Select.Option value="figma">Follow Figma</Select.Option>
            <Select.Option value="light">Light</Select.Option>
            <Select.Option value="dark">Dark</Select.Option>
          </Select>
        </div>

        <p className="text-sm text-text/60 leading-relaxed">
          Follow Figma uses the editor theme passed into the plugin via `themeColors`.
        </p>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Danger Zone Section */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-bold text-text">Danger Zone</h3>
        <p className="text-sm text-text/60 leading-relaxed">
          Destructive actions that cannot be undone.
        </p>

        <TextButton
          variant="danger"
          onClick={handleDeleteAll}
          disabled={isDeleting || variables.length === 0}
        >
          {isDeleting ? 'Deleting...' : 'Delete All Variables'}
        </TextButton>

        <p className="text-sm text-text/60 leading-relaxed">
          Current: {collections.length} collections, {variables.length} variables
        </p>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Import Presets Section */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-bold text-text">Import Presets</h3>
        <p className="text-sm text-text/60 leading-relaxed">
          Quick start with pre-configured design token sets.
        </p>

        <div className="flex flex-col gap-3">
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
