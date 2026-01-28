// React icon components - exact same SVGs as before

import React from 'react';

export type VariableType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';

// Type icons (Figma native style)
export const TypeIcons: Record<VariableType, React.ReactElement> = {
  COLOR: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
      <path fill="currentColor" d="M7.312 6.803a7 7 0 0 1 9.639.248l.28.298a7 7 0 0 1 1.76 4.998l-.029.38C18.807 14.222 17.446 15 16.242 15H13.5l-.101.01a.5.5 0 0 0-.4.49v.5c0 .82-.338 1.603-.92 2.127-.6.542-1.468.8-2.37.488a7 7 0 0 1-2.362-1.385l-.297-.28a7 7 0 0 1 0-9.9zm8.93.955a6 6 0 0 0-8.485 0l-.212.225a6 6 0 0 0 2.492 9.689c.978.337 1.848-.457 1.953-1.467L12 16v-.499a1.5 1.5 0 0 1 1.5-1.5h2.743l.158-.006c.733-.057 1.391-.513 1.543-1.216l.024-.155a6 6 0 0 0-1.484-4.611zM8.5 12.001a1 1 0 1 1 0 2 1 1 0 0 1 0-2m7-2a1 1 0 1 1-.001 2 1 1 0 0 1 0-2m-6-1.5a1 1 0 1 1 0 2.001 1 1 0 0 1 0-2m3.5-1a1 1 0 1 1 0 2 1 1 0 0 1 0-2" />
    </svg>
  ),
  FLOAT: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
      <path fill="currentColor" d="M16 6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM8 7a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zm3.05 2.002a.5.5 0 0 1 .448.547l-.045.452h1.495l.055-.55a.5.5 0 0 1 .995.098l-.045.452h.547a.5.5 0 1 1 0 1h-.648l-.199 2h.847a.5.5 0 1 1 0 1h-.948l-.054.548a.501.501 0 0 1-.995-.098l.044-.45h-1.495l-.054.548a.501.501 0 0 1-.995-.098l.044-.45H9.5a.5.5 0 0 1 0-1h.647l.2-2H9.5a.5.5 0 0 1 0-1h.948l.055-.55a.5.5 0 0 1 .546-.449m.302 1.999-.199 2h1.494l.2-2z" />
    </svg>
  ),
  STRING: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
      <path fill="currentColor" fillRule="evenodd" d="M8 7h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1M6 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zm3.5 1a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 1 0V10h1.5v4H11a.5.5 0 0 0 0 1h2a.5.5 0 0 0 0-1h-.5v-4H14v.5a.5.5 0 0 0 1 0v-1a.5.5 0 0 0-.5-.5z" clipRule="evenodd" />
    </svg>
  ),
  BOOLEAN: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
      <path fill="currentColor" fillRule="evenodd" d="M10 8h4a4 4 0 0 1 0 8h-4a4 4 0 0 1 0-8m-5 4a5 5 0 0 1 5-5h4a5 5 0 0 1 0 10h-4a5 5 0 0 1-5-5m5 2a2 2 0 1 1 0-4 2 2 0 0 1 0 4m-3-2a3 3 0 1 1 6 0 3 3 0 0 1-6 0" clipRule="evenodd" />
    </svg>
  ),
};

// UI Icons
export function DragIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16">
      <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16">
      <path d="M13.65 2.35A8 8 0 1 0 16 8h-2a6 6 0 1 1-1.76-4.24L10 6h6V0l-2.35 2.35z" fill="currentColor" />
    </svg>
  );
}

export function ExpandIcon() {
  return (
    <svg viewBox="0 0 16 16">
      <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function CollapseIcon() {
  return (
    <svg viewBox="0 0 16 16">
      <path d="M6 2v4H2M14 6h-4V2M10 14v-4h4M2 10h4v4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 16 16">
      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function ShadesIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14">
      <rect x="1" y="2" width="3" height="12" rx="1" fill="currentColor" opacity="0.2" />
      <rect x="5" y="2" width="3" height="12" rx="1" fill="currentColor" opacity="0.5" />
      <rect x="9" y="2" width="3" height="12" rx="1" fill="currentColor" opacity="0.8" />
      <rect x="13" y="2" width="2" height="12" rx="1" fill="currentColor" />
    </svg>
  );
}

export function StepsIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14">
      <path d="M2 14h3v-3H2v3zm4-5h3v-3H6v3zm4-5h3V1h-3v3z" fill="currentColor" />
      <path d="M2 14l12-12" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12">
      <rect x="2" y="5" width="8" height="9" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 5V3a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12">
      <path d="M5.5 2v1h5V2h-5zM4 4v9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4H4zm2.5 2v5m3-5v5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14">
      <circle cx="6.5" cy="6.5" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 10l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function EditIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12">
      <path d="M11.5 2.5l2 2M3 11l-1 3 3-1 8-8-2-2-8 8z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path fill="currentColor" d="M4 5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-8l-2-2H4z" />
    </svg>
  );
}

// Helper to get type icon
export function TypeIcon({ type }: { type: VariableType }) {
  return TypeIcons[type] || null;
}
