// playwright.config.cjs
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000, // Increase test timeout
  expect: {
    timeout: 10000 // Increase expect timeout
  },

  // Update paths to point to .cjs files
  globalSetup: require.resolve('./tests/global-setup.cjs'),
  globalTeardown: require.resolve('./tests/global-teardown.cjs'),

  // CRITICAL CHANGES FOR DRAG-DROP TESTS:
  fullyParallel: false, // Changed from true - prevents race conditions
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1, // Changed from 0 to 1 for local retries
  workers: 1, // Changed from undefined - forces sequential execution
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Add these for better stability:
    actionTimeout: 30000, // Longer timeout for actions
    navigationTimeout: 30000, // Longer timeout for navigation
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: 'npm run dev',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 120000, // Add timeout for server startup
    },
  ],
});