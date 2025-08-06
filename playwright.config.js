import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  
  /* Timeout for each test */
  timeout: 30000,
  
  /* Expect timeout for assertions */
  expect: {
    timeout: 10000,
  },

  /* Run tests in files in parallel */
  fullyParallel: true,
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  
  /* Global test setup */
  globalSetup: './tests/config/global-setup.js',
  globalTeardown: './tests/config/global-teardown.js',

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { 
      outputFolder: 'test-results/html-report',
      open: 'never'
    }],
    ['json', { 
      outputFile: 'test-results/results.json' 
    }],
    ['junit', { 
      outputFile: 'test-results/junit.xml' 
    }],
    ['line'],
    ['allure-playwright', {
      detail: true,
      suiteTitle: false,
      outputFolder: 'test-results/allure-results'
    }]
  ],

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'http://localhost:5173',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Record video on failure */
    video: 'retain-on-failure',
    
    /* Action timeout */
    actionTimeout: 15000,
    
    /* Navigation timeout */
    navigationTimeout: 30000,
    
    /* Ignore HTTPS errors */
    ignoreHTTPSErrors: true,
    
    /* Accept downloads */
    acceptDownloads: true,
    
    /* Locale */
    locale: 'en-US',
    
    /* Timezone */
    timezoneId: 'America/New_York',
    
    /* Geolocation */
    geolocation: { longitude: -74.006, latitude: 40.7128 }, // New York
    permissions: ['geolocation'],
    
    /* Default storage state */
    storageState: './tests/fixtures/auth-state.json',
    
    /* Custom test attributes */
    testIdAttribute: 'data-testid',
  },

  /* Configure projects for major browsers */
  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testMatch: /.*\.setup\.js/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },

    /* Desktop browsers */
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
      dependencies: ['setup'],
    },

    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'] 
      },
      dependencies: ['setup'],
    },

    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'] 
      },
      dependencies: ['setup'],
    },

    /* Microsoft Edge */
    {
      name: 'edge',
      use: { 
        ...devices['Desktop Chrome'],
        channel: 'msedge',
      },
      dependencies: ['setup'],
    },

    /* Mobile browsers */
    {
      name: 'mobile-chrome',
      use: { 
        ...devices['Pixel 5'] 
      },
      dependencies: ['setup'],
    },

    {
      name: 'mobile-safari',
      use: { 
        ...devices['iPhone 12'] 
      },
      dependencies: ['setup'],
    },

    /* Android-specific testing */
    {
      name: 'android-webview',
      use: {
        ...devices['Pixel 5'],
        // Simulate Capacitor WebView environment
        userAgent: 'Mozilla/5.0 (Linux; Android 12; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/103.0.0.0 Mobile Safari/537.36 wv',
        viewport: { width: 393, height: 851 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
      dependencies: ['setup'],
    },

    {
      name: 'android-tablet',
      use: {
        ...devices['Galaxy Tab S4'],
        // Android tablet WebView
        userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-T835) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/103.0.0.0 Safari/537.36 wv',
        viewport: { width: 712, height: 1138 },
        deviceScaleFactor: 2.25,
        isMobile: true,
        hasTouch: true,
      },
      dependencies: ['setup'],
    },

    {
      name: 'android-small-screen',
      use: {
        ...devices['Pixel 4a (5G)'],
        // Smaller Android device
        userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 4a (5G)) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/103.0.0.0 Mobile Safari/537.36 wv',
        viewport: { width: 353, height: 745 },
        deviceScaleFactor: 2.75,
        isMobile: true,
        hasTouch: true,
      },
      dependencies: ['setup'],
    },

    /* Tablet browsers */
    {
      name: 'tablet-chrome',
      use: { 
        ...devices['iPad Pro'] 
      },
      dependencies: ['setup'],
    },

    /* Different viewport sizes */
    {
      name: 'desktop-1920',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
      dependencies: ['setup'],
    },

    {
      name: 'desktop-1366',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1366, height: 768 },
      },
      dependencies: ['setup'],
    },

    /* Accessibility testing */
    {
      name: 'accessibility',
      use: {
        ...devices['Desktop Chrome'],
      },
      testMatch: /.*\.a11y\.spec\.js/,
      dependencies: ['setup'],
    },

    /* API testing */
    {
      name: 'api',
      use: {
        baseURL: process.env.API_BASE_URL || 'http://localhost:3000',
      },
      testMatch: /.*\.api\.spec\.js/,
    },

    /* Visual regression testing */
    {
      name: 'visual',
      use: {
        ...devices['Desktop Chrome'],
      },
      testMatch: /.*\.visual\.spec\.js/,
      dependencies: ['setup'],
    },
  ],

  /* Environment-specific configurations */
  ...(process.env.NODE_ENV === 'production' && {
    use: {
      baseURL: process.env.PROD_BASE_URL || 'https://your-production-url.com',
    },
  }),

  ...(process.env.NODE_ENV === 'staging' && {
    use: {
      baseURL: process.env.STAGING_BASE_URL || 'https://your-staging-url.com',
    },
  }),

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
    timeout: 120000,
  },

  /* Output directory for test results */
  outputDir: 'test-results/artifacts',

  /* Maximum number of test failures before stopping */
  maxFailures: process.env.CI ? 10 : undefined,

  /* Test metadata */
  metadata: {
    testType: 'e2e',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
  },
});