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
    let itemCounter = Date.now(); // Use timestamp to ensure uniqueness across test runs

    const closeAnyOpenDialogs = async () => {
      try {
        const cancelButton = page.locator('button:has-text("Cancel")');
        if (await cancelButton.isVisible({ timeout: 1000 })) {
          await cancelButton.click();
          await page.waitForTimeout(500);
        }
      } catch (e) { }

      try {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } catch (e) { }

      try {
        await page.click('body', { position: { x: 50, y: 50 }, timeout: 1000 });
        await page.waitForTimeout(500);
      } catch (e) { }
    };

    const waitForItemToBeReady = async (itemName, timeout = 20000) => {
      console.log(`Waiting for item to be ready: ${itemName}`);

      // Wait for item to exist and be visible using standard JavaScript
      await page.waitForFunction(
        (name) => {
          const treeItems = document.querySelectorAll('li[data-item-id]');
          for (const item of treeItems) {
            const spans = item.querySelectorAll('span');
            for (const span of spans) {
              if (span && span.textContent && span.textContent.trim() === name) {
                return item.offsetParent !== null;
              }
            }
          }
          return false;
        },
        itemName,
        { timeout }
      );

      console.log(`✓ Item ready: ${itemName}`);
      await page.waitForTimeout(500);
    };

    const debugTreeState = async () => {
      const treeContent = await page.evaluate(() => {
        const tree = document.querySelector('nav[aria-label="Notes and Tasks Tree"]');
        return tree ? tree.textContent : 'Tree not found';
      });
      console.log('Current tree content:', treeContent);

      const items = await page.evaluate(() => {
        const items = document.querySelectorAll('li[data-item-id]');
        return Array.from(items).map(item => ({
          id: item.getAttribute('data-item-id'),
          text: item.textContent?.trim(),
          visible: item.offsetParent !== null
        }));
      });
      console.log('Tree items:', items);
    };

    // Check if item already exists
    const itemExists = async (itemName) => {
      return await page.evaluate((name) => {
        const treeItems = document.querySelectorAll('li[data-item-id]');
        for (const item of treeItems) {
          const spans = item.querySelectorAll('span');
          for (const span of spans) {
            if (span && span.textContent && span.textContent.trim() === name) {
              return true;
            }
          }
        }
        return false;
      }, itemName);
    };

    const helper = {
      async createFolder(name, parentId = null) {
        const uniqueName = `${name} ${++itemCounter}`;
        console.log(`Creating folder: ${uniqueName}, parentId: ${parentId}`);

        // Check if an item with this exact name already exists
        if (await itemExists(uniqueName)) {
          console.log(`✓ Folder already exists: ${uniqueName}`);
          return uniqueName;
        }

        try {
          await closeAnyOpenDialogs();

          if (parentId) {
            await waitForItemToBeReady(parentId);

            const parentElement = page.locator('li[data-item-id]').filter({
              has: page.locator('span', { hasText: parentId })
            }).first();

            await parentElement.click({ button: 'right' });
            await page.waitForSelector('text=➕ Add Folder Here', { state: 'visible', timeout: 10000 });
            await page.click('text=➕ Add Folder Here');
          } else {
            const treeNav = page.locator('nav[aria-label="Notes and Tasks Tree"]');
            await treeNav.click({ button: 'right' });
            await page.waitForSelector('text=➕ Add Root Folder', { state: 'visible', timeout: 10000 });
            await page.click('text=➕ Add Root Folder');
          }

          await page.waitForSelector('h2:has-text("Add folder")', { state: 'visible', timeout: 10000 });
          const input = page.locator('input[placeholder="Enter folder name"]');
          await input.waitFor({ state: 'visible' });

          await input.fill('');
          await input.fill(uniqueName);
          await page.click('button:has-text("Add")');

          // Wait for dialog to close OR for error message
          await Promise.race([
            // Dialog closes successfully
            page.waitForFunction(() => {
              const dialogs = document.querySelectorAll('h2');
              for (const dialog of dialogs) {
                if (dialog.textContent && dialog.textContent.includes('Add folder')) {
                  return !dialog.offsetParent;
                }
              }
              return true;
            }, { timeout: 10000 }),

            // Error message appears (name conflict)
            page.waitForSelector('p.text-red-600', { state: 'visible', timeout: 5000 }).then(() => {
              throw new Error(`Name conflict: ${uniqueName} already exists`);
            })
          ]);

          await waitForItemToBeReady(uniqueName);

          console.log(`✓ Folder created: ${uniqueName}`);
          return uniqueName;

        } catch (error) {
          if (error.message.includes('Name conflict')) {
            // Try with a different name
            return await this.createFolder(name, parentId);
          }

          console.error(`Failed to create folder ${uniqueName}:`, error.message);
          await debugTreeState();
          await page.screenshot({
            path: `debug-create-folder-failed-${uniqueName.replace(/\s+/g, '-')}.png`,
            fullPage: true
          });
          throw error;
        }
      },

      async createNote(name, content = '', parentId = null) {
        const uniqueName = `${name} ${++itemCounter}`;
        console.log(`Creating note: ${uniqueName}, parentId: ${parentId}`);

        // Check if note already exists
        if (await itemExists(uniqueName)) {
          console.log(`✓ Note already exists: ${uniqueName}`);
          return uniqueName;
        }

        try {
          await closeAnyOpenDialogs();

          if (parentId) {
            await waitForItemToBeReady(parentId);

            const parentElement = page.locator('li[data-item-id]').filter({
              has: page.locator('span', { hasText: parentId })
            }).first();

            await parentElement.click({ button: 'right' });
            await page.waitForSelector('text=➕ Add Note Here', { state: 'visible', timeout: 10000 });
            await page.click('text=➕ Add Note Here');
          } else {
            console.log('Creating note at root level - first creating a temp folder');
            const tempFolderName = await this.createFolder('Temp Folder');

            await closeAnyOpenDialogs();
            await waitForItemToBeReady(tempFolderName);

            const tempElement = page.locator('li[data-item-id]').filter({
              has: page.locator('span', { hasText: tempFolderName })
            }).first();

            await tempElement.click({ button: 'right' });
            await page.waitForSelector('text=➕ Add Note Here', { state: 'visible', timeout: 10000 });
            await page.click('text=➕ Add Note Here');
          }

          await page.waitForSelector('h2:has-text("Add note")', { state: 'visible', timeout: 10000 });
          const input = page.locator('input[placeholder="Enter note name"]');
          await input.waitFor({ state: 'visible' });

          await input.fill('');
          await input.fill(uniqueName);
          await page.click('button:has-text("Add")');

          // Wait for dialog to close
          await page.waitForFunction(() => {
            const dialogs = document.querySelectorAll('h2');
            for (const dialog of dialogs) {
              if (dialog.textContent && dialog.textContent.includes('Add note')) {
                return !dialog.offsetParent;
              }
            }
            return true;
          }, { timeout: 10000 });

          await waitForItemToBeReady(uniqueName);

          console.log(`✓ Note created: ${uniqueName}`);

          if (content) {
            const noteElement = page.locator('li[data-item-id]').filter({
              has: page.locator('span', { hasText: uniqueName })
            }).first();

            await noteElement.click();
            await page.waitForSelector('.ProseMirror', { state: 'visible', timeout: 10000 });
            await page.fill('.ProseMirror', content);
            await page.waitForTimeout(1000);
          }

          return uniqueName;

        } catch (error) {
          console.error(`Failed to create note ${uniqueName}:`, error.message);
          await debugTreeState();
          await page.screenshot({
            path: `debug-create-note-failed-${uniqueName.replace(/\s+/g, '-')}.png`,
            fullPage: true
          });
          throw error;
        }
      },

      async createTask(name, parentId = null) {
        const uniqueName = `${name} ${++itemCounter}`;
        console.log(`Creating task: ${uniqueName}, parentId: ${parentId}`);

        // Check if task already exists
        if (await itemExists(uniqueName)) {
          console.log(`✓ Task already exists: ${uniqueName}`);
          return uniqueName;
        }

        try {
          await closeAnyOpenDialogs();

          if (parentId) {
            await waitForItemToBeReady(parentId);

            const parentElement = page.locator('li[data-item-id]').filter({
              has: page.locator('span', { hasText: parentId })
            }).first();

            await parentElement.click({ button: 'right' });
            await page.waitForSelector('text=➕ Add Task Here', { state: 'visible', timeout: 10000 });
            await page.click('text=➕ Add Task Here');
          } else {
            console.log('Creating task at root level - first creating a temp folder');
            const tempFolderName = await this.createFolder('Temp Folder for Tasks');

            await closeAnyOpenDialogs();
            await waitForItemToBeReady(tempFolderName);

            const tempElement = page.locator('li[data-item-id]').filter({
              has: page.locator('span', { hasText: tempFolderName })
            }).first();

            await tempElement.click({ button: 'right' });
            await page.waitForSelector('text=➕ Add Task Here', { state: 'visible', timeout: 10000 });
            await page.click('text=➕ Add Task Here');
          }

          await page.waitForSelector('h2:has-text("Add task")', { state: 'visible', timeout: 10000 });
          const input = page.locator('input[placeholder="Enter task name"]');
          await input.waitFor({ state: 'visible' });

          await input.fill('');
          await input.fill(uniqueName);
          await page.click('button:has-text("Add")');

          // Wait for dialog to close
          await page.waitForFunction(() => {
            const dialogs = document.querySelectorAll('h2');
            for (const dialog of dialogs) {
              if (dialog.textContent && dialog.textContent.includes('Add task')) {
                return !dialog.offsetParent;
              }
            }
            return true;
          }, { timeout: 10000 });

          await waitForItemToBeReady(uniqueName);

          console.log(`✓ Task created: ${uniqueName}`);
          return uniqueName;

        } catch (error) {
          console.error(`Failed to create task ${uniqueName}:`, error.message);
          await debugTreeState();
          await page.screenshot({
            path: `debug-create-task-failed-${uniqueName.replace(/\s+/g, '-')}.png`,
            fullPage: true
          });
          throw error;
        }
      },

      async verifyDragDropReady(itemName) {
        await waitForItemToBeReady(itemName);

        const draggableElement = page.locator('li[data-item-id]').filter({
          has: page.locator('span', { hasText: itemName })
        }).first();

        await expect(draggableElement).toBeVisible();

        const isDraggable = await draggableElement.getAttribute('draggable');
        if (isDraggable !== 'true') {
          throw new Error(`Item ${itemName} is not draggable`);
        }

        return draggableElement;
      },

      async debugTree() {
        await debugTreeState();
      }
    };

    await use(helper);
  }
});

export { expect };