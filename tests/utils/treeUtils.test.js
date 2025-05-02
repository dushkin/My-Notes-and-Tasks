// tests/utils/treeUtils.test.js
import { sortItems, handleDrop } from '../../src/utils/treeUtils'; // Import handleDrop

// --- Tests for sortItems ---
describe('treeUtils.sortItems', () => {
  test('returns empty array for invalid input', () => {
    expect(sortItems(null)).toEqual([]);
    expect(sortItems(undefined)).toEqual([]);
    expect(sortItems({})).toEqual([]);
  });

   test('returns a new sorted array, does not mutate original', () => {
    const items = [{ type: 'note', label: 'b' }, { type: 'folder', label: 'a' }];
    const originalItems = [...items]; // Shallow copy for comparison
    const sorted = sortItems(items);
    expect(sorted).not.toBe(items); // Should be a new array instance
    expect(items).toEqual(originalItems); // Original should be unchanged
    expect(sorted[0].label).toBe('a');
    expect(sorted[1].label).toBe('b');
  });


  test('sorts folders first, then notes, then tasks', () => {
    const items = [
      { type: 'task', label: 'Task A' },
      { type: 'folder', label: 'Folder C' },
      { type: 'note', label: 'Note B' },
      { type: 'folder', label: 'Folder A'},
      { type: 'task', label: 'Task B'},
      { type: 'note', label: 'Note A'},
    ];
    const sorted = sortItems(items);
    expect(sorted.map(i => i.label)).toEqual([
        'Folder A',
        'Folder C',
        'Note A',
        'Note B',
        'Task A',
        'Task B',
    ]);
     expect(sorted.map(i => i.type)).toEqual([
        'folder',
        'folder',
        'note',
        'note',
        'task',
        'task',
    ]);
  });

   test('sorts items of same type alphabetically by label', () => {
    const items = [
      { type: 'folder', label: 'Z' },
      { type: 'folder', label: 'A' },
      { type: 'note', label: 'X' },
       { type: 'note', label: 'Y' },
    ];
    const sorted = sortItems(items);
    expect(sorted.map(i => i.label)).toEqual(['A', 'Z', 'X', 'Y']);
  });

  test('handles items with children correctly (does not sort children)', () => {
     const items = [
        { type: 'folder', label: 'B', children: [{ type: 'note', label: 'Z'}] },
        { type: 'folder', label: 'A', children: [{ type: 'note', label: 'X'}] },
     ];
      const sorted = sortItems(items);
      expect(sorted.map(i => i.label)).toEqual(['A', 'B']);
      // Ensure children arrays themselves are not sorted by this function
      expect(sorted[0].children[0].label).toBe('X');
      expect(sorted[1].children[0].label).toBe('Z');
  });

});


// --- Tests for handleDrop ---
describe('treeUtils.handleDrop', () => {
  let initialTree;

  beforeEach(() => {
      // Reset tree before each drop test
      initialTree = [
        { id: 'root-f1', type: 'folder', label: 'Folder 1', children: [
            { id: 'f1-n1', type: 'note', label: 'Note 1.1' },
            { id: 'f1-f1', type: 'folder', label: 'Folder 1.1', children: [
                { id: 'f1f1-t1', type: 'task', label: 'Task 1.1.1'}
            ]}
        ]},
        { id: 'root-f2', type: 'folder', label: 'Folder 2', children: [] },
        { id: 'root-n1', type: 'note', label: 'Note 1' }
      ];
  });

  test('returns null if targetId or draggedId is missing', () => {
    expect(handleDrop(initialTree, null, 'f1-n1')).toBeNull();
    expect(handleDrop(initialTree, 'root-f2', null)).toBeNull();
  });

  test('returns null if targetId equals draggedId', () => {
    expect(handleDrop(initialTree, 'root-f2', 'root-f2')).toBeNull();
  });

  test('returns null if targetItem is not found', () => {
     expect(handleDrop(initialTree, 'invalid-target', 'f1-n1')).toBeNull();
  });

   test('returns null if targetItem is not a folder', () => {
     expect(handleDrop(initialTree, 'root-n1', 'f1-n1')).toBeNull(); // Target is note
  });

   test('returns null if draggedItem is not found', () => {
      // Simulate dragged item missing (should ideally not happen in real use)
       expect(handleDrop(initialTree, 'root-f2', 'invalid-dragged')).toBeNull();
   });

    test('returns null if dropping a folder into itself or a descendant', () => {
      // Drop root-f1 into itself
      expect(handleDrop(initialTree, 'root-f1', 'root-f1')).toBeNull();
      // Drop root-f1 into its child folder f1-f1
      expect(handleDrop(initialTree, 'f1-f1', 'root-f1')).toBeNull();
   });

    test('successfully moves a note into an empty folder', () => {
        const newTree = handleDrop(initialTree, 'root-f2', 'root-n1');
        expect(newTree).not.toBeNull();
        expect(newTree.length).toBe(2); // root-n1 removed from root

        const targetFolder = newTree.find(i => i.id === 'root-f2');
        expect(targetFolder.children.length).toBe(1);
        expect(targetFolder.children[0].id).toBe('root-n1'); // Original item moved
        expect(targetFolder.children[0].label).toBe('Note 1');

         // Ensure original location is empty
        expect(newTree.find(i => i.id === 'root-n1')).toBeUndefined();
    });

    test('successfully moves a note into a non-empty folder and sorts', () => {
        const newTree = handleDrop(initialTree, 'root-f1', 'root-n1');
        expect(newTree).not.toBeNull();
        expect(newTree.length).toBe(2); // root-n1 removed

        const targetFolder = newTree.find(i => i.id === 'root-f1');
        expect(targetFolder.children.length).toBe(3); // f1-n1, f1-f1, root-n1
        // Check sort order (folder, note, note)
        expect(targetFolder.children.map(c => c.label)).toEqual(['Folder 1.1', 'Note 1', 'Note 1.1']);
        expect(targetFolder.children.map(c => c.type)).toEqual(['folder', 'note', 'note']);
    });

     test('successfully moves a folder into another folder', () => {
         const newTree = handleDrop(initialTree, 'root-f2', 'root-f1');
         expect(newTree).not.toBeNull();
         expect(newTree.length).toBe(2); // root-f1 removed

         const targetFolder = newTree.find(i => i.id === 'root-f2');
         expect(targetFolder.children.length).toBe(1);
         expect(targetFolder.children[0].id).toBe('root-f1');
         expect(targetFolder.children[0].label).toBe('Folder 1');
         expect(targetFolder.children[0].children.length).toBe(2); // Check children moved too
     });

      test('returns a new tree instance (immutability)', () => {
        const newTree = handleDrop(initialTree, 'root-f2', 'root-n1');
        expect(newTree).not.toBe(initialTree); // Should be a new array
        // Check nested objects too (simple check)
         const originalTarget = initialTree.find(i => i.id === 'root-f2');
         const newTarget = newTree.find(i => i.id === 'root-f2');
         expect(newTarget).not.toBe(originalTarget); // Parent folder should be a new object
         expect(newTarget.children[0]).not.toBe(initialTree.find(i => i.id === 'root-n1')); // Moved item should be a copy
    });
});