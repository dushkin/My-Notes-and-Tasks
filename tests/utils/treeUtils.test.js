import { sortItems } from '../../src/utils/treeUtils';

describe('treeUtils.sortItems', () => {
  test('returns empty array for invalid input', () => {
    expect(sortItems(null)).toEqual([]);
    expect(sortItems(undefined)).toEqual([]);
  });

  test('sorts folders, notes, and tasks correctly', () => {
    const items = [
      { type: 'task', label: 'b' },
      { type: 'folder', label: 'a' },
      { type: 'note', label: 'c' },
    ];
    const sorted = sortItems(items);
    expect(sorted.map(i => i.type)).toEqual(['folder', 'note', 'task']);
  });
});
