import type { Meta, StoryObj } from '../components/Modals/BulkEditModal';
import { BulkEditModal } from '../components/Modals/BulkEditModal';

const meta = {
  title: 'Modals/BulkEditModal',
  component: BulkEditModal,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof BulkEditModal>;

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
