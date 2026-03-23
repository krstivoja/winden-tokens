import type { Meta, StoryObj } from '@storybook/react-vite';
import React, { useEffect } from 'react';
import { StepsModal } from '../components/Modals/StepsModal';
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

function StepsModalTrigger({ groupName }: { groupName?: string }) {
  const { openStepsModal } = useModalContext();

  // Auto-open the modal when the story loads
  React.useEffect(() => {
    openStepsModal({ groupName: groupName || '' });
  }, [groupName, openStepsModal]);

  return (
    <div style={{ padding: '20px' }}>
      <p style={{ marginBottom: '16px', color: 'var(--text-dim)' }}>
        The Steps Generator modal should open automatically{groupName && ` for group: ${groupName}`}.
      </p>
      <Button
        variant="primary"
        onClick={() => {
          openStepsModal({ groupName: groupName || '' });
        }}
      >
        Reopen Steps Generator {groupName && `(${groupName})`}
      </Button>
      <StepsModal />
    </div>
  );
}

const meta = {
  title: 'Components/Modals/StepsModal',
  component: StepsModalTrigger,
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
} satisfies Meta<typeof StepsModalTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GenerateSteps: Story = {
  args: {},
};

export const GenerateStepsForGroup: Story = {
  args: {
    groupName: 'spacing',
  },
};
