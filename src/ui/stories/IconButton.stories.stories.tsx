import type { Meta, StoryObj } from '../components/common/IconButton/IconButton.stories';
import { Close } from '../components/common/IconButton/IconButton.stories';

const meta = {
  title: 'common/IconButton.stories',
  component: Close,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof Close>;

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
