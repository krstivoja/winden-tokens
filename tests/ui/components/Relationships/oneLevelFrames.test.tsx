// One-level frames: addFrame / flattenGroupedPaths / stripRelPositions, the
// breadcrumb title and the frozen-card header.

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import {
  addFrame,
  flattenGroupedPaths,
  stripRelPositions,
  getCardTitleSegments,
  isAbsorbedCard,
  migrateGraphPositions,
} from '../../../../src/ui/components/Relationships/GroupedGraph/utils';
import { CardHeaderRow } from '../../../../src/ui/components/Relationships/GroupedGraph/GraphNode';
import { GroupWrapperComponent } from '../../../../src/ui/components/Relationships/GroupedGraph/GraphWrapperNode';
import type { GroupData, WrapperNodeData } from '../../../../src/ui/components/Relationships/GroupedGraph/types';

const group = (over: Partial<GroupData>): GroupData => ({
  key: 'group:c1::a', title: 'a', variables: [], x: 0, y: 0, initialX: 0, initialY: 0,
  kind: 'standard', sourceGroupName: 'a', headerFill: '#222', collectionId: 'c1',
  ...over,
});

describe('addFrame', () => {
  it('adds a key to an empty set', () => {
    expect([...addFrame(new Set(), 'c1::a')]).toEqual(['c1::a']);
  });

  it('swallows every deeper frame of the same collection', () => {
    const next = addFrame(new Set(['c1::font/size', 'c1::font/weight/x', 'c1::other', 'c2::font/size']), 'c1::font');
    expect([...next].sort()).toEqual(['c1::font', 'c1::other', 'c2::font/size']);
  });

  it('a collection frame swallows all of its collection, none of another', () => {
    const next = addFrame(new Set(['c1::a', 'c1::b/c', 'c2::a']), 'c1::');
    expect([...next].sort()).toEqual(['c1::', 'c2::a']);
  });

  it('ignores an add under an existing ancestor, or equal to a key, returning the same set', () => {
    const prev = new Set(['c1::font']);
    expect(addFrame(prev, 'c1::font/size')).toBe(prev);
    expect(addFrame(prev, 'c1::font')).toBe(prev);
    const coll = new Set(['c1::']);
    expect(addFrame(coll, 'c1::a')).toBe(coll);
  });

  it('does not treat a name prefix as an ancestor', () => {
    const next = addFrame(new Set(['c1::font']), 'c1::fontsize');
    expect([...next].sort()).toEqual(['c1::font', 'c1::fontsize']);
  });
});

describe('flattenGroupedPaths', () => {
  it('keeps only the outermost key of a nested chain', () => {
    expect(flattenGroupedPaths(['c1::a/b', 'c1::a', 'c1::a/b/c']).sort()).toEqual(['c1::a']);
  });

  it('is order-independent and idempotent', () => {
    const a = flattenGroupedPaths(['c1::a', 'c1::a/b', 'c1::x']);
    const b = flattenGroupedPaths(['c1::x', 'c1::a/b', 'c1::a']);
    expect(a.sort()).toEqual(b.sort());
    expect(flattenGroupedPaths(a)).toEqual(a);
  });

  it('leaves independent collections and flat input untouched', () => {
    const flat = ['c1::a', 'c2::a', 'c1::b'];
    expect(flattenGroupedPaths(flat)).toEqual(flat);
  });

  it('lets a collection frame win over its path frames', () => {
    expect(flattenGroupedPaths(['c1::a', 'c1::', 'c2::b'])).toEqual(['c1::', 'c2::b']);
  });
});

describe('stripRelPositions', () => {
  it('drops rel: keys and keeps absolute ones', () => {
    const pos = { 'group:a': { x: 1, y: 2 }, 'rel:group:b': { x: 3, y: 4 } };
    expect(stripRelPositions(pos)).toEqual({ 'group:a': { x: 1, y: 2 } });
  });

  it('returns the same record when nothing is stripped, and a second load is a no-op', () => {
    const pos = { 'group:a': { x: 1, y: 2 } };
    expect(stripRelPositions(pos)).toBe(pos);
    const once = stripRelPositions({ ...pos, 'rel:x': { x: 0, y: 0 } });
    expect(stripRelPositions(once)).toBe(once);
  });

  it('composes with the position migration', () => {
    const owners = new Map([['a', ['c1']]]);
    const out = stripRelPositions(migrateGraphPositions(
      { 'group:a': { x: 1, y: 1 }, 'rel:group:a': { x: 9, y: 9 } }, owners, owners
    ));
    expect(out).toEqual({ 'group:c1::a': { x: 1, y: 1 } });
  });
});

