// tests/hooks/useTree.test.js
import { renderHook, act } from '@testing-library/react';
import { useTree, assignClientPropsForDuplicate } from '../../src/hooks/useTree';
import { LOCAL_STORAGE_KEY } from '../../src/utils/constants';

global.fetch = jest.fn();
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
    jest.clearAllMocks();
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ notesTree: [] }),
    });
  });

  test('initializes with an attempt to fetch tree if token exists', async () => {
    localStorageMock.setItem('userToken', 'fake-token');
    const { result } = renderHook(() => useTree());

    expect(result.current.tree).toEqual([]);
    expect(result.current.expandedFolders).toEqual({});
  });

  test('initializes with empty tree if localStorage is empty and no token', () => {
    localStorageMock.removeItem('userToken');
    const { result } = renderHook(() => useTree());
    expect(result.current.tree).toEqual([]);
    expect(result.current.expandedFolders).toEqual({});
    expect(localStorageMock.getItem).toHaveBeenCalledWith(LOCAL_STORAGE_KEY);
    expect(localStorageMock.getItem).toHaveBeenCalledWith(`${LOCAL_STORAGE_KEY}_expanded`);
  });

  test('loads tree from localStorage if present (and no token initially for fetch)', () => {
    const storedTree = [{ id: 'f1', type: 'folder', label: 'Folder 1', children: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }];
    localStorageMock.setItem(LOCAL_STORAGE_KEY, JSON.stringify(storedTree));
    localStorageMock.removeItem('userToken');

    const { result } = renderHook(() => useTree());
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

      expect(duplicatedItem.createdAt).toBeDefined();
      expect(duplicatedItem.updatedAt).toBeDefined();
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
    localStorageMock.setItem('userToken', 'fake-token');
    const newItemData = { label: 'New Server Note', type: 'note', content: '' };
    const serverReturnedItem = {
      ...newItemData,
      id: 'server-gen-id-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    fetch.mockImplementation((url) => {
      if (url.toString().endsWith('/api/items')) {
        return Promise.resolve({
          ok: true,
          json: async () => serverReturnedItem,
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ notesTree: [] }),
      });
    });

    const { result } = renderHook(() => useTree());

    await act(async () => {
      await result.current.addItem(newItemData, null);
    });

    expect(result.current.tree.length).toBe(1);
    expect(result.current.tree[0]).toEqual(serverReturnedItem);
    expect(result.current.tree[0].createdAt).toBeDefined();
    expect(result.current.tree[0].updatedAt).toBeDefined();
  });

  test('updateNoteContent updates tree with item returned from server (including new updatedAt)', async () => {
    localStorageMock.setItem('userToken', 'fake-token');
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

    fetch.mockImplementation((url) => {
      if (url.toString().includes(`/api/items/${initialItem.id}`)) {
        return Promise.resolve({
          ok: true,
          json: async () => updatedServerItem,
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ notesTree: [initialItem] }),
      });
    });

    const { result } = renderHook(() => useTree());

    await act(async () => {
      if (result.current.tree.length === 0) {
        await result.current.fetchUserTree('fake-token');
      }
    });
    if (result.current.tree.length === 0 || result.current.tree[0].id !== initialItem.id) {
      act(() => {
        result.current.resetState([initialItem]);
      });
    }

    await act(async () => {
      await result.current.updateNoteContent(initialItem.id, { content: '<p>Updated Content</p>' });
    });

    expect(result.current.tree.length).toBe(1);
    const updatedItemInTree = result.current.tree.find(item => item.id === initialItem.id);
    expect(updatedItemInTree).toEqual(updatedServerItem);
    expect(updatedItemInTree.updatedAt).not.toBe(initialTimestamp);
    expect(new Date(updatedItemInTree.updatedAt).getTime()).toBeGreaterThan(new Date(initialTimestamp).getTime());
  });
});