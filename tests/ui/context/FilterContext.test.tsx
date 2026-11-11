// FilterContext keeps the sidebar marks (the rows the user clicked, ringed in
// the Collections tree) and drops those whose row no longer exists, e.g.
// after a plugin undo recreated every collection id.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import type { CollectionData, VariableData } from '../../../src/ui/types';

let data: { collections: CollectionData[]; variables: VariableData[] } = { collections: [], variables: [] };

vi.mock('../../../src/ui/context/DataContext', () => ({
  useDataContext: () => ({ ...data, selectedCollectionId: null }),
}));

import { FilterProvider, useFilterContext } from '../../../src/ui/context/FilterContext';

const collectionsOf = (id: string): CollectionData[] => [{ id, name: 'Tokens', modes: [{ modeId: 'm1', name: 'Default' }] }];
const variablesOf = (id: string): VariableData[] => [
  { id: 'v1', collectionId: id, name: 'action/height/1', resolvedType: 'FLOAT', value: '1', valuesByMode: { m1: '1' } },
];

type Ctx = ReturnType<typeof useFilterContext>;

function renderProbe() {
  const ref: { current: Ctx | null } = { current: null };
  function Probe() {
    ref.current = useFilterContext();
    return null;
  }
  const ui = () => <FilterProvider><Probe /></FilterProvider>;
  const { rerender } = render(ui());
  return { ctx: () => ref.current as Ctx, rerender: () => rerender(ui()) };
}

describe('FilterContext sidebar marks', () => {
  it('keeps marks of existing rows and drops them once their ids are gone', () => {
    data = { collections: collectionsOf('c1'), variables: variablesOf('c1') };
    const { ctx, rerender } = renderProbe();
    expect(ctx().sidebarMarks.size).toBe(0);

    act(() => ctx().setSidebarMarks(new Set(['c1::', 'c1::action', 'c1::action/height'])));
    rerender();
    expect(Array.from(ctx().sidebarMarks)).toEqual(['c1::', 'c1::action', 'c1::action/height']);

    // Plugin undo: every collection (and so every group key) gets a new id.
    data = { collections: collectionsOf('c1-new'), variables: variablesOf('c1-new') };
    rerender();
    expect(ctx().sidebarMarks.size).toBe(0);
  });

  it('drops only the mark of a group that was deleted', () => {
    data = { collections: collectionsOf('c1'), variables: variablesOf('c1') };
    const { ctx, rerender } = renderProbe();
    act(() => ctx().setSidebarMarks(new Set(['c1::', 'c1::action/height'])));
    data = { collections: collectionsOf('c1'), variables: [] };
    rerender();
    expect(Array.from(ctx().sidebarMarks)).toEqual(['c1::']);
  });
});
