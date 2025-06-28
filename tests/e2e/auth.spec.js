import { test, expect } from '@playwright/test';
import { RegistrationPage } from './pages/registration.page';
import { LoginPage } from './pages/login.page';

test.describe('Authentication flow', () => {
  const userEmail = 'e2euser@e2e.com';
  const userPassword = 'password123!';

  // Test user registration and redirection to login page
  test('Registration process', async ({ page }) => {
    const registrationPage = new RegistrationPage(page);

    await registrationPage.goto();
    await expect(page.locator('[data-item-id="register-form"]')).toBeVisible();
    await registrationPage.register(userEmail, userPassword);
    await expect(registrationPage.goToLoginButton).toBeVisible();
    await registrationPage.clickGoToLogin();
    await page.waitForURL('**/login');
    await expect(page.url()).toContain('/login');
  });

  // Test user login and access to the protected application
  test('Login process', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await expect(page.locator('[data-item-id="login-form"]')).toBeVisible();
    await loginPage.login(userEmail, userPassword);
    await page.waitForURL('**/app');
    await expect(page.url()).toContain('/app');
  });
});