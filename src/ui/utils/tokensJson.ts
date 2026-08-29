// Nested (DTCG-style) JSON shape for the JSON tab.
//
// The UI state is flat ({collections[], variables[]} with slash-path names),
// which is also what the plugin's 'update-from-json' handler consumes. The
// JSON tab presents that state as a nested tree instead: collections at the
// top level, each slash segment a nested group, leaves marked by $value.
// Meta keys are $-prefixed so token group names can never collide with them.
// $id carries the Figma id through edits — a leaf moved to another group in
// the tree round-trips as a rename of the same variable.

import { CollectionData, VariableData } from '../types';

export interface FlatVariablePayload {
  id: string;
  collectionId: string;
  name: string;
  type: string;
  value: string;
}

export interface FlatJsonPayload {
  collections: CollectionData[];
  variables: FlatVariablePayload[];
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function buildNestedTokensJson(
  collections: CollectionData[],
  variables: VariableData[]
): string {
  const root: Record<string, Record<string, unknown>> = {};
  const bucketByCollectionId = new Map<string, Record<string, unknown>>();

  collections.forEach(collection => {
    const bucket: Record<string, unknown> = {
      $id: collection.id,
      $modes: collection.modes.map(m => m.name),
    };
    root[collection.name] = bucket;
    bucketByCollectionId.set(collection.id, bucket);
  });

  variables.forEach(variable => {
    const bucket = bucketByCollectionId.get(variable.collectionId);
    if (!bucket) return;

    const parts = variable.name.split('/');
    let node = bucket;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (!isPlainObject(node[key])) node[key] = {};
      node = node[key] as Record<string, unknown>;
    }

    // A leaf can also hold child groups (Figma allows "a" and "a/b" to
    // coexist), so merge instead of overwriting.
    const leafKey = parts[parts.length - 1];
    const existing = isPlainObject(node[leafKey]) ? node[leafKey] as Record<string, unknown> : {};
    node[leafKey] = {
      ...existing,
      $id: variable.id,
      $type: variable.resolvedType,
      $value: variable.value,
    };
  });

  return JSON.stringify(root, null, 2);
}

// Convert edited JSON back to the flat payload 'update-from-json' expects.
// Accepts both the nested shape and the legacy flat {collections, variables}
// shape (old exports pasted in). Returns null when the shape is neither.
export function parseTokensJson(
  json: unknown,
  collections: CollectionData[]
): FlatJsonPayload | null {
  if (!isPlainObject(json)) return null;

  if (Array.isArray(json.collections) && Array.isArray(json.variables)) {
    return json as unknown as FlatJsonPayload;
  }

  const collectionsByName = new Map(collections.map(c => [c.name, c]));
  const outCollections: CollectionData[] = [];
  const outVariables: FlatVariablePayload[] = [];

  for (const [collectionName, subtree] of Object.entries(json)) {
    if (!isPlainObject(subtree)) continue;

    const metaId = typeof subtree.$id === 'string' ? subtree.$id : undefined;
    const collection = (metaId && collections.find(c => c.id === metaId))
      || collectionsByName.get(collectionName);
    // Unknown collection: nothing to target in Figma, skip its subtree.
    if (!collection) continue;
    outCollections.push(collection);

    const walk = (node: Record<string, unknown>, path: string[]) => {
      if (node.$value !== undefined && path.length > 0) {
        outVariables.push({
          id: typeof node.$id === 'string' ? node.$id : '',
          collectionId: collection.id,
          name: path.join('/'),
          type: typeof node.$type === 'string' ? node.$type : 'STRING',
          value: String(node.$value),
        });
      }
      for (const [key, child] of Object.entries(node)) {
        if (key.startsWith('$')) continue;
        if (isPlainObject(child)) walk(child, [...path, key]);
      }
    };
    walk(subtree, []);
  }

  return { collections: outCollections, variables: outVariables };
}
