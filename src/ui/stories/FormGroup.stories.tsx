import type { Meta, StoryObj } from '../components/common/FormGroup/FormGroup';
import { FormGroup } from '../components/common/FormGroup/FormGroup';

const meta = {
  title: 'common/FormGroup',
  component: FormGroup,
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof FormGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Sample label',
    htmlFor: 'Sample htmlFor',
    required: true,
    description: 'Sample description',
    error: 'Sample error',
    children: {},
    className: 'Sample className',
    inline: true,
  },
};

// TODO: Add more story variants
// export const Variant1: Story = {
//   args: {
//     ...Default.args,
//   },
// };
