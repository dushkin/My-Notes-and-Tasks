const { test } = require('./fixtures');
const { expect } = require('@playwright/test');
const { generateName } = require('./utils/helpers');

// This spec exercises tree editing operations using the page
// object model (POM).  It relies on the `tree` fixture defined in
// tests/fixtures.js which instantiates a TreePage and navigates
// to the application before each test.

test.describe('Tree editing operations', () => {
  test('can create a new top‑level item', async ({ tree, page }) => {
    const initialCount = await page.getByRole('treeitem').count().catch(() => 0);
    const newName = generateName('Create');
    await tree.addNode(newName);
    const finalCount = await page.getByRole('treeitem').count();
    expect(finalCount).toBeGreaterThan(initialCount);
    await expect(page.getByRole('treeitem', { name: newName })).toBeVisible();
  });

  test('can delete an item', async ({ tree, page }) => {
    // Create a node to delete and ensure the count increases.
    const newName = generateName('Delete');
    await tree.addNode(newName);
    const countBefore = await page.getByRole('treeitem').count();
    // Delete via the TreePage API which handles keyboard and button fallbacks.
    await tree.deleteNode(newName);
    const countAfter = await page.getByRole('treeitem').count();
    expect(countAfter).toBeLessThan(countBefore);
    await expect(page.getByRole('treeitem', { name: newName })).not.toBeVisible();
  });

  test('can copy and paste an item', async ({ tree, page }) => {
    const name = generateName('Copy');
    await tree.addNode(name);
    const initialCount = await page.getByRole('treeitem').count();
    const countAfter = await tree.copyNode(name);
    expect(countAfter).toBe(initialCount + 1);
    await expect(page.getByRole('treeitem', { name })).toHaveCount(2);
  });

  test('can cut and paste an item', async ({ tree, page }) => {
    const name = generateName('Cut');
    await tree.addNode(name);
    const initialCount = await page.getByRole('treeitem').count();
    const countAfter = await tree.cutNode(name);
    // Cutting and pasting should not change the total count.
    expect(countAfter).toBe(initialCount);
    await expect(page.getByRole('treeitem', { name })).toBeVisible();
  });

  test('can undo and redo edits', async ({ tree, page }) => {
    const name = generateName('UndoRedo');
    await tree.addNode(name);
    const countAfterCreate = await page.getByRole('treeitem').count();
    await tree.undo();
    const countAfterUndo = await page.getByRole('treeitem').count();
    expect(countAfterUndo).toBeLessThan(countAfterCreate);
    await expect(page.getByRole('treeitem', { name })).not.toBeVisible();
    await tree.redo();
    const countAfterRedo = await page.getByRole('treeitem').count();
    expect(countAfterRedo).toBe(countAfterCreate);
    await expect(page.getByRole('treeitem', { name })).toBeVisible();
  });

  test('can expand and collapse branches', async ({ tree, page }) => {
    const parentName = generateName('Parent');
    const childName = generateName('Child');
    // Add parent and select it.
    await tree.addNode(parentName);
    const parent = page.getByRole('treeitem', { name: parentName });
    await parent.click();
    // Add child while parent is selected.
    await tree.addNode(childName);
    const child = page.getByRole('treeitem', { name: childName });
    await expect(child).toBeVisible();
    // Collapse and expand using the TreePage API; this method will
    // attempt to locate disclosure controls or fall back to a double click.
    await tree.toggleNode(parentName, 'collapse');
    await expect(child).toBeHidden();
    await tree.toggleNode(parentName, 'expand');
    await expect(child).toBeVisible();
  });

  test('can export and import the tree', async ({ tree, page }) => {
    const name = generateName('Export');
    await tree.addNode(name);
    const countBeforeExport = await page.getByRole('treeitem').count();
    // Export returns the file path.
    const filePath = await tree.exportTree();
    expect(filePath).toBeTruthy();
    const fs = require('fs');
    const stats = fs.statSync(filePath);
    expect(stats.size).toBeGreaterThan(0);
    // Import the file.  Import returns the number of items after import.
    const countAfterImport = await tree.importTree(filePath);
    expect(countAfterImport).toBeGreaterThanOrEqual(countBeforeExport);
  });
});