import type { Meta, StoryObj } from '@storybook/react-vite';
import React, { useEffect } from 'react';
import { InputModal } from '../components/Modals/InputModal';
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

function InputModalTrigger({ title, label, confirmText }: { title: string; label: string; confirmText: string }) {
  const { openInputModal } = useModalContext();

  // Auto-open the modal when the story loads
  React.useEffect(() => {
    openInputModal({
      title,
      label,
      confirmText,
      onConfirm: (value) => {
        console.log('Input confirmed:', value);
        alert(`You entered: ${value}`);
      },
    });
  }, [title, label, confirmText, openInputModal]);

  return (
    <div style={{ padding: '20px' }}>
      <p style={{ marginBottom: '16px', color: 'var(--text-dim)' }}>
        The modal should open automatically. Close it and click the button to reopen.
      </p>
      <Button
        variant="primary"
        onClick={() => {
          openInputModal({
            title,
            label,
            confirmText,
            onConfirm: (value) => {
              console.log('Input confirmed:', value);
              alert(`You entered: ${value}`);
            },
          });
        }}
      >
        Reopen {title}
      </Button>
      <InputModal />
    </div>
  );
}

const meta = {
  title: 'Components/Modals/InputModal',
  component: InputModalTrigger,
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
} satisfies Meta<typeof InputModalTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CreateCollection: Story = {
  args: {
    title: 'New Collection',
    label: 'Collection name',
    confirmText: 'Create',
  },
};

export const CreateVariable: Story = {
  args: {
    title: 'New Variable',
    label: 'Variable name',
    confirmText: 'Create',
  },
};

export const RenameItem: Story = {
  args: {
    title: 'Rename',
    label: 'New name',
    confirmText: 'Rename',
  },
};
