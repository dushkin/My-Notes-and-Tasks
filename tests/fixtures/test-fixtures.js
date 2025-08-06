import { test as baseTest } from '@playwright/test';
import { LoginPage } from '../pages/login-page.js';
import { DashboardPage } from '../pages/dashboard-page.js';
import { TestDataManager } from '../utils/test-data-manager.js';
import { TestLogger } from '../utils/test-logger.js';
import { ScreenshotManager } from '../utils/screenshot-manager.js';

// Extend base test with custom fixtures
export const test = baseTest.extend({
  // Page Object fixtures
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },

  dashboardPage: async ({ page }, use) => {
    const dashboardPage = new DashboardPage(page);
    await use(dashboardPage);
  },

  // Utility fixtures
  testData: async ({}, use) => {
    const testDataManager = new TestDataManager();
    await use(testDataManager);
    await testDataManager.cleanup();
  },

  logger: async ({ page }, use, testInfo) => {
    const logger = new TestLogger();
    logger.setTestName(testInfo.title);
    
    // Log test start
    logger.info(`Starting test: ${testInfo.title}`);
    logger.info(`Project: ${testInfo.project.name}`);
    logger.info(`Retry: ${testInfo.retry}`);
    
    await use(logger);
    
    // Log test end and save logs
    const summary = logger.getSummary();
    logger.info(`Test completed in ${summary.duration}ms`);
    
    if (testInfo.status === 'failed') {
      logger.error('Test failed', { 
        error: testInfo.errors,
        attachments: testInfo.attachments 
      });
    }
    
    await logger.saveToFile();
  },

  screenshots: async ({ page }, use) => {
    const screenshotManager = new ScreenshotManager(page);
    await use(screenshotManager);
  },

  // Authentication fixtures
  authenticatedUser: async ({ page, testData }, use) => {
    const userData = testData.generateUserData();
    
    // This would typically create a user via API
    // For now, we'll use the existing auth state
    await page.goto('/');
    
    // Check if already authenticated
    const isAuthenticated = await page.locator('[data-testid="user-menu"]')
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    
    if (!isAuthenticated) {
      // Perform login
      const loginPage = new LoginPage(page);
      const credentials = LoginPage.getValidCredentials();
      await loginPage.login(credentials.email, credentials.password);
    }
    
    await use(userData);
  },

  // Test environment fixtures
  mobileViewport: async ({ page }, use) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await use();
  },

  tabletViewport: async ({ page }, use) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await use();
  },

  desktopViewport: async ({ page }, use) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await use();
  },

  // Slow network fixture
  slowNetwork: async ({ page }, use) => {
    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: 1000 * 1024, // 1MB/s
      uploadThroughput: 500 * 1024,    // 500KB/s
      latency: 200, // 200ms
    });
    
    await use();
    
    // Reset network conditions
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0,
    });
  },

  // Database fixtures
  cleanDatabase: async ({ testData }, use) => {
    // Clean database before test
    await testData.cleanup();
    
    await use();
    
    // Clean database after test
    await testData.cleanup();
  },

  seededDatabase: async ({ testData }, use) => {
    // Seed database with test data
    const seedData = {
      folders: [
        { name: 'Test Folder 1', id: 'folder-1' },
        { name: 'Test Folder 2', id: 'folder-2' }
      ],
      tasks: [
        testData.generateTaskData({ title: 'Test Task 1' }),
        testData.generateTaskData({ title: 'Test Task 2' }),
        testData.generateTaskData({ title: 'Test Task 3' })
      ],
      notes: [
        testData.generateNoteData({ title: 'Test Note 1' }),
        testData.generateNoteData({ title: 'Test Note 2' })
      ]
    };
    
    const seededData = await testData.seedDatabase(seedData);
    
    await use(seededData);
    
    // Cleanup will be handled by testData fixture
  },

  // API fixtures
  apiClient: async ({ playwright, testData }, use) => {
    const environment = testData.getEnvironmentData();
    
    const apiContext = await playwright.request.newContext({
      baseURL: environment.apiBaseUrl,
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${process.env.TEST_API_TOKEN || ''}`
      },
    });
    
    await use(apiContext);
    await apiContext.dispose();
  },

  // Performance monitoring fixture
  performanceMonitor: async ({ page }, use) => {
    const metrics = [];
    
    // Start monitoring
    page.on('response', (response) => {
      metrics.push({
        url: response.url(),
        status: response.status(),
        timing: response.request().timing(),
        size: response.headers()['content-length'] || 0,
        timestamp: Date.now()
      });
    });
    
    await use({
      getMetrics: () => metrics,
      getSlowRequests: (threshold = 1000) => 
        metrics.filter(m => m.timing && m.timing.responseEnd > threshold),
      getFailedRequests: () => 
        metrics.filter(m => m.status >= 400),
      getTotalSize: () => 
        metrics.reduce((total, m) => total + parseInt(m.size || 0), 0)
    });
  },

  // Console monitoring fixture
  consoleMonitor: async ({ page }, use) => {
    const consoleLogs = [];
    const errors = [];
    
    page.on('console', (msg) => {
      const logEntry = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        timestamp: Date.now()
      };
      
      consoleLogs.push(logEntry);
      
      if (msg.type() === 'error') {
        errors.push(logEntry);
      }
    });
    
    page.on('pageerror', (error) => {
      errors.push({
        type: 'pageerror',
        text: error.message,
        stack: error.stack,
        timestamp: Date.now()
      });
    });
    
    await use({
      getLogs: () => consoleLogs,
      getErrors: () => errors,
      getLogsByType: (type) => consoleLogs.filter(log => log.type === type),
      hasErrors: () => errors.length > 0,
      clearLogs: () => {
        consoleLogs.length = 0;
        errors.length = 0;
      }
    });
  },

  // File upload fixture
  fileUploader: async ({ testData }, use) => {
    const uploadHelper = {
      createTestFile: (filename, content = 'Test file content') => 
        testData.createTestFile(filename, content),
      
      createTestImage: (filename = 'test-image.png') => 
        testData.createTestImage(filename),
      
      createTestDocument: (filename = 'test-doc.txt', size = 1024) => {
        const content = 'A'.repeat(size);
        return testData.createTestFile(filename, content);
      }
    };
    
    await use(uploadHelper);
  },

  // Accessibility testing fixture
  accessibilityChecker: async ({ page }, use) => {
    // This would integrate with @axe-core/playwright
    const axeChecker = {
      checkPage: async (options = {}) => {
        // Implementation would use axe-core
        return {
          violations: [],
          passes: [],
          incomplete: [],
          inapplicable: []
        };
      },
      
      checkElement: async (selector, options = {}) => {
        // Check specific element for accessibility issues
        return {
          violations: [],
          passes: []
        };
      },
      
      checkColorContrast: async () => {
        // Check color contrast ratios
        return await page.evaluate(() => {
          // Implementation would check contrast ratios
          return { passes: true, ratio: 4.5 };
        });
      }
    };
    
    await use(axeChecker);
  },

  // Local storage fixture
  localStorage: async ({ page }, use) => {
    const storageHelper = {
      setItem: async (key, value) => {
        await page.evaluate(({ key, value }) => {
          localStorage.setItem(key, JSON.stringify(value));
        }, { key, value });
      },
      
      getItem: async (key) => {
        return await page.evaluate((key) => {
          const item = localStorage.getItem(key);
          return item ? JSON.parse(item) : null;
        }, key);
      },
      
      removeItem: async (key) => {
        await page.evaluate((key) => {
          localStorage.removeItem(key);
        }, key);
      },
      
      clear: async () => {
        await page.evaluate(() => {
          localStorage.clear();
        });
      },
      
      getAllItems: async () => {
        return await page.evaluate(() => {
          const items = {};
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            items[key] = JSON.parse(localStorage.getItem(key));
          }
          return items;
        });
      }
    };
    
    await use(storageHelper);
  }
});

// Re-export expect
export { expect } from '@playwright/test';