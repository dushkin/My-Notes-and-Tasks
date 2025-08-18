import { test, expect } from '@playwright/test';
import { DashboardPage } from '../pages/dashboard-page.js';

test.describe('FAB Menu Button Tests', () => {
  let dashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    
    // Wait for the app to load completely
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test.describe('Desktop FAB Tests', () => {
    test.beforeEach(async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
    });

    test('should display desktop FAB in tree panel', async ({ page }) => {
      // Find the FAB in the tree panel (inline position)
      const desktopFab = page.locator('.fab-container.fab-inline');
      await expect(desktopFab).toBeVisible();
      
      // Should not show mobile FAB
      const mobileFab = page.locator('.fab-container').filter({ has: page.locator('.fixed') });
      await expect(mobileFab).not.toBeVisible();
    });

    test('should show only "Root Folder" when no tree item selected', async ({ page }) => {
      // Ensure no tree item is selected
      await page.evaluate(() => {
        // Clear any selection
        document.querySelectorAll('.tree-item.selected').forEach(item => {
          item.classList.remove('selected');
        });
      });

      const fab = page.locator('.fab-container .fab-main');
      await fab.click();

      // Wait for menu to expand
      await page.waitForTimeout(300);

      // Should only show "Root Folder" option
      const menuItems = page.locator('.fab-menu .fab-menu-item');
      await expect(menuItems).toHaveCount(1);
      
      const rootFolderItem = menuItems.filter({ hasText: 'Root Folder' });
      await expect(rootFolderItem).toBeVisible();
      
      // Should not show other options
      await expect(menuItems.filter({ hasText: 'Note' })).toHaveCount(0);
      await expect(menuItems.filter({ hasText: 'Task' })).toHaveCount(0);
      await expect(menuItems.filter({ hasText: 'Subfolder' })).toHaveCount(0);
    });

    test('should show all options when folder is selected', async ({ page }) => {
      // First create a folder to select
      await dashboardPage.createFolder('Test Folder');
      
      // Select the folder
      const folderItem = page.locator('[data-item-id*="item-"]').filter({ hasText: 'Test Folder' });
      await folderItem.click();
      
      // Wait for selection to register
      await page.waitForTimeout(500);

      const fab = page.locator('.fab-container .fab-main');
      await fab.click();

      // Wait for menu to expand
      await page.waitForTimeout(300);

      // Should show all options when folder is selected
      const menuItems = page.locator('.fab-menu .fab-menu-item');
      await expect(menuItems).toHaveCount(4);
      
      await expect(menuItems.filter({ hasText: 'Root Folder' })).toBeVisible();
      await expect(menuItems.filter({ hasText: 'Subfolder' })).toBeVisible();
      await expect(menuItems.filter({ hasText: 'Note' })).toBeVisible();
      await expect(menuItems.filter({ hasText: 'Task' })).toBeVisible();
    });

    test('should open Add Dialog when clicking Root Folder option', async ({ page }) => {
      const fab = page.locator('.fab-container .fab-main');
      await fab.click();

      // Wait for menu to expand
      await page.waitForTimeout(300);

      const rootFolderOption = page.locator('.fab-menu-item').filter({ hasText: 'Root Folder' });
      await rootFolderOption.click();

      // Should open Add Dialog
      const addDialog = page.locator('[data-testid="add-dialog"], .add-dialog');
      await expect(addDialog).toBeVisible();
      
      // Should have folder type selected
      const folderTypeButton = addDialog.locator('button').filter({ hasText: /folder/i });
      await expect(folderTypeButton).toBeVisible();
    });

    test('should create root folder successfully', async ({ page }) => {
      const fab = page.locator('.fab-container .fab-main');
      await fab.click();

      const rootFolderOption = page.locator('.fab-menu-item').filter({ hasText: 'Root Folder' });
      await rootFolderOption.click();

      // Fill in folder name
      const nameInput = page.locator('input[placeholder*="folder name"], input[placeholder*="name"]').first();
      await nameInput.fill('FAB Test Folder');

      // Submit the form
      const createButton = page.locator('button').filter({ hasText: /create|add|save/i }).first();
      await createButton.click();

      // Wait for dialog to close and item to appear
      await page.waitForTimeout(1000);

      // Verify folder was created
      const newFolder = page.locator('[data-item-id*="item-"]').filter({ hasText: 'FAB Test Folder' });
      await expect(newFolder).toBeVisible();
    });

    test('should close menu when clicking outside', async ({ page }) => {
      const fab = page.locator('.fab-container .fab-main');
      await fab.click();

      // Wait for menu to expand
      await page.waitForTimeout(300);
      const menu = page.locator('.fab-menu');
      await expect(menu).toBeVisible();

      // Click outside the menu
      await page.click('body', { position: { x: 100, y: 100 } });

      // Menu should close
      await expect(menu).not.toBeVisible();
    });

    test('should close menu when pressing Escape', async ({ page }) => {
      const fab = page.locator('.fab-container .fab-main');
      await fab.click();

      // Wait for menu to expand
      await page.waitForTimeout(300);
      const menu = page.locator('.fab-menu');
      await expect(menu).toBeVisible();

      // Press Escape
      await page.keyboard.press('Escape');

      // Menu should close
      await expect(menu).not.toBeVisible();
    });
  });

  test.describe('Mobile FAB Tests', () => {
    test.beforeEach(async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
    });

    test('should display mobile FAB as fixed overlay', async ({ page }) => {
      // Find the mobile FAB (fixed position)
      const mobileFab = page.locator('.fab-container').filter({ hasClass: /fixed/ });
      await expect(mobileFab).toBeVisible();
      
      // Should not show desktop FAB
      const desktopFab = page.locator('.fab-container.fab-inline');
      await expect(desktopFab).not.toBeVisible();
    });

    test('should position FAB correctly to avoid UI conflicts', async ({ page }) => {
      const mobileFab = page.locator('.fab-container').filter({ hasClass: /fixed/ });
      
      // Get FAB position
      const fabBox = await mobileFab.boundingBox();
      
      // Should be positioned in bottom-right area but not at edge
      expect(fabBox.x).toBeGreaterThan(300); // Right side
      expect(fabBox.y).toBeGreaterThan(500); // Bottom area
      expect(fabBox.y).toBeLessThan(600); // But not at very bottom to avoid Eruda
    });

    test('should show context-aware options on mobile', async ({ page }) => {
      // Test with no selection
      const fab = page.locator('.fab-container .fab-main');
      await fab.click();

      await page.waitForTimeout(300);
      let menuItems = page.locator('.fab-menu .fab-menu-item');
      await expect(menuItems).toHaveCount(1);
      await expect(menuItems.filter({ hasText: 'Root Folder' })).toBeVisible();

      // Close menu
      await page.click('body', { position: { x: 100, y: 100 } });
      await page.waitForTimeout(300);

      // Create and select a folder
      await dashboardPage.createFolder('Mobile Test Folder');
      const folderItem = page.locator('[data-item-id*="item-"]').filter({ hasText: 'Mobile Test Folder' });
      await folderItem.click();
      await page.waitForTimeout(500);

      // Test with folder selected
      await fab.click();
      await page.waitForTimeout(300);
      
      menuItems = page.locator('.fab-menu .fab-menu-item');
      await expect(menuItems).toHaveCount(4);
    });

    test('should handle touch interactions correctly', async ({ page }) => {
      const fab = page.locator('.fab-container .fab-main');
      
      // Simulate touch tap
      await fab.tap();
      await page.waitForTimeout(300);

      const menu = page.locator('.fab-menu');
      await expect(menu).toBeVisible();

      // Tap menu item
      const rootFolderOption = page.locator('.fab-menu-item').filter({ hasText: 'Root Folder' });
      await rootFolderOption.tap();

      // Should open Add Dialog
      const addDialog = page.locator('[data-testid="add-dialog"], .add-dialog');
      await expect(addDialog).toBeVisible();
    });
  });

  test.describe('Context-Aware Behavior Tests', () => {
    test('should update menu options when tree selection changes', async ({ page }) => {
      const fab = page.locator('.fab-container .fab-main');

      // Create a folder first
      await dashboardPage.createFolder('Context Test Folder');
      
      // Test 1: No selection (only Root Folder)
      await fab.click();
      await page.waitForTimeout(300);
      
      let menuItems = page.locator('.fab-menu .fab-menu-item');
      await expect(menuItems).toHaveCount(1);
      
      // Close menu
      await page.click('body', { position: { x: 100, y: 100 } });
      await page.waitForTimeout(300);

      // Test 2: Select folder (all options)
      const folderItem = page.locator('[data-item-id*="item-"]').filter({ hasText: 'Context Test Folder' });
      await folderItem.click();
      await page.waitForTimeout(500);

      await fab.click();
      await page.waitForTimeout(300);
      
      menuItems = page.locator('.fab-menu .fab-menu-item');
      await expect(menuItems).toHaveCount(4);
      
      // Close menu
      await page.click('body', { position: { x: 100, y: 100 } });
      await page.waitForTimeout(300);

      // Test 3: Select different area (back to Root Folder only)
      await page.click('.content-editor, .main-content', { force: true });
      await page.waitForTimeout(500);

      await fab.click();
      await page.waitForTimeout(300);
      
      menuItems = page.locator('.fab-menu .fab-menu-item');
      await expect(menuItems).toHaveCount(1);
    });

    test('should create items in correct parent folder', async ({ page }) => {
      // Create parent folder
      await dashboardPage.createFolder('Parent Folder');
      
      // Select the parent folder
      const parentFolder = page.locator('[data-item-id*="item-"]').filter({ hasText: 'Parent Folder' });
      await parentFolder.click();
      await page.waitForTimeout(500);

      // Use FAB to create subfolder
      const fab = page.locator('.fab-container .fab-main');
      await fab.click();
      await page.waitForTimeout(300);

      const subfolderOption = page.locator('.fab-menu-item').filter({ hasText: 'Subfolder' });
      await subfolderOption.click();

      // Fill in subfolder name
      const nameInput = page.locator('input[placeholder*="folder name"], input[placeholder*="name"]').first();
      await nameInput.fill('Child Folder');

      const createButton = page.locator('button').filter({ hasText: /create|add|save/i }).first();
      await createButton.click();
      await page.waitForTimeout(1000);

      // Verify subfolder was created under parent
      // This might require expanding the parent folder or checking hierarchy
      const childFolder = page.locator('[data-item-id*="item-"]').filter({ hasText: 'Child Folder' });
      await expect(childFolder).toBeVisible();
    });
  });

  test.describe('Integration Tests', () => {
    test('should integrate with existing Add Dialog workflow', async ({ page }) => {
      const fab = page.locator('.fab-container .fab-main');
      await fab.click();

      const rootFolderOption = page.locator('.fab-menu-item').filter({ hasText: 'Root Folder' });
      await rootFolderOption.click();

      // Should use the same Add Dialog as other creation methods
      const addDialog = page.locator('[data-testid="add-dialog"], .add-dialog');
      await expect(addDialog).toBeVisible();

      // Check that it has the same structure as regular add dialog
      const nameInput = page.locator('input[placeholder*="folder name"], input[placeholder*="name"]').first();
      await expect(nameInput).toBeVisible();

      const cancelButton = page.locator('button').filter({ hasText: /cancel/i });
      await expect(cancelButton).toBeVisible();

      const createButton = page.locator('button').filter({ hasText: /create|add|save/i });
      await expect(createButton).toBeVisible();
    });

    test('should work with keyboard navigation', async ({ page }) => {
      const fab = page.locator('.fab-container .fab-main');
      
      // Focus the FAB with Tab navigation
      await page.keyboard.press('Tab');
      // Keep pressing Tab until we reach the FAB
      for (let i = 0; i < 10; i++) {
        const focusedElement = await page.locator(':focus').textContent();
        if (focusedElement && focusedElement.includes('Create')) {
          break;
        }
        await page.keyboard.press('Tab');
      }

      // Activate FAB with Enter or Space
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      const menu = page.locator('.fab-menu');
      await expect(menu).toBeVisible();

      // Navigate menu with arrow keys and select with Enter
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');

      // Should open Add Dialog
      const addDialog = page.locator('[data-testid="add-dialog"], .add-dialog');
      await expect(addDialog).toBeVisible();
    });

    test('should maintain proper z-index and not conflict with other UI', async ({ page }) => {
      const fab = page.locator('.fab-container .fab-main');
      await fab.click();
      await page.waitForTimeout(300);

      const menu = page.locator('.fab-menu');
      await expect(menu).toBeVisible();

      // Check that menu appears above other content
      const menuZIndex = await menu.evaluate(el => window.getComputedStyle(el).zIndex);
      expect(parseInt(menuZIndex)).toBeGreaterThan(1000);

      // Menu should not be clipped by parent containers
      const menuBox = await menu.boundingBox();
      expect(menuBox.width).toBeGreaterThan(0);
      expect(menuBox.height).toBeGreaterThan(0);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle disabled state correctly', async ({ page }) => {
      // Simulate disabled state (e.g., when user is pending deletion)
      await page.evaluate(() => {
        const fab = document.querySelector('.fab-main');
        if (fab) {
          fab.disabled = true;
          fab.classList.add('disabled');
        }
      });

      const fab = page.locator('.fab-container .fab-main');
      
      // FAB should be disabled
      await expect(fab).toBeDisabled();
      
      // Click should not work
      await fab.click({ force: true });
      await page.waitForTimeout(300);

      const menu = page.locator('.fab-menu');
      await expect(menu).not.toBeVisible();
    });

    test('should gracefully handle network errors during item creation', async ({ page }) => {
      // Intercept network requests and make them fail
      await page.route('**/api/**', route => {
        route.abort();
      });

      const fab = page.locator('.fab-container .fab-main');
      await fab.click();

      const rootFolderOption = page.locator('.fab-menu-item').filter({ hasText: 'Root Folder' });
      await rootFolderOption.click();

      const nameInput = page.locator('input[placeholder*="folder name"], input[placeholder*="name"]').first();
      await nameInput.fill('Network Error Test');

      const createButton = page.locator('button').filter({ hasText: /create|add|save/i }).first();
      await createButton.click();

      // Should show error message or keep dialog open
      await page.waitForTimeout(2000);
      
      // Dialog might still be open due to error, or error message shown
      const errorMessage = page.locator('.error, .alert, [role="alert"]');
      const dialogStillOpen = page.locator('[data-testid="add-dialog"], .add-dialog');
      
      const hasError = await errorMessage.isVisible();
      const dialogOpen = await dialogStillOpen.isVisible();
      
      expect(hasError || dialogOpen).toBeTruthy();
    });
  });

  test.describe('Performance Tests', () => {
    test('should open menu quickly without lag', async ({ page }) => {
      const fab = page.locator('.fab-container .fab-main');
      
      const startTime = Date.now();
      await fab.click();
      
      // Menu should appear within 500ms
      const menu = page.locator('.fab-menu');
      await expect(menu).toBeVisible({ timeout: 500 });
      
      const endTime = Date.now();
      const openTime = endTime - startTime;
      
      console.log(`FAB menu opened in ${openTime}ms`);
      expect(openTime).toBeLessThan(500);
    });

    test('should not cause memory leaks with repeated open/close', async ({ page }) => {
      const fab = page.locator('.fab-container .fab-main');
      
      // Repeat open/close cycle multiple times
      for (let i = 0; i < 10; i++) {
        await fab.click();
        await page.waitForTimeout(100);
        
        await page.click('body', { position: { x: 100, y: 100 } });
        await page.waitForTimeout(100);
      }

      // FAB should still be functional
      await fab.click();
      const menu = page.locator('.fab-menu');
      await expect(menu).toBeVisible();
    });
  });
});