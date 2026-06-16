// Color reference modal component stories

import type { Meta, StoryObj } from '@storybook/react';
import { ColorReferenceModal } from '../components/Modals/ColorReferenceModal';
import { ModalProvider } from '../components/Modals/ModalContext';
import { AppProvider } from '../context/AppContext';

const meta = {
  title: 'Modals/ColorReferenceModal',
  component: ColorReferenceModal,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <AppProvider>
        <ModalProvider>
          <Story />
        </ModalProvider>
      </AppProvider>
    ),
  ],
} satisfies Meta<typeof ColorReferenceModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    return <ColorReferenceModal />;
  },
};
