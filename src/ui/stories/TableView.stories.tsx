import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import { TableView } from '../components/Table/TableView';

function TableCanvas() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TableView />
    </div>
  );
}

const meta = {
  title: 'Views/Table',
  component: TableCanvas,
  tags: ['autodocs'],
} satisfies Meta<typeof TableCanvas>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
