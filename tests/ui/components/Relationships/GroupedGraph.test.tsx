// GroupedGraph, rendered whole with real xyflow: the Grid Settings "Sort by"
// control, and the Arrange-with-a-filter → Undo → lift-filter overlap bug,
// reproduced through the same buttons a user clicks.
//
// The app contexts, the plugin bridge and the sidebar are stubbed; client
// storage answers are dispatched as the plugin's own `client-storage-data`
// messages. Node geometry is read back off the rendered xyflow nodes.

import React from 'react';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
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

// Counts every render of a row handle, by handle id: a card's rows rendering
// again is what a rebuild that keeps an unchanged card must avoid.
const handleRenders = vi.hoisted(() => new Map<string, number>());
vi.mock('../../../../src/ui/components/Relationships/GroupedGraph/GraphHandle', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../../src/ui/components/Relationships/GroupedGraph/GraphHandle')>();
  return {
    GraphHandle: (props: Parameters<typeof real.GraphHandle>[0]) => {
      handleRenders.set(props.id, (handleRenders.get(props.id) ?? 0) + 1);
      return real.GraphHandle(props);
    },
  };
});

import { GroupedGraph } from '../../../../src/ui/components/Relationships/GroupedGraph';
import {
  WRAPPER_GAP,
  CONTAINER_INSET,
  WRAPPER_HEADER_HEIGHT,
  WRAPPER_PADDING,
  GROUP_WIDTH,
  GROUP_GAP_X,
} from '../../../../src/ui/components/Relationships/GroupedGraph/constants';
import { getCardHeightForRows } from '../../../../src/ui/components/Relationships/GroupedGraph/utils';

// A one-card-wide collection frame, and so where the second collection's
// column starts at the default horizontal gap.
const FRAME_WIDTH = GROUP_WIDTH + (CONTAINER_INSET + WRAPPER_PADDING) * 2;
const COLUMN_2_X = FRAME_WIDTH + GROUP_GAP_X;

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

function mount(
  selectedGroups: Set<string>,
  layoutSettings: unknown = null,
  options: { groupedPaths?: string[]; collectionPositions?: unknown; positions?: unknown } = {}
) {
  setContext(selectedGroups);
  const view = render(<GroupedGraph />);
  storage('graph-grouped-paths', options.groupedPaths ?? ['c1::', 'c2::']);
  storage('graph-positions', options.positions ?? {});
  storage('graph-positions-collection', options.collectionPositions ?? {});
  storage('graph-tier-labels', []);
  storage('graph-layout-labels', null);
  storage('graph-layout-settings', layoutSettings);
  return view;
}

const writes = (key: string) =>
  posted.filter(m => m.type === 'set-client-storage' && m.key === key).map(m => m.value);

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
  const bothCards = CONTAINER_INSET * 2 + WRAPPER_HEADER_HEIGHT + WRAPPER_PADDING * 2 + getCardHeightForRows(2) + WRAPPER_GAP;
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

  it('Collection mode: each frame stays in its own column', async () => {
    const { one, two } = await arrangeUndoLift({ sortBy: 'collection' });
    expect(one.y).toBe(0);
    expect(two.y).toBe(0);
    expect(two.x).toBeGreaterThan(one.x);
  });
});

function openGridSettings() {
  fireEvent.click(screen.getByText('Grid Settings'));
}

const selectedTab = () => screen.getAllByRole('tab').find(tab => tab.getAttribute('aria-selected') === 'true')?.textContent;

