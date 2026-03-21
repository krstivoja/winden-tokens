// FormGroup component stories

import type { Meta, StoryObj } from '@storybook/react';
import { FormGroup } from './FormGroup';
import { Input } from '../Input';
import { Select } from '../Select';
import { Checkbox } from '../Checkbox';
import { Textarea } from '../Textarea';
import { Button } from '../Button';

const meta = {
  title: 'Common/FormGroup',
  component: FormGroup,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof FormGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithInput: Story = {
  args: {
    label: 'Email Address',
    htmlFor: 'email',
    children: <Input id="email" type="email" placeholder="john@example.com" />,
  },
};

export const Required: Story = {
  args: {
    label: 'Password',
    htmlFor: 'password',
    required: true,
    children: <Input id="password" type="password" placeholder="Enter password" />,
  },
};

export const WithDescription: Story = {
  args: {
    label: 'API Key',
    htmlFor: 'api-key',
    description: 'Your API key will be used to authenticate requests',
    children: <Input id="api-key" placeholder="sk_..." mono />,
  },
};

export const WithError: Story = {
  args: {
    label: 'Username',
    htmlFor: 'username',
    error: 'Username is already taken',
    children: <Input id="username" placeholder="johndoe" />,
  },
};

export const WithSelect: Story = {
  args: {
    label: 'Theme Mode',
    htmlFor: 'theme',
    description: 'Choose your preferred theme',
    children: (
      <Select
        id="theme"
        options={[
          { value: 'figma', label: 'Follow Figma' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
      />
    ),
  },
};

export const WithTextarea: Story = {
  args: {
    label: 'Description',
    htmlFor: 'description',
    children: <Textarea id="description" rows={4} placeholder="Enter description..." />,
  },
};

export const WithCheckbox: Story = {
  args: {
    children: <Checkbox label="I agree to the terms and conditions" />,
  },
};

export const Inline: Story = {
  args: {
    label: 'Shade Count',
    htmlFor: 'shade-count',
    inline: true,
    children: <Input id="shade-count" type="number" min={2} max={20} defaultValue={11} style={{ width: '80px' }} />,
  },
};

export const CompleteForm: Story = {
  render: () => (
    <div style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <FormGroup label="Variable Name" htmlFor="var-name" required>
        <Input id="var-name" placeholder="primary-color" />
      </FormGroup>

      <FormGroup label="Variable Type" htmlFor="var-type" required>
        <Select
          id="var-type"
          options={[
            { value: 'COLOR', label: 'Color' },
            { value: 'FLOAT', label: 'Number' },
            { value: 'STRING', label: 'String' },
            { value: 'BOOLEAN', label: 'Boolean' },
          ]}
          placeholder="Select type..."
        />
      </FormGroup>

      <FormGroup
        label="Variable Value"
        htmlFor="var-value"
        required
        description="Enter a valid color value"
      >
        <Input id="var-value" placeholder="#FF5733" mono />
      </FormGroup>

      <FormGroup label="Description" htmlFor="var-description">
        <Textarea id="var-description" rows={3} placeholder="Optional description" />
      </FormGroup>

      <FormGroup>
        <Checkbox label="Make this variable available in all modes" />
      </FormGroup>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <Button variant="secondary">Cancel</Button>
        <Button variant="primary">Create Variable</Button>
      </div>
    </div>
  ),
};
