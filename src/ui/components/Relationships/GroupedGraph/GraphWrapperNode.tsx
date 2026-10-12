// GraphWrapperNode — a CONTAINER card.
//
// Part 4: the card IS the container. A grouped path used to produce two
// things — a dashed frame with its own header, and a card with the SAME name
// and a second header inside it. This node is now both: it draws the header,
// the header actions and the rows of the card it absorbed, and holds its
// child cards (and nested containers) as React Flow child nodes.
//
// The only visual difference from a leaf card is the outline: a container is
// DASHED, a leaf is SOLID. Same header, same rows, same actions.

import React from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import { Icon } from '../../icons/Icon';
import { IconButton } from '../../common/Button/IconButton/IconButton';
import { WrapperNodeData } from './types';
import { CardHeaderRow, CardHeaderActions, CardRows } from './GraphNode';
import { STANDARD_GROUP_HEADER_FILL } from './constants';

function GroupWrapperComponentInner({ data }: NodeProps<Node<WrapperNodeData>>) {
  const card = data.card;
  const isHighlighted = !!card?.isHighlighted;
  const isDimmed = !!card?.isDimmed;

  return (
    // The dashed ring, and inside it an ordinary card box. A container is a
    // card WITH an outline around it, not a card whose own border went
    // dashed — so both strokes are drawn, with CONTAINER_OUTLINE_PADDING
    // between them.
    <div
      className={`rf-group-outline w-full h-full rounded-sm border border-dashed p-2 ${isDimmed ? 'border-text/30 opacity-55' : 'border-text/40'} transition-[opacity,box-shadow] duration-150 ${isHighlighted ? 'ring-1 ring-[#EC4899] ring-offset-2 ring-offset-base-2' : ''}`}
    >
      <div className="rf-group-wrapper w-full h-full rounded-sm border border-text/40 bg-base shadow-xs p-0.5">
        <CardHeaderRow
          title={data.title}
          headerFill={card?.group.headerFill ?? STANDARD_GROUP_HEADER_FILL}
          className="rounded-t-sm"
        >
          {/* A collection's own frame (empty path) is the root — there is
              nothing above it to level up into. Every other container levels up
              into its parent path, or into the collection frame when its path is
              top-level. This is the ONLY level-up the container offers: the
              absorbed card's own would fire the identical call. */}
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
          {card && <CardHeaderActions data={card} showLevelUp={false} />}
          <IconButton
            icon={<Icon name="expand-all" size={18} />}
            size="sm"
            variant="ghost"
            aria-label={`Ungroup ${data.title}`}
            title="Ungroup"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); data.onUngroup(data.collectionId, data.path); }}
          />
        </CardHeaderRow>
        {/* Rows only when the absorbed card is on screen. A container with no
            card of its own is a header and nothing else — same chrome, no
            special case. The empty-root line is withheld: true of a row-less
            collection CARD, noise on a container that holds children. */}
        {card && !data.cardHidden && (
          <CardRows data={card} showEmptyState={false} keepLastBorder={!!data.hasChildren} />
        )}
      </div>
    </div>
  );
}

// See GraphNode.tsx — memoized so store updates during a drag don't re-render
// every container.
export const GroupWrapperComponent = React.memo(GroupWrapperComponentInner);
