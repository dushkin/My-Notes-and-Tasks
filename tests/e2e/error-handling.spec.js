import { test, expect } from './fixtures/base.js';

test.describe('Error Handling', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.reload();
    await authenticatedPage.waitForSelector('nav[aria-label="Notes and Tasks Tree"]');
    await authenticatedPage.waitForTimeout(1000);
  });

  test('should handle network errors gracefully', async ({ authenticatedPage }) => {
    await authenticatedPage.route('**/api/items**', route => {
      route.abort('failed');
    });

    await authenticatedPage.click('nav[aria-label="Notes and Tasks Tree"]', { button: 'right' });
    await authenticatedPage.waitForSelector('text=➕ Add Root Folder', { state: 'visible' });
    await authenticatedPage.click('text=➕ Add Root Folder');

    await authenticatedPage.waitForSelector('input[placeholder*="Enter folder name"]', { state: 'visible' });
    await authenticatedPage.fill('input[placeholder*="Enter folder name"]', 'Network Test');
    await authenticatedPage.click('button:has-text("Add")');

    const possibleErrorSelectors = [
      '[data-item-id="error-display-message"]',
      '.text-red-500',
      '.text-red-600',
      'p[class*="text-red"]',
      '[class*="bg-red"]'
    ];

    let errorFound = false;
    for (const selector of possibleErrorSelectors) {
      try {
        await expect(authenticatedPage.locator(selector)).toBeVisible({ timeout: 5000 });
        errorFound = true;
        break;
      } catch (e) { }
    }

    if (!errorFound) {
      const networkTestItem = authenticatedPage.locator('text=Network Test');
      await expect(networkTestItem).not.toBeVisible();
    }
  });

  test('should handle validation errors', async ({ authenticatedPage, testDataHelper }) => {
    const existingFolderName = await testDataHelper.createFolder('Existing Folder');
    await authenticatedPage.waitForTimeout(1000);

    await authenticatedPage.click('nav[aria-label="Notes and Tasks Tree"]', { button: 'right' });
    await authenticatedPage.waitForSelector('text=➕ Add Root Folder', { state: 'visible' });
    await authenticatedPage.click('text=➕ Add Root Folder');

    await authenticatedPage.waitForSelector('input[placeholder*="Enter folder name"]', { state: 'visible' });
    await authenticatedPage.fill('input[placeholder*="Enter folder name"]', existingFolderName);
    await authenticatedPage.click('button:has-text("Add")');

    const possibleValidationErrorSelectors = [
      'text*=already exists',
      'text*=duplicate',
      'text*=name exists',
      '.text-red-600',
      '.text-red-500',
      'p[class*="text-red"]',
      '[data-item-id="add-error-message"]'
    ];

    let validationErrorFound = false;
    for (const selector of possibleValidationErrorSelectors) {
      try {
        await expect(authenticatedPage.locator(selector)).toBeVisible({ timeout: 3000 });
        validationErrorFound = true;
        break;
      } catch (e) { }
    }

    if (!validationErrorFound) {
      const duplicateItems = authenticatedPage.locator(`text=${existingFolderName}`);
      const count = await duplicateItems.count();
      expect(count).toBe(1);
    }
  });

  // FIXED: Session expiration test
  test('should handle session expiration', async ({ browser }) => {
    // Create a fresh context to avoid any cached authentication
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Login first
      await page.goto('/');

      // Wait for login form to be ready
      await page.waitForSelector('#email-login', { state: 'visible' });
      await page.fill('#email-login', 'test@e2e.com');
      await page.fill('#password-login', 'password123');
      await page.click('button[type="submit"]');

      // Wait for successful login
      await expect(page.locator('h1')).toContainText('Notes & Tasks');

      // Simulate token expiration by intercepting API calls
      await page.route('**/api/**', route => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Token expired' })
        });
      });

      // Try an action that requires authentication
      await page.click('nav[aria-label="Notes and Tasks Tree"]', { button: 'right' });
      await page.waitForSelector('text=➕ Add Root Folder', { state: 'visible' });
      await page.click('text=➕ Add Root Folder');

      await page.waitForSelector('input[placeholder*="Enter folder name"]', { state: 'visible' });
      await page.fill('input[placeholder*="Enter folder name"]', 'Test');
      await page.click('button:has-text("Add")');

      // Should redirect to login or show login form
      await Promise.race([
        expect(page.locator('h2:has-text("Login to Notes & Tasks")')).toBeVisible({ timeout: 10000 }),
        expect(page.locator('#email-login')).toBeVisible({ timeout: 10000 }),
        expect(page.locator('button:has-text("Login")')).toBeVisible({ timeout: 10000 })
      ]);

    } finally {
      await context.close();
    }
  });

  test('should handle malformed data gracefully', async ({ authenticatedPage }) => {
    await authenticatedPage.route('**/api/items/tree', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ notesTree: 'invalid-data' })
      });
    });

    await authenticatedPage.reload();
    await expect(authenticatedPage.locator('nav[aria-label="Notes and Tasks Tree"]')).toBeVisible();
    await expect(authenticatedPage.locator('h1:has-text("Notes & Tasks")')).toBeVisible();
  });

  // FIXED: Auto-dismiss test - the error is in the ADD dialog, not a toast message
  test('should handle error display and dismissal', async ({ authenticatedPage }) => {
    await authenticatedPage.route('**/api/items**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server error' })
      });
    });

    await authenticatedPage.click('nav[aria-label="Notes and Tasks Tree"]', { button: 'right' });
    await authenticatedPage.waitForSelector('text=➕ Add Root Folder', { state: 'visible' });
    await authenticatedPage.click('text=➕ Add Root Folder');

    await authenticatedPage.waitForSelector('input[placeholder*="Enter folder name"]', { state: 'visible' });
    await authenticatedPage.fill('input[placeholder*="Enter folder name"]', 'Error Test');
    await authenticatedPage.click('button:has-text("Add")');

    // The error appears in the dialog as '#add-error-message'
    const dialogError = authenticatedPage.locator('#add-error-message');
    await expect(dialogError).toBeVisible();
    await expect(dialogError).toContainText('Server error');

    // This error is in the dialog and should be dismissed when dialog is closed
    // Let's close the dialog to clear the error
    await authenticatedPage.click('button:has-text("Cancel")');

    // After closing dialog, error should not be visible
    await expect(dialogError).not.toBeVisible();

    // Verify the item was not created
    await expect(authenticatedPage.locator('text=Error Test')).not.toBeVisible();
  });
});