import type { Meta, StoryObj } from '../components/icons/Icon';
import { Icon } from '../components/icons/Icon';

const meta = {
  title: 'icons/Icon',
  component: Icon,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    name: {},
    size: 42,
    className: 'Sample className',
  },
};

// TODO: Add more story variants
// export const Variant1: Story = {
//   args: {
//     ...Default.args,
//   },
// };
