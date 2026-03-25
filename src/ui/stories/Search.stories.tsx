// Search component stories

import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Search } from '../components/common/Search';

const meta = {
  title: 'Components/Search',
  component: Search,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Search>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <div className="w-80">
        <Search value={value} onChange={setValue} placeholder="Search..." />
      </div>
    );
  },
};

export const WithCount: Story = {
  render: () => {
    const [value, setValue] = useState('test');
    return (
      <div className="w-80">
        <Search
          value={value}
          onChange={setValue}
          placeholder="Search..."
          count="5/20"
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Search with result count displayed on the right (used in Toolbar).',
      },
    },
  },
};

export const WithAutoFocus: Story = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <div className="w-80">
        <Search
          value={value}
          onChange={setValue}
          placeholder="Search colors..."
          autoFocus
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Search input with autofocus enabled (used in modals).',
      },
    },
  },
};

export const WithEnterHandler: Story = {
  render: () => {
    const [value, setValue] = useState('');
    const [message, setMessage] = useState('');

    return (
      <div className="w-80 flex flex-col gap-4">
        <Search
          value={value}
          onChange={setValue}
          onEnter={() => setMessage(`Selected: ${value}`)}
          placeholder="Type and press Enter..."
        />
        {message && (
          <div className="text-sm text-text-secondary">{message}</div>
        )}
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Search with Enter key handler for quick selection.',
      },
    },
  },
};
