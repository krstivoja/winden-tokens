// Input component stories

import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './Input';

const meta = {
  title: 'Common/Input',
  component: Input,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'number', 'email', 'password', 'url'],
      description: 'Input type',
    },
    disabled: {
      control: 'boolean',
      description: 'Disabled state',
    },
    mono: {
      control: 'boolean',
      description: 'Monospace font',
    },
    fullWidth: {
      control: 'boolean',
      description: 'Full width input',
    },
    error: {
      control: 'text',
      description: 'Error message',
    },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
  },
};

export const WithValue: Story = {
  args: {
    value: 'Hello World',
    onChange: () => {},
  },
};

export const Number: Story = {
  args: {
    type: 'number',
    placeholder: '0',
    min: 0,
    max: 100,
  },
};

export const Monospace: Story = {
  args: {
    mono: true,
    placeholder: '#000000',
    value: '#FF5733',
    onChange: () => {},
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    value: 'Disabled input',
    onChange: () => {},
  },
};

export const WithError: Story = {
  args: {
    value: 'invalid@',
    error: 'Please enter a valid email address',
    id: 'email-input',
  },
};

export const FullWidth: Story = {
  args: {
    fullWidth: true,
    placeholder: 'Full width input',
  },
  parameters: {
    layout: 'padded',
  },
};

export const AllTypes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '300px' }}>
      <Input type="text" placeholder="Text input" />
      <Input type="number" placeholder="Number input" min={0} max={100} />
      <Input type="email" placeholder="Email input" />
      <Input type="password" placeholder="Password input" />
      <Input type="url" placeholder="URL input" />
    </div>
  ),
};

export const ColorInput: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '200px' }}>
      <Input mono placeholder="#000000" />
      <Input mono value="rgb(255, 0, 0)" onChange={() => {}} />
      <Input mono value="rgba(0, 255, 0, 0.5)" onChange={() => {}} />
    </div>
  ),
};
