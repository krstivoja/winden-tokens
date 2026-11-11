// The layout's card-height estimate must equal the height the card is drawn
// at, or every gap between two stacked cards comes out smaller than the gap
// the user set in Grid Settings (it used to be 6px short: the card box's 1px
// border and 2px gutter, top and bottom, were missing from the estimate).
//
// jsdom does no layout, so the drawn height cannot be measured here. Instead
// these tests pin both halves of the contract: the estimate's arithmetic, and
// the markup classes that arithmetic is read off. Changing either one alone
// fails a test. The real pixel gaps were verified in headless Chrome.

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { GroupNodeComponent } from '../../../../src/ui/components/Relationships/GroupedGraph/GraphNode';
import { GroupWrapperComponent } from '../../../../src/ui/components/Relationships/GroupedGraph/GraphWrapperNode';
import { buildWrapperLayout } from '../../../../src/ui/components/Relationships/GroupedGraph/wrapperLayout';
import type { WrapperPlacement } from '../../../../src/ui/components/Relationships/GroupedGraph/wrapperLayout';
import {
  getCardHeightForRows,
  getGroupHeight,
} from '../../../../src/ui/components/Relationships/GroupedGraph/utils';
import {
  CARD_CHROME,
  CONTAINER_INSET,
  GROUP_WIDTH,
  STANDARD_GROUP_HEADER_FILL,
  WRAPPER_GAP,
  WRAPPER_HEADER_HEIGHT,
  WRAPPER_PADDING,
} from '../../../../src/ui/components/Relationships/GroupedGraph/constants';
import type {
  GroupData,
  GroupNodeData,
  VariableNode,
  WrapperNodeData,
} from '../../../../src/ui/components/Relationships/GroupedGraph/types';

const noop = () => {};

// Tailwind v4 spacing: 1 unit = 4px. Box-sizing is border-box everywhere.
const BORDER = 1; // `border`
const P_0_5 = 2; // `p-0.5`
const P_2 = 8; // `p-2`
const H_9 = 36; // `h-9`, the header row
const PY_2 = 8; // `py-2`, the rows box, top and bottom
const H_8 = 32; // `h-8`, one variable row (its border-b is inside it)

const row = (id: string): VariableNode => ({
  id,
  name: `g/${id}`,
  shortName: id,
  displayName: id,
  color: '#ffffff',
  value: '#ffffff',
  resolvedValue: '#ffffff',
  resolvedType: 'COLOR',
  isReference: false,
  referenceName: null,
});

const rows = (count: number) => Array.from({ length: count }, (_, i) => row(`v${i}`));

const card = (path: string, rowCount: number): GroupData => ({
  key: `group:c1::${path}`,
  title: path,
  variables: rows(rowCount),
  x: 0, y: 0, initialX: 0, initialY: 0,
  kind: 'standard',
  sourceGroupName: path,
  headerFill: STANDARD_GROUP_HEADER_FILL,
  collectionId: 'c1',
  canGroup: true,
});

const cardData = (group: GroupData): GroupNodeData => ({
  group,
  isColorType: true,
  variableType: 'COLOR',
  connectedVars: new Map(),
  onHighlightPath: noop,
  onHideUnused: noop,
  onHighlightVariable: noop,
  onGeneratorOpen: noop,
  onShowColorMenu: noop,
  onAddVariable: noop,
  onRenameGroup: noop,
  onDuplicateGroup: noop,
  onEditAsText: noop,
  onLevelUp: noop,
  onDeleteGroup: noop,
  onRenameVariable: noop,
  onDeleteVariable: noop,
  onDisconnect: noop,
});

const classesOf = (el: Element | null) => (el?.getAttribute('class') ?? '').split(/\s+/);

describe('card height estimate', () => {
  it.each([1, 2, 3, 6, 11, 20])('a %i-row card: border, gutter, header and rows', (count) => {
    const drawn = 2 * (BORDER + P_0_5) + H_9 + 2 * PY_2 + count * H_8;
    expect(getCardHeightForRows(count)).toBe(drawn);
    expect(getGroupHeight(card('a', count))).toBe(drawn);
  });

  it('the chrome is the same 6px whatever the row count', () => {
    expect(CARD_CHROME * 2).toBe(6);
    expect(getCardHeightForRows(11) - getCardHeightForRows(1)).toBe(10 * H_8);
  });

  it('a container content edge sits inside its ring and the card box', () => {
    expect(CONTAINER_INSET).toBe(BORDER + P_2 + BORDER + P_0_5);
  });
});

describe('the markup the estimate is read off', () => {
  it('a leaf card: bordered, p-0.5 box sized by its content, h-9 header, py-2 rows box of h-8 rows', () => {
    const group = card('a', 3);
    const props = { id: group.key, data: cardData(group) } as unknown as React.ComponentProps<typeof GroupNodeComponent>;
    const { container } = render(
      <ReactFlowProvider>
        <GroupNodeComponent {...props} />
      </ReactFlowProvider>
    );
    const box = container.querySelector('.rf-group-box');
    expect(classesOf(box)).toEqual(expect.arrayContaining(['border', 'p-0.5', 'h-fit!']));
    expect(classesOf(box!.querySelector('.group-header'))).toContain('h-9');
    const rowsBox = box!.querySelector('.group-header + div');
    expect(classesOf(rowsBox)).toContain('py-2');
    expect(rowsBox!.children).toHaveLength(3);
    Array.from(rowsBox!.children).forEach(rowEl => expect(classesOf(rowEl)).toContain('h-8'));
  });

  it('a container: bordered p-2 ring around a bordered p-0.5 card box', () => {
    const data: WrapperNodeData = {
      path: 'a', collectionId: 'c1', title: 'a', onLevelUp: noop, onUngroup: noop, card: null,
    };
    const props = { id: 'wrapper:c1::a', data } as unknown as React.ComponentProps<typeof GroupWrapperComponent>;
    const { container } = render(
      <ReactFlowProvider>
        <GroupWrapperComponent {...props} />
      </ReactFlowProvider>
    );
    expect(classesOf(container.querySelector('.rf-group-outline'))).toEqual(expect.arrayContaining(['border', 'p-2']));
    expect(classesOf(container.querySelector('.rf-group-wrapper'))).toEqual(expect.arrayContaining(['border', 'p-0.5']));
  });
});

describe('a frame keeps WRAPPER_PADDING on every side of its cards', () => {
  it('stacks cards of different heights with exactly WRAPPER_GAP between them', () => {
    const cards = [card('a', 0), card('a/b', 2), card('a/c', 11)];
    const placements = buildWrapperLayout(cards, new Set(['c1::a']), {});
    const frame = placements.find((p): p is WrapperPlacement => p.kind === 'wrapper')!;
    const b = placements.find(p => p.id === 'group:c1::a/b')!;
    const c = placements.find(p => p.id === 'group:c1::a/c')!;

    // Above the first card: the header's bottom edge, then the padding.
    expect(b.position.y).toBe(CONTAINER_INSET + WRAPPER_HEADER_HEIGHT + WRAPPER_PADDING);
    expect(c.position.y - (b.position.y + getCardHeightForRows(2))).toBe(WRAPPER_GAP);
    // Below the last card: the padding, then the content edge.
    expect(frame.height - (c.position.y + getCardHeightForRows(11))).toBe(WRAPPER_PADDING + CONTAINER_INSET);
    // Left and right alike.
    expect(b.position.x).toBe(CONTAINER_INSET + WRAPPER_PADDING);
    expect(frame.width - (b.position.x + GROUP_WIDTH)).toBe(WRAPPER_PADDING + CONTAINER_INSET);
  });
});
