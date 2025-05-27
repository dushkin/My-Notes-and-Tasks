// tests/hooks/useTree.test.jsx
import { renderHook, act } from '@testing-library/react';
import { useTree, assignClientPropsForDuplicate } from '../../src/hooks/useTree';
import { LOCAL_STORAGE_KEY } from '../../src/utils/constants';
import * as apiClient from '../../src/services/apiClient'; // Import to mock authFetch

// Mock apiClient.authFetch
jest.mock('../../src/services/apiClient', () => ({
  authFetch: jest.fn(),
  initApiClient: jest.fn(), // Keep initApiClient if App.jsx calls it, but not directly used by useTree normally
}));


jest.mock('unicode-bidirectional', () => ({
  __esModule: true,
  embeddingLevels: jest.fn(() => []),
  reorder: jest.fn(text => text),
}));

const mockDefaultSettings = {
  theme: 'system',
  defaultSortOrder: 'foldersFirstAlpha',
  autoExpandNewFolders: true,
  editorFontFamily: 'Arial',
  editorFontSize: '3',
  defaultExportFormat: 'json',
  autoExportEnabled: false,
  autoExportIntervalMinutes: 30,
};

jest.mock('../../src/contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: mockDefaultSettings,
    updateSetting: jest.fn(),
    resetSettings: jest.fn(),
    resetApplicationData: jest.fn(),
  }),
  defaultSettings: mockDefaultSettings,
}));

const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => { store[key] = value.toString(); }),
    removeItem: jest.fn(key => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
    hasOwnProperty: jest.fn(key => store.hasOwnProperty(key)),
    length: Object.keys(store).length,
    key: jest.fn(index => Object.keys(store)[index] || null)
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });


