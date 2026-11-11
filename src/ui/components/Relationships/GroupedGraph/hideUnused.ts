// Highlighted path + "Hide unused" — the pure half.
//
// `computeHighlightPath` is the variable-level lineage walk the layout effect
// used to run inline; it lives here so the effect, the handle signature and
// the tests all read one answer.
//
// Hiding is done by the sidebar filter itself: when hiding activates, the
// groups and collections off the path are unchecked for real
// (`planSidebarUncheck` + `applySidebarUncheck`), so the Collections tree shows
// what the canvas shows and re-ticking a group brings it back. The `is*Hidden`
// predicates cover what the tree cannot express (see `isCardHiddenByHideUnused`)
// and the wires; the layout effect ORs them into the filter predicate
// (`isCardHidden`), so hide-unused can never un-hide a filtered card.

import { getCollectionGroupKey, getVariableGroupName } from '../../../utils/groupFilters';
import type { ConnectionRecord, GraphSortBy, GroupData, TierLabelNodeData } from './types';
import type { ArrangeUndoSnapshot } from './arrangeUndo';
import type { ColumnOrderRecord } from './columnOrder';

export interface HighlightPath {
  /** Cards holding any variable on the path, plus the highlighted card. */
  groups: Set<string>;
  /** Variables on the path (the seed rows included). */
  vars: Set<string>;
  /** Connection ids walked by the path. */
  edgeIds: Set<string>;
  /** Every variable of the highlighted card — tints its off-chain edges. */
  selectedCardVars: Set<string>;
}

/**
 * What is highlighted: a set of cards (their whole chains), or — with
 * `varName` — one row of the single card in `groupKeys`. Never empty; no
 * highlight is null.
 */
export interface HighlightTarget {
  groupKeys: string[];
  varName: string | null;
}

/**
 * Whether `target` is exactly the one card (or one row of it) — the toggle
 * check for the single-card callers, so clicking a card that is part of a
 * wider sidebar focus narrows to it instead of clearing.
 */
export function isSingleTarget(target: HighlightTarget | null, groupKey: string, varName: string | null): boolean {
  return target !== null
    && target.groupKeys.length === 1
    && target.groupKeys[0] === groupKey
    && target.varName === varName;
}

/**
 * Resolve the highlighted lineage of a card (varName null) or of one row.
 * One-key form of `computeHighlightPathForKeys`, kept for the single-card
 * callers and tests.
 *
 * Null when nothing is highlighted.
 */
export function computeHighlightPath(
  groupKey: string | null,
  varName: string | null,
  groups: GroupData[],
  connections: ConnectionRecord[],
  variableGroup: Map<string, { group: string }>
): HighlightPath | null {
  return computeHighlightPathForKeys(groupKey === null ? [] : [groupKey], varName, groups, connections, variableGroup);
}

/**
 * Resolve the highlighted lineage of a SET of cards (a sidebar row focuses
 * every card under it): the union of `computeHighlightPath` over each key.
 * Computed as one walk seeded with every card's rows — reachability from a
 * union of seeds is the union of each seed's reachability, so the result is
 * the same and the graph is walked once. `varName` narrows the seed to one
 * row, which only the single-card row highlight uses.
 *
 * References are per-variable (row), so the chain is traced at the VARIABLE
 * level using fromVar/toVar — otherwise passing through an intermediate card
 * would fan out to every row's provider instead of staying on the one chain.
 * Upstream (providers, edges walked backward) and downstream (dependents,
 * forward) are walked independently so siblings are never picked up.
 *
 * Null when nothing is highlighted.
 */
