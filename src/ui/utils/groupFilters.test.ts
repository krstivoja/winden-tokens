import { describe, expect, it } from 'vitest';
import { getCollectionGroupKey, getVariableGroupName, isVariableVisibleForGroupFilters } from './groupFilters';

describe('groupFilters', () => {
  it('returns the full group path for grouped variables', () => {
    expect(getVariableGroupName('red copy/500')).toBe('red copy');
    expect(getVariableGroupName('colors/brand/500')).toBe('colors/brand');
  });

  it('returns null for ungrouped variables', () => {
    expect(getVariableGroupName('accent')).toBeNull();
  });

  it('filters grouped variables by collection-scoped group keys', () => {
    const selectedGroups = new Set([getCollectionGroupKey('colors', 'marko')]);

    expect(
      isVariableVisibleForGroupFilters(
        { collectionId: 'colors', name: 'red copy/500' },
        selectedGroups
      )
    ).toBe(false);

    expect(
      isVariableVisibleForGroupFilters(
        { collectionId: 'colors', name: 'marko/500' },
        selectedGroups
      )
    ).toBe(true);
  });

  it('does not leak the same group name across collections', () => {
    const selectedGroups = new Set([getCollectionGroupKey('collection-a', 'red copy')]);

    expect(
      isVariableVisibleForGroupFilters(
        { collectionId: 'collection-a', name: 'red copy/500' },
        selectedGroups
      )
    ).toBe(true);

    expect(
      isVariableVisibleForGroupFilters(
        { collectionId: 'collection-b', name: 'red copy/500' },
        selectedGroups
      )
    ).toBe(false);
  });

  it('keeps ungrouped variables visible', () => {
    const selectedGroups = new Set([getCollectionGroupKey('colors', 'marko')]);

    expect(
      isVariableVisibleForGroupFilters(
        { collectionId: 'colors', name: 'red copy' },
        selectedGroups
      )
    ).toBe(true);
  });

  it('hides grouped variables when no groups are selected', () => {
    expect(
      isVariableVisibleForGroupFilters(
        { collectionId: 'colors', name: 'red copy/500' },
        new Set()
      )
    ).toBe(false);
  });
});
