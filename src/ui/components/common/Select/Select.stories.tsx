// Select component stories

import type { Meta, StoryObj } from '@storybook/react';
import { Select } from './Select';

const meta = {
  title: 'Common/Select',
  component: Select,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

const colorOptions = [
  { value: 'red', label: 'Red' },
  { value: 'green', label: 'Green' },
  { value: 'blue', label: 'Blue' },
];

const themeOptions = [
  { value: 'figma', label: 'Follow Figma' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const variableTypeOptions = [
  { value: 'COLOR', label: 'Color' },
  { value: 'FLOAT', label: 'Number' },
  { value: 'STRING', label: 'String' },
  { value: 'BOOLEAN', label: 'Boolean' },
];

export const Default: Story = {
  args: {
    options: colorOptions,
    placeholder: 'Select a color...',
  },
};

export const WithValue: Story = {
  args: {
    options: themeOptions,
    value: 'dark',
    onChange: () => {},
  },
};

export const Disabled: Story = {
  args: {
    options: colorOptions,
    disabled: true,
    value: 'red',
    onChange: () => {},
  },
};

export const WithError: Story = {
  args: {
    options: colorOptions,
    error: 'Please select a color',
    id: 'color-select',
  },
};

export const FullWidth: Story = {
  args: {
    options: themeOptions,
    fullWidth: true,
    placeholder: 'Select theme...',
  },
  parameters: {
    layout: 'padded',
  },
};

export const ThemeSelector: Story = {
  render: () => (
    <div style={{ width: '200px' }}>
      <Select
        options={themeOptions}
        value="figma"
        onChange={() => {}}
      />
    </div>
  ),
};

export const VariableTypeSelector: Story = {
  render: () => (
    <div style={{ width: '250px' }}>
      <Select
        options={variableTypeOptions}
        placeholder="Select variable type..."
      />
    </div>
  ),
};

export const WithDisabledOptions: Story = {
  args: {
    options: [
      { value: '1', label: 'Option 1' },
      { value: '2', label: 'Option 2 (disabled)', disabled: true },
      { value: '3', label: 'Option 3' },
      { value: '4', label: 'Option 4 (disabled)', disabled: true },
    ],
    placeholder: 'Select an option...',
  },
};
