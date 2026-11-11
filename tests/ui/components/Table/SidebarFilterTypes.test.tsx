// Types filter dropdown (its checkboxes stay) and the "All variables" root row of the sidebar.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CollectionData, VariableData } from '../../../../src/ui/types';
import { SidebarFilter } from '../../../../src/ui/components/Table/SidebarFilter';

const collections: CollectionData[] = [
  { id: 'c1', name: 'Theme', modes: [{ modeId: 'm1', name: 'Default' }] },
  { id: 'c2', name: 'Primitives', modes: [{ modeId: 'm2', name: 'Default' }] },
];
const variables: VariableData[] = [
  { id: 'v1', collectionId: 'c1', name: 'color/brand', resolvedType: 'COLOR', value: '#f00', valuesByMode: { m1: '#f00' } },
  { id: 'v2', collectionId: 'c2', name: 'space/1', resolvedType: 'FLOAT', value: '4', valuesByMode: { m2: '4' } },
  { id: 'v3', collectionId: 'c2', name: 'space/2', resolvedType: 'FLOAT', value: '8', valuesByMode: { m2: '8' } },
];

vi.mock('../../../../src/ui/context/AppContext', () => ({
  useAppContext: () => {
    const [sidebarMarks, setSidebarMarks] = React.useState<ReadonlySet<string>>(new Set());
    return { collections, variables, sidebarMarks, setSidebarMarks };
  },
}));
vi.mock('../../../../src/ui/components/Modals/ModalContext', () => ({
  useModalContext: () => ({ openInputModal: vi.fn() }),
}));
vi.mock('../../../../src/ui/hooks/usePluginMessages', () => ({ post: vi.fn() }));

function renderSidebar(props: Partial<React.ComponentProps<typeof SidebarFilter>> = {}) {
  const onSelectionChange = vi.fn();
  const onTypeToggle = vi.fn();
  const utils = render(
    <SidebarFilter
      selectedModeId="m1"
      onModeChange={() => {}}
      selectedTypes={new Set(['COLOR', 'FLOAT'])}
      onTypeToggle={onTypeToggle}
      selectedCollections={new Set(['c1', 'c2'])}
      selectedGroups={new Set(['c1::color', 'c2::space'])}
      onSelectionChange={onSelectionChange}
      {...props}
    />
  );
  return { onSelectionChange, onTypeToggle, ...utils };
}

const openFilter = () => fireEvent.click(screen.getByLabelText('Filter by type'));
const root = () => screen.getByText('All variables').closest('[role="treeitem"]') as HTMLElement;

describe('SidebarFilter types dropdown', () => {
  it('no longer renders the Types block or the bulk text button', () => {
    renderSidebar();
    expect(screen.queryByText('Types')).toBe(null);
    expect(screen.queryByText('COLOR')).toBe(null);
    expect(screen.queryByText('Select All')).toBe(null);
    expect(screen.queryByText('Deselect All')).toBe(null);
  });

  it('opens from the filter button and toggling a type calls onTypeToggle', () => {
    const { onTypeToggle } = renderSidebar();
    openFilter();
    expect(screen.getByText('Types')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('FLOAT'));
    expect(onTypeToggle.mock.calls).toEqual([['FLOAT']]);
  });

  it('shows the active indicator only when a type is unticked', () => {
    const { unmount } = renderSidebar();
    expect(screen.queryByTestId('options-dropdown-indicator')).toBe(null);
    unmount();
    renderSidebar({ selectedTypes: new Set(['COLOR']) });
    expect(screen.getByTestId('options-dropdown-indicator')).toBeTruthy();
  });

  it('hides the trigger without type props or with showTypeFilters off', () => {
    const { unmount } = renderSidebar({ showTypeFilters: false });
    expect(screen.queryByLabelText('Filter by type')).toBe(null);
    unmount();
    renderSidebar({ selectedTypes: undefined, onTypeToggle: undefined });
    expect(screen.queryByLabelText('Filter by type')).toBe(null);
  });

  it('closes on outside click and Escape', () => {
    renderSidebar();
    openFilter();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Types')).toBe(null);
    openFilter();
    expect(screen.getByText('Types')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Types')).toBe(null);
  });

  it('keeps the menu inside the sidebar (right aligned)', () => {
    renderSidebar();
    openFilter();
    const menu = screen.getByText('Types').parentElement!;
    expect(menu.className).toContain('right-0');
  });
});

describe('SidebarFilter All variables root row', () => {
  it('shows the total count with the collections nested below it', () => {
    renderSidebar();
    const rootRow = screen.getByText('All variables').parentElement!;
    expect(rootRow.textContent).toContain('3');
    expect(screen.getByText('Theme', { selector: 'span' })).toBeTruthy();
    expect(screen.getByText('Primitives', { selector: 'span' })).toBeTruthy();
  });

  it('is selected only while everything is selected', () => {
    const { unmount } = renderSidebar();
    expect(root().getAttribute('aria-selected')).toBe('true');
    unmount();

    const partial = renderSidebar({ selectedCollections: new Set(['c1']) });
    expect(root().getAttribute('aria-selected')).toBe('false');
    partial.unmount();

    renderSidebar({ selectedCollections: new Set() });
    expect(root().getAttribute('aria-selected')).toBe('false');
  });

  it('has no checkbox and a click selects everything, firing onSelectAllCollections', () => {
    const onSelectAllCollections = vi.fn();
    const { onSelectionChange } = renderSidebar({
      selectedCollections: new Set(['c1']),
      onSelectAllCollections,
    });
    expect(root().querySelector('input')).toBe(null);
    fireEvent.click(root());
    const next = onSelectionChange.mock.calls[0][0];
    expect(Array.from(next.collections)).toEqual(['c1', 'c2']);
    expect(Array.from(next.groups)).toEqual(['c1::color', 'c2::space']);
    expect(onSelectAllCollections).toHaveBeenCalledTimes(1);
  });

  it('collapsing the root hides the collection rows; searching forces it open', () => {
    renderSidebar();
    fireEvent.click(screen.getByLabelText('Collapse all variables'));
    expect(screen.queryByText('Theme', { selector: 'span' })).toBe(null);
    expect(screen.getByText('All variables')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Search collections & groups...'), {
      target: { value: 'prim' },
    });
    expect(screen.getByText('All variables')).toBeTruthy();
    expect(screen.getByText('Primitives', { selector: 'span' })).toBeTruthy();
    expect(screen.queryByText('Theme', { selector: 'span' })).toBe(null);
  });
});
