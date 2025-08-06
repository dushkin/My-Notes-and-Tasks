import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('should load the homepage', async ({ page }) => {
    // Set a desktop viewport to ensure we get the desktop layout
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    
    // Check that the page loads successfully
    await expect(page).toHaveURL('http://localhost:5173/');
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // On desktop (width >= 640px), the h2 should be visible
    await expect(page.locator('h2:has-text("Notes & Tasks")')).toBeVisible({ timeout: 15000 });
    
    // Check for the Personal Area button (desktop version should have px-6 py-3 classes)
    await expect(page.locator('button:has-text("Personal Area")').filter({ hasText: '🔐 Personal Area' }).nth(1)).toBeVisible({ timeout: 15000 });
    
    console.log('✅ Homepage loaded successfully');
  });

  test('should display main content sections', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check for main sections (use .first() to avoid strict mode violations from meta description)
    await expect(page.locator('text=Organize Your').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Digital Life').first()).toBeVisible();
    
    // Check for feature descriptions
    await expect(page.locator('text=powerful, folders tree based')).toBeVisible();
    
    console.log('✅ Main content sections displayed');
  });

  test('should have working Personal Area button', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Find the Personal Area button (desktop version - second occurrence)
    const visibleButton = page.locator('button:has-text("Personal Area")').nth(1);
    
    // Wait for button to be visible and clickable
    await expect(visibleButton).toBeVisible();
    
    // Scroll to button to ensure it's in view
    await visibleButton.scrollIntoViewIfNeeded();
    
    // Click the button
    await visibleButton.click({ force: true });
    
    // Wait a moment for any action
    await page.waitForTimeout(500);
    
    // Take a screenshot to see what happens (with reduced timeout for faster browsers)
    await page.screenshot({ path: 'test-results/personal-area-clicked.png', fullPage: true, timeout: 5000 });
    
    console.log('✅ Personal Area button clicked successfully');
  });

  test('should be responsive', async ({ page }) => {
    // Test desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // On desktop, the heading should be h2
    await expect(page.locator('h2:has-text("Notes & Tasks")')).toBeVisible({ timeout: 10000 });
    
    // Test mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // On mobile, the heading should be h1
    await expect(page.locator('h1:has-text("Notes & Tasks")')).toBeVisible({ timeout: 10000 });
    
    console.log('✅ Responsive design working');
  });

  test('should have working navigation', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check that we can navigate around basic elements
    const logo = page.locator('h2:has-text("Notes & Tasks")');
    await expect(logo).toBeVisible();
    
    // Scroll down to see more content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    
    // Scroll back up
    await page.evaluate(() => window.scrollTo(0, 0));
    
    // Logo should still be visible
    await expect(logo).toBeVisible();
    
    console.log('✅ Basic navigation working');
  });
});