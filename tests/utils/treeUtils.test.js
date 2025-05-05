// tests/utils/treeUtils.test.js
import {
  sortItems,
  handleDrop,
  deleteItemRecursive,
  renameItemRecursive,
  insertItemRecursive,
  findItemById,
  findParentAndSiblings,
  hasSiblingWithName,
  isSelfOrDescendant
} from '../../src/utils/treeUtils';

// --- Tests for sortItems ---
describe('treeUtils.sortItems', () => {
  test('returns empty array for invalid input', () => {
    expect(sortItems(null)).toEqual([]);
    expect(sortItems(undefined)).toEqual([]);
    expect(sortItems({})).toEqual([]);
    expect(sortItems("string")).toEqual([]);
  });

  test('returns a new sorted array, does not mutate original', () => {
    const items = [{ type: 'note', label: 'b', id: '2' }, { type: 'folder', label: 'a', id: '1' }];
    const originalItems = [...items]; // Shallow copy for comparison
    const sorted = sortItems(items);
    expect(sorted).not.toBe(items); // Should be a new array instance
    expect(items).toEqual(originalItems); // Original should be unchanged
    expect(sorted[0].label).toBe('a');
    expect(sorted[1].label).toBe('b');
  });

  test('sorts folders first, then notes, then tasks, then alphabetically', () => {
    const items = [
      { id: 't1', type: 'task', label: 'Task A' },
      { id: 'f1', type: 'folder', label: 'Folder C' },
      { id: 'n1', type: 'note', label: 'Note B' },
      { id: 'f2', type: 'folder', label: 'Folder A'},
      { id: 't2', type: 'task', label: 'Task B'},
      { id: 'n2', type: 'note', label: 'Note A'},
      { id: 'f3', type: 'folder', label: 'Folder B'}, // Added for testing alpha sort within type
    ];
    const sorted = sortItems(items);
    expect(sorted.map(i => i.label)).toEqual([
        'Folder A', // folder, A
        'Folder B', // folder, B
        'Folder C', // folder, C
        'Note A',   // note, A
        'Note B',   // note, B
        'Task A',   // task, A
        'Task B',   // task, B
    ]);
     expect(sorted.map(i => i.type)).toEqual([
        'folder', 'folder', 'folder', 'note', 'note', 'task', 'task',
    ]);
  });

  test('handles items with missing/null properties gracefully', () => {
     const items = [
        { id: '1', type: 'folder', label: 'A' },
        { id: '2', type: null, label: 'B' }, // null type
        { id: '3', type: 'note' }, // missing label
        { id: '4' }, // missing type and label
        { id: '5', type: 'task', label: 'C'},
     ];
     // Expect sorting without throwing an error
     expect(() => sortItems(items)).not.toThrow();
     // Basic check - folder should likely come first
     const sorted = sortItems(items);
     expect(sorted[0].label).toBe('A');
     // The exact order of null/missing might depend on localeCompare behavior with undefined/null
  });

  test('handles items with children correctly (does not sort children)', () => {
     const items = [
        { id: 'f1', type: 'folder', label: 'B', children: [{ id: 'f1n1', type: 'note', label: 'Z'}] },
        { id: 'f2', type: 'folder', label: 'A', children: [{ id: 'f2n1', type: 'note', label: 'X'}] },
     ];
      const sorted = sortItems(items);
      expect(sorted.map(i => i.label)).toEqual(['A', 'B']);
      // Ensure children arrays themselves are not sorted by this function
      expect(sorted[0].children[0].label).toBe('X');
      expect(sorted[1].children[0].label).toBe('Z');
  });
});

// --- Tests for findItemById ---
describe('treeUtils.findItemById', () => {
    const tree = [
        { id: 'f1', type: 'folder', label: 'F1', children: [
            { id: 'f1n1', type: 'note', label: 'N1' },
            { id: 'f1f1', type: 'folder', label: 'F11', children: [
                { id: 'f1f1t1', type: 'task', label: 'T1' }
            ]}
        ]},
        { id: 'f2', type: 'folder', label: 'F2', children: [] },
        { id: 'n2', type: 'note', label: 'N2' }
    ];

    test('returns the item if found at root', () => {
        expect(findItemById(tree, 'n2')).toBe(tree[2]);
    });

    test('returns the item if found nested', () => {
        expect(findItemById(tree, 'f1n1')).toBe(tree[0].children[0]);
        expect(findItemById(tree, 'f1f1t1')).toBe(tree[0].children[1].children[0]);
    });

    test('returns null if item not found', () => {
        expect(findItemById(tree, 'nonexistent')).toBeNull();
    });

    test('returns null for invalid input', () => {
        expect(findItemById(null, 'f1')).toBeNull();
        expect(findItemById(tree, null)).toBeNull();
        expect(findItemById([], 'f1')).toBeNull();
    });
});

