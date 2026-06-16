// Dropdown component stories

import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Dropdown, DropdownItem, DropdownDivider } from './Dropdown';
import { Button } from '../Button';
import { Checkbox } from '../Checkbox';

const meta = {
  title: 'Common/Dropdown',
  component: Dropdown,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Dropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

// Simple icons for demonstration
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16">
    <path d="M8 4v8M4 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16">
    <path d="M3 4h10M6 4V3h4v1M7 7v4M9 7v4M5 4v9h6V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16">
    <path d="M10 2H4v10h6V2zM12 4v10H6" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </svg>
);

export const Default: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <Dropdown
        trigger={<Button>Actions ▾</Button>}
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
      >
        <DropdownItem onClick={() => { console.log('Edit'); setIsOpen(false); }}>
          Edit
        </DropdownItem>
        <DropdownItem onClick={() => { console.log('Duplicate'); setIsOpen(false); }}>
          Duplicate
        </DropdownItem>
        <DropdownDivider />
        <DropdownItem onClick={() => { console.log('Delete'); setIsOpen(false); }}>
          Delete
        </DropdownItem>
      </Dropdown>
    );
  },
};

export const WithIcons: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <Dropdown
        trigger={<Button>Actions ▾</Button>}
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
      >
        <DropdownItem icon={<PlusIcon />} onClick={() => setIsOpen(false)}>
          Create New
        </DropdownItem>
        <DropdownItem icon={<CopyIcon />} onClick={() => setIsOpen(false)}>
          Duplicate
        </DropdownItem>
        <DropdownDivider />
        <DropdownItem icon={<TrashIcon />} onClick={() => setIsOpen(false)}>
          Delete
        </DropdownItem>
      </Dropdown>
    );
  },
};

export const WithDisabledItems: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <Dropdown
        trigger={<Button>Options ▾</Button>}
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
      >
        <DropdownItem onClick={() => setIsOpen(false)}>Available Option</DropdownItem>
        <DropdownItem disabled>Disabled Option</DropdownItem>
        <DropdownItem onClick={() => setIsOpen(false)}>Another Available</DropdownItem>
      </Dropdown>
    );
  },
};

export const RightAligned: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', width: '300px' }}>
        <Dropdown
          trigger={<Button>Menu ▾</Button>}
          isOpen={isOpen}
          onToggle={() => setIsOpen(!isOpen)}
          position="bottom-right"
          align="end"
        >
          <DropdownItem onClick={() => setIsOpen(false)}>Settings</DropdownItem>
          <DropdownItem onClick={() => setIsOpen(false)}>Profile</DropdownItem>
          <DropdownDivider />
          <DropdownItem onClick={() => setIsOpen(false)}>Logout</DropdownItem>
        </Dropdown>
      </div>
    );
  },
};

export const CollectionFilter: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);
    const [selected, setSelected] = useState(new Set(['1', '2']));

    const toggleSelection = (id: string) => {
      const newSelected = new Set(selected);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      setSelected(newSelected);
    };

    return (
      <Dropdown
        trigger={
          <Button>
            Collections ({selected.size}/3) ▾
          </Button>
        }
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
      >
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 600 }}>Select Collections</span>
          <Button size="sm" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
        <div style={{ padding: '8px' }}>
          <Checkbox
            label="Primary Colors"
            checked={selected.has('1')}
            onChange={() => toggleSelection('1')}
          />
          <Checkbox
            label="Secondary Colors"
            checked={selected.has('2')}
            onChange={() => toggleSelection('2')}
          />
          <Checkbox
            label="Typography"
            checked={selected.has('3')}
            onChange={() => toggleSelection('3')}
          />
        </div>
      </Dropdown>
    );
  },
};

export const TypeFilter: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);
    const [selected, setSelected] = useState(new Set(['COLOR', 'FLOAT']));

    const types = [
      { value: 'COLOR', label: 'Color' },
      { value: 'FLOAT', label: 'Number' },
      { value: 'STRING', label: 'String' },
      { value: 'BOOLEAN', label: 'Boolean' },
    ];

    const toggleType = (type: string) => {
      const newSelected = new Set(selected);
      if (newSelected.has(type)) {
        newSelected.delete(type);
      } else {
        newSelected.add(type);
      }
      setSelected(newSelected);
    };

    return (
      <Dropdown
        trigger={
          <Button>
            Types ({selected.size}/{types.length}) ▾
          </Button>
        }
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
      >
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 600 }}>Select Variable Types</span>
          <Button size="sm" onClick={() => setSelected(selected.size === types.length ? new Set() : new Set(types.map(t => t.value)))}>
            {selected.size === types.length ? 'None' : 'All'}
          </Button>
        </div>
        <div style={{ padding: '8px' }}>
          {types.map(type => (
            <Checkbox
              key={type.value}
              label={type.label}
              checked={selected.has(type.value)}
              onChange={() => toggleType(type.value)}
            />
          ))}
        </div>
      </Dropdown>
    );
  },
};

export const AddMenu: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);

    const variableTypes = [
      { type: 'COLOR', label: 'Color', icon: '🎨' },
      { type: 'FLOAT', label: 'Number', icon: '#' },
      { type: 'STRING', label: 'String', icon: 'Aa' },
      { type: 'BOOLEAN', label: 'Boolean', icon: '✓' },
    ];

    return (
      <Dropdown
        trigger={
          <Button variant="primary">
            <PlusIcon /> Add Variable
          </Button>
        }
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
      >
        {variableTypes.map(({ type, label, icon }) => (
          <DropdownItem
            key={type}
            onClick={() => {
              console.log(`Add ${type} variable`);
              setIsOpen(false);
            }}
          >
            <span style={{ marginRight: '8px' }}>{icon}</span>
            {label}
          </DropdownItem>
        ))}
      </Dropdown>
    );
  },
};
