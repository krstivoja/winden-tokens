// Data context for core data (collections, variables, shade groups)

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, ReactNode } from 'react';
import { CollectionData, ShadeGroupData, StoredCollectionOrder, VariableData } from '../types';
import { post } from '../hooks/usePluginMessages';
import {
  buildCollectionOrder,
  resolveCollectionOrder,
  sortVariablesByCollectionOrder,
} from '../utils/collectionOrder';

interface DataContextValue {
  // Collections in the user's stored order (new ones last, in API order).
  collections: CollectionData[];
  // Variables stable-sorted by their collection's rank in `collections`.
  variables: VariableData[];
  shadeGroups: ShadeGroupData[];
  setData: (
    collections: CollectionData[],
    variables: VariableData[],
    shadeGroups: ShadeGroupData[],
    collectionOrder?: StoredCollectionOrder | null
  ) => void;
  // Optimistically applies a new collection order and saves it in the file.
  reorderCollections: (orderedIds: string[]) => void;
  // The sandbox's `update-success` / `update-error` for a reorder, by the
  // `requestId` it echoes. Unknown or missing ids are ignored.
  settleCollectionOrder: (requestId: unknown) => void;
  selectedCollectionId: string | null;
  setSelectedCollectionId: (id: string | null) => void;
  colorVariables: VariableData[];
  getShadeGroupBySourceId: (variableId: string) => ShadeGroupData | null;
  getShadeGroupByGroupName: (groupName: string) => ShadeGroupData | null;
}

const DataContext = createContext<DataContextValue | null>(null);

// How long the optimistic order waits for the sandbox to acknowledge the last
// pending reorder before the stored order shows again. An older plugin build
// ignores `set-collection-order` and never replies; this keeps the sidebar
// from showing an order that was never saved.
export const COLLECTION_ORDER_ACK_TIMEOUT_MS = 10000;

// Distinguishes this window's request ids from another client's (bridge tab
// and Figma window can both see a reply).
const REQUEST_ID_PREFIX = `co-${Math.random().toString(36).slice(2, 8)}`;

