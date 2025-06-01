import { test, expect } from './fixtures/base.js';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before each test
    await page.goto('http://localhost:5173');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('should display login form initially', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h2:has-text("Login to Notes & Tasks")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]:has-text("Login")')).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    await page.click('button[type="submit"]');

    await expect(page.locator('[data-item-id="login-error-message"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-item-id="login-error-message"]')).toContainText('Please enter both email and password');
  });

  test('should handle invalid credentials', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"]', 'nonexistent@e2e.com');
    await page.fill('input[type="password"]', 'wrongpassword');

    await page.click('button[type="submit"]');

    await expect(page.locator('[data-item-id="login-error-message"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-item-id="login-error-message"]')).toContainText('Invalid credentials');
  });

  test('should successfully login with pre-created test user', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Use the test user created by global setup
    await page.fill('input[type="email"]', 'test@e2e.com');
    await page.fill('input[type="password"]', 'password123');

    const responsePromise = page.waitForResponse(response =>
      response.url().includes('/api/auth/login') && response.status() === 200
    );

    await page.click('button[type="submit"]');
    await responsePromise;

    // Wait for the app to load
    await expect(page.locator('h1:has-text("Notes & Tasks")')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('nav[aria-label="Notes and Tasks Tree"]')).toBeVisible({ timeout: 10000 });

    // Verify tokens are stored
    const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
    const refreshToken = await page.evaluate(() => localStorage.getItem('refreshToken'));

    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();

    // Verify user info is displayed
    await expect(page.locator('button:has-text("test@e2e.com")')).toBeVisible({ timeout: 5000 });
  });

  test('should register a new user successfully', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Click "Create one" link to go to register page
    await page.click('button:has-text("Create one")');

    // Should show register form
    await expect(page.locator('h2:has-text("Create Account")')).toBeVisible({ timeout: 5000 });

    // Generate unique email for this test using e2e.com domain
    const testEmail = `test-${Date.now()}@e2e.com`;

    // Fill registration form
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input#password-register', 'password123');
    await page.fill('input#confirmPassword-register', 'password123');

    // Wait for successful registration
    const registerResponsePromise = page.waitForResponse(response =>
      response.url().includes('/api/auth/register') && response.status() === 201
    );

    await page.click('button[type="submit"]');
    await registerResponsePromise;

    // Should redirect to login page
    await expect(page.locator('h2:has-text("Login to Notes & Tasks")')).toBeVisible({ timeout: 10000 });
  });

  test('should successfully login after registration', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Generate unique email for this test using e2e.com domain
    const testEmail = `test-login-${Date.now()}@e2e.com`;
    const testPassword = 'password123';

    // First, register a user
    await page.click('button:has-text("Create one")');
    await expect(page.locator('h2:has-text("Create Account")')).toBeVisible({ timeout: 5000 });

    await page.fill('input[type="email"]', testEmail);
    await page.fill('input#password-register', testPassword);
    await page.fill('input#confirmPassword-register', testPassword);

    // Wait for successful registration
    const registerResponsePromise = page.waitForResponse(response =>
      response.url().includes('/api/auth/register') && response.status() === 201
    );

    await page.click('button[type="submit"]');
    await registerResponsePromise;

    // Should redirect to login page
    await expect(page.locator('h2:has-text("Login to Notes & Tasks")')).toBeVisible({ timeout: 10000 });

    // Now login with the registered user
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);

    // Wait for successful login
    const loginResponsePromise = page.waitForResponse(response =>
      response.url().includes('/api/auth/login') && response.status() === 200
    );

    await page.click('button[type="submit"]');
    await loginResponsePromise;

    // Should redirect to main app
    await expect(page.locator('h1:has-text("Notes & Tasks")')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('nav[aria-label="Notes and Tasks Tree"]')).toBeVisible({ timeout: 10000 });

    // Verify tokens are stored
    const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
    const refreshToken = await page.evaluate(() => localStorage.getItem('refreshToken'));

    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();

    // Verify user info is displayed
    await expect(page.locator(`button:has-text("${testEmail}")`)).toBeVisible({ timeout: 5000 });
  });

  test('should logout successfully', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Generate unique email for this test using e2e.com domain
    const testEmail = `test-logout-${Date.now()}@e2e.com`;
    const testPassword = 'password123';

    // Register and login first
    await page.click('button:has-text("Create one")');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input#password-register', testPassword);
    await page.fill('input#confirmPassword-register', testPassword);

    const registerResponsePromise = page.waitForResponse(response =>
      response.url().includes('/api/auth/register') && response.status() === 201
    );
    await page.click('button[type="submit"]');
    await registerResponsePromise;

    // Login
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);

    const loginResponsePromise = page.waitForResponse(response =>
      response.url().includes('/api/auth/login') && response.status() === 200
    );
    await page.click('button[type="submit"]');
    await loginResponsePromise;

    // Wait for app to load
    await expect(page.locator('h1:has-text("Notes & Tasks")')).toBeVisible({ timeout: 15000 });

    // Find and click the account menu
    const accountButton = page.locator(`button:has-text("${testEmail}")`).first();
    await expect(accountButton).toBeVisible({ timeout: 5000 });
    await accountButton.click();

    // Click logout using fixed selector
    const logoutButton = page.getByRole('button', { name: 'Logout', exact: true });
    await expect(logoutButton).toBeVisible({ timeout: 5000 });
    await logoutButton.click();

    // Should return to login page
    await expect(page.locator('h2:has-text("Login to Notes & Tasks")')).toBeVisible({ timeout: 10000 });

    // Verify tokens are cleared
    const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
    const refreshToken = await page.evaluate(() => localStorage.getItem('refreshToken'));

    expect(accessToken).toBeNull();
    expect(refreshToken).toBeNull();
  });

  test('should persist login across page refreshes', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Generate unique email for this test using e2e.com domain
    const testEmail = `test-persist-${Date.now()}@e2e.com`;
    const testPassword = 'password123';

    // Register and login
    await page.click('button:has-text("Create one")');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input#password-register', testPassword);
    await page.fill('input#confirmPassword-register', testPassword);

    const registerResponsePromise = page.waitForResponse(response =>
      response.url().includes('/api/auth/register') && response.status() === 201
    );
    await page.click('button[type="submit"]');
    await registerResponsePromise;

    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);

    const loginResponsePromise = page.waitForResponse(response =>
      response.url().includes('/api/auth/login') && response.status() === 200
    );
    await page.click('button[type="submit"]');
    await loginResponsePromise;

    // Wait for successful login
    await expect(page.locator('h1:has-text("Notes & Tasks")')).toBeVisible({ timeout: 15000 });

    // Refresh the page
    await page.reload({ waitUntil: 'networkidle' });

    // Should still be logged in
    await expect(page.locator('h1:has-text("Notes & Tasks")')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('nav[aria-label="Notes and Tasks Tree"]')).toBeVisible();
    await expect(page.locator(`button:has-text("${testEmail}")`)).toBeVisible({ timeout: 5000 });
  });

  test('should handle password mismatch during registration', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    await page.click('button:has-text("Create one")');
    await expect(page.locator('h2:has-text("Create Account")')).toBeVisible({ timeout: 5000 });

    await page.fill('input[type="email"]', 'mismatch@e2e.com');
    await page.fill('input#password-register', 'password123');
    await page.fill('input#confirmPassword-register', 'differentpassword');

    await page.click('button[type="submit"]');

    // Should show error message for password mismatch
    await expect(page.locator('[data-item-id="register-error-message"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-item-id="register-error-message"]')).toContainText('Passwords do not match');
  });
});