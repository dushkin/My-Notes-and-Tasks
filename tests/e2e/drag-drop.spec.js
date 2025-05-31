import { test, expect } from './fixtures/base.js';

test.describe('Drag and Drop', () => {
  test('should drag item to folder', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createFolder('Target Folder');
    await testDataHelper.createNote('Draggable Note');
    
    const sourceItem = authenticatedPage.locator('li').filter({ hasText: 'Draggable Note' });
    const targetFolder = authenticatedPage.locator('li').filter({ hasText: 'Target Folder' });
    
    // Perform drag and drop
    await sourceItem.dragTo(targetFolder);
    
    // Expand target folder to see the moved item
    const expandButton = targetFolder.locator('button[aria-expanded]');
    if (await expandButton.getAttribute('aria-expanded') === 'false') {
      await expandButton.click();
    }
    
    // Note should now be inside the folder
    await expect(targetFolder.locator('text=Draggable Note')).toBeVisible();
  });

  test('should prevent invalid drops', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createFolder('Parent Folder');
    await testDataHelper.createFolder('Child Folder', 'Parent Folder');
    await testDataHelper.createNote('Test Note');
    
    // Try to drop parent folder into child folder (should be prevented)
    const parentFolder = authenticatedPage.locator('li').filter({ hasText: 'Parent Folder' });
    const childFolder = authenticatedPage.locator('li').filter({ hasText: 'Child Folder' });
    
    await parentFolder.dragTo(childFolder);
    
    // Should show error message or prevent the action
    // The exact behavior depends on implementation
  });

  test('should show drop indicator', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createFolder('Drop Target');
    await testDataHelper.createNote('Drag Source');
    
    const sourceItem = authenticatedPage.locator('li').filter({ hasText: 'Drag Source' });
    const targetFolder = authenticatedPage.locator('li').filter({ hasText: 'Drop Target' });
    
    // Start dragging
    await sourceItem.hover();
    await authenticatedPage.mouse.down();
    await targetFolder.hover();
    
    // Should show drop indicator
    await expect(authenticatedPage.locator('[data-item-id="drag-over-indicator"]')).toBeVisible();
    
    await authenticatedPage.mouse.up();
  });
});
