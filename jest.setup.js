// jest.setup.js
import { cleanup } from '@testing-library/react';
import { configure } from '@testing-library/dom';
import '@testing-library/jest-dom';

console.log('[DEBUG jest.setup.js] This setup file IS RUNNING.');

// Determine a consistent base URL for tests
// You can change the value here to the URL that suits your test server,
// or use the VITE_API_BASE_URL_FOR_JEST_TESTS environment variable if you prefer.
const JEST_VITE_API_BASE_URL = process.env.VITE_API_BASE_URL_FOR_JEST_TESTS || 'http://localhost:5001/api/jest-fallback';

// Handling import.meta.env
if (typeof global.importMeta === 'undefined') {
  // If global.importMeta is not defined at all, define it and its 'env' property
  global.importMeta = {
    env: {
      VITE_API_BASE_URL: JEST_VITE_API_BASE_URL
      // Add other VITE_ variables here if needed
    },
  };
  console.log('[DEBUG jest.setup.js] global.importMeta and .env configured. VITE_API_BASE_URL:', global.importMeta.env.VITE_API_BASE_URL);
} else if (typeof global.importMeta.env === 'undefined') {
  // If global.importMeta is defined, but 'env' on it is not defined
  global.importMeta.env = {
    VITE_API_BASE_URL: JEST_VITE_API_BASE_URL
    // Add other VITE_ variables here if needed
  };
  console.log('[DEBUG jest.setup.js] global.importMeta.env configured on existing global.importMeta. VITE_API_BASE_URL:', global.importMeta.env.VITE_API_BASE_URL);
} else {
  // If global.importMeta and global.importMeta.env are already defined
  // Ensure the specific VITE_API_BASE_URL variable exists, and if not, define it.
  // This is useful if another tool defined 'env' but not all necessary variables.
  if (typeof global.importMeta.env.VITE_API_BASE_URL === 'undefined') {
    global.importMeta.env.VITE_API_BASE_URL = JEST_VITE_API_BASE_URL;
    console.log('[DEBUG jest.setup.js] VITE_API_BASE_URL was missing on existing global.importMeta.env, now set to:', global.importMeta.env.VITE_API_BASE_URL);
  } else {
    console.log('[DEBUG jest.setup.js] global.importMeta, .env, and VITE_API_BASE_URL already defined. Current VITE_API_BASE_URL:', global.importMeta.env.VITE_API_BASE_URL);
    // If you want the default jest.setup.js configuration to always "win",
    // you could remove the preceding condition and set
    // global.importMeta.env.VITE_API_BASE_URL = JEST_VITE_API_BASE_URL; here unconditionally.
    // However, the current behavior of "do not override if already exists" is often safer.
  }
}

// Configure a global testIdAttribute for testing-library
configure({ testIdAttribute: 'data-item-id' });
console.log('[DEBUG jest.setup.js] testIdAttribute configured to data-item-id.');

// Cleanup after each test
afterEach(() => {
  cleanup();
});