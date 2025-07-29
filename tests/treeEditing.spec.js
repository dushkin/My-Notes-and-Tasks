const { test } = require('./fixtures');
const { expect } = require('@playwright/test');
const { generateName } = require('./utils/helpers');

/*
 * This test suite mirrors the original tree editing behaviours but
 * leverages the page object model (POM) to abstract away low‑level
 * interactions.  Each test relies on the `tree` fixture from
 * fixtures.js, which provides a ready‑to‑use TreePage instance and
 * ensures the application is loaded before each test.  The POM
 * internally handles fallback behaviours such as using buttons when
 * keyboard shortcuts fail, meaning the tests themselves can stay
 * concise and focused on the high‑level actions and assertions.
 */

test.describe('Tree editing behaviour with POM', () => {
  test('adding a new top‑level node increases the item count and renders the new item', async ({ tree, page }) => {
    const initialCount = await page.getByRole('treeitem').count().catch(() => 0);
    const newName = generateName('Create');
    await tree.addNode(newName);
    const finalCount = await page.getByRole('treeitem').count();
    expect(finalCount).toBeGreaterThan(initialCount);
    await expect(page.getByRole('treeitem', { name: newName })).toBeVisible();
  });

  test('deleting a selected node removes it from the tree', async ({ tree, page }) => {
    const newName = generateName('Delete');
    await tree.addNode(newName);
    const countBefore = await page.getByRole('treeitem').count();
    await tree.deleteNode(newName);
    const countAfter = await page.getByRole('treeitem').count();
    expect(countAfter).toBeLessThan(countBefore);
    await expect(page.getByRole('treeitem', { name: newName })).not.toBeVisible();
  });

  test('copying and pasting a node duplicates it as a sibling or child', async ({ tree, page }) => {
    const name = generateName('Copy');
    await tree.addNode(name);
    const initialCount = await page.getByRole('treeitem').count();
    const countAfter = await tree.copyNode(name);
    expect(countAfter).toBe(initialCount + 1);
    await expect(page.getByRole('treeitem', { name })).toHaveCount(2);
  });

  test('cutting and pasting a node relocates it without changing the total count', async ({ tree, page }) => {
    const name = generateName('Cut');
    await tree.addNode(name);
    const initialCount = await page.getByRole('treeitem').count();
    const countAfter = await tree.cutNode(name);
    expect(countAfter).toBe(initialCount);
    await expect(page.getByRole('treeitem', { name })).toBeVisible();
  });

  test('undo and redo restore and reapply a previous edit', async ({ tree, page }) => {
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

  test('collapsing and expanding a parent toggles the visibility of its children', async ({ tree, page }) => {
    const parentName = generateName('Parent');
    const childName = generateName('Child');
    await tree.addNode(parentName);
    const parent = page.getByRole('treeitem', { name: parentName });
    await parent.click();
    await tree.addNode(childName);
    const child = page.getByRole('treeitem', { name: childName });
    await expect(child).toBeVisible();
    await tree.toggleNode(parentName, 'collapse');
    await expect(child).toBeHidden();
    await tree.toggleNode(parentName, 'expand');
    await expect(child).toBeVisible();
  });

  test('exporting and importing preserves or increases the number of nodes', async ({ tree, page }) => {
    const name = generateName('Export');
    await tree.addNode(name);
    const countBeforeExport = await page.getByRole('treeitem').count();
    const filePath = await tree.exportTree();
    expect(filePath).toBeTruthy();
    const fs = require('fs');
    const stats = fs.statSync(filePath);
    expect(stats.size).toBeGreaterThan(0);
    const countAfterImport = await tree.importTree(filePath);
    expect(countAfterImport).toBeGreaterThanOrEqual(countBeforeExport);
  });
});