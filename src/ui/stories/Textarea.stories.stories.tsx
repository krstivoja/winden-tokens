import type { Meta, StoryObj } from '../components/common/Textarea/Textarea.stories';
import { Default } from '../components/common/Textarea/Textarea.stories';

const meta = {
  title: 'common/Textarea.stories',
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
