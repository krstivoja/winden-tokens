// Collection mode: every column is an always-packed ordered list of its
// top-level units. A drop (mouse or key press) changes the card order, saved
// under `graph-order-collection` keyed by path; nothing stores a y. Filters and
// Hide unused always repack, so a column never has holes.
//
// Real GroupedGraph with real xyflow; storage answers are dispatched as the
// plugin's `client-storage-data` messages, geometry is read off the nodes.

import React, { useState } from 'react';
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
import { getCardHeightForRows } from '../../../../src/ui/components/Relationships/GroupedGraph/utils';

beforeAll(() => {
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

const makeCollections = (one: string, two: string): CollectionData[] => [
  { id: one, name: 'One', modes: [{ modeId: `${one}m`, name: 'Default' }] },
  { id: two, name: 'Two', modes: [{ modeId: `${two}m`, name: 'Default' }] },
];

const variable = (id: string, collectionId: string, name: string, value = '1'): VariableData => ({
  id, collectionId, name, resolvedType: 'FLOAT', value, valuesByMode: { [`${collectionId}m`]: value },
});

// c1's column: a, b, c (two rows each), then its empty root card; `a/two`
// references `c/one`, so Hide unused from a keeps a and c. c2 holds x alone.
const makeVariables = (one: string, two: string, prefix = 'v'): VariableData[] => [
  variable(`${prefix}1`, one, 'a/one'), variable(`${prefix}2`, one, 'a/two', '{c/one}'),
  variable(`${prefix}3`, one, 'b/one'), variable(`${prefix}4`, one, 'b/two'),
  variable(`${prefix}5`, one, 'c/one'), variable(`${prefix}6`, one, 'c/two'),
  variable(`${prefix}7`, two, 'x/one'), variable(`${prefix}8`, two, 'x/two'),
];
const groupsOf = (one: string, two: string) => [`${one}::a`, `${one}::b`, `${one}::c`, `${two}::x`];

const CARD = getCardHeightForRows(2);
const GAP = 24;
const STEP = CARD + GAP;
const SETTINGS = { sortBy: 'collection', gapY: GAP };

/** FilterContext in miniature: data and the selection live in state. */
const harness = {
  setData: null as null | ((data: { collections: CollectionData[]; variables: VariableData[] }) => void),
  setGroups: null as null | ((groups: Set<string>) => void),
  setCollectionIds: null as null | ((ids: Set<string>) => void),
  /** The first data the graph gets, when not the real file's (see test 16). */
  initial: null as null | { collections: CollectionData[]; variables: VariableData[] },
};
function Harness() {
  const [data, setData] = useState(() => harness.initial ?? { collections: makeCollections('c1', 'c2'), variables: makeVariables('c1', 'c2') });
  const [collectionIds, setCollectionIds] = useState<Set<string>>(new Set(['c1', 'c2']));
  const [groups, setGroups] = useState<Set<string>>(new Set(groupsOf('c1', 'c2')));
  harness.setData = setData;
  harness.setGroups = setGroups;
  harness.setCollectionIds = setCollectionIds;
  ctx.value = {
    collections: data.collections,
    variables: data.variables,
    selectedCollectionIds: collectionIds,
    shadeGroups: [],
    selectedModeId: null,
    selectedNode: null,
    hasMultipleSelection: false,
    setSelectedModeId: () => {},
    selectedVariableTypes: new Set(['FLOAT', 'COLOR', 'STRING', 'BOOLEAN']),
    selectedGroups: groups,
    toggleVariableType: () => {},
    setSelectedCollectionIds: setCollectionIds,
    setSelectedGroups: setGroups,
  };
  return <GroupedGraph />;
}

function storage(key: string, value: unknown) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', {
      data: { pluginMessage: { type: 'client-storage-data', key, value } },
    }));
  });
}

const nodeEl = (id: string) => document.querySelector(`.react-flow__node[data-id="${id}"]`) as HTMLElement | null;

