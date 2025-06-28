export class RegistrationPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.emailInput = page.locator('#email-register');
    this.passwordInput = page.locator('#password-register');
    this.confirmPasswordInput = page.locator('#confirmPassword-register');
    this.submitButton = page.locator('button[type="submit"]');
    this.goToLoginButton = page.getByRole('button', { name: 'Go to Login' });
  }

  async goto() {
    await this.page.goto('http://localhost:5173/register');
  }

  async register(email, password) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(password);
    await this.submitButton.click();
  }

  async clickGoToLogin() {
    await this.goToLoginButton.click();
  }
}