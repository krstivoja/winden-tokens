/**
 * Winden Tokens MCP — everything that is pure.
 *
 * The transport half (./mcp.mjs) is a relay socket, a stdio server and a pile
 * of timeouts, and is awkward to test without a Figma file. This half is the
 * part with the actual opinions in it — how a `data-loaded` snapshot is read,
 * how a name resolves to a variable, what "references" means — and it is
 * ordinary data in, ordinary data out. It is unit tested in
 * tests/bridge/mcp-tokens.test.mjs.
 *
 * ---------------------------------------------------------------------------
 * THE SNAPSHOT
 * ---------------------------------------------------------------------------
 *
 * Exactly the payload the plugin broadcasts as `data-loaded` (see `fetchData`
 * and `buildUiState` in src/plugin/code.ts). Nothing here may invent fields the
 * plugin does not send:
 *
 *     {
 *       type: 'data-loaded',
 *       collections: [{ id, name, modes: [{ modeId, name }] }],
 *       variables:   [{ id, collectionId, name, resolvedType,
 *                       value,           // first mode, ALREADY FORMATTED
 *                       valuesByMode }], // { [modeId]: formatted string }
 *       shadeGroups: [...]               // not surfaced by these tools
 *     }
 *
 * EVERY VALUE IS A STRING, and the plugin formatted it (`formatValue`):
 *
 *     '#ff0088'            a colour, always 6-digit hex (alpha is dropped by
 *                          the plugin's own formatter for opaque colours)
 *     '16'                 a number
 *     'true' / 'false'     a boolean
 *     '{color/brand/500}'  AN ALIAS to the variable with that NAME
 *     '→ VariableID:1:2'   an alias whose target could not be read back
 *     'undefined'          no value set for that mode
 *
 * So a reference is discovered by parsing `{...}` out of a formatted string.
 * That is not a shortcut — it is the only representation the wire carries, and
 * it is the same representation `parseValue` accepts when writing one back.
 */

/** A `{name}` alias in a formatted value, or null. */
export function referenceTarget(formattedValue) {
  if (typeof formattedValue !== 'string') return null;
  const match = formattedValue.match(/^\{(.+)\}$/);
  return match ? match[1] : null;
}

/**
 * The group part of a variable name: everything before the last `/`.
 *
 * A "group" in Figma is not an object. It is a naming convention that Figma's
 * own UI renders as a folder. `color/brand/500` is in group `color/brand`.
 * A name with no `/` is in no group.
 */
export function groupOf(name) {
  const cut = String(name ?? '').lastIndexOf('/');
  return cut === -1 ? null : name.slice(0, cut);
}

/** Every group and ancestor group present in a list of names, with counts. */
export function groupsOf(names) {
  const counts = new Map();
  for (const name of names) {
    const parts = String(name ?? '').split('/');
    // The last part is the leaf variable name, never a group.
    for (let i = 1; i < parts.length; i++) {
      const prefix = parts.slice(0, i).join('/');
      counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, variables]) => ({ name, variables }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** True when `name` is inside `group` (or is deeper inside it). */
export function inGroup(name, group) {
  if (!group) return true;
  return String(name ?? '').startsWith(`${group}/`);
}

const TYPES = ['COLOR', 'FLOAT', 'STRING', 'BOOLEAN'];

export function normaliseType(type) {
  if (type === undefined || type === null || type === '') return null;
  const upper = String(type).toUpperCase();
  if (!TYPES.includes(upper)) {
    throw new Error(`Unknown variable type ${JSON.stringify(type)}. Figma has exactly four: ${TYPES.join(', ')}.`);
  }
  return upper;
}

/**
 * Resolve a collection by id or by name.
 *
 * Ids are preferred and are what every tool returns, but a model reading a
 * conversation has names, so names work too. An ambiguous name is an error
 * rather than a guess: silently picking the first of two collections called
 * "Colors" would put a variable somewhere the user did not ask for.
 */
export function resolveCollection(snapshot, ref) {
  const collections = snapshot.collections ?? [];
  if (!ref) {
    throw new Error(
      `No collection given. Call list_collections first; pass the id (preferred) or the exact name.`
    );
  }

  const byId = collections.find((c) => c.id === ref);
  if (byId) return byId;

  const exact = collections.filter((c) => c.name === ref);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    throw new Error(
      `${exact.length} collections are called ${JSON.stringify(ref)}. Pass an id instead: ${exact.map((c) => c.id).join(', ')}.`
    );
  }

  const loose = collections.filter((c) => c.name.toLowerCase() === String(ref).toLowerCase());
  if (loose.length === 1) return loose[0];

  throw new Error(
    `No collection ${JSON.stringify(ref)}. This file has: ${collections.map((c) => `${c.name} (${c.id})`).join(', ') || '(none)'}.`
  );
}

/** Resolve a variable by id or by full name (`group/sub/leaf`). */
export function resolveVariable(snapshot, ref) {
  const variables = snapshot.variables ?? [];
  if (!ref) {
    throw new Error(`No variable given. Pass the id from list_variables, or the variable's full name.`);
  }

  const byId = variables.find((v) => v.id === ref);
  if (byId) return byId;

  const exact = variables.filter((v) => v.name === ref);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    throw new Error(
      `${exact.length} variables are named ${JSON.stringify(ref)} (in different collections). Pass an id: ` +
        exact.map((v) => `${v.id} in ${collectionName(snapshot, v.collectionId)}`).join(', ')
    );
  }

  const loose = variables.filter((v) => v.name.toLowerCase() === String(ref).toLowerCase());
  if (loose.length === 1) return loose[0];

  const near = variables
    .filter((v) => v.name.toLowerCase().includes(String(ref).toLowerCase()))
    .slice(0, 8)
    .map((v) => v.name);

  throw new Error(
    `No variable ${JSON.stringify(ref)}.` +
      (near.length ? ` Did you mean: ${near.join(', ')}?` : ` Use list_variables to see what exists.`)
  );
}

