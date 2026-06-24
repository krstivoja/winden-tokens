// GraphWrapperNode - container frame for an expanded group, holding child
// group cards (and nested wrappers) as React Flow child nodes.

import React from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import { Icon } from '../../icons/Icon';
import { IconButton } from '../../common/Button/IconButton/IconButton';
import { WrapperNodeData } from './types';

export function GroupWrapperComponent({ data }: NodeProps<Node<WrapperNodeData>>) {
  return (
    <div className="rf-group-wrapper w-full h-full rounded-md border border-dashed border-text/30 bg-text/[0.03]">
      <div className="group-header flex items-center justify-between px-3 cursor-move select-none h-9 rounded-t-md bg-base-2/60">
        <span className="text-[13px] font-semibold text-text overflow-hidden text-ellipsis whitespace-nowrap">
          {data.title}
        </span>
        <div className="flex gap-1 items-center">
          {data.path.includes('/') && (
            <IconButton
              icon={<Icon name="collapse-all" size={18} />}
              size="sm"
              variant="ghost"
              aria-label={`Group ${data.title} with its siblings`}
              title="Group with siblings (level up)"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); data.onLevelUp(data.path); }}
            />
          )}
          <IconButton
            icon={<Icon name="expand-all" size={18} />}
            size="sm"
            variant="ghost"
            aria-label={`Ungroup ${data.title}`}
            title="Ungroup"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); data.onUngroup(data.path); }}
          />
        </div>
      </div>
    </div>
  );
}