describe('isAbsorbedCard with one-level frames', () => {
  it('only the outermost key absorbs; a stray inner key absorbs nothing', () => {
    const grouped = new Set(['c1::a', 'c1::a/b']);
    expect(isAbsorbedCard(group({ sourceGroupName: 'a' }), grouped)).toBe(true);
    expect(isAbsorbedCard(group({ sourceGroupName: 'a/b' }), grouped)).toBe(false);
  });
});

describe('getCardTitleSegments', () => {
  it('splits a standard card path', () => {
    expect(getCardTitleSegments(group({ sourceGroupName: 'font/size/body', title: 'font/size/body' })))
      .toEqual(['font', 'size', 'body']);
  });

  it('keeps a single segment, the collection root and managed titles whole', () => {
    expect(getCardTitleSegments(group({ sourceGroupName: 'font', title: 'font' }))).toEqual(['font']);
    expect(getCardTitleSegments(group({ kind: 'collection', sourceGroupName: undefined, title: 'My/Collection' })))
      .toEqual(['My/Collection']);
    expect(getCardTitleSegments(group({ kind: 'shader', sourceGroupName: 'a/b', title: 'Shader' }))).toEqual(['Shader']);
  });
});

describe('CardHeaderRow breadcrumb', () => {
  const renderRow = (props: Partial<React.ComponentProps<typeof CardHeaderRow>> = {}) =>
    render(<CardHeaderRow title="font/size/body" segments={['font', 'size', 'body']} headerFill="#222" {...props} />);

  it('renders one separator between segments, dimmed ancestors and a bold leaf', () => {
    renderRow();
    expect(screen.getAllByTestId('card-title-separator')).toHaveLength(2);
    const ancestors = screen.getAllByTestId('card-title-ancestor');
    expect(ancestors.map(a => a.textContent)).toEqual(['font', 'size']);
    ancestors.forEach(a => expect(a.className).toContain('text-text/60'));
    const leaf = screen.getByTestId('card-title-leaf');
    expect(leaf.textContent).toBe('body');
    expect(leaf.className).toContain('font-semibold');
  });

  it('puts the full slash path in the tooltip', () => {
    renderRow();
    expect(screen.getByTestId('card-title').getAttribute('title')).toBe('font/size/body');
  });

  it('is plain text for a single segment, and without segments', () => {
    const { unmount } = renderRow({ title: 'font', segments: ['font'] });
    expect(screen.queryAllByTestId('card-title-separator')).toHaveLength(0);
    expect(screen.getByTestId('card-title-leaf').textContent).toBe('font');
    unmount();
    renderRow({ title: 'Collection / X', segments: undefined });
    expect(screen.queryAllByTestId('card-title-separator')).toHaveLength(0);
    expect(screen.getByTestId('card-title-leaf').textContent).toBe('Collection / X');
  });

  it('shows the move cursor unless the card is frozen in a frame', () => {
    const { container, unmount } = renderRow();
    expect(container.querySelector('.group-header')!.className).toContain('cursor-move');
    unmount();
    const frozen = renderRow({ draggable: false });
    expect(frozen.container.querySelector('.group-header')!.className).not.toContain('cursor-move');
  });

  it('keeps header actions from shrinking', () => {
    const { container } = renderRow({ children: <button>x</button> });
    expect(container.querySelector('button')!.parentElement!.className).toContain('shrink-0');
  });
});

describe('frame header breadcrumb', () => {
  const renderFrame = (over: Partial<WrapperNodeData>) => {
    const data: WrapperNodeData = {
      path: 'a/b', collectionId: 'c1', title: 'a/b', onLevelUp: () => {}, onUngroup: () => {}, card: null, ...over,
    };
    return render(
      <ReactFlowProvider>
        <GroupWrapperComponent {...({ id: 'w', data } as unknown as React.ComponentProps<typeof GroupWrapperComponent>)} />
      </ReactFlowProvider>
    );
  };

  it('is a breadcrumb for a multi-segment path', () => {
    renderFrame({});
    expect(screen.getAllByTestId('card-title-separator')).toHaveLength(1);
    expect(screen.getByTestId('card-title').getAttribute('title')).toBe('a/b');
  });

  it('is plain for a single segment and for the collection name', () => {
    const { unmount } = renderFrame({ path: 'a', title: 'a' });
    expect(screen.queryAllByTestId('card-title-separator')).toHaveLength(0);
    unmount();
    renderFrame({ path: '', title: 'Brand/Core' });
    expect(screen.queryAllByTestId('card-title-separator')).toHaveLength(0);
    expect(screen.getByTestId('card-title').getAttribute('title')).toBe('Brand/Core');
  });
});
