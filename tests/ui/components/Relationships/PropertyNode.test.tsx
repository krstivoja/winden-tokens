import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import type { InspectorEntry, InspectorNodeData } from '../../../../src/ui/types';
import { PropertyNodeComponent } from '../../../../src/ui/components/Relationships/GroupedGraph/PropertyNode';
import { flattenLayers } from '../../../../src/ui/components/Relationships/GroupedGraph/propertyLayers';

const fill: InspectorEntry = {
  category: 'Fill', property: 'Color', kind: 'variable', rawValue: '#FF0000',
  token: { id: 'v1', name: 'color/red' },
  bindingTarget: { kind: 'paint', prop: 'fills', index: 0 },
};
const opacity: InspectorEntry = {
  category: 'Layer', property: 'Opacity', kind: 'hardcoded', rawValue: '1',
  bindingTarget: { kind: 'node-field', field: 'opacity' }, isDefault: true,
};
const fontSize: InspectorEntry = {
  category: 'Text', property: 'Font size', kind: 'hardcoded', rawValue: '14',
  bindingTarget: { kind: 'node-field', field: 'fontSize' },
};

function renderCard(node: InspectorNodeData) {
  const props = {
    id: `selection:${node.id}`,
    data: { nodeName: node.name, nodeType: node.type, layers: flattenLayers(node) },
  } as unknown as React.ComponentProps<typeof PropertyNodeComponent>;
  const utils = render(
    <ReactFlowProvider>
      <PropertyNodeComponent {...props} />
    </ReactFlowProvider>
  );
  const rerenderWith = (next: InspectorNodeData) => {
    const nextProps = {
      ...props,
      data: { nodeName: next.name, nodeType: next.type, layers: flattenLayers(next) },
    } as unknown as React.ComponentProps<typeof PropertyNodeComponent>;
    utils.rerender(
      <ReactFlowProvider>
        <PropertyNodeComponent {...nextProps} />
      </ReactFlowProvider>
    );
  };
  return { ...utils, rerenderWith };
}

const component: InspectorNodeData = {
  id: '1:1', name: 'Button', type: 'COMPONENT', entries: [fill, opacity],
  children: [{ id: '1:2', name: 'Label', type: 'TEXT', entries: [fontSize] }],
};

describe('PropertyNodeComponent', () => {
  it('renders every row for non-component selections', () => {
    renderCard({ id: '2:1', name: 'Box', type: 'FRAME', entries: [fill, opacity] });
    expect(screen.getByText('Fill · Color')).toBeTruthy();
    expect(screen.getByText('Layer · Opacity')).toBeTruthy();
    expect(screen.queryByText('Add property')).toBeNull();
  });

  it('shows child layer sections and hides default rows for components', () => {
    const { container } = renderCard(component);
    expect(screen.getByText('Label')).toBeTruthy();
    expect(screen.getByText('Text · Font size')).toBeTruthy();
    expect(screen.queryByText('Layer · Opacity')).toBeNull();
    expect(container.querySelector('[data-handleid="prop:0:0::in"]')).toBeTruthy();
    expect(container.querySelector('[data-handleid="prop:1:0::in"]')).toBeTruthy();
  });

  it('reveals a hidden row via Add property and drops the control when none remain', () => {
    renderCard(component);
    fireEvent.click(screen.getByText('Add property'));
    fireEvent.click(screen.getByText('Layer · Opacity'));
    expect(screen.getByText('Layer · Opacity')).toBeTruthy();
    expect(screen.queryByText('Add property')).toBeNull();
  });

  it('keeps a row visible after it is unbound to a default value', () => {
    const { rerenderWith } = renderCard(component);
    const unbound: InspectorEntry = { ...fill, kind: 'hardcoded', token: undefined, isDefault: true };
    rerenderWith({ ...component, entries: [unbound, opacity] });
    expect(screen.getByText('Fill · Color')).toBeTruthy();
  });

  it('collapsing a child section hides its rows but keeps bound handles on the header', () => {
    const boundText: InspectorEntry = { ...fill, category: 'Text fill' };
    const { container } = renderCard({
      ...component,
      children: [{ id: '1:2', name: 'Label', type: 'TEXT', entries: [boundText] }],
    });
    fireEvent.click(screen.getByLabelText('Collapse Label'));
    expect(screen.queryByText('Text fill · Color')).toBeNull();
    expect(container.querySelector('[data-handleid="prop:1:0::in"]')).toBeTruthy();
    expect(container.querySelector('[data-handleid="prop:1:0::out"]')).toBeNull();
  });
});
