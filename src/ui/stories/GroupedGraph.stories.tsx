import type { Meta, StoryObj } from '../components/Relationships/GroupedGraph';
import { GroupedGraph } from '../components/Relationships/GroupedGraph';

const meta = {
  title: 'Relationships/GroupedGraph',
  component: GroupedGraph,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof GroupedGraph>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    collections: {},
    variables: {},
    selectedCollectionIds: 'Sample selectedCollectionIds',
    variableType: {},
    shadeGroups: {},
    selectedModeId: 'Sample selectedModeId',
  },
};

// TODO: Add more story variants
// export const Variant1: Story = {
//   args: {
//     ...Default.args,
//   },
// };