export function collectionName(snapshot, collectionId) {
  const found = (snapshot.collections ?? []).find((c) => c.id === collectionId);
  return found ? found.name : `(unknown collection ${collectionId})`;
}

export function collectionOf(snapshot, variable) {
  return (snapshot.collections ?? []).find((c) => c.id === variable.collectionId) ?? null;
}

/**
 * Resolve a mode by name or modeId, within one collection.
 *
 * Done here rather than left to the plugin on purpose. The plugin's
 * `resolveModeIdForVariable` FALLS BACK to the variable's first mode when it
 * does not recognise the mode it was given — sensible for a UI where the user
 * can see what happened, silently wrong for a tool call, where "Dark" landing
 * in "Light" would be discovered days later.
 */
export function resolveMode(collection, ref) {
  const modes = collection?.modes ?? [];
  if (modes.length === 0) {
    throw new Error(`Collection ${collection?.name} has no modes, which should be impossible. Refusing to guess.`);
  }
  if (ref === undefined || ref === null || ref === '') {
    if (modes.length === 1) return modes[0];
    throw new Error(
      `Collection ${JSON.stringify(collection.name)} has ${modes.length} modes (${modes.map((m) => m.name).join(', ')}). ` +
        `Say which one — a value written to the wrong mode looks right until someone switches theme.`
    );
  }

  const byId = modes.find((m) => m.modeId === ref);
  if (byId) return byId;

  const byName = modes.filter((m) => m.name === ref);
  if (byName.length === 1) return byName[0];

  const loose = modes.filter((m) => m.name.toLowerCase() === String(ref).toLowerCase());
  if (loose.length === 1) return loose[0];

  throw new Error(
    `Collection ${JSON.stringify(collection.name)} has no mode ${JSON.stringify(ref)}. It has: ` +
      modes.map((m) => `${m.name} (${m.modeId})`).join(', ')
  );
}

/** `{ [modeName]: formattedValue }` for one variable. */
export function valuesByModeName(snapshot, variable) {
  const collection = collectionOf(snapshot, variable);
  const out = {};
  for (const [modeId, value] of Object.entries(variable.valuesByMode ?? {})) {
    const mode = collection?.modes.find((m) => m.modeId === modeId);
    out[mode ? mode.name : modeId] = value;
  }
  return out;
}

/** Collections plus the two things a caller always needs next. */
export function collectionsOverview(snapshot) {
  const variables = snapshot.variables ?? [];
  return (snapshot.collections ?? []).map((collection) => {
    const own = variables.filter((v) => v.collectionId === collection.id);
    return {
      id: collection.id,
      name: collection.name,
      modes: collection.modes.map((m) => ({ id: m.modeId, name: m.name })),
      variableCount: own.length,
      groups: groupsOf(own.map((v) => v.name)),
    };
  });
}

/**
 * Filter the snapshot's variables.
 *
 * @param {object} snapshot
 * @param {object} [filters]
 * @param {string} [filters.collection] id or name
 * @param {string} [filters.group]      name prefix, e.g. 'color/brand'
 * @param {string} [filters.type]       COLOR | FLOAT | STRING | BOOLEAN
 * @param {string} [filters.name_contains] case-insensitive substring
 */
