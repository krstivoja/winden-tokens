// Collections "Select All" fires onSelectAllCollections (the graph turns
// "Hide unused" off there); "Deselect All" never does, and a sidebar without
// the callback (Table view) keeps its plain toggles.
// Every tree label (collection, folder row, real group) focuses the graph
// through onFocusPath, by click and by Enter/Space.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CollectionData, VariableData } from '../../../../src/ui/types';
import { SidebarFilter } from '../../../../src/ui/components/Table/SidebarFilter';

const collections: CollectionData[] = [
  { id: 'c1', name: 'Theme', modes: [{ modeId: 'm1', name: 'Default' }] },
  { id: 'c2', name: 'Primitives', modes: [{ modeId: 'm2', name: 'Default' }] },
];

// Group keys of the two variables below (`<collectionId>::<group>`).
const ALL_GROUPS = new Set(['c1::color', 'c2::space']);

const variables: VariableData[] = [
  { id: 'v1', collectionId: 'c1', name: 'color/brand', resolvedType: 'COLOR', value: '#ff0000', valuesByMode: { m1: '#ff0000' } },
  { id: 'v2', collectionId: 'c2', name: 'space/1', resolvedType: 'FLOAT', value: '4', valuesByMode: { m2: '4' } },
];

// Swapped per describe block; the mock reads them at render time.
let currentCollections = collections;
let currentVariables = variables;

vi.mock('../../../../src/ui/context/AppContext', () => ({
  useAppContext: () => ({ collections: currentCollections, variables: currentVariables }),
}));

vi.mock('../../../../src/ui/components/Modals/ModalContext', () => ({
  useModalContext: () => ({ openInputModal: vi.fn() }),
}));

vi.mock('../../../../src/ui/hooks/usePluginMessages', () => ({
  post: vi.fn(),
}));

function renderSidebar(
  selectedCollections: Set<string>,
  props: Partial<React.ComponentProps<typeof SidebarFilter>> = {}
) {
  const onCollectionToggle = vi.fn();
  render(
    <SidebarFilter
      selectedModeId="m1"
      onModeChange={() => {}}
      selectedCollections={selectedCollections}
      onCollectionToggle={onCollectionToggle}
      selectedGroups={ALL_GROUPS}
      onGroupToggle={() => {}}
      {...props}
    />
  );
  return { onCollectionToggle };
}

describe('SidebarFilter Select All', () => {
  it('calls onSelectAllCollections after toggling the unselected collections on', () => {
    const onSelectAllCollections = vi.fn();
    const { onCollectionToggle } = renderSidebar(new Set(['c1']), { onSelectAllCollections });
    fireEvent.click(screen.getByText('Select All'));
    expect(onCollectionToggle.mock.calls).toEqual([['c2']]);
    expect(onSelectAllCollections).toHaveBeenCalledTimes(1);
  });

  it('does not call it from Deselect All', () => {
    const onSelectAllCollections = vi.fn();
    const { onCollectionToggle } = renderSidebar(new Set(['c1', 'c2']), { onSelectAllCollections });
    fireEvent.click(screen.getByText('Deselect All'));
    expect(onCollectionToggle.mock.calls).toEqual([['c1'], ['c2']]);
    expect(onSelectAllCollections).toHaveBeenCalledTimes(0);
  });

  it('keeps working without the callback', () => {
    const { onCollectionToggle } = renderSidebar(new Set());
    fireEvent.click(screen.getByText('Select All'));
    expect(onCollectionToggle.mock.calls).toEqual([['c1'], ['c2']]);
  });

  it('reads Select All while a group is unticked under ticked collections', () => {
    const onSelectAllCollections = vi.fn();
    const onGroupToggle = vi.fn();
    const { onCollectionToggle } = renderSidebar(new Set(['c1', 'c2']), {
      selectedGroups: new Set(['c1::color']),
      onGroupToggle,
      onSelectAllCollections,
    });
    fireEvent.click(screen.getByText('Select All'));
    expect(onCollectionToggle).not.toHaveBeenCalled();
    expect(onGroupToggle.mock.calls).toEqual([['c2::space']]);
    expect(onSelectAllCollections).toHaveBeenCalledTimes(1);
  });
});

