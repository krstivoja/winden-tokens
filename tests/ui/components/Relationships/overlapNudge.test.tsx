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
  it('resolves on the spot, and the push is saved with the drop', async () => {
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
    // Select a, then move it down by keyboard (one snap step a press) until
    // its bottom runs into b; b's top is still lower, so b moves.
    const a = nodeEl('group:c1::a')!;
    fireEvent.keyDown(a, { key: 'Enter' });
    fireEvent.keyDown(a, { key: 'ArrowDown' });
    await waitFor(() => expect(pos('group:c1::a').y).toBeGreaterThan(4));
    const aY = pos('group:c1::a').y;
    await waitFor(() => expect(pos('group:c1::b').y).toBe(aY + CARD + 24));
    expect(pos('group:c1::c').y).toBe(1000);
    await waitFor(() => expect(writes('graph-positions').length).toBe(1), { timeout: 1000 });
    const saved = writes('graph-positions')[0] as Record<string, { y: number }>;
    expect(saved['group:c1::a'].y).toBe(aY);
    expect(saved['group:c1::b'].y).toBe(aY + CARD + 24);
    expect(saved['group:c1::c'].y).toBe(1000);
  });

  it('Collection mode stores only the moved card, and a rebuild makes the same pushes', async () => {
    const view = await mount({ settings: { sortBy: 'collection', gapY: 24 } });
    const a = nodeEl('group:c1::a')!;
    fireEvent.keyDown(a, { key: 'Enter' });
    // Down until a's bottom runs past b's top (b sits the gap, 24px, below).
    for (let i = 0; i < 4; i++) fireEvent.keyDown(a, { key: 'ArrowDown' });
    await waitFor(() => expect(pos('group:c1::a').y).toBeGreaterThan(24));
    const aY = pos('group:c1::a').y;
    const expected = {
      a: aY,
      b: aY + CARD + 24,
      // b's push lands on c, which moves too.
      c: aY + (CARD + 24) * 2,
    };
    const shown = () => ({ a: pos('group:c1::a').y, b: pos('group:c1::b').y, c: pos('group:c1::c').y });
    await waitFor(() => expect(shown()).toEqual(expected));
    await waitFor(() => expect(writes('graph-positions-collection').length).toBe(1), { timeout: 1000 });
    expect(Object.keys(writes('graph-positions-collection')[0] as object)).toEqual(['group:c1::a']);

    // Any rebuild (here: a fresh filter object) lays out from the record.
    setContext(new Set(ALL_GROUPS));
    view.rerender(<GroupedGraph />);
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    expect(shown()).toEqual(expected);
  });
});
