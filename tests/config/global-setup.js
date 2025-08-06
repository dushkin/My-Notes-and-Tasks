import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

async function globalSetup() {
  console.log('🚀 Starting global test setup...');
  
  // Ensure test results directories exist
  const dirs = [
    'test-results',
    'test-results/html-report',
    'test-results/allure-results',
    'test-results/artifacts',
    'tests/fixtures'
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Create authenticated state for tests
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Navigate to login page
    await page.goto('/');
    
    // Check if we need to log in (you might need to adjust this logic)
    const isLoggedIn = await page.locator('[data-testid="user-menu"]').isVisible().catch(() => false);
    
    if (!isLoggedIn) {
      // Perform login if needed
      const loginButton = page.locator('[data-testid="login-button"]');
      if (await loginButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await loginButton.click();
        
        // Fill in test credentials
        await page.fill('[data-testid="email-input"]', process.env.TEST_USER_EMAIL || 'test@example.com');
        await page.fill('[data-testid="password-input"]', process.env.TEST_USER_PASSWORD || 'testpassword');
        await page.click('[data-testid="submit-login"]');
        
        // Wait for successful login
        await page.waitForSelector('[data-testid="user-menu"]', { timeout: 10000 });
      }
    }
    
    // Save authentication state
    await page.context().storageState({ path: './tests/fixtures/auth-state.json' });
    console.log('✅ Authentication state saved');
    
  } catch (error) {
    console.warn('⚠️  Could not establish authenticated state:', error.message);
    console.warn('Tests will run without authentication');
    
    // Create empty auth state file
    await page.context().storageState({ path: './tests/fixtures/auth-state.json' });
  }
  
  await browser.close();
  console.log('✅ Global test setup completed');
}

export default globalSetup;