export function computeHighlightPathForKeys(
  groupKeys: string[],
  varName: string | null,
  groups: GroupData[],
  connections: ConnectionRecord[],
  variableGroup: Map<string, { group: string }>
): HighlightPath | null {
  if (groupKeys.length === 0) return null;

  const path: HighlightPath = {
    groups: new Set(),
    vars: new Set(),
    edgeIds: new Set(),
    selectedCardVars: new Set(),
  };

  const varOutgoing = new Map<string, Array<{ edgeId: string; varName: string }>>();
  const varIncoming = new Map<string, Array<{ edgeId: string; varName: string }>>();
  connections.forEach(conn => {
    if (!varOutgoing.has(conn.fromVar)) varOutgoing.set(conn.fromVar, []);
    varOutgoing.get(conn.fromVar)!.push({ edgeId: conn.id, varName: conn.toVar });
    if (!varIncoming.has(conn.toVar)) varIncoming.set(conn.toVar, []);
    varIncoming.get(conn.toVar)!.push({ edgeId: conn.id, varName: conn.fromVar });
  });

  // Seed with the single selected row, or every variable in the cards.
  const keySet = new Set(groupKeys);
  const selectedGroups = groups.filter(g => keySet.has(g.key));
  selectedGroups.forEach(g => g.variables.forEach(v => path.selectedCardVars.add(v.name)));
  const seedVars = varName
    ? [varName]
    : selectedGroups.flatMap(g => g.variables.map(v => v.name));
  seedVars.forEach(v => path.vars.add(v));

  const walk = (adjacency: Map<string, Array<{ edgeId: string; varName: string }>>) => {
    const visited = new Set<string>(seedVars);
    const stack = [...seedVars];
    while (stack.length > 0) {
      const current = stack.pop()!;
      (adjacency.get(current) || []).forEach(({ edgeId, varName: next }) => {
        path.edgeIds.add(edgeId);
        path.vars.add(next);
        if (!visited.has(next)) {
          visited.add(next);
          stack.push(next);
        }
      });
    }
  };

  walk(varIncoming); // upstream providers (where it comes from)
  walk(varOutgoing); // downstream dependents (what uses it)

  // Cards containing any highlighted variable get emphasized.
  path.vars.forEach(name => {
    const info = variableGroup.get(name);
    if (info) path.groups.add(info.group);
  });
  groupKeys.forEach(key => path.groups.add(key));

  return path;
}

/**
 * The path hide-unused hides against: the highlighted path while the toggle
 * is on, null otherwise. Null means "hide nothing" to every predicate below,
 * so a toggle with no highlight leaves the canvas exactly as the filters
 * have it.
 */
export function getHidingPath(hideUnused: boolean, path: HighlightPath | null): HighlightPath | null {
  return hideUnused ? path : null;
}

/**
 * Whether hide-unused hides this card. Takes the CARD key, so it covers
 * leaf cards, absorbed cards and the synthetic external (library) cards
 * alike. A card is on the path when a path edge touches one of its rows or it
 * is the highlighted card — exactly `path.groups`.
 */
export function isCardOffPath(cardKey: string, hidingPath: HighlightPath | null): boolean {
  return hidingPath !== null && !hidingPath.groups.has(cardKey);
}

/**
 * The sidebar-tree keys (`<collectionId>::<group>`) a card answers to — the
 * same keys `isCardHidden` matches it by, so unchecking all of them hides the
 * card. `loose` marks a collection ROOT card: the group filter never applies
 * to it, only its collection's checkbox does.
 */
function getCardFilterKeys(group: GroupData): { keys: string[]; loose: boolean } {
  if (group.kind === 'collection') return { keys: [], loose: true };
  if (group.kind === 'shader' || group.kind === 'shades') {
    return {
      keys: group.sourceGroupName ? [getCollectionGroupKey(group.collectionId, group.sourceGroupName)] : [],
      loose: false,
    };
  }
  const keys = new Set<string>();
  group.variables.forEach(v => {
    if (v.isVirtual) return;
    const groupName = getVariableGroupName(v.name);
    if (groupName) keys.add(getCollectionGroupKey(group.collectionId, groupName));
  });
  return { keys: Array.from(keys), loose: false };
}

