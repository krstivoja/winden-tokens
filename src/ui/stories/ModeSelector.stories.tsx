import type { Meta, StoryObj } from '../components/Toolbar/ModeSelector';
import { ModeSelector } from '../components/Toolbar/ModeSelector';

const meta = {
  title: 'Toolbar/ModeSelector',
  component: ModeSelector,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof ModeSelector>;

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
