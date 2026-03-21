import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox } from '../components/common/Checkbox/Checkbox';

const meta = {
  title: 'common/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof Checkbox>;

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
