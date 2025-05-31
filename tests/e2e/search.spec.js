import { test, expect } from './fixtures/base.js';

test.describe('Search Functionality', () => {
  test('should open search panel', async ({ authenticatedPage }) => {
    // Use keyboard shortcut
    await authenticatedPage.keyboard.press('Control+Shift+f');
    
    await expect(authenticatedPage.locator('#global-search-input')).toBeVisible();
    
    // Or use search button
    await authenticatedPage.click('[title*="Search"]');
    await expect(authenticatedPage.locator('#global-search-input')).toBeVisible();
  });

  test('should search and find items', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createNote('Meeting Notes', 'Important discussion about project timeline');
    await testDataHelper.createTask('Review Meeting');
    await testDataHelper.createFolder('Meeting Documents');
    
    // Open search
    await authenticatedPage.keyboard.press('Control+Shift+f');
    
    // Search for "meeting"
    await authenticatedPage.fill('#global-search-input', 'meeting');
    
    // Should show search results
    await expect(authenticatedPage.locator('text=Meeting Notes')).toBeVisible();
    await expect(authenticatedPage.locator('text=Review Meeting')).toBeVisible();
    await expect(authenticatedPage.locator('text=Meeting Documents')).toBeVisible();
  });

  test('should highlight search matches', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createNote('Important Notes', 'This contains important information');
    
    await authenticatedPage.keyboard.press('Control+Shift+f');
    await authenticatedPage.fill('#global-search-input', 'important');
    
    // Should highlight matches
    await expect(authenticatedPage.locator('.text-yellow-600')).toBeVisible();
  });

  test('should navigate to search results', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createFolder('Documents');
    await testDataHelper.createNote('Project Plan', 'Detailed project timeline', 'Documents');
    
    await authenticatedPage.keyboard.press('Control+Shift+f');
    await authenticatedPage.fill('#global-search-input', 'project');
    
    // Click on search result
    await authenticatedPage.click('.cursor-pointer:has-text("Project Plan")');
    
    // Should close search and navigate to item
    await expect(authenticatedPage.locator('#global-search-input')).not.toBeVisible();
    await expect(authenticatedPage.locator('h2')).toContainText('Project Plan');
  });

  test('should toggle search options', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createNote('CaseSensitive', 'Test content');
    
    await authenticatedPage.keyboard.press('Control+Shift+f');
    
    // Search with case sensitive off (default)
    await authenticatedPage.fill('#global-search-input', 'casesensitive');
    await expect(authenticatedPage.locator('text=CaseSensitive')).toBeVisible();
    
    // Enable case sensitive
    await authenticatedPage.click('[title="Case Sensitive"]');
    await expect(authenticatedPage.locator('text=CaseSensitive')).not.toBeVisible();
    
    // Search with correct case
    await authenticatedPage.fill('#global-search-input', 'CaseSensitive');
    await expect(authenticatedPage.locator('text=CaseSensitive')).toBeVisible();
  });

  test('should close search panel', async ({ authenticatedPage }) => {
    await authenticatedPage.keyboard.press('Control+Shift+f');
    await expect(authenticatedPage.locator('#global-search-input')).toBeVisible();
    
    // Close with X button
    await authenticatedPage.click('button[title="Close Search"]');
    await expect(authenticatedPage.locator('#global-search-input')).not.toBeVisible();
    
    // Or close with keyboard shortcut again
    await authenticatedPage.keyboard.press('Control+Shift+f');
    await expect(authenticatedPage.locator('#global-search-input')).toBeVisible();
    await authenticatedPage.keyboard.press('Control+Shift+f');
    await expect(authenticatedPage.locator('#global-search-input')).not.toBeVisible();
  });
});
