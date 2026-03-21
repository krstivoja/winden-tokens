import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import {
  ChevronDownIcon,
  CloseIcon,
  CollapseIcon,
  CopyIcon,
  EditIcon,
  ExpandIcon,
  FolderIcon,
  PlusIcon,
  RedoIcon,
  RefreshIcon,
  RelationshipsIcon,
  SearchIcon,
  ShadesIcon,
  StepsIcon,
  TrashIcon,
  TypeIcons,
  UndoIcon,
  type VariableType,
} from '../components/Icons';

const actionIcons = [
  { name: 'PlusIcon', Component: PlusIcon },
  { name: 'CloseIcon', Component: CloseIcon },
  { name: 'RefreshIcon', Component: RefreshIcon },
  { name: 'UndoIcon', Component: UndoIcon },
  { name: 'RedoIcon', Component: RedoIcon },
  { name: 'ExpandIcon', Component: ExpandIcon },
  { name: 'CollapseIcon', Component: CollapseIcon },
  { name: 'ChevronDownIcon', Component: ChevronDownIcon },
  { name: 'ShadesIcon', Component: ShadesIcon },
  { name: 'StepsIcon', Component: StepsIcon },
  { name: 'CopyIcon', Component: CopyIcon },
  { name: 'TrashIcon', Component: TrashIcon },
  { name: 'SearchIcon', Component: SearchIcon },
  { name: 'EditIcon', Component: EditIcon },
  { name: 'FolderIcon', Component: FolderIcon },
  { name: 'RelationshipsIcon', Component: RelationshipsIcon },
];

const variableTypes: VariableType[] = ['COLOR', 'FLOAT', 'STRING', 'BOOLEAN'];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h3 style={{ fontSize: 14, marginBottom: 12 }}>{title}</h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 12,
        }}
      >
        {children}
      </div>
    </section>
  );
}

function IconTile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 16,
        background: 'var(--bg-alt)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text)',
        }}
      >
        {children}
      </div>
      <code style={{ fontSize: 11, color: 'var(--text-dim)' }}>{label}</code>
    </div>
  );
}

function IconGallery() {
  return (
    <div style={{ padding: 24 }}>
      <Section title="Variable Type Icons">
        {variableTypes.map(type => (
          <IconTile key={type} label={type}>
            {TypeIcons[type]}
          </IconTile>
        ))}
      </Section>

      <Section title="Action Icons">
        {actionIcons.map(({ name, Component }) => (
          <IconTile key={name} label={name}>
            <Component />
          </IconTile>
        ))}
      </Section>
    </div>
  );
}

const meta = {
  title: 'Foundation/Icons',
  component: IconGallery,
  tags: ['autodocs'],
} satisfies Meta<typeof IconGallery>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Gallery: Story = {};
