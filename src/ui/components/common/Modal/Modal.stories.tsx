// Modal component stories

import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from '../Button';
import { Input } from '../Input';
import { FormGroup } from '../FormGroup';

const meta = {
  title: 'Common/Modal',
  component: Modal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setIsOpen(true)}>Open Modal</Button>
        <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Modal Title">
          <p>This is the modal content.</p>
        </Modal>
      </>
    );
  },
};

export const WithFooter: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setIsOpen(true)}>Open Modal</Button>
        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Confirm Action"
          footer={
            <>
              <Button onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => setIsOpen(false)}>
                Confirm
              </Button>
            </>
          }
        >
          <p>Are you sure you want to proceed with this action?</p>
        </Modal>
      </>
    );
  },
};

export const WithForm: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setIsOpen(true)}>Create Variable</Button>
        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="New Variable"
          footer={
            <>
              <Button onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => setIsOpen(false)}>
                Create
              </Button>
            </>
          }
        >
          <FormGroup label="Variable Name" htmlFor="var-name" required>
            <Input id="var-name" placeholder="primary-color" />
          </FormGroup>
          <FormGroup label="Variable Value" htmlFor="var-value" required>
            <Input id="var-value" placeholder="#FF5733" mono />
          </FormGroup>
        </Modal>
      </>
    );
  },
};

export const LargeModal: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setIsOpen(true)}>Open Large Modal</Button>
        <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Large Modal" width={800}>
          <p>This modal is wider (800px) to accommodate more content.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <FormGroup label="First Name" htmlFor="first">
              <Input id="first" placeholder="John" />
            </FormGroup>
            <FormGroup label="Last Name" htmlFor="last">
              <Input id="last" placeholder="Doe" />
            </FormGroup>
          </div>
        </Modal>
      </>
    );
  },
};

export const NoCloseButton: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setIsOpen(true)}>Open Modal</Button>
        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Important Message"
          showCloseButton={false}
          footer={
            <Button variant="primary" onClick={() => setIsOpen(false)}>
              I Understand
            </Button>
          }
        >
          <p>You must acknowledge this message before continuing.</p>
        </Modal>
      </>
    );
  },
};

export const NoOverlayClose: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setIsOpen(true)}>Open Modal</Button>
        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Required Action"
          closeOnOverlayClick={false}
          footer={
            <>
              <Button onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => setIsOpen(false)}>
                Save
              </Button>
            </>
          }
        >
          <p>Click outside won't close this modal. Use the buttons instead.</p>
        </Modal>
      </>
    );
  },
};

export const DangerAction: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <>
        <Button variant="danger" onClick={() => setIsOpen(true)}>
          Delete All
        </Button>
        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Delete All Variables"
          footer={
            <>
              <Button onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button variant="danger" onClick={() => setIsOpen(false)}>
                Delete All
              </Button>
            </>
          }
        >
          <p>
            <strong>Warning:</strong> This will delete all variables and collections.
            This action cannot be undone!
          </p>
        </Modal>
      </>
    );
  },
};

export const MultipleModals: Story = {
  render: () => {
    const [firstOpen, setFirstOpen] = useState(false);
    const [secondOpen, setSecondOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setFirstOpen(true)}>Open First Modal</Button>
        <Modal
          isOpen={firstOpen}
          onClose={() => setFirstOpen(false)}
          title="First Modal"
          footer={
            <>
              <Button onClick={() => setFirstOpen(false)}>Close</Button>
              <Button variant="primary" onClick={() => setSecondOpen(true)}>
                Open Second Modal
              </Button>
            </>
          }
        >
          <p>Click the button to open a second modal on top of this one.</p>
        </Modal>
        <Modal
          isOpen={secondOpen}
          onClose={() => setSecondOpen(false)}
          title="Second Modal"
          width={300}
        >
          <p>This is a second modal opened on top of the first one.</p>
        </Modal>
      </>
    );
  },
};
