// IconButton component stories

import type { Meta, StoryObj } from '@storybook/react';
import { IconButton } from './IconButton';

const meta = {
  title: 'Common/IconButton',
  component: IconButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

// Simple SVG icons for demonstration
const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4 4l8 8m0-8l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M14 8A6 6 0 1 1 8 2c1.5 0 2.9.6 4 1.5M14 2v4h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 4v8M4 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M3 4h10M6 4V3h4v1M7 7v4M9 7v4M5 4v9h6V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export const Close: Story = {
  args: {
    icon: <CloseIcon />,
    'aria-label': 'Close',
  },
};

export const Refresh: Story = {
  args: {
    icon: <RefreshIcon />,
    'aria-label': 'Refresh',
  },
};

export const Add: Story = {
  args: {
    icon: <PlusIcon />,
    'aria-label': 'Add item',
  },
};

export const Danger: Story = {
  args: {
    icon: <TrashIcon />,
    variant: 'danger',
    'aria-label': 'Delete',
  },
};

export const Ghost: Story = {
  args: {
    icon: <CloseIcon />,
    variant: 'ghost',
    'aria-label': 'Close',
  },
};

export const Small: Story = {
  args: {
    icon: <CloseIcon />,
    size: 'sm',
    'aria-label': 'Close',
  },
};

export const Large: Story = {
  args: {
    icon: <CloseIcon />,
    size: 'lg',
    'aria-label': 'Close',
  },
};

export const Disabled: Story = {
  args: {
    icon: <RefreshIcon />,
    disabled: true,
    'aria-label': 'Refresh (disabled)',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
      <IconButton icon={<CloseIcon />} variant="default" aria-label="Close" />
      <IconButton icon={<TrashIcon />} variant="danger" aria-label="Delete" />
      <IconButton icon={<RefreshIcon />} variant="ghost" aria-label="Refresh" />
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
      <IconButton icon={<CloseIcon />} size="sm" aria-label="Close small" />
      <IconButton icon={<CloseIcon />} size="md" aria-label="Close medium" />
      <IconButton icon={<CloseIcon />} size="lg" aria-label="Close large" />
    </div>
  ),
};

export const ModalCloseButton: Story = {
  render: () => (
    <div style={{ position: 'relative', width: '300px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
      <IconButton
        icon={<CloseIcon />}
        variant="ghost"
        aria-label="Close dialog"
        style={{ position: 'absolute', top: '8px', right: '8px' }}
      />
      <h3 style={{ margin: '0 0 8px 0' }}>Modal Title</h3>
      <p style={{ margin: 0 }}>Modal content goes here...</p>
    </div>
  ),
};

export const Toolbar: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '8px', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
      <IconButton icon={<PlusIcon />} aria-label="Add" />
      <IconButton icon={<RefreshIcon />} aria-label="Refresh" />
      <div style={{ flex: 1 }} />
      <IconButton icon={<TrashIcon />} variant="danger" aria-label="Delete" />
      <IconButton icon={<CloseIcon />} variant="ghost" aria-label="Close" />
    </div>
  ),
};
