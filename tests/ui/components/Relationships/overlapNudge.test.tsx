// Saved layouts from before the card-height fix overlap: cards and frames are
// drawn taller than the estimates those layouts were packed with. Loading one
// must push overlapping boxes down to the Grid Settings gap — without writing
// anything to storage, without moving anything that does not collide, and in
// both Tier and Collection mode. A keyboard drop that lands on another card
// resolves on the spot, and the push is saved with the drop.
//
// Real GroupedGraph with real xyflow; storage answers are dispatched as the
// plugin's `client-storage-data` messages, geometry is read off the nodes.

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

const collections: CollectionData[] = [
  { id: 'c1', name: 'One', modes: [{ modeId: 'm1', name: 'Default' }] },
  { id: 'c2', name: 'Two', modes: [{ modeId: 'm2', name: 'Default' }] },
];

const variable = (id: string, collectionId: string, name: string): VariableData => ({
  id, collectionId, name, resolvedType: 'FLOAT', value: '1',
  valuesByMode: { [collectionId === 'c1' ? 'm1' : 'm2']: '1' },
});

// Every card has two rows.
const variables: VariableData[] = [
  variable('v1', 'c1', 'a/one'), variable('v2', 'c1', 'a/two'),
  variable('v3', 'c1', 'b/one'), variable('v4', 'c1', 'b/two'),
  variable('v5', 'c1', 'c/one'), variable('v6', 'c1', 'c/two'),
  variable('v7', 'c2', 'x/one'), variable('v8', 'c2', 'x/two'),
];
const ALL_GROUPS = new Set(['c1::a', 'c1::b', 'c1::c', 'c2::x']);
const CARD = getCardHeightForRows(2);
// What the same two-row card measured before the height fix.
const HEAD_CARD = CARD - 6;

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
  positions?: unknown;
  collectionPositions?: unknown;
  selectedGroups?: Set<string>;
}) {
  setContext(options.selectedGroups ?? ALL_GROUPS);
  const view = render(<GroupedGraph />);
  storage('graph-grouped-paths', options.groupedPaths ?? []);
  storage('graph-positions', options.positions ?? {});
  storage('graph-positions-collection', options.collectionPositions ?? {});
  storage('graph-tier-labels', []);
  storage('graph-layout-labels', null);
  storage('graph-layout-settings', options.settings ?? null);
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

/**
 * A mouse drag by the header of node `id`, by `dy` canvas px. The pane gets a
 * real size for the drag (jsdom's is 0×0, which would make xyflow auto-pan
 * every frame), and the first move only starts the drag: xyflow measures the
 * grab offset there, so the move by `dy` is counted from it.
 */
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

// One arrow key press at a time until `done` holds (each press is a drop).
async function pressUntil(el: HTMLElement, key: string, done: () => boolean, max = 20) {
  for (let i = 0; i < max && !done(); i++) {
    const before = el.style.transform;
    fireEvent.keyDown(el, { key });
    await waitFor(() => expect(el.style.transform).not.toBe(before));
  }
  expect(done()).toBe(true);
}

const writes = (key: string) =>
  posted.filter(m => m.type === 'set-client-storage' && m.key === key).map(m => m.value);

beforeEach(() => {
  posted.length = 0;
});

describe('Tier mode: a layout saved before the height fix', () => {
  // Arranged at gap 24 with the old heights: a, b, c stacked in one column.
  const headEra = {
    'group:c1::a': { x: 0, y: 0 },
    'group:c1::b': { x: 0, y: HEAD_CARD + 24 },
    'group:c1::c': { x: 0, y: (HEAD_CARD + 24) * 2 },
    'group:c2::x': { x: 400, y: 0 },
  };

  it('stacks cleanly again: gaps are at least the setting, nothing is written', async () => {
    await mount({ settings: { gapY: 24 }, positions: headEra });
    // The old gap (24) minus the 6px each card grew: 18, still clear.
    expect(pos('group:c1::b').y).toBe(HEAD_CARD + 24);
    expect(pos('group:c1::c').y).toBe((HEAD_CARD + 24) * 2);
    expect(pos('group:c2::x')).toMatchObject({ x: 400, y: 0 });
    expect(writes('graph-positions')).toEqual([]);
  });

  it('pushes an overlapping card down to exactly the gap, and the push cascades', async () => {
    const overlapping = {
      ...headEra,
      // b runs 10px into a; c sat clear of b's old spot, b's push lands on it.
      'group:c1::b': { x: 0, y: CARD - 10 },
      'group:c1::c': { x: 0, y: CARD * 2 + 5 },
    };
    await mount({ settings: { gapY: 24 }, positions: overlapping });
    await waitFor(() => expect(pos('group:c1::b').y).toBe(CARD + 24));
    expect(pos('group:c1::c').y).toBe(CARD + 24 + CARD + 24);
    expect(pos('group:c1::a').y).toBe(0);
    expect(pos('group:c2::x')).toMatchObject({ x: 400, y: 0 });
    // Resolved at layout time only: the saved record is untouched.
    expect(writes('graph-positions')).toEqual([]);
  });

  it('moves a frame and the cards inside it as one block', async () => {
    // c1's collection frame holds a, b and c; x sits 10px inside its bottom.
    await mount({
      settings: { gapY: 40 },
      groupedPaths: ['c1::'],
      positions: { 'wrapper:c1::': { x: 0, y: 0 }, 'group:c2::x': { x: 0, y: 200 } },
    });
    const frame = pos('wrapper:c1::');
    await waitFor(() => expect(pos('group:c2::x').y).toBe(frame.y + frame.height + 40));
    expect(frame.y).toBe(0);
    expect(writes('graph-positions')).toEqual([]);
  });

  it('a hidden card pushes nothing', async () => {
    await mount({
      settings: { gapY: 24 },
      positions: { ...headEra, 'group:c1::b': { x: 0, y: CARD - 10 } },
      selectedGroups: new Set(['c1::b', 'c1::c', 'c2::x']),
    });
    // a is filtered out, so b stays where it was saved — and so does c.
    expect(nodeEl('group:c1::a')?.style.visibility ?? 'hidden').toBe('hidden');
    expect(pos('group:c1::b').y).toBe(CARD - 10);
    expect(pos('group:c1::c').y).toBe((HEAD_CARD + 24) * 2);
  });

  it('Arrange then Undo writes back exactly the saved record, and it loads nudged again', async () => {
    const overlapping = { ...headEra, 'group:c1::b': { x: 0, y: CARD - 10 } };
    await mount({ settings: { gapY: 24 }, positions: overlapping });
    await waitFor(() => expect(pos('group:c1::b').y).toBe(CARD + 24));

    fireEvent.click(screen.getByText('Arrange Grid'));
    fireEvent.click(await screen.findByText('Undo Arrange'));
    const saved = writes('graph-positions');
    expect(saved[saved.length - 1]).toEqual(overlapping);
    await waitFor(() => expect(pos('group:c1::b').y).toBe(CARD + 24));
  });
});

describe('Collection mode: a dragged card under computed ones', () => {
  it('pushes the dragged card below the computed card that grew into it', async () => {
    // Collection mode keeps only moved cards: b was dropped 6px below a's
    // old bottom (+ gap 24); a is computed, and now taller.
    await mount({
      settings: { sortBy: 'collection', gapY: 24 },
      collectionPositions: { 'group:c1::b': { x: 0, y: CARD - 10 } },
    });
    await waitFor(() => expect(pos('group:c1::b').y).toBe(CARD + 24));
    expect(pos('group:c1::a').y).toBe(0);
    // c (computed, at its natural spot below b's natural one) does not collide.
    expect(pos('group:c1::c').y).toBe((CARD + 24) * 2);
    expect(writes('graph-positions-collection')).toEqual([]);
  });

  it('pushes the computed cards below a dragged card that lands on them, cascading', async () => {
    await mount({
      settings: { sortBy: 'collection', gapY: 24 },
      // a dropped onto b's natural spot: b and then c make room.
      collectionPositions: { 'group:c1::a': { x: 0, y: CARD } },
    });
    await waitFor(() => expect(pos('group:c1::b').y).toBe(CARD + CARD + 24));
    expect(pos('group:c1::a').y).toBe(CARD);
    expect(pos('group:c1::c').y).toBe(CARD + (CARD + 24) * 2);
  });

  it('leaves an untouched layout alone', async () => {
    await mount({ settings: { sortBy: 'collection', gapY: 24 } });
    expect(pos('group:c1::a').y).toBe(0);
    expect(pos('group:c1::b').y).toBe(CARD + 24);
    expect(pos('group:c1::c').y).toBe((CARD + 24) * 2);
  });
});

describe('a drop onto another card', () => {
  it('a key press into the card below swaps the two, and the swap is saved with the drop', async () => {
    await mount({
      settings: { gapY: 24 },
      positions: {
        'group:c1::a': { x: 0, y: 0 },
        // 4px under a: closer than the gap, but clear — so it loads as is.
        'group:c1::b': { x: 0, y: CARD + 4 },
        'group:c1::c': { x: 0, y: 1000 },
        'group:c2::x': { x: 400, y: 0 },
      },
    });
    expect(pos('group:c1::b').y).toBe(CARD + 4);
    // One press down runs a into b: b moves up to a's old top (never above
    // it), a sits the gap below b.
    const a = nodeEl('group:c1::a')!;
    fireEvent.keyDown(a, { key: 'Enter' });
    fireEvent.keyDown(a, { key: 'ArrowDown' });
    await waitFor(() => expect(pos('group:c1::a').y).toBe(CARD + 24));
    expect(pos('group:c1::b').y).toBe(0);
    expect(pos('group:c1::c').y).toBe(1000);
    await waitFor(() => expect(writes('graph-positions').length).toBe(1), { timeout: 1000 });
    const saved = writes('graph-positions')[0] as Record<string, { y: number }>;
    expect(saved['group:c1::a'].y).toBe(CARD + 24);
    expect(saved['group:c1::b'].y).toBe(0);
    expect(saved['group:c1::c'].y).toBe(1000);
  });

  it('Collection mode: key presses down swap once the card runs into the next; only the pair is stored, the rest re-flows', async () => {
    const view = await mount({ settings: { sortBy: 'collection', gapY: 24 } });
    const a = nodeEl('group:c1::a')!;
    fireEvent.keyDown(a, { key: 'Enter' });
    const STEP = CARD + 24;
    // 8px a press: three walk a into the 24px gap, the fourth runs into b.
    await pressUntil(a, 'ArrowDown', () => pos('group:c1::b').y === 0);
    const expected = { a: STEP, b: 0, c: STEP * 2 };
    const shown = () => ({ a: pos('group:c1::a').y, b: pos('group:c1::b').y, c: pos('group:c1::c').y });
    await waitFor(() => expect(shown()).toEqual(expected));
    await waitFor(() => expect(writes('graph-positions-collection').length).toBeGreaterThan(0), { timeout: 1000 });
    const all = writes('graph-positions-collection');
    expect(Object.keys(all[all.length - 1] as object).sort()).toEqual(['group:c1::a', 'group:c1::b']);

    // Any rebuild (here: a fresh filter object) lays out from the record.
    setContext(new Set(ALL_GROUPS));
    view.rerender(<GroupedGraph />);
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    expect(shown()).toEqual(expected);

    // Filter a out: c (unstored) closes up under b.
    setContext(new Set(['c1::b', 'c1::c', 'c2::x']));
    view.rerender(<GroupedGraph />);
    await waitFor(() => expect(pos('group:c1::c').y).toBe(STEP));
  });

  it('a push keeps the full gap to the next card, and nothing is written', async () => {
    // b runs 10px into a; c sits clear of b, but b's push lands 6px from it.
    await mount({
      settings: { gapY: 24 },
      positions: {
        'group:c1::a': { x: 0, y: 0 },
        'group:c1::b': { x: 0, y: CARD - 10 },
        'group:c1::c': { x: 0, y: CARD * 2 + 30 },
        'group:c2::x': { x: 400, y: 0 },
      },
    });
    await waitFor(() => expect(pos('group:c1::b').y).toBe(CARD + 24));
    expect(pos('group:c1::c').y).toBe(CARD * 2 + 48);
    expect(writes('graph-positions')).toEqual([]);
  });
});

// A drop that passes a box in its column swaps with it, like a reorder: the
// column stays packed. A drop that only runs into a box without passing it
// stays where it lands, and the box goes down to the gap below it.
describe('a drop that passes a box swaps with it', () => {
  // a, b, c stacked at the gap in c1's column; x alone in the next one.
  const stacked = {
    'group:c1::a': { x: 0, y: 0 },
    'group:c1::b': { x: 0, y: CARD + 24 },
    'group:c1::c': { x: 0, y: (CARD + 24) * 2 },
    'group:c2::x': { x: 400, y: 0 },
  };
  const STEP = CARD + 24;
  const shown = () => ({ a: pos('group:c1::a').y, b: pos('group:c1::b').y, c: pos('group:c1::c').y });
  const lastWrite = (key: string) => {
    const all = writes(key);
    return all[all.length - 1] as Record<string, { x: number; y: number }>;
  };

  it('up by arrow keys: the press that runs into the card above swaps the two, and the next press moves on', async () => {
    await mount({ settings: { gapY: 24 }, positions: stacked });
    const b = nodeEl('group:c1::b')!;
    fireEvent.keyDown(b, { key: 'Enter' });
    // Up 8px a press: across the 24px gap, then the press into a swaps.
    await pressUntil(b, 'ArrowUp', () => pos('group:c1::b').y < CARD);
    await waitFor(() => expect(shown()).toEqual({ a: STEP, b: 0, c: STEP * 2 }));
    // The next press moves b on up; a stays.
    fireEvent.keyDown(b, { key: 'ArrowUp' });
    await waitFor(() => expect(pos('group:c1::b').y).toBe(-8));
    expect(pos('group:c1::a').y).toBe(STEP);
    expect(pos('group:c2::x')).toMatchObject({ x: 400, y: 0 });

    await waitFor(() => expect(writes('graph-positions').length).toBeGreaterThan(0), { timeout: 1000 });
    const saved = lastWrite('graph-positions');
    expect(saved['group:c1::b'].y).toBe(-8);
    expect(saved['group:c1::a'].y).toBe(STEP);
    expect(saved['group:c1::c'].y).toBe(STEP * 2);
  });

  it('up by mouse: a drop onto the lower part of the card above swaps the two, no hole left', async () => {
    await mount({ settings: { gapY: 24 }, positions: stacked });
    // b's top lands 40px below a's.
    mouseDrag('group:c1::b', -(CARD - 16));
    await waitFor(() => expect(shown()).toEqual({ a: STEP, b: 0, c: STEP * 2 }));
    await waitFor(() => expect(writes('graph-positions').length).toBeGreaterThan(0), { timeout: 1000 });
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    expect(shown()).toEqual({ a: STEP, b: 0, c: STEP * 2 });
  });

  it('down by mouse: a drop into the upper part of the card below swaps the two (the mirror of up)', async () => {
    await mount({ settings: { gapY: 24 }, positions: stacked });
    // a's top lands 40px above b's: a's bottom is inside b.
    mouseDrag('group:c1::a', STEP - 40);
    await waitFor(() => expect(shown()).toEqual({ a: STEP, b: 0, c: STEP * 2 }));
  });

  it('down by mouse: a drop whose bottom reaches the card after next passes both', async () => {
    await mount({ settings: { gapY: 24 }, positions: stacked });
    // a's top lands 40px below b's, its bottom inside c.
    mouseDrag('group:c1::a', STEP + 40);
    await waitFor(() => expect(shown()).toEqual({ a: STEP * 2, b: 0, c: STEP }));
  });

  it('down by keys: the card walks down one card every few presses, the column never grows', async () => {
    await mount({ settings: { gapY: 24 }, positions: stacked });
    const a = nodeEl('group:c1::a')!;
    fireEvent.keyDown(a, { key: 'Enter' });
    await pressUntil(a, 'ArrowDown', () => pos('group:c1::c').y === STEP, 40);
    // Past b and then c: they took the slots above, packed at the gap.
    expect(pos('group:c1::b').y).toBe(0);
    await waitFor(() => expect(pos('group:c1::a').y).toBe(STEP * 2));
  });

  it('a multi-selection swaps as one block, keeping its offsets', async () => {
    // c on top, then a and b: a and b move up together into c.
    await mount({
      settings: { gapY: 24 },
      positions: {
        ...stacked,
        'group:c1::c': { x: 0, y: 0 },
        'group:c1::a': { x: 0, y: STEP },
        'group:c1::b': { x: 0, y: STEP * 2 },
      },
    });
    const a = nodeEl('group:c1::a')!;
    const b = nodeEl('group:c1::b')!;
    fireEvent.keyDown(a, { key: 'Enter' });
    fireEvent.keyUp(a, { key: 'Enter' });
    // Add b to the selection with the multi-selection key (Control off a Mac) held.
    fireEvent.keyDown(document, { key: 'Control', code: 'ControlLeft', ctrlKey: true });
    fireEvent.keyDown(b, { key: 'Enter', ctrlKey: true });
    fireEvent.keyUp(b, { key: 'Enter', ctrlKey: true });
    fireEvent.keyUp(document, { key: 'Control', code: 'ControlLeft' });
    await waitFor(() => expect(document.querySelectorAll('.react-flow__node.selected').length).toBe(2));
    // Both move up together until a runs into c: a takes c's top.
    await pressUntil(b, 'ArrowUp', () => pos('group:c1::a').y < CARD);
    await waitFor(() => expect(pos('group:c1::a').y).toBe(0));
    const offset = pos('group:c1::b').y - pos('group:c1::a').y;
    // Each snaps to the 8px grid on its own, so the offset is b's after the presses.
    expect(offset).toBeGreaterThan(CARD);
    await waitFor(() => expect(pos('group:c1::c').y).toBe(offset + CARD + 24));
  });

  it('a frame dropped onto the card above swaps with it; its cards ride along', async () => {
    // c1's frame holds a, b and c; x sits above it in the same column.
    await mount({
      settings: { gapY: 40 },
      groupedPaths: ['c1::'],
      positions: { 'group:c2::x': { x: 0, y: 0 }, 'wrapper:c1::': { x: 0, y: CARD + 40 } },
    });
    mouseDrag('wrapper:c1::', -(CARD + 16));
    await waitFor(() => expect(pos('wrapper:c1::').y).toBe(0));
    const f = pos('wrapper:c1::');
    await waitFor(() => expect(pos('group:c2::x').y).toBe(f.height + 40));
    expect(pos('group:c1::a').y).toBeLessThan(f.height);
  });

  it('Collection mode: up stores the swapped pair only, keeps the column x, and a reload shows the same layout', async () => {
    const view = await mount({ settings: { sortBy: 'collection', gapY: 24 } });
    const b = nodeEl('group:c1::b')!;
    const x = pos('group:c1::b').x;
    fireEvent.keyDown(b, { key: 'Enter' });
    fireEvent.keyDown(b, { key: 'ArrowRight' });
    await pressUntil(b, 'ArrowUp', () => pos('group:c1::b').y < CARD);
    const expected = { a: STEP, b: 0, c: STEP * 2 };
    await waitFor(() => expect(shown()).toEqual(expected));
    expect(pos('group:c1::b').x).toBe(x);
    expect(pos('group:c1::a').x).toBe(x);

    await waitFor(() => expect(writes('graph-positions-collection').length).toBeGreaterThan(0), { timeout: 1000 });
    const record = lastWrite('graph-positions-collection');
    // c and the root card never moved: they stay unstored.
    expect(Object.keys(record).sort()).toEqual(['group:c1::a', 'group:c1::b']);

    view.unmount();
    posted.length = 0;
    await mount({ settings: { sortBy: 'collection', gapY: 24 }, collectionPositions: record });
    await waitFor(() => expect(shown()).toEqual(expected));
    expect(writes('graph-positions-collection')).toEqual([]);
  });

  it('Collection mode: down stores the swapped pair only, a reload shows the same layout, and a filter re-flows the rest', async () => {
    const view = await mount({ settings: { sortBy: 'collection', gapY: 24 } });
    mouseDrag('group:c1::a', STEP - 40);
    const expected = { a: STEP, b: 0, c: STEP * 2 };
    await waitFor(() => expect(shown()).toEqual(expected));
    await waitFor(() => expect(writes('graph-positions-collection').length).toBeGreaterThan(0), { timeout: 1000 });
    const record = lastWrite('graph-positions-collection');
    expect(Object.keys(record).sort()).toEqual(['group:c1::a', 'group:c1::b']);

    // Filter a out: c (unstored) closes up under b.
    setContext(new Set(['c1::b', 'c1::c', 'c2::x']));
    view.rerender(<GroupedGraph />);
    await waitFor(() => expect(pos('group:c1::c').y).toBe(STEP));

    view.unmount();
    posted.length = 0;
    await mount({ settings: { sortBy: 'collection', gapY: 24 }, collectionPositions: record });
    await waitFor(() => expect(shown()).toEqual(expected));
    expect(writes('graph-positions-collection')).toEqual([]);
  });

  it('Tier mode: a reload from the saved record shows the same layout', async () => {
    const view = await mount({ settings: { gapY: 24 }, positions: stacked });
    const b = nodeEl('group:c1::b')!;
    fireEvent.keyDown(b, { key: 'Enter' });
    await pressUntil(b, 'ArrowUp', () => pos('group:c1::b').y < CARD);
    const expected = { a: STEP, b: 0, c: STEP * 2 };
    await waitFor(() => expect(shown()).toEqual(expected));
    await waitFor(() => expect(writes('graph-positions').length).toBeGreaterThan(0), { timeout: 1000 });
    const record = lastWrite('graph-positions');

    view.unmount();
    posted.length = 0;
    await mount({ settings: { gapY: 24 }, positions: record });
    await waitFor(() => expect(shown()).toEqual(expected));
    expect(writes('graph-positions')).toEqual([]);
  });
});
