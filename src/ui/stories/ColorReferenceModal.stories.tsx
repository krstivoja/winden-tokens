import type { Meta, StoryObj } from '../components/Modals/ColorReferenceModal';
import { ColorReferenceModal } from '../components/Modals/ColorReferenceModal';

const meta = {
  title: 'Modals/ColorReferenceModal',
  component: ColorReferenceModal,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof ColorReferenceModal>;

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
