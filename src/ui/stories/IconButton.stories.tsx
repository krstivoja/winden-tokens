import type { Meta, StoryObj } from '../components/common/IconButton/IconButton';
import { IconButton } from '../components/common/IconButton/IconButton';

const meta = {
  title: 'common/IconButton',
  component: IconButton,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof IconButton>;

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
