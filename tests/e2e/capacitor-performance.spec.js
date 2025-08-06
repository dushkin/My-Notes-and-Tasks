import { test, expect } from '@playwright/test';
import { CapacitorPage } from '../pages/capacitor-page.js';

test.describe('Android Performance Tests', () => {
  let capacitorPage;

  test.beforeEach(async ({ page }) => {
    // Add Capacitor mocks for testing
    await page.addInitScript(() => {
      if (!window.Capacitor) {
        window.Capacitor = {
          isNativePlatform: () => false,
          getPlatform: () => 'web',
          Plugins: {
            App: {
              addListener: () => ({ remove: () => {} }),
              minimizeApp: () => Promise.resolve(),
              exitApp: () => Promise.resolve()
            }
          }
        };
      }
    });
    
    capacitorPage = new CapacitorPage(page);
  });

  test('should load app within acceptable time on Android', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // App should load within 3 seconds on mobile
    expect(loadTime).toBeLessThan(3000);
    
    console.log(`App load time: ${loadTime}ms`);
  });

  test('should handle navigation performance on Android', async ({ page }) => {
    await page.goto('/');
    
    // Measure navigation time within the landing page
    const startTime = Date.now();
    // Try to click a section or button on the landing page
    const navElement = await page.locator('button, a, [role="button"]').first();
    if (await navElement.isVisible()) {
      await navElement.click();
    }
    await page.waitForLoadState('networkidle');
    const navigationTime = Date.now() - startTime;
    
    // Navigation should be fast on mobile
    expect(navigationTime).toBeLessThan(1500);
    
    console.log(`Navigation time: ${navigationTime}ms`);
  });

  test('should handle large lists efficiently on Android', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Start performance monitoring
    await page.evaluate(() => {
      window.performanceStart = Date.now();
    });
    
    // Simulate large list rendering or scrolling
    const listContainer = page.locator('[data-testid="items-list"], .list-container').first();
    
    if (await listContainer.isVisible()) {
      // Scroll through list to test performance
      for (let i = 0; i < 5; i++) {
        await listContainer.evaluate(el => el.scrollTop += 300);
        await page.waitForTimeout(100);
      }
    }
    
    const performanceTime = await page.evaluate(() => {
      return Date.now() - window.performanceStart;
    });
    
    // Scrolling should remain smooth
    expect(performanceTime).toBeLessThan(2000);
  });

  test('should handle memory usage efficiently', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      return performance.memory ? performance.memory.usedJSHeapSize : 0;
    });
    
    // Perform memory-intensive operations
    for (let i = 0; i < 10; i++) {
      // Navigate and create elements
      await page.evaluate(() => {
        const div = document.createElement('div');
        div.innerHTML = 'Test content '.repeat(100);
        document.body.appendChild(div);
        document.body.removeChild(div);
      });
    }
    
    // Force garbage collection if available
    await page.evaluate(() => {
      if (window.gc) {
        window.gc();
      }
    });
    
    const finalMemory = await page.evaluate(() => {
      return performance.memory ? performance.memory.usedJSHeapSize : 0;
    });
    
    // Memory usage shouldn't grow excessively
    if (initialMemory > 0 && finalMemory > 0) {
      const memoryIncrease = finalMemory - initialMemory;
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
    }
  });

  test('should handle offline/online transitions efficiently', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const startTime = Date.now();
    
    // Go offline
    await capacitorPage.setOffline(true);
    await page.waitForTimeout(500);
    
    // Go back online
    await capacitorPage.setOffline(false);
    await page.waitForTimeout(500);
    
    const transitionTime = Date.now() - startTime;
    
    // Network transitions should be handled quickly
    expect(transitionTime).toBeLessThan(2000);
  });

  test('should handle app lifecycle transitions efficiently', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const startTime = Date.now();
    
    // Simulate app lifecycle
    await capacitorPage.pauseApp();
    await page.waitForTimeout(100);
    
    await capacitorPage.resumeApp();
    await page.waitForTimeout(100);
    
    const lifecycleTime = Date.now() - startTime;
    
    // Lifecycle transitions should be fast
    expect(lifecycleTime).toBeLessThan(1000);
    
    // App should still be responsive
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle orientation changes efficiently', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const startTime = Date.now();
    
    // Test orientation changes
    await capacitorPage.rotateToLandscape();
    await page.waitForTimeout(200);
    
    await capacitorPage.rotateToPortrait();
    await page.waitForTimeout(200);
    
    const orientationTime = Date.now() - startTime;
    
    // Orientation changes should be smooth
    expect(orientationTime).toBeLessThan(1500);
    
    // UI should still be functional
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle input performance on virtual keyboard', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const input = page.locator('input, textarea').first();
    
    if (await input.isVisible()) {
      await input.click();
      
      // Simulate virtual keyboard
      await capacitorPage.showVirtualKeyboard();
      
      const startTime = Date.now();
      
      // Type rapidly
      const testText = 'This is a performance test for virtual keyboard input handling';
      await input.fill(testText);
      
      const inputTime = Date.now() - startTime;
      
      // Input should be responsive
      expect(inputTime).toBeLessThan(1000);
      
      // Verify text was entered correctly
      await expect(input).toHaveValue(testText);
    }
  });

  test('should maintain smooth animations on Android', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Look for animated elements
    const animatedElement = page.locator('.animate, .transition, [data-testid="animated"]').first();
    
    if (await animatedElement.isVisible()) {
      const startTime = Date.now();
      
      // Trigger animation
      await animatedElement.hover();
      await page.waitForTimeout(500);
      
      const animationTime = Date.now() - startTime;
      
      // Animation should complete smoothly
      expect(animationTime).toBeGreaterThan(200); // Animation actually ran
      expect(animationTime).toBeLessThan(1500); // But not too slow
    }
  });

  test('should handle concurrent operations efficiently', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const startTime = Date.now();
    
    // Simulate concurrent operations
    const operations = [
      page.evaluate(() => fetch('/api/health').catch(() => {})),
      page.evaluate(() => localStorage.setItem('test', 'data')),
      page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100))),
      capacitorPage.rotateToLandscape(),
      page.locator('body').hover(),
    ];
    
    await Promise.all(operations);
    
    const concurrentTime = Date.now() - startTime;
    
    // Concurrent operations should complete efficiently
    expect(concurrentTime).toBeLessThan(2000);
  });
});