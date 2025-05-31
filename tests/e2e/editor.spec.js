import { test, expect } from './fixtures/base.js';

test.describe('Rich Text Editor', () => {
  test('should handle basic text formatting', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createNote('Format Test');
    await authenticatedPage.click('text=Format Test');
    
    const editor = authenticatedPage.locator('.ProseMirror');
    
    // Type and format text
    await editor.fill('Bold and italic text');
    await editor.selectText();
    
    // Make bold
    await authenticatedPage.click('button[title="Bold"]');
    await expect(editor.locator('strong')).toContainText('Bold and italic text');
    
    // Make italic
    await authenticatedPage.click('button[title="Italic"]');
    await expect(editor.locator('em')).toBeVisible();
  });

  test('should handle headings', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createNote('Heading Test');
    await authenticatedPage.click('text=Heading Test');
    
    const editor = authenticatedPage.locator('.ProseMirror');
    await editor.fill('Main Heading');
    await editor.selectText();
    
    // Apply H1
    await authenticatedPage.selectOption('select[title="Text Style"]', 'h1');
    await expect(editor.locator('h1')).toContainText('Main Heading');
  });

  test('should handle lists', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createNote('List Test');
    await authenticatedPage.click('text=List Test');
    
    const editor = authenticatedPage.locator('.ProseMirror');
    await editor.fill('First item');
    
    // Create bullet list
    await authenticatedPage.click('button[title="Bulleted List"]');
    await expect(editor.locator('ul li')).toContainText('First item');
    
    // Add second item
    await editor.press('Enter');
    await editor.type('Second item');
    
    await expect(editor.locator('ul li')).toHaveCount(2);
  });

  test('should handle links', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createNote('Link Test');
    await authenticatedPage.click('text=Link Test');
    
    const editor = authenticatedPage.locator('.ProseMirror');
    await editor.fill('Visit example.com');
    await editor.selectText({ from: 6, to: 17 }); // Select "example.com"
    
    // Set up dialog for link URL
    authenticatedPage.on('dialog', dialog => {
      expect(dialog.message()).toContain('Enter URL');
      dialog.accept('https://example.com');
    });
    
    await authenticatedPage.click('button[title="Set Link"]');
    
    await expect(editor.locator('a')).toHaveAttribute('href', 'https://example.com');
  });

  test('should handle code blocks', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createNote('Code Test');
    await authenticatedPage.click('text=Code Test');
    
    const editor = authenticatedPage.locator('.ProseMirror');
    await editor.fill('console.log("Hello");');
    await editor.selectText();
    
    // Create code block
    await authenticatedPage.click('button[title="Code Block"]');
    await expect(editor.locator('pre code')).toContainText('console.log("Hello");');
  });

  test('should handle text alignment', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createNote('Alignment Test');
    await authenticatedPage.click('text=Alignment Test');
    
    const editor = authenticatedPage.locator('.ProseMirror');
    await editor.fill('Centered text');
    await editor.selectText();
    
    // Center align
    await authenticatedPage.click('button[title="Align Center"]');
    await expect(editor.locator('[style*="text-align: center"]')).toContainText('Centered text');
  });

  test('should handle font changes', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createNote('Font Test');
    await authenticatedPage.click('text=Font Test');
    
    const editor = authenticatedPage.locator('.ProseMirror');
    await editor.fill('Different font');
    await editor.selectText();
    
    // Change font family
    await authenticatedPage.selectOption('select[title="Font Family"]', 'Georgia');
    await expect(editor.locator('[style*="font-family"]')).toBeVisible();
    
    // Change font size
    await authenticatedPage.selectOption('select[title="Font Size"]', '1.2em');
    await expect(editor.locator('[style*="font-size"]')).toBeVisible();
  });

  test('should handle image upload', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createNote('Image Test');
    await authenticatedPage.click('text=Image Test');
    
    // Create a test image file
    const testImagePath = path.join(process.cwd(), 'test-image.png');
    // Note: You would need to create a small test image file for this test
    
    // Click image upload button
    await authenticatedPage.click('button[title="Upload Image"]');
    
    // Upload file (this would trigger the file picker)
    await authenticatedPage.setInputFiles('input[type="file"]', testImagePath);
    
    // Should insert image in editor
    await expect(authenticatedPage.locator('.ProseMirror img')).toBeVisible();
  });

  test('should handle markdown conversion', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createNote('Markdown Test');
    await authenticatedPage.click('text=Markdown Test');
    
    const editor = authenticatedPage.locator('.ProseMirror');
    
    // Type markdown and convert
    await editor.fill('**Bold text**');
    await editor.selectText();
    await authenticatedPage.click('button:has-text("MD")');
    
    // Should convert to HTML
    await expect(editor.locator('strong')).toContainText('Bold text');
  });

  test('should handle text direction toggle', async ({ authenticatedPage, testDataHelper }) => {
    await testDataHelper.createNote('Direction Test');
    await authenticatedPage.click('text=Direction Test');
    
    const editor = authenticatedPage.locator('.ProseMirror');
    await editor.fill('Text direction test');
    
    // Toggle text direction
    await authenticatedPage.click('button[title*="Text Direction"]');
    
    await expect(editor).toHaveAttribute('dir', 'rtl');
    
    // Toggle back
    await authenticatedPage.click('button[title*="Text Direction"]');
    await expect(editor).toHaveAttribute('dir', 'ltr');
  });
});
