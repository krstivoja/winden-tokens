// Types for group-based relationships view

export interface GroupData {
  name: string;
  variables: VariableNode[];
  x: number;
  y: number;
}

export interface VariableNode {
  id: string;
  name: string;
  displayName: string;
  color: string;
  value: string;
  isReference: boolean;
  referenceName: string | null;
}

export interface Connection {
  id: string;
  fromGroupIndex: number;
  fromVarIndex: number;
  toGroupIndex: number;
  toVarIndex: number;
}

export interface ViewState {
  zoom: number;
  panX: number;
  panY: number;
}
