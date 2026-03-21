import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import { RelationshipsView } from '../components/Relationships/RelationshipsView';

const meta = {
  title: 'Views/Relationships',
  component: RelationshipsView,
  tags: ['autodocs'],
  args: {
    variableType: 'COLOR',
  },
} satisfies Meta<typeof RelationshipsView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Colors: Story = {
  args: {
    variableType: 'COLOR',
  },
};

export const Numbers: Story = {
  args: {
    variableType: 'FLOAT',
  },
};