describe('Grid Settings "Sort by"', () => {
  it('defaults to Tier and shows no collection headers', async () => {
    mount(allGroups);
    await waitFor(() => nodeBox('wrapper:c2::'));
    openGridSettings();
    expect(selectedTab()).toBe('Tier');
    expect(document.querySelector('[data-id^="tier-label:collection:"]')).toBe(null);
  });

  it('Cancel discards a switch', async () => {
    mount(allGroups);
    await waitFor(() => nodeBox('wrapper:c2::'));
    openGridSettings();
    fireEvent.click(screen.getByRole('tab', { name: 'Collection' }));
    expect(selectedTab()).toBe('Collection');
    fireEvent.click(screen.getByText('Cancel'));
    expect(selectedTab()).toBe('Tier');
    expect(writes('graph-layout-settings')).toEqual([]);
  });

  it('an Apply that only switches the mode just switches: no arrange, no store write, no Undo', async () => {
    mount(allGroups);
    await waitFor(() => nodeBox('wrapper:c2::'));
    openGridSettings();
    fireEvent.click(screen.getByRole('tab', { name: 'Collection' }));
    fireEvent.click(screen.getByText('Apply'));

    const saved = writes('graph-layout-settings');
    expect((saved[saved.length - 1] as { sortBy: string }).sortBy).toBe('collection');
    expect(writes('graph-positions')).toEqual([]);
    expect(writes('graph-positions-collection')).toEqual([]);
    expect(writes('graph-tier-labels')).toEqual([]);
    expect(screen.queryByText('Undo Arrange')).toBe(null);
    // The canvas shows Collection mode: one column per collection.
    await waitFor(() => expect(document.querySelector('[data-id="tier-label:collection:c2"]')).not.toBe(null));
    expect(nodeBox('wrapper:c2::').x).toBeGreaterThan(nodeBox('wrapper:c1::').x);
  });

  it('an Apply that switches and changes a gap arranges the new mode; Undo restores mode and store', async () => {
    const record = { 'wrapper:c1::': { x: 0, y: 400 } };
    mount(allGroups, null, { collectionPositions: record, positions: { 'wrapper:c1::': { x: 900, y: 900 } } });
    await waitFor(() => nodeBox('wrapper:c2::'));
    openGridSettings();
    fireEvent.click(screen.getByRole('tab', { name: 'Collection' }));
    fireEvent.change(screen.getByLabelText('Horizontal gap'), { target: { value: '100' } });
    fireEvent.click(screen.getByText('Apply'));

    // Collection Arrange = reset its own record; Tier's is untouched.
    expect(writes('graph-positions-collection')).toEqual([{}]);
    expect(writes('graph-positions')).toEqual([]);
    expect(writes('graph-tier-labels')).toEqual([]);
    await waitFor(() => expect(nodeBox('wrapper:c2::').x).toBe(FRAME_WIDTH + 100));
    posted.length = 0;

    fireEvent.click(await screen.findByText('Undo Arrange'));
    expect(writes('graph-positions-collection')).toEqual([record]);
    expect(writes('graph-positions')).toEqual([]);
    expect(writes('graph-tier-labels')).toEqual([]);
    const saved = writes('graph-layout-settings');
    expect(saved.length).toBe(1);
    expect((saved[0] as { sortBy: string; gapX: number }).sortBy).toBe('tier');
    // The gaps stay as applied.
    expect((saved[0] as { sortBy: string; gapX: number }).gapX).toBe(100);
    expect(selectedTab()).toBe('Tier');
  });

  it('Undo after a plain Arrange leaves the mode alone', async () => {
    mount(allGroups, { sortBy: 'collection' });
    await waitFor(() => nodeBox('wrapper:c2::'));
    fireEvent.click(screen.getByText('Arrange Grid'));
    posted.length = 0;
    fireEvent.click(await screen.findByText('Undo Arrange'));
    expect(writes('graph-layout-settings')).toEqual([]);
    openGridSettings();
    expect(selectedTab()).toBe('Collection');
  });

  it('clears a stored collection-label record left by the first Collection design', async () => {
    mount(allGroups);
    storage('graph-layout-labels', { tiers: [], rows: [{ collectionId: 'c1', x: -200, y: 0, width: 160, height: 10 }] });
    expect(posted).toContainEqual({ type: 'set-client-storage', key: 'graph-layout-labels', value: null });
  });

  it('does not write when no collection-label record is stored', () => {
    mount(allGroups);
    expect(writes('graph-layout-labels')).toEqual([]);
  });
});

const headerIds = () => Array.from(document.querySelectorAll('[data-id^="tier-label:"]'))
  .map(el => el.getAttribute('data-id'));

