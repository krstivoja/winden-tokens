import type { Meta, StoryObj } from '@storybook/react-vite';
import { ContrastPicker } from '../components/Table/ContrastPicker';

const meta = {
  title: 'Table/ContrastPicker',
  component: ContrastPicker,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Menu for selecting a contrast reference color to check WCAG compliance. Wrapper around **ColorMenu** that passes callbacks from parent. Used in table rows for accessibility testing. See also: **ColorValueMenu** for editing color values.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ padding: '20px', position: 'relative', minHeight: '200px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ContrastPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoColorSelected: Story = {
  args: {
    position: { top: 50, left: 100 },
    contrastColor: null,
    onPickColor: () => console.log('Pick color clicked'),
    onReferenceColor: () => console.log('Reference color clicked'),
    onClear: () => console.log('Clear clicked'),
  },
};

export const WithRedSelected: Story = {
  args: {
    position: { top: 50, left: 100 },
    contrastColor: 'rgb(255, 0, 0)',
    onPickColor: () => console.log('Pick color clicked'),
    onReferenceColor: () => console.log('Reference color clicked'),
    onClear: () => console.log('Clear clicked'),
  },
};

export const WithWhiteSelected: Story = {
  args: {
    position: { top: 50, left: 100 },
    contrastColor: 'rgb(255, 255, 255)',
    onPickColor: () => console.log('Pick color clicked'),
    onReferenceColor: () => console.log('Reference color clicked'),
    onClear: () => console.log('Clear clicked'),
  },
};
