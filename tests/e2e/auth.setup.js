import { test as setup, expect } from '@playwright/test';

const authFile = 'tests/fixtures/auth-state.json';

setup('authenticate', async ({ page }) => {
  // Navigate to login page directly
  await page.goto('/login');
  
  // Check if we're redirected to /app (already logged in)
  const currentUrl = page.url();
  if (currentUrl.includes('/app')) {
    console.log('Already authenticated');
    await page.context().storageState({ path: authFile });
    return;
  }
  
  // Look for login form
  const emailInput = page.locator('#email-login, input[type="email"]');
  
  if (await emailInput.isVisible({ timeout: 5000 })) {
    // Fill in login credentials
    await emailInput.fill(process.env.TEST_USER_EMAIL || 'test@example.com');
    
    const passwordInput = page.locator('#password-login, input[type="password"]');
    await passwordInput.fill(process.env.TEST_USER_PASSWORD || 'testpassword');
    
    // Submit login form
    const submitButton = page.locator('button[type="submit"]:has-text("Login")');
    await submitButton.click();
    
    // Wait for successful login (redirect to /app)
    try {
      await page.waitForURL('**/app**', { timeout: 10000 });
      console.log('Authentication successful');
    } catch (error) {
      console.log('Authentication may have failed, but continuing with current state');
    }
  }
  
  // Save authentication state
  await page.context().storageState({ path: authFile });
});