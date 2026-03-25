import type { Meta, StoryObj } from '@storybook/react';
import { SettingsView } from '../components/Tabs/SettingsView';
import { AppContext } from '../context/AppContext';

const meta = {
  title: 'Tabs/SettingsView',
  component: SettingsView,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <AppContext.Provider
        value={{
          collections: [
            { id: '1', name: 'Colors', modes: [{ modeId: '1:0', name: 'Light' }] },
            { id: '2', name: 'Spacing', modes: [{ modeId: '2:0', name: 'Default' }] },
          ],
          variables: [
            { id: 'var1', name: 'primary', resolvedType: 'COLOR', valuesByMode: {} },
            { id: 'var2', name: 'secondary', resolvedType: 'COLOR', valuesByMode: {} },
            { id: 'var3', name: 'spacing-sm', resolvedType: 'FLOAT', valuesByMode: {} },
          ],
        }}
      >
        <div className="w-96 h-96 bg-base">
          <Story />
        </div>
      </AppContext.Provider>
    ),
  ],
  argTypes: {
    themeMode: {
      control: 'select',
      options: ['figma', 'light', 'dark'],
    },
    onThemeModeChange: { action: 'themeChanged' },
  },
} satisfies Meta<typeof SettingsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FollowFigma: Story = {
  args: {
    themeMode: 'figma',
    onThemeModeChange: () => {},
  },
};

export const LightMode: Story = {
  args: {
    themeMode: 'light',
    onThemeModeChange: () => {},
  },
};

export const DarkMode: Story = {
  args: {
    themeMode: 'dark',
    onThemeModeChange: () => {},
  },
};

export const EmptyState: Story = {
  decorators: [
    (Story) => (
      <AppContext.Provider
        value={{
          collections: [],
          variables: [],
        }}
      >
        <div className="w-96 h-96 bg-base">
          <Story />
        </div>
      </AppContext.Provider>
    ),
  ],
  args: {
    themeMode: 'figma',
    onThemeModeChange: () => {},
  },
};
