// Card menu "Hide unused": sits just above Delete, calls onHideUnused with the
// card's group, and reads "Show all" while hiding is active.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { GroupNodeComponent } from '../../../../src/ui/components/Relationships/GroupedGraph/GraphNode';
import type { GroupData, GroupNodeData } from '../../../../src/ui/components/Relationships/GroupedGraph/types';

const noop = () => {};

const group: GroupData = {
  key: 'group:c1::color/brand', title: 'color/brand',
  variables: [{
    id: 'v1', name: 'color/brand/50', shortName: '50', displayName: '#ff0000',
    color: '#ff0000', value: '#ff0000', resolvedValue: '#ff0000',
    isReference: false, referenceName: null,
  }],
  x: 0, y: 0, initialX: 0, initialY: 0,
  kind: 'standard', sourceGroupName: 'color/brand',
  headerFill: '#222', collectionId: 'c1',
  canGroup: true,
};

function renderCard(overrides: Partial<GroupNodeData> = {}) {
  const data: GroupNodeData = {
    group,
    isColorType: true,
    variableType: 'COLOR',
    connectedVars: new Map(),
    onHighlightPath: noop,
    onHideUnused: noop,
    onHighlightVariable: noop,
    onGeneratorOpen: noop,
    onShowColorMenu: noop,
    onAddVariable: noop,
    onRenameGroup: noop,
    onDuplicateGroup: noop,
    onEditAsText: noop,
    onLevelUp: noop,
    onDeleteGroup: noop,
    onRenameVariable: noop,
    onDeleteVariable: noop,
    onDisconnect: noop,
    ...overrides,
  };
  const props = { id: group.key, data } as unknown as React.ComponentProps<typeof GroupNodeComponent>;
  render(
    <ReactFlowProvider>
      <GroupNodeComponent {...props} />
    </ReactFlowProvider>
  );
  fireEvent.click(screen.getByLabelText(`Open actions for ${group.title}`));
}

describe('card menu Hide unused', () => {
  it('sits directly above Delete and calls onHideUnused with the group', () => {
    const onHideUnused = vi.fn();
    renderCard({ onHideUnused });
    const item = screen.getByText('Hide unused');
    const labels = screen.getAllByText(/^(Hide unused|Delete)$/).map(el => el.textContent);
    expect(labels).toEqual(['Hide unused', 'Delete']);
    fireEvent.click(item);
    expect(onHideUnused).toHaveBeenCalledWith(group);
  });

  it('reads "Show all" while hiding is active', () => {
    renderCard({ isHidingUnused: true });
    expect(screen.queryByText('Hide unused')).toBe(null);
    expect(screen.getByText('Show all')).toBeTruthy();
  });
});
