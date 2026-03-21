import type { Meta, StoryObj } from '@storybook/react-vite';
import { Primary } from '../components/common/Button/Button.stories';

const meta = {
  title: 'common/Button.stories',
  component: Primary,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof Primary>;

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
