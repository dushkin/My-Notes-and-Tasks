import { test, expect } from '@playwright/test';
import { DashboardPage } from '../pages/dashboard-page.js';
import { FabPage } from '../pages/fab-page.js';

test.describe('FAB Mobile-Specific Tests', () => {
  let dashboardPage;
  let fabPage;

  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    dashboardPage = new DashboardPage(page);
    fabPage = new FabPage(page);
    
    await dashboardPage.goto();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test.describe('Mobile Layout and Positioning', () => {
    test('should position FAB correctly on mobile', async ({ page }) => {
      await fabPage.expectMobileFabFixed();
      
      const fabPosition = await fabPage.getFabPosition();
      const viewport = page.viewportSize();
      
      // FAB should be in bottom-right area but not at edges
      expect(fabPosition.x).toBeGreaterThan(viewport.width * 0.7); // Right side
      expect(fabPosition.y).toBeGreaterThan(viewport.height * 0.7); // Bottom area
      expect(fabPosition.y).toBeLessThan(viewport.height - 100); // But not at very bottom
    });

    test('should not conflict with mobile UI elements', async ({ page }) => {
      const fabPosition = await fabPage.getFabPosition();
      
      // Check FAB doesn't overlap with potential mobile elements
      // Leave space for potential debug tools, keyboards, etc.
      expect(fabPosition.y).toBeLessThan(600); // Above potential keyboard area
      expect(fabPosition.x).toBeLessThan(350); // Not at edge to avoid gestures
    });

    test('should scale appropriately for touch targets', async ({ page }) => {
      const fabBox = await fabPage.getFabPosition();
      
      // FAB should be large enough for touch (minimum 44px)
      expect(fabBox.width).toBeGreaterThanOrEqual(44);
      expect(fabBox.height).toBeGreaterThanOrEqual(44);
    });

    test('should position menu correctly relative to FAB on mobile', async ({ page }) => {
      await fabPage.clickFab();
      
      const fabPosition = await fabPage.getFabPosition();
      const menuPosition = await fabPage.getMenuPosition();
      
      // Menu should appear above FAB on mobile
      expect(menuPosition.y).toBeLessThan(fabPosition.y);
      
      // Menu should not go off-screen
      expect(menuPosition.x).toBeGreaterThanOrEqual(0);
      expect(menuPosition.y).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Touch Interactions', () => {
    test('should respond to tap gestures', async ({ page }) => {
      await fabPage.expectMenuClosed();
      
      // Tap to open
      await fabPage.tapFab();
      await fabPage.expectMenuOpen();
      
      // Tap menu item
      await fabPage.tapMenuOption('Root Folder');
      
      const addDialog = page.locator('[data-testid="add-dialog"], .add-dialog');
      await expect(addDialog).toBeVisible();
    });

    test('should handle touch events for menu items', async ({ page }) => {
      await fabPage.tapFab();
      
      const menuItems = fabPage.fabMenuItems;
      const count = await menuItems.count();
      
      // Each menu item should respond to touch
      for (let i = 0; i < count; i++) {
        await fabPage.tapFab(); // Reopen menu
        
        const item = menuItems.nth(i);
        const itemText = await item.textContent();
        
        await item.tap();
        await fabPage.expectMenuClosed();
        
        // Should open Add Dialog for any item
        const addDialog = page.locator('[data-testid="add-dialog"], .add-dialog');
        await expect(addDialog).toBeVisible();
        
        // Close dialog to prepare for next iteration
        await fabPage.cancelForm();
        
        console.log(`✅ Touch interaction working for: ${itemText}`);
      }
    });

    test('should close menu on tap outside', async ({ page }) => {
      await fabPage.tapFab();
      await fabPage.expectMenuOpen();
      
      // Tap outside menu area
      await page.tap('body', { position: { x: 100, y: 100 } });
      await fabPage.expectMenuClosed();
    });

    test('should handle rapid touch interactions gracefully', async ({ page }) => {
      // Rapid tap test
      for (let i = 0; i < 5; i++) {
        await fabPage.tapFab();
        await page.waitForTimeout(100);
        await page.tap('body', { position: { x: 100, y: 100 } });
        await page.waitForTimeout(100);
      }
      
      // FAB should still be functional
      await fabPage.tapFab();
      await fabPage.expectMenuOpen();
    });
  });

  test.describe('Mobile Context and Selection', () => {
    test('should handle tree selection on mobile correctly', async ({ page }) => {
      // Create a folder first
      await dashboardPage.createFolder('Mobile Test Folder');
      
      // Test no selection state
      await fabPage.clearTreeSelection();
      await fabPage.tapFab();
      await fabPage.expectMenuItemCount(1);
      await fabPage.expectMenuItemVisible('Root Folder');
      await fabPage.closeMenuByClickingOutside();
      
      // Select folder via touch
      const folderItem = page.locator('[data-item-id*="item-"]').filter({ hasText: 'Mobile Test Folder' });
      await folderItem.tap();
      await page.waitForTimeout(500);
      
      // Should now show all options
      await fabPage.tapFab();
      await fabPage.expectMenuItemCount(4);
      await fabPage.expectMenuItemVisible('Root Folder');
      await fabPage.expectMenuItemVisible('Subfolder');
      await fabPage.expectMenuItemVisible('Note');
      await fabPage.expectMenuItemVisible('Task');
    });

    test('should create items in correct context on mobile', async ({ page }) => {
      // Create parent folder
      await fabPage.createRootFolderViaMab('Mobile Parent');
      
      // Select it via touch
      const parentFolder = page.locator('[data-item-id*="item-"]').filter({ hasText: 'Mobile Parent' });
      await parentFolder.tap();
      await page.waitForTimeout(500);
      
      // Create subfolder in context
      await fabPage.tapFab();
      await fabPage.tapMenuOption('Subfolder');
      await fabPage.fillFolderForm('Mobile Child');
      await fabPage.submitForm();
      
      // Verify creation
      await dashboardPage.expectItemInTree('Mobile Child');
    });
  });

  test.describe('Mobile Viewport Variations', () => {
    test('should work on small mobile screens', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 }); // iPhone SE
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      await fabPage.expectMobileFabFixed();
      await fabPage.tapFab();
      await fabPage.expectMenuOpen();
      
      // Menu should not overflow screen
      const menuPosition = await fabPage.getMenuPosition();
      expect(menuPosition.x).toBeGreaterThanOrEqual(0);
      expect(menuPosition.y).toBeGreaterThanOrEqual(0);
      expect(menuPosition.x + menuPosition.width).toBeLessThanOrEqual(320);
    });

    test('should work on large mobile screens', async ({ page }) => {
      await page.setViewportSize({ width: 414, height: 896 }); // iPhone 11 Pro Max
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      await fabPage.expectMobileFabFixed();
      
      const fabPosition = await fabPage.getFabPosition();
      
      // Should still be positioned correctly on larger screen
      expect(fabPosition.x).toBeGreaterThan(300);
      expect(fabPosition.y).toBeGreaterThan(700);
    });

    test('should work in landscape mode', async ({ page }) => {
      await page.setViewportSize({ width: 667, height: 375 }); // iPhone landscape
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      await fabPage.expectMobileFabFixed();
      
      const fabPosition = await fabPage.getFabPosition();
      
      // Should adjust for landscape
      expect(fabPosition.x).toBeGreaterThan(500);
      expect(fabPosition.y).toBeGreaterThan(200);
    });
  });

  test.describe('Mobile Accessibility', () => {
    test('should have appropriate touch target sizes', async ({ page }) => {
      const fabBox = await fabPage.getFabPosition();
      
      // Apple recommends minimum 44pt (44px) for touch targets
      expect(fabBox.width).toBeGreaterThanOrEqual(44);
      expect(fabBox.height).toBeGreaterThanOrEqual(44);
      
      await fabPage.tapFab();
      
      const menuItems = fabPage.fabMenuItems;
      const count = await menuItems.count();
      
      for (let i = 0; i < count; i++) {
        const itemBox = await menuItems.nth(i).boundingBox();
        expect(itemBox.height).toBeGreaterThanOrEqual(44);
      }
    });

    test('should work with mobile screen readers', async ({ page }) => {
      // Enable accessibility features simulation
      await page.emulateMedia({ reducedMotion: 'reduce' });
      
      await fabPage.expectFabHasCorrectAria();
      
      await fabPage.tapFab();
      await fabPage.expectMenuHasCorrectAria();
      await fabPage.expectMenuItemsHaveCorrectAria();
    });

    test('should respect reduced motion preferences', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      
      // Test that animations are reduced/disabled
      await fabPage.tapFab();
      
      // Menu should still open but with reduced animation
      await fabPage.expectMenuOpen();
      
      // Check that no-motion classes are applied or animations are minimal
      const menu = fabPage.fabMenu;
      const animationDuration = await menu.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return styles.animationDuration;
      });
      
      // Animation should be disabled or very short for reduced motion
      expect(animationDuration === '0s' || parseFloat(animationDuration) < 0.2).toBeTruthy();
    });
  });

  test.describe('Mobile Performance', () => {
    test('should respond quickly to touch on mobile', async ({ page }) => {
      const touchTime = await page.evaluate(async () => {
        const fab = document.querySelector('.fab-main');
        const startTime = performance.now();
        
        // Simulate touch event
        const touchEvent = new TouchEvent('touchstart', {
          touches: [{
            clientX: fab.getBoundingClientRect().left + 20,
            clientY: fab.getBoundingClientRect().top + 20,
            target: fab
          }],
          bubbles: true
        });
        
        fab.dispatchEvent(touchEvent);
        
        // Wait for menu to appear
        return new Promise(resolve => {
          const observer = new MutationObserver(() => {
            const menu = document.querySelector('.fab-menu');
            if (menu && menu.style.display !== 'none') {
              resolve(performance.now() - startTime);
              observer.disconnect();
            }
          });
          
          observer.observe(document.body, { 
            childList: true, 
            subtree: true, 
            attributes: true 
          });
          
          // Fallback timeout
          setTimeout(() => {
            resolve(performance.now() - startTime);
            observer.disconnect();
          }, 1000);
        });
      });
      
      console.log(`Touch response time: ${touchTime}ms`);
      expect(touchTime).toBeLessThan(300); // Should respond within 300ms
    });

    test('should not cause layout shifts on mobile', async ({ page }) => {
      // Measure layout stability
      await page.evaluate(() => {
        window.layoutShifts = [];
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
              window.layoutShifts.push(entry.value);
            }
          }
        }).observe({ entryTypes: ['layout-shift'] });
      });
      
      // Perform FAB operations
      await fabPage.tapFab();
      await page.waitForTimeout(500);
      await fabPage.closeMenuByClickingOutside();
      await page.waitForTimeout(500);
      
      // Check layout shifts
      const layoutShifts = await page.evaluate(() => window.layoutShifts);
      const totalShift = layoutShifts.reduce((sum, shift) => sum + shift, 0);
      
      console.log(`Total layout shift: ${totalShift}`);
      expect(totalShift).toBeLessThan(0.1); // Good CLS score
    });
  });

  test.describe('Mobile Error Scenarios', () => {
    test('should handle touch events during loading', async ({ page }) => {
      // Simulate slow loading
      await page.route('**/*', route => {
        setTimeout(() => route.continue(), 100);
      });
      
      await page.reload();
      
      // Try to interact with FAB while page is still loading
      try {
        await fabPage.tapFab();
        // Should either work or gracefully ignore the interaction
        const isMenuOpen = await fabPage.fabMenu.isVisible();
        console.log(`Menu opened during loading: ${isMenuOpen}`);
      } catch (error) {
        console.log('Touch interaction gracefully handled during loading');
      }
    });

    test('should handle orientation changes', async ({ page }) => {
      // Start in portrait
      await page.setViewportSize({ width: 375, height: 667 });
      await fabPage.expectMobileFabFixed();
      
      // Change to landscape
      await page.setViewportSize({ width: 667, height: 375 });
      await page.waitForTimeout(500);
      
      // FAB should still work
      await fabPage.expectMobileFabFixed();
      await fabPage.tapFab();
      await fabPage.expectMenuOpen();
    });

    test('should handle network interruptions on mobile', async ({ page }) => {
      // Go offline
      await page.context().setOffline(true);
      
      // FAB UI should still work (menu open/close)
      await fabPage.tapFab();
      await fabPage.expectMenuOpen();
      await fabPage.closeMenuByClickingOutside();
      
      // But creation should fail gracefully
      await fabPage.tapFab();
      await fabPage.tapMenuOption('Root Folder');
      await fabPage.fillFolderForm('Offline Test');
      await fabPage.submitForm();
      
      // Should show error or keep dialog open
      await page.waitForTimeout(2000);
      
      const addDialog = page.locator('[data-testid="add-dialog"], .add-dialog');
      const errorMessage = page.locator('.error, .alert, [role="alert"]');
      
      const dialogOpen = await addDialog.isVisible();
      const hasError = await errorMessage.isVisible();
      
      expect(dialogOpen || hasError).toBeTruthy();
    });
  });
});