// --- Tests for findParentAndSiblings ---
describe('treeUtils.findParentAndSiblings', () => {
     const tree = [
        { id: 'f1', type: 'folder', label: 'F1', children: [
            { id: 'f1n1', type: 'note', label: 'N1' },
            { id: 'f1f1', type: 'folder', label: 'F11', children: [
                { id: 'f1f1t1', type: 'task', label: 'T1' }
            ]}
        ]},
        { id: 'f2', type: 'folder', label: 'F2', children: [] },
        { id: 'n2', type: 'note', label: 'N2' }
    ];
     const treeWithEmptyFolder = [
        { id: 'f1', type: 'folder', label: 'F1', children: [] }
     ]

    test('returns correct parent and siblings for root item', () => {
        const result = findParentAndSiblings(tree, 'n2');
        expect(result.parent).toBeNull();
        expect(result.siblings).toBe(tree); // Should be the root array itself
        expect(result.siblings.length).toBe(3);
    });

     test('returns correct parent and siblings for nested item', () => {
        const result = findParentAndSiblings(tree, 'f1n1');
        expect(result.parent).toBe(tree[0]); // Parent should be f1
        expect(result.siblings).toBe(tree[0].children); // Siblings are children of f1
        expect(result.siblings.length).toBe(2);
    });

     test('returns correct parent and siblings for deeply nested item', () => {
        const result = findParentAndSiblings(tree, 'f1f1t1');
        expect(result.parent).toBe(tree[0].children[1]); // Parent should be f1f1
        expect(result.siblings).toBe(tree[0].children[1].children); // Siblings are children of f1f1
        expect(result.siblings.length).toBe(1);
     });

     test('returns null parent and empty siblings if item not found', () => {
        const result = findParentAndSiblings(tree, 'nonexistent');
        expect(result.parent).toBeNull();
        expect(result.siblings).toEqual([]);
     });

     test('returns null parent and root siblings if itemId is null', () => {
        const result = findParentAndSiblings(tree, null);
        expect(result.parent).toBeNull();
        expect(result.siblings).toBe(tree);
     });

     test('returns empty siblings for invalid tree input', () => {
         const result = findParentAndSiblings(null, 'f1');
         expect(result.parent).toBeNull();
         expect(result.siblings).toEqual([]);
     });
     test('handles empty children array correctly', () => {
        const result = findParentAndSiblings(treeWithEmptyFolder, 'f1');
        expect(result.parent).toBeNull();
        expect(result.siblings).toBe(treeWithEmptyFolder);
     });
});

// --- Tests for hasSiblingWithName ---
describe('treeUtils.hasSiblingWithName', () => {
    const siblings = [
        { id: '1', label: 'Apple' },
        { id: '2', label: 'Banana ' }, // Note trailing space
        { id: '3', label: 'cherry' },
        { id: '4', label: null }, // Null label
        { id: '5' } // Missing label
    ];

    test('returns true if name exists (case-insensitive, trimmed)', () => {
        expect(hasSiblingWithName(siblings, 'apple')).toBe(true);
        expect(hasSiblingWithName(siblings, ' APPLE ')).toBe(true);
        expect(hasSiblingWithName(siblings, 'Banana')).toBe(true); // Trimmed match
        expect(hasSiblingWithName(siblings, 'Cherry')).toBe(true);
    });

    test('returns false if name does not exist', () => {
        expect(hasSiblingWithName(siblings, 'Orange')).toBe(false);
        expect(hasSiblingWithName(siblings, 'Appl')).toBe(false);
    });

    test('returns false for invalid input', () => {
        expect(hasSiblingWithName(null, 'Apple')).toBe(false);
        expect(hasSiblingWithName([], 'Apple')).toBe(false);
        expect(hasSiblingWithName(siblings, null)).toBe(false);
        expect(hasSiblingWithName(siblings, '')).toBe(false);
        expect(hasSiblingWithName(siblings, '   ')).toBe(false); // Empty after trim
    });

    test('excludes item with excludeId', () => {
        expect(hasSiblingWithName(siblings, 'Apple', '1')).toBe(false); // Exclude self, no conflict
        expect(hasSiblingWithName(siblings, 'Banana', '1')).toBe(true); // Doesn't exclude Banana
        expect(hasSiblingWithName(siblings, 'Banana', '2')).toBe(false); // Exclude self
    });

     test('handles siblings with null/missing labels gracefully', () => {
        expect(hasSiblingWithName(siblings, 'Some Name')).toBe(false); // Check against null/missing label shouldn't crash or match
        expect(hasSiblingWithName(siblings, null)).toBe(false); // Checking null name is false
     });
});

