import type { Meta, StoryObj } from '../components/common/Dropdown/Dropdown';
import { Dropdown } from '../components/common/Dropdown/Dropdown';

const meta = {
  title: 'common/Dropdown',
  component: Dropdown,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof Dropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    trigger: {},
    isOpen: true,
    onToggle: () => console.log("Action"),
    onClose: () => console.log("Action"),
    children: {},
    position: {},
    className: 'Sample className',
    triggerClassName: 'Sample triggerClassName',
    menuClassName: 'Sample menuClassName',
    align: {},
  },
};

// TODO: Add more story variants
// export const Variant1: Story = {
//   args: {
//     ...Default.args,
//   },
// };
