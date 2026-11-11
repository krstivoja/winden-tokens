import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import type { CollectionData, StoredCollectionOrder, VariableData } from '../../../src/ui/types';

const postMock = vi.hoisted(() => vi.fn());

vi.mock('../../../src/ui/hooks/usePluginMessages', () => ({
  usePluginMessages: () => undefined,
  post: postMock,
}));

import {
  COLLECTION_ORDER_ACK_TIMEOUT_MS,
  DataProvider,
  useDataContext,
} from '../../../src/ui/context/DataContext';

type Ctx = ReturnType<typeof useDataContext>;

function renderProbe() {
  const ref: { current: Ctx | null } = { current: null };
  function Probe() {
    ref.current = useDataContext();
    return null;
  }
  render(<DataProvider><Probe /></DataProvider>);
  return () => ref.current as Ctx;
}

const col = (id: string, name: string): CollectionData => ({ id, name, modes: [{ modeId: `${id}-m`, name: 'Default' }] });
const v = (id: string, collectionId: string): VariableData => ({
  id,
  collectionId,
  name: id,
  resolvedType: 'COLOR',
  value: '#000000',
  valuesByMode: {},
});
const order = (...entries: Array<[string, string]>): StoredCollectionOrder => ({
  v: 1,
  entries: entries.map(([id, name]) => ({ id, name })),
});

const collections = [col('1', 'global'), col('2', 'color'), col('3', 'components'), col('4', 'dimensions')];
const variables = [v('g1', '1'), v('c1', '2'), v('c2', '2'), v('k1', '3'), v('d1', '4'), v('d2', '4')];
const stored = order(['4', 'dimensions'], ['2', 'color'], ['1', 'global'], ['3', 'components']);

beforeEach(() => {
  postMock.mockReset();
});

describe('DataContext collection order', () => {
  it('keeps API order when setData is called without an order', () => {
    const ctx = renderProbe();
    act(() => ctx().setData(collections, variables, []));
    expect(ctx().collections.map(x => x.name)).toEqual(['global', 'color', 'components', 'dimensions']);
    expect(ctx().variables).toBe(variables);
    expect(ctx().selectedCollectionId).toBe('1');
  });

  it('orders collections and groups variables by rank', () => {
    const ctx = renderProbe();
    act(() => ctx().setData(collections, variables, [], stored));
    expect(ctx().collections.map(x => x.name)).toEqual(['dimensions', 'color', 'global', 'components']);
    expect(ctx().variables.map(x => x.id)).toEqual(['d1', 'd2', 'c1', 'c2', 'g1', 'k1']);
  });

  it('defaults selectedCollectionId to the first resolved collection', () => {
    const ctx = renderProbe();
    act(() => ctx().setData(collections, variables, [], stored));
    expect(ctx().selectedCollectionId).toBe('4');
  });

  it('keeps identities stable across unrelated re-renders', () => {
    const ctx = renderProbe();
    act(() => ctx().setData(collections, variables, [], stored));
    const before = { collections: ctx().collections, variables: ctx().variables };
    act(() => ctx().setSelectedCollectionId('2'));
    expect(ctx().collections).toBe(before.collections);
    expect(ctx().variables).toBe(before.variables);
  });

  it('reorderCollections updates at once and posts a v1 order', () => {
    const ctx = renderProbe();
    act(() => ctx().setData(collections, variables, []));
    act(() => ctx().reorderCollections(['1', '2', '4', '3']));
    expect(ctx().collections.map(x => x.name)).toEqual(['global', 'color', 'dimensions', 'components']);
    expect(ctx().variables.map(x => x.id)).toEqual(['g1', 'c1', 'c2', 'd1', 'd2', 'k1']);
    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock).toHaveBeenCalledWith({
      type: 'set-collection-order',
      order: order(['1', 'global'], ['2', 'color'], ['4', 'dimensions'], ['3', 'components']),
      requestId: expect.any(String),
    });
  });

  it('reorderCollections with the current order posts nothing', () => {
    const ctx = renderProbe();
    act(() => ctx().setData(collections, variables, [], stored));
    act(() => ctx().reorderCollections(['4', '2', '1', '3']));
    expect(postMock).not.toHaveBeenCalled();
  });

  it('a data-loaded after the reorder is settled shows the stored order', () => {
    const ctx = renderProbe();
    act(() => ctx().setData(collections, variables, []));
    act(() => ctx().reorderCollections(['4', '3', '2', '1']));
    act(() => ctx().settleCollectionOrder(lastRequestId()));
    act(() => ctx().setData(collections, variables, [], null));
    expect(ctx().collections.map(x => x.id)).toEqual(['1', '2', '3', '4']);
  });

  it('keeps the order after undo recreates every id with the same names', () => {
    const ctx = renderProbe();
    act(() => ctx().setData(collections, variables, [], stored));
    const recreated = collections.map(x => col(`n${x.id}`, x.name));
    const recreatedVars = variables.map(x => v(`n${x.id}`, `n${x.collectionId}`));
    // The stored entries still carry the old ids.
    act(() => ctx().setData(recreated, recreatedVars, [], stored));
    expect(ctx().collections.map(x => x.name)).toEqual(['dimensions', 'color', 'global', 'components']);
    expect(ctx().variables.map(x => x.id)).toEqual(['nd1', 'nd2', 'nc1', 'nc2', 'ng1', 'nk1']);
    expect(ctx().selectedCollectionId).toBe('n4');
  });
});

