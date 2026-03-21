import type { Meta, StoryObj } from '../components/Table/CollectionCell';
import { CollectionCell } from '../components/Table/CollectionCell';

const meta = {
  title: 'Table/CollectionCell',
  component: CollectionCell,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof CollectionCell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variable: {},
  },
};

// TODO: Add more story variants
// export const Variant1: Story = {
//   args: {
//     ...Default.args,
//   },
// };
