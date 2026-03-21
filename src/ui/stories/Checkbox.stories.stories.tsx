import type { Meta, StoryObj } from '@storybook/react-vite';
import { Default } from '../components/common/Checkbox/Checkbox.stories';

const meta = {
  title: 'common/Checkbox.stories',
  component: Default,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof Default>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {

  },
};

// TODO: Add more story variants
// export const Variant1: Story = {
//   args: {
//     ...Default.args,
//   },
// };
