import type { Meta, StoryObj } from '../components/Toolbar/AddMenu';
import { AddMenu } from '../components/Toolbar/AddMenu';

const meta = {
  title: 'Toolbar/AddMenu',
  component: AddMenu,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof AddMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    position: 42,
  },
};

// TODO: Add more story variants
// export const Variant1: Story = {
//   args: {
//     ...Default.args,
//   },
// };
