import { test, expect } from './fixtures/base.js';

test.describe('Keyboard Shortcuts', () => {
  test('should handle undo/redo shortcuts', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createNote('Test Note');
    
    // Delete the note
    await authenticatedPage.click('text=Test Note');
    await authenticatedPage.keyboard.press('Delete');
    
    // Confirm deletion
    authenticatedPage.on('dialog', dialog => dialog.accept());
    
    await expect(authenticatedPage.locator('text=Test Note')).not.toBeVisible();
    
    // Undo deletion
    await authenticatedPage.keyboard.press('Control+z');
    
    await expect(authenticatedPage.locator('text=Test Note')).toBeVisible();
    
    // Redo deletion
    await authenticatedPage.keyboard.press('Control+y');
    
    await expect(authenticatedPage.locator('text=Test Note')).not.toBeVisible();
  });

  test('should handle copy/cut/paste shortcuts', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createFolder('Source');
    await testDataHelper.createNote('Copy Me', '', 'Source');
    await testDataHelper.createFolder('Target');
    
    // Select and copy
    await authenticatedPage.click('text=Copy Me');
    await authenticatedPage.keyboard.press('Control+c');
    
    // Select target and paste
    await authenticatedPage.click('text=Target');
    await authenticatedPage.keyboard.press('Control+v');
    
    // Should paste into target folder
    const expandButton = authenticatedPage.locator('li').filter({ hasText: 'Target' }).locator('button[aria-expanded]');
    if (await expandButton.getAttribute('aria-expanded') === 'false') {
      await expandButton.click();
    }
    
    await expect(authenticatedPage.locator('text=Copy Me (copy)')).toBeVisible();
  });

  test('should handle F2 rename shortcut', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createFolder('Rename Me');
    
    await authenticatedPage.click('text=Rename Me');
    await authenticatedPage.keyboard.press('F2');
    
    const renameInput = authenticatedPage.locator('input[value="Rename Me"]');
    await expect(renameInput).toBeVisible();
    await expect(renameInput).toBeFocused();
  });

  test('should handle delete shortcut', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createTask('Delete Me');
    
    await authenticatedPage.click('text=Delete Me');
    
    // Set up dialog handler
    authenticatedPage.on('dialog', dialog => {
      expect(dialog.message()).toContain('Delete "Delete Me"');
      dialog.accept();
    });
    
    await authenticatedPage.keyboard.press('Delete');
    
    await expect(authenticatedPage.locator('text=Delete Me')).not.toBeVisible();
  });

  test('should handle search shortcut', async ({ authenticatedPage }) => {
    await authenticatedPage.keyboard.press('Control+Shift+f');
    
    await expect(authenticatedPage.locator('#global-search-input')).toBeVisible();
    await expect(authenticatedPage.locator('#global-search-input')).toBeFocused();
  });

  test('should handle space bar for task completion', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createTask('Toggle Me');
    
    // Focus tree navigation
    await authenticatedPage.click('nav[aria-label="Notes and Tasks Tree"]');
    
    // Navigate to task and toggle with space
    await authenticatedPage.keyboard.press('ArrowDown'); // Assuming task is first/selected
    await authenticatedPage.keyboard.press(' ');
    
    // Task should be completed
    const taskItem = authenticatedPage.locator('li').filter({ hasText: 'Toggle Me' });
    await expect(taskItem.locator('text=✅')).toBeVisible();
  });
});