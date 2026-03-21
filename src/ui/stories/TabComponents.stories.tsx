import type { Meta, StoryObj } from '@storybook/react-vite';
import { JsonEditor } from '../components/Tabs/JsonEditor';
import { SettingsView } from '../components/Tabs/SettingsView';
import { AppProvider } from '../context/AppContext';
import { useState } from 'react';
import type { ThemeMode } from '../App';

// --- JsonEditor Stories ---

const jsonEditorMeta = {
  title: 'Components/Tabs/JsonEditor',
  component: JsonEditor,
  decorators: [
    (Story) => (
      <AppProvider>
        <div style={{ padding: '20px', height: '600px' }}>
          <Story />
        </div>
      </AppProvider>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof JsonEditor>;

export default jsonEditorMeta;
type JsonEditorStory = StoryObj<typeof jsonEditorMeta>;

export const Default: JsonEditorStory = {};

export const WithMockData: JsonEditorStory = {
  render: () => {
    return <JsonEditor />;
  },
};

// --- SettingsView Stories ---

function SettingsViewWrapper() {
  const [themeMode, setThemeMode] = useState<ThemeMode>('figma');

  return (
    <SettingsView
      themeMode={themeMode}
      onThemeModeChange={setThemeMode}
    />
  );
}

const settingsViewMeta = {
  title: 'Components/Tabs/SettingsView',
  component: SettingsViewWrapper,
  decorators: [
    (Story) => (
      <AppProvider>
        <div style={{ padding: '20px' }}>
          <Story />
        </div>
      </AppProvider>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof SettingsViewWrapper>;

export { settingsViewMeta };

type SettingsViewStory = StoryObj<typeof settingsViewMeta>;

export const SettingsDefault: SettingsViewStory = {};

export const LightTheme: SettingsViewStory = {
  render: () => {
    const [themeMode, setThemeMode] = useState<ThemeMode>('light');
    return (
      <SettingsView
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
      />
    );
  },
};

export const DarkTheme: SettingsViewStory = {
  render: () => {
    const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
    return (
      <SettingsView
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
      />
    );
  },
};

export const FigmaTheme: SettingsViewStory = {
  render: () => {
    const [themeMode, setThemeMode] = useState<ThemeMode>('figma');
    return (
      <SettingsView
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
      />
    );
  },
};