function pos(id: string) {
  const el = nodeEl(id);
  if (!el) throw new Error(`no node ${id}`);
  const match = /translate\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(el.style.transform);
  if (!match) throw new Error(`no transform on ${id}: ${el.style.transform}`);
  return { x: Number(match[1]), y: Number(match[2]), height: Number.parseFloat(el.style.height) };
}

async function mount(options: {
  settings?: unknown;
  groupedPaths?: string[];
  order?: unknown;
  collectionPositions?: unknown;
} = {}) {
  const view = render(<Harness />);
  storage('graph-grouped-paths', options.groupedPaths ?? []);
  storage('graph-positions', {});
  storage('graph-positions-collection', options.collectionPositions ?? {});
  storage('graph-order-collection', options.order ?? null);
  storage('graph-tier-labels', []);
  storage('graph-layout-labels', null);
  storage('graph-layout-settings', options.settings ?? SETTINGS);
  await waitFor(() => expect(nodeEl('group:c2::x')).not.toBe(null));
  return view;
}

// d3-drag (xyflow's mouse drag) reads `event.view`, which jsdom's MouseEvent
// init rejects for the test window, so it is set on the event afterwards.
function mouseEvent(target: EventTarget, type: string, clientX: number, clientY: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, buttons: type === 'mouseup' ? 0 : 1, clientX, clientY });
  Object.defineProperty(event, 'view', { value: window });
  act(() => { target.dispatchEvent(event); });
}

/** A mouse drag by the header of node `id`, by `dy` canvas px (see overlapNudge.test.tsx). */
function mouseDrag(id: string, dy: number) {
  const header = nodeEl(id)!.querySelector('.group-header') ?? nodeEl(id)!;
  const pane = document.querySelector('.react-flow') as HTMLElement;
  const rect = vi.spyOn(pane, 'getBoundingClientRect').mockReturnValue(
    { x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800, toJSON: () => ({}) } as DOMRect
  );
  const viewport = document.querySelector('.react-flow__viewport') as HTMLElement;
  const zoom = Number(/scale\(([\d.]+)\)/.exec(viewport.style.transform)?.[1] ?? 1);
  const startY = 400;
  const endY = startY + 4 + dy * zoom;
  mouseEvent(header, 'mousedown', 300, startY);
  mouseEvent(window, 'mousemove', 300, startY + 4);
  for (let i = 1; i <= 4; i++) mouseEvent(window, 'mousemove', 300, startY + 4 + ((endY - startY - 4) * i) / 4);
  mouseEvent(window, 'mouseup', 300, endY);
  rect.mockRestore();
}

const settle = (ms = 400) => act(async () => { await new Promise(r => setTimeout(r, ms)); });

const writes = (key: string) =>
  posted.filter(m => m.type === 'set-client-storage' && m.key === key).map(m => m.value);
const lastWrite = (key: string) => {
  const all = writes(key);
  return all[all.length - 1];
};
const orderOf = (items: string[], id = 'c1') => ({ v: 1, columns: [{ id, name: 'One', items }] });

const shown = () => ({ a: pos('group:c1::a').y, b: pos('group:c1::b').y, c: pos('group:c1::c').y });

/** Selects node `id` by keyboard (xyflow's a11y), as a click would. */
async function select(id: string) {
  const el = nodeEl(id)!;
  fireEvent.keyDown(el, { key: 'Enter' });
  fireEvent.keyUp(el, { key: 'Enter' });
  await waitFor(() => expect(el.classList.contains('selected')).toBe(true));
  return el;
}

/** One key press on `el`, then wait until the column shows `expected`. */
async function press(el: HTMLElement, key: string, expected: Record<string, number>, init: object = {}) {
  fireEvent.keyDown(el, { key, ...init });
  await waitFor(() => expect(shown()).toEqual(expected));
}

beforeEach(() => {
  posted.length = 0;
  harness.initial = null;
});

// A drop's save is debounced (300ms): let it land in its own test, before the
// unmount, never in the next test's writes.
afterEach(async () => {
  await settle();
});