export interface SidebarUncheckPlan {
  /** Tree group keys with no card on the path. */
  groupKeys: Set<string>;
  /** Collections with no card on the path — root card included. */
  collectionIds: Set<string>;
  /** Off-path cards that unchecking the above hides; the tree owns them now. */
  coveredCards: Set<string>;
}

/**
 * Which Collections-tree checkboxes hide-unused unchecks for this path.
 *
 * Finest granularity the tree has: a group key goes when no on-path card
 * answers to it, so an on-path group stays checked while its siblings go. A
 * collection goes only when nothing of it is on the path; its group keys go
 * with it, so its row reads unchecked rather than indeterminate. A collection
 * root card off the path while one of its groups is on it cannot be hidden by
 * the tree — the collection checkbox would take the group with it — so it is
 * left out of `coveredCards`, and hide-unused keeps hiding it on its own.
 *
 * Depends only on the cards and the path, never on what is checked right
 * now: the result is an instruction for one write, not a running override.
 */
export function planSidebarUncheck(groups: GroupData[], path: HighlightPath | null): SidebarUncheckPlan {
  const plan: SidebarUncheckPlan = { groupKeys: new Set(), collectionIds: new Set(), coveredCards: new Set() };
  if (path === null) return plan;

  const cards = groups.map(group => ({ group, ...getCardFilterKeys(group), onPath: path.groups.has(group.key) }));
  const keepKeys = new Set<string>();
  const keepCollections = new Set<string>();
  cards.forEach(card => {
    if (!card.onPath) return;
    card.keys.forEach(k => keepKeys.add(k));
    keepCollections.add(card.group.collectionId);
  });

  cards.forEach(card => {
    if (!keepCollections.has(card.group.collectionId)) plan.collectionIds.add(card.group.collectionId);
    card.keys.forEach(k => {
      if (!keepKeys.has(k)) plan.groupKeys.add(k);
    });
  });

  cards.forEach(card => {
    if (card.onPath) return;
    const covered = plan.collectionIds.has(card.group.collectionId)
      || (!card.loose && card.keys.every(k => plan.groupKeys.has(k)));
    if (covered) plan.coveredCards.add(card.group.key);
  });

  return plan;
}

export interface SidebarSelection {
  groups: Set<string>;
  collections: Set<string>;
}

/**
 * Apply a plan to the tree's selection. Only ever removes — except for what
 * hide-unused itself unchecked earlier (`own`), which comes back once a later
 * activation puts it on the path again, so the new path is never left hidden
 * by an old one's write. Something the user unchecked is never in `own` and
 * is never re-checked.
 *
 * Returns the next selection and the next `own` (what hide-unused has
 * unchecked and still holds unchecked). Unchanged sets keep their identity.
 */
export function applySidebarUncheck(
  plan: SidebarUncheckPlan,
  selection: SidebarSelection,
  own: SidebarSelection
): { selection: SidebarSelection; own: SidebarSelection } {
  const step = (selected: Set<string>, owned: Set<string>, uncheck: Set<string>) => {
    const next = new Set(selected);
    const nextOwned = new Set<string>();
    owned.forEach(k => {
      if (uncheck.has(k)) nextOwned.add(k);
      else next.add(k);
    });
    uncheck.forEach(k => {
      if (next.delete(k)) nextOwned.add(k);
    });
    const same = next.size === selected.size && Array.from(next).every(k => selected.has(k));
    return { next: same ? selected : next, owned: nextOwned };
  };
  const groups = step(selection.groups, own.groups, plan.groupKeys);
  const collections = step(selection.collections, own.collections, plan.collectionIds);
  return {
    selection: { groups: groups.next, collections: collections.next },
    own: { groups: groups.owned, collections: collections.owned },
  };
}

/**
 * `own` without the collections a sidebar click selects while they were off,
 * and without every group key of those collections. That click is the
 * user's whole choice for those collections, so hiding ending must not
 * re-check anything of them on top of it; what hide-unused unchecked in the
 * other collections stays held and comes back when hiding ends.
 */
