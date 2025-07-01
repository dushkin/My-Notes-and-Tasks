import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { TreePage } from './pages/tree.page';

const userEmail = 'test@e2e.com';
const userPassword = 'password123!';
const rootFolderName = 'Test Root Folder';
const subfolderName = 'Test Subfolder';
const noteName = 'Test Note';
const taskName = 'Test Task';

// Tree operations - adding items
test.describe('Tree operations - adding items', () => {

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Add a small wait to ensure page is fully loaded
    await page.waitForLoadState('networkidle');

    await loginPage.login(userEmail, userPassword);
    await page.waitForURL('**/app');

    // Wait a bit for the app to fully load
    await page.waitForTimeout(1000);
  });

  // Add a root folder via context menu on the tree
  test('Add root folder via context menu', async ({ page }) => {
    
    const treePage = new TreePage(page);
    await treePage.goto();

    try {
      await treePage.addRootFolderViaContextMenu(rootFolderName);

      // Verify the new folder appears in tree
      const newFolder = await treePage.waitForFolderToAppear(rootFolderName);
      await expect(newFolder).toBeVisible();
    } catch (error) {
      console.error('Test failed, debugging current state...');
      await treePage.debugCurrentState();
      throw error;
    }
  });

  // Add a root folder via the top-bar More Actions menu
  test('Add root folder via toolbar menu', async ({ page }) => {
    const treePage = new TreePage(page);
    await treePage.goto();

    try {
      await treePage.addRootFolderViaToolbar(rootFolderName);

      // Verify the new folder appears in tree
      const newFolder = await treePage.waitForFolderToAppear(rootFolderName);
      await expect(newFolder).toBeVisible();
    } catch (error) {
      console.error('Test failed, debugging current state...');
      await treePage.debugCurrentState();
      throw error;
    }
  });

  // Add a subfolder via context menu
  test('Add subfolder via context menu', async ({ page }) => {
    const treePage = new TreePage(page);
    await treePage.goto();

    try {
      // First create a root folder
      await treePage.addRootFolderViaContextMenu(rootFolderName);
      await treePage.waitForFolderToAppear(rootFolderName);

      // Then add a subfolder to it
      await treePage.addSubfolderViaContextMenu(rootFolderName, subfolderName);

      // Verify the subfolder appears in tree
      const subfolder = await treePage.waitForItemToAppear(subfolderName, 'folder');
      await expect(subfolder).toBeVisible();
    } catch (error) {
      console.error('Test failed, debugging current state...');
      await treePage.debugCurrentState();
      throw error;
    }
  });

  // Add a note via context menu
  test('Add note via context menu', async ({ page }) => {
    const treePage = new TreePage(page);
    await treePage.goto();

    try {
      // First create a root folder
      await treePage.addRootFolderViaContextMenu(rootFolderName);
      await treePage.waitForFolderToAppear(rootFolderName);

      // Then add a note to it
      await treePage.addNoteViaContextMenu(rootFolderName, noteName);

      // Verify the note appears in tree
      const note = await treePage.waitForItemToAppear(noteName, 'note');
      await expect(note).toBeVisible();
    } catch (error) {
      console.error('Test failed, debugging current state...');
      await treePage.debugCurrentState();
      throw error;
    }
  });

  // Add a task via context menu
  test('Add task via context menu', async ({ page }) => {
    const treePage = new TreePage(page);
    await treePage.goto();

    try {
      // First create a root folder
      await treePage.addRootFolderViaContextMenu(rootFolderName);
      await treePage.waitForFolderToAppear(rootFolderName);

      // Then add a task to it
      await treePage.addTaskViaContextMenu(rootFolderName, taskName);

      // Verify the task appears in tree
      const task = await treePage.waitForItemToAppear(taskName, 'task');
      await expect(task).toBeVisible();
    } catch (error) {
      console.error('Test failed, debugging current state...');
      await treePage.debugCurrentState();
      throw error;
    }
  });

  // Test multiple items in one folder
  test('Add multiple items to same folder', async ({ page }) => {
    const treePage = new TreePage(page);
    await treePage.goto();

    try {
      // Create root folder
      await treePage.addRootFolderViaContextMenu(rootFolderName);
      await treePage.waitForFolderToAppear(rootFolderName);

      // Add all three types of items
      await treePage.addSubfolderViaContextMenu(rootFolderName, subfolderName);
      await treePage.addNoteViaContextMenu(rootFolderName, noteName);
      await treePage.addTaskViaContextMenu(rootFolderName, taskName);

      // Verify all items appear
      const subfolder = await treePage.waitForItemToAppear(subfolderName, 'folder');
      const note = await treePage.waitForItemToAppear(noteName, 'note');
      const task = await treePage.waitForItemToAppear(taskName, 'task');

      await expect(subfolder).toBeVisible();
      await expect(note).toBeVisible();
      await expect(task).toBeVisible();
    } catch (error) {
      console.error('Test failed, debugging current state...');
      await treePage.debugCurrentState();
      throw error;
    }
  });
})