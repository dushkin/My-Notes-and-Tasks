import { test, expect } from './fixtures/base.js';

test.describe('Item Editing', () => {
  test('should edit note content', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createNote('Test Note');
    
    await authenticatedPage.click('text=Test Note');
    
    // Wait for editor to load
    await expect(authenticatedPage.locator('.ProseMirror')).toBeVisible();
    
    // Type content
    await authenticatedPage.fill('.ProseMirror', 'This is my note content');
    
    // Switch to another item and back to verify content is saved
    await testDataHelper.createNote('Another Note');
    await authenticatedPage.click('text=Another Note');
    await authenticatedPage.click('text=Test Note');
    
    await expect(authenticatedPage.locator('.ProseMirror')).toContainText('This is my note content');
  });

  test('should use editor toolbar functions', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createNote('Rich Text Note');
    await authenticatedPage.click('text=Rich Text Note');
    
    // Type some text
    await authenticatedPage.fill('.ProseMirror', 'Bold text here');
    
    // Select text and make it bold
    await authenticatedPage.locator('.ProseMirror').click();
    await authenticatedPage.keyboard.press('Control+a');
    await authenticatedPage.click('button[title="Bold"]');
    
    // Check that text is bold
    await expect(authenticatedPage.locator('.ProseMirror strong')).toContainText('Bold text here');
    
    // Test other formatting
    await authenticatedPage.keyboard.press('Control+a');
    await authenticatedPage.click('button[title="Italic"]');
    await expect(authenticatedPage.locator('.ProseMirror em')).toBeVisible();
  });

  test('should toggle task completion', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createTask('Complete Project');
    
    const taskItem = authenticatedPage.locator('li').filter({ hasText: 'Complete Project' });
    const checkbox = taskItem.locator('button[role="checkbox"]');
    
    // Task should be incomplete initially
    await expect(checkbox).toHaveAttribute('aria-checked', 'false');
    await expect(taskItem.locator('text=⬜️')).toBeVisible();
    
    // Complete the task
    await checkbox.click();
    
    await expect(checkbox).toHaveAttribute('aria-checked', 'true');
    await expect(taskItem.locator('text=✅')).toBeVisible();
    await expect(taskItem.locator('.line-through')).toBeVisible();
    
    // Uncomplete the task
    await checkbox.click();
    
    await expect(checkbox).toHaveAttribute('aria-checked', 'false');
    await expect(taskItem.locator('text=⬜️')).toBeVisible();
  });

  test('should rename items inline', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createFolder('Old Name');
    
    // Start rename with F2
    await authenticatedPage.click('text=Old Name');
    await authenticatedPage.keyboard.press('F2');
    
    // Should show rename input
    const renameInput = authenticatedPage.locator('input[value="Old Name"]');
    await expect(renameInput).toBeVisible();
    
    // Change name
    await renameInput.fill('New Name');
    await authenticatedPage.keyboard.press('Enter');
    
    // Should show new name
    await expect(authenticatedPage.locator('text=New Name')).toBeVisible();
    await expect(authenticatedPage.locator('text=Old Name')).not.toBeVisible();
  });

  test('should cancel rename with Escape', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createNote('Original Name');
    
    await authenticatedPage.click('text=Original Name');
    await authenticatedPage.keyboard.press('F2');
    
    const renameInput = authenticatedPage.locator('input[value="Original Name"]');
    await renameInput.fill('Changed Name');
    await authenticatedPage.keyboard.press('Escape');
    
    // Should keep original name
    await expect(authenticatedPage.locator('text=Original Name')).toBeVisible();
    await expect(authenticatedPage.locator('text=Changed Name')).not.toBeVisible();
  });

  test('should validate rename input', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createFolder('Test Folder');
    await testDataHelper.createNote('Duplicate Name');
    
    // Try to rename to existing name
    await authenticatedPage.click('text=Test Folder');
    await authenticatedPage.keyboard.press('F2');
    
    const renameInput = authenticatedPage.locator('input[value="Test Folder"]');
    await renameInput.fill('Duplicate Name');
    await authenticatedPage.keyboard.press('Enter');
    
    await expect(authenticatedPage.locator('text=already exists')).toBeVisible();
    
    // Try empty name
    await renameInput.fill('');
    await authenticatedPage.keyboard.press('Enter');
    
    await expect(authenticatedPage.locator('text=cannot be empty')).toBeVisible();
  });
});
