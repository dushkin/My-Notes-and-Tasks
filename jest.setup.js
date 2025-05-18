// jest.setup.js
import { cleanup } from '@testing-library/react';
import { configure } from '@testing-library/dom';
import '@testing-library/jest-dom';

console.log('[DEBUG jest.setup.js] This setup file IS RUNNING.');

configure({ testIdAttribute: 'data-item-id' });

// The import.meta.env replacement is now expected to be handled by
// babel-plugin-transform-define in babel.config.cjs for the 'test' environment.
// So, the Object.defineProperty(global, 'import.meta', ...) block is removed.

console.log('[DEBUG jest.setup.js] import.meta.env handling deferred to Babel transform.');

afterEach(() => {
  cleanup();
});