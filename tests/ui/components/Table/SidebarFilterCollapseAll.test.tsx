// Sidebar "Collapse all" / "Expand all" button next to the search box (like
// Figma's Layers panel): folds every collection and folder at once, unfolds
// them again, and only changes what is shown (no marks, no selection).

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CollectionData, VariableData } from '../../../../src/ui/types';
import { SidebarFilter } from '../../../../src/ui/components/Table/SidebarFilter';

const collections: CollectionData[] = [
  { id: 'c1', name: 'Theme', modes: [{ modeId: 'm1', name: 'Default' }] },
  { id: 'c2', name: 'Primitives', modes: [{ modeId: 'm2', name: 'Default' }] },
];

// Theme: group `color` with subgroup `color/text`, and folder `shadow` (not a
// group itself) above group `shadow/inner`. Primitives: group `space`.
const variables: VariableData[] = [
  { id: 'v1', collectionId: 'c1', name: 'color/brand', resolvedType: 'COLOR', value: '#ff0000', valuesByMode: { m1: '#ff0000' } },
  { id: 'v2', collectionId: 'c1', name: 'color/text/primary', resolvedType: 'COLOR', value: '#000000', valuesByMode: { m1: '#000000' } },
  { id: 'v3', collectionId: 'c1', name: 'shadow/inner/sm', resolvedType: 'FLOAT', value: '1', valuesByMode: { m1: '1' } },
  { id: 'v4', collectionId: 'c2', name: 'space/1', resolvedType: 'FLOAT', value: '4', valuesByMode: { m2: '4' } },
];

const ALL_GROUPS = new Set(['c1::color', 'c1::color/text', 'c1::shadow/inner', 'c2::space']);

vi.mock('../../../../src/ui/context/AppContext', () => ({
  useAppContext: () => {
    const [sidebarMarks, setSidebarMarks] = React.useState<ReadonlySet<string>>(new Set());
    return { collections, variables, reorderCollections: vi.fn(), sidebarMarks, setSidebarMarks };
  },
}));

vi.mock('../../../../src/ui/components/Modals/ModalContext', () => ({
  useModalContext: () => ({ openInputModal: vi.fn() }),
}));

vi.mock('../../../../src/ui/hooks/usePluginMessages', () => ({
  post: vi.fn(),
}));

// Holds the selection like TableView / GroupedGraph do, so rings follow it.
function StatefulSidebar({ onSelectionChange }: { onSelectionChange: (next: { collections: Set<string>; groups: Set<string> }) => void }) {
  const [selection, setSelection] = React.useState({ collections: new Set(['c1', 'c2']), groups: ALL_GROUPS });
  return (
    <SidebarFilter
      selectedModeId="m1"
      onModeChange={() => {}}
      selectedCollections={selection.collections}
      selectedGroups={selection.groups}
      onSelectionChange={next => {
        onSelectionChange(next);
        setSelection(next);
      }}
      showTypeFilters={false}
    />
  );
}

function renderSidebar() {
  const onSelectionChange = vi.fn();
  render(<StatefulSidebar onSelectionChange={onSelectionChange} />);
  return { onSelectionChange };
}

const queryRow = (text: string) =>
  (screen.queryByText(text, { selector: 'span' })?.closest('[role="treeitem"]') ?? null) as HTMLElement | null;
const rowOf = (text: string) => queryRow(text) as HTMLElement;
const toggleAll = () =>
  (screen.queryByLabelText('Collapse all') ?? screen.getByLabelText('Expand all')) as HTMLButtonElement;
const search = () => screen.getByPlaceholderText('Search collections & groups...');

// Every collection and folder row that has a chevron.
const FOLDABLE = ['Theme', 'Primitives', 'color', 'shadow'];
const NESTED = ['text', 'inner', 'space'];

