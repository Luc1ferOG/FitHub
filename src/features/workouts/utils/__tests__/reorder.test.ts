import { reorderItems } from '../reorder';

describe('exercise reorder', () => {
  const items = [{ id: 'a', sets: 2 }, { id: 'b', sets: 4 }, { id: 'c', sets: 6 }];
  it('moves both directions without losing configuration', () => {
    expect(reorderItems(items, 0, 2)).toEqual([items[1], items[2], items[0]]);
    expect(reorderItems(items, 2, 0)).toEqual([items[2], items[0], items[1]]);
    expect(items[0]?.id).toBe('a');
  });
  it.each([[-1, 0], [0, 3], [0.5, 2], [1, 1]])('ignores invalid or unchanged moves %p', (from, to) => {
    expect(reorderItems(items, from, to)).toEqual(items);
  });
});
