// jest.setup.js
import { cleanup } from '@testing-library/react';
import { configure } from '@testing-library/dom';
import '@testing-library/jest-dom';

// Configure testIdAttribute for data-item-id
configure({ testIdAttribute: 'data-item-id' });

afterEach(() => {
  cleanup();
});