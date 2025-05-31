import { test, expect } from './fixtures/base.js';

test.describe('Responsive Design', () => {
  test('should work on mobile viewport', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize({ width: 375, height: 667 });
    
    // Should still show main interface
    await expect(authenticatedPage.locator('h1')).toContainText('Notes & Tasks');
    await expect(authenticatedPage.locator('nav[aria-label="Notes and Tasks Tree"]')).toBeVisible();
    
    // Header should adapt to mobile
    await expect(authenticatedPage.locator('header')).toHaveClass(/h-14/);
  });

  test('should handle mobile search sheet', async ({ authenticatedPage, testDataHelper }) => {
    await authenticatedPage.setViewportSize({ width: 375, height: 667 });
    
    await testDataHelper.createNote('Mobile Note');
    
    // Open search on mobile
    await authenticatedPage.click('[title*="Search"]');
    
    // Should show sheet interface
    await expect(authenticatedPage.locator('[data-item-id="search-sheet-container"]')).toBeVisible();
    
    // Search should work
    await authenticatedPage.fill('#global-search-input', 'mobile');
    await expect(authenticatedPage.locator('text=Mobile Note')).toBeVisible();
  });

  test('should handle tablet viewport', async ({ authenticatedPage, testDataHelper }) => {
    await authenticatedPage.setViewportSize({ width: 768, height: 1024 });
    
    await testDataHelper.createFolder('Tablet Test');
    await testDataHelper.createNote('Tablet Note', '', 'Tablet Test');
    
    // Should show side-by-side layout
    await authenticatedPage.click('text=Tablet Note');
    
    await expect(authenticatedPage.locator('nav[aria-label="Notes and Tasks Tree"]')).toBeVisible();
    await expect(authenticatedPage.locator('.ProseMirror')).toBeVisible();
  });

  test('should handle touch interactions', async ({ authenticatedPage, testDataHelper }) => {
    await authenticatedPage.setViewportSize({ width: 375, height: 667 });
    
    await testDataHelper.createTask('Touch Task');
    
    // Should handle touch for task completion
    const taskCheckbox = authenticatedPage.locator('li').filter({ hasText: 'Touch Task' }).locator('button[role="checkbox"]');
    await taskCheckbox.tap();
    
    await expect(taskCheckbox).toHaveAttribute('aria-checked', 'true');
  });
});