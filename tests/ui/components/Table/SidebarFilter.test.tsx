// The Collections tree has checkboxes: a checkbox toggles its row (tri-state
// for collections and folders), and the "All variables" checkbox fires
// onSelectAllCollections when it selects everything (the graph turns "Hide
// unused" off there); deselecting never does.
// Every tree label (collection, folder row, real group) focuses the graph
// through onFocusPath, by click and by Enter/Space, and never toggles.

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
  useAppContext: () => ({ collections: currentCollections, variables: currentVariables, reorderCollections: vi.fn() }),
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

// Label <span> of a tree row ('color' is unique here: the type filter only
// lists COLOR / FLOAT in upper case), its row and its checkbox.
const label = (text: string) => screen.getByText(text, { selector: 'span' });
const rowOf = (text: string) => label(text).closest('[role="treeitem"]') as HTMLElement;
const checkboxOf = (text: string) =>
  rowOf(text).querySelector('input[type="checkbox"]') as HTMLInputElement;

describe('SidebarFilter All variables checkbox', () => {
  it('calls onSelectAllCollections after toggling the unselected collections on', () => {
    const onSelectAllCollections = vi.fn();
    const { onCollectionToggle } = renderSidebar(new Set(['c1']), { onSelectAllCollections });
    fireEvent.click(screen.getByLabelText('All variables'));
    expect(onCollectionToggle.mock.calls).toEqual([['c2']]);
    expect(onSelectAllCollections).toHaveBeenCalledTimes(1);
  });

  it('does not call it when deselecting', () => {
    const onSelectAllCollections = vi.fn();
    const { onCollectionToggle } = renderSidebar(new Set(['c1', 'c2']), { onSelectAllCollections });
    fireEvent.click(screen.getByLabelText('All variables'));
    expect(onCollectionToggle.mock.calls).toEqual([['c1'], ['c2']]);
    expect(onSelectAllCollections).toHaveBeenCalledTimes(0);
  });

  it('keeps working without the callback', () => {
    const { onCollectionToggle } = renderSidebar(new Set());
    fireEvent.click(screen.getByLabelText('All variables'));
    expect(onCollectionToggle.mock.calls).toEqual([['c1'], ['c2']]);
  });

  it('selects all while a group is unticked under ticked collections', () => {
    const onSelectAllCollections = vi.fn();
    const onGroupToggle = vi.fn();
    const { onCollectionToggle } = renderSidebar(new Set(['c1', 'c2']), {
      selectedGroups: new Set(['c1::color']),
      onGroupToggle,
      onSelectAllCollections,
    });
    const root = screen.getByLabelText('All variables') as HTMLInputElement;
    expect(root.checked).toBe(false);
    expect(root.indeterminate).toBe(true);
    fireEvent.click(root);
    expect(onCollectionToggle).not.toHaveBeenCalled();
    expect(onGroupToggle.mock.calls).toEqual([['c2::space']]);
    expect(onSelectAllCollections).toHaveBeenCalledTimes(1);
  });

  it('clicking the "All variables" text does not toggle it', () => {
    const onSelectAllCollections = vi.fn();
    const { onCollectionToggle } = renderSidebar(new Set(['c1']), { onSelectAllCollections });
    fireEvent.click(label('All variables'));
    fireEvent.click(rowOf('All variables'));
    expect(onCollectionToggle).not.toHaveBeenCalled();
    expect(onSelectAllCollections).not.toHaveBeenCalled();
  });
});

