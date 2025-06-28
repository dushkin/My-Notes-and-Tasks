// playwright.config.js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,             // Increase test timeout
  expect: { timeout: 10000 }, // Increase expect timeout

  // Global setup/teardown scripts
  globalSetup: './tests/global-setup.cjs',
  globalTeardown: './tests/global-teardown.cjs',

  // Sequential execution to avoid race conditions
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,

  // Enhanced reporting
  reporter: [
    ['html', { open: 'never' }],
    ['line'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
