// One-step Undo Arrange — the pure half.
//
// The snapshot is the SAVED record from before the arrange, never the live
// node positions. Units that had no saved position were placed by the natural
// layout, which depends on the filters: a frame is sized from its visible
// cards, and the packing stacks the next unit by that size. Copying their live
// positions into the snapshot froze a filter-dependent layout — after Undo,
// lifting the filter grew a frame back while the unit under it stayed put,
// and the two overlapped. Restoring the record verbatim (possibly `{}`) keeps
// those units natural, so they re-flow when the filter changes, as before the
// arrange. Applies to both layouts (Tier and Collection).
//
// An Apply in Grid Settings that switches "Sort by" is an arrange too, and
// its Undo must also switch the mode back: positions `{}` under the new mode
// would still draw the new mode's natural layout. So the snapshot carries the
// previous `sortBy` then — and only then; a plain Arrange leaves it out and
// its Undo never touches the mode.
//
// Each mode keeps its own record (`graph-positions` for Tier,
// `graph-positions-collection` for Collection), so the snapshot names the
// store it was taken from and Undo writes it back to THAT store. The tier
// captions only mean something for a Tier snapshot.
//
// A Collection snapshot also carries the card order per column
// (`graph-order-collection`): Arrange resets it to natural, Undo writes it
// back verbatim — `null` when there was no record, so Undo clears it again.

import type { ColumnOrderRecord } from './columnOrder';
import type { GraphSortBy, TierPlacement } from './types';

type PositionRecord = Record<string, { x: number; y: number }>;

export interface ArrangeUndoSnapshot {
  /** The saved positions record before the arrange. */
  positions: PositionRecord;
  /** The mode whose record `positions` is — where Undo writes it back. */
  store: GraphSortBy;
  /** The tier captions (`graph-tier-labels`) before the arrange. */
  tierLabels: TierPlacement[];
  /** The "Sort by" mode before the arrange — set only when the arrange
   *  (an Apply) switched it. */
  sortBy?: GraphSortBy;
  /** Collection mode only: the card order record (`graph-order-collection`)
   *  before the arrange; `null` when none was stored. Absent for Tier. */
  collectionOrder?: ColumnOrderRecord | null;
}

function copyColumnOrder(record: ColumnOrderRecord | null): ColumnOrderRecord | null {
  if (!record) return null;
  return {
    v: record.v,
    columns: record.columns.map(column => ({ id: column.id, name: column.name, items: column.items.slice() })),
  };
}

/** Copy the pre-arrange state; later mutation of the inputs cannot leak in. */
export function takeArrangeSnapshot(
  savedPositions: PositionRecord,
  tierLabels: TierPlacement[],
  store: GraphSortBy,
  previousSortBy?: GraphSortBy,
  collectionOrder?: ColumnOrderRecord | null
): ArrangeUndoSnapshot {
  const positions: PositionRecord = {};
  Object.entries(savedPositions).forEach(([key, pos]) => { positions[key] = { x: pos.x, y: pos.y }; });
  return {
    positions,
    tierLabels: tierLabels.map(label => ({ ...label })),
    store,
    ...(previousSortBy ? { sortBy: previousSortBy } : {}),
    ...(collectionOrder !== undefined ? { collectionOrder: copyColumnOrder(collectionOrder) } : {}),
  };
}

/** What Undo writes back: the snapshot itself, verbatim — nothing frozen. */
export function restoreArrangeSnapshot(snapshot: ArrangeUndoSnapshot): ArrangeUndoSnapshot {
  return takeArrangeSnapshot(snapshot.positions, snapshot.tierLabels, snapshot.store, snapshot.sortBy, snapshot.collectionOrder);
}
