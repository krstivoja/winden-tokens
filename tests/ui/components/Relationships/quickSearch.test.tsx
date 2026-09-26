import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import {
  GraphSearchPalette,
  matchGraphSearchItems,
  isQuickSearchShortcut,
  isMacPlatform,
} from '../../../../src/ui/components/Relationships/GroupedGraph/GraphSearchPalette';
import type {
  GraphSearchItem,
  GraphSearchTarget,
} from '../../../../src/ui/components/Relationships/GroupedGraph/GraphSearchPalette';

// ── Fixtures ───────────────────────────────────────────────────────

const collection = (id: string, label: string, hidden = false): GraphSearchItem => ({
  id: `collection:${id}`, label, context: '2 cards', hidden,
  target: { kind: 'collection', collectionId: id },
});

const card = (cardKey: string, label: string, context: string, hidden = false): GraphSearchItem => ({
  id: `card:${cardKey}`, label, context, hidden,
  target: { kind: 'card', cardKey },
});

const variable = (cardKey: string, varName: string, context: string, hidden = false): GraphSearchItem => ({
  id: `var:${cardKey}::${varName}`, label: varName, context, hidden,
  target: { kind: 'variable', cardKey, varName },
});

const container = (nodeId: string, label: string, context: string, hidden = false): GraphSearchItem => ({
  id: `container:${nodeId}`, label, context, hidden,
  target: { kind: 'container', nodeId },
});

// A variable, a group and a collection can all be called `test`.
const sameNameItems: GraphSearchItem[] = [
  collection('c1', 'test'),
  card('group:c1::test', 'test', 'Brand'),
  variable('group:c1::test', 'test', 'test · Brand'),
];

// ── Platform ───────────────────────────────────────────────────────

const setPlatform = (platform: string) => {
  Object.defineProperty(window.navigator, 'platform', { value: platform, configurable: true });
};

const keyEvent = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);

describe('isQuickSearchShortcut', () => {
  afterEach(() => setPlatform(''));

  it('takes Cmd+K on macOS and ignores Ctrl+K there', () => {
    setPlatform('MacIntel');
    expect(isMacPlatform()).toBe(true);
    expect(isQuickSearchShortcut(keyEvent({ key: 'k', metaKey: true }))).toBe(true);
    expect(isQuickSearchShortcut(keyEvent({ key: 'k', ctrlKey: true }))).toBe(false);
  });

  it('takes Ctrl+K elsewhere and ignores Cmd+K there', () => {
    setPlatform('Win32');
    expect(isMacPlatform()).toBe(false);
    expect(isQuickSearchShortcut(keyEvent({ key: 'k', ctrlKey: true }))).toBe(true);
    expect(isQuickSearchShortcut(keyEvent({ key: 'k', metaKey: true }))).toBe(false);
  });

  it('leaves the undo shortcuts alone', () => {
    setPlatform('MacIntel');
    expect(isQuickSearchShortcut(keyEvent({ key: 'z', metaKey: true }))).toBe(false);
    expect(isQuickSearchShortcut(keyEvent({ key: 'z', metaKey: true, shiftKey: true }))).toBe(false);
    expect(isQuickSearchShortcut(keyEvent({ key: 'y', metaKey: true }))).toBe(false);
  });

  it('ignores a bare k and Alt+K', () => {
    setPlatform('MacIntel');
    expect(isQuickSearchShortcut(keyEvent({ key: 'k' }))).toBe(false);
    expect(isQuickSearchShortcut(keyEvent({ key: 'k', metaKey: true, altKey: true }))).toBe(false);
  });
});

// ── Matching ───────────────────────────────────────────────────────

describe('matchGraphSearchItems', () => {
  it('lists the collections for an empty query', () => {
    const result = matchGraphSearchItems(
      [...sameNameItems, collection('c2', 'Semantic')],
      ''
    );
    expect(result.isDefault).toBe(true);
    expect(result.results.map(item => item.label)).toEqual(['test', 'Semantic']);
    expect(result.results.every(item => item.target.kind === 'collection')).toBe(true);
  });

  it('keeps all three kinds when the names collide, collection first', () => {
    const { results } = matchGraphSearchItems(sameNameItems, 'test');
    expect(results.map(item => item.target.kind)).toEqual(['collection', 'card', 'variable']);
  });

  it('ranks exact over prefix over substring', () => {
    const items = [
      card('group:c1::a', 'brand/primary', 'Brand'),
      card('group:c1::b', 'brand', 'Brand'),
      card('group:c1::c', 'color/brand', 'Brand'),
    ];
    const { results } = matchGraphSearchItems(items, 'brand');
    expect(results.map(item => item.label)).toEqual(['brand', 'brand/primary', 'color/brand']);
  });

  it('matches the secondary text too, but below any label match', () => {
    const items = [
      card('group:c1::x', 'spacing', 'Brand'),
      card('group:c1::y', 'brand-ish', 'Semantic'),
    ];
    const { results } = matchGraphSearchItems(items, 'brand');
    expect(results.map(item => item.label)).toEqual(['brand-ish', 'spacing']);
  });

  it('never offers a hidden match, and counts it instead', () => {
    const items = [
      card('group:c1::a', 'brand', 'Brand'),
      card('group:c2::a', 'brand', 'Semantic', true),
      variable('group:c2::a', 'brand/red', 'brand · Semantic', true),
    ];
    const { results, hiddenCount } = matchGraphSearchItems(items, 'brand');
    expect(results.map(item => item.id)).toEqual(['card:group:c1::a']);
    expect(hiddenCount).toBe(2);
  });

  it('drops hidden collections from the empty-query list', () => {
    const { results, hiddenCount } = matchGraphSearchItems(
      [collection('c1', 'Brand'), collection('c2', 'Empty', true)],
      ''
    );
    expect(results.map(item => item.label)).toEqual(['Brand']);
    expect(hiddenCount).toBe(1);
  });

  it('honours the result limit', () => {
    const items = Array.from({ length: 60 }, (_, i) => card(`group:c1::${i}`, `brand-${i}`, 'Brand'));
    expect(matchGraphSearchItems(items, 'brand', 10).results).toHaveLength(10);
  });

  it('returns nothing for a query that matches nothing', () => {
    const { results, hiddenCount } = matchGraphSearchItems(sameNameItems, 'zzz');
    expect(results).toEqual([]);
    expect(hiddenCount).toBe(0);
  });
});

