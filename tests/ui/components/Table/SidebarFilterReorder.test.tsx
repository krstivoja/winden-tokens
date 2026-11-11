// Collections reorder in the sidebar tree: drag a collection row onto another
// collection block (before/after by the row's midpoint), or Alt+ArrowUp/Down
// on a focused collection row. Root and group rows never drag; search turns
// reordering off. The order itself is DataContext's (`reorderCollections`).

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, createEvent } from '@testing-library/react';
import type { CollectionData, VariableData } from '../../../../src/ui/types';
import { SidebarFilter } from '../../../../src/ui/components/Table/SidebarFilter';

const collections: CollectionData[] = [
  { id: 'c1', name: 'Theme', modes: [{ modeId: 'm1', name: 'Default' }] },
  { id: 'c2', name: 'Primitives', modes: [{ modeId: 'm2', name: 'Default' }] },
  { id: 'c3', name: 'Spacing', modes: [{ modeId: 'm3', name: 'Default' }] },
];

const variables: VariableData[] = [
  { id: 'v1', collectionId: 'c1', name: 'color/brand', resolvedType: 'COLOR', value: '#ff0000', valuesByMode: { m1: '#ff0000' } },
  { id: 'v2', collectionId: 'c2', name: 'space/1', resolvedType: 'FLOAT', value: '4', valuesByMode: { m2: '4' } },
  { id: 'v3', collectionId: 'c3', name: 'gap', resolvedType: 'FLOAT', value: '8', valuesByMode: { m3: '8' } },
];

let currentCollections = collections;
const reorderCollections = vi.fn();

vi.mock('../../../../src/ui/context/AppContext', () => ({
  useAppContext: () => ({ collections: currentCollections, variables, reorderCollections }),
}));

vi.mock('../../../../src/ui/components/Modals/ModalContext', () => ({
  useModalContext: () => ({ openInputModal: vi.fn() }),
}));

vi.mock('../../../../src/ui/hooks/usePluginMessages', () => ({
  post: vi.fn(),
}));

function renderSidebar(props: Partial<React.ComponentProps<typeof SidebarFilter>> = {}) {
  const onSelectionChange = vi.fn();
  const onFocusPath = vi.fn();
  const ui = () => (
    <SidebarFilter
      selectedModeId="m1"
      onModeChange={() => {}}
      selectedCollections={new Set(['c1', 'c2', 'c3'])}
      selectedGroups={new Set(['c1::color', 'c2::space'])}
      onSelectionChange={onSelectionChange}
      onFocusPath={onFocusPath}
      {...props}
    />
  );
  const { rerender } = render(ui());
  return { onSelectionChange, onFocusPath, rerender: () => rerender(ui()) };
}

const rowOf = (text: string) =>
  screen.getByText(text, { selector: '[role="treeitem"] span' }).closest('[role="treeitem"]') as HTMLElement;
// The drop target: the collection block around the row.
const blockOf = (text: string) => rowOf(text).parentElement as HTMLElement;
const indicators = () =>
  Array.from(screen.getByRole('tree').querySelectorAll('span[aria-hidden]')).filter(el =>
    el.className.includes('bg-primary')
  );

// Row 100px tall at y=100: midpoint 150.
function stubRect(el: HTMLElement) {
  el.getBoundingClientRect = () =>
    ({ top: 100, bottom: 200, height: 100, left: 0, right: 200, width: 200, x: 0, y: 100, toJSON: () => ({}) }) as DOMRect;
}

const dataTransfer = () => ({ setData: vi.fn(), effectAllowed: '', dropEffect: '' });

// jsdom has no DragEvent, so `clientY` from the init dict is dropped: set it.
function dragAt(type: 'dragOver' | 'drop', el: HTMLElement, clientY: number) {
  const event = createEvent[type](el, { dataTransfer: dataTransfer() });
  Object.defineProperty(event, 'clientY', { value: clientY });
  fireEvent(el, event);
}

beforeEach(() => {
  currentCollections = collections;
  reorderCollections.mockReset();
});

