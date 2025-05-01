import { LOCAL_STORAGE_KEY } from '../../src/utils/constants';

describe('constants', () => {
  test('LOCAL_STORAGE_KEY is correct', () => {
    expect(LOCAL_STORAGE_KEY).toBe('myNotesTasksTree');
  });
});
