// The Collections tree is click-to-select (no checkboxes): a plain click
// selects only that row and its subgroups, Cmd/Ctrl-click toggles it, and
// "All variables" selects everything (and fires onSelectAllCollections).
// A plain click also asks the graph to focus the row through onFocusPath.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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
  // The sidebar marks (rings) live in FilterContext; here, state of the sidebar itself.
  useAppContext: () => {
    const [sidebarMarks, setSidebarMarks] = React.useState<ReadonlySet<string>>(new Set());
    return { collections: currentCollections, variables: currentVariables, reorderCollections: vi.fn(), sidebarMarks, setSidebarMarks };
  },
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

// The selection held by a parent (as TableView / GroupedGraph do), so rings
// can follow what a click wrote. `onSelectionChange` is spied on as well.
type Selection = { collections: Set<string>; groups: Set<string> };
let setOutside: (next: Selection) => void = () => {};
function StatefulSidebar({
  initial,
  onSelectionChange,
  ...props
}: Partial<React.ComponentProps<typeof SidebarFilter>> & { initial: Selection }) {
  const [selection, setSelection] = React.useState(initial);
  setOutside = setSelection;
  return (
    <SidebarFilter
      selectedModeId="m1"
      onModeChange={() => {}}
      selectedCollections={selection.collections}
      selectedGroups={selection.groups}
      onSelectionChange={next => {
        onSelectionChange?.(next);
        setSelection(next);
      }}
      {...props}
    />
  );
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
    const onSelectionChange = vi.fn();
    render(
      <StatefulSidebar
        initial={{ collections: new Set(['c1', 'c2']), groups: new Set(['c1::color']) }}
        onSelectionChange={onSelectionChange}
        onFocusPath={onFocusPath}
        onSelectAllCollections={onSelectAllCollections}
      />
    );
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
    fireEvent.click(rowOf('color'));
    expect(rowOf('color').className).toContain('ring-primary');
    expect(rowOf('color').getAttribute('aria-selected')).toBe('true');
    expect(rowOf('size').className).not.toContain('bg-primary/10');
    for (const text of ['Theme', 'Primitives', 'space', 'All variables']) {
      expect(rowOf(text).getAttribute('aria-selected')).toBe('false');
      expect(rowOf(text).className).not.toContain('ring-primary');
    }
  });

  it('rings only a clicked row, never one that is merely the remaining selection', () => {
    renderSidebar(new Set(['c2']), { selectedGroups: new Set(['c2::space']) });
    for (const text of ['Theme', 'Primitives', 'space', 'All variables']) {
      expect(rowOf(text).className).not.toContain('ring-primary');
    }
    fireEvent.click(rowOf('Primitives'));
    expect(rowOf('Primitives').getAttribute('aria-selected')).toBe('true');
    expect(rowOf('Primitives').className).toContain('bg-primary/10');
    expect(rowOf('Primitives').className).toContain('ring-primary');
    expect(rowOf('space').getAttribute('aria-selected')).toBe('true');
    expect(rowOf('space').className).not.toContain('ring-primary');
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
    fireEvent.click(rowOf('color'));
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
    const { onSelectionChange } = renderSidebar(new Set(['c1', 'c2']));
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

  it('a highlight set from a folder row rings only the folder, not its single card', () => {
    // The graph highlights every card under the clicked row; here that is one.
    renderFocusSidebar({
      onFocusPath: vi.fn(),
      focusedRowKey: 'c3::badge',
      highlightedGroupKey: 'group:c3::badge/color/error',
    });
    expect(rowOf('badge').className).toContain('ring-primary');
    expect(rowOf('error').className).not.toContain('ring-primary');
  });

  it('drops the focus ring of a row whose variables are no longer selected', () => {
    renderFocusSidebar({ onFocusPath: vi.fn(), focusedRowKey: 'c3::button', selectedGroups: new Set(['c3::badge/color/error']) });
    expect(rowOf('button').className).not.toContain('ring-primary');
    document.body.innerHTML = '';
    renderFocusSidebar({ onFocusPath: vi.fn(), focusedRowKey: 'c3::', selectedCollections: new Set() });
    expect(rowOf('Components').className).not.toContain('ring-primary');
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

// Rings follow the rows the user clicked, not the selection: folder `action`
// holds only group `action/height` (same variables), and the selection lives
// in a parent (as in TableView / GroupedGraph) so it can also change from
// outside the sidebar (Hide unused, Show all, plugin undo).
const ringCollections: CollectionData[] = [
  { id: 'r1', name: 'Tokens', modes: [{ modeId: 'm1', name: 'Default' }] },
  { id: 'r2', name: 'Sizes', modes: [{ modeId: 'm2', name: 'Default' }] },
];
const ringVariables = (ids = ['r1', 'r2']): VariableData[] => [
  { id: 'h1', collectionId: ids[0], name: 'action/height/1', resolvedType: 'FLOAT', value: '1', valuesByMode: { m1: '1' } },
  { id: 'h2', collectionId: ids[0], name: 'action/height/2', resolvedType: 'FLOAT', value: '2', valuesByMode: { m1: '2' } },
  { id: 'h3', collectionId: ids[0], name: 'action/height/3', resolvedType: 'FLOAT', value: '3', valuesByMode: { m1: '3' } },
  { id: 's1', collectionId: ids[0], name: 'size/sm', resolvedType: 'FLOAT', value: '4', valuesByMode: { m1: '4' } },
  { id: 'g1', collectionId: ids[1], name: 'gap/1', resolvedType: 'FLOAT', value: '8', valuesByMode: { m2: '8' } },
];
const everythingOf = (ids = ['r1', 'r2']) => ({
  collections: new Set(ids),
  groups: new Set([`${ids[0]}::action/height`, `${ids[0]}::size`, `${ids[1]}::gap`]),
});

const RingHarness = () => <StatefulSidebar initial={everythingOf()} />;

const ringed = () =>
  screen
    .getAllByRole('treeitem')
    .filter(row => row.className.includes('ring-primary'))
    .map(row => row.querySelector('span')?.textContent);

describe('SidebarFilter rings exactly the clicked rows', () => {
  beforeEach(() => {
    currentCollections = ringCollections;
    currentVariables = ringVariables();
  });
  afterEach(() => {
    currentCollections = collections;
    currentVariables = variables;
  });

  it('clicking a group rings only that group, not its single-child parent folder', () => {
    render(<RingHarness />);
    fireEvent.click(rowOf('height'));
    expect(ringed()).toEqual(['height']);
    expect(rowOf('action').getAttribute('aria-selected')).toBe('false');
    expect(rowOf('action').className).not.toContain('bg-primary/10');
    // Enter is the same as a click.
    fireEvent.click(rowOf('All variables'));
    fireEvent.keyDown(rowOf('height'), { key: 'Enter' });
    expect(ringed()).toEqual(['height']);
  });

  it('clicking the parent folder rings only the parent; the child gets the fill', () => {
    render(<RingHarness />);
    fireEvent.click(rowOf('action'));
    expect(ringed()).toEqual(['action']);
    expect(rowOf('height').getAttribute('aria-selected')).toBe('true');
    expect(rowOf('height').className).toContain('bg-primary/10');
    expect(rowOf('size').getAttribute('aria-selected')).toBe('false');
  });

  it('Cmd/Ctrl-click rings each clicked row and un-rings it again', () => {
    render(<RingHarness />);
    fireEvent.click(rowOf('height'));
    fireEvent.click(rowOf('size'), { metaKey: true });
    fireEvent.click(rowOf('gap'), { ctrlKey: true });
    expect(ringed()).toEqual(['height', 'size', 'gap']);
    // The parent covering the same variables takes over the child's ring.
    fireEvent.click(rowOf('action'), { metaKey: true });
    expect(ringed()).toEqual(['action', 'size', 'gap']);
    fireEvent.click(rowOf('size'), { metaKey: true });
    expect(ringed()).toEqual(['action', 'gap']);
    expect(rowOf('size').getAttribute('aria-selected')).toBe('false');
    // Taking the folder out takes the group under it along.
    fireEvent.click(rowOf('action'), { metaKey: true });
    expect(ringed()).toEqual(['gap']);
    expect(rowOf('height').getAttribute('aria-selected')).toBe('false');
  });

  it('Cmd/Ctrl-click on a child of a clicked folder takes it out; the ring moves to the children left', () => {
    currentVariables = [
      ...ringVariables(),
      { id: 'b1', collectionId: 'r1', name: 'btn/primary/bg', resolvedType: 'FLOAT', value: '1', valuesByMode: { m1: '1' } },
      { id: 'b2', collectionId: 'r1', name: 'btn/ghost/bg', resolvedType: 'FLOAT', value: '2', valuesByMode: { m1: '2' } },
    ];
    const onSelectionChange = vi.fn();
    render(<StatefulSidebar initial={{ collections: new Set(['r1', 'r2']), groups: new Set(['r1::action/height', 'r1::size', 'r1::btn/primary', 'r1::btn/ghost', 'r2::gap']) }} onSelectionChange={onSelectionChange} />);
    fireEvent.click(rowOf('btn'));
    fireEvent.click(rowOf('primary'), { metaKey: true });
    expect(lastCall(onSelectionChange)).toEqual({ collections: ['r1', 'r2'], groups: ['r1::btn/ghost', 'r2::gap'] });
    expect(ringed()).toEqual(['ghost']);
    expect(rowOf('primary').getAttribute('aria-selected')).toBe('false');
    // Cmd/Ctrl-click again brings it back, ringed next to its sibling.
    fireEvent.click(rowOf('primary'), { ctrlKey: true });
    expect(lastCall(onSelectionChange)).toEqual({ collections: ['r1', 'r2'], groups: ['r1::btn/ghost', 'r1::btn/primary', 'r2::gap'] });
    expect(ringed()).toEqual(['ghost', 'primary']);
  });

  it('a ring hidden by Hide unused comes back after Show all, even after a Cmd/Ctrl-click meanwhile', () => {
    render(<RingHarness />);
    fireEvent.click(rowOf('height'));
    const narrowed = { collections: new Set(['r1', 'r2']), groups: new Set(['r1::action/height', 'r2::gap']) };
    act(() => setOutside({ collections: new Set(['r2']), groups: new Set(['r2::gap']) }));
    fireEvent.click(rowOf('Sizes'), { metaKey: true });
    expect(ringed()).toEqual(['Sizes']);
    act(() => setOutside(narrowed));
    expect(ringed()).toEqual(['height', 'Sizes']);
  });

  it('a Cmd/Ctrl-clicked group whose collection is fully shown again (Show all) loses its ring', () => {
    render(<RingHarness />);
    fireEvent.click(rowOf('height'), { metaKey: true });
    expect(ringed()).toEqual(['height']);
    act(() => setOutside(everythingOf()));
    expect(ringed()).toEqual(['All variables']);
  });

  it('a ring hidden by Hide unused still counts: a Cmd/Ctrl-clicked group joins its collection', () => {
    const v = (id: string, name: string): VariableData => ({ id, collectionId: 'r1', name, resolvedType: 'FLOAT', value: '1', valuesByMode: { m1: '1' } });
    currentVariables = [v('x1', 'a/b/c/1'), v('x2', 'a/b/d/1'), v('x3', 'a/e/1'), v('x4', 'f/1'), ringVariables()[4]];
    const onSelectionChange = vi.fn();
    const all = ['r1::a/b/c', 'r1::a/b/d', 'r1::a/e', 'r1::f', 'r2::gap'];
    render(<StatefulSidebar initial={{ collections: new Set(['r1', 'r2']), groups: new Set(all) }} onSelectionChange={onSelectionChange} />);
    fireEvent.click(rowOf('a'));
    // Hide unused unchecks a/b/c: the `a` ring hides.
    act(() => setOutside({ collections: new Set(['r1', 'r2']), groups: new Set(['r1::a/b/d', 'r1::a/e', 'r2::gap']) }));
    expect(ringed()).toEqual([]);
    fireEvent.click(rowOf('f'), { metaKey: true });
    expect(lastCall(onSelectionChange).groups).toEqual(['r1::a/b/d', 'r1::a/e', 'r1::f', 'r2::gap']);
    expect(ringed()).toEqual(['f']);
    // Show all re-checks a/b/c.
    act(() => setOutside({ collections: new Set(['r1', 'r2']), groups: new Set(all) }));
    expect(ringed()).toEqual(['a', 'f']);
  });

  it('a folder with variables of its own stays ringed for them when its subgroups leave', () => {
    const v = (id: string, name: string): VariableData => ({ id, collectionId: 'r1', name, resolvedType: 'FLOAT', value: '1', valuesByMode: { m1: '1' } });
    currentVariables = [v('y1', 'btn/x'), v('y2', 'btn/a/1'), v('y3', 'btn/b/1'), v('y4', 'z/1'), ringVariables()[4]];
    const onSelectionChange = vi.fn();
    render(<StatefulSidebar initial={{ collections: new Set(['r1', 'r2']), groups: new Set(['r1::btn', 'r1::btn/a', 'r1::btn/b', 'r1::z', 'r2::gap']) }} onSelectionChange={onSelectionChange} />);
    fireEvent.click(rowOf('btn'));
    fireEvent.click(rowOf('a'), { metaKey: true });
    // The folder's ring for its own variables is dashed, not the solid ring.
    expect(ringed()).toEqual(['b']);
    expect(rowOf('btn').className).toContain('outline-dashed');
    expect(rowOf('btn').className).toContain('outline-primary');
    expect(rowOf('btn').getAttribute('aria-selected')).toBe('true');
    // Only its own variables: no fill on the subgroup rows.
    expect(rowOf('a').getAttribute('aria-selected')).toBe('false');
    fireEvent.click(rowOf('b'), { metaKey: true });
    expect(lastCall(onSelectionChange).groups).toEqual(['r1::btn', 'r2::gap']);
    expect(rowOf('btn').className).toContain('outline-dashed');
    expect(rowOf('b').getAttribute('aria-selected')).toBe('false');
    // A plain click selects the whole folder again, solid ring.
    fireEvent.click(rowOf('btn'));
    expect(ringed()).toEqual(['btn']);
    expect(rowOf('btn').className).not.toContain('outline-dashed');
  });

  it('Cmd/Ctrl-click on a folder ringed for its own variables takes them out', () => {
    const v = (id: string, name: string): VariableData => ({ id, collectionId: 'r1', name, resolvedType: 'FLOAT', value: '1', valuesByMode: { m1: '1' } });
    currentVariables = [v('y1', 'btn/x'), v('y2', 'btn/a/1'), v('y3', 'btn/b/1'), v('y4', 'z/1'), ringVariables()[4]];
    const onSelectionChange = vi.fn();
    render(<StatefulSidebar initial={{ collections: new Set(['r1', 'r2']), groups: new Set(['r1::btn', 'r1::btn/a', 'r1::btn/b', 'r1::z', 'r2::gap']) }} onSelectionChange={onSelectionChange} />);
    fireEvent.click(rowOf('btn'));
    fireEvent.click(rowOf('a'), { metaKey: true });
    fireEvent.click(rowOf('btn'), { metaKey: true });
    expect(lastCall(onSelectionChange).groups).toEqual(['r1::btn/b', 'r2::gap']);
    expect(ringed()).toEqual(['b']);
    expect(rowOf('btn').className).not.toContain('outline-dashed');
    expect(rowOf('btn').getAttribute('aria-selected')).toBe('false');
  });

  it('ringing a folder drops the rings under it: rows under a ring only get the fill', () => {
    // The graph still focuses the row plain-clicked before (focusedRowKey).
    render(<StatefulSidebar initial={everythingOf()} onFocusPath={vi.fn()} focusedRowKey="r1::action/height" />);
    fireEvent.click(rowOf('height'));
    fireEvent.click(rowOf('action'), { metaKey: true });
    expect(ringed()).toEqual(['action']);
    expect(rowOf('height').className).toContain('bg-primary/10');
  });

  it('All variables clears every ring', () => {
    render(<RingHarness />);
    fireEvent.click(rowOf('height'));
    fireEvent.click(rowOf('gap'), { metaKey: true });
    fireEvent.click(rowOf('All variables'));
    expect(ringed()).toEqual(['All variables']);
  });

  it('a row whose keys are unchecked from outside loses its ring, and gets it back when they return', () => {
    render(<RingHarness />);
    fireEvent.click(rowOf('height'));
    const narrowed = { collections: new Set(['r1', 'r2']), groups: new Set(['r1::action/height', 'r2::gap']) };
    // Hide unused unchecks the clicked group.
    act(() => setOutside({ collections: new Set(['r2']), groups: new Set(['r2::gap']) }));
    expect(ringed()).toEqual([]);
    // Show all re-checks it.
    act(() => setOutside(narrowed));
    expect(ringed()).toEqual(['height']);
  });

  it('drops the rings when a plugin undo recreates every id', () => {
    const { rerender } = render(<RingHarness />);
    fireEvent.click(rowOf('height'));
    fireEvent.click(rowOf('Sizes'), { metaKey: true });
    expect(ringed()).toEqual(['height', 'Sizes']);
    currentCollections = ringCollections.map(c => ({ ...c, id: `${c.id}-new` }));
    currentVariables = ringVariables(['r1-new', 'r2-new']);
    act(() => setOutside(everythingOf(['r1-new', 'r2-new'])));
    rerender(<RingHarness />);
    expect(ringed()).toEqual(['All variables']);
  });
});
