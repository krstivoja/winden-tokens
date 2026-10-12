// Part 4: the card IS the container.
//
// A grouped path used to produce TWO nodes — a `groupWrapper` frame with its
// own dashed chrome and header, and a `groupNode` card with the SAME name and
// a second header inside it. One thing, drawn twice. These tests pin the
// merged shape: one header, the absorbed card's own rows and actions, its
// children nested in the same box, and a dashed outline as the only thing
// that tells a container from a leaf card.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { GroupWrapperComponent } from '../../../../src/ui/components/Relationships/GroupedGraph/GraphWrapperNode';
import { GroupNodeComponent } from '../../../../src/ui/components/Relationships/GroupedGraph/GraphNode';
import { buildWrapperLayout } from '../../../../src/ui/components/Relationships/GroupedGraph/wrapperLayout';
import type { Placement, WrapperPlacement } from '../../../../src/ui/components/Relationships/GroupedGraph/wrapperLayout';
import {
  buildArrangeUnits,
  buildCollectionCards,
  getCardNodeId,
  getCardRowsHeight,
  getGroupHeight,
  isAbsorbedCard,
} from '../../../../src/ui/components/Relationships/GroupedGraph/utils';
import type { CardVisibilityFilters } from '../../../../src/ui/components/Relationships/GroupedGraph/utils';
import {
  GROUP_PADDING,
  ROW_HEIGHT,
  STANDARD_GROUP_HEADER_FILL,
  WRAPPER_GAP,
  WRAPPER_HEADER_HEIGHT,
  WRAPPER_PADDING,
  CONTAINER_INSET,
} from '../../../../src/ui/components/Relationships/GroupedGraph/constants';
import type {
  GroupData,
  GroupNodeData,
  VariableNode,
  WrapperNodeData,
} from '../../../../src/ui/components/Relationships/GroupedGraph/types';

const noop = () => {};

const row = (id: string, name: string): VariableNode => ({
  id,
  name,
  shortName: name.split('/').pop() || name,
  displayName: name,
  color: '#ffffff',
  value: '#ffffff',
  resolvedValue: '#ffffff',
  resolvedType: 'COLOR',
  isReference: false,
  referenceName: null,
});

const card = (path: string, rows: VariableNode[] = [row(`v:${path}`, `${path}/leaf`)]): GroupData => ({
  key: `group:c1::${path}`,
  title: path,
  variables: rows,
  x: 0, y: 0, initialX: 0, initialY: 0,
  kind: 'standard',
  sourceGroupName: path,
  headerFill: STANDARD_GROUP_HEADER_FILL,
  collectionId: 'c1',
  canGroup: true,
});

const rootCard = (rows: VariableNode[] = []): GroupData =>
  buildCollectionCards(
    [{ id: 'c1', name: 'marko', modes: [{ modeId: 'm1', name: 'Mode 1' }] }],
    new Map(rows.length ? [['c1', rows]] : []),
    0
  )[0];

const cardData = (group: GroupData, overrides: Partial<GroupNodeData> = {}): GroupNodeData => ({
  group,
  isColorType: true,
  variableType: 'COLOR',
  connectedVars: new Map(),
  onHighlightPath: noop,
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
  ...overrides,
});

function renderContainer(overrides: Partial<WrapperNodeData> = {}) {
  const data: WrapperNodeData = {
    path: 'test',
    collectionId: 'c1',
    title: 'test',
    onLevelUp: noop,
    onUngroup: noop,
    card: null,
    ...overrides,
  };
  const props = { id: 'wrapper:c1::test', data } as unknown as React.ComponentProps<typeof GroupWrapperComponent>;
  return render(
    <ReactFlowProvider>
      <GroupWrapperComponent {...props} />
    </ReactFlowProvider>
  );
}

function renderLeafCard(group: GroupData) {
  const props = { id: group.key, data: cardData(group) } as unknown as React.ComponentProps<typeof GroupNodeComponent>;
  return render(
    <ReactFlowProvider>
      <GroupNodeComponent {...props} />
    </ReactFlowProvider>
  );
}

const wrapperAt = (placements: Placement[], id: string): WrapperPlacement =>
  placements.find((p): p is WrapperPlacement => p.kind === 'wrapper' && p.id === id)!;

// ── The absorbed card is the container ─────────────────────────────