export function DataProvider({ children }: { children: ReactNode }) {
  // Raw data in API order; consumers only ever see the resolved versions.
  const [rawCollections, setRawCollections] = useState<CollectionData[]>([]);
  const [rawVariables, setRawVariables] = useState<VariableData[]>([]);
  // Stored order from the last `data-loaded`.
  const [collectionOrder, setCollectionOrder] = useState<StoredCollectionOrder | null>(null);
  // Optimistic order while reorders are in flight, else null. While set it
  // wins over `collectionOrder`: a `data-loaded` for an earlier press (or a
  // poll) would otherwise reset the sidebar and the next press would start
  // from a stale order. Live collections still come from every `data-loaded`,
  // so creates, deletes and renames apply at once.
  const [pendingOrder, setPendingOrder] = useState<StoredCollectionOrder | null>(null);
  const pendingOrderRef = useRef<StoredCollectionOrder | null>(null);
  const pendingRequestsRef = useRef(new Set<string>());
  const requestCounterRef = useRef(0);
  const ackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shadeGroups, setShadeGroups] = useState<ShadeGroupData[]>([]);
  const [selectedCollectionId, setSelectedCollectionIdState] = useState<string | null>(null);

  const shownOrder = pendingOrder ?? collectionOrder;

  const collections = useMemo(
    () => resolveCollectionOrder(rawCollections, shownOrder),
    [rawCollections, shownOrder]
  );

  const variables = useMemo(
    () => (collections === rawCollections
      // No stored order applied: keep the sandbox's order untouched.
      ? rawVariables
      : sortVariablesByCollectionOrder(rawVariables, collections)),
    [rawVariables, collections, rawCollections]
  );

  const setData = useCallback((
    newCollections: CollectionData[],
    newVariables: VariableData[],
    newShadeGroups: ShadeGroupData[],
    newCollectionOrder: StoredCollectionOrder | null = null
  ) => {
    setRawCollections(newCollections);
    setRawVariables(newVariables);
    setCollectionOrder(newCollectionOrder);
    setShadeGroups(newShadeGroups);
    const resolved = resolveCollectionOrder(newCollections, pendingOrderRef.current ?? newCollectionOrder);
    setSelectedCollectionIdState(prev => {
      if (resolved.length === 0) {
        return null;
      }
      if (!prev || !resolved.some(collection => collection.id === prev)) {
        return resolved[0].id;
      }
      return prev;
    });
  }, []);

  const clearPendingOrder = useCallback(() => {
    if (ackTimeoutRef.current !== null) {
      clearTimeout(ackTimeoutRef.current);
      ackTimeoutRef.current = null;
    }
    pendingRequestsRef.current.clear();
    pendingOrderRef.current = null;
    setPendingOrder(null);
  }, []);

  const restartAckTimeout = useCallback(() => {
    if (ackTimeoutRef.current !== null) clearTimeout(ackTimeoutRef.current);
    ackTimeoutRef.current = setTimeout(clearPendingOrder, COLLECTION_ORDER_ACK_TIMEOUT_MS);
  }, [clearPendingOrder]);

  useEffect(() => () => {
    if (ackTimeoutRef.current !== null) clearTimeout(ackTimeoutRef.current);
  }, []);

  const reorderCollections = useCallback((orderedIds: string[]) => {
    const byId = new Map(collections.map(collection => [collection.id, collection]));
    const ordered: CollectionData[] = [];
    const seen = new Set<string>();
    for (const id of orderedIds) {
      const collection = byId.get(id);
      if (collection && !seen.has(id)) {
        seen.add(id);
        ordered.push(collection);
      }
    }
    // Collections the caller left out keep their current relative order, last.
    for (const collection of collections) {
      if (!seen.has(collection.id)) ordered.push(collection);
    }
    if (ordered.every((collection, index) => collection === collections[index])) {
      return;
    }
    const order = buildCollectionOrder(ordered);
    requestCounterRef.current += 1;
    const requestId = `${REQUEST_ID_PREFIX}-${requestCounterRef.current}`;
    pendingRequestsRef.current.add(requestId);
    pendingOrderRef.current = order;
    setPendingOrder(order);
    restartAckTimeout();
    post({ type: 'set-collection-order', order, requestId });
  }, [collections, restartAckTimeout]);

  const settleCollectionOrder = useCallback((requestId: unknown) => {
    if (typeof requestId !== 'string' || !pendingRequestsRef.current.delete(requestId)) {
      return;
    }
    // Success or failure alike: the sandbox has sent `data-loaded` with the
    // stored order first (also after a failed save), so once nothing is
    // pending that order is the truth.
    if (pendingRequestsRef.current.size === 0) {
      clearPendingOrder();
    } else {
      restartAckTimeout();
    }
  }, [clearPendingOrder, restartAckTimeout]);

  const setSelectedCollectionId = useCallback((id: string | null) => {
    setSelectedCollectionIdState(id);
  }, []);

  const colorVariables = useMemo(() => {
    return variables.filter(v => v.collectionId === selectedCollectionId && v.resolvedType === 'COLOR');
  }, [variables, selectedCollectionId]);

  const shadeGroupsBySourceId = useMemo(() => {
    const map = new Map<string, ShadeGroupData>();
    for (const group of shadeGroups) {
      map.set(group.sourceVariableId, group);
    }
    return map;
  }, [shadeGroups]);

  const shadeGroupsByGroupName = useMemo(() => {
    const map = new Map<string, ShadeGroupData>();
    for (const group of shadeGroups) {
      map.set(`${group.collectionId}:${group.sourceVariableName}`, group);
    }
    return map;
  }, [shadeGroups]);

  const getShadeGroupBySourceId = useCallback((variableId: string): ShadeGroupData | null => {
    return shadeGroupsBySourceId.get(variableId) || null;
  }, [shadeGroupsBySourceId]);

  const getShadeGroupByGroupName = useCallback((groupName: string): ShadeGroupData | null => {
    if (!selectedCollectionId) return null;
    return shadeGroupsByGroupName.get(`${selectedCollectionId}:${groupName}`) || null;
  }, [shadeGroupsByGroupName, selectedCollectionId]);

  const value = useMemo<DataContextValue>(() => ({
    collections,
    variables,
    shadeGroups,
    setData,
    reorderCollections,
    settleCollectionOrder,
    selectedCollectionId,
    setSelectedCollectionId,
    colorVariables,
    getShadeGroupBySourceId,
    getShadeGroupByGroupName,
  }), [
    collections,
    variables,
    shadeGroups,
    setData,
    reorderCollections,
    settleCollectionOrder,
    selectedCollectionId,
    setSelectedCollectionId,
    colorVariables,
    getShadeGroupBySourceId,
    getShadeGroupByGroupName,
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useDataContext() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useDataContext must be used within DataProvider');
  }
  return context;
}
