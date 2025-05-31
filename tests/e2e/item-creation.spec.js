import { test, expect } from './fixtures/base.js';

test.describe('Item Creation', () => {
  test('should create different types of items', async ({ authenticatedPage }) => {
    // Create folder via header menu
    await authenticatedPage.click('[title="More actions"]');
    await authenticatedPage.click('text=Add Root Folder');
    
    await authenticatedPage.fill('input[placeholder*="Enter folder name"]', 'Work Projects');
    await authenticatedPage.click('button:has-text("Add")');
    
    await expect(authenticatedPage.locator('text=Work Projects')).toBeVisible();
    
    // Create note in folder
    await authenticatedPage.click('text=Work Projects', { button: 'right' });
    await authenticatedPage.click('text=Add Note Here');
    
    await authenticatedPage.fill('input[placeholder*="Enter note name"]', 'Project Plan');
    await authenticatedPage.click('button:has-text("Add")');
    
    await expect(authenticatedPage.locator('text=Project Plan')).toBeVisible();
    await expect(authenticatedPage.locator('text=(Note)')).toBeVisible();
    
    // Create task in folder
    await authenticatedPage.click('text=Work Projects', { button: 'right' });
    await authenticatedPage.click('text=Add Task Here');
    
    await authenticatedPage.fill('input[placeholder*="Enter task name"]', 'Review Design');
    await authenticatedPage.click('button:has-text("Add")');
    
    await expect(authenticatedPage.locator('text=Review Design')).toBeVisible();
    await expect(authenticatedPage.locator('text=(Task)')).toBeVisible();
  });

  test('should validate item names', async ({ authenticatedPage }) => {
    await authenticatedPage.click('nav[aria-label="Notes and Tasks Tree"]', { button: 'right' });
    await authenticatedPage.click('text=Add Root Folder');
    
    // Try to create with empty name
    await authenticatedPage.click('button:has-text("Add")');
    
    await expect(authenticatedPage.locator('text=Name cannot be empty')).toBeVisible();
    
    // Create folder with valid name
    await authenticatedPage.fill('input[placeholder*="Enter folder name"]', 'Test Folder');
    await authenticatedPage.click('button:has-text("Add")');
    
    // Try to create duplicate
    await authenticatedPage.click('nav[aria-label="Notes and Tasks Tree"]', { button: 'right' });
    await authenticatedPage.click('text=Add Root Folder');
    await authenticatedPage.fill('input[placeholder*="Enter folder name"]', 'Test Folder');
    await authenticatedPage.click('button:has-text("Add")');
    
    await expect(authenticatedPage.locator('text=already exists')).toBeVisible();
  });

  test('should cancel item creation', async ({ authenticatedPage }) => {
    await authenticatedPage.click('nav[aria-label="Notes and Tasks Tree"]', { button: 'right' });
    await authenticatedPage.click('text=Add Root Folder');
    
    await authenticatedPage.fill('input[placeholder*="Enter folder name"]', 'Cancelled Folder');
    await authenticatedPage.click('button:has-text("Cancel")');
    
    await expect(authenticatedPage.locator('text=Cancelled Folder')).not.toBeVisible();
  });

  test('should auto-expand parent folders', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createFolder('Parent Folder');
    
    // Collapse the folder first
    const folderItem = authenticatedPage.locator('li').filter({ hasText: 'Parent Folder' });
    const expandButton = folderItem.locator('button[aria-expanded]');
    await expandButton.click();
    
    // Create child item
    await authenticatedPage.click('text=Parent Folder', { button: 'right' });
    await authenticatedPage.click('text=Add Note Here');
    await authenticatedPage.fill('input[placeholder*="Enter note name"]', 'Child Note');
    await authenticatedPage.click('button:has-text("Add")');
    
    // Parent should auto-expand (if auto-expand setting is enabled)
    await expect(expandButton).toHaveAttribute('aria-expanded', 'true');
    await expect(authenticatedPage.locator('text=Child Note')).toBeVisible();
  });
});
