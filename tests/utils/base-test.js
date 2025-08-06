import { test as baseTest, expect } from '@playwright/test';
import { TestLogger } from './test-logger.js';
import { TestDataManager } from './test-data-manager.js';
import { ScreenshotManager } from './screenshot-manager.js';

// Extended test with custom fixtures and utilities
export const test = baseTest.extend({
  // Custom logger fixture
  logger: async ({}, use) => {
    const logger = new TestLogger();
    await use(logger);
  },

  // Test data manager fixture
  testData: async ({}, use) => {
    const testDataManager = new TestDataManager();
    await use(testDataManager);
    await testDataManager.cleanup();
  },

  // Screenshot manager fixture
  screenshots: async ({ page }, use) => {
    const screenshotManager = new ScreenshotManager(page);
    await use(screenshotManager);
  },

  // Auto-authenticated page fixture
  authenticatedPage: async ({ page, logger }, use) => {
    logger.info('Setting up authenticated page');
    
    // Check if already authenticated
    await page.goto('/');
    const isAuthenticated = await page.locator('[data-testid="user-menu"]')
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    
    if (!isAuthenticated) {
      logger.warn('Page not authenticated, attempting login');
      // Login logic here if needed
    }
    
    await use(page);
  },

  // Mobile context fixture
  mobileContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
      hasTouch: true,
      isMobile: true,
    });
    
    await use(context);
    await context.close();
  },

  // API context fixture
  apiContext: async ({ playwright }, use) => {
    const apiContext = await playwright.request.newContext({
      baseURL: process.env.API_BASE_URL || 'http://localhost:3000',
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
    
    await use(apiContext);
    await apiContext.dispose();
  },
});

// Custom expect with additional matchers
export { expect } from '@playwright/test';

// Extended expect for custom assertions
export const customExpect = expect.extend({
  async toHaveAccessibleName(locator, expectedName) {
    const accessibleName = await locator.getAttribute('aria-label') || 
                          await locator.getAttribute('aria-labelledby') ||
                          await locator.textContent();
    
    const pass = accessibleName === expectedName;
    
    return {
      message: () => pass 
        ? `Expected accessible name not to be "${expectedName}"` 
        : `Expected accessible name to be "${expectedName}", but got "${accessibleName}"`,
      pass,
    };
  },

  async toBeInViewport(locator) {
    const boundingBox = await locator.boundingBox();
    const viewport = await locator.page().viewportSize();
    
    const pass = boundingBox && 
                 boundingBox.x >= 0 && 
                 boundingBox.y >= 0 &&
                 boundingBox.x + boundingBox.width <= viewport.width &&
                 boundingBox.y + boundingBox.height <= viewport.height;
    
    return {
      message: () => pass 
        ? 'Expected element not to be in viewport' 
        : 'Expected element to be in viewport',
      pass,
    };
  },

  async toHaveValidationError(locator, expectedError) {
    const errorMessage = await locator.getAttribute('aria-describedby');
    const errorElement = errorMessage ? 
      locator.page().locator(`#${errorMessage}`) : 
      locator.locator('~ .error-message, ~ [role="alert"]').first();
    
    const actualError = await errorElement.textContent();
    const pass = actualError?.includes(expectedError);
    
    return {
      message: () => pass 
        ? `Expected validation error not to contain "${expectedError}"` 
        : `Expected validation error to contain "${expectedError}", but got "${actualError}"`,
      pass,
    };
  },
});

// Test helper functions
export const testHelpers = {
  // Wait for network to be idle
  async waitForNetworkIdle(page, timeout = 30000) {
    return page.waitForLoadState('networkidle', { timeout });
  },

  // Wait for animations to complete
  async waitForAnimations(page) {
    await page.waitForFunction(() => {
      return document.getAnimations().every(animation => 
        animation.playState === 'finished' || animation.playState === 'idle'
      );
    }, { timeout: 10000 });
  },

  // Simulate slow network
  async simulateSlowNetwork(page) {
    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: 1000 * 1024, // 1MB/s
      uploadThroughput: 500 * 1024,    // 500KB/s
      latency: 200, // 200ms
    });
  },

  // Reset network conditions
  async resetNetworkConditions(page) {
    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0,
    });
  },

  // Generate random test data
  generateRandomData: {
    email: () => `test-${Date.now()}@example.com`,
    username: () => `user-${Date.now()}`,
    title: () => `Test Task ${Date.now()}`,
    content: () => `Test content created at ${new Date().toISOString()}`,
    uuid: () => crypto.randomUUID(),
  },
};