import type { Meta, StoryObj } from '../components/Toolbar/VariableTypeFilters';
import { VariableTypeFilters } from '../components/Toolbar/VariableTypeFilters';

const meta = {
  title: 'Toolbar/VariableTypeFilters',
  component: VariableTypeFilters,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof VariableTypeFilters>;

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