// `badge` and `badge/color` are folder rows with no card of their own
// (isGroup false); `badge/color/error` and `button` are real groups.
const focusCollections: CollectionData[] = [
  { id: 'c3', name: 'Components', modes: [{ modeId: 'm3', name: 'Default' }] },
];
const focusVariables: VariableData[] = [
  { id: 'f1', collectionId: 'c3', name: 'badge/color/error/bg', resolvedType: 'COLOR', value: '#ff0000', valuesByMode: { m3: '#ff0000' } },
  { id: 'f2', collectionId: 'c3', name: 'badge/color/error/fg', resolvedType: 'COLOR', value: '#ffffff', valuesByMode: { m3: '#ffffff' } },
  { id: 'f3', collectionId: 'c3', name: 'button/radius', resolvedType: 'FLOAT', value: '4', valuesByMode: { m3: '4' } },
];
const FOCUS_GROUPS = new Set(['c3::badge/color/error', 'c3::button']);

function renderFocusSidebar(props: Partial<React.ComponentProps<typeof SidebarFilter>> = {}) {
  const onCollectionToggle = vi.fn();
  const onGroupToggle = vi.fn();
  render(
    <SidebarFilter
      selectedModeId="m3"
      onModeChange={() => {}}
      selectedCollections={new Set(['c3'])}
      onCollectionToggle={onCollectionToggle}
      selectedGroups={FOCUS_GROUPS}
      onGroupToggle={onGroupToggle}
      {...props}
    />
  );
  return { onCollectionToggle, onGroupToggle };
}

// Label <span> of a tree row ('color' is unique here: the type filter only
// lists COLOR / FLOAT in upper case).
const label = (text: string) => screen.getByText(text, { selector: 'span' });

