// Label component stories

import type { Meta, StoryObj } from '@storybook/react';
import { Label } from './Label';
import { Input } from '../Input';

const meta = {
  title: 'Common/Label',
  component: Label,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Email Address',
    htmlFor: 'email-input',
  },
};

export const Required: Story = {
  args: {
    children: 'Password',
    htmlFor: 'password-input',
    required: true,
  },
};

export const WithInput: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '250px' }}>
      <Label htmlFor="name-input">Full Name</Label>
      <Input id="name-input" placeholder="John Doe" />
    </div>
  ),
};

export const RequiredWithInput: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '250px' }}>
      <Label htmlFor="email-input" required>Email Address</Label>
      <Input id="email-input" type="email" placeholder="john@example.com" />
    </div>
  ),
};

export const MultipleFields: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '300px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Label htmlFor="var-name" required>Variable Name</Label>
        <Input id="var-name" placeholder="primary-color" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Label htmlFor="var-value" required>Variable Value</Label>
        <Input id="var-value" placeholder="#FF5733" mono />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Label htmlFor="var-desc">Description</Label>
        <Input id="var-desc" placeholder="Optional description" />
      </div>
    </div>
  ),
};
