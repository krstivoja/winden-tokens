// Right-click menu on a graph card row: Rename / Edit value / Duplicate /
// Delete, through the real GroupedGraph; virtual rows get no menu.

import React from 'react';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import type { CollectionData, VariableData } from '../../../../src/ui/types';
import type { GroupData, GroupNodeData } from '../../../../src/ui/components/Relationships/GroupedGraph/types';

const posted = vi.hoisted(() => [] as Array<Record<string, unknown>>);

vi.mock('../../../../src/ui/hooks/usePluginMessages', () => ({
  usePluginMessages: () => undefined,
  post: (msg: Record<string, unknown>) => { posted.push(msg); },
}));

const ctx = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('../../../../src/ui/context/AppContext', () => ({
  useAppContext: () => ctx.value,
}));

const modalContext = vi.hoisted(() => ({
  modals: {},
  openShadesModal: vi.fn(), openStepsModal: vi.fn(), openInputModal: vi.fn(),
  openAddVariableModal: vi.fn(), openBulkEdit: vi.fn(),
  openColorPicker: vi.fn(), openColorReference: vi.fn(),
}));
vi.mock('../../../../src/ui/components/Modals/ModalContext', () => ({
  useModalContext: () => modalContext,
}));

import { GroupedGraph } from '../../../../src/ui/components/Relationships/GroupedGraph';
import { GroupNodeComponent } from '../../../../src/ui/components/Relationships/GroupedGraph/GraphNode';

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
];

const variable = (
  id: string, name: string, resolvedType: VariableData['resolvedType'], value: string,
): VariableData => ({ id, collectionId: 'c1', name, resolvedType, value, valuesByMode: { m1: value } });

const variables: VariableData[] = [
  variable('v1', 'size/base', 'FLOAT', '16'),
  variable('v2', 'size/alias', 'FLOAT', '{size/base}'),
  variable('v3', 'text/label', 'STRING', 'Hello'),
  variable('v4', 'flag/on', 'BOOLEAN', 'true'),
  variable('v5', 'color/brand', 'COLOR', '#ff0000'),
];

function storage(key: string, value: unknown) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', {
      data: { pluginMessage: { type: 'client-storage-data', key, value } },
    }));
  });
}

async function mount() {
  ctx.value = {
    collections,
    variables,
    selectedCollectionIds: new Set(['c1']),
    shadeGroups: [],
    selectedModeId: null,
    selectedNode: null,
    hasMultipleSelection: false,
    setSelectedModeId: () => {},
    selectedVariableTypes: new Set(['FLOAT', 'COLOR', 'STRING', 'BOOLEAN']),
    selectedGroups: new Set(['c1::size', 'c1::text', 'c1::flag', 'c1::color']),
    toggleVariableType: () => {},
    setSelectedCollectionIds: () => {},
    setSelectedGroups: () => {},
    toggleCollection: () => {},
    toggleSelectedGroup: () => {},
  };
  render(<GroupedGraph />);
  storage('graph-grouped-paths', []);
  storage('graph-positions', {});
  storage('graph-positions-collection', {});
  storage('graph-order-collection', null);
  storage('graph-tier-labels', []);
  storage('graph-layout-labels', null);
  storage('graph-layout-settings', null);
  await waitFor(() => expect(rowName('size/base')).not.toBe(null));
}

/** A row's name label on the canvas (its title carries the full name). */
const rowName = (name: string) =>
  document.querySelector<HTMLElement>(`.react-flow__node [title="${name} (double-click to rename)"]`);
const menu = () => document.getElementById('graph-row-menu');
/** Item labels (the label span; the icon's SVG markup is not part of it). */
const buttonLabel = (b: Element) => b.querySelector(':scope > span.flex-1')?.textContent;
const menuLabels = () => Array.from(menu()?.querySelectorAll('button') ?? []).map(buttonLabel);
const menuItem = (label: string) =>
  Array.from(menu()!.querySelectorAll('button')).find(b => buttonLabel(b) === label) as HTMLElement;

const openMenu = (name: string) => {
  const row = rowName(name);
  if (!row) throw new Error(`No row "${name}"`);
  const event = fireEvent.contextMenu(row, { clientX: 20, clientY: 30 });
  return event;
};

beforeEach(() => {
  posted.length = 0;
  Object.values(modalContext).forEach(fn => { if (typeof fn === 'function') (fn as ReturnType<typeof vi.fn>).mockClear(); });
});

