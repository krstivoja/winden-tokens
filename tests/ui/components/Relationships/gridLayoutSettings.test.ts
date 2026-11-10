// Grid Settings "Sort by": the persisted mode and its draft.

import { describe, it, expect } from 'vitest';
import {
  normalizeGridLayoutSettings,
  toGridLayoutDraft,
} from '../../../../src/ui/components/Relationships/GroupedGraph/utils';

describe('sortBy', () => {
  it('defaults to tier when missing or garbage', () => {
    expect(normalizeGridLayoutSettings(undefined).sortBy).toBe('tier');
    expect(normalizeGridLayoutSettings({ gapX: 1, gapY: 2 }).sortBy).toBe('tier');
    expect(normalizeGridLayoutSettings({ sortBy: 'rows' }).sortBy).toBe('tier');
    expect(normalizeGridLayoutSettings({ sortBy: 7 }).sortBy).toBe('tier');
  });

  it('keeps collection', () => {
    expect(normalizeGridLayoutSettings({ sortBy: 'collection' }).sortBy).toBe('collection');
  });

  it('round-trips through the draft', () => {
    const settings = normalizeGridLayoutSettings({ gapX: 1, gapY: 2, sortBy: 'collection' });
    const draft = toGridLayoutDraft(settings);
    expect(draft).toEqual({ gapX: '1', gapY: '2', sortBy: 'collection' });
    expect(normalizeGridLayoutSettings({
      gapX: Number.parseInt(draft.gapX, 10),
      gapY: Number.parseInt(draft.gapY, 10),
      sortBy: draft.sortBy,
    })).toEqual(settings);
  });
});