// Messages posted so far, as the sandbox would receive them.
const posted = () => postMock.mock.calls.map(([msg]) => msg as {
  type: string;
  order: StoredCollectionOrder;
  requestId: string;
});
const lastRequestId = () => posted()[posted().length - 1].requestId;
const ids = (o: StoredCollectionOrder) => o.entries.map(e => e.id).join('');

// The sandbox's reply to one `set-collection-order`: `data-loaded` with the
// stored order, then `update-success` / `update-error` echoing the request id.
function reply(ctx: () => Ctx, stored: StoredCollectionOrder | null, requestId: string, data = collections) {
  act(() => ctx().setData(data, variables, [], stored));
  act(() => ctx().settleCollectionOrder(requestId));
}

// Alt+ArrowDown on a collection row: move it one place down, from what the
// sidebar currently shows.
function moveDown(ctx: () => Ctx, id: string) {
  const current = ctx().collections.map(x => x.id);
  const index = current.indexOf(id);
  const next = [...current];
  next.splice(index, 1);
  next.splice(index + 1, 0, id);
  act(() => ctx().reorderCollections(next));
}

describe('DataContext pending collection reorders', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('tags each set-collection-order with a distinct request id', () => {
    const ctx = renderProbe();
    act(() => ctx().setData(collections, variables, []));
    moveDown(ctx, '1');
    moveDown(ctx, '1');
    const [a, b] = posted();
    expect(typeof a.requestId).toBe('string');
    expect(a.requestId).not.toBe(b.requestId);
  });

  it('reverts to the stored order when the save fails', () => {
    const ctx = renderProbe();
    act(() => ctx().setData(collections, variables, []));
    moveDown(ctx, '1');
    expect(ctx().collections.map(x => x.id)).toEqual(['2', '1', '3', '4']);
    // View-only file: the sandbox re-sends the unchanged data, then update-error.
    reply(ctx, null, lastRequestId());
    expect(ctx().collections.map(x => x.id)).toEqual(['1', '2', '3', '4']);
    expect(ctx().variables).toBe(variables);
  });

  it('reverts on a failure ack even when no data-loaded comes with it', () => {
    const ctx = renderProbe();
    act(() => ctx().setData(collections, variables, [], stored));
    moveDown(ctx, '4');
    act(() => ctx().settleCollectionOrder(lastRequestId()));
    expect(ctx().collections.map(x => x.id)).toEqual(['4', '2', '1', '3']);
  });

  it('keeps the optimistic order while a data-loaded arrives before the ack', () => {
    const ctx = renderProbe();
    act(() => ctx().setData(collections, variables, []));
    moveDown(ctx, '1');
    // A poll or another mutation re-sends the old stored order meanwhile.
    act(() => ctx().setData(collections, variables, [], null));
    expect(ctx().collections.map(x => x.id)).toEqual(['2', '1', '3', '4']);
  });

  it('does not lose moves when replies to earlier presses arrive late', () => {
    const ctx = renderProbe();
    act(() => ctx().setData(collections, variables, []));
    moveDown(ctx, '1'); // 2134
    moveDown(ctx, '1'); // 2314
    const [first, second] = posted();
    // The reply to press 1 arrives now, carrying press 1's order.
    reply(ctx, first.order, first.requestId);
    expect(ctx().collections.map(x => x.id)).toEqual(['2', '3', '1', '4']);
    moveDown(ctx, '1'); // 2341
    expect(posted().map(m => ids(m.order))).toEqual(['2134', '2314', '2341']);
    const third = posted()[2];
    reply(ctx, second.order, second.requestId);
    expect(ctx().collections.map(x => x.id)).toEqual(['2', '3', '4', '1']);
    reply(ctx, third.order, third.requestId);
    expect(ctx().collections.map(x => x.id)).toEqual(['2', '3', '4', '1']);
  });

  it('handles acks that arrive out of order', () => {
    const ctx = renderProbe();
    act(() => ctx().setData(collections, variables, []));
    moveDown(ctx, '1');
    moveDown(ctx, '1');
    const [first, second] = posted();
    act(() => ctx().setData(collections, variables, [], first.order));
    act(() => ctx().setData(collections, variables, [], second.order));
    // The ack for press 2 lands before the ack for press 1.
    act(() => ctx().settleCollectionOrder(second.requestId));
    expect(ctx().collections.map(x => x.id)).toEqual(['2', '3', '1', '4']);
    act(() => ctx().settleCollectionOrder(first.requestId));
    expect(ctx().collections.map(x => x.id)).toEqual(['2', '3', '1', '4']);
  });

  it('shows the last data-loaded once nothing is pending', () => {
    const ctx = renderProbe();
    act(() => ctx().setData(collections, variables, []));
    moveDown(ctx, '1');
    const [first] = posted();
    // A collaborator's reorder lands after ours and wins (last write wins).
    act(() => ctx().setData(collections, variables, [], first.order));
    act(() => ctx().setData(collections, variables, [], stored));
    act(() => ctx().settleCollectionOrder(first.requestId));
    expect(ctx().collections.map(x => x.id)).toEqual(['4', '2', '1', '3']);
  });

  it('applies a collection-set change while a reorder is pending', () => {
    const ctx = renderProbe();
    act(() => ctx().setData(collections, variables, []));
    moveDown(ctx, '1'); // 2134
    // Elsewhere: '3' deleted, '5' created, '2' renamed.
    const changed = [col('1', 'global'), col('2', 'colors'), col('4', 'dimensions'), col('5', 'motion')];
    act(() => ctx().setData(changed, variables, [], null));
    expect(ctx().collections.map(x => x.id)).toEqual(['2', '1', '4', '5']);
    expect(ctx().collections[0].name).toBe('colors');
    // The next press builds on the live set.
    moveDown(ctx, '4');
    expect(ids(posted()[1].order)).toBe('2154');
    expect(posted()[1].order.entries[0].name).toBe('colors');
  });

  it('ignores acks for request ids it did not send', () => {
    const ctx = renderProbe();
    act(() => ctx().setData(collections, variables, []));
    moveDown(ctx, '1');
    act(() => ctx().setData(collections, variables, [], null));
    act(() => ctx().settleCollectionOrder('someone-else'));
    act(() => ctx().settleCollectionOrder(undefined));
    expect(ctx().collections.map(x => x.id)).toEqual(['2', '1', '3', '4']);
  });

  it('falls back to the stored order when no ack ever comes (older plugin build)', () => {
    vi.useFakeTimers();
    const ctx = renderProbe();
    act(() => ctx().setData(collections, variables, [], stored));
    moveDown(ctx, '4');
    act(() => vi.advanceTimersByTime(COLLECTION_ORDER_ACK_TIMEOUT_MS - 1));
    expect(ctx().collections.map(x => x.id)).toEqual(['2', '4', '1', '3']);
    act(() => vi.advanceTimersByTime(1));
    expect(ctx().collections.map(x => x.id)).toEqual(['4', '2', '1', '3']);
  });

  it('restarts the ack timeout on every press', () => {
    vi.useFakeTimers();
    const ctx = renderProbe();
    act(() => ctx().setData(collections, variables, []));
    moveDown(ctx, '1');
    act(() => vi.advanceTimersByTime(COLLECTION_ORDER_ACK_TIMEOUT_MS - 100));
    moveDown(ctx, '1');
    act(() => vi.advanceTimersByTime(COLLECTION_ORDER_ACK_TIMEOUT_MS - 100));
    expect(ctx().collections.map(x => x.id)).toEqual(['2', '3', '1', '4']);
    act(() => vi.advanceTimersByTime(100));
    expect(ctx().collections.map(x => x.id)).toEqual(['1', '2', '3', '4']);
  });

  it('a settled reorder does not fire the timeout later', () => {
    vi.useFakeTimers();
    const ctx = renderProbe();
    act(() => ctx().setData(collections, variables, []));
    moveDown(ctx, '1');
    const [first] = posted();
    reply(ctx, first.order, first.requestId);
    act(() => vi.advanceTimersByTime(COLLECTION_ORDER_ACK_TIMEOUT_MS * 2));
    expect(ctx().collections.map(x => x.id)).toEqual(['2', '1', '3', '4']);
  });

  it('defaults the selection from the shown order while a reorder is pending', () => {
    const ctx = renderProbe();
    act(() => ctx().setData(collections, variables, []));
    moveDown(ctx, '1'); // 2134
    // Selected collection '1' disappears; the first shown one is picked.
    act(() => ctx().setData(collections.filter(x => x.id !== '1'), variables, [], null));
    expect(ctx().selectedCollectionId).toBe('2');
  });
});
