import { test, expect } from '@playwright/test';

// Separate tests for Beta Banner visibility based on beta status
test.describe('Beta Banner Display', () => {
  test('displays beta banner when beta is enabled', async ({ page }) => {
    // Stub the beta-status endpoint to return beta enabled
    await page.route('**/auth/beta-status', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ betaEnabled: true, userCount: 10, limit: 50 }),
      })
    );

    // Navigate to the home page
    await page.goto('/');

    // Expect the banner to be visible using its CSS class
    const banner = page.locator('.beta-banner');
    await expect(banner).toBeVisible();
  });

  test('hides beta banner when beta is disabled', async ({ page }) => {
    // Stub the beta-status endpoint to return beta disabled
    await page.route('**/auth/beta-status', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ betaEnabled: false, userCount: 10, limit: 50 }),
      })
    );

    // Navigate to the home page
    await page.goto('/');

    // Expect no banner to be rendered
    const banner = page.locator('.beta-banner');
    await expect(banner).toHaveCount(0);
  });
});
