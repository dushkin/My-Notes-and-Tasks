import { test, expect } from './fixtures/base';

test.describe('Tree & Item Management', () => {
  test('Create root-level folder', async ({ authenticatedPage: page, testDataHelper }) => {
    const folderName = await testDataHelper.createFolder('Work');
    await expect(page.getByRole('treeitem', { name: folderName })).toBeVisible();
  });

  test('Create nested subfolder', async ({ authenticatedPage: page, testDataHelper }) => {
    const parent = await testDataHelper.createFolder('Work');
    const child = await testDataHelper.createFolder('Projects', parent);
    await expect(page.getByRole('treeitem', { name: child })).toBeVisible();
  });

  test('Prevent empty-name folder', async ({ authenticatedPage: page }) => {
    await page.locator('[title="More actions"]').click();
    await page.click('text=Add Root Folder');
    await page.getByPlaceholder('Enter folder name').fill('');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText('Name is required')).toBeVisible();
  });

  test('Duplicate-name handling (same parent)', async ({ authenticatedPage: page, testDataHelper }) => {
    const name1 = await testDataHelper.createFolder('Work');
    const name2 = await testDataHelper.createFolder('Work');
    expect(name1).not.toBe(name2);
  });

  test('Copy & paste item', async ({ authenticatedPage: page, testDataHelper }) => {
    const folder = await testDataHelper.createFolder('Work');
    await page.click(`li:has-text("${folder}") [title="More actions"]`);
    await page.click('text=Copy');
    await page.click('text=Paste');
    await expect(page.getByRole('treeitem', { name: folder })).toHaveCount(2);
  });

  test('Bulk-select & delete multiple items', async ({ authenticatedPage: page, testDataHelper }) => {
    const items = await Promise.all(['A', 'B', 'C'].map(name => testDataHelper.createFolder(name)));
    for (const name of items) {
      await page.click(`li:has-text("${name}")`, { modifiers: ['Control'] });
    }
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    for (const name of items) {
      await expect(page.getByText(name)).toHaveCount(0);
    }
  });

  test('Bulk-rename multiple items', async ({ authenticatedPage: page, testDataHelper }) => {
    const items = await Promise.all(['A', 'B'].map(name => testDataHelper.createFolder(name)));
    for (const name of items) {
      await page.click(`li:has-text("${name}")`, { modifiers: ['Control'] });
    }
    await page.getByRole('button', { name: 'Rename' }).click();
    await page.getByPlaceholder('Enter new name').fill('X');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('X')).toHaveCount(2);
  });

  test('Move item via context menu', async ({ authenticatedPage: page, testDataHelper }) => {
    const inbox = await testDataHelper.createFolder('Inbox');
    const archive = await testDataHelper.createFolder('Archive');
    const note = await testDataHelper.createNote('N', inbox);
    await page.click(`li:has-text("${note}") [title="More actions"]`);
    await page.click('text=Move to…');
    await page.click(`li:has-text("${archive}")`);
    await expect(page.getByRole('treeitem', { name: note })).toBeVisible();
  });
});
