// Hide unused round trips, through the real GroupedGraph and the real sidebar
// tree, with the selection held in state the way FilterContext holds it:
// - Show all returns exactly to the view from before Hide unused, sidebar
//   group narrowing included;
// - Undo Arrange after an Apply that switched "Sort by" while hiding switches
//   the mode back, as it does without hiding.

import React, { useState } from 'react';
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

import { GroupedGraph } from '../../../../src/ui/components/Relationships/GroupedGraph';

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

const variable = (id: string, collectionId: string, name: string, value = '1'): VariableData => ({
  id, collectionId, name, resolvedType: 'FLOAT', value,
  valuesByMode: { [collectionId === 'c1' ? 'm1' : 'm2']: value },
});

// c1: `alpha/two` references `beta/one`, so focusing `alpha` puts `beta` on
// the path; `gamma` and c2's `omega` are on no chain.
const variables: VariableData[] = [
  variable('v1', 'c1', 'alpha/one'), variable('v2', 'c1', 'alpha/two', '{beta/one}'),
  variable('v3', 'c1', 'beta/one'), variable('v4', 'c1', 'beta/two'),
  variable('v5', 'c1', 'gamma/one'),
  variable('v6', 'c2', 'omega/one'), variable('v7', 'c2', 'omega/two'),
];

const ALL_GROUPS = ['c1::alpha', 'c1::beta', 'c1::gamma', 'c2::omega'];