describe('Collection mode: one column per collection', () => {
  it('one header per visible collection, in collection order, named; every column at the top', async () => {
    mount(allGroups, { sortBy: 'collection' });
    await waitFor(() => expect(headerIds()).toEqual(['tier-label:collection:c1', 'tier-label:collection:c2']));
    const h1 = document.querySelector('[data-id="tier-label:collection:c1"]') as HTMLElement;
    const h2 = document.querySelector('[data-id="tier-label:collection:c2"]') as HTMLElement;
    expect(h1.textContent).toBe('One');
    expect(h2.textContent).toBe('Two');
    expect(nodeBox('tier-label:collection:c1').x).toBe(0);
    // One frame width, then the default horizontal gap.
    expect(nodeBox('tier-label:collection:c2').x).toBe(COLUMN_2_X);
    expect(nodeBox('wrapper:c1::')).toMatchObject({ x: 0, y: 0 });
    expect(nodeBox('wrapper:c2::')).toMatchObject({ x: COLUMN_2_X, y: 0 });
    // No tier captions in Collection mode.
    expect(document.querySelector('[data-id="tier-label:1"]')).toBe(null);
  });

  it('a deselected collection collapses: no header, no gap', async () => {
    const view = mount(allGroups, { sortBy: 'collection' });
    await waitFor(() => expect(nodeBox('wrapper:c2::').x).toBe(COLUMN_2_X));
    ctx.value = { ...ctx.value, selectedCollectionIds: new Set(['c2']) };
    view.rerender(<GroupedGraph />);
    await waitFor(() => expect(nodeBox('wrapper:c2::').x).toBe(0));
    expect(headerIds()).toEqual(['tier-label:collection:c2']);
  });

  it('a stored x is never trusted: a unit stays in its column, keeping its stored y', async () => {
    mount(allGroups, { sortBy: 'collection' }, { collectionPositions: { 'wrapper:c2::': { x: 5000, y: 300 } } });
    await waitFor(() => expect(nodeBox('wrapper:c2::')).toMatchObject({ x: COLUMN_2_X, y: 300 }));
  });

  it('a keyboard move keeps the column x and saves only the moved card, to the Collection record', async () => {
    // Loose cards (no frames), so a card can be selected and moved.
    mount(allGroups, { sortBy: 'collection' }, { groupedPaths: [] });
    await waitFor(() => nodeBox('group:c2::x'));
    const before = nodeBox('group:c2::x');
    const el = document.querySelector('.react-flow__node[data-id="group:c2::x"]') as HTMLElement;
    // Enter selects a focused node (xyflow's keyboard a11y), as a click would.
    fireEvent.keyDown(el, { key: 'Enter' });
    await waitFor(() => expect(el.classList.contains('selected')).toBe(true));
    fireEvent.keyDown(el, { key: 'ArrowRight' });
    fireEvent.keyDown(el, { key: 'ArrowDown' });
    await waitFor(() => expect(nodeBox('group:c2::x').y).toBeGreaterThan(before.y));
    expect(nodeBox('group:c2::x').x).toBe(before.x);

    await waitFor(() => expect(writes('graph-positions-collection').length).toBe(1));
    const saved = writes('graph-positions-collection')[0] as Record<string, { x: number; y: number }>;
    expect(Object.keys(saved)).toEqual(['group:c2::x']);
    expect(saved['group:c2::x'].x).toBe(before.x);
    expect(writes('graph-positions')).toEqual([]);
  });

  it('Arrange resets the Collection record; Undo restores the previous one', async () => {
    const record = { 'wrapper:c2::': { x: COLUMN_2_X, y: 300 } };
    mount(allGroups, { sortBy: 'collection' }, { collectionPositions: record });
    await waitFor(() => expect(nodeBox('wrapper:c2::').y).toBe(300));
    fireEvent.click(screen.getByText('Arrange Grid'));
    expect(writes('graph-positions-collection')).toEqual([{}]);
    await waitFor(() => expect(nodeBox('wrapper:c2::').y).toBe(0));

    fireEvent.click(await screen.findByText('Undo Arrange'));
    expect(writes('graph-positions-collection')).toEqual([{}, record]);
    expect(writes('graph-positions')).toEqual([]);
    await waitFor(() => expect(nodeBox('wrapper:c2::').y).toBe(300));
  });

  it('switching back to Tier shows the Tier record, untouched by Collection mode', async () => {
    const tierRecord = { 'wrapper:c2::': { x: 1000, y: 40 } };
    mount(allGroups, { sortBy: 'collection' }, { positions: tierRecord });
    await waitFor(() => expect(nodeBox('wrapper:c2::').x).toBe(COLUMN_2_X));
    openGridSettings();
    fireEvent.click(screen.getByRole('tab', { name: 'Tier' }));
    fireEvent.click(screen.getByText('Apply'));
    await waitFor(() => expect(nodeBox('wrapper:c2::')).toMatchObject({ x: 1000, y: 40 }));
    expect(headerIds()).toEqual([]);
  });
});

