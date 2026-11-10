// Collection mode = the Tier layout with the collection order inside each
// column (arrangeGroupsByConnectedBlocks `collectionOrder`).

import { describe, it, expect } from 'vitest';
import {
  arrangeGroupsByConnectedBlocks,
  getGroupHeight,
} from '../../../../src/ui/components/Relationships/GroupedGraph/utils';
import { GROUP_WIDTH } from '../../../../src/ui/components/Relationships/GroupedGraph/constants';
import type { ConnectionRecord, GroupData, VariableNode } from '../../../../src/ui/components/Relationships/GroupedGraph/types';

const rows = (n: number): VariableNode[] => Array.from({ length: n }, (_, i) => ({
  id: `v${i}`, name: `x/${i}`, shortName: `${i}`, displayName: '', color: '#fff',
  value: '', resolvedValue: '', isReference: false, referenceName: null,
}));

const unit = (key: string, collectionId: string, over: Partial<GroupData> = {}): GroupData => ({
  key, title: key, variables: rows(1), x: 0, y: 0, initialX: 0, initialY: 0,
  kind: 'standard', sourceGroupName: key, headerFill: '#222', collectionId,
  ...over,
});

const link = (from: string, to: string): ConnectionRecord => ({
  id: `${from}->${to}`, kind: 'reference', fromGroup: from, fromVar: `${from}/v`, toGroup: to, toVar: `${to}/v`,
});

const gapX = 100;
const gapY = 20;
const H = getGroupHeight(unit('h', 'c'));
const order = ['_global', 'color', 'typography'];
const arrange = (units: GroupData[], conns: ConnectionRecord[] = [], collectionOrder?: string[]) =>
  arrangeGroupsByConnectedBlocks(units, conns, gapX, gapY, collectionOrder ? { collectionOrder } : {});
const ys = (positions: Map<string, { x: number; y: number }>, keys: string[]) => keys.map(k => positions.get(k)!.y);

describe('collectionOrder', () => {
  it('stacks a column by collection order first, title second', () => {
    const units = [unit('a', 'typography'), unit('b', 'color'), unit('z', '_global'), unit('c', 'color')];
    const { positions } = arrange(units, [], order);
    expect(ys(positions, ['z', 'b', 'c', 'a'])).toEqual([0, H + gapY, 2 * (H + gapY), 3 * (H + gapY)]);
  });

  it('every column starts at the top and keeps the Tier columns and captions', () => {
    const units = [unit('p1', 'color'), unit('p2', 'color'), unit('p3', 'color'), unit('q', 'typography')];
    const conns = [link('p1', 'q')];
    const tierMode = arrange(units, conns);
    const collectionMode = arrange(units, conns, order);
    expect(collectionMode.positions.get('q')).toEqual({ x: GROUP_WIDTH + gapX, y: 0 });
    expect(collectionMode.tiers).toEqual(tierMode.tiers);
  });

  it('barycenter reordering never crosses a collection boundary', () => {
    // b (color) feeds y, a (_global) feeds x: Tier mode would put y above x
    // when b sits above a; collection order keeps _global first anyway.
    const units = [unit('a', '_global'), unit('b', 'color'), unit('x', 'typography'), unit('y', '_global')];
    const { positions } = arrange(units, [link('a', 'x'), link('b', 'y')], order);
    expect(positions.get('y')!.y).toBeLessThan(positions.get('x')!.y);
  });

  it('places a managed chain on one line in its collection\'s turn', () => {
    const units = [
      unit('g', '_global'),
      unit('source:s', 'color', { kind: 'source', sourceGroupName: 'brand' }),
      unit('shader:s', 'color', { kind: 'shader', sourceGroupName: 'brand' }),
      unit('shades:s', 'color', { kind: 'shades', sourceGroupName: 'brand', variables: rows(4) }),
    ];
    const { positions } = arrange(units, [link('source:s', 'shader:s'), link('shader:s', 'shades:s')], order);
    expect(positions.get('g')!.y).toBe(0);
    const chainY = H + gapY;
    expect(ys(positions, ['source:s', 'shader:s', 'shades:s'])).toEqual([chainY, chainY, chainY]);
  });

  it('absent, the result equals Tier mode exactly', () => {
    const units = [unit('a', 'typography'), unit('b', 'color'), unit('c', '_global')];
    expect(Object.fromEntries(arrange(units).positions)).toEqual(
      Object.fromEntries(arrangeGroupsByConnectedBlocks(units, [], gapX, gapY).positions)
    );
    // Tier mode orders by title regardless of collection.
    expect(ys(arrange(units).positions, ['a', 'b', 'c'])).toEqual([0, H + gapY, 2 * (H + gapY)]);
  });
});
