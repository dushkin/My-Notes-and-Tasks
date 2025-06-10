import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/');
    await page.fill('#email-login', 'test@e2e.com');
    await page.fill('#password-login', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForSelector('h1:has-text("Notes & Tasks")');
    await page.waitForSelector('nav[aria-label="Notes and Tasks Tree"]');
    await use(page);
  },

  testDataHelper: async ({ page }, use) => {
    let itemCounter = Date.now();
    const helper = {
      async createFolder(name, parentName) {
        const uniqueName = `${name}-${itemCounter++}`;
        if (parentName) {
          const folderLocator = page.locator(`li:has-text("${parentName}")`);
          await folderLocator.getByRole('button', { name: 'More actions' }).click();
        } else {
          await page.getByRole('button', { name: 'More actions' }).first().click();
        }
        // Wait for and click "Add Root Folder"
        await page.waitForSelector('text=Add Root Folder', { timeout: 5000 });
        await page.click('text=Add Root Folder');
        const input = page.getByPlaceholder('Enter folder name');
        await input.fill(uniqueName);
        await page.getByRole('button', { name: 'Add' }).click();
        const treeitem = page.getByRole('treeitem', { name: uniqueName });
        await treeitem.waitFor({ timeout: 10000 });
        return uniqueName;
      },

      async createNote(content, underFolderName) {
        const uniqueContent = `${content}-${itemCounter++}`;
        const folderLocator = page.locator(`li:has-text("${underFolderName}")`);
        await folderLocator.click();
        await page.getByRole('button', { name: 'New Note' }).click();
        const editor = page.locator('[contenteditable]');
        await editor.fill(uniqueContent);
        await page.getByRole('button', { name: 'Save Note' }).click();
        const treeitem = page.getByRole('treeitem', { name: uniqueContent });
        await treeitem.waitFor({ timeout: 10000 });
        return uniqueContent;
      }
    };
    await use(helper);
  }
});

export { expect };
