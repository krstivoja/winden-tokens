// React icon components - now using Icon component for consistent sizing and currentColor support

import React from 'react';
import { Icon } from './icons/Icon';

export type VariableType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';

// Type icons (Figma native style)
export const TypeIcons: Record<VariableType, React.ReactElement> = {
  COLOR: <Icon name="color" />,
  FLOAT: <Icon name="float" />,
  STRING: <Icon name="string" />,
  BOOLEAN: <Icon name="boolean" />,
};

// UI Icons - all using Icon component with 24x24 size and currentColor
export function DragIcon() {
  return <Icon name="drag" />;
}

export function PlusIcon() {
  return <Icon name="plus" />;
}

export function CloseIcon() {
  return <Icon name="close" />;
}

export function RefreshIcon() {
  return <Icon name="refresh" />;
}

export function UndoIcon() {
  return <Icon name="undo" />;
}

export function RedoIcon() {
  return <Icon name="redo" />;
}

export function ExpandIcon() {
  return <Icon name="expand" />;
}

export function CollapseIcon() {
  return <Icon name="collapse" />;
}

export function ExpandAllIcon() {
  return <Icon name="expand-all" />;
}

export function CollapseAllIcon() {
  return <Icon name="collapse-all" />;
}

export function ChevronDownIcon() {
  return <Icon name="triangle" />;
}

export function ShadesIcon() {
  return <Icon name="shades" />;
}

export function StepsIcon() {
  return <Icon name="steps" />;
}

export function CopyIcon() {
  return <Icon name="copy" />;
}

export function TrashIcon() {
  return <Icon name="trash" />;
}

export function SearchIcon() {
  return <Icon name="search" />;
}

export function EditIcon() {
  return <Icon name="edit" />;
}

export function FolderIcon() {
  return <Icon name="folder" />;
}

// Helper to get type icon
export function TypeIcon({ type }: { type: VariableType }) {
  return TypeIcons[type] || null;
}

export function RelationshipsIcon() {
  return <Icon name="relationships" />;
}