// ── Rebuild reconciliation ─────────────────────────────────────────
//
// A highlight, a hide-unused toggle or a data reload rebuilds every node and
// edge. Cards whose content did not change must keep their node objects (no
// render of their rows), changed cards must still update, and no node may
// lose its measurement (xyflow hides an unmeasured node).

// c1: `a/two` references `b/one`, so a highlight of `b` lights up `a` too.
// c2's `x` card is on no chain.
const linkedVariables: VariableData[] = [
  variable('v1', 'c1', 'a/one'),
  { ...variable('v2', 'c1', 'a/two'), value: '{b/one}', valuesByMode: { m1: '{b/one}' } },
  variable('v3', 'c1', 'b/one'), variable('v4', 'c1', 'b/two'),
  variable('v5', 'c2', 'x/one'), variable('v6', 'c2', 'x/two'),
];

// The sidebar selection the graph asked for (hide-unused unchecks what it
// hides there), applied on the next `applySidebar`.
const sidebarWrites = { groups: null as Set<string> | null, collections: null as Set<string> | null };

async function mountLinked(vars: VariableData[] = linkedVariables) {
  setContext(allGroups);
  sidebarWrites.groups = null;
  sidebarWrites.collections = null;
  ctx.value = {
    ...ctx.value,
    variables: vars,
    setSelectedGroups: (groups: Set<string>) => { sidebarWrites.groups = groups; },
    setSelectedCollectionIds: (ids: Set<string>) => { sidebarWrites.collections = ids; },
  };
  const view = render(<GroupedGraph />);
  storage('graph-grouped-paths', ['c1::', 'c2::']);
  storage('graph-positions', {});
  storage('graph-positions-collection', {});
  storage('graph-tier-labels', []);
  storage('graph-layout-labels', null);
  storage('graph-layout-settings', null);
  await waitFor(() => nodeBox('group:c2::x'));
  return view;
}

const cardRoot = (id: string) =>
  document.querySelector(`.react-flow__node[data-id="${id}"] .rf-group-box`) as HTMLElement | null;
const rendersOf = (...ids: string[]) => ids.reduce((sum, id) => sum + (handleRenders.get(id) ?? 0), 0);
const rowName = (name: string) => screen.getByTitle(`${name} (double-click to rename)`);

/** What the real sidebar does with the graph's writes: the context changes. */
function applySidebar(view: ReturnType<typeof render>) {
  ctx.value = {
    ...ctx.value,
    ...(sidebarWrites.groups ? { selectedGroups: sidebarWrites.groups } : {}),
    ...(sidebarWrites.collections ? { selectedCollectionIds: sidebarWrites.collections } : {}),
  };
  view.rerender(<GroupedGraph />);
}

