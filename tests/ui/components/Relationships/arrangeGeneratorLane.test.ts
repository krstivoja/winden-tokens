// Arrange Grid with a managed (generated shades / steps) chain among the
// arranged units: the reserved generator lane must not fold two tiers into one
// column. Hide unused makes this intermittent — whether a chain is on the
// visible path decides whether the lane is reserved at all
// (`reserveGeneratorLane = sortedChains.length > 0`, over VISIBLE units only).

import { describe, it, expect } from 'vitest';
import { arrangeGroupsByConnectedBlocks } from '../../../../src/ui/components/Relationships/GroupedGraph/utils';
import {
  GROUP_GAP_X,
  GROUP_GAP_Y,
  SHADER_GROUP_HEADER_FILL,
  STANDARD_GROUP_HEADER_FILL,
} from '../../../../src/ui/components/Relationships/GroupedGraph/constants';
import type {
  ConnectionRecord,
  GroupData,
  VariableNode,
} from '../../../../src/ui/components/Relationships/GroupedGraph/types';

const row = (id: string, name: string, extra: Partial<VariableNode> = {}): VariableNode => ({
  id, name, shortName: name.split('/').pop() || name, displayName: name,
  color: '#ffffff', value: '#ffffff', resolvedValue: '#ffffff', resolvedType: 'COLOR',
  isReference: false, referenceName: null, ...extra,
});

const card = (key: string, sourceGroupName: string, extra: Partial<GroupData> = {}): GroupData => ({
  key, title: key, variables: [row(`v-${key}`, `${sourceGroupName}/base`)],
  x: 0, y: 0, initialX: 0, initialY: 0, kind: 'standard', sourceGroupName,
  headerFill: STANDARD_GROUP_HEADER_FILL, collectionId: 'c', ...extra,
});

const link = (from: GroupData, to: GroupData): ConnectionRecord => ({
  id: `${from.key}->${to.key}`, kind: 'reference',
  fromGroup: from.key, fromVar: from.variables[0].name,
  toGroup: to.key, toVar: to.variables[0].name,
});

// primitive (tier 0) <- semantic (tier 1) <- component (tier 2)
const primitive = card('group:primitive', 'primitive');
const semantic = card('group:semantic', 'semantic');
const component = card('group:component', 'component');
const chainLinks = [link(primitive, semantic), link(semantic, component)];

// A generated-shades chain: source -> shader -> shades.
const source = card('source:red', 'red', { kind: 'source' });
const shader = card('shader:red', 'red', { kind: 'shader', headerFill: SHADER_GROUP_HEADER_FILL });
const shades = card('shades:red', 'red', { kind: 'shades' });
const generatorLinks = [link(source, shader), link(shader, shades)];

describe('Arrange Grid tiers with a generator chain visible', () => {
  it('without a chain, each tier gets its own column', () => {
    const { positions } = arrangeGroupsByConnectedBlocks(
      [primitive, semantic, component], chainLinks, GROUP_GAP_X, GROUP_GAP_Y
    );
    const xs = [primitive, semantic, component].map(g => positions.get(g.key)!.x);
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);
  });

  it('with a chain visible, a tier-2 card still sits right of its tier-1 provider', () => {
    const { positions } = arrangeGroupsByConnectedBlocks(
      [primitive, semantic, component, source, shader, shades],
      [...chainLinks, ...generatorLinks],
      GROUP_GAP_X,
      GROUP_GAP_Y
    );
    // getStandaloneLane maps depth 1 AND depth 2 to lane 2, so the component
    // is stacked in the same column as the semantic card it references.
    expect(positions.get(component.key)!.x).toBeGreaterThan(positions.get(semantic.key)!.x);
  });
});
