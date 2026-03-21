import type { Meta, StoryObj } from '../components/common/Select/Select';
import { Select } from '../components/common/Select/Select';

const meta = {
  title: 'common/Select',
  component: Select,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof Select>;

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
