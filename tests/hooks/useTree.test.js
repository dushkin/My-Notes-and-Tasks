import { renderHook, act } from '@testing-library/react-hooks';
import useTree from '../../src/hooks/useTree';

describe('useTree hook', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('initializes with empty tree when no localStorage', () => {
    const { result } = renderHook(() => useTree());
    expect(result.current.tree).toEqual([]);
    expect(typeof result.current.setTree).toBe('function');
  });

  test('updates tree state and localStorage', () => {
    const { result } = renderHook(() => useTree());
    act(() => {
      result.current.setTree([{ id: '1', children: [] }]);
    });
    expect(result.current.tree).toEqual([{ id: '1', children: [] }]);
    const stored = JSON.parse(window.localStorage.getItem('myNotesTasksTree'));
    expect(stored).toEqual([{ id: '1', children: [] }]);
  });
});
