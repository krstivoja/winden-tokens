// Collections "Select All" fires onSelectAllCollections (the graph turns
// "Hide unused" off there); "Deselect All" never does, and a sidebar without
// the callback (Table view) keeps its plain toggles.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CollectionData, VariableData } from '../../../../src/ui/types';
import { SidebarFilter } from '../../../../src/ui/components/Table/SidebarFilter';

const collections: CollectionData[] = [
  { id: 'c1', name: 'Theme', modes: [{ modeId: 'm1', name: 'Default' }] },
  { id: 'c2', name: 'Primitives', modes: [{ modeId: 'm2', name: 'Default' }] },
];

// Group keys of the two variables below (`<collectionId>::<group>`).
const ALL_GROUPS = new Set(['c1::color', 'c2::space']);

const variables: VariableData[] = [
  { id: 'v1', collectionId: 'c1', name: 'color/brand', resolvedType: 'COLOR', value: '#ff0000', valuesByMode: { m1: '#ff0000' } },
  { id: 'v2', collectionId: 'c2', name: 'space/1', resolvedType: 'FLOAT', value: '4', valuesByMode: { m2: '4' } },
];

vi.mock('../../../../src/ui/context/AppContext', () => ({
  useAppContext: () => ({ collections, variables }),
}));

vi.mock('../../../../src/ui/components/Modals/ModalContext', () => ({
  useModalContext: () => ({ openInputModal: vi.fn() }),
}));

vi.mock('../../../../src/ui/hooks/usePluginMessages', () => ({
  post: vi.fn(),
}));

function renderSidebar(
  selectedCollections: Set<string>,
  props: Partial<React.ComponentProps<typeof SidebarFilter>> = {}
) {
  const onCollectionToggle = vi.fn();
  render(
    <SidebarFilter
      selectedModeId="m1"
      onModeChange={() => {}}
      selectedCollections={selectedCollections}
      onCollectionToggle={onCollectionToggle}
      selectedGroups={ALL_GROUPS}
      onGroupToggle={() => {}}
      {...props}
    />
  );
  return { onCollectionToggle };
}

describe('SidebarFilter Select All', () => {
  it('calls onSelectAllCollections after toggling the unselected collections on', () => {
    const onSelectAllCollections = vi.fn();
    const { onCollectionToggle } = renderSidebar(new Set(['c1']), { onSelectAllCollections });
    fireEvent.click(screen.getByText('Select All'));
    expect(onCollectionToggle.mock.calls).toEqual([['c2']]);
    expect(onSelectAllCollections).toHaveBeenCalledTimes(1);
  });

  it('does not call it from Deselect All', () => {
    const onSelectAllCollections = vi.fn();
    const { onCollectionToggle } = renderSidebar(new Set(['c1', 'c2']), { onSelectAllCollections });
    fireEvent.click(screen.getByText('Deselect All'));
    expect(onCollectionToggle.mock.calls).toEqual([['c1'], ['c2']]);
    expect(onSelectAllCollections).toHaveBeenCalledTimes(0);
  });

  it('keeps working without the callback', () => {
    const { onCollectionToggle } = renderSidebar(new Set());
    fireEvent.click(screen.getByText('Select All'));
    expect(onCollectionToggle.mock.calls).toEqual([['c1'], ['c2']]);
  });

  it('reads Select All while a group is unticked under ticked collections', () => {
    const onSelectAllCollections = vi.fn();
    const onGroupToggle = vi.fn();
    const { onCollectionToggle } = renderSidebar(new Set(['c1', 'c2']), {
      selectedGroups: new Set(['c1::color']),
      onGroupToggle,
      onSelectAllCollections,
    });
    fireEvent.click(screen.getByText('Select All'));
    expect(onCollectionToggle).not.toHaveBeenCalled();
    expect(onGroupToggle.mock.calls).toEqual([['c2::space']]);
    expect(onSelectAllCollections).toHaveBeenCalledTimes(1);
  });
});
