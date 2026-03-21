import type { Meta, StoryObj } from '../components/common/Label/Label';
import { Label } from '../components/common/Label/Label';

const meta = {
  title: 'common/Label',
  component: Label,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof Label>;

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
