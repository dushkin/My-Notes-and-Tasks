import { test, expect } from '../fixtures/test-fixtures.js';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await injectAxe(page);
  });

  test('should have no accessibility violations on login page', async ({ page, loginPage, logger }) => {
    logger.info('Testing login page accessibility');
    
    await loginPage.goto();
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true }
    });
    
    logger.info('Login page accessibility check completed');
  });

  test('should have no accessibility violations on dashboard', async ({ page, dashboardPage, logger }) => {
    logger.info('Testing dashboard accessibility');
    
    await dashboardPage.goto();
    await dashboardPage.waitForDashboardLoad();
    
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true },
      tags: ['wcag2a', 'wcag2aa', 'wcag21aa']
    });
    
    logger.info('Dashboard accessibility check completed');
  });

  test('should have proper heading structure', async ({ page, dashboardPage, logger }) => {
    logger.info('Testing heading structure');
    
    await dashboardPage.goto();
    
    const headings = await page.evaluate(() => {
      const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      return Array.from(headingElements).map(h => ({
        level: parseInt(h.tagName.charAt(1)),
        text: h.textContent.trim(),
        id: h.id
      }));
    });
    
    // Should have exactly one h1
    const h1Count = headings.filter(h => h.level === 1).length;
    expect(h1Count).toBe(1);
    
    // Check heading hierarchy
    let previousLevel = 0;
    for (const heading of headings) {
      if (heading.level > previousLevel + 1) {
        throw new Error(`Heading hierarchy violation: h${previousLevel} followed by h${heading.level}`);
      }
      previousLevel = Math.max(previousLevel, heading.level);
    }
    
    logger.info(`Heading structure validated: ${headings.length} headings found`);
  });

  test('should have proper ARIA labels', async ({ page, dashboardPage, logger }) => {
    logger.info('Testing ARIA labels');
    
    await dashboardPage.goto();
    
    // Check interactive elements have proper labels
    const interactiveElements = await page.locator('button, input, select, textarea, a[href], [role="button"], [role="link"]').all();
    
    for (const element of interactiveElements) {
      const hasLabel = await element.evaluate(el => {
        return el.getAttribute('aria-label') || 
               el.getAttribute('aria-labelledby') ||
               el.textContent.trim() ||
               el.getAttribute('title') ||
               el.getAttribute('alt');
      });
      
      if (!hasLabel) {
        const tagName = await element.evaluate(el => el.tagName);
        const className = await element.evaluate(el => el.className);
        logger.warn(`Element missing label: ${tagName} with class ${className}`);
      }
    }
    
    logger.info(`ARIA labels checked for ${interactiveElements.length} interactive elements`);
  });

  test('should support keyboard navigation', async ({ page, dashboardPage, logger }) => {
    logger.info('Testing keyboard navigation');
    
    await dashboardPage.goto();
    
    // Find all focusable elements
    const focusableElements = await page.locator('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])').all();
    
    if (focusableElements.length === 0) {
      logger.warn('No focusable elements found');
      return;
    }
    
    // Start from first element
    await focusableElements[0].focus();
    
    // Tab through elements
    for (let i = 1; i < Math.min(focusableElements.length, 10); i++) {
      await page.keyboard.press('Tab');
      
      // Check if correct element is focused
      const focusedElement = page.locator(':focus');
      const expectedElement = focusableElements[i];
      
      const isFocused = await expectedElement.evaluate((el, focusedEl) => {
        return el === focusedEl;
      }, await focusedElement.elementHandle());
      
      if (!isFocused) {
        logger.warn(`Keyboard navigation issue at element ${i}`);
      }
    }
    
    logger.info(`Keyboard navigation tested through ${Math.min(focusableElements.length, 10)} elements`);
  });

  test('should have sufficient color contrast', async ({ page, dashboardPage, logger }) => {
    logger.info('Testing color contrast');
    
    await dashboardPage.goto();
    
    // This would typically use axe-core's color contrast rules
    await checkA11y(page, null, {
      rules: {
        'color-contrast': { enabled: true }
      }
    });
    
    // Manual contrast check for key elements
    const textElements = await page.locator('p, span, div, h1, h2, h3, h4, h5, h6, button, a').all();
    
    for (const element of textElements.slice(0, 20)) { // Check first 20 elements
      const styles = await element.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          fontSize: computed.fontSize
        };
      });
      
      // Basic contrast check (would need a proper contrast ratio calculator)
      if (styles.color === styles.backgroundColor) {
        logger.warn('Potential contrast issue: text color same as background');
      }
    }
    
    logger.info('Color contrast check completed');
  });

  test('should handle focus management in modals', async ({ page, dashboardPage, logger }) => {
    logger.info('Testing modal focus management');
    
    await dashboardPage.goto();
    
    // Open modal
    await dashboardPage.addButton.click();
    await page.waitForSelector('[data-testid="add-dialog"], .add-dialog');
    
    // Check focus is trapped in modal
    const modalContent = page.locator('[data-testid="add-dialog"], .add-dialog');
    const focusableInModal = modalContent.locator('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])');
    
    const count = await focusableInModal.count();
    if (count > 0) {
      // Focus should be on first focusable element in modal
      const firstFocusable = focusableInModal.first();
      await expect(firstFocusable).toBeFocused();
      
      // Tab through modal elements
      for (let i = 0; i < count; i++) {
        await page.keyboard.press('Tab');
      }
      
      // After tabbing through all elements, should be back to first
      await expect(firstFocusable).toBeFocused();
    }
    
    // Close modal with Escape
    await page.keyboard.press('Escape');
    await expect(modalContent).toBeHidden();
    
    // Focus should return to trigger element
    await expect(dashboardPage.addButton).toBeFocused();
    
    logger.info('Modal focus management tested');
  });

  test('should provide screen reader friendly content', async ({ page, dashboardPage, testData, logger }) => {
    logger.info('Testing screen reader compatibility');
    
    await dashboardPage.goto();
    
    // Create some test content
    const taskData = testData.generateTaskData();
    await dashboardPage.createTask(taskData.title, { priority: 'high' });
    
    // Check for proper landmarks
    const landmarks = await page.locator('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"]').count();
    expect(landmarks).toBeGreaterThan(0);
    
    // Check for proper list structures
    const lists = await page.locator('ul, ol, [role="list"]').count();
    if (lists > 0) {
      const listItems = await page.locator('li, [role="listitem"]').count();
      expect(listItems).toBeGreaterThan(0);
    }
    
    // Check for status announcements
    const ariaLive = await page.locator('[aria-live], [role="status"], [role="alert"]').count();
    logger.info(`Found ${ariaLive} live regions for status announcements`);
    
    logger.info('Screen reader compatibility check completed');
  });

  test('should handle reduced motion preferences', async ({ page, dashboardPage, logger }) => {
    logger.info('Testing reduced motion support');
    
    // Set reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });
    
    await dashboardPage.goto();
    
    // Check that animations are disabled or reduced
    const animatedElements = await page.locator('[class*="animate"], [class*="transition"], [class*="motion"]').all();
    
    for (const element of animatedElements) {
      const animationDuration = await element.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return computed.animationDuration;
      });
      
      // With reduced motion, animations should be instant or very short
      if (animationDuration && animationDuration !== '0s' && parseFloat(animationDuration) > 0.2) {
        logger.warn(`Animation duration ${animationDuration} may be too long for reduced motion`);
      }
    }
    
    logger.info('Reduced motion preferences tested');
  });

  test('should be usable with high contrast mode', async ({ page, dashboardPage, logger }) => {
    logger.info('Testing high contrast mode compatibility');
    
    // Simulate high contrast mode
    await page.addStyleTag({
      content: `
        @media (prefers-contrast: high) {
          * {
            background: black !important;
            color: white !important;
            border-color: white !important;
          }
          a, button {
            color: yellow !important;
          }
        }
      `
    });
    
    await dashboardPage.goto();
    
    // Verify content is still visible and usable
    await expect(page.locator('body')).toBeVisible();
    await expect(dashboardPage.addButton).toBeVisible();
    
    // Test that interactive elements are still clickable
    await dashboardPage.addButton.click();
    await expect(page.locator('[data-testid="add-dialog"]')).toBeVisible();
    
    logger.info('High contrast mode compatibility tested');
  });

  test('should handle zoom levels correctly', async ({ page, dashboardPage, logger }) => {
    logger.info('Testing zoom level compatibility');
    
    await dashboardPage.goto();
    
    // Test different zoom levels
    const zoomLevels = [1.5, 2.0, 2.5];
    
    for (const zoom of zoomLevels) {
      await page.evaluate((zoomLevel) => {
        document.body.style.zoom = zoomLevel;
      }, zoom);
      
      await page.waitForTimeout(500);
      
      // Verify content is still accessible
      await expect(dashboardPage.addButton).toBeVisible();
      await expect(page.locator('[data-testid="tree-container"]')).toBeVisible();
      
      // Check for horizontal scrolling (which might indicate layout issues)
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      
      if (hasHorizontalScroll) {
        logger.warn(`Horizontal scrolling detected at ${zoom * 100}% zoom`);
      }
    }
    
    // Reset zoom
    await page.evaluate(() => {
      document.body.style.zoom = 1;
    });
    
    logger.info('Zoom level compatibility tested');
  });
});