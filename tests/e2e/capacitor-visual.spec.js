import { test, expect } from '@playwright/test';
import { CapacitorPage } from '../pages/capacitor-page.js';

test.describe('Android Visual Regression Tests', () => {
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
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should render correctly in Android WebView portrait', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Ensure portrait orientation
    await capacitorPage.rotateToPortrait();
    
    await expect(page).toHaveScreenshot('android-app-portrait.png', {
      fullPage: true,
      mask: [
        page.locator('[data-testid="timestamp"]'), // Hide dynamic timestamps
        page.locator('.relative-time'), // Hide relative time displays
      ]
    });
  });

  test('should render correctly in Android WebView landscape', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Switch to landscape orientation
    await capacitorPage.rotateToLandscape();
    
    await expect(page).toHaveScreenshot('android-app-landscape.png', {
      fullPage: true,
      mask: [
        page.locator('[data-testid="timestamp"]'),
        page.locator('.relative-time'),
      ]
    });
  });

  test('should handle virtual keyboard overlay correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Find an input field and focus it
    const input = page.locator('input, textarea').first();
    if (await input.isVisible()) {
      await input.click();
      
      // Simulate virtual keyboard showing
      await capacitorPage.showVirtualKeyboard();
      
      await expect(page).toHaveScreenshot('android-virtual-keyboard.png', {
        fullPage: true,
        mask: [page.locator('[data-testid="timestamp"]')]
      });
    }
  });

  test('should render correctly on small Android screens', async ({ page }) => {
    // Set small screen viewport (like older Android phones)
    await page.setViewportSize({ width: 320, height: 568 });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('android-small-screen.png', {
      fullPage: true,
      mask: [page.locator('[data-testid="timestamp"]')]
    });
  });

  test('should render correctly on Android tablets', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('android-tablet.png', {
      fullPage: true,
      mask: [page.locator('[data-testid="timestamp"]')]
    });
  });

  test('should handle offline state visually', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Go offline
    await capacitorPage.setOffline(true);
    
    // Wait for offline indicator to appear
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('android-offline-state.png', {
      fullPage: true,
      mask: [page.locator('[data-testid="timestamp"]')]
    });
  });

  test('should handle dark mode correctly on Android', async ({ page }) => {
    // Enable dark mode if your app supports it
    await page.emulateMedia({ colorScheme: 'dark' });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('android-dark-mode.png', {
      fullPage: true,
      mask: [page.locator('[data-testid="timestamp"]')]
    });
  });

  test('should render loading states correctly', async ({ page }) => {
    // Intercept network requests to simulate loading
    await page.route('**/api/**', route => {
      // Delay response to capture loading state
      setTimeout(() => {
        route.continue();
      }, 2000);
    });
    
    const navigationPromise = page.goto('/');
    
    // Capture loading state
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('android-loading-state.png', {
      fullPage: true
    });
    
    // Wait for navigation to complete
    await navigationPromise;
  });

  test('should handle touch feedback states', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Find a clickable element
    const button = page.locator('button').first();
    
    if (await button.isVisible()) {
      // Hover to simulate touch press
      await button.hover();
      
      await expect(page).toHaveScreenshot('android-touch-feedback.png', {
        fullPage: true,
        mask: [page.locator('[data-testid="timestamp"]')]
      });
    }
  });
});

test.describe('Android Component Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should render navigation correctly on Android', async ({ page }) => {
    const navigation = page.locator('nav, [role="navigation"]').first();
    
    if (await navigation.isVisible()) {
      await expect(navigation).toHaveScreenshot('android-navigation.png', {
        mask: [page.locator('[data-testid="timestamp"]')]
      });
    }
  });

  test('should render forms correctly on Android', async ({ page }) => {
    // Look for forms or form elements
    const form = page.locator('form, .form-container').first();
    
    if (await form.isVisible()) {
      await expect(form).toHaveScreenshot('android-form.png', {
        mask: [page.locator('[data-testid="timestamp"]')]
      });
    }
  });

  test('should render modals correctly on Android', async ({ page }) => {
    // Try to trigger a modal (adjust selector based on your app)
    const modalTrigger = page.locator('[data-testid="open-modal"], .modal-trigger').first();
    
    if (await modalTrigger.isVisible()) {
      await modalTrigger.click();
      
      // Wait for modal to appear
      const modal = page.locator('.modal, [role="dialog"]').first();
      await modal.waitFor({ state: 'visible' });
      
      await expect(page).toHaveScreenshot('android-modal.png', {
        fullPage: true,
        mask: [page.locator('[data-testid="timestamp"]')]
      });
    }
  });
});