describe('SidebarFilter reorder: draggable rows', () => {
  it('makes collection rows draggable, never root or group rows', () => {
    renderSidebar();
    expect(rowOf('Theme').getAttribute('draggable')).toBe('true');
    expect(rowOf('Primitives').getAttribute('draggable')).toBe('true');
    expect(rowOf('All variables').getAttribute('draggable')).toBe(null);
    expect(rowOf('color').getAttribute('draggable')).toBe(null);
  });

  it('turns dragging off while searching', () => {
    renderSidebar();
    fireEvent.change(screen.getByPlaceholderText('Search collections & groups...'), { target: { value: 'e' } });
    expect(rowOf('Theme').getAttribute('draggable')).toBe(null);
    expect(rowOf('Theme').getAttribute('title')).not.toContain('reorder');
  });

  it('turns dragging off with a single collection', () => {
    currentCollections = [collections[0]];
    renderSidebar();
    expect(rowOf('Theme').getAttribute('draggable')).toBe(null);
  });

  it('adds the reorder hint to the row tooltip', () => {
    renderSidebar();
    expect(rowOf('Theme').getAttribute('title')).toBe('Click to select and find in graph · Drag or Alt+↑/↓ to reorder');
  });
});

describe('SidebarFilter reorder: drag and drop', () => {
  it('drops a collection after the target when over its lower half', () => {
    renderSidebar();
    stubRect(rowOf('Primitives'));
    const transfer = dataTransfer();
    fireEvent.dragStart(rowOf('Theme'), { dataTransfer: transfer });
    expect(transfer.setData).toHaveBeenCalledWith('text/plain', 'c1');
    expect(rowOf('Theme').className).toContain('opacity-50');

    dragAt('dragOver', blockOf('Primitives'), 180);
    dragAt('drop', blockOf('Primitives'), 180);

    expect(reorderCollections).toHaveBeenCalledTimes(1);
    expect(reorderCollections).toHaveBeenCalledWith(['c2', 'c1', 'c3']);
  });

  it('drops a collection before the target when over its upper half', () => {
    renderSidebar();
    stubRect(rowOf('Theme'));
    fireEvent.dragStart(rowOf('Spacing'), { dataTransfer: dataTransfer() });
    dragAt('dragOver', blockOf('Theme'), 110);
    dragAt('drop', blockOf('Theme'), 110);
    expect(reorderCollections).toHaveBeenCalledWith(['c3', 'c1', 'c2']);
  });

  it('shows the drop indicator while dragging over, gone on dragEnd', () => {
    renderSidebar();
    stubRect(rowOf('Spacing'));
    fireEvent.dragStart(rowOf('Theme'), { dataTransfer: dataTransfer() });
    expect(indicators().length).toBe(0);

    dragAt('dragOver', blockOf('Spacing'), 180);
    const shown = indicators();
    expect(shown.length).toBe(1);
    expect(shown[0].className).toContain('pointer-events-none');
    expect(shown[0].className).toContain('-bottom-[3px]');
    expect(blockOf('Spacing').contains(shown[0])).toBe(true);

    fireEvent.dragEnd(rowOf('Theme'));
    expect(indicators().length).toBe(0);
    expect(rowOf('Theme').className).not.toContain('opacity-50');
  });

  it('does nothing when dropped on itself or where it already is', () => {
    renderSidebar();
    stubRect(rowOf('Theme'));
    stubRect(rowOf('Primitives'));
    fireEvent.dragStart(rowOf('Theme'), { dataTransfer: dataTransfer() });
    dragAt('dragOver', blockOf('Theme'), 180);
    expect(indicators().length).toBe(0);
    dragAt('drop', blockOf('Theme'), 180);

    fireEvent.dragStart(rowOf('Theme'), { dataTransfer: dataTransfer() });
    // Before Primitives = Theme's current slot.
    dragAt('dragOver', blockOf('Primitives'), 110);
    expect(indicators().length).toBe(0);
    dragAt('drop', blockOf('Primitives'), 110);

    expect(reorderCollections).not.toHaveBeenCalled();
  });

  it('ignores drags that did not start on a collection row (files, text)', () => {
    renderSidebar();
    stubRect(rowOf('Primitives'));
    dragAt('dragOver', blockOf('Primitives'), 180);
    expect(indicators().length).toBe(0);
    dragAt('drop', blockOf('Primitives'), 180);
    expect(reorderCollections).not.toHaveBeenCalled();
  });

  it('swallows the click that follows a drag on the source row', () => {
    const { onSelectionChange, onFocusPath } = renderSidebar();
    fireEvent.dragStart(rowOf('Theme'), { dataTransfer: dataTransfer() });
    fireEvent.dragEnd(rowOf('Theme'));
    fireEvent.click(rowOf('Theme'));
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(onFocusPath).not.toHaveBeenCalled();
  });
});