describe('Collection mode: the card order', () => {
  it('1. a mouse drop past the next card\'s centre reorders; gaps exactly gapY; only the order is written', async () => {
    await mount();
    expect(shown()).toEqual({ a: 0, b: STEP, c: STEP * 2 });
    mouseDrag('group:c1::a', STEP + 10);
    await waitFor(() => expect(shown()).toEqual({ a: STEP, b: 0, c: STEP * 2 }));
    expect(pos('group:c1::a').x).toBe(0);
    await waitFor(() => expect(writes('graph-order-collection').length).toBe(1), { timeout: 1000 });
    expect(writes('graph-order-collection')[0]).toEqual(orderOf(['path:b', 'path:a', 'path:c', 'path:']));
    expect(writes('graph-positions-collection')).toEqual([]);
  });

  it('2. a drop short of the centre snaps back and writes nothing', async () => {
    await mount();
    mouseDrag('group:c1::a', STEP - 40);
    await waitFor(() => expect(shown()).toEqual({ a: 0, b: STEP, c: STEP * 2 }));
    await settle();
    expect(writes('graph-order-collection')).toEqual([]);
    expect(writes('graph-positions-collection')).toEqual([]);
  });

  it('3. far below goes last, far above goes first', async () => {
    const view = await mount();
    mouseDrag('group:c1::a', 5000);
    await waitFor(() => expect(pos('group:c1::a').y).toBeGreaterThan(pos('collection:c1').y));
    expect(shown()).toMatchObject({ b: 0, c: STEP });
    await waitFor(() => expect(writes('graph-order-collection').length).toBe(1), { timeout: 1000 });
    expect(lastWrite('graph-order-collection')).toEqual(orderOf(['path:b', 'path:c', 'path:', 'path:a']));
    view.unmount();

    posted.length = 0;
    await mount();
    mouseDrag('group:c1::c', -5000);
    await waitFor(() => expect(shown()).toEqual({ a: STEP, b: STEP * 2, c: 0 }));
  });

  it('4. keys move one slot per press: Down, Up, Shift+Down; Left and Down at the bottom change nothing', async () => {
    await mount({ order: orderOf(['path:a', 'path:b', 'path:', 'path:c']) });
    // Root card in the middle: c is last.
    const a = await select('group:c1::a');
    await press(a, 'ArrowDown', { a: STEP, b: 0, c: pos('group:c1::c').y });
    await press(a, 'ArrowUp', { a: 0, b: STEP, c: pos('group:c1::c').y });
    await press(a, 'ArrowDown', { a: STEP, b: 0, c: pos('group:c1::c').y }, { shiftKey: true });

    const c = await select('group:c1::c');
    const before = shown();
    fireEvent.keyDown(c, { key: 'ArrowLeft' });
    fireEvent.keyDown(c, { key: 'ArrowDown' });
    await settle(100);
    expect(shown()).toEqual(before);
    expect(pos('group:c1::c').x).toBe(0);

    await waitFor(() => expect(writes('graph-order-collection').length).toBeGreaterThan(0), { timeout: 1000 });
    expect(lastWrite('graph-order-collection')).toEqual(orderOf(['path:b', 'path:a', 'path:', 'path:c']));
  });

  it('5. a multi-selection drops as one contiguous block, in its order', async () => {
    await mount();
    await select('group:c1::a');
    const c = nodeEl('group:c1::c')!;
    fireEvent.keyDown(document, { key: 'Control', code: 'ControlLeft', ctrlKey: true });
    fireEvent.keyDown(c, { key: 'Enter', ctrlKey: true });
    fireEvent.keyUp(c, { key: 'Enter', ctrlKey: true });
    fireEvent.keyUp(document, { key: 'Control', code: 'ControlLeft' });
    await waitFor(() => expect(document.querySelectorAll('.react-flow__node.selected').length).toBe(2));
    // The block (a … c) moves up: its centre passes b's.
    mouseDrag('group:c1::a', -40);
    await waitFor(() => expect(shown()).toEqual({ a: 0, c: STEP, b: STEP * 2 }));
    await waitFor(() => expect(writes('graph-order-collection').length).toBe(1), { timeout: 1000 });
    expect(writes('graph-order-collection')[0]).toEqual(orderOf(['path:a', 'path:c', 'path:b', 'path:']));
  });

  it('6. a frame moves one slot as one unit, keyed by its path', async () => {
    // The frame `b` absorbs card b: the frame node draws it (and its rows).
    await mount({ groupedPaths: ['c1::b'] });
    expect(nodeEl('group:c1::b')).toBe(null);
    const frame = pos('wrapper:c1::b');
    expect(frame.y).toBe(STEP);
    const c = pos('group:c1::c');
    // The frame's centre lands just past c's.
    mouseDrag('wrapper:c1::b', (c.y + CARD / 2) - (frame.y + frame.height / 2) + 10);
    await waitFor(() => expect(pos('wrapper:c1::b').y).toBe(STEP * 2));
    expect(pos('group:c1::c').y).toBe(STEP);
    expect(pos('group:c1::a').y).toBe(0);
    expect(nodeEl('wrapper:c1::b')!.textContent).toContain('one');
    await waitFor(() => expect(writes('graph-order-collection').length).toBe(1), { timeout: 1000 });
    expect(writes('graph-order-collection')[0]).toEqual(orderOf(['path:a', 'path:c', 'path:b', 'path:']));
  });

  it('7. a filter after a reorder repacks: the column starts at the top, no holes', async () => {
    await mount();
    mouseDrag('group:c1::c', -5000);
    await waitFor(() => expect(shown()).toEqual({ a: STEP, b: STEP * 2, c: 0 }));
    act(() => harness.setGroups!(new Set(['c1::b', 'c1::c', 'c2::x'])));
    await waitFor(() => expect(nodeEl('group:c1::a')).toBe(null));
    expect(pos('group:c1::c').y).toBe(0);
    expect(pos('group:c1::b').y).toBe(STEP);
    expect(pos('collection:c1').y).toBe(STEP * 2);
  });

  it('8. Hide unused after a reorder packs the visible path; Show all restores the full order', async () => {
    await mount({ order: orderOf(['path:c', 'path:b', 'path:a', 'path:']) });
    expect(shown()).toEqual({ c: 0, b: STEP, a: STEP * 2 });
    fireEvent.click(screen.getByLabelText('Open actions for a'));
    fireEvent.click(screen.getAllByText('Hide unused').find(el => !el.closest('[aria-pressed]'))!);
    await waitFor(() => expect(nodeEl('group:c1::b')).toBe(null));
    expect(pos('group:c1::c').y).toBe(0);
    expect(pos('group:c1::a').y).toBe(STEP);

    fireEvent.click(document.querySelector('button[aria-pressed]') as HTMLElement);
    await waitFor(() => expect(nodeEl('group:c1::b')).not.toBe(null));
    await waitFor(() => expect(shown()).toEqual({ c: 0, b: STEP, a: STEP * 2 }));
    expect(writes('graph-order-collection')).toEqual([]);
  });

  it('9. a reload with a stored order shows the same layout and writes nothing', async () => {
    await mount({ order: orderOf(['path:b', 'path:c', 'path:a', 'path:']) });
    await waitFor(() => expect(shown()).toEqual({ b: 0, c: STEP, a: STEP * 2 }));
    await settle();
    expect(writes('graph-order-collection')).toEqual([]);
    expect(writes('graph-positions-collection')).toEqual([]);
  });

  it('10. a plugin undo (every id recreated, names kept) keeps the order; the next drop writes the new id', async () => {
    await mount({ order: orderOf(['path:b', 'path:a', 'path:c', 'path:']) });
    expect(shown()).toEqual({ b: 0, a: STEP, c: STEP * 2 });
    act(() => {
      harness.setData!({ collections: makeCollections('d1', 'd2'), variables: makeVariables('d1', 'd2', 'w') });
      harness.setCollectionIds!(new Set(['d1', 'd2']));
      harness.setGroups!(new Set(groupsOf('d1', 'd2')));
    });
    await waitFor(() => expect(nodeEl('group:d1::a')).not.toBe(null));
    const shownD = () => ({ a: pos('group:d1::a').y, b: pos('group:d1::b').y, c: pos('group:d1::c').y });
    expect(shownD()).toEqual({ b: 0, a: STEP, c: STEP * 2 });

    const c = await select('group:d1::c');
    fireEvent.keyDown(c, { key: 'ArrowUp' });
    await waitFor(() => expect(shownD()).toEqual({ b: 0, c: STEP, a: STEP * 2 }));
    await waitFor(() => expect(writes('graph-order-collection').length).toBe(1), { timeout: 1000 });
    expect(writes('graph-order-collection')[0]).toEqual(orderOf(['path:b', 'path:c', 'path:a', 'path:'], 'd1'));
  });

  it('11. Arrange writes the empty order and shows natural order; Undo restores the previous order', async () => {
    const order = orderOf(['path:c', 'path:b', 'path:a', 'path:']);
    await mount({ order });
    fireEvent.click(screen.getByText('Arrange Grid'));
    expect(writes('graph-order-collection')).toEqual([{ v: 1, columns: [] }]);
    expect(writes('graph-positions-collection')).toEqual([{}]);
    await waitFor(() => expect(shown()).toEqual({ a: 0, b: STEP, c: STEP * 2 }));

    fireEvent.click(await screen.findByText('Undo Arrange'));
    expect(writes('graph-order-collection')).toEqual([{ v: 1, columns: [] }, order]);
    await waitFor(() => expect(shown()).toEqual({ c: 0, b: STEP, a: STEP * 2 }));
  });

  it('12. an Apply that switches the mode and changes a gap: Undo restores the mode and the order', async () => {
    const order = orderOf(['path:c', 'path:b', 'path:a', 'path:']);
    await mount({ settings: { gapY: GAP }, order });
    fireEvent.click(screen.getByText('Grid Settings'));
    fireEvent.click(screen.getByRole('tab', { name: 'Collection' }));
    fireEvent.change(screen.getByLabelText('Horizontal gap'), { target: { value: '100' } });
    fireEvent.click(screen.getByText('Apply'));
    expect(writes('graph-order-collection')).toEqual([{ v: 1, columns: [] }]);
    await waitFor(() => expect(shown()).toEqual({ a: 0, b: STEP, c: STEP * 2 }));
    posted.length = 0;

    fireEvent.click(await screen.findByText('Undo Arrange'));
    expect(writes('graph-order-collection')).toEqual([order]);
    expect((lastWrite('graph-layout-settings') as { sortBy: string }).sortBy).toBe('tier');

    // Switching back (a switch only) shows the restored order.
    fireEvent.click(screen.getByRole('tab', { name: 'Collection' }));
    fireEvent.click(screen.getByText('Apply'));
    await waitFor(() => expect(shown()).toEqual({ c: 0, b: STEP, a: STEP * 2 }));
  });

  it('13. migration: a legacy y record becomes the order once, and the record keeps only free cards', async () => {
    const legacy = {
      'group:c1::c': { x: 0, y: -50 },
      'group:c1::b': { x: 0, y: 2000 },
      'ext-group:lib': { x: 900, y: 40 },
    };
    const view = await mount({ collectionPositions: legacy });
    const order = orderOf(['path:c', 'path:a', 'path:', 'path:b']);
    await waitFor(() => expect(writes('graph-order-collection')).toEqual([order]));
    expect(writes('graph-positions-collection')).toEqual([{ 'ext-group:lib': { x: 900, y: 40 } }]);
    await waitFor(() => expect(shown()).toMatchObject({ c: 0, a: STEP }));
    expect(pos('group:c1::b').y).toBeGreaterThan(pos('collection:c1').y);
    view.unmount();

    posted.length = 0;
    await mount({ order, collectionPositions: { 'ext-group:lib': { x: 900, y: 40 } } });
    await waitFor(() => expect(shown()).toMatchObject({ c: 0, a: STEP }));
    await settle();
    expect(writes('graph-order-collection')).toEqual([]);
    expect(writes('graph-positions-collection')).toEqual([]);
  });

  it('15. a drag cut short (no drop) never turns the next key press into a mouse drop', async () => {
    await mount();
    // Start a mouse drag of a; mid-drag a's card goes away and comes back
    // (a data reload), which aborts xyflow's drag: no drop, no drag stop.
    const header = nodeEl('group:c1::a')!.querySelector('.group-header') ?? nodeEl('group:c1::a')!;
    const pane = document.querySelector('.react-flow') as HTMLElement;
    const rect = vi.spyOn(pane, 'getBoundingClientRect').mockReturnValue(
      { x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800, toJSON: () => ({}) } as DOMRect
    );
    mouseEvent(header, 'mousedown', 300, 400);
    mouseEvent(window, 'mousemove', 300, 404);
    mouseEvent(window, 'mousemove', 300, 420);
    const full = makeVariables('c1', 'c2');
    act(() => harness.setData!({ collections: makeCollections('c1', 'c2'), variables: full.filter(v => !v.name.startsWith('a/')) }));
    await waitFor(() => expect(nodeEl('group:c1::a')).toBe(null));
    mouseEvent(window, 'mousemove', 300, 440);
    act(() => harness.setData!({ collections: makeCollections('c1', 'c2'), variables: full }));
    await waitFor(() => expect(nodeEl('group:c1::a')).not.toBe(null));
    mouseEvent(window, 'mouseup', 300, 440);
    rect.mockRestore();
    await waitFor(() => expect(shown()).toEqual({ a: 0, b: STEP, c: STEP * 2 }));

    // One key press down is one slot.
    const a = await select('group:c1::a');
    await press(a, 'ArrowDown', { a: STEP, b: 0, c: STEP * 2 });
  });

  it('16. migration waits for the real collections when stand-in data answers first', async () => {
    // The bridge tab shows mock data until the real file arrives; client
    // storage (the real file's) answers in between.
    harness.initial = { collections: makeCollections('mock1', 'mock2'), variables: makeVariables('mock1', 'mock2', 'm') };
    render(<Harness />);
    storage('graph-grouped-paths', []);
    storage('graph-positions', {});
    storage('graph-positions-collection', { 'group:c1::c': { x: 0, y: -50 }, 'ext-group:lib': { x: 900, y: 40 } });
    storage('graph-order-collection', null);
    storage('graph-tier-labels', []);
    storage('graph-layout-labels', null);
    storage('graph-layout-settings', SETTINGS);
    // The stand-in collections are not ticked in the sidebar (nothing drawn).
    await settle(300);
    expect(writes('graph-order-collection')).toEqual([]);

    act(() => {
      harness.setData!({ collections: makeCollections('c1', 'c2'), variables: makeVariables('c1', 'c2') });
      harness.setCollectionIds!(new Set(['c1', 'c2']));
      harness.setGroups!(new Set(groupsOf('c1', 'c2')));
    });
    await waitFor(() => expect(writes('graph-order-collection')).toEqual([orderOf(['path:c', 'path:a', 'path:b', 'path:'])]));
    expect(writes('graph-positions-collection')).toEqual([{ 'ext-group:lib': { x: 900, y: 40 } }]);
    await waitFor(() => expect(shown()).toEqual({ c: 0, a: STEP, b: STEP * 2 }));
  });

  it('14. a card the order does not know is slotted by natural order, with no write', async () => {
    await mount({ order: orderOf(['path:c', 'path:a', 'path:']) });
    await waitFor(() => expect(shown()).toEqual({ c: 0, a: STEP, b: STEP * 2 }));
    await settle();
    expect(writes('graph-order-collection')).toEqual([]);
  });
});
