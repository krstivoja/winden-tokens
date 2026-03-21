import type { Meta, StoryObj } from '../components/Table/GroupHeader';
import { GroupHeader } from '../components/Table/GroupHeader';

const meta = {
  title: 'Table/GroupHeader',
  component: GroupHeader,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof GroupHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    groupName: 'Sample groupName',
    variables: {},
    isCollapsed: true,
  },
};

// TODO: Add more story variants
// export const Variant1: Story = {
//   args: {
//     ...Default.args,
//   },
// };
