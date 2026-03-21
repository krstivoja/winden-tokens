import type { Meta, StoryObj } from '@storybook/react-vite';
import { ColorMenu } from '../components/Table/ColorMenu';
import { ShadesIcon, StepsIcon, TypeIcons } from '../components/Icons';

const meta = {
  title: 'Table/ColorMenu',
  component: ColorMenu,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `Flexible menu component for color-related actions. Supports two modes:

**1. Default mode** - Standard Pick/Reference buttons (all optional):
- \`onPickColor\` - Pick a solid color
- \`onReferenceColor\` - Reference another variable
- \`onClear\` - Clear selected color (with color swatch)

**2. Custom mode** - Fully custom options via \`options\` prop:
- Pass array of custom buttons with icons, labels, callbacks
- Perfect for extending with new actions

Used by **ColorValueMenu** (editing values) and **ContrastPicker** (WCAG checking). All callbacks are optional for maximum flexibility.`,
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ padding: '20px', position: 'relative', minHeight: '250px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ColorMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BasicMenu: Story = {
  args: {
    position: { top: 50, left: 100 },
    onPickColor: () => console.log('Pick color clicked'),
    onReferenceColor: () => console.log('Reference color clicked'),
    className: 'color-value-menu',
  },
};

export const WithClearButton: Story = {
  args: {
    position: { top: 50, left: 100 },
    onPickColor: () => console.log('Pick color clicked'),
    onReferenceColor: () => console.log('Reference color clicked'),
    onClear: () => console.log('Clear clicked'),
    currentColor: 'rgb(255, 0, 0)',
    className: 'contrast-picker',
  },
};

export const OnlyPickColor: Story = {
  args: {
    position: { top: 50, left: 100 },
    onPickColor: () => console.log('Pick color clicked'),
    className: 'color-value-menu',
  },
};

export const OnlyReferenceColor: Story = {
  args: {
    position: { top: 50, left: 100 },
    onReferenceColor: () => console.log('Reference color clicked'),
    className: 'color-value-menu',
  },
};

export const CustomOptions: Story = {
  args: {
    position: { top: 50, left: 100 },
    className: 'color-value-menu',
    options: [
      {
        label: 'Generate Shades',
        icon: <ShadesIcon />,
        onClick: () => console.log('Generate shades clicked'),
      },
      {
        label: 'Generate Steps',
        icon: <StepsIcon />,
        onClick: () => console.log('Generate steps clicked'),
      },
      {
        label: 'Pick Color',
        icon: <ShadesIcon />,
        onClick: () => console.log('Pick color clicked'),
      },
      {
        label: 'Reference Color',
        icon: TypeIcons.COLOR,
        onClick: () => console.log('Reference color clicked'),
      },
    ],
  },
};
