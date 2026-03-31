// Settings view component

import React, { useState } from 'react';
import { post } from '../../hooks/usePluginMessages';
import { useAppContext } from '../../context/AppContext';
import { TextButton } from '../common/Button';

export function SettingsView() {
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
            variant="outline"
            onClick={() => handleImportPreset('tailwind-complete')}
          >
            Import Tailwind CSS
          </TextButton>
          <TextButton
            variant="outline"
            onClick={() => handleImportPreset('basic')}
          >
            Import Basic Tokens
          </TextButton>
        </div>
      </div>
    </div>
  );
}
