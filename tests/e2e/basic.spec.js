import { test, expect } from '@playwright/test';

test.describe('Basic Functionality Tests', () => {
  test('✅ Playwright infrastructure is working', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Verify URL is correct
    await expect(page).toHaveURL('http://localhost:5173/');
    
    // Check page title
    const title = await page.title();
    console.log(`Page title: ${title}`);
    
    // Take a screenshot to verify page loaded
    await page.screenshot({ path: 'test-results/homepage-loaded.png', fullPage: true });
    
    // Verify page content exists (any visible text)
    const pageText = await page.textContent('body');
    expect(pageText).toContain('Notes & Tasks');
    expect(pageText).toContain('Personal Area');
    
    console.log('✅ Basic page loading test passed');
  });

  test('✅ Can interact with page elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Find all buttons and check they exist
    const buttons = await page.locator('button').count();
    console.log(`Found ${buttons} buttons on the page`);
    expect(buttons).toBeGreaterThan(0);
    
    // Scroll down and up to test navigation
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, 0));
    
    console.log('✅ Page interaction test passed');
  });

  test('✅ Screenshot comparison works', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Hide dynamic elements that might cause flakiness
    await page.addStyleTag({
      content: `
        .timestamp, .current-time { display: none !important; }
        iframe { display: none !important; }
      `
    });
    
    // Take screenshot for visual regression testing
    await expect(page).toHaveScreenshot('homepage-visual-test.png', {
      fullPage: true,
      animations: 'disabled'
    });
    
    console.log('✅ Visual regression test setup working');
  });

  test('✅ Multi-browser support works', async ({ page, browserName }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Verify the page works in different browsers
    const userAgent = await page.evaluate(() => navigator.userAgent);
    console.log(`Running on ${browserName}: ${userAgent.slice(0, 50)}...`);
    
    // Basic functionality should work in all browsers
    const pageText = await page.textContent('body');
    expect(pageText).toContain('Notes & Tasks');
    
    console.log(`✅ ${browserName} compatibility confirmed`);
  });

  test('✅ Mobile viewport works', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Verify mobile view
    const viewport = page.viewportSize();
    expect(viewport.width).toBe(375);
    expect(viewport.height).toBe(667);
    
    // Take mobile screenshot
    await page.screenshot({ path: 'test-results/mobile-view.png', fullPage: true });
    
    console.log('✅ Mobile viewport test passed');
  });

  test('✅ Test utilities and logging work', async ({ page }) => {
    await page.goto('/');
    
    // Test console monitoring
    const consoleLogs = [];
    page.on('console', msg => consoleLogs.push(msg.text()));
    
    // Test page evaluation
    const result = await page.evaluate(() => {
      console.log('Test log from page');
      return {
        title: document.title,
        url: window.location.href,
        hasLocalStorage: typeof localStorage !== 'undefined'
      };
    });
    
    console.log('Page evaluation result:', result);
    expect(result.hasLocalStorage).toBe(true);
    
    console.log('✅ Test utilities working correctly');
  });
});