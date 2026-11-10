// The "Tier N" caption node and its id namespace.

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TierLabelNode } from '../../../../src/ui/components/Relationships/GroupedGraph/TierLabelNode';
import type { TierLabelNodeData } from '../../../../src/ui/components/Relationships/GroupedGraph/types';
import { isTierLabelNodeId } from '../../../../src/ui/components/Relationships/GroupedGraph/utils';

function renderLabel(data: TierLabelNodeData) {
  const props = { id: 'label', data } as unknown as React.ComponentProps<typeof TierLabelNode>;
  return render(<TierLabelNode {...props} />);
}

describe('TierLabelNode', () => {
  it('renders the tier and its qualifier', () => {
    expect(renderLabel({ tier: 1, x: 0, width: 260 }).container.textContent).toBe('Tier 1no dependencies');
  });

  it('a later tier names the one it references', () => {
    expect(renderLabel({ tier: 2, x: 0, width: 260 }).container.textContent).toBe('Tier 2references tier 1');
  });

  it('collection variant shows the collection name only — no "Tier", no qualifier', () => {
    const { container } = renderLabel({ kind: 'collection', collectionId: 'c1', name: 'color', x: 0, width: 312 });
    expect(container.textContent).toBe('color');
    // Same chrome as a tier caption, the name ellipsized.
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('border-b');
    expect((root.querySelector('span') as HTMLElement).className).toContain('text-ellipsis');
  });
});

describe('isTierLabelNodeId', () => {
  it('matches tier captions, never cards', () => {
    expect(isTierLabelNodeId('tier-label:1')).toBe(true);
    expect(isTierLabelNodeId('group:c1::a')).toBe(false);
    expect(isTierLabelNodeId('wrapper:c1::')).toBe(false);
  });

  it('matches collection column headers too (same namespace)', () => {
    expect(isTierLabelNodeId('tier-label:collection:c1')).toBe(true);
  });
});
