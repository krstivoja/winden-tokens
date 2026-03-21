import type { Meta, StoryObj } from '../components/common/Input/Input';
import { Input } from '../components/common/Input/Input';

const meta = {
  title: 'common/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof Input>;

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
