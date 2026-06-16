// GroupedList component stories

import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { GroupedList } from '../components/common/GroupedList';

const meta = {
  title: 'Components/GroupedList',
  component: GroupedList,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof GroupedList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ColorList: Story = {
  render: () => {
    const [selectedId, setSelectedId] = useState('accent-100');

    const sections = [
      {
        title: 'ACCENT',
        items: [
          {
            id: 'accent-50',
            label: '50',
            icon: (
              <div className="w-8 h-8 rounded border border-border overflow-hidden shrink-0">
                <div className="w-full h-full" style={{ background: '#D5E1AE' }} />
              </div>
            ),
            isActive: selectedId === 'accent-50',
          },
          {
            id: 'accent-100',
            label: '100',
            icon: (
              <div className="w-8 h-8 rounded border border-border overflow-hidden shrink-0">
                <div className="w-full h-full" style={{ background: '#8CC047' }} />
              </div>
            ),
            isActive: selectedId === 'accent-100',
          },
          {
            id: 'accent-200',
            label: '200',
            icon: (
              <div className="w-8 h-8 rounded border border-border overflow-hidden shrink-0">
                <div className="w-full h-full" style={{ background: '#4EA902' }} />
              </div>
            ),
            isActive: selectedId === 'accent-200',
          },
        ],
      },
      {
        title: 'ACTION',
        items: [
          {
            id: 'action-500',
            label: '500',
            icon: (
              <div className="w-8 h-8 rounded border border-border overflow-hidden shrink-0">
                <div className="w-full h-full" style={{ background: '#EF1AD4' }} />
              </div>
            ),
            isActive: selectedId === 'action-500',
          },
        ],
      },
    ];

    return (
      <div className="w-96">
        <GroupedList
          sections={sections}
          onItemClick={(item) => setSelectedId(item.id)}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Grouped list with color swatches, matching the ColorReferenceModal design.',
      },
    },
  },
};

export const TextList: Story = {
  render: () => {
    const [selectedId, setSelectedId] = useState('item-2');

    const sections = [
      {
        title: 'SECTION 1',
        items: [
          { id: 'item-1', label: 'Item One', isActive: selectedId === 'item-1' },
          { id: 'item-2', label: 'Item Two', isActive: selectedId === 'item-2' },
          { id: 'item-3', label: 'Item Three', isActive: selectedId === 'item-3' },
        ],
      },
      {
        title: 'SECTION 2',
        items: [
          { id: 'item-4', label: 'Item Four', isActive: selectedId === 'item-4' },
          { id: 'item-5', label: 'Item Five', isActive: selectedId === 'item-5' },
        ],
      },
    ];

    return (
      <div className="w-96">
        <GroupedList
          sections={sections}
          onItemClick={(item) => setSelectedId(item.id)}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Grouped list with text-only items (no icons).',
      },
    },
  },
};

export const SingleSection: Story = {
  render: () => {
    const [selectedId, setSelectedId] = useState('');

    const sections = [
      {
        title: '',
        items: [
          { id: 'item-1', label: 'Ungrouped Item 1', isActive: selectedId === 'item-1' },
          { id: 'item-2', label: 'Ungrouped Item 2', isActive: selectedId === 'item-2' },
          { id: 'item-3', label: 'Ungrouped Item 3', isActive: selectedId === 'item-3' },
        ],
      },
    ];

    return (
      <div className="w-96">
        <GroupedList
          sections={sections}
          onItemClick={(item) => setSelectedId(item.id)}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Single section without header (title is empty string).',
      },
    },
  },
};
