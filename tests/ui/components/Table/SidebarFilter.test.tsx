// The Collections tree is click-to-select (no checkboxes): a plain click
// selects only that row and its subgroups, Cmd/Ctrl-click toggles it, and
// "All variables" selects everything (and fires onSelectAllCollections).
// A plain click also asks the graph to focus the row through onFocusPath.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CollectionData, VariableData } from '../../../../src/ui/types';
import { SidebarFilter } from '../../../../src/ui/components/Table/SidebarFilter';

const collections: CollectionData[] = [
  { id: 'c1', name: 'Theme', modes: [{ modeId: 'm1', name: 'Default' }] },
  { id: 'c2', name: 'Primitives', modes: [{ modeId: 'm2', name: 'Default' }] },
];

const ALL_GROUPS = new Set(['c1::color', 'c2::space']);

const variables: VariableData[] = [
  { id: 'v1', collectionId: 'c1', name: 'color/brand', resolvedType: 'COLOR', value: '#ff0000', valuesByMode: { m1: '#ff0000' } },
  { id: 'v2', collectionId: 'c2', name: 'space/1', resolvedType: 'FLOAT', value: '4', valuesByMode: { m2: '4' } },
];

// Swapped per describe block; the mock reads them at render time.
let currentCollections = collections;
let currentVariables = variables;

