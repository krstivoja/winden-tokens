import type { Meta, StoryObj } from '@storybook/react-vite';
import { ColorValueMenu } from '../components/Table/ColorValueMenu';
import { AppProvider } from '../context/AppContext';
import { ModalProvider } from '../components/Modals/ModalContext';

const meta = {
  title: 'Table/ColorValueMenu',
  component: ColorValueMenu,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Context menu for editing color variable values. Wrapper around **ColorMenu** that handles modal opening and plugin messages. Used when clicking a color cell in the table. See also: **ContrastPicker** for contrast checking.',
      },
    },
  },
  decorators: [
    (Story) => (
      <AppProvider>
        <ModalProvider>
          <div style={{ padding: '20px', position: 'relative', minHeight: '200px' }}>
            <Story />
          </div>
        </ModalProvider>
      </AppProvider>
    ),
  ],
} satisfies Meta<typeof ColorValueMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    position: { top: 50, left: 100 },
    variableId: 'var-1',
    currentValue: 'rgb(255, 0, 0)',
    onClose: () => console.log('Menu closed'),
  },
};

export const BlueColor: Story = {
  args: {
    position: { top: 50, left: 100 },
    variableId: 'var-2',
    currentValue: 'rgb(0, 0, 255)',
    onClose: () => console.log('Menu closed'),
  },
};
