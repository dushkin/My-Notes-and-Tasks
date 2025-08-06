import { test, expect } from '../fixtures/test-fixtures.js';

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set consistent viewport for visual tests
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('should match login page screenshot', async ({ page, screenshots, logger }) => {
    logger.info('Taking login page screenshot');
    
    await page.goto('/login');
    
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    
    // Hide dynamic elements that might cause flakiness
    await page.addStyleTag({
      content: `
        .loading, .spinner, [data-testid="loading"] { display: none !important; }
        .timestamp, .current-time { display: none !important; }
      `
    });
    
    // Take screenshot
    await expect(page).toHaveScreenshot('login-page.png');
    
    logger.info('Login page screenshot captured');
  });

  test('should match dashboard page screenshot', async ({ page, dashboardPage, screenshots, logger }) => {
    logger.info('Taking dashboard screenshot');
    
    await dashboardPage.goto();
    
    // Wait for dashboard to fully load
    await dashboardPage.waitForDashboardLoad();
    
    // Hide dynamic content
    await page.addStyleTag({
      content: `
        .loading, .spinner, [data-testid="loading"] { display: none !important; }
        .timestamp, .last-modified, .current-time { display: none !important; }
        .online-indicator, .connection-status { display: none !important; }
      `
    });
    
    await expect(page).toHaveScreenshot('dashboard-page.png');
    
    logger.info('Dashboard screenshot captured');
  });

  test('should match modal dialog screenshot', async ({ page, dashboardPage, screenshots, logger }) => {
    logger.info('Taking modal dialog screenshot');
    
    await dashboardPage.goto();
    await dashboardPage.addButton.click();
    
    await page.waitForSelector('[data-testid="add-dialog"], .add-dialog', { 
      state: 'visible' 
    });
    
    // Take screenshot of just the modal
    const modal = page.locator('[data-testid="add-dialog"], .add-dialog');
    await expect(modal).toHaveScreenshot('add-dialog-modal.png');
    
    logger.info('Modal dialog screenshot captured');
  });

  test('should match content editor screenshot', async ({ page, dashboardPage, testData, screenshots, logger }) => {
    logger.info('Taking content editor screenshot');
    
    await dashboardPage.goto();
    
    // Create a note with sample content
    const noteData = testData.generateNoteData({
      title: 'Sample Note for Visual Test',
      content: '<h1>Sample Heading</h1><p>This is sample content for visual testing with <strong>bold text</strong> and <em>italic text</em>.</p>'
    });
    
    await dashboardPage.createNote(noteData.title, noteData.content);
    
    // Wait for editor to load content
    await page.waitForTimeout(1000);
    
    // Take screenshot of the editor
    const editor = page.locator('[data-testid="content-editor"], .content-editor');
    await expect(editor).toHaveScreenshot('content-editor.png');
    
    logger.info('Content editor screenshot captured');
  });

  test('should match different viewport sizes', async ({ page, dashboardPage, screenshots, logger }) => {
    logger.info('Taking screenshots at different viewport sizes');
    
    const viewports = [
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1920, height: 1080 }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await dashboardPage.goto();
      await dashboardPage.waitForDashboardLoad();
      
      // Hide dynamic content
      await page.addStyleTag({
        content: `
          .loading, .spinner { display: none !important; }
          .timestamp, .last-modified { display: none !important; }
        `
      });
      
      await expect(page).toHaveScreenshot(`dashboard-${viewport.name}.png`);
      
      logger.info(`Screenshot captured for ${viewport.name} viewport`);
    }
  });

  test('should match theme variations', async ({ page, dashboardPage, screenshots, logger }) => {
    logger.info('Taking screenshots of different themes');
    
    await dashboardPage.goto();
    
    const themes = ['light', 'dark'];
    
    for (const theme of themes) {
      // Apply theme (this will depend on your theme implementation)
      await page.evaluate((themeName) => {
        document.documentElement.setAttribute('data-theme', themeName);
        document.body.className = document.body.className.replace(/theme-\w+/g, '') + ` theme-${themeName}`;
      }, theme);
      
      await page.waitForTimeout(500); // Wait for theme to apply
      
      await expect(page).toHaveScreenshot(`dashboard-${theme}-theme.png`);
      
      logger.info(`Screenshot captured for ${theme} theme`);
    }
  });

  test('should match error states', async ({ page, loginPage, screenshots, logger }) => {
    logger.info('Taking screenshots of error states');
    
    await loginPage.goto();
    
    // Trigger validation errors
    await loginPage.fillEmail('invalid-email');
    await loginPage.fillPassword('');
    await loginPage.clickLogin();
    
    // Wait for errors to appear
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('login-validation-errors.png');
    
    logger.info('Error state screenshot captured');
  });

  test('should match loading states', async ({ page, dashboardPage, screenshots, logger }) => {
    logger.info('Taking screenshots of loading states');
    
    // Slow down network to capture loading state
    await page.route('**/*', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.continue();
    });
    
    const navigationPromise = dashboardPage.goto();
    
    // Wait a bit then capture loading state
    await page.waitForTimeout(500);
    
    // Look for loading indicators
    const loadingIndicator = page.locator('[data-testid="loading"], .loading, .spinner').first();
    
    if (await loadingIndicator.isVisible().catch(() => false)) {
      await expect(page).toHaveScreenshot('dashboard-loading-state.png');
      logger.info('Loading state screenshot captured');
    }
    
    await navigationPromise;
  });

  test('should match component states', async ({ page, dashboardPage, testData, screenshots, logger }) => {
    logger.info('Taking screenshots of different component states');
    
    await dashboardPage.goto();
    
    // Create test data to show different states
    await dashboardPage.createTask('Completed Task', { status: 'completed' });
    await dashboardPage.createTask('In Progress Task', { status: 'in-progress' });
    await dashboardPage.createTask('High Priority Task', { priority: 'high' });
    
    // Screenshot the tree with different item states
    const tree = page.locator('[data-testid="tree-container"], .tree-container');
    await expect(tree).toHaveScreenshot('tree-with-different-states.png');
    
    logger.info('Component states screenshot captured');
  });

  test('should handle dynamic content masking', async ({ page, dashboardPage, screenshots, logger }) => {
    logger.info('Testing dynamic content masking');
    
    await dashboardPage.goto();
    
    // Mask dynamic content that changes between runs
    await page.addStyleTag({
      content: `
        [data-dynamic="true"], .timestamp, .last-modified, .current-time {
          background: #cccccc !important;
          color: transparent !important;
        }
        [data-testid="user-avatar"] img {
          background: #cccccc !important;
        }
      `
    });
    
    await expect(page).toHaveScreenshot('dashboard-masked-dynamic-content.png');
    
    logger.info('Dynamic content masking screenshot captured');
  });
});