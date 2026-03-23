import type { Meta, StoryObj } from '@storybook/react-vite';
import { TabBar, type TabId } from '../components/Tabs/TabBar';
import { useState } from 'react';

const meta = {
  title: 'Components/TabBar',
  component: TabBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof TabBar>;

export default meta;
type Story = StoryObj<typeof meta>;

// Interactive wrapper for tabs
function InteractiveTabBar(props: React.ComponentProps<typeof TabBar>) {
  const [activeTab, setActiveTab] = useState<TabId>(props.activeTab);

  return (
    <TabBar
      {...props}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    />
  );
}

export const Default: Story = {
  render: () => (
    <InteractiveTabBar
      activeTab="table"
      onTabChange={() => {}}
      canUndo={true}
      canRedo={true}
    />
  ),
};

export const TableTabActive: Story = {
  render: () => (
    <InteractiveTabBar
      activeTab="table"
      onTabChange={() => {}}
      canUndo={true}
      canRedo={true}
    />
  ),
};

export const NodeColorsTabActive: Story = {
  render: () => (
    <InteractiveTabBar
      activeTab="node-colors"
      onTabChange={() => {}}
      canUndo={true}
      canRedo={true}
    />
  ),
};

export const JSONTabActive: Story = {
  render: () => (
    <InteractiveTabBar
      activeTab="json"
      onTabChange={() => {}}
      canUndo={true}
      canRedo={true}
    />
  ),
};

export const SettingsTabActive: Story = {
  render: () => (
    <InteractiveTabBar
      activeTab="settings"
      onTabChange={() => {}}
      canUndo={true}
      canRedo={true}
    />
  ),
};

export const WithUndoDisabled: Story = {
  render: () => (
    <InteractiveTabBar
      activeTab="table"
      onTabChange={() => {}}
      canUndo={false}
      canRedo={true}
    />
  ),
};

export const WithRedoDisabled: Story = {
  render: () => (
    <InteractiveTabBar
      activeTab="table"
      onTabChange={() => {}}
      canUndo={true}
      canRedo={false}
    />
  ),
};

export const WithBothUndoRedoDisabled: Story = {
  render: () => (
    <InteractiveTabBar
      activeTab="table"
      onTabChange={() => {}}
      canUndo={false}
      canRedo={false}
    />
  ),
};
