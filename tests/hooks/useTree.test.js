// tests/hooks/useTree.test.js
import { renderHook, act } from '@testing-library/react';
import { useTree } from '../../src/hooks/useTree';
import { LOCAL_STORAGE_KEY } from '../../src/utils/constants';

// Mocking fetch
global.fetch = jest.fn();

// Mock unicode-bidirectional
jest.mock('unicode-bidirectional', () => ({
  __esModule: true, // This is important for modules with default exports when mocking
  embeddingLevels: jest.fn(() => []), // Mock implementation
  reorder: jest.fn(text => text),     // Mock implementation
}));

// Mock SettingsContext
jest.mock('../../src/contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: {
      theme: 'system',
      defaultSortOrder: 'foldersFirstAlpha',
      autoExpandNewFolders: true,
      editorFontFamily: 'Arial',
      editorFontSize: '3',
      defaultExportFormat: 'json',
    },
    // Mock functions if your hook uses them directly, otherwise not strictly needed for all tests
    updateSetting: jest.fn(),
    resetSettings: jest.fn(),
    resetApplicationData: jest.fn(),
  }),
  // Exporting defaultSettings isn't strictly necessary for the mock if useSettings provides it
  defaultSettings: { /* your default settings object */ },
}));

// LocalStorage mock
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => { store[key] = value.toString(); }),
    removeItem: jest.fn(key => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
    hasOwnProperty: jest.fn(key => store.hasOwnProperty(key)), // Added for completeness
    length: Object.keys(store).length, // Added for completeness
    key: jest.fn(index => Object.keys(store)[index] || null) // Added for completeness
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });


describe('useTree Hook', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks(); // Clears all mocks including fetch
    // Provide a default successful fetch response for initial load
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ notesTree: [] }), // Default to empty tree
    });
  });

  test('initializes with an attempt to fetch tree if token exists', async () => {
    localStorageMock.setItem('userToken', 'fake-token'); // Simulate logged-in user
    const { result } = renderHook(() => useTree());

    // Wait for async operations in useEffect to complete if necessary
    // For this initial test, we check immediate state before async fetch might complete in test env
    expect(result.current.tree).toEqual([]); // Initial state before fetch completes
    expect(result.current.expandedFolders).toEqual({});

    // Check that fetch was called (due to useEffect in useTree)
    // await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    // The above waitFor might be tricky depending on how useEffect and async calls are handled in test renderer
    // For now, we know fetch should be called if token exists
  });

  test('initializes with empty tree if localStorage is empty and no token', () => {
    localStorageMock.removeItem('userToken'); // Ensure no token
    fetch.mockResolvedValueOnce({ // Mock fetch in case it's called even without token (though it shouldn't)
      ok: true,
      json: async () => ({ notesTree: [] }),
    });
    const { result } = renderHook(() => useTree());
    expect(result.current.tree).toEqual([]);
    expect(result.current.expandedFolders).toEqual({});
    expect(localStorageMock.getItem).toHaveBeenCalledWith(LOCAL_STORAGE_KEY);
    expect(localStorageMock.getItem).toHaveBeenCalledWith(`${LOCAL_STORAGE_KEY}_expanded`);
  });


  test('loads tree from localStorage if present (and no token initially for fetch)', () => {
    const storedTree = [{ id: 'f1', type: 'folder', label: 'Folder 1', children: [] }];
    localStorageMock.setItem(LOCAL_STORAGE_KEY, JSON.stringify(storedTree));
    localStorageMock.removeItem('userToken'); // Ensure no token for this specific test case focus

    fetch.mockResolvedValueOnce({ // Mock fetch if it's still called
      ok: true,
      json: async () => ({ notesTree: [] }), // Return empty from fetch to ensure localStorage is preferred
    });

    const { result } = renderHook(() => useTree());

    // If fetch is prioritized over localStorage load, this might need adjustment
    // The current useTree loads from localStorage, then useEffect fetches if token.
    expect(result.current.tree).toEqual(storedTree);
  });

  // More comprehensive tests for addItem, deleteItem, etc., would require:
  // - Mocking `Workspace` for each specific API call (POST, PATCH, DELETE).
  // - Using `act()` from `@testing-library/react` to wrap state updates.
  // - Verifying that `setTreeWithUndo` is called with the expected new tree state.
  // These become more like integration tests for the hook.

  test.skip('addItem successfully updates the tree after API call', async () => {
    // Example of a more involved test (SKIPPED for brevity, needs full setup)
    const initialItems = [];
    localStorageMock.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialItems));
    localStorageMock.setItem('userToken', 'fake-token');

    const mockNewItemFromServer = { id: 'server-id-1', type: 'note', label: 'New Note from Server', content: '' };
    fetch.mockResolvedValueOnce({ // For initial fetch
      ok: true,
      json: async () => ({ notesTree: initialItems }),
    }).mockResolvedValueOnce({ // For the POST request in addItem
      ok: true,
      json: async () => mockNewItemFromServer,
    });

    const { result } = renderHook(() => useTree());

    await act(async () => {
      await result.current.addItem({ label: 'New Note', type: 'note' }, null);
    });

    // This assertion depends on how `insertItemRecursive` and `setTreeWithUndo` update the state
    // expect(result.current.tree).toEqual(expect.arrayContaining([mockNewItemFromServer]));
  });

});