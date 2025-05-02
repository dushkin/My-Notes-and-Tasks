// tests/hooks/useTree.test.js
import { renderHook, act } from '@testing-library/react';
import { useTree } from '../../src/hooks/useTree'; // Adjust path as needed
import { LOCAL_STORAGE_KEY } from '../../src/utils/constants';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => { store[key] = value.toString(); }),
    removeItem: jest.fn((key) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
    length: 0,
    key: jest.fn(index => Object.keys(store)[index] || null),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock structuredClone if not globally available
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = jest.fn(val => JSON.parse(JSON.stringify(val)));
}

// Use fake timers for setTimeout in pasteItem
jest.useFakeTimers();


describe('useTree Hook', () => {
  beforeEach(() => {
    // Clear mocks and localStorage before each test
    localStorageMock.clear();
    jest.clearAllMocks();
  });

   afterEach(() => {
     // Clear any pending timers
     jest.clearAllTimers();
   });

  // --- Initialization Tests ---
  test('initializes with empty tree and expanded folders if localStorage is empty', () => {
    const { result } = renderHook(() => useTree());
    expect(result.current.tree).toEqual([]);
    expect(result.current.expandedFolders).toEqual({});
    expect(localStorageMock.getItem).toHaveBeenCalledWith(LOCAL_STORAGE_KEY);
    expect(localStorageMock.getItem).toHaveBeenCalledWith(`${LOCAL_STORAGE_KEY}_expanded`);
  });

  test('initializes with data from localStorage if present', () => {
    const initialTree = [{ id: 'f1', type: 'folder', label: 'Folder 1', children: [] }];
    const initialExpanded = { f1: true };
    localStorageMock.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialTree));
    localStorageMock.setItem(`${LOCAL_STORAGE_KEY}_expanded`, JSON.stringify(initialExpanded));
    const { result } = renderHook(() => useTree());
    expect(result.current.tree).toEqual(initialTree);
    expect(result.current.expandedFolders).toEqual(initialExpanded);
  });

  // --- Selection Tests ---
  test('selectItemById updates selectedItemId', () => {
    const { result } = renderHook(() => useTree());
    expect(result.current.selectedItemId).toBeNull();
    act(() => {
      result.current.selectItemById('f1');
    });
    expect(result.current.selectedItemId).toBe('f1');
    act(() => {
      result.current.selectItemById(null);
    });
    expect(result.current.selectedItemId).toBeNull();
  });

  test('selectedItem updates based on selectedItemId and tree changes', () => {
     const initialTree = [{ id: 'f1', type: 'folder', label: 'Folder 1', children: [] }];
     localStorageMock.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialTree));
     const { result, rerender } = renderHook(() => useTree());

     expect(result.current.selectedItem).toBeNull();

     act(() => { result.current.selectItemById('f1'); });
     rerender(); // Rerender might be needed for useMemo update based on state change
     expect(result.current.selectedItem).toEqual(initialTree[0]);

     // Simulate tree update removing the item
      act(() => {
        result.current.deleteItem('f1'); // deleteItem now handles selection update
      });
      rerender();
      expect(result.current.selectedItemId).toBeNull(); // deleteItem should deselect
      expect(result.current.selectedItem).toBeNull();
  });


  // --- Folder Expansion Tests ---
  test('toggleFolderExpand toggles and persists expanded state', () => {
     const { result } = renderHook(() => useTree());
     expect(result.current.expandedFolders).toEqual({});

     act(() => { result.current.toggleFolderExpand('f1'); });
     expect(result.current.expandedFolders).toEqual({ f1: true });
     expect(localStorageMock.setItem).toHaveBeenCalledWith(expect.stringContaining('_expanded'), JSON.stringify({ f1: true }));

     act(() => { result.current.toggleFolderExpand('f1'); });
     expect(result.current.expandedFolders).toEqual({ f1: false });
     expect(localStorageMock.setItem).toHaveBeenCalledWith(expect.stringContaining('_expanded'), JSON.stringify({ f1: false }));

      act(() => { result.current.toggleFolderExpand('f1', true); }); // Force expand
     expect(result.current.expandedFolders).toEqual({ f1: true });

      act(() => { result.current.toggleFolderExpand('f1', false); }); // Force collapse
     expect(result.current.expandedFolders).toEqual({ f1: false });
  });

   test('expandFolderPath expands parent folders', () => {
      const initialTree = [{ id: 'f1', type: 'folder', children: [{ id: 'f1-1', type: 'folder', children: [{id: 'n1'}] }] }];
      localStorageMock.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialTree));
      const { result } = renderHook(() => useTree());
      expect(result.current.expandedFolders).toEqual({});
      act(() => { result.current.expandFolderPath('f1-1'); }); // Expand child folder
      expect(result.current.expandedFolders).toEqual({ f1: true, 'f1-1': true }); // Expect parent and child to be expanded
   });


  // --- CRUD Tests ---
  test('addItem adds item to root', () => {
      const { result } = renderHook(() => useTree());
      const newItem = { id: 'n1', type: 'note', label: 'New Note' };
      act(() => {
          result.current.addItem(newItem, null);
      });
      expect(result.current.tree.length).toBe(1);
      // Find item by label as ID is dynamic now
      expect(result.current.tree.find(i => i.label === 'New Note')).toMatchObject({ type: 'note', label: 'New Note'});
      expect(localStorageMock.setItem).toHaveBeenCalledWith(LOCAL_STORAGE_KEY, JSON.stringify(result.current.tree));
  });

   test('addItem adds item to parent folder and sorts', () => {
       const initialTree = [{ id: 'f1', type: 'folder', label: 'Folder 1', children: [{id:'a', type:'note', label:'A Note'}] }];
       localStorageMock.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialTree));
       const { result } = renderHook(() => useTree());
       const newItem = { id: 'z1', type: 'note', label: 'Z Note' }; // ID will be replaced

       act(() => { result.current.addItem(newItem, 'f1'); });

       expect(result.current.tree.length).toBe(1);
       expect(result.current.tree[0].children.length).toBe(2);
       // Check sorting (A before Z)
       expect(result.current.tree[0].children[0].label).toEqual('A Note');
       expect(result.current.tree[0].children[1].label).toEqual('Z Note');
       expect(localStorageMock.setItem).toHaveBeenCalledWith(LOCAL_STORAGE_KEY, JSON.stringify(result.current.tree));
   });

   test('renameItem renames the correct item', () => {
       const initialTree = [{ id: 'f1', type: 'folder', label: 'Folder 1' }];
       localStorageMock.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialTree));
       const { result } = renderHook(() => useTree());

       act(() => { result.current.renameItem('f1', 'Renamed Folder'); });

       expect(result.current.tree[0].label).toBe('Renamed Folder');
       expect(localStorageMock.setItem).toHaveBeenCalledWith(LOCAL_STORAGE_KEY, JSON.stringify(result.current.tree));
   });

   test('deleteItem removes item and deselects if necessary', () => {
       const initialTree = [
           { id: 'f1', type: 'folder', label: 'Folder 1' },
           { id: 'n1', type: 'note', label: 'Note 1' }
       ];
       localStorageMock.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialTree));
       const { result } = renderHook(() => useTree());

       act(() => { result.current.selectItemById('n1'); });
       expect(result.current.selectedItemId).toBe('n1');

       act(() => { result.current.deleteItem('n1'); });

       expect(result.current.tree.length).toBe(1);
       expect(result.current.tree[0].id).toBe('f1');
       expect(result.current.selectedItemId).toBeNull(); // Should deselect
       expect(localStorageMock.setItem).toHaveBeenCalledWith(LOCAL_STORAGE_KEY, JSON.stringify(result.current.tree));
   });


   // --- Copy/Cut/Paste Tests ---
   describe('Clipboard Operations', () => {
       const initialTree = [
           { id: 'f1', type: 'folder', label: 'Folder 1', children: [
                { id: 'n1', type: 'note', label: 'Note 1' }
           ]},
           { id: 'f2', type: 'folder', label: 'Folder 2', children: [] },
           { id: 'n2', type: 'note', label: 'Note 2' }
       ];

       beforeEach(() => {
            localStorageMock.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialTree));
       });

       test('copyItem sets clipboard state', () => {
           const { result } = renderHook(() => useTree());
           expect(result.current.cutItemId).toBeNull(); // Check initial state
           act(() => { result.current.copyItem('n1'); });
           expect(result.current.clipboardMode).toBe('copy');
           expect(result.current.clipboardItem).not.toBeNull();
           expect(result.current.clipboardItem?.id).toBe('n1');
           expect(result.current.cutItemId).toBeNull(); // Check after copy
       });

        test('cutItem sets clipboard state and cutItemId', () => {
           const { result } = renderHook(() => useTree());
           expect(result.current.cutItemId).toBeNull(); // Check initial state
           act(() => { result.current.cutItem('n2'); });
           expect(result.current.clipboardMode).toBe('cut');
           expect(result.current.clipboardItem).not.toBeNull();
           expect(result.current.clipboardItem?.id).toBe('n2');
           expect(result.current.cutItemId).toBe('n2'); // Check after cut
       });

       test('pasteItem (copy mode) adds item with new ID and expands target', () => {
           const { result, rerender } = renderHook(() => useTree());
           act(() => { result.current.copyItem('n1'); });

           // Check state before timers run
           act(() => { result.current.pasteItem('f2'); });
           rerender();
           expect(result.current.expandedFolders['f2']).toBeUndefined(); // Should not be expanded yet

           // Advance timers AND rerender to check final state
           act(() => { jest.runAllTimers(); });
           rerender();

           const f2 = result.current.tree.find(i => i.id === 'f2');
           expect(f2?.children.length).toBe(1);
           expect(f2?.children[0].label).toBe('Note 1');
           expect(f2?.children[0].id).not.toBe('n1');
           const f1 = result.current.tree.find(i => i.id === 'f1');
           expect(f1?.children.length).toBe(1);
           expect(f1?.children[0].id).toBe('n1');
           // Check expansion state AFTER timers run
           expect(result.current.expandedFolders['f2']).toBe(true);
       });

        test('pasteItem (cut mode) moves item with new ID, deletes original, and expands target', () => {
           const { result, rerender } = renderHook(() => useTree());
           act(() => { result.current.cutItem('n1'); });
           expect(result.current.cutItemId).toBe('n1'); // Check after cut

           // Check state before timers run
           act(() => { result.current.pasteItem('f2'); });
           rerender(); // Allow tree/cutItemId update to settle
           expect(result.current.cutItemId).toBeNull(); // Should be null immediately after paste action
           expect(result.current.expandedFolders['f2']).toBeUndefined(); // Should not be expanded yet

           // Advance timers AND rerender to check final state
           act(() => { jest.runAllTimers(); });
           rerender();

           const f2 = result.current.tree.find(i => i.id === 'f2');
           expect(f2?.children.length).toBe(1);
           expect(f2?.children[0].label).toBe('Note 1');
           expect(f2?.children[0].id).not.toBe('n1');
           const f1 = result.current.tree.find(i => i.id === 'f1');
           expect(f1?.children.length).toBe(0); // Original gone
           expect(result.current.cutItemId).toBeNull(); // Should still be null
           // Check expansion state AFTER timers run
           expect(result.current.expandedFolders['f2']).toBe(true);
       });

        test('pasteItem prevents pasting folder into itself or descendant', () => {
            const { result } = renderHook(() => useTree());
            const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
            act(() => { result.current.copyItem('f1'); });
            act(() => { result.current.pasteItem('f1'); }); // Paste into self
            expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("Cannot paste folder 'Folder 1' into itself"));
            act(() => { result.current.pasteItem('f1-f1'); }); // Paste into descendant
            expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("Cannot paste folder 'Folder 1' into itself or one of its subfolders"));
            alertSpy.mockRestore();
       });

        test('pasteItem to root works correctly', () => {
             const { result } = renderHook(() => useTree());
             act(() => { result.current.copyItem('n1'); });
             act(() => { result.current.pasteItem(null); });
             expect(result.current.tree.length).toBe(4);
             const rootNoteCopy = result.current.tree.find(i => i.label === 'Note 1' && i.id !== 'n1');
             expect(rootNoteCopy).toBeDefined();
             const f1 = result.current.tree.find(i => i.id === 'f1');
             expect(f1?.children.length).toBe(1); // Original still exists
        });

   });

    // --- Context Menu State Tests ---
    test('setContextMenu updates contextMenu state', () => {
        const { result } = renderHook(() => useTree());
        expect(result.current.contextMenu.visible).toBe(false);
        const contextData = { visible: true, x: 10, y: 20, item: { id: 't1'}, isEmptyArea: false };
        act(() => { result.current.setContextMenu(contextData); });
        expect(result.current.contextMenu).toEqual(contextData);
    });

    // --- Drag/Drop State ---
     test('setDraggedId updates draggedId state', () => {
         const { result } = renderHook(() => useTree());
         expect(result.current.draggedId).toBeNull();
         act(() => { result.current.setDraggedId('d1'); });
         expect(result.current.draggedId).toBe('d1');
         act(() => { result.current.setDraggedId(null); });
         expect(result.current.draggedId).toBeNull();
     });

    test('handleDrop clears draggedId and updates tree if valid', () => {
        const mockNewTree = [{id: 'new'}];
        // Mock the utility function specifically for this test
        const treeUtils = require('../../src/utils/treeUtils');
        const handleDropSpy = jest.spyOn(treeUtils, 'handleDrop').mockImplementation(() => mockNewTree);

        const { result } = renderHook(() => useTree());
        act(() => { result.current.setDraggedId('d1'); }); // Set dragged item
        act(() => { result.current.handleDrop('t1'); }); // Call drop handler

        expect(handleDropSpy).toHaveBeenCalled();
        expect(result.current.tree).toEqual(mockNewTree); // Check if tree was updated
        expect(result.current.draggedId).toBeNull(); // Check if draggedId was cleared

        handleDropSpy.mockRestore(); // Clean up spy
    });

    test('handleDrop clears draggedId if invalid', () => {
        // Mock the utility function to return null
         const treeUtils = require('../../src/utils/treeUtils');
        const handleDropSpy = jest.spyOn(treeUtils, 'handleDrop').mockImplementation(() => null);

         const { result } = renderHook(() => useTree());
         const originalTree = result.current.tree; // Capture original tree
         act(() => { result.current.setDraggedId('d1'); });
         act(() => { result.current.handleDrop('t1'); });

         expect(handleDropSpy).toHaveBeenCalled();
         expect(result.current.tree).toEqual(originalTree); // Tree should not change
         expect(result.current.draggedId).toBeNull(); // draggedId should still clear

         handleDropSpy.mockRestore();
    });

     // TODO: Add tests for updateNoteContent/updateTaskContent if needed

}); // End describe('useTree Hook')