// --- Tests for isSelfOrDescendant ---
describe('treeUtils.isSelfOrDescendant', () => {
     const tree = [
        { id: 'f1', type: 'folder', label: 'F1', children: [
            { id: 'f1n1', type: 'note', label: 'N1' },
            { id: 'f1f1', type: 'folder', label: 'F11', children: [
                { id: 'f1f1t1', type: 'task', label: 'T1' }
            ]}
        ]},
        { id: 'f2', type: 'folder', label: 'F2', children: [] },
        { id: 'n2', type: 'note', label: 'N2' }
    ];

    test('returns true if checkItemId equals potentialTargetId', () => {
        expect(isSelfOrDescendant(tree, 'f1', 'f1')).toBe(true);
        expect(isSelfOrDescendant(tree, 'f1n1', 'f1n1')).toBe(true);
    });

    test('returns true if potentialTargetId is a direct child', () => {
        expect(isSelfOrDescendant(tree, 'f1', 'f1n1')).toBe(true);
        expect(isSelfOrDescendant(tree, 'f1', 'f1f1')).toBe(true);
    });

     test('returns true if potentialTargetId is a nested descendant', () => {
        expect(isSelfOrDescendant(tree, 'f1', 'f1f1t1')).toBe(true);
     });

     test('returns false if potentialTargetId is not a descendant', () => {
        expect(isSelfOrDescendant(tree, 'f1', 'f2')).toBe(false);
        expect(isSelfOrDescendant(tree, 'f1', 'n2')).toBe(false);
        expect(isSelfOrDescendant(tree, 'f2', 'f1n1')).toBe(false);
     });

     test('returns false if checkItem is not a folder (and not self)', () => {
        expect(isSelfOrDescendant(tree, 'f1n1', 'f1f1t1')).toBe(false); // Note trying to check descendants
        expect(isSelfOrDescendant(tree, 'n2', 'f1')).toBe(false);
     });

      test('returns false for invalid IDs or tree', () => {
        expect(isSelfOrDescendant(null, 'f1', 'f1n1')).toBe(false);
        expect(isSelfOrDescendant(tree, null, 'f1n1')).toBe(false);
        expect(isSelfOrDescendant(tree, 'f1', null)).toBe(false);
        expect(isSelfOrDescendant(tree, 'nonexistent', 'f1n1')).toBe(false);
        expect(isSelfOrDescendant(tree, 'f1', 'nonexistent')).toBe(false);
     });
});

// --- Tests for deleteItemRecursive ---
describe('treeUtils.deleteItemRecursive', () => {
    const tree = [
        { id: 'f1', type: 'folder', label: 'F1', children: [ { id: 'f1n1', type: 'note', label: 'N1' } ]},
        { id: 'n2', type: 'note', label: 'N2' }
    ];

    test('removes root item', () => {
        const result = deleteItemRecursive(tree, 'n2');
        expect(result.length).toBe(1);
        expect(result[0].id).toBe('f1');
    });

    test('removes nested item', () => {
        const result = deleteItemRecursive(tree, 'f1n1');
        expect(result.length).toBe(2);
        expect(result[0].id).toBe('f1');
        expect(result[0].children.length).toBe(0);
    });

    test('returns same tree if ID not found', () => {
        const result = deleteItemRecursive(tree, 'nonexistent');
        expect(result).toEqual(tree); // Should return the original structure (or a deep equal one)
        expect(result).not.toBe(tree); // But should be a new array instance
    });

    test('handles invalid input', () => {
        expect(deleteItemRecursive(null, 'id')).toEqual([]);
        expect(deleteItemRecursive(tree, null)).toEqual(tree);
    });
});

// --- Tests for renameItemRecursive ---
describe('treeUtils.renameItemRecursive', () => {
    const tree = [
        { id: 'f1', type: 'folder', label: 'F1', children: [ { id: 'f1n1', type: 'note', label: 'N1' } ]},
        { id: 'n2', type: 'note', label: 'N2' }
    ];

    test('renames root item', () => {
        const result = renameItemRecursive(tree, 'n2', ' New Name ');
        expect(result[1].label).toBe('New Name'); // Check trimmed label
        expect(result[0].label).toBe('F1'); // Other items unchanged
    });

    test('renames nested item', () => {
        const result = renameItemRecursive(tree, 'f1n1', 'Nested New');
        expect(result[0].children[0].label).toBe('Nested New');
        expect(result[0].label).toBe('F1'); // Parent unchanged
    });

     test('returns same tree structure if ID not found', () => {
        const result = renameItemRecursive(tree, 'nonexistent', 'New Name');
        expect(result).toEqual(tree); // Should be deep equal
        expect(result).not.toBe(tree); // New instance
     });

      test('handles invalid input', () => {
        expect(renameItemRecursive(null, 'id', 'Name')).toEqual([]);
        expect(renameItemRecursive(tree, null, 'Name')).toEqual(tree);
      });
});

