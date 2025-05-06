// tests/hooks/useTree.test.js
import { renderHook } from '@testing-library/react';
import { useTree } from '../../src/hooks/useTree';
import { LOCAL_STORAGE_KEY } from '../../src/utils/constants';

/* Mock unicode-bidirectional */
jest.mock('unicode-bidirectional', () => ({
  __esModule: true,
  embeddingLevels: jest.fn(),
  reorder: jest.fn(text => text),
}));

/* Mock SettingsContext just for this test file */
jest.mock('../../src/contexts/SettingsContext', () => ({
  __esModule: true,
  useSettings: () => ({
    settings: {
      theme: 'system',
      defaultSortOrder: 'foldersFirstAlpha',
      autoExpandNewFolders: true,
      editorFontFamily: 'Arial',
      editorFontSize: '3',
      defaultExportFormat: 'json',
    },
    updateSetting: jest.fn(),
    resetSettings: jest.fn(),
    resetApplicationData: jest.fn(),
  }),
  defaultSettings: {
    theme: 'system',
    defaultSortOrder: 'foldersFirstAlpha',
    autoExpandNewFolders: true,
    editorFontFamily: 'Arial',
    editorFontSize: '3',
    defaultExportFormat: 'json',
  },
}));

/* LocalStorage mock */
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => { store[key] = value.toString(); }),
    removeItem: jest.fn(key => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useTree Hook', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  test('initializes with empty tree and expanded folders if localStorage is empty', () => {
    const { result } = renderHook(() => useTree());
    expect(result.current.tree).toEqual([]);
    expect(result.current.expandedFolders).toEqual({});
    expect(localStorageMock.getItem).toHaveBeenCalledWith(LOCAL_STORAGE_KEY);
    expect(localStorageMock.getItem).toHaveBeenCalledWith(`${LOCAL_STORAGE_KEY}_expanded`);
  });

  test('loads tree from localStorage if present', () => {
    const storedTree = [{ id: 'f1', type: 'folder', label: 'Folder 1', children: [] }];
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(storedTree));
    const { result } = renderHook(() => useTree());
    expect(result.current.tree).toEqual(storedTree);
    expect(localStorageMock.getItem).toHaveBeenCalledWith(LOCAL_STORAGE_KEY);
  });

  /* Future tests left skipped until implementation is stable */
  test.skip('adds a new folder to the tree', () => {});
  test.skip('toggles folder expansion', () => {});
});