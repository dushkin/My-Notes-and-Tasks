import { test, expect } from './fixtures/base.js';

test.describe('Tree Navigation', () => {
  test('should display empty tree initially', async ({ authenticatedPage }) => {
    const treeNav = authenticatedPage.locator('nav[aria-label="Notes and Tasks Tree"]');
    await expect(treeNav).toBeVisible();
    
    // Should show empty tree or placeholder
    const treeContent = await treeNav.textContent();
    expect(treeContent.trim()).toBeFalsy();
  });

  test('should create root folder via context menu', async ({ authenticatedPage }) => {
    await authenticatedPage.click('nav[aria-label="Notes and Tasks Tree"]', { button: 'right' });
    await authenticatedPage.click('text=Add Root Folder');
    
    await authenticatedPage.fill('input[placeholder*="Enter folder name"]', 'My First Folder');
    await authenticatedPage.click('button:has-text("Add")');
    
    await expect(authenticatedPage.locator('text=My First Folder')).toBeVisible();
    await expect(authenticatedPage.locator('text=(Folder)')).toBeVisible();
  });

  test('should expand and collapse folders', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createFolder('Test Folder');
    await testDataHelper.createNote('Test Note', '', 'Test Folder');
    
    const folderItem = authenticatedPage.locator('li').filter({ hasText: 'Test Folder' });
    const expandButton = folderItem.locator('button[aria-expanded]');
    
    // Should be expanded by default (auto-expand setting)
    await expect(expandButton).toHaveAttribute('aria-expanded', 'true');
    await expect(authenticatedPage.locator('text=Test Note')).toBeVisible();
    
    // Collapse folder
    await expandButton.click();
    await expect(expandButton).toHaveAttribute('aria-expanded', 'false');
    await expect(authenticatedPage.locator('text=Test Note')).not.toBeVisible();
    
    // Expand folder again
    await expandButton.click();
    await expect(expandButton).toHaveAttribute('aria-expanded', 'true');
    await expect(authenticatedPage.locator('text=Test Note')).toBeVisible();
  });

  test('should select items and show content', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createFolder('Documents');
    await testDataHelper.createNote('Meeting Notes', 'Important meeting content');
    
    // Click on folder
    await authenticatedPage.click('text=Documents');
    await expect(authenticatedPage.locator('h2')).toContainText('Documents');
    await expect(authenticatedPage.locator('text=This folder is empty')).toBeVisible();
    
    // Click on note
    await authenticatedPage.click('text=Meeting Notes');
    await expect(authenticatedPage.locator('h2')).toContainText('Meeting Notes');
    await expect(authenticatedPage.locator('.ProseMirror')).toBeVisible();
  });

  test('should handle keyboard navigation', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createFolder('Folder 1');
    await testDataHelper.createNote('Note 1');
    await testDataHelper.createTask('Task 1');
    
    const treeNav = authenticatedPage.locator('nav[aria-label="Notes and Tasks Tree"]');
    await treeNav.focus();
    
    // Navigate with arrow keys
    await authenticatedPage.keyboard.press('ArrowDown');
    await authenticatedPage.keyboard.press('ArrowDown');
    
    // Press Enter to select
    await authenticatedPage.keyboard.press('Enter');
    
    // Should select the item (exact behavior depends on implementation)
    await expect(authenticatedPage.locator('.bg-blue-600')).toBeVisible();
  });
});