// --- Tests for insertItemRecursive ---
describe('treeUtils.insertItemRecursive', () => {
     const tree = [
        { id: 'f1', type: 'folder', label: 'F1', children: [ { id: 'f1n1', type: 'note', label: 'N1' } ]},
        { id: 'n2', type: 'note', label: 'N2' }
    ];
    const newItem = { id: 'new', type: 'task', label: 'New Task' };

    test('inserts item at root if targetFolderId is null', () => {
        const result = insertItemRecursive(tree, null, newItem);
        expect(result.length).toBe(3);
        // Check sorting (f1, n2, new task) -> (f1, n2, new) based on type/alpha
        expect(result.map(i => i.id)).toEqual(['f1', 'n2', 'new']);
    });

    test('inserts item into target folder and sorts', () => {
        const newItemB = { id: 'newB', type: 'task', label: 'B Task' };
        const result = insertItemRecursive(tree, 'f1', newItemB);
        expect(result[0].id).toBe('f1');
        expect(result[0].children.length).toBe(2);
        // Check sorting (note N1, task B Task) -> (N1, B Task)
        expect(result[0].children.map(c => c.label)).toEqual(['N1', 'B Task']);
    });

    test('returns same tree structure if targetFolderId not found', () => {
        const result = insertItemRecursive(tree, 'nonexistent', newItem);
        expect(result).toEqual(tree);
        expect(result).not.toBe(tree);
    });

     test('returns same tree structure if target is not a folder', () => {
        const result = insertItemRecursive(tree, 'n2', newItem); // Target is note
        expect(result).toEqual(tree);
        expect(result).not.toBe(tree);
    });

     test('handles invalid input', () => {
         expect(insertItemRecursive(null, null, newItem)).toEqual([newItem]);
         expect(insertItemRecursive(null, 'f1', newItem)).toEqual([]);
         expect(insertItemRecursive([], null, newItem)).toEqual([newItem]);
     });
});


// --- Tests for handleDrop (including validation) ---
describe('treeUtils.handleDrop (Validation Focus)', () => {
  let initialTree;
   const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

   beforeEach(() => {
        initialTree = [
           { id: 'f1', type: 'folder', label: 'Folder 1', children: [ { id: 'n1', type: 'note', label: 'Note 1' } ]},
           { id: 'f2', type: 'folder', label: 'Folder 2', children: [ { id: 'n2', type: 'note', label: 'Note 1' } ]} // Note 1 also exists here
        ];
        alertSpy.mockClear();
   });

    afterAll(() => {
       alertSpy.mockRestore();
    });

  test('returns null and alerts if dropping folder into self/descendant', () => {
      expect(handleDrop(initialTree, 'f1', 'f1')).toBeNull(); // Self
      expect(alertSpy).not.toHaveBeenCalled(); // Self drop is prevented earlier

      const treeWithNest = [{ id: 'a', type: 'folder', children: [{id: 'b', type: 'folder'}]}];
      expect(handleDrop(treeWithNest, 'b', 'a')).toBeNull(); // Drop parent into child
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("Cannot drop folder"));
   });

   test('returns null and alerts if name conflict exists in target', () => {
      // Try dropping n1 (from f1) into f2 (which already has 'Note 1')
      expect(handleDrop(initialTree, 'f2', 'n1')).toBeNull();
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("already exists in the target folder 'Folder 2'"));
   });

    test('allows drop if name conflict does NOT exist', () => {
      const tree = [
           { id: 'f1', type: 'folder', label: 'Folder 1', children: [ { id: 'n1', type: 'note', label: 'Unique Note' } ]},
           { id: 'f2', type: 'folder', label: 'Folder 2', children: [ { id: 'n2', type: 'note', label: 'Another Note' } ]}
       ];
       const newTree = handleDrop(tree, 'f2', 'n1');
       expect(newTree).not.toBeNull();
       expect(alertSpy).not.toHaveBeenCalled();
       const targetFolder = newTree.find(i => i.id === 'f2');
       expect(targetFolder.children.length).toBe(2);
       expect(targetFolder.children.map(c=>c.label)).toContain('Unique Note');
   });

});