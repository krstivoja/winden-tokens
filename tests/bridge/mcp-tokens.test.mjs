// Tests for the pure half of the MCP server (bridge/mcp-tokens.mjs): reading a
// `data-loaded` snapshot the way the tools do.
//
// The fixture is shaped exactly like what `fetchData` in src/plugin/code.ts
// broadcasts, formatted values and all — a reference is the string `{name}`,
// never an object, because that is the only form the wire carries.

import { describe, it, expect } from 'vitest';

import {
  collectionsOverview,
  deletionImpact,
  describeVariable,
  filterVariables,
  groupOf,
  groupedName,
  groupsOf,
  normaliseType,
  referenceTarget,
  resolveCollection,
  resolveMode,
  resolveVariable,
  summariseVariable,
} from '../../bridge/mcp-tokens.mjs';

const PRIMITIVES = { id: 'C:1', name: 'Primitives', modes: [{ modeId: 'M:1', name: 'Value' }] };
const THEME = {
  id: 'C:2',
  name: 'Theme',
  modes: [
    { modeId: 'M:2', name: 'Light' },
    { modeId: 'M:3', name: 'Dark' },
  ],
};

const snapshot = {
  type: 'data-loaded',
  collections: [PRIMITIVES, THEME],
  variables: [
    { id: 'V:1', collectionId: 'C:1', name: 'color/brand/500', resolvedType: 'COLOR', value: '#3366ff', valuesByMode: { 'M:1': '#3366ff' } },
    { id: 'V:2', collectionId: 'C:1', name: 'color/brand/700', resolvedType: 'COLOR', value: '#1133cc', valuesByMode: { 'M:1': '#1133cc' } },
    { id: 'V:3', collectionId: 'C:1', name: 'space/4', resolvedType: 'FLOAT', value: '16', valuesByMode: { 'M:1': '16' } },
    {
      id: 'V:4',
      collectionId: 'C:2',
      name: 'surface/accent',
      resolvedType: 'COLOR',
      value: '{color/brand/500}',
      valuesByMode: { 'M:2': '{color/brand/500}', 'M:3': '{color/brand/700}' },
    },
  ],
  shadeGroups: [],
};

