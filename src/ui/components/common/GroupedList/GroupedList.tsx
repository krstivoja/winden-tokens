// Grouped List component - Bordered list with section headers

import React from 'react';

export interface GroupedListItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  isActive?: boolean;
}

export interface GroupedListSection {
  title: string;
  items: GroupedListItem[];
}

export interface GroupedListProps {
  sections: GroupedListSection[];
  onItemClick: (item: GroupedListItem) => void;
  className?: string;
}

export function GroupedList({ sections, onItemClick, className = '' }: GroupedListProps) {
  return (
    <div className={`flex flex-col max-h-96 overflow-y-auto border border-border rounded ${className}`}>
      {sections.map((section, sectionIndex) => (
        <div key={section.title || `section-${sectionIndex}`} className="flex flex-col">
          {section.title && (
            <div className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase bg-base-2 border-b border-border">
              {section.title}
            </div>
          )}
          {section.items.map((item, itemIndex) => {
            const isLastInSection = itemIndex === section.items.length - 1;
            const isLastSection = sectionIndex === sections.length - 1;
            const showBorder = !isLastInSection || !isLastSection;

            return (
              <button
                key={item.id}
                type="button"
                className={`flex items-center gap-3 px-4 py-3 hover:bg-base-2 transition-colors text-left ${
                  showBorder ? 'border-b border-border' : ''
                } ${item.isActive ? 'bg-base-2' : ''}`}
                onClick={() => onItemClick(item)}
              >
                {item.icon && <div className="shrink-0">{item.icon}</div>}
                <span className="text-sm text-text">{item.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
