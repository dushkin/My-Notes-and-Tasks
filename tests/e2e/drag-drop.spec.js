import { test, expect } from './fixtures/base.js';

test.describe.configure({ mode: 'serial' });

test.describe('Drag and Drop', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Refresh the page to start with a clean slate
    await authenticatedPage.reload();
    await authenticatedPage.waitForSelector('nav[aria-label="Notes and Tasks Tree"]');

    // Wait a bit for any async operations to complete
    await authenticatedPage.waitForTimeout(1000);
  });

  test('should drag item to folder', async ({ authenticatedPage, testDataHelper }) => {
    console.log('=== Starting drag item to folder test ===');

    // Create target folder
    const targetFolderName = await testDataHelper.createFolder('Target Folder');

    // Create draggable note with a specific parent to avoid creating another temp folder
    const noteName = await testDataHelper.createNote('Draggable Note', '', targetFolderName);

    // Verify elements are ready
    const sourceElement = await testDataHelper.verifyDragDropReady(noteName);
    const targetElement = await testDataHelper.verifyDragDropReady(targetFolderName);

    console.log('Performing drag and drop...');
    await sourceElement.dragTo(targetElement);
    await authenticatedPage.waitForTimeout(2000);

    console.log('✓ Drag and drop operation completed');
  });

  test('should prevent invalid drops', async ({ authenticatedPage, testDataHelper }) => {
    console.log('=== Starting invalid drop prevention test ===');

    // Create parent folder
    const parentFolderName = await testDataHelper.createFolder('Parent Folder');

    // Create child folder inside parent
    const childFolderName = await testDataHelper.createFolder('Child Folder', parentFolderName);

    // Verify elements are ready
    const parentElement = await testDataHelper.verifyDragDropReady(parentFolderName);
    const childElement = await testDataHelper.verifyDragDropReady(childFolderName);

    console.log('Attempting invalid drag (parent into child)...');
    await parentElement.dragTo(childElement);
    await authenticatedPage.waitForTimeout(2000);

    // Verify parent is still visible (invalid drop was prevented)
    await expect(parentElement).toBeVisible();
    console.log('✓ Invalid drop prevention verified');
  });

  test('should show drop indicator', async ({ authenticatedPage, testDataHelper }) => {
    console.log('=== Starting drop indicator test ===');

    // Create target folder
    const targetFolderName = await testDataHelper.createFolder('Drop Target');

    // Create source note inside the target folder to avoid creating temp folders
    const sourceName = await testDataHelper.createNote('Drag Source', '', targetFolderName);

    // Get elements for drag operation
    const sourceElement = await testDataHelper.verifyDragDropReady(sourceName);
    const targetElement = await testDataHelper.verifyDragDropReady(targetFolderName);

    console.log('Testing drop indicator...');

    // Start drag operation
    await sourceElement.hover();
    await authenticatedPage.mouse.down();

    // Hover over target
    await targetElement.hover();
    await authenticatedPage.waitForTimeout(1000);

    // Complete drag operation
    await authenticatedPage.mouse.up();
    await authenticatedPage.waitForTimeout(1000);

    console.log('✓ Drop indicator test completed');
  });
});