export function releaseCollectionsFromOwn(
  own: SidebarSelection,
  collectionIds: ReadonlySet<string>,
  groupKeysByCollection: ReadonlyMap<string, readonly string[]>
): SidebarSelection {
  if (collectionIds.size === 0) return own;
  const released = new Set<string>();
  collectionIds.forEach(id => groupKeysByCollection.get(id)?.forEach(k => released.add(k)));
  return {
    groups: new Set(Array.from(own.groups).filter(k => !released.has(k))),
    collections: new Set(Array.from(own.collections).filter(id => !collectionIds.has(id))),
  };
}

/**
 * `own` cut down to collections and group keys that still exist. A plugin
 * undo deletes and recreates every collection and variable, so every id —
 * and with it every group key — changes; a held key from before it must not
 * be written back into the selection.
 */
export function pruneOwnToExisting(
  own: SidebarSelection,
  collectionIds: ReadonlySet<string>,
  groupKeysByCollection: ReadonlyMap<string, readonly string[]>
): SidebarSelection {
  const groupKeys = new Set<string>();
  groupKeysByCollection.forEach(keys => keys.forEach(k => groupKeys.add(k)));
  const groups = Array.from(own.groups).filter(k => groupKeys.has(k));
  const collections = Array.from(own.collections).filter(id => collectionIds.has(id));
  return groups.length === own.groups.size && collections.length === own.collections.size
    ? own
    : { groups: new Set(groups), collections: new Set(collections) };
}

/**
 * The group keys that count as selected for the loose-variable rule while
 * hiding: only what hide-unused itself unchecked (`own`), never the whole
 * plan, so keys the user had not selected stay unselected and their
 * narrowing survives. Undefined when not hiding.
 */
export function getHideUnusedGroupKeys(hiding: boolean, own: SidebarSelection): Set<string> | undefined {
  return hiding ? own.groups : undefined;
}

/**
 * Whether hide-unused itself still hides this card: off the path, and not
 * one the sidebar uncheck covers. Covered cards are the filter's to hide — so
 * re-ticking their group shows them again while hiding stays on. What is left
 * is what the tree cannot express: library cards, a collection root next to
 * an on-path group, a card sharing its group key with an on-path card.
 */
export function isCardHiddenByHideUnused(
  cardKey: string,
  hidingPath: HighlightPath | null,
  coveredCards: Set<string>
): boolean {
  return isCardOffPath(cardKey, hidingPath) && !coveredCards.has(cardKey);
}

/**
 * Whether hide-unused hides this connection. Only edges the walk took stay;
 * that includes hiding the highlighted card's own off-chain ("group sibling")
 * edges when a single row is highlighted.
 */
export function isEdgeOffPath(edgeId: string, hidingPath: HighlightPath | null): boolean {
  return hidingPath !== null && !hidingPath.edgeIds.has(edgeId);
}

/**
 * Whether a tier caption has lost every card of its column. Tier membership
 * is geometric — a caption is one column wide and knows nothing else — so a
 * caption stays while any visible top-level node overlaps its column.
 * `visibleBoxes` are the horizontal extents of the top-level cards and frames
 * still on screen. Collection mode's column headers follow the same rule (a
 * header is exactly one column wide).
 */
export function isTierLabelHidden(
  label: Pick<TierLabelNodeData, 'x' | 'width'>,
  visibleBoxes: Array<{ x: number; width: number }>
): boolean {
  const left = label.x;
  const right = label.x + label.width;
  return !visibleBoxes.some(box => box.x < right && box.x + box.width > left);
}

// ── Temporary arrange while hiding ─────────────────────────────────

type PositionRecord = Record<string, { x: number; y: number }>;

