import type { Meta, StoryObj } from '@storybook/react-vite';
import { WithInput } from '../components/common/FormGroup/FormGroup.stories';

const meta = {
  title: 'common/FormGroup.stories',
  component: WithInput,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof WithInput>;

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