/** FilterContext in miniature: the selection lives in state. */
function Harness() {
  const [collectionIds, setCollectionIds] = useState<Set<string>>(new Set(['c1', 'c2']));
  const [groups, setGroups] = useState<Set<string>>(new Set(ALL_GROUPS));
  ctx.value = {
    collections,
    variables,
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

async function mount(layoutSettings: unknown = null) {
  render(<Harness />);
  storage('graph-grouped-paths', []);
  storage('graph-positions', {});
  storage('graph-positions-collection', {});
  storage('graph-tier-labels', []);
  storage('graph-layout-labels', null);
  storage('graph-layout-settings', layoutSettings);
  await waitFor(() => expect(cardNode('group:c2::omega')).not.toBe(null));
}

const cardNode = (id: string) => document.querySelector(`.react-flow__node[data-id="${id}"]`);
const visibleCards = () => Array.from(document.querySelectorAll<HTMLElement>('.react-flow__node[data-id^="group:"]'))
  .map(el => el.dataset.id)
  .sort();
const sidebarRow = (text: string) =>
  screen.getByText(text, { selector: '[role="tree"] span' }).closest('[role="treeitem"]') as HTMLElement;
/** The toolbar Hide unused / Show all toggle. */
const toolbarToggle = () => document.querySelector('button[aria-pressed]') as HTMLElement;
/** A card menu item (the toolbar toggle has the same text). */
const menuItem = (text: string) => screen.getAllByText(text).find(el => !el.closest('[aria-pressed]')) as HTMLElement;
const selection = () => ({
  collections: Array.from(ctx.value.selectedCollectionIds as Set<string>).sort(),
  groups: Array.from(ctx.value.selectedGroups as Set<string>).sort(),
});
const writes = (key: string) =>
  posted.filter(m => m.type === 'set-client-storage' && m.key === key).map(m => m.value);
const selectedTab = () => screen.getAllByRole('tab').find(tab => tab.getAttribute('aria-selected') === 'true')?.textContent;

beforeEach(() => {
  posted.length = 0;
});

describe('Show all after Hide unused', () => {
  it('returns to the sidebar group view: the group narrows its own collection only', async () => {
    await mount();
    fireEvent.click(sidebarRow('alpha'));
    // The group click narrows c1 to alpha; c2 stays whole.
    await waitFor(() => expect(visibleCards()).toEqual(['group:c1::alpha', 'group:c2::omega']));
    const before = selection();

    fireEvent.click(toolbarToggle());
    // Only alpha's chain is left (beta, on it, stays filtered out); omega is gone.
    await waitFor(() => expect(visibleCards()).toEqual(['group:c1::alpha']));

    fireEvent.click(toolbarToggle());
    await waitFor(() => expect(visibleCards()).toEqual(['group:c1::alpha', 'group:c2::omega']));
    expect(selection()).toEqual(before);
  });

  it('the card menu Show all restores the same way', async () => {
    await mount();
    const before = selection();
    fireEvent.click(screen.getByLabelText('Open actions for gamma'));
    fireEvent.click(menuItem('Hide unused'));
    await waitFor(() => expect(visibleCards()).toEqual(['group:c1::gamma']));

    fireEvent.click(screen.getByLabelText('Open actions for gamma'));
    fireEvent.click(menuItem('Show all'));
    await waitFor(() => expect(visibleCards()).toEqual(
      ['group:c1::alpha', 'group:c1::beta', 'group:c1::gamma', 'group:c2::omega']
    ));
    expect(selection()).toEqual(before);
  });

  it('keeps a group the user re-ticked while hiding, and brings the rest back', async () => {
    await mount();
    fireEvent.click(sidebarRow('alpha'));
    await waitFor(() => expect(visibleCards()).toEqual(['group:c1::alpha', 'group:c2::omega']));
    fireEvent.click(toolbarToggle());
    await waitFor(() => expect(visibleCards()).toEqual(['group:c1::alpha']));

    // Cmd-click gamma: shown again while hiding stays on.
    fireEvent.click(sidebarRow('gamma'), { metaKey: true });
    await waitFor(() => expect(visibleCards()).toContain('group:c1::gamma'));

    fireEvent.click(toolbarToggle());
    await waitFor(() => expect(visibleCards()).toEqual(['group:c1::alpha', 'group:c1::gamma', 'group:c2::omega']));
  });

  it('Cmd-click on a group of a collection Hide unused turned off ends hiding and brings the rest back', async () => {
    await mount();
    fireEvent.click(screen.getByLabelText('Open actions for gamma'));
    fireEvent.click(menuItem('Hide unused'));
    // c1's alpha and beta groups and the whole of c2 are unchecked.
    await waitFor(() => expect(visibleCards()).toEqual(['group:c1::gamma']));
    expect(selection().collections).toEqual(['c1']);

    // The click selects c2 (off), so hiding ends; it is the user's choice for
    // c2 only — c1's groups Hide unused unchecked come back.
    fireEvent.click(sidebarRow('omega'), { metaKey: true });
    await waitFor(() => expect(toolbarToggle().textContent).toBe('Hide unused'));
    await waitFor(() => expect(visibleCards()).toEqual(
      ['group:c1::alpha', 'group:c1::beta', 'group:c1::gamma', 'group:c2::omega']
    ));
    expect(selection()).toEqual({ collections: ['c1', 'c2'], groups: ALL_GROUPS });
  });
});

describe('Undo Arrange while hiding', () => {
  it('restores the previous Sort by after an Apply that switched it', async () => {
    await mount();
    fireEvent.click(screen.getByLabelText('Open actions for gamma'));
    fireEvent.click(menuItem('Hide unused'));
    await waitFor(() => expect(visibleCards()).toEqual(['group:c1::gamma']));

    fireEvent.click(screen.getByText('Grid Settings'));
    fireEvent.click(screen.getByRole('tab', { name: 'Collection' }));
    fireEvent.change(screen.getByLabelText('Horizontal gap'), { target: { value: '100' } });
    fireEvent.click(screen.getByText('Apply'));
    await waitFor(() => expect(document.querySelector('[data-id="tier-label:collection:c1"]')).not.toBe(null));
    // A temporary arrange: no saved record touched.
    expect(writes('graph-positions-collection')).toEqual([]);
    posted.length = 0;

    fireEvent.click(await screen.findByText('Undo Arrange'));
    const saved = writes('graph-layout-settings');
    expect(saved.length).toBe(1);
    expect((saved[0] as { sortBy: string; gapX: number }).sortBy).toBe('tier');
    expect((saved[0] as { sortBy: string; gapX: number }).gapX).toBe(100);
    await waitFor(() => expect(document.querySelector('[data-id^="tier-label:collection:"]')).toBe(null));
    // Grid Settings is still open from the Apply.
    expect(selectedTab()).toBe('Tier');

    // Hiding is still on, still hiding the same cards, and nothing is left to undo.
    expect(toolbarToggle().textContent).toBe('Show all');
    expect(visibleCards()).toEqual(['group:c1::gamma']);
    expect(screen.queryByText('Undo Arrange')).toBe(null);
    expect(writes('graph-positions')).toEqual([]);
    expect(writes('graph-positions-collection')).toEqual([]);
  });

  it('gives back the saved undo step the switch set aside', async () => {
    await mount();
    // A saved arrange in Tier mode first: its undo step exists.
    fireEvent.click(screen.getByText('Arrange Grid'));
    await screen.findByText('Undo Arrange');

    fireEvent.click(screen.getByLabelText('Open actions for gamma'));
    fireEvent.click(menuItem('Hide unused'));
    await waitFor(() => expect(visibleCards()).toEqual(['group:c1::gamma']));
    fireEvent.click(screen.getByText('Grid Settings'));
    fireEvent.click(screen.getByRole('tab', { name: 'Collection' }));
    fireEvent.change(screen.getByLabelText('Horizontal gap'), { target: { value: '100' } });
    fireEvent.click(screen.getByText('Apply'));
    await waitFor(() => expect(document.querySelector('[data-id="tier-label:collection:c1"]')).not.toBe(null));

    // First Undo: the temporary layout and the mode switch.
    fireEvent.click(screen.getByText('Undo Arrange'));
    await waitFor(() => expect(document.querySelector('[data-id^="tier-label:collection:"]')).toBe(null));
    posted.length = 0;
    // Second Undo: the Tier arrange from before, written to the Tier record.
    fireEvent.click(screen.getByText('Undo Arrange'));
    expect(writes('graph-positions')).toEqual([{}]);
    expect(writes('graph-layout-settings')).toEqual([]);
    expect(screen.queryByText('Undo Arrange')).toBe(null);
  });
});
