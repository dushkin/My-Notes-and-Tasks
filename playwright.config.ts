import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e", // Directory where your tests are located
  fullyParallel: true, // Run tests in parallel
  forbidOnly: !!process.env.CI, // Fail the build on CI if you accidentally left test.only in the source code
  retries: process.env.CI ? 2 : 0, // Retry on CI only
  workers: process.env.CI ? 1 : undefined, // Opt out of parallel tests on CI
  reporter: "html", // Reporter to use. See https://playwright.dev/docs/test-reporters
  use: {
    baseURL: "http://localhost:5173", // Base URL to use in actions like `await page.goto('/')`
    trace: "on-first-retry", // Record trace only when retrying a test
    headless: process.env.CI ? true : true, // Run tests in headless mode by default (true for CI, true for local unless overridden)
    viewport: { width: 1280, height: 720 }, // Default viewport size
    actionTimeout: 10 * 1000, // Timeout for actions like click, fill, etc. (10 seconds)
    navigationTimeout: 30 * 1000, // Timeout for page navigation (30 seconds)
    launchOptions: {
      // slowMo: 250, // Uncomment to slow down Playwright operations (in ms)
    },
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  /* Folder for test artifacts such as screenshots, videos, traces, etc. */
  outputDir: "test-results/",

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run dev', // Adjust if your command to start the dev server is different
  //   url: 'http://localhost:5173',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120 * 1000, // 2 minutes to start the server
  //   stdout: 'pipe',
  //   stderr: 'pipe',
  // },
});
