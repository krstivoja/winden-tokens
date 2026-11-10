// TierLabelNode — the quiet "Tier N" caption Arrange Grid draws above each
// dependency tier. A tier is one column, so the caption is one card wide.
// Collection mode reuses it (`kind: 'collection'`) as the column header that
// names the collection above its column.
//
// Deliberately inert: it is a wayfinding aid, not a card. The layout effect
// mounts it with draggable/selectable/connectable/focusable/deletable all
// false and it carries no handles, so xyflow never treats it as a graph
// participant. It is likewise invisible to Arrange Grid's unit folding, to
// `isCardHidden` and to the saved-position record (see isTierLabelNodeId).

import React from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import { TierLabelNodeData } from './types';
import { isCollectionHeader } from './utils';

function TierLabelNodeInner({ data }: NodeProps<Node<TierLabelNodeData>>) {
  // Collection mode's column header: the same caption chrome, the
  // collection's name and nothing else.
  if (isCollectionHeader(data)) {
    return (
      <div className="w-full h-full flex items-end px-1 pb-1 border-b border-border pointer-events-none select-none">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary overflow-hidden text-ellipsis whitespace-nowrap">
          {data.name}
        </span>
      </div>
    );
  }

  const qualifier = data.tier === 1
    ? 'no dependencies'
    : `references tier ${data.tier - 1}`;

  return (
    <div className="w-full h-full flex items-end gap-2 px-1 pb-1 border-b border-border pointer-events-none select-none">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary whitespace-nowrap">
        Tier {data.tier}
      </span>
      <span className="text-[11px] text-text/40 overflow-hidden text-ellipsis whitespace-nowrap">
        {qualifier}
      </span>
    </div>
  );
}

// See GraphNode.tsx — memoized so store updates during a drag don't re-render
// every caption.
export const TierLabelNode = React.memo(TierLabelNodeInner);
