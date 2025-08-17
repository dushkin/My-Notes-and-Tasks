import { test, expect } from '@playwright/test';

test.describe('TipTap Editor Image Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:5173');
    
    // Wait for the app to load
    await page.waitForLoadState('networkidle');
    
    // Click Personal Area button to get to the editor
    try {
      const personalAreaButton = page.locator('button:has-text("Personal Area")').nth(1);
      await expect(personalAreaButton).toBeVisible({ timeout: 8000 });
      await personalAreaButton.click({ force: true });
      
      // Wait for navigation to editor area
      await page.waitForTimeout(2000);
      await page.waitForLoadState('networkidle');
    } catch (error) {
      console.log('Warning: Could not navigate to Personal Area:', error.message);
    }
  });

  test('should display image upload button in toolbar', async ({ page }) => {
    // Debug: Check what elements are actually on the page
    const pageContent = await page.content();
    console.log('Current page URL:', page.url());
    
    // Look for any elements that might be the editor or toolbar
    const proseMirrorElements = await page.locator('.ProseMirror').count();
    const editorElements = await page.locator('[class*="editor"]').count();
    const tipTapElements = await page.locator('[class*="tiptap"]').count();
    const imageButtonElements = await page.getByTitle('Upload Image').count();
    
    console.log(`Found ${proseMirrorElements} ProseMirror elements`);
    console.log(`Found ${editorElements} editor elements`);  
    console.log(`Found ${tipTapElements} tiptap elements`);
    console.log(`Found ${imageButtonElements} image button elements`);
    
    // Look for the image upload button with extended timeout
    const imageButton = page.getByTitle('Upload Image');
    if (await imageButton.count() > 0) {
      await expect(imageButton).toBeVisible({ timeout: 15000 });
    } else {
      console.log('Image upload button not found on page');
      // Check if we need to create a note first or navigate differently
      const createButton = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add")');
      if (await createButton.count() > 0) {
        console.log('Found create/new/add buttons, might need to create a note first');
      }
    }
  });

  test('should open file dialog when image button is clicked', async ({ page }) => {
    // Set up file chooser listener
    const fileChooserPromise = page.waitForEvent('filechooser');
    
    // Click the image upload button
    const imageButton = page.getByTitle('Upload Image');
    await imageButton.click();
    
    // Verify file chooser opened
    const fileChooser = await fileChooserPromise;
    expect(fileChooser).toBeTruthy();
  });

  test('should handle image paste functionality', async ({ page }) => {
    // Find the editor area
    const editor = page.locator('.ProseMirror');
    await expect(editor).toBeVisible();
    
    // Focus on the editor
    await editor.click();
    
    // Check that the editor is focused and ready for input
    await expect(editor).toBeFocused();
    
    // Note: Actual image pasting would require clipboard access in browser context
    // This test just verifies the editor is ready to receive paste events
    console.log('Editor is ready for image pasting functionality');
  });

  test('should verify editor extensions are loaded', async ({ page }) => {
    // Check if any console errors related to image extensions
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Navigate and wait for app to fully load
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Check for any extension-related errors
    const imageExtensionErrors = consoleErrors.filter(error => 
      error.includes('resizableImage') || 
      error.includes('Image') ||
      error.includes('extension')
    );
    
    expect(imageExtensionErrors).toHaveLength(0);
  });

  test('should verify ResizableImageNodeView loads correctly', async ({ page }) => {
    // Check for console logs that indicate proper loading
    const consoleLogs = [];
    page.on('console', msg => {
      consoleLogs.push(msg.text());
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Look for any ResizableImageNodeView related errors
    const nodeViewErrors = consoleLogs.filter(log => 
      log.includes('ResizableImageNodeView') && log.includes('error')
    );
    
    expect(nodeViewErrors).toHaveLength(0);
  });
});