describe('graph row context menu', () => {
  it('right-click on a real row shows Rename, Edit value, Duplicate and Delete', async () => {
    await mount();
    const notPrevented = openMenu('size/base');
    // The browser menu is suppressed because ours opened.
    expect(notPrevented).toBe(false);
    expect(menuLabels()).toEqual(['Rename', 'Edit value', 'Duplicate', 'Delete']);
    const del = menuItem('Delete');
    expect(del.className.includes('text-danger')).toBe(true);
  });

  it('Rename opens the rename modal, like double-clicking the name', async () => {
    await mount();
    openMenu('size/base');
    fireEvent.click(menuItem('Rename'));
    expect(menu()).toBe(null);
    expect(modalContext.openInputModal).toHaveBeenCalledTimes(1);
    expect(modalContext.openInputModal.mock.calls[0][0].initialValue).toBe('base');
  });

  it('Duplicate posts duplicate-variable and closes the menu', async () => {
    await mount();
    openMenu('text/label');
    fireEvent.click(menuItem('Duplicate'));
    expect(posted.filter(m => m.type === 'duplicate-variable')).toEqual([{ type: 'duplicate-variable', id: 'v3' }]);
    expect(menu()).toBe(null);
  });

  it('Delete goes through the row delete path (confirm, then delete-variable)', async () => {
    await mount();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    openMenu('size/base');
    fireEvent.click(menuItem('Delete'));
    expect(confirmSpy).toHaveBeenCalledWith('Delete size/base?');
    expect(posted.filter(m => m.type === 'delete-variable')).toEqual([{ type: 'delete-variable', id: 'v1' }]);
    expect(menu()).toBe(null);
    confirmSpy.mockRestore();
  });

  it('Edit value on a FLOAT prefills the current value and posts it for the mode', async () => {
    await mount();
    openMenu('size/base');
    fireEvent.click(menuItem('Edit value'));
    const config = modalContext.openInputModal.mock.calls[0][0];
    expect(config.initialValue).toBe('16');
    config.onConfirm('16');
    expect(posted.some(m => m.type === 'update-variable-value')).toBe(false);
    config.onConfirm('24');
    expect(posted.filter(m => m.type === 'update-variable-value'))
      .toEqual([{ type: 'update-variable-value', id: 'v1', value: '24', modeId: 'm1' }]);
  });

  it('Edit value on an alias prefills the resolved value, not the reference', async () => {
    await mount();
    openMenu('size/alias');
    fireEvent.click(menuItem('Edit value'));
    expect(modalContext.openInputModal.mock.calls[0][0].initialValue).toBe('16');
  });

  it('Edit value on a BOOLEAN toggles it', async () => {
    await mount();
    openMenu('flag/on');
    fireEvent.click(menuItem('Edit value'));
    expect(posted.filter(m => m.type === 'update-variable-value'))
      .toEqual([{ type: 'update-variable-value', id: 'v4', value: 'false', modeId: 'm1' }]);
    expect(modalContext.openInputModal).not.toHaveBeenCalled();
  });

  it('Edit value on a COLOR opens the Pick / Reference color menu', async () => {
    await mount();
    openMenu('color/brand');
    fireEvent.click(menuItem('Edit value'));
    expect(menu()).toBe(null);
    const colorMenu = document.getElementById('color-value-menu');
    expect(colorMenu).not.toBe(null);
    expect(colorMenu!.textContent).toContain('Pick Color');
  });

  it('Escape and an outside click close the menu', async () => {
    await mount();
    openMenu('size/base');
    expect(menu()).not.toBe(null);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(menu()).toBe(null);

    openMenu('size/base');
    expect(menu()).not.toBe(null);
    fireEvent.click(document.body);
    expect(menu()).toBe(null);
  });
});

// ── Per row kind, on the card itself ───────────────────────────────

const noop = () => {};

function renderCard(group: GroupData, onShowRowMenu = vi.fn()) {
  const data: GroupNodeData = {
    group,
    isColorType: true,
    variableType: 'COLOR',
    connectedVars: new Map(),
    onHighlightPath: noop,
    onHideUnused: noop,
    onHighlightVariable: noop,
    onGeneratorOpen: noop,
    onShowColorMenu: noop,
    onAddVariable: noop,
    onRenameGroup: noop,
    onDuplicateGroup: noop,
    onEditAsText: noop,
    onLevelUp: noop,
    onDeleteGroup: noop,
    onRenameVariable: noop,
    onDeleteVariable: noop,
    onShowRowMenu,
    onDisconnect: noop,
  };
  const props = { id: group.key, data } as unknown as React.ComponentProps<typeof GroupNodeComponent>;
  render(
    <ReactFlowProvider>
      <GroupNodeComponent {...props} />
    </ReactFlowProvider>
  );
  return onShowRowMenu;
}

const baseGroup = (kind: GroupData['kind'], variablesList: GroupData['variables']): GroupData => ({
  key: `group:c1::${kind}`, title: 'brand',
  variables: variablesList,
  x: 0, y: 0, initialX: 0, initialY: 0,
  kind, sourceGroupName: 'brand',
  headerFill: '#222', collectionId: 'c1',
  canGroup: true,
});

const realNode = {
  id: 'v1', name: 'brand/50', shortName: '50', displayName: '#ff0000',
  color: '#ff0000', value: '#ff0000', resolvedValue: '#ff0000',
  resolvedType: 'COLOR' as const, isReference: false, referenceName: null,
};

describe('row menu per row kind', () => {
  it('a standard row offers rename and delete', () => {
    const spy = renderCard(baseGroup('standard', [realNode]));
    fireEvent.contextMenu(screen.getByText('50'));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][2]).toEqual({ canRename: true, canDelete: true });
  });

  it('a source row offers rename but not delete', () => {
    const spy = renderCard(baseGroup('source', [realNode]));
    fireEvent.contextMenu(screen.getByText('50'));
    expect(spy.mock.calls[0][2]).toEqual({ canRename: true, canDelete: false });
  });

  it('a virtual row gets no menu and keeps the browser menu', () => {
    const virtualNode = { ...realNode, id: 'virt', name: 'brand/out', shortName: 'out-row', isVirtual: true, virtualType: 'palette' as const };
    const spy = renderCard(baseGroup('shader', [virtualNode]));
    const notPrevented = fireEvent.contextMenu(screen.getByText('out-row'));
    expect(notPrevented).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });
});