export function filterVariables(snapshot, filters = {}) {
  const type = normaliseType(filters.type);
  const collection = filters.collection ? resolveCollection(snapshot, filters.collection) : null;
  const group = filters.group ? String(filters.group).replace(/\/+$/, '') : null;
  const needle = filters.name_contains ? String(filters.name_contains).toLowerCase() : null;

  return (snapshot.variables ?? []).filter((v) => {
    if (collection && v.collectionId !== collection.id) return false;
    if (type && v.resolvedType !== type) return false;
    if (group && !inGroup(v.name, group)) return false;
    if (needle && !v.name.toLowerCase().includes(needle)) return false;
    return true;
  });
}

/** The row shape `list_variables` returns. */
export function summariseVariable(snapshot, variable) {
  return {
    id: variable.id,
    name: variable.name,
    type: variable.resolvedType,
    collection: collectionName(snapshot, variable.collectionId),
    values: valuesByModeName(snapshot, variable),
  };
}

/**
 * Everything `get_variable` reports, including both directions of the
 * reference graph.
 *
 * `references` is per mode, because a variable can alias one token in Light and
 * a different one in Dark, and a single flat list would hide exactly the case
 * worth looking at.
 */
export function describeVariable(snapshot, variable) {
  const variables = snapshot.variables ?? [];
  const collection = collectionOf(snapshot, variable);
  const values = valuesByModeName(snapshot, variable);

  const references = [];
  for (const [modeName, value] of Object.entries(values)) {
    const target = referenceTarget(value);
    if (!target) continue;
    const resolved = variables.filter((v) => v.name === target);
    references.push({
      mode: modeName,
      referencesName: target,
      referencesId: resolved.length === 1 ? resolved[0].id : null,
      referencesCollection: resolved.length === 1 ? collectionName(snapshot, resolved[0].collectionId) : null,
      note:
        resolved.length === 0
          ? 'That name is not among the local variables — the alias points at a variable from a library, or at one that has been deleted.'
          : resolved.length > 1
            ? `${resolved.length} local variables share that name, so which one this is cannot be told from the snapshot.`
            : undefined,
    });
  }

  const referencedBy = [];
  for (const other of variables) {
    if (other.id === variable.id) continue;
    const modes = [];
    for (const [modeName, value] of Object.entries(valuesByModeName(snapshot, other))) {
      if (referenceTarget(value) === variable.name) modes.push(modeName);
    }
    if (modes.length) {
      referencedBy.push({
        id: other.id,
        name: other.name,
        collection: collectionName(snapshot, other.collectionId),
        inModes: modes,
      });
    }
  }

  const sameName = variables.filter((v) => v.name === variable.name);

  return {
    id: variable.id,
    name: variable.name,
    type: variable.resolvedType,
    group: groupOf(variable.name),
    collection: collection ? { id: collection.id, name: collection.name } : null,
    values,
    references,
    referencedBy,
    referencedByCount: referencedBy.length,
    ...(sameName.length > 1
      ? {
          warning:
            `${sameName.length} variables in this file are named ${JSON.stringify(variable.name)}. ` +
            `A reference is written as {name}, so "what references it" cannot distinguish them, and writing ` +
            `{${variable.name}} elsewhere resolves to whichever the plugin finds first.`,
        }
      : {}),
  };
}

/**
 * What deleting this variable takes with it, gathered BEFORE the delete.
 *
 * Two distinct blast radii, and neither is visible from the delete's own
 * `update-success`:
 *   - variables that alias it. Figma stores an alias by id, so deleting the
 *     target leaves them dangling.
 *   - generated shades. `deleteVariable` in src/plugin/code.ts reads the
 *     variable's shade-generator config and removes EVERY shade it manages, so
 *     one delete can take a whole ramp with it.
 */
export function deletionImpact(snapshot, variable) {
  const detail = describeVariable(snapshot, variable);

  // `shadeGroups` rows are `{ sourceVariableId, deleteIds, config, … }` — see
  // `buildShadeGroups` in src/plugin/code.ts. `config.generatedShades` is the
  // list `deleteVariable` actually walks and removes, so that is the list to
  // report; `deleteIds` (what the UI's own delete would sweep) is the wider
  // net and is only a fallback.
  const shadeGroup = (snapshot.shadeGroups ?? []).find((g) => g?.sourceVariableId === variable.id);
  const generated = shadeGroup?.config?.generatedShades ?? [];
  const byId = new Map((snapshot.variables ?? []).map((v) => [v.id, v.name]));

  const managedShades = (generated.length ? generated.map((s) => s?.id) : (shadeGroup?.deleteIds ?? []))
    .filter(Boolean)
    .map((id) => ({ id, name: byId.get(id) ?? '(already gone)' }));

  return {
    referencedBy: detail.referencedBy,
    managedShades,
  };
}

/** `group` + `name` → the full variable name Figma stores. */
export function groupedName(group, name) {
  const clean = String(group ?? '').replace(/^\/+|\/+$/g, '');
  if (!clean) return name;
  return `${clean}/${name}`;
}
