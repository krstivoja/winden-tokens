// Application state management

import { CollectionData, VariableData } from './types';

class AppState {
  collections: CollectionData[] = [];
  variables: VariableData[] = [];
  selectedCollectionId: string | null = null;
  collapsedGroups: Set<string> = new Set();

  setData(collections: CollectionData[], variables: VariableData[]): void {
    this.collections = collections;
    this.variables = variables;
    if (!this.selectedCollectionId && collections.length) {
      this.selectedCollectionId = collections[0].id;
    }
  }

  getFilteredVariables(): VariableData[] {
    return this.variables.filter(v => v.collectionId === this.selectedCollectionId);
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