describe('useTree Hook', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks(); // Clears all mocks, including authFetch
    // Default mock for authFetch for tree loading
    apiClient.authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ notesTree: [] }),
    });
  });

  test('initializes with an attempt to fetch tree', async () => {
    // No need to set 'userToken' in localStorage, authFetch handles auth
    const { result, waitForNextUpdate } = renderHook(() => useTree());

    // Initially tree might be from localStorage or empty before fetch completes
    expect(result.current.isFetchingTree).toBe(true); // Assuming fetch starts on init

    await waitForNextUpdate({ timeout: 200 }); // Wait for fetch to potentially complete

    expect(apiClient.authFetch).toHaveBeenCalledWith("/items/tree");
    expect(result.current.tree).toEqual([]); // Assuming mock fetch returns empty tree
    expect(result.current.expandedFolders).toEqual({});
  });


  test('initializes with empty tree if localStorage is empty', () => {
    // Ensure authFetch is mocked to not throw or to return empty if called
    apiClient.authFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ notesTree: [] }) });
    const { result } = renderHook(() => useTree());
    expect(result.current.tree).toEqual([]);
    expect(result.current.expandedFolders).toEqual({});
    expect(localStorageMock.getItem).toHaveBeenCalledWith(LOCAL_STORAGE_KEY);
    expect(localStorageMock.getItem).toHaveBeenCalledWith(`${LOCAL_STORAGE_KEY}_expanded`);
  });

  test('loads tree from localStorage if present (and fetch is mocked appropriately)', () => {
    const storedTree = [{ id: 'f1', type: 'folder', label: 'Folder 1', children: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }];
    localStorageMock.setItem(LOCAL_STORAGE_KEY, JSON.stringify(storedTree));
    apiClient.authFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ notesTree: storedTree }) });


    const { result } = renderHook(() => useTree());
    // The hook initializes with localStorage, then fetch might overwrite it.
    // For this test, we focus on the localStorage load part.
    expect(result.current.tree).toEqual(storedTree);
  });

  describe('assignClientPropsForDuplicate', () => {
    test('should assign new client ID, createdAt, and updatedAt to a duplicated item', () => {
      const originalItem = {
        id: 'server-id-1',
        type: 'note',
        label: 'Original Note',
        content: 'Some content',
        createdAt: new Date(Date.now() - 100000).toISOString(),
        updatedAt: new Date(Date.now() - 100000).toISOString(),
      };
      const duplicatedItem = assignClientPropsForDuplicate(originalItem);

      expect(duplicatedItem.id).not.toBe(originalItem.id);
      expect(duplicatedItem.id).toMatch(/^client-/);
      expect(duplicatedItem.label).toBe(originalItem.label);
      expect(duplicatedItem.content).toBe(originalItem.content);
      expect(new Date(duplicatedItem.createdAt).getTime()).toBeGreaterThan(new Date(originalItem.createdAt).getTime());
      expect(duplicatedItem.updatedAt).toEqual(duplicatedItem.createdAt);
    });

    test('should recursively assign new props for children of a duplicated folder', () => {
      const originalFolder = {
        id: 'server-folder-1',
        type: 'folder',
        label: 'Original Folder',
        createdAt: new Date(Date.now() - 200000).toISOString(),
        updatedAt: new Date(Date.now() - 200000).toISOString(),
        children: [
          {
            id: 'server-child-1',
            type: 'note',
            label: 'Child Note',
            content: 'Child content',
            createdAt: new Date(Date.now() - 100000).toISOString(),
            updatedAt: new Date(Date.now() - 100000).toISOString(),
          },
        ],
      };
      const duplicatedFolder = assignClientPropsForDuplicate(originalFolder);

      expect(duplicatedFolder.id).not.toBe(originalFolder.id);
      expect(duplicatedFolder.id).toMatch(/^client-/);
      expect(new Date(duplicatedFolder.createdAt).getTime()).toBeGreaterThan(new Date(originalFolder.createdAt).getTime());
      expect(duplicatedFolder.updatedAt).toEqual(duplicatedFolder.createdAt);
      expect(duplicatedFolder.children[0].id).not.toBe(originalFolder.children[0].id);
      expect(duplicatedFolder.children[0].id).toMatch(/^client-/);
      expect(duplicatedFolder.children[0].label).toBe(originalFolder.children[0].label);
      expect(new Date(duplicatedFolder.children[0].createdAt).getTime()).toBeGreaterThan(new Date(originalFolder.children[0].createdAt).getTime());
      expect(duplicatedFolder.children[0].updatedAt).toEqual(duplicatedFolder.children[0].createdAt);
    });
  });

  test('addItem updates tree with item returned from server (including timestamps)', async () => {
    const newItemData = { label: 'New Server Note', type: 'note', content: '' };
    const serverReturnedItem = {
      ...newItemData,
      id: 'server-gen-id-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    apiClient.authFetch.mockResolvedValue({ // Mock authFetch directly
      ok: true,
      json: async () => serverReturnedItem,
    });

    const { result } = renderHook(() => useTree());

    await act(async () => {
      await result.current.addItem(newItemData, null);
    });

    expect(apiClient.authFetch).toHaveBeenCalledWith(
      "/items",
      expect.objectContaining({ method: "POST", body: expect.any(String) })
    );
    expect(result.current.tree.length).toBe(1);
    expect(result.current.tree[0]).toEqual(serverReturnedItem);
    expect(result.current.tree[0].createdAt).toBeDefined();
    expect(result.current.tree[0].updatedAt).toBeDefined();
  });

  test('updateNoteContent updates tree with item returned from server (including new updatedAt)', async () => {
    const initialTimestamp = new Date(Date.now() - 100000).toISOString();
    const initialItem = {
      id: 'note-to-update-1',
      type: 'note',
      label: 'Initial Label',
      content: '<p>Initial</p>',
      createdAt: initialTimestamp,
      updatedAt: initialTimestamp
    };
    const updatedServerItem = {
      ...initialItem,
      content: '<p>Updated Content</p>',
      updatedAt: new Date().toISOString()
    };

    // Mock for the initial fetchUserTree if it's called by the hook setup
    apiClient.authFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ notesTree: [initialItem] }) });
    // Mock for the PATCH request
    apiClient.authFetch.mockResolvedValueOnce({ ok: true, json: async () => updatedServerItem });


    const { result, rerender } = renderHook(() => useTree());

    // If fetchUserTree is called on init, wait for it or set initial state directly for this test
    act(() => {
      result.current.resetState([initialItem]); // Manually set initial state for this test
    });


    await act(async () => {
      await result.current.updateNoteContent(initialItem.id, { content: '<p>Updated Content</p>' });
    });

    expect(apiClient.authFetch).toHaveBeenCalledWith(
      `/items/${initialItem.id}`,
      expect.objectContaining({ method: "PATCH", body: expect.any(String) })
    );
    expect(result.current.tree.length).toBe(1);
    const updatedItemInTree = result.current.tree.find(item => item.id === initialItem.id);
    expect(updatedItemInTree).toEqual(updatedServerItem);
    expect(updatedItemInTree.updatedAt).not.toBe(initialTimestamp);
    expect(new Date(updatedItemInTree.updatedAt).getTime()).toBeGreaterThan(new Date(initialTimestamp).getTime());
  });
});