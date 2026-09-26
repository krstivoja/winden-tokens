import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { GroupNodeComponent } from '../../../../src/ui/components/Relationships/GroupedGraph/GraphNode';
import { buildEmptyCollectionCards } from '../../../../src/ui/components/Relationships/GroupedGraph/utils';
import type {
  GroupData,
  GroupNodeData,
  VariableNode,
} from '../../../../src/ui/components/Relationships/GroupedGraph/types';

const noop = () => {};

const standardCard = (variables: VariableNode[]): GroupData => ({
  key: 'group:brand', title: 'brand', variables,
  x: 0, y: 0, initialX: 0, initialY: 0,
  kind: 'standard', sourceGroupName: 'brand',
  headerFill: '#222', collectionId: 'c1',
});

const redRow: VariableNode = {
  id: 'v1', name: 'brand/red', shortName: 'red', displayName: '#ff0000',
  color: '#ff0000', value: '#ff0000', resolvedValue: '#ff0000',
  isReference: false, referenceName: null,
};

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

describe('GroupNodeComponent — empty collection card', () => {
  const emptyCollectionCard = buildEmptyCollectionCards(
    [{ id: 'c1', name: 'Marco', modes: [{ modeId: 'm1', name: 'Mode 1' }] }],
    [],
    0
  )[0];

  it('renders the collection name as the card title', () => {
    renderCard(emptyCollectionCard);
    expect(screen.getByTitle('Marco')).toHaveTextContent('Marco');
  });

  it('offers the same "+" add-variable affordance as a group card', () => {
    const onAddVariable = vi.fn();
    renderCard(emptyCollectionCard, { onAddVariable });

    fireEvent.click(screen.getByLabelText('Add variable to Marco'));
    expect(onAddVariable).toHaveBeenCalledTimes(1);
    expect(onAddVariable).toHaveBeenCalledWith(emptyCollectionCard);
  });

  it('shows a quiet empty state instead of reading as broken', () => {
    renderCard(emptyCollectionCard);
    expect(screen.getByText('No variables yet')).toBeInTheDocument();
  });

  it('omits group-only actions that cannot work without a group path', () => {
    renderCard(emptyCollectionCard);
    // No actions dropdown and no "level up" — both need a sourceGroupName.
    expect(screen.queryByLabelText('Open actions for Marco')).toBeNull();
    expect(screen.queryByLabelText('Group Marco with its siblings')).toBeNull();
  });

  it('leaves the normal group card untouched', () => {
    renderCard(standardCard([redRow]));
    expect(screen.getByLabelText('Add variable to brand')).toBeInTheDocument();
    expect(screen.getByLabelText('Open actions for brand')).toBeInTheDocument();
    expect(screen.queryByText('No variables yet')).toBeNull();
  });
});
