import { defineConfig, devices } from '@playwright/test';

/**
 * Configuration specifically for FAB (Floating Action Button) tests
 * This can be run independently or as part of the full test suite
 */
export default defineConfig({
  testDir: '../e2e',
  testMatch: '**/fab-*.spec.js',
  
  timeout: 30000,
  expect: {
    timeout: 10000,
  },

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['html', { 
      outputFolder: 'test-results/fab-tests/html-report',
      open: 'never'
    }],
    ['json', { 
      outputFile: 'test-results/fab-tests/results.json' 
    }],
    ['line'],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
    ignoreHTTPSErrors: true,
    acceptDownloads: true,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    storageState: './tests/fixtures/auth-state.json',
    testIdAttribute: 'data-testid',
  },

  projects: [
    // Desktop FAB tests
    {
      name: 'fab-desktop',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
      testMatch: '**/fab-menu.spec.js',
    },

    // Mobile FAB tests
    {
      name: 'fab-mobile',
      use: { 
        ...devices['Pixel 5'],
        viewport: { width: 375, height: 667 },
      },
      testMatch: '**/fab-mobile.spec.js',
    },

    // Comprehensive FAB functionality tests
    {
      name: 'fab-functionality',
      use: { 
        ...devices['Desktop Chrome'],
      },
      testMatch: '**/fab-functionality.spec.js',
    },

    // FAB tests on different browsers
    {
      name: 'fab-firefox',
      use: { 
        ...devices['Desktop Firefox'],
      },
      testMatch: '**/fab-menu.spec.js',
    },

    {
      name: 'fab-webkit',
      use: { 
        ...devices['Desktop Safari'],
      },
      testMatch: '**/fab-menu.spec.js',
    },

    // Mobile variations
    {
      name: 'fab-iphone',
      use: { 
        ...devices['iPhone 12'],
      },
      testMatch: '**/fab-mobile.spec.js',
    },

    {
      name: 'fab-android',
      use: { 
        ...devices['Pixel 5'],
      },
      testMatch: '**/fab-mobile.spec.js',
    },

    // Tablet tests
    {
      name: 'fab-tablet',
      use: { 
        ...devices['iPad Pro'],
      },
      testMatch: '**/fab-functionality.spec.js',
    },

    // Accessibility-focused FAB tests
    {
      name: 'fab-accessibility',
      use: {
        ...devices['Desktop Chrome'],
        // Enable accessibility features
        reducedMotion: 'reduce',
        forcedColors: 'none',
      },
      testMatch: '**/fab-functionality.spec.js',
      grep: /@accessibility/,
    },

    // Performance-focused FAB tests
    {
      name: 'fab-performance',
      use: {
        ...devices['Desktop Chrome'],
        // Lower-end device simulation
        launchOptions: {
          args: ['--disable-dev-shm-usage', '--disable-extensions'],
        },
      },
      testMatch: '**/fab-functionality.spec.js',
      grep: /@performance/,
    },
  ],

  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
    timeout: 120000,
  },

  outputDir: 'test-results/fab-tests/artifacts',
  maxFailures: process.env.CI ? 5 : undefined,

  metadata: {
    testType: 'fab-e2e',
    component: 'FloatingActionButton',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
  },
});