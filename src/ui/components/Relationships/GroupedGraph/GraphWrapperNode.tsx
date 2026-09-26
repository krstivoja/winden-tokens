// GraphWrapperNode - container frame for an expanded group, holding child
// group cards (and nested wrappers) as React Flow child nodes.

import React from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import { Icon } from '../../icons/Icon';
import { IconButton } from '../../common/Button/IconButton/IconButton';
import { WrapperNodeData } from './types';

function GroupWrapperComponentInner({ data }: NodeProps<Node<WrapperNodeData>>) {
  return (
    <div className="rf-group-wrapper w-full h-full rounded-md border border-dashed border-text/30 bg-text/[0.03]">
      <div className="group-header flex items-center justify-between px-3 cursor-move select-none h-9 rounded-t-md bg-base-2/60">
        <span
          className="text-[13px] font-semibold text-text overflow-hidden text-ellipsis whitespace-nowrap"
          title={data.title}
        >
          {data.title}
        </span>
        <div className="flex gap-1 items-center">
          {/* A collection's own frame (empty path) is the root — there is
              nothing above it to level up into. Every other frame levels up
              into its parent path, or into the collection frame when its
              path is top-level. */}
          {data.path !== '' && (
            <IconButton
              icon={<Icon name="collapse-all" size={18} />}
              size="sm"
              variant="ghost"
              aria-label={`Group ${data.title} with its siblings`}
              title="Group with siblings (level up)"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); data.onLevelUp(data.collectionId, data.path); }}
            />
          )}
          <IconButton
            icon={<Icon name="expand-all" size={18} />}
            size="sm"
            variant="ghost"
            aria-label={`Ungroup ${data.title}`}
            title="Ungroup"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); data.onUngroup(data.collectionId, data.path); }}
          />
        </div>
      </div>
    </div>
  );
}

// See GraphNode.tsx — memoized so store updates during a drag don't re-render
// every wrapper frame.
export const GroupWrapperComponent = React.memo(GroupWrapperComponentInner);
