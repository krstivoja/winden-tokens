import type { Meta, StoryObj } from '../components/Toolbar/CollectionFilters';
import { CollectionFilters } from '../components/Toolbar/CollectionFilters';

const meta = {
  title: 'Toolbar/CollectionFilters',
  component: CollectionFilters,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof CollectionFilters>;

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