describe('SidebarFilter reorder: keyboard', () => {
  it('Alt+ArrowDown / Alt+ArrowUp move the focused collection by one', () => {
    renderSidebar();
    fireEvent.keyDown(rowOf('Theme'), { key: 'ArrowDown', altKey: true });
    expect(reorderCollections).toHaveBeenLastCalledWith(['c2', 'c1', 'c3']);
    fireEvent.keyDown(rowOf('Spacing'), { key: 'ArrowUp', altKey: true });
    expect(reorderCollections).toHaveBeenLastCalledWith(['c1', 'c3', 'c2']);
  });

  it('is a no-op at the ends', () => {
    renderSidebar();
    fireEvent.keyDown(rowOf('Theme'), { key: 'ArrowUp', altKey: true });
    fireEvent.keyDown(rowOf('Spacing'), { key: 'ArrowDown', altKey: true });
    expect(reorderCollections).not.toHaveBeenCalled();
  });

  it('announces the move in a polite live region', () => {
    renderSidebar();
    fireEvent.keyDown(rowOf('Theme'), { key: 'ArrowDown', altKey: true });
    const live = document.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(live.textContent).toBe('Moved Theme to position 2 of 3');
  });

  it('plain arrows do not reorder', () => {
    renderSidebar();
    fireEvent.keyDown(rowOf('Theme'), { key: 'ArrowDown' });
    expect(reorderCollections).not.toHaveBeenCalled();
  });

  it('keeps focus on the moved row after the order changes', () => {
    const view = renderSidebar();
    rowOf('Theme').focus();
    fireEvent.keyDown(rowOf('Theme'), { key: 'ArrowDown', altKey: true });
    // DataContext applies the order optimistically: re-render with it.
    currentCollections = [collections[1], collections[0], collections[2]];
    view.rerender();
    expect(screen.getAllByRole('treeitem').filter(r => r.dataset.collectionId).map(r => r.dataset.collectionId)).toEqual(['c2', 'c1', 'c3']);
    expect(document.activeElement).toBe(rowOf('Theme'));
  });
});

describe('SidebarFilter reorder: click behaviour unchanged', () => {
  it('plain click still selects and focuses the collection', () => {
    const { onSelectionChange, onFocusPath } = renderSidebar();
    fireEvent.click(rowOf('Primitives'));
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onFocusPath).toHaveBeenCalledWith('c2', '');
  });

  it('Cmd-click still marks without filtering or focusing', () => {
    const { onSelectionChange, onFocusPath } = renderSidebar();
    fireEvent.click(rowOf('Primitives'), { metaKey: true });
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(onFocusPath).not.toHaveBeenCalled();
    expect(rowOf('Primitives').getAttribute('aria-selected')).toBe('true');
  });

  it('Enter still activates the row', () => {
    const { onFocusPath } = renderSidebar();
    fireEvent.keyDown(rowOf('Spacing'), { key: 'Enter' });
    expect(onFocusPath).toHaveBeenCalledWith('c3', '');
  });
});

describe('SidebarFilter reorder: mode picker', () => {
  it('renders the collection tags in the given order', () => {
    currentCollections = [collections[2], collections[0], collections[1]];
    renderSidebar();
    const tags = screen
      .getAllByRole('button')
      .map(b => b.textContent)
      .filter(t => t === 'Theme' || t === 'Primitives' || t === 'Spacing');
    expect(tags).toEqual(['Spacing', 'Theme', 'Primitives']);
  });
});