describe('SidebarFilter collapse / expand all', () => {
  it('starts open and Collapse all folds collections and nested folders; All variables stays open', () => {
    renderSidebar();
    for (const text of FOLDABLE) expect(rowOf(text).getAttribute('aria-expanded')).toBe('true');
    for (const text of NESTED) expect(queryRow(text)).not.toBe(null);

    fireEvent.click(screen.getByLabelText('Collapse all'));

    for (const text of NESTED) expect(queryRow(text)).toBe(null);
    for (const text of ['Theme', 'Primitives']) expect(rowOf(text).getAttribute('aria-expanded')).toBe('false');
    expect(rowOf('All variables').getAttribute('aria-expanded')).toBe('true');

    // Opening one collection by hand shows its folders folded too, including
    // `shadow`, which is a folder but not a group.
    fireEvent.click(screen.getByLabelText('Expand Theme'));
    expect(rowOf('color').getAttribute('aria-expanded')).toBe('false');
    expect(rowOf('shadow').getAttribute('aria-expanded')).toBe('false');
    expect(queryRow('text')).toBe(null);
    expect(queryRow('inner')).toBe(null);
  });

  it('a second click opens everything again', () => {
    renderSidebar();
    fireEvent.click(screen.getByLabelText('Collapse all'));
    fireEvent.click(screen.getByLabelText('Expand all'));
    for (const text of FOLDABLE) expect(rowOf(text).getAttribute('aria-expanded')).toBe('true');
    for (const text of NESTED) expect(queryRow(text)).not.toBe(null);
  });

  it('icon and label flip with the state', () => {
    renderSidebar();
    const before = toggleAll();
    expect(before.getAttribute('aria-label')).toBe('Collapse all');
    expect(before.getAttribute('title')).toBe('Collapse all');
    const collapseIcon = before.innerHTML;

    fireEvent.click(before);
    const after = toggleAll();
    expect(after.getAttribute('aria-label')).toBe('Expand all');
    expect(after.getAttribute('title')).toBe('Expand all');
    expect(after.innerHTML).not.toBe(collapseIcon);

    // Anything open again (one collection by hand) flips it back.
    fireEvent.click(screen.getByLabelText('Expand Primitives'));
    expect(toggleAll().getAttribute('aria-label')).toBe('Collapse all');
  });

  it('counts a single open folder as open', () => {
    renderSidebar();
    fireEvent.click(screen.getByLabelText('Collapse all'));
    fireEvent.click(screen.getByLabelText('Expand Theme'));
    fireEvent.click(screen.getByLabelText('Collapse Theme'));
    expect(toggleAll().getAttribute('aria-label')).toBe('Expand all');
    fireEvent.click(screen.getByLabelText('Expand Theme'));
    fireEvent.click(screen.getByLabelText('Expand color'));
    fireEvent.click(screen.getByLabelText('Collapse Theme'));
    // Theme is folded again, but `color` inside it is still open.
    expect(toggleAll().getAttribute('aria-label')).toBe('Collapse all');
  });

  it('is disabled while searching', () => {
    renderSidebar();
    expect(toggleAll().disabled).toBe(false);
    fireEvent.change(search(), { target: { value: 'color' } });
    expect(toggleAll().disabled).toBe(true);
    fireEvent.click(toggleAll());
    fireEvent.change(search(), { target: { value: '' } });
    // The click while disabled did nothing.
    expect(toggleAll().disabled).toBe(false);
    for (const text of FOLDABLE) expect(rowOf(text).getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps marks and selection through a fold and unfold', () => {
    const { onSelectionChange } = renderSidebar();
    fireEvent.click(rowOf('text'));
    const calls = onSelectionChange.mock.calls.length;
    expect(rowOf('text').getAttribute('aria-selected')).toBe('true');
    expect(rowOf('text').className).toContain('ring-primary');

    fireEvent.click(screen.getByLabelText('Collapse all'));
    fireEvent.click(screen.getByLabelText('Expand all'));

    expect(onSelectionChange.mock.calls.length).toBe(calls);
    expect(rowOf('text').getAttribute('aria-selected')).toBe('true');
    expect(rowOf('text').className).toContain('ring-primary');
  });

  it('a folder folded by hand is open after Collapse all then Expand all', () => {
    renderSidebar();
    fireEvent.click(screen.getByLabelText('Collapse color'));
    expect(queryRow('text')).toBe(null);
    fireEvent.click(screen.getByLabelText('Collapse all'));
    fireEvent.click(screen.getByLabelText('Expand all'));
    expect(rowOf('color').getAttribute('aria-expanded')).toBe('true');
    expect(queryRow('text')).not.toBe(null);
  });
});
