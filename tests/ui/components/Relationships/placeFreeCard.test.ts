import { placeFreeCard } from '../../../../src/ui/components/Relationships/GroupedGraph/columnLayout';

const packed = new Map([['a', { x: 0, y: 0 }], ['b', { x: 460, y: 700 }]]);
const fallback = { x: 1200, y: 0 };

describe('placeFreeCard', () => {
  it('uses the fallback with nothing stored', () => {
    expect(placeFreeCard(undefined, fallback, packed, 900)).toEqual(fallback);
  });
  it('keeps a stored spot near the grid', () => {
    expect(placeFreeCard({ x: 1500, y: 300 }, fallback, packed, 900)).toEqual({ x: 1500, y: 300 });
  });
  it('drops a stored spot parked far below the grid', () => {
    expect(placeFreeCard({ x: 2768, y: 16552 }, fallback, packed, 900)).toEqual(fallback);
  });
  it('keeps any stored spot in Tier mode (no packed grid)', () => {
    expect(placeFreeCard({ x: 2768, y: 16552 }, fallback, null, 900)).toEqual({ x: 2768, y: 16552 });
  });
});
