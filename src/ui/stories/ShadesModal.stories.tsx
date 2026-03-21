import type { Meta, StoryObj } from '@storybook/react-vite';
import React, { useEffect } from 'react';
import { ShadesModal } from '../components/Modals/ShadesModal';
import { ModalProvider, useModalContext } from '../components/Modals/ModalContext';
import { AppProvider, useAppContext } from '../context/AppContext';
import { mockCollections, mockVariables, mockShadeGroups } from './mockData';

// Wrapper with mock data
function ModalDemoInner({ children }: { children: React.ReactNode }) {
  const { setData } = useAppContext();

  useEffect(() => {
    setData(mockCollections, mockVariables, mockShadeGroups);
  }, [setData]);

  return <>{children}</>;
}

function ShadesModalTrigger({ groupName }: { groupName?: string }) {
  const { openShadesModal } = useModalContext();

  // Auto-open the modal when the story loads
  React.useEffect(() => {
    openShadesModal({ groupName: groupName || '' });
  }, [groupName, openShadesModal]);

  return (
    <div style={{ padding: '20px' }}>
      <p style={{ marginBottom: '16px', color: 'var(--text-dim)' }}>
        The Shades Generator modal should open automatically{groupName && ` for group: ${groupName}`}.
      </p>
      <button
        className="btn btn-primary"
        onClick={() => {
          openShadesModal({ groupName: groupName || '' });
        }}
      >
        Reopen Shades Generator {groupName && `(${groupName})`}
      </button>
      <ShadesModal />
    </div>
  );
}

const meta = {
  title: 'Components/Modals/ShadesModal',
  component: ShadesModalTrigger,
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
} satisfies Meta<typeof ShadesModalTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GenerateShades: Story = {
  args: {},
};

export const GenerateShadesForGroup: Story = {
  args: {
    groupName: 'primary',
  },
};