describe('reading a data-loaded snapshot', () => {
  describe('names and groups', () => {
    it('reads a reference out of a formatted value, and only a whole one', () => {
      expect(referenceTarget('{color/brand/500}')).toBe('color/brand/500');
      expect(referenceTarget('#3366ff')).toBe(null);
      expect(referenceTarget('undefined')).toBe(null);
      // The plugin's fallback for an alias it could not read back.
      expect(referenceTarget('→ VariableID:1:2')).toBe(null);
    });

    it('treats the last path segment as the variable, not as a group', () => {
      expect(groupOf('color/brand/500')).toBe('color/brand');
      expect(groupOf('radius')).toBe(null);
    });

    it('counts every ancestor group, because Figma nests them', () => {
      expect(groupsOf(['color/brand/500', 'color/brand/700', 'space/4', 'flat'])).toEqual([
        { name: 'color', variables: 2 },
        { name: 'color/brand', variables: 2 },
        { name: 'space', variables: 1 },
      ]);
    });

    it('builds a grouped name and tolerates stray slashes', () => {
      expect(groupedName('color/brand', '500')).toBe('color/brand/500');
      expect(groupedName('/color/brand/', '500')).toBe('color/brand/500');
      expect(groupedName('', '500')).toBe('500');
    });
  });

  describe('resolving what the caller named', () => {
    it('takes an id or an exact name for a collection', () => {
      expect(resolveCollection(snapshot, 'C:2').name).toBe('Theme');
      expect(resolveCollection(snapshot, 'Theme').id).toBe('C:2');
      expect(resolveCollection(snapshot, 'theme').id).toBe('C:2');
    });

    it('lists what exists when the name is wrong', () => {
      expect(() => resolveCollection(snapshot, 'Nope')).toThrow(/Primitives \(C:1\), Theme \(C:2\)/);
    });

    it('refuses to guess between two collections with one name', () => {
      const twins = { ...snapshot, collections: [PRIMITIVES, { ...THEME, name: 'Primitives' }] };
      expect(() => resolveCollection(twins, 'Primitives')).toThrow(/2 collections are called/);
    });

    it('suggests near matches for a variable', () => {
      expect(() => resolveVariable(snapshot, 'brand')).toThrow(/Did you mean: color\/brand\/500, color\/brand\/700/);
    });

    it('takes the single mode of a single-mode collection without being told', () => {
      expect(resolveMode(PRIMITIVES, undefined).modeId).toBe('M:1');
    });

    it('REFUSES to pick a mode when the collection has several', () => {
      // The plugin would silently fall back to the first mode. A value written
      // into the wrong theme is the bug this exists to prevent.
      expect(() => resolveMode(THEME, undefined)).toThrow(/has 2 modes \(Light, Dark\)/);
      expect(resolveMode(THEME, 'Dark').modeId).toBe('M:3');
      expect(resolveMode(THEME, 'M:3').name).toBe('Dark');
      expect(() => resolveMode(THEME, 'Midnight')).toThrow(/has no mode "Midnight"/);
    });
  });

  describe('filtering', () => {
    it('filters by collection, group, type and substring', () => {
      expect(filterVariables(snapshot, { collection: 'Primitives' }).map((v) => v.id)).toEqual(['V:1', 'V:2', 'V:3']);
      expect(filterVariables(snapshot, { group: 'color/brand' }).map((v) => v.id)).toEqual(['V:1', 'V:2']);
      expect(filterVariables(snapshot, { group: 'color/brand/' }).map((v) => v.id)).toEqual(['V:1', 'V:2']);
      expect(filterVariables(snapshot, { type: 'float' }).map((v) => v.id)).toEqual(['V:3']);
      expect(filterVariables(snapshot, { name_contains: 'ACCENT' }).map((v) => v.id)).toEqual(['V:4']);
    });

    it('rejects a type Figma does not have rather than returning nothing', () => {
      expect(() => normaliseType('colour')).toThrow(/exactly four/);
    });

    it('names the modes in a row, so a value is readable without a mode id', () => {
      expect(summariseVariable(snapshot, snapshot.variables[3])).toEqual({
        id: 'V:4',
        name: 'surface/accent',
        type: 'COLOR',
        collection: 'Theme',
        values: { Light: '{color/brand/500}', Dark: '{color/brand/700}' },
      });
    });
  });

  describe('the reference graph', () => {
    it('reports references per mode, because they can differ per mode', () => {
      const detail = describeVariable(snapshot, snapshot.variables[3]);
      expect(detail.references).toEqual([
        { mode: 'Light', referencesName: 'color/brand/500', referencesId: 'V:1', referencesCollection: 'Primitives', note: undefined },
        { mode: 'Dark', referencesName: 'color/brand/700', referencesId: 'V:2', referencesCollection: 'Primitives', note: undefined },
      ]);
    });

    it('reports what references a variable, and in which modes', () => {
      const detail = describeVariable(snapshot, snapshot.variables[0]);
      expect(detail.referencedByCount).toBe(1);
      expect(detail.referencedBy[0]).toEqual({ id: 'V:4', name: 'surface/accent', collection: 'Theme', inModes: ['Light'] });
    });

    it('says so when a reference points at nothing local', () => {
      const dangling = {
        ...snapshot,
        variables: snapshot.variables.filter((v) => v.id !== 'V:1'),
      };
      const detail = describeVariable(dangling, dangling.variables.at(-1));
      expect(detail.references[0].referencesId).toBe(null);
      expect(detail.references[0].note).toMatch(/library, or at one that has been deleted/);
    });

    it('warns when two variables share a name, because {name} cannot tell them apart', () => {
      const twins = {
        ...snapshot,
        variables: [...snapshot.variables, { id: 'V:5', collectionId: 'C:2', name: 'color/brand/500', resolvedType: 'COLOR', value: '#fff', valuesByMode: { 'M:2': '#ffffff' } }],
      };
      expect(describeVariable(twins, twins.variables[0]).warning).toMatch(/2 variables in this file are named/);
    });
  });

  describe('what a delete takes with it', () => {
    it('reports the variables left dangling', () => {
      expect(deletionImpact(snapshot, snapshot.variables[0]).referencedBy.map((r) => r.id)).toEqual(['V:4']);
    });

    it('reports the generated shades the plugin deletes in the same step', () => {
      // `deleteVariable` in src/plugin/code.ts walks config.generatedShades and
      // removes every one — so deleting a ramp's source deletes the ramp.
      const withShades = {
        ...snapshot,
        variables: [
          ...snapshot.variables,
          { id: 'V:9', collectionId: 'C:1', name: 'color/brand/100', resolvedType: 'COLOR', value: '#eef', valuesByMode: { 'M:1': '#eeeeff' } },
        ],
        shadeGroups: [
          { sourceVariableId: 'V:1', deleteIds: ['V:9'], config: { generatedShades: [{ id: 'V:9', name: 'color/brand/100' }] } },
        ],
      };
      expect(deletionImpact(withShades, withShades.variables[0]).managedShades).toEqual([
        { id: 'V:9', name: 'color/brand/100' },
      ]);
    });
  });

  describe('the overview the tools start from', () => {
    it('counts variables and lists groups per collection', () => {
      expect(collectionsOverview(snapshot)).toEqual([
        {
          id: 'C:1',
          name: 'Primitives',
          modes: [{ id: 'M:1', name: 'Value' }],
          variableCount: 3,
          groups: [
            { name: 'color', variables: 2 },
            { name: 'color/brand', variables: 2 },
            { name: 'space', variables: 1 },
          ],
        },
        {
          id: 'C:2',
          name: 'Theme',
          modes: [
            { id: 'M:2', name: 'Light' },
            { id: 'M:3', name: 'Dark' },
          ],
          variableCount: 1,
          groups: [{ name: 'surface', variables: 1 }],
        },
      ]);
    });

    it('survives a snapshot with nothing in it', () => {
      expect(collectionsOverview({ collections: [], variables: [] })).toEqual([]);
      expect(filterVariables({})).toEqual([]);
    });
  });
});