describe('SidebarFilter collection checkboxes', () => {
  it('a fully checked collection unticks itself and every group', () => {
    const onGroupToggle = vi.fn();
    const { onCollectionToggle } = renderSidebar(new Set(['c1', 'c2']), { onGroupToggle });
    expect(checkboxOf('Theme').checked).toBe(true);
    expect(checkboxOf('Theme').indeterminate).toBe(false);
    fireEvent.click(checkboxOf('Theme'));
    expect(onCollectionToggle.mock.calls).toEqual([['c1']]);
    expect(onGroupToggle.mock.calls).toEqual([['c1::color']]);
  });

  it('is indeterminate while one of its groups is unticked, and a click ticks the rest', () => {
    const onGroupToggle = vi.fn();
    const { onCollectionToggle } = renderSidebar(new Set(['c1', 'c2']), {
      selectedGroups: new Set(['c2::space']),
      onGroupToggle,
    });
    expect(checkboxOf('Theme').checked).toBe(false);
    expect(checkboxOf('Theme').indeterminate).toBe(true);
    fireEvent.click(checkboxOf('Theme'));
    expect(onCollectionToggle).not.toHaveBeenCalled();
    expect(onGroupToggle.mock.calls).toEqual([['c1::color']]);
  });

  it('an unticked collection ticks itself and its groups', () => {
    const onGroupToggle = vi.fn();
    const { onCollectionToggle } = renderSidebar(new Set(['c2']), {
      selectedGroups: new Set(['c2::space']),
      onGroupToggle,
    });
    expect(checkboxOf('Theme').checked).toBe(false);
    expect(checkboxOf('Theme').indeterminate).toBe(false);
    fireEvent.click(checkboxOf('Theme'));
    expect(onCollectionToggle.mock.calls).toEqual([['c1']]);
    expect(onGroupToggle.mock.calls).toEqual([['c1::color']]);
  });

  it('a group checkbox also ticks its collection when that is off', () => {
    const onGroupToggle = vi.fn();
    const { onCollectionToggle } = renderSidebar(new Set(['c2']), {
      selectedGroups: new Set(['c2::space']),
      onGroupToggle,
    });
    fireEvent.click(checkboxOf('color'));
    expect(onGroupToggle.mock.calls).toEqual([['c1::color']]);
    expect(onCollectionToggle.mock.calls).toEqual([['c1']]);
  });

  it('without onGroupToggle group rows have no checkbox and the collection toggles alone', () => {
    const { onCollectionToggle } = renderSidebar(new Set(['c1', 'c2']), { onGroupToggle: undefined });
    expect(checkboxOf('color')).toBe(null);
    fireEvent.click(checkboxOf('Theme'));
    expect(onCollectionToggle.mock.calls).toEqual([['c1']]);
  });

  it('a click on a row, its label or its count never toggles', () => {
    const onGroupToggle = vi.fn();
    const { onCollectionToggle } = renderSidebar(new Set(['c1', 'c2']), { onGroupToggle });
    for (const text of ['Theme', 'color']) {
      fireEvent.click(rowOf(text));
      fireEvent.click(label(text));
      fireEvent.click(rowOf(text).lastElementChild!);
    }
    expect(onCollectionToggle).not.toHaveBeenCalled();
    expect(onGroupToggle).not.toHaveBeenCalled();
  });

  it('chevrons expand and collapse without toggling', () => {
    const onGroupToggle = vi.fn();
    const { onCollectionToggle } = renderSidebar(new Set(['c1', 'c2']), { onGroupToggle });
    fireEvent.click(screen.getByLabelText('Collapse Theme'));
    expect(screen.queryByText('color', { selector: 'span' })).toBe(null);
    fireEvent.keyDown(screen.getByLabelText('Expand Theme'), { key: 'Enter' });
    fireEvent.click(screen.getByLabelText('Expand Theme'));
    expect(screen.getByText('color', { selector: 'span' })).toBeTruthy();
    expect(onCollectionToggle).not.toHaveBeenCalled();
    expect(onGroupToggle).not.toHaveBeenCalled();
  });

  it('search forces the tree open and matching rows still toggle', () => {
    const onGroupToggle = vi.fn();
    renderSidebar(new Set(['c1', 'c2']), { onGroupToggle });
    fireEvent.change(screen.getByPlaceholderText('Search collections & groups...'), {
      target: { value: 'space' },
    });
    expect(screen.queryByText('Theme', { selector: 'span' })).toBe(null);
    fireEvent.click(checkboxOf('space'));
    expect(onGroupToggle.mock.calls).toEqual([['c2::space']]);
  });

  it('shows the variable counts', () => {
    renderSidebar(new Set(['c1', 'c2']));
    expect(rowOf('All variables').textContent).toContain('2');
    expect(rowOf('Theme').textContent).toContain('1');
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

  it('names the view in the label title', () => {
    renderFocusSidebar({ onFocusPath: vi.fn(), focusNoun: 'table' });
    expect(label('badge').getAttribute('title')).toBe('Click to find in table');
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

  it('clicking a label does not toggle its checkbox', () => {
    const onFocusPath = vi.fn();
    const { onCollectionToggle, onGroupToggle } = renderFocusSidebar({ onFocusPath });
    fireEvent.click(label('Components'));
    fireEvent.keyDown(label('Components'), { key: ' ' });
    fireEvent.click(label('badge'));
    expect(onCollectionToggle).not.toHaveBeenCalled();
    expect(onGroupToggle).not.toHaveBeenCalled();
    expect(onFocusPath).toHaveBeenCalledTimes(3);
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
      expect(el.getAttribute('title')).toBe('Not shown in graph');
      expect(el.className).toContain('text-text-secondary');
      expect(el.className).not.toContain('hover:underline');
      fireEvent.click(el);
      fireEvent.keyDown(el, { key: 'Enter' });
    }
    expect(onFocusPath).not.toHaveBeenCalled();
    expect(onCollectionToggle).not.toHaveBeenCalled();
    // Other rows stay focusable.
    fireEvent.click(label('color'));
    expect(onFocusPath.mock.calls).toEqual([['c3', 'badge/color']]);
  });

  it('rings the row named by focusedRowKey', () => {
    renderFocusSidebar({ onFocusPath: vi.fn(), focusedRowKey: 'c3::badge/color' });
    expect(rowOf('color').className).toContain('ring-primary');
    expect(rowOf('badge').className).not.toContain('ring-primary');
    expect(rowOf('error').className).not.toContain('ring-primary');
  });

  it('rings the collection row for its "<id>::" key', () => {
    renderFocusSidebar({ onFocusPath: vi.fn(), focusedRowKey: 'c3::' });
    expect(rowOf('Components').className).toContain('ring-primary');
    expect(rowOf('badge').className).not.toContain('ring-primary');
  });

  it('a highlight set from a folder row rings only the folder, not its single card', () => {
    // The graph highlights every card under the clicked row; here that is one.
    renderFocusSidebar({
      onFocusPath: vi.fn(),
      focusedRowKey: 'c3::badge',
      highlightedGroupKey: 'group:c3::badge/color/error',
    });
    expect(rowOf('badge').className).toContain('ring-primary');
    expect(rowOf('error').className).not.toContain('ring-primary');
  });

  it('still rings a group highlighted from the canvas', () => {
    renderFocusSidebar({ onFocusPath: vi.fn(), highlightedGroupKey: 'group:c3::badge/color/error' });
    expect(rowOf('error').className).toContain('ring-primary');
  });

  it('checkboxes and expand arrows behave as before', () => {
    const onFocusPath = vi.fn();
    const { onCollectionToggle, onGroupToggle } = renderFocusSidebar({ onFocusPath });
    // Folder checkbox: badge -> its only real descendant group goes off.
    expect(checkboxOf('badge').checked).toBe(true);
    fireEvent.click(checkboxOf('badge'));
    expect(onGroupToggle.mock.calls).toEqual([['c3::badge/color/error']]);
    // Collection checkbox: fully on -> collection + every group off.
    onGroupToggle.mockClear();
    fireEvent.click(checkboxOf('Components'));
    expect(onCollectionToggle.mock.calls).toEqual([['c3']]);
    expect(onGroupToggle.mock.calls).toEqual([['c3::badge/color/error'], ['c3::button']]);
    // Expand arrow on `badge` collapses its subtree.
    fireEvent.click(screen.getByLabelText('Collapse badge'));
    expect(screen.queryByText('color', { selector: 'span' })).toBe(null);
    // Collection arrow collapses the whole tree.
    fireEvent.click(screen.getByLabelText('Collapse Components'));
    expect(screen.queryByText('badge', { selector: 'span' })).toBe(null);
    expect(onFocusPath).not.toHaveBeenCalled();
  });

  it('a folder is indeterminate while only part of its groups is ticked', () => {
    currentVariables = [
      ...focusVariables,
      { id: 'f4', collectionId: 'c3', name: 'badge/size/sm', resolvedType: 'FLOAT', value: '2', valuesByMode: { m3: '2' } },
    ];
    renderFocusSidebar();
    expect(checkboxOf('badge').checked).toBe(false);
    expect(checkboxOf('badge').indeterminate).toBe(true);
    expect(checkboxOf('error').checked).toBe(true);
    expect(checkboxOf('size').checked).toBe(false);
  });

  it('without onFocusPath labels are plain text and a click toggles nothing', () => {
    const { onCollectionToggle, onGroupToggle } = renderFocusSidebar();
    expect(screen.queryAllByRole('button').filter(b => b.tagName === 'SPAN')).toEqual([]);
    for (const text of ['Components', 'badge', 'color', 'error']) {
      expect(label(text).getAttribute('tabindex')).toBe(null);
      expect(label(text).getAttribute('title')).toBe(null);
    }
    fireEvent.click(label('Components'));
    fireEvent.click(label('badge'));
    expect(onCollectionToggle).not.toHaveBeenCalled();
    expect(onGroupToggle).not.toHaveBeenCalled();
  });
});