vi.mock('../../../../src/ui/context/AppContext', () => ({
  useAppContext: () => ({ collections: currentCollections, variables: currentVariables, reorderCollections: vi.fn() }),
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
  const onSelectionChange = vi.fn();
  render(
    <SidebarFilter
      selectedModeId="m1"
      onModeChange={() => {}}
      selectedCollections={selectedCollections}
      selectedGroups={ALL_GROUPS}
      onSelectionChange={onSelectionChange}
      {...props}
    />
  );
  return { onSelectionChange };
}

// Tree row of a label ('color' etc. are unique: the type filter only lists
// COLOR / FLOAT in upper case).
const label = (text: string) => screen.getByText(text, { selector: 'span' });
const rowOf = (text: string) => label(text).closest('[role="treeitem"]') as HTMLElement;
const lastCall = (fn: ReturnType<typeof vi.fn>) => {
  const next = fn.mock.calls[fn.mock.calls.length - 1][0];
  return { collections: Array.from(next.collections).sort(), groups: Array.from(next.groups).sort() };
};

describe('SidebarFilter tree has no checkboxes', () => {
  it('renders every row as a selectable treeitem and no checkbox in the tree', () => {
    renderSidebar(new Set(['c1', 'c2']));
    const tree = screen.getByRole('tree');
    expect(tree.querySelectorAll('input[type="checkbox"]').length).toBe(0);
    expect(screen.getAllByRole('treeitem').length).toBeGreaterThanOrEqual(5);
    expect(rowOf('Theme').getAttribute('tabindex')).toBe('0');
  });
});

describe('SidebarFilter All variables row', () => {
  it('selects everything and fires onSelectAllCollections once', () => {
    const onSelectAllCollections = vi.fn();
    const { onSelectionChange } = renderSidebar(new Set(['c1']), {
      selectedGroups: new Set(['c1::color']),
      onSelectAllCollections,
    });
    fireEvent.click(rowOf('All variables'));
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(lastCall(onSelectionChange)).toEqual({
      collections: ['c1', 'c2'],
      groups: ['c1::color', 'c2::space'],
    });
    expect(onSelectAllCollections).toHaveBeenCalledTimes(1);
  });

  it('Cmd-click behaves like a plain click and it works without the callback', () => {
    const { onSelectionChange } = renderSidebar(new Set(['c1']), { selectedGroups: new Set(['c1::color']) });
    fireEvent.click(rowOf('All variables'), { metaKey: true });
    expect(lastCall(onSelectionChange).collections).toEqual(['c1', 'c2']);
  });

  it('is the only selected row while everything is selected', () => {
    renderSidebar(new Set(['c1', 'c2']));
    expect(rowOf('All variables').getAttribute('aria-selected')).toBe('true');
    expect(rowOf('All variables').className).toContain('bg-primary/10');
    for (const text of ['Theme', 'Primitives', 'color', 'space']) {
      expect(rowOf(text).getAttribute('aria-selected')).toBe('false');
      expect(rowOf(text).className).not.toContain('ring-primary');
    }
  });
});

describe('SidebarFilter row selection', () => {
  afterEach(() => {
    currentVariables = variables;
  });

  it('plain click on a collection hides nothing: it clears filters, rings the row and focuses it', () => {
    const onFocusPath = vi.fn();
    const onSelectAllCollections = vi.fn();
    const { onSelectionChange } = renderSidebar(new Set(['c1', 'c2']), {
      selectedGroups: new Set(['c1::color']),
      onFocusPath,
      onSelectAllCollections,
    });
    fireEvent.click(rowOf('Primitives'));
    expect(lastCall(onSelectionChange)).toEqual({
      collections: ['c1', 'c2'],
      groups: ['c1::color', 'c2::space'],
    });
    expect(onFocusPath.mock.calls).toEqual([['c2', '']]);
    expect(onSelectAllCollections).toHaveBeenCalledTimes(1);
    expect(rowOf('Primitives').getAttribute('aria-selected')).toBe('true');
    expect(rowOf('Primitives').className).toContain('ring-primary');
    expect(rowOf('Theme').getAttribute('aria-selected')).toBe('false');
    // Clicking another collection moves the mark.
    fireEvent.click(rowOf('Theme'));
    expect(rowOf('Theme').getAttribute('aria-selected')).toBe('true');
    expect(rowOf('Primitives').getAttribute('aria-selected')).toBe('false');
  });

  it('Cmd-click on a collection toggles only its mark: no selection write, no focus', () => {
    const onFocusPath = vi.fn();
    const { onSelectionChange } = renderSidebar(new Set(['c1', 'c2']), { onFocusPath });
    fireEvent.click(rowOf('Theme'), { metaKey: true });
    fireEvent.click(rowOf('Primitives'), { ctrlKey: true });
    expect(rowOf('Theme').getAttribute('aria-selected')).toBe('true');
    expect(rowOf('Primitives').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(rowOf('Theme'), { metaKey: true });
    expect(rowOf('Theme').getAttribute('aria-selected')).toBe('false');
    // The last mark stays while nothing is narrowed.
    fireEvent.click(rowOf('Primitives'), { metaKey: true });
    expect(rowOf('Primitives').getAttribute('aria-selected')).toBe('true');
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(onFocusPath).not.toHaveBeenCalled();
  });

  it('a plain click on a group or All variables clears the collection marks', () => {
    renderSidebar(new Set(['c1', 'c2']));
    fireEvent.click(rowOf('Theme'));
    expect(rowOf('Theme').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(rowOf('space'));
    expect(rowOf('Theme').getAttribute('aria-selected')).toBe('false');
    fireEvent.click(rowOf('Theme'));
    fireEvent.click(rowOf('All variables'));
    expect(rowOf('Theme').getAttribute('aria-selected')).toBe('false');
  });

  it('plain click on a group keeps every collection selected (others stay unfiltered)', () => {
    const { onSelectionChange } = renderSidebar(new Set(['c1', 'c2']));
    fireEvent.click(rowOf('color'));
    // c2 keeps all its groups; the clicked group is the only c1 key. With two
    // collections of one group each that is "everything", so use a second group below.
    expect(lastCall(onSelectionChange)).toEqual({ collections: ['c1', 'c2'], groups: ['c1::color', 'c2::space'] });
  });

  it('highlights the clicked group with a ring, not the other (merely visible) collections', () => {
    currentVariables = [
      ...variables,
      { id: 'v3', collectionId: 'c1', name: 'size/sm', resolvedType: 'FLOAT', value: '1', valuesByMode: { m1: '1' } },
    ];
    renderSidebar(new Set(['c1', 'c2']), { selectedGroups: new Set(['c1::color', 'c2::space']) });
    expect(rowOf('color').className).toContain('ring-primary');
    expect(rowOf('color').getAttribute('aria-selected')).toBe('true');
    expect(rowOf('size').className).not.toContain('bg-primary/10');
    for (const text of ['Theme', 'Primitives', 'space', 'All variables']) {
      expect(rowOf(text).getAttribute('aria-selected')).toBe('false');
      expect(rowOf(text).className).not.toContain('ring-primary');
    }
  });

  it('marks the single selected row and clears the root', () => {
    renderSidebar(new Set(['c2']), { selectedGroups: new Set(['c2::space']) });
    expect(rowOf('Primitives').getAttribute('aria-selected')).toBe('true');
    expect(rowOf('Primitives').className).toContain('bg-primary/10');
    expect(rowOf('Primitives').className).toContain('ring-primary');
    expect(rowOf('space').getAttribute('aria-selected')).toBe('true');
    expect(rowOf('Theme').getAttribute('aria-selected')).toBe('false');
    expect(rowOf('All variables').getAttribute('aria-selected')).toBe('false');
  });

  // Theme gets a second group so one group click narrows it.
  const withSecondGroup = () => {
    currentVariables = [
      ...variables,
      { id: 'v3', collectionId: 'c1', name: 'size/sm', resolvedType: 'FLOAT', value: '1', valuesByMode: { m1: '1' } },
    ];
  };

  it('Cmd-click adds a group within a collection, and narrows a fully visible one to that group', () => {
    withSecondGroup();
    const add = renderSidebar(new Set(['c1', 'c2']), { selectedGroups: new Set(['c1::color', 'c2::space']) });
    fireEvent.click(rowOf('size'), { metaKey: true });
    expect(lastCall(add.onSelectionChange)).toEqual({
      collections: ['c1', 'c2'],
      groups: ['c1::color', 'c1::size', 'c2::space'],
    });
    document.body.innerHTML = '';

    // Other collections stay visible; only the picked group narrows its collection.
    const narrow = renderSidebar(new Set(['c1', 'c2']), {
      selectedGroups: new Set(['c1::color', 'c1::size', 'c2::space']),
    });
    fireEvent.click(rowOf('size'), { metaKey: true });
    expect(lastCall(narrow.onSelectionChange)).toEqual({
      collections: ['c1', 'c2'],
      groups: ['c1::size', 'c2::space'],
    });
  });

  it('Cmd-click cannot remove the last selected collection', () => {
    const { onSelectionChange } = renderSidebar(new Set(['c2']), { selectedGroups: new Set(['c2::space']) });
    fireEvent.click(rowOf('Primitives'), { metaKey: true });
    fireEvent.click(rowOf('space'), { metaKey: true });
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it('Enter and Space select, with the modifier they toggle', () => {
    const { onSelectionChange } = renderSidebar(new Set(['c2']), { selectedGroups: new Set(['c2::space']) });
    // fireEvent returns false when the handler called preventDefault (no scroll).
    expect(fireEvent.keyDown(rowOf('Primitives'), { key: 'Enter' })).toBe(false);
    expect(lastCall(onSelectionChange).collections).toEqual(['c1', 'c2']);
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    // A modified collection row only flips its mark.
    expect(fireEvent.keyDown(rowOf('Theme'), { key: ' ', metaKey: true })).toBe(false);
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(rowOf('Theme').getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(rowOf('Theme'), { key: 'a' });
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
  });

  it('chevrons expand and collapse without changing the selection', () => {
    const { onSelectionChange } = renderSidebar(new Set(['c1', 'c2']));
    fireEvent.click(screen.getByLabelText('Collapse Theme'));
    expect(screen.queryByText('color', { selector: 'span' })).toBe(null);
    fireEvent.keyDown(screen.getByLabelText('Expand Theme'), { key: 'Enter' });
    fireEvent.click(screen.getByLabelText('Expand Theme'));
    expect(screen.getByText('color', { selector: 'span' })).toBeTruthy();
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it('search forces the tree open and matching rows still select', () => {
    const { onSelectionChange } = renderSidebar(new Set(['c1', 'c2']));
    fireEvent.change(screen.getByPlaceholderText('Search collections & groups...'), {
      target: { value: 'space' },
    });
    expect(screen.queryByText('Theme', { selector: 'span' })).toBe(null);
    fireEvent.click(rowOf('space'));
    expect(lastCall(onSelectionChange)).toEqual({ collections: ['c1', 'c2'], groups: ['c1::color', 'c2::space'] });
  });

  it('shows the variable counts', () => {
    renderSidebar(new Set(['c1', 'c2']));
    expect(rowOf('All variables').textContent).toContain('2');
    expect(rowOf('Theme').textContent).toContain('1');
  });
});

// `badge` and `badge/color` are folder rows with no card of their own
// (isGroup false); `badge/color/error` and `button` are real groups.
const focusCollections: CollectionData[] = [
  { id: 'c3', name: 'Components', modes: [{ modeId: 'm3', name: 'Default' }] },
];
const focusVariables: VariableData[] = [
  { id: 'f1', collectionId: 'c3', name: 'badge/color/error/bg', resolvedType: 'COLOR', value: '#ff0000', valuesByMode: { m3: '#ff0000' } },
  { id: 'f2', collectionId: 'c3', name: 'badge/color/error/fg', resolvedType: 'COLOR', value: '#ffffff', valuesByMode: { m3: '#ffffff' } },
  { id: 'f3', collectionId: 'c3', name: 'button/radius', resolvedType: 'FLOAT', value: '4', valuesByMode: { m3: '4' } },
];
const FOCUS_GROUPS = new Set(['c3::badge/color/error', 'c3::button']);

function renderFocusSidebar(props: Partial<React.ComponentProps<typeof SidebarFilter>> = {}) {
  const onSelectionChange = vi.fn();
  render(
    <SidebarFilter
      selectedModeId="m3"
      onModeChange={() => {}}
      selectedCollections={new Set(['c3'])}
      selectedGroups={FOCUS_GROUPS}
      onSelectionChange={onSelectionChange}
      {...props}
    />
  );
  return { onSelectionChange };
}

describe('SidebarFilter folder rows and focus', () => {
  beforeEach(() => {
    currentCollections = focusCollections;
    currentVariables = focusVariables;
  });
  afterEach(() => {
    currentCollections = collections;
    currentVariables = variables;
  });

  it('a folder row selects its whole subtree, a leaf only itself', () => {
    const { onSelectionChange } = renderFocusSidebar();
    fireEvent.click(rowOf('badge'));
    expect(lastCall(onSelectionChange)).toEqual({
      collections: ['c3'],
      groups: ['c3::badge/color/error'],
    });
    fireEvent.click(rowOf('button'));
    expect(lastCall(onSelectionChange).groups).toEqual(['c3::button']);
  });

  it.each([
    ['Components', ''],
    ['badge', 'badge'],
    ['color', 'badge/color'],
    ['error', 'badge/color/error'],
    ['button', 'button'],
  ])('plain click on %s selects then focuses path "%s"', (text, path) => {
    const onFocusPath = vi.fn();
    const { onSelectionChange } = renderFocusSidebar({ onFocusPath });
    expect(rowOf(text).getAttribute('title')).toBe('Click to select and find in graph');
    fireEvent.click(rowOf(text));
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onFocusPath.mock.calls).toEqual([['c3', path]]);
    // Selection is written before the camera is asked to move.
    expect(onSelectionChange.mock.invocationCallOrder[0]).toBeLessThan(onFocusPath.mock.invocationCallOrder[0]);
  });

  it('Enter and Space focus too; Cmd/Ctrl-click toggles without moving the camera', () => {
    const onFocusPath = vi.fn();
    const { onSelectionChange } = renderFocusSidebar({ onFocusPath, selectedGroups: new Set(['c3::button']) });
    fireEvent.keyDown(rowOf('error'), { key: 'Enter' });
    fireEvent.keyDown(rowOf('error'), { key: ' ' });
    expect(onFocusPath.mock.calls).toEqual([['c3', 'badge/color/error'], ['c3', 'badge/color/error']]);

    onFocusPath.mockClear();
    onSelectionChange.mockClear();
    fireEvent.click(rowOf('error'), { metaKey: true });
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onFocusPath).not.toHaveBeenCalled();
  });

  it('a row with nothing on the canvas is muted but still selects (and asks to focus)', () => {
    const onFocusPath = vi.fn();
    const { onSelectionChange } = renderFocusSidebar({
      onFocusPath,
      isPathFocusable: (collectionId, path) => !(collectionId === 'c3' && path === 'badge'),
    });
    expect(label('badge').className).toContain('text-text-secondary');
    expect(rowOf('badge').getAttribute('title')).toBe('Not shown in graph');
    expect(label('color').className).not.toContain('text-text-secondary');
    fireEvent.click(rowOf('badge'));
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onFocusPath.mock.calls).toEqual([['c3', 'badge']]);
  });

  it('rings the row named by focusedRowKey', () => {
    renderFocusSidebar({ onFocusPath: vi.fn(), focusedRowKey: 'c3::badge/color' });
    expect(rowOf('color').className).toContain('ring-primary');
    expect(rowOf('badge').className).not.toContain('ring-primary');
    expect(rowOf('error').className).not.toContain('ring-primary');
  });

  it('rings the collection row for its "<id>::" key', () => {
    renderFocusSidebar({ onFocusPath: vi.fn(), focusedRowKey: 'c3::' });
    expect(rowOf('Components').className).toContain('ring-primary');
    expect(rowOf('badge').className).not.toContain('ring-primary');
  });

  it('still rings a group highlighted from the canvas', () => {
    renderFocusSidebar({ onFocusPath: vi.fn(), highlightedGroupKey: 'group:c3::badge/color/error' });
    expect(rowOf('error').className).toContain('ring-primary');
  });

  it('without onFocusPath a click only selects and rows have no title', () => {
    const { onSelectionChange } = renderFocusSidebar();
    for (const text of ['Components', 'badge', 'color', 'error']) {
      expect(rowOf(text).getAttribute('title')).toBe(null);
    }
    fireEvent.click(rowOf('Components'));
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
  });
});
