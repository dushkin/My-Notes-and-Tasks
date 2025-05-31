import { test, expect } from './fixtures/base.js';
import fs from 'fs';
import path from 'path';

test.describe('Export/Import Functionality', () => {
  test('should export tree to JSON', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createFolder('Export Test');
    await testDataHelper.createNote('Test Note', 'Export content', 'Export Test');
    
    // Start export
    await authenticatedPage.click('[title="More actions"]');
    await authenticatedPage.click('text=Export Full Tree...');
    
    // Should show export dialog
    await expect(authenticatedPage.locator('h2')).toContainText('Export Full Tree');
    await expect(authenticatedPage.locator('input[value="json"][checked]')).toBeVisible();
    
    // Set up download listener
    const downloadPromise = authenticatedPage.waitForEvent('download');
    await authenticatedPage.click('button:has-text("Export as JSON")');
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/);
    
    // Verify download content
    const downloadPath = await download.path();
    const content = fs.readFileSync(downloadPath, 'utf8');
    const exportedData = JSON.parse(content);
    
    expect(exportedData).toBeInstanceOf(Array);
    expect(exportedData[0].label).toBe('Export Test');
  });

  test('should export selected item', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createFolder('Selected Folder');
    await testDataHelper.createNote('Child Note', '', 'Selected Folder');
    
    // Select folder and export
    await authenticatedPage.click('text=Selected Folder');
    await authenticatedPage.click('text=Selected Folder', { button: 'right' });
    await authenticatedPage.click('text=Export Item...');
    
    await expect(authenticatedPage.locator('h2')).toContainText('Export Selected Item');
    
    const downloadPromise = authenticatedPage.waitForEvent('download');
    await authenticatedPage.click('button:has-text("Export as JSON")');
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('Selected Folder');
  });

  test('should import JSON file', async ({ authenticatedPage }) => {
    // Create test data file
    const testData = [
      {
        id: 'test-1',
        label: 'Imported Folder',
        type: 'folder',
        children: [
          {
            id: 'test-2',
            label: 'Imported Note',
            type: 'note',
            content: 'Imported content'
          }
        ]
      }
    ];
    
    const testFilePath = path.join(process.cwd(), 'test-import.json');
    fs.writeFileSync(testFilePath, JSON.stringify(testData, null, 2));
    
    try {
      // Start import
      await authenticatedPage.click('[title="More actions"]');
      await authenticatedPage.click('text=Import Full Tree...');
      
      // Upload file
      await authenticatedPage.setInputFiles('input[type="file"]', testFilePath);
      await authenticatedPage.click('button:has-text("Import")');
      
      // Should show success message and imported content
      await expect(authenticatedPage.locator('text=Import successful')).toBeVisible();
      await expect(authenticatedPage.locator('text=Imported Folder')).toBeVisible();
    } finally {
      // Clean up test file
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  });

  test('should validate import file type', async ({ authenticatedPage }) => {
    await authenticatedPage.click('[title="More actions"]');
    await authenticatedPage.click('text=Import Full Tree...');
    
    // Try to upload non-JSON file
    const testFilePath = path.join(process.cwd(), 'test.txt');
    fs.writeFileSync(testFilePath, 'Not JSON content');
    
    try {
      await authenticatedPage.setInputFiles('input[type="file"]', testFilePath);
      await authenticatedPage.click('button:has-text("Import")');
      
      await expect(authenticatedPage.locator('text=JSON file')).toBeVisible();
    } finally {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  });

  test('should import under selected folder', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createFolder('Target Folder');
    
    const testData = {
      id: 'import-1',
      label: 'Imported Item',
      type: 'note',
      content: 'Test content'
    };
    
    const testFilePath = path.join(process.cwd(), 'test-import-item.json');
    fs.writeFileSync(testFilePath, JSON.stringify(testData, null, 2));
    
    try {
      // Select folder and import
      await authenticatedPage.click('text=Target Folder');
      await authenticatedPage.click('text=Target Folder', { button: 'right' });
      await authenticatedPage.click('text=Import under Item...');
      
      await expect(authenticatedPage.locator('h2')).toContainText('Import Under "Target Folder"');
      
      await authenticatedPage.setInputFiles('input[type="file"]', testFilePath);
      await authenticatedPage.click('button:has-text("Import")');
      
      // Should import under selected folder
      await expect(authenticatedPage.locator('text=Import successful')).toBeVisible();
      
      // Expand folder to see imported item
      const expandButton = authenticatedPage.locator('li').filter({ hasText: 'Target Folder' }).locator('button[aria-expanded]');
      if (await expandButton.getAttribute('aria-expanded') === 'false') {
        await expandButton.click();
      }
      
      await expect(authenticatedPage.locator('text=Imported Item')).toBeVisible();
    } finally {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  });
});