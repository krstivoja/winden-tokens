// Sidebar row → canvas focus — the pure half.
//
// A sidebar row stands for a path in one collection: '' is the collection
// row, otherwise a '/'-joined group path ('badge', 'badge/color'). Focusing a
// row targets every VISIBLE card or container of that collection at or below
// the path. Two different ids come out of that, and they are not the same
// thing: card keys feed the highlight (a container's absorbed card answers by
// its card key), node ids feed fitView (an absorbed card has no node of its
// own, its container draws it).

import type { Node } from '@xyflow/react';
import { getCollectionGroupKey } from '../../../utils/groupFilters';
import type { GroupData, WrapperNodeData } from './types';

/** Synthetic library cards — not part of any sidebar collection tree. */
const EXTERNAL_CARD_PREFIX = 'ext-group:';

/**
 * Whether an entry at `entryPath` lies within the row at `scopePath`: the row
 * itself, or below it. '' is the collection row and holds everything.
 * Segment-wise, so `badge` holds `badge/color` but never `badge-x`.
 */
export function isPathInScope(entryPath: string, scopePath: string): boolean {
  return scopePath === '' || entryPath === scopePath || entryPath.startsWith(scopePath + '/');
}

interface FocusEntry {
  collectionId: string;
  /** The card's / container's own path; '' for a collection root card or frame. */
  path: string;
  nodeId: string;
  /** The card key this node highlights as; null for a container with no
   *  (visible) card of its own. */
  cardKey: string | null;
}

/**
 * What a VISIBLE node contributes to sidebar focus, or null when it is hidden
 * or is no sidebar target (tier captions, the selection card, library cards).
 */
function getFocusEntry(node: Node): FocusEntry | null {
  if (node.hidden) return null;
  if (node.type === 'groupNode') {
    const group = (node.data as { group?: GroupData } | undefined)?.group;
    if (!group || group.key.startsWith(EXTERNAL_CARD_PREFIX)) return null;
    return {
      collectionId: group.collectionId,
      path: group.kind === 'collection' ? '' : (group.sourceGroupName ?? ''),
      nodeId: node.id,
      cardKey: group.key,
    };
  }
  if (node.type === 'groupWrapper') {
    const data = node.data as WrapperNodeData | undefined;
    if (!data) return null;
    return {
      collectionId: data.collectionId,
      path: data.path,
      nodeId: node.id,
      // The absorbed card's rows are withheld while it is filtered out; the
      // frame is still a fit target then, but there is nothing to highlight.
      cardKey: data.card && !data.cardHidden ? data.card.group.key : null,
    };
  }
  return null;
}

export interface FocusScope {
  /** Card keys to highlight (absorbed cards by their own key). */
  cardKeys: string[];
  /** xyflow node ids to fit the viewport to. */
  nodeIds: string[];
}

/**
 * The visible targets of the row (`collectionId`, `path`). Null when nothing
 * in scope is visible — the caller then does nothing at all, so a stale
 * sidebar can never fit the canvas onto a hidden node.
 */
export function selectFocusScope(nodes: Node[], collectionId: string, path: string): FocusScope | null {
  const cardKeys: string[] = [];
  const nodeIds: string[] = [];
  nodes.forEach(node => {
    const entry = getFocusEntry(node);
    if (!entry || entry.collectionId !== collectionId || !isPathInScope(entry.path, path)) return;
    nodeIds.push(entry.nodeId);
    if (entry.cardKey !== null) cardKeys.push(entry.cardKey);
  });
  return nodeIds.length > 0 ? { cardKeys, nodeIds } : null;
}

/**
 * Every sidebar row key (`<collectionId>::<path>`, the shape of
 * `focusedRowKey`) with at least one visible target in scope: each visible
 * entry enables its own path and every ancestor up to the collection row.
 * Sorted and unique, so joining it gives a stable signature that changes only
 * when visibility does — never on a drag.
 */
export function collectFocusableRowKeys(nodes: Node[]): string[] {
  const keys = new Set<string>();
  nodes.forEach(node => {
    const entry = getFocusEntry(node);
    if (!entry) return;
    keys.add(getCollectionGroupKey(entry.collectionId, ''));
    if (entry.path === '') return;
    const segments = entry.path.split('/');
    for (let i = 1; i <= segments.length; i++) {
      keys.add(getCollectionGroupKey(entry.collectionId, segments.slice(0, i).join('/')));
    }
  });
  return Array.from(keys).sort();
}
