import { test, expect } from './fixtures/base.js';

test.describe('Context Menu', () => {
  test('should show context menu on right click', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createFolder('Test Folder');
    
    await authenticatedPage.click('text=Test Folder', { button: 'right' });
    
    // Should show context menu with appropriate options
    await expect(authenticatedPage.locator('text=Add Folder Here')).toBeVisible();
    await expect(authenticatedPage.locator('text=Add Note Here')).toBeVisible();
    await expect(authenticatedPage.locator('text=Add Task Here')).toBeVisible();
    await expect(authenticatedPage.locator('text=Rename')).toBeVisible();
    await expect(authenticatedPage.locator('text=Delete')).toBeVisible();
    await expect(authenticatedPage.locator('text=Copy')).toBeVisible();
    await expect(authenticatedPage.locator('text=Cut')).toBeVisible();
  });

  test('should show empty area context menu', async ({ authenticatedPage }) => {
    await authenticatedPage.click('nav[aria-label="Notes and Tasks Tree"]', { button: 'right' });
    
    await expect(authenticatedPage.locator('text=Add Root Folder')).toBeVisible();
    await expect(authenticatedPage.locator('text=Export Full Tree')).toBeVisible();
    await expect(authenticatedPage.locator('text=Import Full Tree')).toBeVisible();
  });

  test('should close context menu on outside click', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createNote('Test Note');
    
    await authenticatedPage.click('text=Test Note', { button: 'right' });
    await expect(authenticatedPage.locator('text=Rename')).toBeVisible();
    
    // Click outside
    await authenticatedPage.click('body', { position: { x: 100, y: 100 } });
    
    await expect(authenticatedPage.locator('text=Rename')).not.toBeVisible();
  });

  test('should handle copy/cut/paste operations', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createFolder('Source Folder');
    await testDataHelper.createNote('Copy Me', '', 'Source Folder');
    await testDataHelper.createFolder('Target Folder');
    
    // Copy item
    await authenticatedPage.click('text=Copy Me', { button: 'right' });
    await authenticatedPage.click('text=Copy');
    
    // Paste in target folder
    await authenticatedPage.click('text=Target Folder', { button: 'right' });
    await expect(authenticatedPage.locator('text=Paste Here')).toBeVisible();
    await authenticatedPage.click('text=Paste Here');
    
    // Should have copy in target folder
    await authenticatedPage.click('text=Target Folder');
    const expandButton = authenticatedPage.locator('li').filter({ hasText: 'Target Folder' }).locator('button[aria-expanded]');
    if (await expandButton.getAttribute('aria-expanded') === 'false') {
      await expandButton.click();
    }
    
    await expect(authenticatedPage.locator('text=Copy Me (copy)')).toBeVisible();
  });

  test('should delete items with confirmation', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createNote('Delete Me');
    
    await authenticatedPage.click('text=Delete Me', { button: 'right' });
    await authenticatedPage.click('text=Delete');
    
    // Should show confirmation dialog
    authenticatedPage.on('dialog', dialog => {
      expect(dialog.message()).toContain('Delete "Delete Me"');
      dialog.accept();
    });
    
    // Item should be removed
    await expect(authenticatedPage.locator('text=Delete Me')).not.toBeVisible();
  });
});
