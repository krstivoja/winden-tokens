import type { Meta, StoryObj } from '../components/Tabs/JsonEditor';
import { JsonEditor } from '../components/Tabs/JsonEditor';

const meta = {
  title: 'Tabs/JsonEditor',
  component: JsonEditor,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof JsonEditor>;

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
