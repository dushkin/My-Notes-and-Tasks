import { test, expect } from './fixtures/base.js';

test.describe('Error Handling', () => {
  test('should handle network errors gracefully', async ({ authenticatedPage }) => {
    // Simulate network failure
    await authenticatedPage.route('**/api/**', route => {
      route.abort('failed');
    });
    
    // Try to create an item (should fail)
    await authenticatedPage.click('nav[aria-label="Notes and Tasks Tree"]', { button: 'right' });
    await authenticatedPage.click('text=Add Root Folder');
    await authenticatedPage.fill('input[placeholder*="Enter folder name"]', 'Network Test');
    await authenticatedPage.click('button:has-text("Add")');
    
    // Should show error message
    await expect(authenticatedPage.locator('[data-item-id="error-display-message"]')).toBeVisible();
  });

  test('should handle validation errors', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createFolder('Existing Folder');
    
    // Try to create folder with same name
    await authenticatedPage.click('nav[aria-label="Notes and Tasks Tree"]', { button: 'right' });
    await authenticatedPage.click('text=Add Root Folder');
    await authenticatedPage.fill('input[placeholder*="Enter folder name"]', 'Existing Folder');
    await authenticatedPage.click('button:has-text("Add")');
    
    // Should show validation error in dialog
    await expect(authenticatedPage.locator('text=already exists')).toBeVisible();
  });

  test('should handle session expiration', async ({ page }) => {
    // Login first
    await page.goto('/');
    await page.fill('#email-login', 'test@example.com');
    await page.fill('#password-login', 'password123');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('h1')).toContainText('Notes & Tasks');
    
    // Simulate token expiration
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ error: 'Token expired' })
      });
    });
    
    // Try an action that requires authentication
    await page.click('nav[aria-label="Notes and Tasks Tree"]', { button: 'right' });
    await page.click('text=Add Root Folder');
    await page.fill('input[placeholder*="Enter folder name"]', 'Test');
    await page.click('button:has-text("Add")');
    
    // Should redirect to login
    await expect(page.locator('h2')).toContainText('Login to Notes & Tasks');
  });

  test('should handle malformed data gracefully', async ({ authenticatedPage }) => {
    // Intercept API response with malformed data
    await authenticatedPage.route('**/api/items/tree', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ notesTree: 'invalid-data' })
      });
    });
    
    // Refresh to trigger data load
    await authenticatedPage.reload();
    
    // Should handle gracefully (empty tree or error message)
    await expect(authenticatedPage.locator('nav[aria-label="Notes and Tasks Tree"]')).toBeVisible();
  });

  test('should auto-dismiss error messages', async ({ authenticatedPage }) => {
    // Create an error condition
    await authenticatedPage.route('**/api/**', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Server error' })
      });
    });
    
    await authenticatedPage.click('nav[aria-label="Notes and Tasks Tree"]', { button: 'right' });
    await authenticatedPage.click('text=Add Root Folder');
    await authenticatedPage.fill('input[placeholder*="Enter folder name"]', 'Error Test');
    await authenticatedPage.click('button:has-text("Add")');
    
    // Error should appear
    const errorMessage = authenticatedPage.locator('[data-item-id="error-display-message"]');
    await expect(errorMessage).toBeVisible();
    
    // Should auto-dismiss after 5 seconds
    await expect(errorMessage).not.toBeVisible({ timeout: 6000 });
  });
});