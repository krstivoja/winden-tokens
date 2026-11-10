// The layout effect's rebuild reconciliation: carryMeasured keeps xyflow's
// measurement across a rebuild, reconcileNodes / reconcileEdges hand back the
// previous object for every element whose content did not change.

import { describe, it, expect } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import {
  carryMeasured,
  isStructurallyEqual,
  reconcileEdges,
  reconcileNodes,
} from '../../../../src/ui/components/Relationships/GroupedGraph/utils';

const onClick = () => {};

const card = (id: string, extra: Partial<Node> = {}, data: Record<string, unknown> = {}): Node => ({
  id,
  type: 'groupNode',
  position: { x: 0, y: 0 },
  hidden: false,
  data: {
    group: { key: id, variables: [{ id: `${id}-v`, name: `${id}/one`, value: '1' }] },
    connectedVars: new Map([[`${id}/one`, { hasInput: true, hasOutput: false }]]),
    highlightedVars: new Set<string>(),
    isDimmed: false,
    onClick,
    ...data,
  },
  dragHandle: '.group-header',
  ...extra,
});

/** A node as xyflow holds it after measuring: a copy with `measured`. */
const measured = (node: Node, size = { width: 260, height: 120 }): Node => ({ ...node, measured: size });

describe('carryMeasured', () => {
  it('carries the measurement for the same id, type and size', () => {
    const prev = measured(card('a'));
    const next = card('a', {}, { isDimmed: true });
    const out = carryMeasured(prev, next);
    expect(out.measured).toEqual({ width: 260, height: 120 });
    expect(out.data).toBe(next.data);
    expect(out).not.toBe(next);
  });

  it('does not carry without a previous node or measurement', () => {
    const next = card('a');
    expect(carryMeasured(undefined, next)).toBe(next);
    expect(carryMeasured(card('a'), next)).toBe(next);
  });

  it('does not carry when either node is hidden', () => {
    const next = card('a');
    expect(carryMeasured(measured(card('a', { hidden: true })), next)).toBe(next);
    const hiddenNext = card('a', { hidden: true });
    expect(carryMeasured(measured(card('a')), hiddenNext)).toBe(hiddenNext);
  });

  it('does not carry when the type or an explicit style size changed', () => {
    const next = card('a');
    expect(carryMeasured(measured(card('a', { type: 'groupWrapper' })), next)).toBe(next);
    const frame = (width: number, height: number) => card('f', { type: 'groupWrapper', style: { width, height } });
    const grown = frame(300, 500);
    expect(carryMeasured(measured(frame(300, 400)), grown)).toBe(grown);
    const wider = frame(320, 400);
    expect(carryMeasured(measured(frame(300, 400)), wider)).toBe(wider);
    expect(carryMeasured(measured(frame(300, 400)), frame(300, 400)).measured).toEqual({ width: 260, height: 120 });
  });

  it('never mutates its inputs', () => {
    const prev = measured(card('a'));
    const next = card('a', {}, { isDimmed: true });
    carryMeasured(prev, next);
    expect('measured' in next).toBe(false);
    expect(prev.measured).toEqual({ width: 260, height: 120 });
  });
});

