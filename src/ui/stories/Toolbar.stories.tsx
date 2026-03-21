import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toolbar } from '../components/Toolbar/Toolbar';

const meta = {
  title: 'Views/Toolbar',
  component: Toolbar,
  tags: ['autodocs'],
  args: {
    status: { message: '', type: '' },
  },
} satisfies Meta<typeof Toolbar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithWarning: Story = {
  args: {
    status: {
      message: 'Changes detected - click Refresh',
      type: 'warning',
    },
  },
};
