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
      className={`tab leading-none p-4 border-2 border-solid border-transparent ${isActive ? 'active font-bold border-b-primary' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
