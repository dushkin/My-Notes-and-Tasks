import { test, expect } from '@playwright/test';
import { DashboardPage } from '../pages/dashboard-page.js';
import { FabPage } from '../pages/fab-page.js';

test.describe('FAB Functionality Tests', () => {
  let dashboardPage;
  let fabPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
    fabPage = new FabPage(page);
    
    await dashboardPage.goto();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test.describe('Basic FAB Operations', () => {
    test('should open and close FAB menu successfully', async ({ page }) => {
      await fabPage.expectFabVisible();
      await fabPage.expectMenuClosed();

      // Open menu
      await fabPage.clickFab();
      await fabPage.expectMenuOpen();

      // Close menu by clicking outside
      await fabPage.closeMenuByClickingOutside();
      await fabPage.expectMenuClosed();

      // Open again and close with Escape
      await fabPage.clickFab();
      await fabPage.expectMenuOpen();
      
      await fabPage.closeMenuByEscape();
      await fabPage.expectMenuClosed();
    });

    test('should show correct menu options based on selection context', async ({ page }) => {
      // Test with no selection - should only show Root Folder
      await fabPage.clearTreeSelection();
      await fabPage.clickFab();
      
      await fabPage.expectMenuItemCount(1);
      await fabPage.expectMenuItemVisible('Root Folder');
      await fabPage.expectMenuItemHidden('Subfolder');
      await fabPage.expectMenuItemHidden('Note');
      await fabPage.expectMenuItemHidden('Task');
      
      await fabPage.closeMenuByClickingOutside();

      // Create and select a folder - should show all options
      await dashboardPage.createFolder('Test Context Folder');
      await fabPage.selectTreeItem('Test Context Folder');
      
      await fabPage.clickFab();
      await fabPage.expectMenuItemCount(4);
      await fabPage.expectMenuItemVisible('Root Folder');
      await fabPage.expectMenuItemVisible('Subfolder');
      await fabPage.expectMenuItemVisible('Note');
      await fabPage.expectMenuItemVisible('Task');
      
      await fabPage.closeMenuByClickingOutside();
    });

    test('should create items successfully via FAB', async ({ page }) => {
      // Create root folder
      await fabPage.createRootFolderViaMab('FAB Root Folder');
      await dashboardPage.expectItemInTree('FAB Root Folder');

      // Select the folder and create subfolder
      await fabPage.selectTreeItem('FAB Root Folder');
      await fabPage.createSubfolderViaFab('FAB Sub Folder');
      await dashboardPage.expectItemInTree('FAB Sub Folder');

      // Create note in the folder
      await fabPage.selectTreeItem('FAB Root Folder');
      await fabPage.createNoteViaFab('FAB Test Note');
      await dashboardPage.expectItemInTree('FAB Test Note');

      // Create task in the folder
      await fabPage.selectTreeItem('FAB Root Folder');
      await fabPage.createTaskViaFab('FAB Test Task');
      await dashboardPage.expectItemInTree('FAB Test Task');
    });
  });

  test.describe('Responsive Behavior', () => {
    test('should display correctly on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.reload();
      await page.waitForLoadState('networkidle');

      await fabPage.expectDesktopFabInTreePanel();
      
      // Verify position is in tree panel, not overlay
      const fabPosition = await fabPage.getFabPosition();
      expect(fabPosition.x).toBeLessThan(400); // Should be in left panel
    });

    test('should display correctly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await page.waitForLoadState('networkidle');

      await fabPage.expectMobileFabFixed();
      
      // Verify position is fixed overlay in bottom-right
      const fabPosition = await fabPage.getFabPosition();
      expect(fabPosition.x).toBeGreaterThan(250); // Should be on right side
      expect(fabPosition.y).toBeGreaterThan(400); // Should be in bottom area
    });

    test('should handle touch interactions on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await page.waitForLoadState('networkidle');

      await fabPage.tapFab();
      await fabPage.expectMenuOpen();

      await fabPage.tapMenuOption('Root Folder');
      
      // Should open Add Dialog
      const addDialog = page.locator('[data-testid="add-dialog"], .add-dialog');
      await expect(addDialog).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have correct ARIA attributes', async ({ page }) => {
      await fabPage.expectFabHasCorrectAria();
      
      await fabPage.clickFab();
      await fabPage.expectMenuHasCorrectAria();
      await fabPage.expectMenuItemsHaveCorrectAria();
    });

    test('should support keyboard navigation', async ({ page }) => {
      // Navigate to FAB with Tab
      const foundFab = await fabPage.navigateToFabWithKeyboard();
      expect(foundFab).toBeTruthy();

      // Activate with Enter
      await fabPage.activateFabWithKeyboard();
      await fabPage.expectMenuOpen();

      // Navigate menu with arrow keys
      await fabPage.navigateMenuWithKeyboard('down');
      
      // Select item with Enter
      await fabPage.selectMenuItemWithKeyboard();
      
      // Should open Add Dialog
      const addDialog = page.locator('[data-testid="add-dialog"], .add-dialog');
      await expect(addDialog).toBeVisible();
    });

    test('should be screen reader friendly', async ({ page }) => {
      // Check that all interactive elements have proper labels
      const fabLabel = await fabPage.fabMain.getAttribute('aria-label');
      expect(fabLabel).toContain('Create');

      await fabPage.clickFab();
      
      const menuItems = fabPage.fabMenuItems;
      const count = await menuItems.count();
      
      for (let i = 0; i < count; i++) {
        const item = menuItems.nth(i);
        const title = await item.getAttribute('title');
        const text = await item.textContent();
        
        expect(title).toBeTruthy();
        expect(text).toBeTruthy();
      }
    });
  });

  test.describe('Performance', () => {
    test('should open menu quickly', async ({ page }) => {
      const openTime = await fabPage.measureFabOpenTime();
      console.log(`FAB menu opened in ${openTime}ms`);
      expect(openTime).toBeLessThan(500);
    });

    test('should handle repeated open/close without issues', async ({ page }) => {
      // Repeat open/close cycle multiple times
      for (let i = 0; i < 10; i++) {
        await fabPage.clickFab();
        await fabPage.closeMenuByClickingOutside();
        await page.waitForTimeout(50);
      }

      // Verify FAB still works
      await fabPage.clickFab();
      await fabPage.expectMenuOpen();
    });

    test('should respond to item creation quickly', async ({ page }) => {
      const createTime = await fabPage.measureMenuItemClickTime('Root Folder');
      console.log(`Dialog opened in ${createTime}ms after clicking Root Folder`);
      expect(createTime).toBeLessThan(2000);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle disabled state correctly', async ({ page }) => {
      // Simulate disabled state
      await page.evaluate(() => {
        const fab = document.querySelector('.fab-main');
        if (fab) {
          fab.disabled = true;
          fab.classList.add('disabled');
        }
      });

      await fabPage.expectFabDisabled();
      
      // Click should not work
      await page.locator('.fab-main').click({ force: true });
      await page.waitForTimeout(300);
      
      await fabPage.expectMenuClosed();
    });

    test('should handle form cancellation', async ({ page }) => {
      await fabPage.clickFab();
      await fabPage.clickMenuOption('Root Folder');
      
      // Cancel the form
      await fabPage.cancelForm();
      
      // Dialog should close without creating item
      const addDialog = page.locator('[data-testid="add-dialog"], .add-dialog');
      await expect(addDialog).not.toBeVisible();
    });

    test('should maintain proper z-index stacking', async ({ page }) => {
      await fabPage.clickFab();
      
      const menuZIndex = await fabPage.getMenuZIndex();
      expect(menuZIndex).toBeGreaterThan(1000);
      
      // Menu should be visible and not clipped
      const menuPosition = await fabPage.getMenuPosition();
      expect(menuPosition.width).toBeGreaterThan(0);
      expect(menuPosition.height).toBeGreaterThan(0);
    });
  });

  test.describe('Integration', () => {
    test('should integrate with existing tree operations', async ({ page }) => {
      // Create folder via FAB
      await fabPage.createRootFolderViaMab('Integration Test Folder');
      
      // Verify it appears in tree and can be selected
      await fabPage.selectTreeItem('Integration Test Folder');
      
      // Create subfolder using FAB in the context of selected folder
      await fabPage.createSubfolderViaFab('Integration Sub Folder');
      
      // Verify both items exist
      await dashboardPage.expectItemInTree('Integration Test Folder');
      await dashboardPage.expectItemInTree('Integration Sub Folder');
      
      // Use regular tree operations (like rename, delete) on FAB-created items
      await dashboardPage.renameItem('Integration Test Folder', 'Renamed Integration Folder');
      await dashboardPage.expectItemInTree('Renamed Integration Folder');
    });

    test('should work with search functionality', async ({ page }) => {
      // Create items via FAB
      await fabPage.createRootFolderViaMab('Searchable Folder');
      await fabPage.selectTreeItem('Searchable Folder');
      await fabPage.createNoteViaFab('Searchable Note');
      
      // Use search to find FAB-created items
      await dashboardPage.search('Searchable');
      await dashboardPage.expectSearchResults(2); // Folder and note
      
      await dashboardPage.closeSearch();
    });

    test('should work with settings and themes', async ({ page }) => {
      // Test FAB visibility in different themes
      await dashboardPage.changeTheme('dark');
      await fabPage.expectFabVisible();
      
      await dashboardPage.changeTheme('light');
      await fabPage.expectFabVisible();
      
      // FAB should work regardless of theme
      await fabPage.clickFab();
      await fabPage.expectMenuOpen();
    });
  });

  test.describe('Visual Regression', () => {
    test('should match FAB visual design', async ({ page }) => {
      await fabPage.screenshotFab('default-state');
      
      await fabPage.clickFab();
      await fabPage.screenshotFabAndMenu('expanded-state');
    });

    test('should look correct on different screen sizes', async ({ page }) => {
      // Desktop
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.reload();
      await page.waitForLoadState('networkidle');
      await fabPage.screenshotFab('desktop');
      
      // Tablet
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      await page.waitForLoadState('networkidle');
      await fabPage.screenshotFab('tablet');
      
      // Mobile
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await page.waitForLoadState('networkidle');
      await fabPage.screenshotFab('mobile');
    });
  });
});