describe('Rebuilds keep unchanged cards', () => {
  beforeEach(() => handleRenders.clear());

  it('a highlight re-renders the rows on the chain only; the card off the chain is just dimmed', async () => {
    await mountLinked();
    handleRenders.clear();

    fireEvent.click(rowName('b/one'));

    // The chain updated: b and a are highlighted, x is dimmed.
    await waitFor(() => expect(cardRoot('group:c1::b')?.className).toContain('ring-highlight-path'));
    expect(cardRoot('group:c1::a')?.className).toContain('ring-highlight-path');
    expect(cardRoot('group:c2::x')?.className).toContain('opacity-55');
    expect(rendersOf('b/one::in', 'b/two::in')).toBeGreaterThan(0);
    // x's rows look the same whatever is highlighted: not rendered again.
    expect(rendersOf('x/one::in', 'x/one::out', 'x/two::in', 'x/two::out')).toBe(0);

    // Clearing (the same row again) restores every card.
    fireEvent.click(rowName('b/one'));
    await waitFor(() => expect(cardRoot('group:c2::x')?.className).not.toContain('opacity-55'));
    expect(cardRoot('group:c1::b')?.className).not.toContain('ring-highlight-path');
    expect(rendersOf('x/one::in', 'x/two::in')).toBe(0);
  });

  it('Hide unused hides the card off the chain without re-rendering the rows that stay', async () => {
    const view = await mountLinked();
    fireEvent.click(rowName('b/one'));
    await waitFor(() => expect(cardRoot('group:c2::x')?.className).toContain('opacity-55'));
    handleRenders.clear();

    fireEvent.click(screen.getByText('Hide unused'));
    await waitFor(() => expect(sidebarWrites.groups ?? sidebarWrites.collections).not.toBe(null));
    applySidebar(view);
    await waitFor(() => expect(document.querySelector('.react-flow__node[data-id="group:c2::x"]')).toBe(null));
    expect(screen.getByText('Show all')).toBeTruthy();
    expect(cardRoot('group:c1::b')?.className).toContain('ring-highlight-path');
    expect(rendersOf('a/one::in', 'a/two::in', 'b/one::in', 'b/two::in')).toBe(0);
  });

  it('a value edit re-renders the edited card only, and shows the new value', async () => {
    const view = await mountLinked();
    handleRenders.clear();

    // A reload with every variable rebuilt from scratch (as the plugin's poll
    // sends it), one value changed.
    ctx.value = {
      ...ctx.value,
      variables: linkedVariables.map(v => (v.id === 'v5' ? { ...v, value: '42', valuesByMode: { m2: '42' } } : { ...v })),
    };
    view.rerender(<GroupedGraph />);

    await waitFor(() => expect(screen.getByTitle('42')).toBeTruthy());
    expect(rendersOf('x/one::in')).toBeGreaterThan(0);
    expect(rendersOf('a/one::in', 'a/two::in', 'b/one::in', 'b/two::in')).toBe(0);
  });
});

describe('Rebuilds keep node measurements', () => {
  const originalResizeObserver = window.ResizeObserver;
  const sizeDescriptors = {
    width: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth'),
    height: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight'),
  };

  beforeEach(() => {
    // A ResizeObserver that reports every observed node on the next
    // microtask, and a layout with real sizes, so xyflow measures nodes.
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      constructor(private callback: (entries: Array<{ target: Element }>) => void) {}
      observe(target: Element) { queueMicrotask(() => this.callback([{ target }])); }
      unobserve() {}
      disconnect() {}
    };
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 260 });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 120 });
  });

  afterEach(() => {
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = originalResizeObserver;
    if (sizeDescriptors.width) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', sizeDescriptors.width);
    if (sizeDescriptors.height) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', sizeDescriptors.height);
  });

  const hiddenNodes = () => [...document.querySelectorAll<HTMLElement>('.react-flow__node')]
    .filter(el => el.style.visibility === 'hidden')
    .map(el => el.dataset.id);

  it('no node is hidden for re-measuring after a highlight or a clear-highlight rebuild', async () => {
    await mountLinked();
    await waitFor(() => expect(hiddenNodes()).toEqual([]));

    // Checked synchronously, right after the rebuild committed.
    fireEvent.click(rowName('b/one'));
    expect(cardRoot('group:c1::b')?.className).toContain('ring-highlight-path');
    expect(hiddenNodes()).toEqual([]);

    fireEvent.click(rowName('b/one'));
    expect(cardRoot('group:c1::b')?.className).not.toContain('ring-highlight-path');
    expect(hiddenNodes()).toEqual([]);
  });
});