describe('a container carries the card it absorbed', () => {
  it('hands the container the card at its own path', () => {
    const placements = buildWrapperLayout([card('test'), card('test/test')], new Set(['c1::test']), {});
    expect(wrapperAt(placements, 'wrapper:c1::test').group?.key).toBe('group:c1::test');
  });

  it('hands the COLLECTION container the collection root card', () => {
    const placements = buildWrapperLayout([rootCard([row('v', 'test')]), card('test')], new Set(['c1::']), {});
    const collectionContainer = wrapperAt(placements, 'wrapper:c1::');
    expect(collectionContainer.group?.key).toBe('collection:c1');
    // Header = the collection NAME, rows = its loose variables.
    expect(collectionContainer.group?.title).toBe('marko');
    expect(collectionContainer.group?.variables.map(v => v.name)).toEqual(['test']);
  });

  it('leaves a grouped path with no card of its own carrying none', () => {
    // `color` is a frame path only: no variable sits directly under it, so
    // there is no `group:c1::color` card to absorb.
    const placements = buildWrapperLayout([card('color/brand')], new Set(['c1::color']), {});
    expect(wrapperAt(placements, 'wrapper:c1::color').group).toBeUndefined();
  });
});

// ── Sizing ─────────────────────────────────────────────────────────

describe('container sizing', () => {
  it('is exactly a card box when it has rows and no children', () => {
    // Header + rows, no trailing dead space: only the dashed outline tells a
    // rows-only container from the leaf card it used to be drawn around.
    const only = card('test', [row('v1', 'test/a'), row('v2', 'test/b')]);
    const placements = buildWrapperLayout([only], new Set(['c1::test']), {});

    expect(wrapperAt(placements, 'wrapper:c1::test').height)
      .toBe(CONTAINER_INSET * 2 + WRAPPER_HEADER_HEIGHT + 2 * ROW_HEIGHT + GROUP_PADDING * 2);
  });

  it('stacks its children BELOW its own rows', () => {
    const own = card('test', [row('v1', 'test/a')]);
    const child = card('test/test', [row('v2', 'test/test/x')]);
    const placements = buildWrapperLayout([own, child], new Set(['c1::test']), {});

    const childPlacement = placements.find(p => p.id === 'group:c1::test/test')!;
    // The rows push the first child down by exactly their height.
    expect(childPlacement.position.y)
      .toBe(CONTAINER_INSET + WRAPPER_HEADER_HEIGHT + getCardRowsHeight(own) + WRAPPER_PADDING);
    expect(wrapperAt(placements, 'wrapper:c1::test').height)
      .toBe(CONTAINER_INSET * 2 + WRAPPER_HEADER_HEIGHT + getCardRowsHeight(own)
        + WRAPPER_PADDING + getGroupHeight(child) + WRAPPER_PADDING);
  });

  it('keeps the empty-frame minimum when it absorbed nothing', () => {
    const placements = buildWrapperLayout([card('color/brand')], new Set(['c1::color']), {});
    const container = wrapperAt(placements, 'wrapper:c1::color');
    expect(container.height).toBe(
      CONTAINER_INSET * 2 + WRAPPER_HEADER_HEIGHT + WRAPPER_PADDING
        + getGroupHeight(card('color/brand')) + WRAPPER_PADDING
    );
  });

  it('gives a row-less container no body at all — no one-row floor', () => {
    // getGroupHeight floors an empty collection CARD at one row, for its "No
    // variables yet" line. A container never shows that line, so it must not
    // reserve the space either.
    expect(getCardRowsHeight(rootCard())).toBe(0);
    expect(getCardRowsHeight(rootCard([row('v', 'test')]))).toBe(ROW_HEIGHT + GROUP_PADDING * 2);
    expect(getCardRowsHeight(undefined)).toBe(0);
  });
});

// ── Identity ───────────────────────────────────────────────────────

