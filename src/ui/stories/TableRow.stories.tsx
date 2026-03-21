import type { Meta, StoryObj } from '../components/Table/TableRow';
import { TableRow } from '../components/Table/TableRow';

const meta = {
  title: 'Table/TableRow',
  component: TableRow,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof TableRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variable: {},
    isGrouped: true,
    isHidden: true,
    groupName: 'Sample groupName',
    onShowColorMenu: 'Sample onShowColorMenu',
    contrastColor: 'Sample contrastColor',
    colorVariables: {},
  },
};

// TODO: Add more story variants
// export const Variant1: Story = {
//   args: {
//     ...Default.args,
//   },
// };
