import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../components/common/Button/Button';

const meta = {
  title: 'common/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof Button>;

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
