// Textarea component stories

import type { Meta, StoryObj } from '@storybook/react';
import { Textarea } from './Textarea';

const meta = {
  title: 'Common/Textarea',
  component: Textarea,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
    rows: 4,
  },
};

export const WithValue: Story = {
  args: {
    value: 'Line 1\nLine 2\nLine 3',
    rows: 4,
    onChange: () => {},
  },
};

export const Monospace: Story = {
  args: {
    mono: true,
    placeholder: '50, #FFFFFF\n100, #F5F5F5\n200, #EEEEEE',
    rows: 6,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    value: 'Disabled textarea',
    rows: 3,
    onChange: () => {},
  },
};

export const WithError: Story = {
  args: {
    value: 'Invalid JSON',
    error: 'Please enter valid JSON',
    rows: 4,
    id: 'json-textarea',
  },
};

export const FullWidth: Story = {
  args: {
    fullWidth: true,
    placeholder: 'Full width textarea',
    rows: 4,
  },
  parameters: {
    layout: 'padded',
  },
};

export const NoResize: Story = {
  args: {
    resize: 'none',
    placeholder: 'Cannot be resized',
    rows: 4,
  },
};

export const HorizontalResize: Story = {
  args: {
    resize: 'horizontal',
    placeholder: 'Can resize horizontally',
    rows: 4,
  },
};

export const BulkEditExample: Story = {
  render: () => (
    <div style={{ width: '400px' }}>
      <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px' }}>
        One variable per line: <code>name, value</code>
      </label>
      <Textarea
        mono
        placeholder="50, #FFFFFF&#10;100, #F5F5F5&#10;200, #EEEEEE"
        rows={8}
        spellCheck={false}
      />
    </div>
  ),
};
