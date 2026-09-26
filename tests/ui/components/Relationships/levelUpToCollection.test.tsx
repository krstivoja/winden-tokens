// Part 3a: the collection is part of the wrapper key space, so "level up"
// has somewhere to go from a top-level card — and the collection itself is
// the root, with nothing above it.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { GroupNodeComponent } from '../../../../src/ui/components/Relationships/GroupedGraph/GraphNode';
import { GroupWrapperComponent } from '../../../../src/ui/components/Relationships/GroupedGraph/GraphWrapperNode';
import type {
  GroupData,
  GroupNodeData,
  VariableNode,
  WrapperNodeData,
} from '../../../../src/ui/components/Relationships/GroupedGraph/types';

const noop = () => {};

const redRow: VariableNode = {
  id: 'v1', name: 'test/red', shortName: 'red', displayName: '#ff0000',
  color: '#ff0000', value: '#ff0000', resolvedValue: '#ff0000',
  isReference: false, referenceName: null,
};

const groupCard = (path: string): GroupData => ({
  key: `group:${path}`, title: path, variables: [redRow],
  x: 0, y: 0, initialX: 0, initialY: 0,
  kind: 'standard', sourceGroupName: path,
  headerFill: '#222', collectionId: 'c1',
  canGroup: true,
});

function renderCard(group: GroupData, overrides: Partial<GroupNodeData> = {}) {
  const data: GroupNodeData = {
    group,
    isColorType: true,
    variableType: 'COLOR',
    connectedVars: new Map(),
    onHighlightPath: noop,
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
  return render(
    <ReactFlowProvider>
      <GroupNodeComponent {...props} />
    </ReactFlowProvider>
  );
}

function renderWrapper(overrides: Partial<WrapperNodeData> = {}) {
  const data: WrapperNodeData = {
    path: 'test',
    collectionId: 'c1',
    title: 'test',
    onLevelUp: noop,
    onUngroup: noop,
    ...overrides,
  };
  const props = { id: 'wrapper', data } as unknown as React.ComponentProps<typeof GroupWrapperComponent>;
  return render(
    <ReactFlowProvider>
      <GroupWrapperComponent {...props} />
    </ReactFlowProvider>
  );
}

describe('level up — card', () => {
  it('offers level-up on a TOP-LEVEL card, which used to have no parent at all', () => {
    const onLevelUp = vi.fn();
    renderCard(groupCard('test'), { onLevelUp });

    fireEvent.click(screen.getByLabelText('Group test with its siblings'));
    // The handler derives the parent: a top-level path yields the EMPTY
    // parent, i.e. the collection's own frame `c1::` — the case that used to
    // return early and leave the button off the card entirely.
    expect(onLevelUp).toHaveBeenCalledWith('c1', 'test');
  });

  it('passes the collection alongside a nested path', () => {
    const onLevelUp = vi.fn();
    renderCard(groupCard('test/test2'), { onLevelUp });

    fireEvent.click(screen.getByLabelText('Group test/test2 with its siblings'));
    expect(onLevelUp).toHaveBeenCalledWith('c1', 'test/test2');
  });
});

describe('level up — wrapper frame', () => {
  it('offers level-up on a top-level path frame', () => {
    const onLevelUp = vi.fn();
    renderWrapper({ onLevelUp });

    fireEvent.click(screen.getByLabelText('Group test with its siblings'));
    expect(onLevelUp).toHaveBeenCalledWith('c1', 'test');
  });

  it('withholds level-up from a collection frame — nothing is above it', () => {
    renderWrapper({ path: '', title: 'Marco' });
    expect(screen.queryByLabelText('Group Marco with its siblings')).toBeNull();
    // Ungroup still works: it dissolves the collection frame.
    expect(screen.getByLabelText('Ungroup Marco')).toBeTruthy();
  });

  it('ungroups by collection and path', () => {
    const onUngroup = vi.fn();
    renderWrapper({ path: '', title: 'Marco', onUngroup });

    fireEvent.click(screen.getByLabelText('Ungroup Marco'));
    expect(onUngroup).toHaveBeenCalledWith('c1', '');
  });
});
