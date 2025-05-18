import { cleanup } from '@testing-library/react';
import { configure } from '@testing-library/dom';
import '@testing-library/jest-dom';

configure({ testIdAttribute: 'data-item-id' });

process.env.VITE_API_BASE_URL = 'http://localhost:5001/api/test';

afterEach(() => {
  cleanup();
});
