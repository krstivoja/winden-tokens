import type { Meta, StoryObj } from '../components/common/Textarea/Textarea';
import { Textarea } from '../components/common/Textarea/Textarea';

const meta = {
  title: 'common/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof Textarea>;

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
