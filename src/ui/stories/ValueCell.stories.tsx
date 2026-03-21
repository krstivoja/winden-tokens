import type { Meta, StoryObj } from '../components/Table/ValueCell';
import { ValueCell } from '../components/Table/ValueCell';

const meta = {
  title: 'Table/ValueCell',
  component: ValueCell,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof ValueCell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variable: {},
    onShowColorMenu: 'Sample onShowColorMenu',
  },
};

// TODO: Add more story variants
// export const Variant1: Story = {
//   args: {
//     ...Default.args,
//   },
// };
