import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { GroupNodeComponent } from '../../../../src/ui/components/Relationships/GroupedGraph/GraphNode';
import { buildCollectionCards } from '../../../../src/ui/components/Relationships/GroupedGraph/utils';
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

const markoRow: VariableNode = {
  id: 'v2', name: 'marko', shortName: 'marko', displayName: '#00ff00',
  color: '#00ff00', value: '#00ff00', resolvedValue: '#00ff00',
  isReference: false, referenceName: null,
};

const collectionCard = (variables: VariableNode[] = []): GroupData =>
  buildCollectionCards(
    [{ id: 'c1', name: 'Marco', modes: [{ modeId: 'm1', name: 'Mode 1' }] }],
    new Map(variables.length ? [['c1', variables]] : []),
    0
  )[0];

describe('GroupNodeComponent — collection root card', () => {
  const emptyCollectionCard = collectionCard();

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

  it('keeps the "+" once the card holds loose variables', () => {
    const onAddVariable = vi.fn();
    renderCard(collectionCard([markoRow]), { onAddVariable });

    expect(screen.getByLabelText('Add variable to Marco')).toBeInTheDocument();
    expect(screen.queryByText('No variables yet')).toBeNull();
  });

  it('gives its rows the ordinary row controls', () => {
    // Rows are ordinary variables addressed by id, so rename (double-click)
    // and delete work here exactly as on a group card — only the header's
    // path-based actions are withheld.
    const onRenameVariable = vi.fn();
    const onDeleteVariable = vi.fn();
    const { container } = renderCard(collectionCard([markoRow]), { onRenameVariable, onDeleteVariable });

    fireEvent.doubleClick(screen.getByTitle('marko (double-click to rename)'));
    expect(onRenameVariable).toHaveBeenCalledWith(markoRow);

    const deleteButton = container.querySelector('button.absolute.right-3\\.5') as HTMLElement;
    expect(deleteButton).toBeTruthy();
    fireEvent.click(deleteButton);
    expect(onDeleteVariable).toHaveBeenCalledWith(markoRow);
  });

  it('still withholds the group-only actions once it holds rows', () => {
    renderCard(collectionCard([markoRow]));
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
