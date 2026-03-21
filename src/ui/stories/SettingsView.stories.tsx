import type { Meta, StoryObj } from '../components/Tabs/SettingsView';
import { SettingsView } from '../components/Tabs/SettingsView';

const meta = {
  title: 'Tabs/SettingsView',
  component: SettingsView,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof SettingsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    themeMode: {},
    onThemeModeChange: {},
  },
};

// TODO: Add more story variants
// export const Variant1: Story = {
//   args: {
//     ...Default.args,
//   },
// };
