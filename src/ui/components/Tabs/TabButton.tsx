// Tab button component

import React from 'react';

interface TabButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

export function TabButton({ label, isActive, onClick }: TabButtonProps) {
  return (
    <button
      className={`tab p-2 ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
