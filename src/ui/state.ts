// Application state management

import { CollectionData, VariableData } from './types';

class AppState {
  collections: CollectionData[] = [];
  variables: VariableData[] = [];
  selectedCollectionId: string | null = null;
  collapsedGroups: Set<string> = new Set();
  searchQuery: string = '';

  setData(collections: CollectionData[], variables: VariableData[]): void {
    this.collections = collections;
    this.variables = variables;
    if (!this.selectedCollectionId && collections.length) {
      this.selectedCollectionId = collections[0].id;
    }
  }

  setSearchQuery(query: string): void {
    this.searchQuery = query.toLowerCase().trim();
  }

  getFilteredVariables(): VariableData[] {
    let filtered = this.variables.filter(v => v.collectionId === this.selectedCollectionId);

    if (this.searchQuery) {
      filtered = filtered.filter(v => v.name.toLowerCase().includes(this.searchQuery));
    }

    return filtered;
  }

  getFilteredCount(): { shown: number; total: number } {
    const total = this.variables.filter(v => v.collectionId === this.selectedCollectionId).length;
    const shown = this.getFilteredVariables().length;
    return { shown, total };
  }

  toggleGroup(groupName: string): void {
    if (this.collapsedGroups.has(groupName)) {
      this.collapsedGroups.delete(groupName);
    } else {
      this.collapsedGroups.add(groupName);
    }
  }

  isGroupCollapsed(groupName: string): boolean {
    return this.collapsedGroups.has(groupName);
  }
}

export const state = new AppState();
