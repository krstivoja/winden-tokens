import { describe, it, expect } from 'vitest';
import type { CollectionData, VariableData } from '../../../src/ui/types';
import { resolveDisplayColor } from '../../../src/ui/utils/modes';

const collections: CollectionData[] = [
  {
    id: 'c1',
    name: 'Theme',
    modes: [
      { modeId: 'light', name: 'Light' },
      { modeId: 'dark', name: 'Dark' },
    ],
  },
];

function colorVar(name: string, light: string, dark = light): VariableData {
  return {
    id: name,
    collectionId: 'c1',
    name,
    resolvedType: 'COLOR',
    value: light,
    valuesByMode: { light, dark },
  };
}

const variables: VariableData[] = [
  colorVar('accent/50', '#D5E1AE'),
  colorVar('brand/primary', '{accent/50}'),
  colorVar('surface', '#FFFFFF', '#111111'),
  colorVar('loop/a', '{loop/b}'),
  colorVar('loop/b', '{loop/a}'),
];

describe('resolveDisplayColor', () => {
  it('returns a hex color as lowercase hex', () => {
    expect(resolveDisplayColor(collections, variables, '#D5E1AE', 'light')).toBe('#d5e1ae');
  });

  it('converts rgb() to hex', () => {
    expect(resolveDisplayColor(collections, variables, 'rgb(255, 0, 0)', 'light')).toBe('#ff0000');
  });

  it('resolves a single alias', () => {
    expect(resolveDisplayColor(collections, variables, '{accent/50}', 'light')).toBe('#d5e1ae');
  });

  it('resolves a chained alias', () => {
    expect(resolveDisplayColor(collections, variables, '{brand/primary}', 'light')).toBe('#d5e1ae');
  });

  it('resolves an alias per mode', () => {
    expect(resolveDisplayColor(collections, variables, '{surface}', 'light')).toBe('#ffffff');
    expect(resolveDisplayColor(collections, variables, '{surface}', 'dark')).toBe('#111111');
  });

  it('falls back to gray for a dead alias', () => {
    expect(resolveDisplayColor(collections, variables, '{missing/1}', 'light')).toBe('#888888');
  });

  it('terminates on an alias cycle and falls back to gray', () => {
    expect(resolveDisplayColor(collections, variables, '{loop/a}', 'light')).toBe('#888888');
  });

  it('returns non-alias garbage unchanged', () => {
    expect(resolveDisplayColor(collections, variables, 'not a color', 'light')).toBe('not a color');
  });
});
