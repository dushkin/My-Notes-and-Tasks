// jest.setup.js
import { cleanup } from '@testing-library/react';
import { configure } from '@testing-library/dom';
import '@testing-library/jest-dom';

console.log('[DEBUG jest.setup.js] This setup file IS RUNNING.');

// Fallback for import.meta.env if Babel transform-define is not fully effective
// This might be less critical if transform-define in babel.config.js reliably handles all cases.
if (typeof global.importMeta === 'undefined') {
  global.importMeta = {
    env: {
      VITE_API_BASE_URL: process.env.VITE_API_BASE_URL_FOR_JEST_TESTS || 'http://localhost:7777/api/jest-setup-fallback' // Trailing comma removed
      // Add other import.meta.env variables if used and needed in tests
    },
  };
  console.log('[DEBUG jest.setup.js] Fallback global.importMeta.env configured. VITE_API_BASE_URL:', global.importMeta.env.VITE_API_BASE_URL);
} else if (global.importMeta && typeof global.importMeta.env === 'undefined') {
  global.importMeta.env = {
    VITE_API_BASE_URL: process.env.VITE_API_BASE_URL_FOR_JEST_TESTS || 'http://localhost:7777/api/jest-setup-fallback-env' // Trailing comma removed
  };
  console.log('[DEBUG jest.setup.js] global.importMeta was defined, but global.importMeta.env was not. Fallback global.importMeta.env configured. VITE_API_BASE_URL:', global.importMeta.env.VITE_API_BASE_URL);
} else {
  console.log('[DEBUG jest.setup.js] global.importMeta and global.importMeta.env already defined. VITE_API_BASE_URL:', global.importMeta.env.VITE_API_BASE_URL);
}


configure({ testIdAttribute: 'data-item-id' });
console.log('[DEBUG jest.setup.js] testIdAttribute configured to data-item-id.');

afterEach(() => {
  cleanup();
});