describe('absorbed card identity', () => {
  it('reports a card as absorbed only when a frame sits at its own path', () => {
    expect(isAbsorbedCard(card('test'), new Set(['c1::test']))).toBe(true);
    expect(isAbsorbedCard(card('test'), new Set(['c1::']))).toBe(false);
    // Another collection's frame never claims it.
    expect(isAbsorbedCard(card('test'), new Set(['c2::test']))).toBe(false);
    // The collection ROOT card's own path is the empty one.
    expect(isAbsorbedCard(rootCard(), new Set(['c1::']))).toBe(true);
    expect(isAbsorbedCard(rootCard(), new Set(['c1::test']))).toBe(false);
  });

  it('routes an absorbed card\'s edges to the container node id', () => {
    // The container KEEPS the `wrapper:` id (no second graph-positions
    // migration), so every edge endpoint has to be resolved through here.
    expect(getCardNodeId(card('test'), new Set(['c1::test']))).toBe('wrapper:c1::test');
    expect(getCardNodeId(card('test'), new Set())).toBe('group:c1::test');
    expect(getCardNodeId(rootCard(), new Set(['c1::']))).toBe('wrapper:c1::');
  });
});

// ── Arrange ────────────────────────────────────────────────────────

describe('Arrange sizes a unit whose card was absorbed', () => {
  const filters: CardVisibilityFilters = {
    selectedCollections: new Set(['c1']),
    selectedTypes: new Set(['COLOR']),
    selectedGroups: new Set(['c1::test', 'c1::test/test']),
    variablesById: new Map([
      ['v:test', { id: 'v:test', collectionId: 'c1', name: 'test/leaf', resolvedType: 'COLOR', value: '#fff', valuesByMode: {} }],
      ['v:test/test', { id: 'v:test/test', collectionId: 'c1', name: 'test/test/leaf', resolvedType: 'COLOR', value: '#fff', valuesByMode: {} }],
    ]),
  };

  it('counts the absorbed card as ROWS, not as a stacked card', () => {
    const own = card('test');
    const child = card('test/test');
    const { heightOverrides } = buildArrangeUnits(
      [own, child],
      new Set(['c1::test']),
      filters,
      new Map()
    );

    // The same number buildWrapperLayout computes, so the frame Arrange
    // reserves room for is the frame that is drawn.
    expect(heightOverrides.get('wrapper:c1::test')).toBe(
      CONTAINER_INSET * 2 + WRAPPER_HEADER_HEIGHT + getCardRowsHeight(own)
        + getGroupHeight(child) + WRAPPER_PADDING * 2
    );
    const placements = buildWrapperLayout([own, child], new Set(['c1::test']), {});
    expect(heightOverrides.get('wrapper:c1::test'))
      .toBe(wrapperAt(placements, 'wrapper:c1::test').height);
  });

  it('is unchanged when nothing is absorbed', () => {
    // Regression guard for the pre-part-4 formula: two cards under a frame
    // path neither of them owns are still stacked with a gap between them.
    const a = card('test/one');
    const b = card('test/two');
    const { heightOverrides } = buildArrangeUnits([a, b], new Set(['c1::test']), filters, new Map());
    expect(heightOverrides.get('wrapper:c1::test')).toBe(
      getGroupHeight(a) + WRAPPER_GAP + getGroupHeight(b)
      + CONTAINER_INSET * 2 + WRAPPER_HEADER_HEIGHT + WRAPPER_PADDING * 2
    );
  });
});

// ── Rendering: one header, one set of actions ──────────────────────