describe('SidebarFilter focus labels', () => {
  beforeEach(() => {
    currentCollections = focusCollections;
    currentVariables = focusVariables;
  });
  afterEach(() => {
    currentCollections = collections;
    currentVariables = variables;
  });

  it.each([
    ['Components', ''],
    ['badge', 'badge'],
    ['color', 'badge/color'],
    ['error', 'badge/color/error'],
    ['button', 'button'],
  ])('click on %s focuses path "%s"', (text, path) => {
    const onFocusPath = vi.fn();
    renderFocusSidebar({ onFocusPath });
    const el = label(text);
    expect(el.getAttribute('role')).toBe('button');
    expect(el.getAttribute('tabindex')).toBe('0');
    expect(el.getAttribute('title')).toBe('Click to find in graph');
    fireEvent.click(el);
    expect(onFocusPath.mock.calls).toEqual([['c3', path]]);
  });

  it.each([
    ['Enter', 'Components', ''],
    [' ', 'Components', ''],
    ['Enter', 'badge', 'badge'],
    [' ', 'color', 'badge/color'],
    ['Enter', 'error', 'badge/color/error'],
  ])('key "%s" on %s focuses path "%s"', (key, text, path) => {
    const onFocusPath = vi.fn();
    renderFocusSidebar({ onFocusPath });
    const el = label(text);
    // fireEvent returns false when the handler called preventDefault (no scroll).
    expect(fireEvent.keyDown(el, { key })).toBe(false);
    expect(onFocusPath.mock.calls).toEqual([['c3', path]]);
  });

  it('ignores other keys', () => {
    const onFocusPath = vi.fn();
    renderFocusSidebar({ onFocusPath });
    fireEvent.keyDown(label('badge'), { key: 'a' });
    expect(onFocusPath).not.toHaveBeenCalled();
  });

  it('clicking the collection label does not toggle its checkbox', () => {
    const onFocusPath = vi.fn();
    const { onCollectionToggle, onGroupToggle } = renderFocusSidebar({ onFocusPath });
    fireEvent.click(label('Components'));
    fireEvent.keyDown(label('Components'), { key: ' ' });
    expect(onCollectionToggle).not.toHaveBeenCalled();
    expect(onGroupToggle).not.toHaveBeenCalled();
    expect(onFocusPath).toHaveBeenCalledTimes(2);
  });

  it('a disabled row is muted and inert', () => {
    const onFocusPath = vi.fn();
    const { onCollectionToggle } = renderFocusSidebar({
      onFocusPath,
      isPathFocusable: (collectionId, path) => !(collectionId === 'c3' && (path === 'badge' || path === '')),
    });
    for (const text of ['badge', 'Components']) {
      const el = label(text);
      expect(el.getAttribute('role')).toBe(null);
      expect(el.getAttribute('aria-disabled')).toBe('true');
      expect(el.getAttribute('tabindex')).toBe('-1');
      expect(el.className).toContain('text-text-secondary');
      expect(el.className).not.toContain('hover:underline');
      fireEvent.click(el);
      fireEvent.keyDown(el, { key: 'Enter' });
    }
    expect(onFocusPath).not.toHaveBeenCalled();
    // The collection label's click is still swallowed in graph view.
    expect(onCollectionToggle).not.toHaveBeenCalled();
    // Other rows stay focusable.
    fireEvent.click(label('color'));
    expect(onFocusPath.mock.calls).toEqual([['c3', 'badge/color']]);
  });

  it('rings the row named by focusedRowKey', () => {
    renderFocusSidebar({ onFocusPath: vi.fn(), focusedRowKey: 'c3::badge/color' });
    const rowOf = (text: string) => label(text).parentElement!;
    expect(rowOf('color').className).toContain('ring-brand');
    expect(rowOf('badge').className).not.toContain('ring-brand');
    expect(rowOf('error').className).not.toContain('ring-brand');
  });

  it('rings the collection row for its "<id>::" key', () => {
    renderFocusSidebar({ onFocusPath: vi.fn(), focusedRowKey: 'c3::' });
    // span -> <label> -> row
    expect(label('Components').parentElement!.parentElement!.className).toContain('ring-brand');
    expect(label('badge').parentElement!.className).not.toContain('ring-brand');
  });

  it('still rings a group highlighted from the canvas', () => {
    renderFocusSidebar({ onFocusPath: vi.fn(), highlightedGroupKey: 'group:c3::badge/color/error' });
    expect(label('error').parentElement!.className).toContain('ring-brand');
  });

  it('checkboxes and expand arrows behave as before', () => {
    const onFocusPath = vi.fn();
    const { onCollectionToggle, onGroupToggle } = renderFocusSidebar({ onFocusPath });
    // Row checkbox: badge -> its only real descendant group goes off.
    const badgeCheckbox = label('badge').parentElement!.querySelector('input[type="checkbox"]')!;
    fireEvent.click(badgeCheckbox);
    expect(onGroupToggle.mock.calls).toEqual([['c3::badge/color/error']]);
    // Collection checkbox: fully on -> collection + every group off.
    const collectionCheckbox = label('Components').parentElement!.querySelector('input[type="checkbox"]')!;
    fireEvent.click(collectionCheckbox);
    expect(onCollectionToggle.mock.calls).toEqual([['c3']]);
    // Expand arrow on `badge` collapses its subtree.
    fireEvent.click(label('badge').parentElement!.querySelector('button')!);
    expect(screen.queryByText('color', { selector: 'span' })).toBe(null);
    // Collection arrow collapses the whole tree.
    fireEvent.click(label('Components').parentElement!.parentElement!.querySelector('button')!);
    expect(screen.queryByText('badge', { selector: 'span' })).toBe(null);
    expect(onFocusPath).not.toHaveBeenCalled();
  });

  it('without onFocusPath labels are plain text and the collection name toggles its checkbox', () => {
    const { onCollectionToggle } = renderFocusSidebar();
    expect(screen.queryAllByRole('button').filter(b => b.tagName === 'SPAN')).toEqual([]);
    for (const text of ['Components', 'badge', 'color', 'error']) {
      expect(label(text).getAttribute('tabindex')).toBe(null);
      expect(label(text).getAttribute('title')).toBe(null);
    }
    fireEvent.click(label('Components'));
    expect(onCollectionToggle.mock.calls).toEqual([['c3']]);
  });
});
