import { test as base, expect } from '@playwright/test';

// Extend base test with common utilities
export const test = base.extend({
  // Auto-login fixture for authenticated tests
  authenticatedPage: async ({ page }, use) => {
    // Navigate to login page
    await page.goto('/');
    
    // Perform login
    await page.fill('#email-login', 'test@example.com');
    await page.fill('#password-login', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for successful login and app to load
    await page.waitForSelector('h1:has-text("Notes & Tasks")');
    await page.waitForSelector('nav[aria-label="Notes and Tasks Tree"]');
    
    await use(page);
  },

  // Helper for creating test data
  testDataHelper: async ({ page }, use) => {
    const helper = {
      async createFolder(name, parentId = null) {
        // Right-click in tree area or on parent
        if (parentId) {
          await page.click(`li[data-item-id="${parentId}"]`, { button: 'right' });
          await page.click('text=Add Folder Here');
        } else {
          await page.click('nav[aria-label="Notes and Tasks Tree"]', { button: 'right' });
          await page.click('text=Add Root Folder');
        }
        
        await page.fill('input[placeholder*="Enter folder name"]', name);
        await page.click('button:has-text("Add")');
        await page.waitForSelector(`text=${name}`);
      },

      async createNote(name, content = '', parentId = null) {
        if (parentId) {
          await page.click(`li[data-item-id="${parentId}"]`, { button: 'right' });
          await page.click('text=Add Note Here');
        } else {
          await page.click('nav[aria-label="Notes and Tasks Tree"]', { button: 'right' });
          await page.click('text=Add Note');
        }
        
        await page.fill('input[placeholder*="Enter note name"]', name);
        await page.click('button:has-text("Add")');
        await page.waitForSelector(`text=${name}`);
        
        if (content) {
          await page.click(`text=${name}`);
          await page.fill('.ProseMirror', content);
        }
      },

      async createTask(name, parentId = null) {
        if (parentId) {
          await page.click(`li[data-item-id="${parentId}"]`, { button: 'right' });
          await page.click('text=Add Task Here');
        } else {
          await page.click('nav[aria-label="Notes and Tasks Tree"]', { button: 'right' });
          await page.click('text=Add Task');
        }
        
        await page.fill('input[placeholder*="Enter task name"]', name);
        await page.click('button:has-text("Add")');
        await page.waitForSelector(`text=${name}`);
      }
    };
    
    await use(helper);
  }
});

export { expect };