describe('GroupWrapperComponent — the container renders as a card', () => {
  it('draws ONE header, carrying the absorbed card\'s rows beneath it', () => {
    const { container } = renderContainer({ card: cardData(card('test', [row('v1', 'test/red')])) });

    expect(container.querySelectorAll('.group-header')).toHaveLength(1);
    expect(screen.getByTitle('test/red (double-click to rename)')).toBeInTheDocument();
  });

  it('offers the card\'s own actions — add and the actions dropdown', () => {
    const onAddVariable = vi.fn();
    renderContainer({ card: cardData(card('test'), { onAddVariable }) });

    fireEvent.click(screen.getByLabelText('Add variable to test'));
    expect(onAddVariable).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Open actions for test')).toBeInTheDocument();
  });

  it('offers level-up exactly ONCE, from the container', () => {
    // Both the absorbed card and the frame used to render a level-up button
    // firing the identical onLevelUp(collectionId, path) — the duplication
    // part 4 exists to remove.
    const onLevelUp = vi.fn();
    const cardLevelUp = vi.fn();
    renderContainer({ card: cardData(card('test'), { onLevelUp: cardLevelUp }), onLevelUp });

    const buttons = screen.getAllByLabelText('Group test with its siblings');
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(onLevelUp).toHaveBeenCalledWith('c1', 'test');
    expect(cardLevelUp).not.toHaveBeenCalled();
  });

  it('keeps its own ungroup alongside the card actions', () => {
    const onUngroup = vi.fn();
    renderContainer({ card: cardData(card('test')), onUngroup });

    fireEvent.click(screen.getByLabelText('Ungroup test'));
    expect(onUngroup).toHaveBeenCalledWith('c1', 'test');
  });

  it('is a normal card box inside a DASHED ring — not a card gone dashed', () => {
    const { container: containerEl } = renderContainer({ card: cardData(card('test')) });
    // The ring carries the dashed stroke; the card box inside it keeps the
    // solid border, shadow and gutter a leaf card has. Both are drawn.
    const ring = containerEl.querySelector('.rf-group-outline')!;
    expect(ring.className).toContain('border-dashed');

    const box = containerEl.querySelector('.rf-group-wrapper')!;
    expect(box.className).not.toContain('border-dashed');
    expect(box.className).toContain('shadow-xs');
    expect(ring.contains(box)).toBe(true);

    const { container: leafEl } = renderLeafCard(card('other'));
    expect(leafEl.querySelector('.rf-group-box')!.className).not.toContain('border-dashed');
  });

  it('renders a collection container with the collection name, the "+" and no group-only actions', () => {
    renderContainer({
      path: '',
      title: 'marko',
      card: cardData(rootCard([row('v', 'test')])),
    });

    expect(screen.getByTitle('marko')).toHaveTextContent('marko');
    expect(screen.getByLabelText('Add variable to marko')).toBeInTheDocument();
    // A collection root has no group path, so no rename/duplicate/delete…
    expect(screen.queryByLabelText('Open actions for marko')).toBeNull();
    // …and nothing above it to level up into.
    expect(screen.queryByLabelText('Group marko with its siblings')).toBeNull();
    expect(screen.getByLabelText('Ungroup marko')).toBeInTheDocument();
  });

  it('never claims an empty root — noise on a container that holds children', () => {
    renderContainer({ path: '', title: 'marko', card: cardData(rootCard()) });
    expect(screen.queryByText('No variables at the collection root')).toBeNull();
  });

  it('draws no row strip at all when the absorbed card has no rows', () => {
    // Otherwise the padded strip would sit — and, with children, put a stray
    // separator — above the children, in space nothing reserved.
    const { container } = renderContainer({
      path: '', title: 'marko', card: cardData(rootCard()), hasChildren: true,
    });
    expect(container.querySelectorAll('div.h-8.border-b')).toHaveLength(0);
  });

  it('keeps the last own row separated from the children below it', () => {
    const withChildren = renderContainer({
      card: cardData(card('test', [row('v1', 'test/a'), row('v2', 'test/b')])),
      hasChildren: true,
    });
    const rows = Array.from(withChildren.container.querySelectorAll('div.h-8.border-b'));
    expect(rows).toHaveLength(2);
    // The last row keeps its bottom border: the children follow it, so it is
    // no longer the last thing in the box.
    rows.forEach(r => expect(r.className).not.toContain('last:border-b-0'));
    withChildren.unmount();

    // With nothing below, it behaves like a leaf card's last row.
    const leafLike = renderContainer({
      card: cardData(card('test', [row('v1', 'test/a'), row('v2', 'test/b')])),
    });
    Array.from(leafLike.container.querySelectorAll('div.h-8.border-b'))
      .forEach(r => expect(r.className).toContain('last:border-b-0'));
  });

  it('withholds its rows while its own card is filtered out', () => {
    // The container stays on screen because its children are visible; its own
    // rows (and their handles) go, exactly as a hidden card node does.
    renderContainer({ card: cardData(card('test', [row('v1', 'test/red')])), cardHidden: true });
    expect(screen.queryByTitle('test/red (double-click to rename)')).toBeNull();
    // The header and its actions stay — the children still need them.
    expect(screen.getByLabelText('Ungroup test')).toBeInTheDocument();
  });

  it('draws a header and nothing else when it absorbed no card', () => {
    const { container } = renderContainer();
    expect(container.querySelectorAll('.group-header')).toHaveLength(1);
    expect(screen.getByLabelText('Ungroup test')).toBeInTheDocument();
    expect(screen.queryByLabelText('Add variable to test')).toBeNull();
    expect(screen.queryByLabelText('Open actions for test')).toBeNull();
  });
});
