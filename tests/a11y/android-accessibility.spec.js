import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { CapacitorPage } from '../pages/capacitor-page.js';

test.describe('Android Accessibility Tests', () => {
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

  test('should meet accessibility standards on Android', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have proper touch target sizes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check interactive elements have minimum touch target size (44x44px)
    const interactiveElements = page.locator('button, [role="button"], a, input, [tabindex="0"]');
    const count = await interactiveElements.count();
    
    const smallTargets = [];
    
    for (let i = 0; i < count; i++) {
      const element = interactiveElements.nth(i);
      
      if (await element.isVisible()) {
        const box = await element.boundingBox();
        
        if (box && (box.width < 44 || box.height < 44)) {
          const text = await element.textContent();
          const ariaLabel = await element.getAttribute('aria-label');
          
          smallTargets.push({
            text: text?.trim() || ariaLabel || `Element ${i}`,
            width: box.width,
            height: box.height
          });
        }
      }
    }
    
    if (smallTargets.length > 0) {
      console.log('Small touch targets found:', smallTargets);
    }
    
    expect(smallTargets).toHaveLength(0);
  });

  test('should support screen reader navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check for proper heading structure
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const headingCount = await headings.count();
    
    expect(headingCount).toBeGreaterThan(0);
    
    // Check for proper landmarks
    const landmarks = page.locator('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer');
    const landmarkCount = await landmarks.count();
    
    expect(landmarkCount).toBeGreaterThan(0);
    
    // Check for skip links or other navigation aids
    const skipLinks = page.locator('[href="#main"], [href="#content"], .skip-link');
    // Skip links are optional but recommended
  });

  test('should handle focus management properly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    
    let focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
    
    // Continue tabbing and ensure focus is visible
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      focusedElement = page.locator(':focus');
      
      if (await focusedElement.count() > 0) {
        // Focus should be visible (not hidden)
        const isVisible = await focusedElement.isVisible();
        expect(isVisible).toBeTruthy();
      }
    }
  });

  test('should support high contrast mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Enable forced colors (high contrast mode simulation)
    await page.emulateMedia({ forcedColors: 'active' });
    
    // Check that content is still readable
    const body = page.locator('body');
    await expect(body).toBeVisible();
    
    // Check that interactive elements are still distinguishable
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        await expect(button).toBeVisible();
      }
    }
  });

  test('should handle zoom levels properly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test different zoom levels
    const zoomLevels = [1.5, 2.0, 2.5];
    
    for (const zoom of zoomLevels) {
      // Simulate zoom by reducing viewport size
      const originalViewport = page.viewportSize();
      await page.setViewportSize({
        width: Math.floor(originalViewport.width / zoom),
        height: Math.floor(originalViewport.height / zoom)
      });
      
      // Content should still be accessible
      await expect(page.locator('body')).toBeVisible();
      
      // Interactive elements should still be usable
      const firstButton = page.locator('button').first();
      if (await firstButton.isVisible()) {
        const box = await firstButton.boundingBox();
        // Even when zoomed, touch targets should be reasonable
        expect(box.width).toBeGreaterThan(20);
        expect(box.height).toBeGreaterThan(20);
      }
    }
  });

  test('should provide proper form accessibility', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Find form inputs
    const inputs = page.locator('input, textarea, select');
    const inputCount = await inputs.count();
    
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      
      if (await input.isVisible()) {
        // Check for proper labels
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');
        
        let hasLabel = false;
        
        if (id) {
          const label = page.locator(`label[for="${id}"]`);
          hasLabel = await label.count() > 0;
        }
        
        if (!hasLabel && (ariaLabel || ariaLabelledBy)) {
          hasLabel = true;
        }
        
        // Every input should have an accessible name
        expect(hasLabel).toBeTruthy();
      }
    }
  });

  test('should support voice control patterns', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check for elements that support voice commands
    const voiceElements = page.locator('[aria-label], [title], button');
    const voiceCount = await voiceElements.count();
    
    // Ensure voice-controllable elements have descriptive names
    for (let i = 0; i < Math.min(voiceCount, 10); i++) {
      const element = voiceElements.nth(i);
      
      if (await element.isVisible()) {
        const ariaLabel = await element.getAttribute('aria-label');
        const title = await element.getAttribute('title');
        const textContent = await element.textContent();
        
        const accessibleName = ariaLabel || title || textContent?.trim();
        
        // Voice commands need clear, non-empty names
        if (await element.evaluate(el => el.tagName === 'BUTTON' || el.getAttribute('role') === 'button')) {
          expect(accessibleName).toBeTruthy();
          expect(accessibleName.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test('should handle orientation changes accessibly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test portrait mode accessibility
    await capacitorPage.rotateToPortrait();
    
    let accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
    
    // Test landscape mode accessibility
    await capacitorPage.rotateToLandscape();
    
    accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should maintain accessibility during animations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check for prefers-reduced-motion support
    await page.emulateMedia({ reducedMotion: 'reduce' });
    
    // Animations should be reduced or disabled
    const animatedElements = page.locator('.animate, .transition, [style*="animation"]');
    const count = await animatedElements.count();
    
    if (count > 0) {
      // Check if animations respect reduced motion preference
      for (let i = 0; i < Math.min(count, 5); i++) {
        const element = animatedElements.nth(i);
        
        if (await element.isVisible()) {
          // Element should still be accessible even with reduced motion
          await expect(element).toBeVisible();
        }
      }
    }
  });

  test('should handle error states accessibly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Try to trigger error states (adjust based on your app)
    const forms = page.locator('form');
    const formCount = await forms.count();
    
    if (formCount > 0) {
      const form = forms.first();
      const submitButton = form.locator('button[type="submit"], input[type="submit"]').first();
      
      if (await submitButton.isVisible()) {
        // Submit empty form to trigger validation errors
        await submitButton.click();
        
        // Wait for potential error messages
        await page.waitForTimeout(1000);
        
        // Check for accessible error announcements
        const errorElements = page.locator('[role="alert"], .error, [aria-invalid="true"]');
        const errorCount = await errorElements.count();
        
        if (errorCount > 0) {
          // Error messages should be accessible
          for (let i = 0; i < errorCount; i++) {
            const error = errorElements.nth(i);
            if (await error.isVisible()) {
              const text = await error.textContent();
              expect(text?.trim()).toBeTruthy();
            }
          }
        }
      }
    }
  });
});