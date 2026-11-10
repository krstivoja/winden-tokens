// GroupedGraph, rendered whole with real xyflow: the Grid Settings "Sort by"
// control, and the Arrange-with-a-filter → Undo → lift-filter overlap bug,
// reproduced through the same buttons a user clicks.
//
// The app contexts, the plugin bridge and the sidebar are stubbed; client
// storage answers are dispatched as the plugin's own `client-storage-data`
// messages. Node geometry is read back off the rendered xyflow nodes.

import React from 'react';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import type { CollectionData, VariableData } from '../../../../src/ui/types';

const posted = vi.hoisted(() => [] as Array<{ type: string; key?: string; value?: unknown }>);

vi.mock('../../../../src/ui/hooks/usePluginMessages', () => ({
  usePluginMessages: () => undefined,
  post: (msg: { type: string; key?: string; value?: unknown }) => { posted.push(msg); },
}));

const ctx = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('../../../../src/ui/context/AppContext', () => ({
  useAppContext: () => ctx.value,
}));

// One stable value, like the real provider's: fresh callbacks on every render
// would re-run the layout effect forever.
const modalContext = vi.hoisted(() => ({
  modals: {},
  openShadesModal: () => {}, openStepsModal: () => {}, openInputModal: () => {},
  openAddVariableModal: () => {}, openBulkEdit: () => {},
}));
vi.mock('../../../../src/ui/components/Modals/ModalContext', () => ({
  useModalContext: () => modalContext,
}));

vi.mock('../../../../src/ui/components/Table/SidebarFilter', () => ({ SidebarFilter: () => null }));

import { GroupedGraph } from '../../../../src/ui/components/Relationships/GroupedGraph';
import {
  WRAPPER_GAP,
  CONTAINER_INSET,
  WRAPPER_HEADER_HEIGHT,
  WRAPPER_PADDING,
} from '../../../../src/ui/components/Relationships/GroupedGraph/constants';

beforeAll(() => {
  // xyflow measures through ResizeObserver, which jsdom lacks.
  (window as unknown as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  (window as unknown as { DOMMatrixReadOnly?: unknown }).DOMMatrixReadOnly = class {
    m22 = 1;
    constructor(_t?: string) {}
  };
});

const collections: CollectionData[] = [
  { id: 'c1', name: 'One', modes: [{ modeId: 'm1', name: 'Default' }] },
  { id: 'c2', name: 'Two', modes: [{ modeId: 'm2', name: 'Default' }] },
];

const variable = (id: string, collectionId: string, name: string): VariableData => ({
  id, collectionId, name, resolvedType: 'FLOAT', value: '1',
  valuesByMode: { [collectionId === 'c1' ? 'm1' : 'm2']: '1' },
});

// Two collections, each wrapped in its own collection frame. All primitives:
// both frames start in column 0, c2's under c1's.
const variables: VariableData[] = [
  variable('v1', 'c1', 'a/one'), variable('v2', 'c1', 'a/two'),
  variable('v3', 'c1', 'b/one'), variable('v4', 'c1', 'b/two'),
  variable('v5', 'c2', 'x/one'), variable('v6', 'c2', 'x/two'),
];

const allGroups = new Set(['c1::a', 'c1::b', 'c2::x']);

function setContext(selectedGroups: Set<string>) {
  ctx.value = {
    collections,
    variables,
    selectedCollectionIds: new Set(['c1', 'c2']),
    shadeGroups: [],
    selectedModeId: null,
    selectedNode: null,
    hasMultipleSelection: false,
    setSelectedModeId: () => {},
    selectedVariableTypes: new Set(['FLOAT', 'COLOR', 'STRING', 'BOOLEAN']),
    selectedGroups,
    toggleVariableType: () => {},
    setSelectedCollectionIds: () => {},
    setSelectedGroups: () => {},
  };
}

function storage(key: string, value: unknown) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', {
      data: { pluginMessage: { type: 'client-storage-data', key, value } },
    }));
  });
}

function nodeBox(id: string) {
  const el = document.querySelector(`.react-flow__node[data-id="${id}"]`) as HTMLElement | null;
  if (!el) throw new Error(`no node ${id}`);
  const match = /translate\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(el.style.transform);
  if (!match) throw new Error(`no transform on ${id}: ${el.style.transform}`);
  return {
    x: Number(match[1]),
    y: Number(match[2]),
    height: Number.parseFloat(el.style.height),
  };
}

function mount(selectedGroups: Set<string>, layoutSettings: unknown = null) {
  setContext(selectedGroups);
  const view = render(<GroupedGraph />);
  storage('graph-grouped-paths', ['c1::', 'c2::']);
  storage('graph-positions', {});
  storage('graph-tier-labels', []);
  storage('graph-layout-labels', null);
  storage('graph-layout-settings', layoutSettings);
  return view;
}

beforeEach(() => {
  posted.length = 0;
});

