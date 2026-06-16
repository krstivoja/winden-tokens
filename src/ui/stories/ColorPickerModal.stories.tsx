import type { Meta, StoryObj } from '@storybook/react-vite';
import React, { useEffect } from 'react';
import { ColorPickerModal } from '../components/Modals/ColorPickerModal';
import { ModalProvider, useModalContext } from '../components/Modals/ModalContext';
import { AppProvider, useAppContext } from '../context/AppContext';
import { Button } from '../components/common/Button';
import { mockCollections, mockVariables, mockShadeGroups } from './mockData';

// Wrapper with mock data
function ModalDemoInner({ children }: { children: React.ReactNode }) {
  const { setData } = useAppContext();

  useEffect(() => {
    setData(mockCollections, mockVariables, mockShadeGroups);
  }, [setData]);

  return <>{children}</>;
}

function ColorPickerTrigger({ initialColor }: { initialColor: string }) {
  const { openColorPicker } = useModalContext();

  // Auto-open the modal when the story loads
  React.useEffect(() => {
    openColorPicker({
      initialColor,
      onConfirm: (color) => {
        console.log('Color picked:', color);
        alert(`You picked: ${color}`);
      },
    });
  }, [initialColor, openColorPicker]);

  return (
    <div style={{ padding: '20px' }}>
      <p style={{ marginBottom: '16px', color: 'var(--text-dim)' }}>
        The modal should open automatically with color: {initialColor}
      </p>
      <Button
        variant="primary"
        onClick={() => {
          openColorPicker({
            initialColor,
            onConfirm: (color) => {
              console.log('Color picked:', color);
              alert(`You picked: ${color}`);
            },
          });
        }}
      >
        Reopen Color Picker ({initialColor})
      </Button>
      <ColorPickerModal />
    </div>
  );
}

const meta = {
  title: 'Components/Modals/ColorPickerModal',
  component: ColorPickerTrigger,
  decorators: [
    (Story) => (
      <AppProvider>
        <ModalProvider>
          <ModalDemoInner>
            <Story />
          </ModalDemoInner>
        </ModalProvider>
      </AppProvider>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof ColorPickerTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PickRed: Story = {
  args: {
    initialColor: '#ff0000',
  },
};

export const PickBlue: Story = {
  args: {
    initialColor: '#0000ff',
  },
};

export const PickGreen: Story = {
  args: {
    initialColor: '#00ff00',
  },
};

export const PickWhite: Story = {
  args: {
    initialColor: '#ffffff',
  },
};

export const PickBlack: Story = {
  args: {
    initialColor: '#000000',
  },
};

export const PickPurple: Story = {
  args: {
    initialColor: '#8b5cf6',
  },
};
