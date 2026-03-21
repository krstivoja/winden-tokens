import type { Meta, StoryObj } from '@storybook/react-vite';
import { Modal } from '../components/common/Modal/Modal';

const meta = {
  title: 'common/Modal',
  component: Modal,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    isOpen: true,
    onClose: () => console.log("Action"),
    title: {},
    children: {},
    footer: {},
    width: 'Sample width',
    closeOnOverlayClick: true,
    closeOnEscape: true,
    showCloseButton: true,
    className: 'Sample className',
  },
};

// TODO: Add more story variants
// export const Variant1: Story = {
//   args: {
//     ...Default.args,
//   },
// };