describe('reconcileNodes', () => {
  it('keeps the previous object for an unchanged node, even when rebuilt from fresh objects', () => {
    const prev = [measured(card('a')), measured(card('b'))];
    // Fresh objects everywhere: data, group, Map, Set, position.
    const next = [card('a'), card('b')];
    const out = reconcileNodes(prev, next);
    // Nothing changed at all: the very same array, so the update is a no-op.
    expect(out).toBe(prev);
  });

  it('gives a changed node a new object with its measurement, and keeps the rest', () => {
    const prev = [measured(card('a')), measured(card('b')), measured(card('c'))];
    const next = [card('a'), card('b', {}, { isDimmed: true }), card('c', { position: { x: 10, y: 0 } })];
    const out = reconcileNodes(prev, next);
    expect(out).not.toBe(prev);
    expect(out[0]).toBe(prev[0]);
    expect(out[1]).not.toBe(prev[1]);
    expect(out[1].data).toBe(next[1].data);
    expect(out[1].measured).toEqual({ width: 260, height: 120 });
    expect(out[2].position).toEqual({ x: 10, y: 0 });
    expect(out[2].measured).toEqual({ width: 260, height: 120 });
  });

  it('sees a change deep inside data: a row value, a highlighted row, a connection', () => {
    const prev = [measured(card('a'))];
    const value = card('a', {}, { group: { key: 'a', variables: [{ id: 'a-v', name: 'a/one', value: '2' }] } });
    expect(reconcileNodes(prev, [value])[0]).not.toBe(prev[0]);
    const highlighted = card('a', {}, { highlightedVars: new Set(['a/one']) });
    expect(reconcileNodes(prev, [highlighted])[0]).not.toBe(prev[0]);
    const connected = card('a', {}, { connectedVars: new Map([['a/one', { hasInput: true, hasOutput: true }]]) });
    expect(reconcileNodes(prev, [connected])[0]).not.toBe(prev[0]);
  });

  it('treats a new callback identity as a change', () => {
    const prev = [measured(card('a'))];
    const out = reconcileNodes(prev, [card('a', {}, { onClick: () => {} })]);
    expect(out[0]).not.toBe(prev[0]);
  });

  it('hidden toggles get a new object without a carried measurement', () => {
    const prev = [measured(card('a'))];
    const out = reconcileNodes(prev, [card('a', { hidden: true })]);
    expect(out[0].hidden).toBe(true);
    expect(out[0].measured).toBeUndefined();
  });

  it('ignores cleared xyflow flags, but a still-set selection is a change the rebuild clears', () => {
    const cleared = [{ ...measured(card('a')), selected: false, dragging: false }];
    expect(reconcileNodes(cleared, [card('a')])).toBe(cleared);
    const selected = [{ ...measured(card('a')), selected: true }];
    const out = reconcileNodes(selected, [card('a')]);
    expect(out[0]).not.toBe(selected[0]);
    expect(out[0].selected).toBeUndefined();
  });

  it('follows the new order and membership', () => {
    const prev = [measured(card('a')), measured(card('b'))];
    const reordered = reconcileNodes(prev, [card('b'), card('a')]);
    expect(reordered).not.toBe(prev);
    expect(reordered[0]).toBe(prev[1]);
    expect(reordered[1]).toBe(prev[0]);
    const added = reconcileNodes(prev, [card('a'), card('b'), card('c')]);
    expect(added[0]).toBe(prev[0]);
    expect(added[2].id).toBe('c');
    expect(added[2].measured).toBeUndefined();
    const removed = reconcileNodes(prev, [card('b')]);
    expect(removed).toEqual([prev[1]]);
  });

  it('never mutates the previous or the rebuilt nodes', () => {
    const prev = [measured(card('a'))];
    const next = [card('a', {}, { isDimmed: true })];
    reconcileNodes(prev, next);
    expect('measured' in next[0]).toBe(false);
    expect((prev[0].data as { isDimmed: boolean }).isDimmed).toBe(false);
  });
});

describe('reconcileEdges', () => {
  const edge = (id: string, data: Record<string, unknown> = {}): Edge => ({
    id, source: 'a', target: 'b', sourceHandle: 'x::out', targetHandle: 'y::in', type: 'customEdge', hidden: false,
    data: { kind: 'reference', isDimmed: false, onDisconnect: onClick, ...data },
  });

  it('keeps unchanged edges and replaces changed ones', () => {
    const prev = [edge('1'), edge('2')];
    expect(reconcileEdges(prev, [edge('1'), edge('2')])).toBe(prev);
    const out = reconcileEdges(prev, [edge('1'), edge('2', { isDimmed: true })]);
    expect(out[0]).toBe(prev[0]);
    expect(out[1]).not.toBe(prev[1]);
    expect((out[1].data as { isDimmed: boolean }).isDimmed).toBe(true);
  });
});

describe('isStructurallyEqual', () => {
  it('compares plain data by content and everything else by identity', () => {
    expect(isStructurallyEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(isStructurallyEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(isStructurallyEqual(new Set(['x']), new Set(['x']))).toBe(true);
    expect(isStructurallyEqual(new Set(['x']), new Set(['y']))).toBe(false);
    expect(isStructurallyEqual(new Map([['k', { v: 1 }]]), new Map([['k', { v: 1 }]]))).toBe(true);
    expect(isStructurallyEqual(new Map([['k', { v: 1 }]]), new Map([['k', { v: 2 }]]))).toBe(false);
    expect(isStructurallyEqual([1], { 0: 1 })).toBe(false);
    expect(isStructurallyEqual(() => {}, () => {})).toBe(false);
    expect(isStructurallyEqual(new Date(0), new Date(0))).toBe(false);
  });
});
