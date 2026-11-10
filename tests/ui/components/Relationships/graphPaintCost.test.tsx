// Paint-cost guards for the graph: handles animate only their hover size, and
// graph nodes carry clip-safe paint containment.

import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Position, ReactFlowProvider } from '@xyflow/react';
import { GraphHandle } from '../../../../src/ui/components/Relationships/GroupedGraph/GraphHandle';

function renderHandle() {
  return render(
    <ReactFlowProvider>
      <GraphHandle
        type="source"
        position={Position.Right}
        id="h"
        isConnected={false}
        isConnectable
        connectionColor="red"
        idleColor="blue"
        idleBorderColor="green"
      />
    </ReactFlowProvider>
  );
}

describe('GraphHandle transition', () => {
  it('animates only width/height, not every property', () => {
    const handle = renderHandle().container.querySelector('.react-flow__handle') as HTMLElement;
    // transition-all made every inherited style change on a card (e.g. the
    // visibility flip during a rebuild) start a transition on every handle.
    expect(handle.className).not.toContain('transition-all');
    expect(handle.className).toContain('transition-[width,height]');
    expect(handle.className).toContain('hover:w-4!');
    expect(handle.className).toContain('hover:h-4!');
  });
});

describe('graph node paint containment (main.css)', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '../../../../src/ui/styles/main.css'), 'utf8');
  const block = css.slice(css.indexOf('@supports (overflow-clip-margin: 1px)'));

  it('contains paint on nodes behind an overflow-clip-margin @supports guard', () => {
    expect(css).toContain('@supports (overflow-clip-margin: 1px)');
    expect(block).toMatch(/\.react-flow__node\s*\{[^}]*contain:\s*layout paint style;[^}]*overflow-clip-margin:\s*12px;/);
  });

  it('drops containment while a node holds an open dropdown', () => {
    expect(block).toMatch(/\.react-flow__node:has\(\[data-dropdown-open\]\)\s*\{\s*contain:\s*none;/);
  });
});