// ── Palette ────────────────────────────────────────────────────────

function renderPalette(items: GraphSearchItem[]) {
  const onActivate = vi.fn<[GraphSearchTarget], void>();
  const onClose = vi.fn();
  render(
    <GraphSearchPalette isOpen items={items} onClose={onClose} onActivate={onActivate} />
  );
  const input = screen.getByPlaceholderText('Jump to a collection, card or variable...');
  return { onActivate, onClose, input };
}

const type = (input: HTMLElement, value: string) =>
  fireEvent.change(input, { target: { value } });

describe('GraphSearchPalette', () => {
  it('renders nothing while closed', () => {
    const { container } = render(
      <GraphSearchPalette isOpen={false} items={sameNameItems} onClose={() => {}} onActivate={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('opens on the collections and labels every kind', () => {
    const { input } = renderPalette(sameNameItems);
    expect(screen.getAllByRole('option')).toHaveLength(1);

    type(input, 'test');
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(within(options[0]).getByText('Collection')).toBeInTheDocument();
    expect(within(options[1]).getByText('Card')).toBeInTheDocument();
    expect(within(options[2]).getByText('Variable')).toBeInTheDocument();
  });

  it('shows the collection a result belongs to as secondary text', () => {
    const items = [
      card('group:c1::brand', 'brand', 'Primitives'),
      card('group:c2::brand', 'brand', 'Semantic'),
    ];
    const { input } = renderPalette(items);
    type(input, 'brand');
    const options = screen.getAllByRole('option');
    expect(within(options[0]).getByText('Primitives')).toBeInTheDocument();
    expect(within(options[1]).getByText('Semantic')).toBeInTheDocument();
  });

  it('moves the selection with Up/Down and activates with Enter', () => {
    const { input, onActivate } = renderPalette(sameNameItems);
    type(input, 'test');

    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onActivate).toHaveBeenCalledWith({ kind: 'card', cardKey: 'group:c1::test' });
  });

  it('wraps the selection at both ends', () => {
    const { input } = renderPalette(sameNameItems);
    type(input, 'test');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(screen.getAllByRole('option')[2]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('activates a variable with its row, not just its card', () => {
    const items = [variable('group:c1::brand', 'brand/red', 'brand · Primitives')];
    const { input, onActivate } = renderPalette(items);
    type(input, 'red');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onActivate).toHaveBeenCalledWith({
      kind: 'variable', cardKey: 'group:c1::brand', varName: 'brand/red',
    });
  });

  it('activates a container by node id', () => {
    const items = [container('wrapper:c1::color', 'color', 'Primitives')];
    const { input, onActivate } = renderPalette(items);
    type(input, 'color');
    fireEvent.click(screen.getAllByRole('option')[0]);
    expect(onActivate).toHaveBeenCalledWith({ kind: 'container', nodeId: 'wrapper:c1::color' });
    expect(input).toBeInTheDocument();
  });

  it('activates a clicked result', () => {
    const { input, onActivate } = renderPalette(sameNameItems);
    type(input, 'test');
    fireEvent.click(screen.getAllByRole('option')[2]);
    expect(onActivate).toHaveBeenCalledWith({
      kind: 'variable', cardKey: 'group:c1::test', varName: 'test',
    });
  });

  it('resets the selection when the query narrows', () => {
    const { input, onActivate } = renderPalette([
      card('group:c1::a', 'brand', 'Primitives'),
      card('group:c1::b', 'brand/deep', 'Primitives'),
    ]);
    type(input, 'brand');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    type(input, 'brand/');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onActivate).toHaveBeenCalledWith({ kind: 'card', cardKey: 'group:c1::b' });
  });

  it('says how many matches the filters are hiding', () => {
    const { input } = renderPalette([
      card('group:c1::a', 'brand', 'Primitives'),
      card('group:c2::a', 'brand', 'Semantic', true),
    ]);
    type(input, 'brand');
    expect(screen.getByText('1 more hidden by the current filters')).toBeInTheDocument();
  });

  it('explains an all-hidden result set instead of saying nothing exists', () => {
    const { input } = renderPalette([card('group:c2::a', 'brand', 'Semantic', true)]);
    type(input, 'brand');
    expect(screen.getByText(/1 match is hidden by the current filters/)).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const { input, onClose } = renderPalette(sameNameItems);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('does nothing on Enter with no results', () => {
    const { input, onActivate } = renderPalette(sameNameItems);
    type(input, 'zzz');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onActivate).not.toHaveBeenCalled();
  });
});