async function arrangeUndoLift(layoutSettings: unknown) {
  // Filter: c1's group `a` is hidden, so c1's frame shrinks to `b` alone.
  const filtered = new Set(['c1::b', 'c2::x']);
  const view = mount(filtered, layoutSettings);
  await waitFor(() => nodeBox('wrapper:c2::'));

  fireEvent.click(screen.getByText('Arrange Grid'));
  fireEvent.click(await screen.findByText('Undo Arrange'));

  // Lift the filter.
  setContext(allGroups);
  view.rerender(<GroupedGraph />);

  // c1's frame holds both its cards again.
  const bothCards = CONTAINER_INSET * 2 + WRAPPER_HEADER_HEIGHT + WRAPPER_PADDING * 2 + 116 + WRAPPER_GAP;
  await waitFor(() => expect(nodeBox('wrapper:c1::').height).toBeGreaterThan(bothCards));
  return { one: nodeBox('wrapper:c1::'), two: nodeBox('wrapper:c2::') };
}

describe('Arrange with a filter → Undo → lift the filter', () => {
  it('Tier mode: leaves no frame overlapping the next one in its column', async () => {
    const { one, two } = await arrangeUndoLift(null);
    expect(one.x).toBe(two.x);
    // c2's frame starts below c1's bottom — never inside it.
    expect(two.y).toBeGreaterThanOrEqual(one.y + one.height);
  });

  it('Collection mode: the next row starts below the grown frame', async () => {
    const { one, two } = await arrangeUndoLift({ sortBy: 'collection' });
    expect(two.y).toBeGreaterThanOrEqual(one.y + one.height);
  });
});

function openGridSettings() {
  fireEvent.click(screen.getByText('Grid Settings'));
}

const selectedTab = () => screen.getAllByRole('tab').find(tab => tab.getAttribute('aria-selected') === 'true')?.textContent;

describe('Grid Settings "Sort by"', () => {
  it('defaults to Tier and shows no row labels', async () => {
    mount(allGroups);
    await waitFor(() => nodeBox('wrapper:c2::'));
    openGridSettings();
    expect(selectedTab()).toBe('Tier');
    expect(document.querySelector('[data-id^="row-label:"]')).toBe(null);
  });

  it('Cancel discards a switch', async () => {
    mount(allGroups);
    await waitFor(() => nodeBox('wrapper:c2::'));
    openGridSettings();
    fireEvent.click(screen.getByRole('tab', { name: 'Collection' }));
    expect(selectedTab()).toBe('Collection');
    fireEvent.click(screen.getByText('Cancel'));
    expect(selectedTab()).toBe('Tier');
    expect(posted.some(m => m.type === 'set-client-storage' && m.key === 'graph-layout-settings')).toBe(false);
  });

  it('Apply saves the mode, arranges in collection order, and offers Undo', async () => {
    mount(allGroups);
    await waitFor(() => nodeBox('wrapper:c2::'));
    openGridSettings();
    fireEvent.click(screen.getByRole('tab', { name: 'Collection' }));
    fireEvent.click(screen.getByText('Apply'));

    const saved = posted.filter(m => m.type === 'set-client-storage' && m.key === 'graph-layout-settings');
    expect((saved[saved.length - 1].value as { sortBy: string }).sortBy).toBe('collection');
    // Captions are Tier mode's record, once per column.
    const tierLabels = posted.filter(m => m.type === 'set-client-storage' && m.key === 'graph-tier-labels');
    expect(tierLabels[tierLabels.length - 1].value).toEqual([{ tier: 1, x: 0, width: 260 }]);
    // No collection labels any more.
    expect(document.querySelector('[data-id^="row-label:"]')).toBe(null);

    // Both frames are tier 1: one column, c1 (first collection) on top.
    await waitFor(() => expect(nodeBox('wrapper:c1::').y).toBe(0));
    const one = nodeBox('wrapper:c1::');
    const two = nodeBox('wrapper:c2::');
    expect(two.x).toBe(one.x);
    expect(two.y).toBeGreaterThanOrEqual(one.y + one.height);
    expect(screen.getByText('Undo Arrange')).toBeTruthy();
  });

  it('Collection default layout follows the filters: hiding c1\'s groups moves c2 up', async () => {
    const view = mount(allGroups, { sortBy: 'collection' });
    await waitFor(() => expect(document.querySelector('[data-id="tier-label:1"]')).not.toBe(null));
    expect(nodeBox('wrapper:c1::').y).toBe(0);
    const c2Before = nodeBox('wrapper:c2::').y;
    // c1's frame keeps only its empty root card.
    setContext(new Set(['c2::x']));
    view.rerender(<GroupedGraph />);
    await waitFor(() => expect(nodeBox('wrapper:c2::').y).toBeLessThan(c2Before));
  });

  it('clears a stored collection-label record left by the first Collection design', async () => {
    mount(allGroups);
    storage('graph-layout-labels', { tiers: [], rows: [{ collectionId: 'c1', x: -200, y: 0, width: 160, height: 10 }] });
    expect(posted).toContainEqual({ type: 'set-client-storage', key: 'graph-layout-labels', value: null });
  });

  it('does not write when no collection-label record is stored', () => {
    mount(allGroups);
    expect(posted.some(m => m.type === 'set-client-storage' && m.key === 'graph-layout-labels')).toBe(false);
  });
});