/**
 * An Arrange Grid run made while hide-unused hides something. Held in memory
 * only and never written to `savedPositions` or client storage: it belongs to
 * the hiding activation it was made in (`activation`, see `hidingActivation`
 * in GroupedGraph), and is dropped as soon as that activation ends, which
 * brings the saved layout back exactly as it was.
 *
 * `positions` uses the saved record's key shapes (top-level unit keys
 * only), so it can be laid over that record as is.
 */
export interface HidingLayout {
  activation: string;
  positions: PositionRecord;
  /** Tier captions in Tier mode; the temporary layout's column headers in
   *  Collection mode. */
  tierLabels: TierLabelNodeData[];
  /** The "Sort by" mode from before the temporary layout — set only when an
   *  Apply that switched it made (or extended) the layout. Undo Arrange,
   *  which drops the whole layout, switches back to it. */
  previousSortBy?: GraphSortBy;
  /** The saved one-step undo of the mode that switch left, set aside while
   *  the layout lives in the other mode; Undo Arrange gives it back. */
  savedUndo?: ArrangeUndoSnapshot | null;
  /** Collection mode: the temporary card order per column (natural, i.e.
   *  `{ v: 1, columns: [] }`, when the arrange made it); drags while the
   *  layout lives reorder only this, never the saved order. */
  collectionOrder?: ColumnOrderRecord;
}

/**
 * The next temporary layout for an arrange made while hiding, laid over the
 * active one (`previous`, null when none): new positions win, what the new
 * arrange did not move keeps its spot. A new `collectionOrder` replaces the
 * previous one; without one the previous order is carried. The mode and the saved undo step from
 * before the FIRST arrange of the layout are kept, so dropping it (Undo
 * Arrange) returns to the state before any of it; a switching arrange on a
 * fresh layout records them from `switched`.
 */
export function extendHidingLayout(
  previous: HidingLayout | null,
  next: Pick<HidingLayout, 'activation' | 'positions' | 'tierLabels' | 'collectionOrder'>,
  switched: { previousSortBy: GraphSortBy; savedUndo: ArrangeUndoSnapshot | null } | null
): HidingLayout {
  const origin = previous?.previousSortBy !== undefined
    ? { previousSortBy: previous.previousSortBy, savedUndo: previous.savedUndo ?? null }
    : switched;
  const collectionOrder = next.collectionOrder ?? previous?.collectionOrder;
  return {
    activation: next.activation,
    positions: { ...previous?.positions, ...next.positions },
    tierLabels: next.tierLabels,
    ...(collectionOrder ? { collectionOrder } : {}),
    ...(origin ? { previousSortBy: origin.previousSortBy, savedUndo: origin.savedUndo } : {}),
  };
}

/**
 * The temporary layout that applies right now: null once the activation it
 * was made for has ended (hiding turned off, highlight cleared or moved),
 * even in the commit before the stale layout is cleared from state.
 */
export function getActiveHidingLayout(
  layout: HidingLayout | null,
  activation: string | null
): HidingLayout | null {
  return layout !== null && layout.activation === activation ? layout : null;
}

/**
 * The positions the layout effect seeds nodes from: the saved record with the
 * temporary layout laid over it (temporary wins). Cards the temporary arrange
 * did not move keep their saved spot. Returns `saved` itself when there is no
 * temporary layout.
 */
export function mergeHidingPositions(saved: PositionRecord, layout: HidingLayout | null): PositionRecord {
  return layout ? { ...saved, ...layout.positions } : saved;
}

/**
 * Whether a collection checkbox click ends hiding: ticking a whole collection
 * ON while hiding is active is a request to see it, and hide-unused would
 * otherwise keep its off-path cards hidden (or bring them back dimmed and
 * unwired). Unticking, or any click while not hiding, leaves hiding alone.
 */
export function collectionToggleEndsHiding(
  isHiding: boolean,
  collectionId: string,
  selectedCollections: Set<string>
): boolean {
  return isHiding && !selectedCollections.has(collectionId);
}
