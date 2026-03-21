import type { Meta, StoryObj } from '../components/Table/GroupCollectionCell';
import { GroupCollectionCell } from '../components/Table/GroupCollectionCell';

const meta = {
  title: 'Table/GroupCollectionCell',
  component: GroupCollectionCell,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof GroupCollectionCell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variables: {},
  },
};

// TODO: Add more story variants
// export const Variant1: Story = {
//   args: {
//     ...Default.args,
//   },
// };
