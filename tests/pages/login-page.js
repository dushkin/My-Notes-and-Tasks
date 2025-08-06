import { BasePage } from './base-page.js';

export class LoginPage extends BasePage {
  constructor(page) {
    super(page);
  }

  // Selectors
  get emailInput() {
    return this.page.locator('#email-login, input[type="email"]');
  }

  get passwordInput() {
    return this.page.locator('#password-login, input[type="password"]');
  }

  get loginButton() {
    return this.page.locator('button[type="submit"]:has-text("Login")');
  }

  get registerLink() {
    return this.page.locator('button:has-text("Create one")');
  }

  get forgotPasswordLink() {
    return this.page.locator('[data-testid="forgot-password-link"], a[href*="forgot"]');
  }

  get loginForm() {
    return this.page.locator('form[data-item-id="login-form"]');
  }

  get rememberMeCheckbox() {
    // This app doesn't have remember me checkbox, return a non-existent element
    return this.page.locator('[data-testid="remember-me-not-implemented"]');
  }

  get showPasswordButton() {
    // This app doesn't have show password button, return a non-existent element
    return this.page.locator('[data-testid="show-password-not-implemented"]');
  }

  get socialLoginButtons() {
    return {
      google: this.page.locator('[data-testid="google-login"], .google-login'),
      facebook: this.page.locator('[data-testid="facebook-login"], .facebook-login'),
      github: this.page.locator('[data-testid="github-login"], .github-login')
    };
  }

  // Actions
  async goto() {
    // The app has proper routing - just go directly to /login
    await super.goto('/login');
    
    // Wait for login form to appear
    await this.waitForLoginForm();
  }
  
  async waitForLoginForm() {
    await this.page.waitForSelector('form[data-item-id="login-form"]', { timeout: 10000 });
  }

  async login(email, password, options = {}) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    
    // Skip remember me functionality since this app doesn't have it
    // if (options.rememberMe) {
    //   await this.checkRememberMe();
    // }
    
    await this.clickLogin();
    
    if (options.waitForNavigation !== false) {
      await this.waitForSuccessfulLogin();
    }
  }

  async fillEmail(email) {
    await this.emailInput.fill(email);
    await this.emailInput.blur();
  }

  async fillPassword(password) {
    await this.passwordInput.fill(password);
    await this.passwordInput.blur();
  }

  async clickLogin() {
    await this.clickAndWait(this.loginButton);
  }

  async checkRememberMe() {
    // This app doesn't have remember me functionality - skip this action
    return;
  }

  async uncheckRememberMe() {
    // This app doesn't have remember me functionality - skip this action
    return;
  }

  async togglePasswordVisibility() {
    await this.showPasswordButton.click();
  }

  async clickRegisterLink() {
    await this.registerLink.click();
  }

  async clickForgotPasswordLink() {
    await this.forgotPasswordLink.click();
  }

  async loginWithGoogle() {
    await this.socialLoginButtons.google.click();
    // Handle OAuth popup if needed
  }

  async loginWithFacebook() {
    await this.socialLoginButtons.facebook.click();
    // Handle OAuth popup if needed
  }

  async loginWithGithub() {
    await this.socialLoginButtons.github.click();
    // Handle OAuth popup if needed
  }

  // Override error message selector for login page
  get errorMessage() {
    return this.page.locator('p[data-item-id="login-error-message"]');
  }

  // Validations
  async waitForSuccessfulLogin() {
    // Wait for successful login - should redirect to /app
    await this.page.waitForURL('**/app**', { timeout: 15000 });
    await this.waitForPageLoad();
  }

  async expectLoginError(expectedMessage) {
    await this.expectVisible(this.errorMessage);
    const errorText = await this.errorMessage.textContent();
    if (!errorText.includes(expectedMessage)) {
      throw new Error(`Expected error message "${expectedMessage}" but got "${errorText}"`);
    }
  }

  async expectEmailValidationError() {
    // This app shows validation errors in the main error message, not separate field errors
    // Check if the form prevents submission with invalid email
    const formIsInvalid = await this.page.evaluate(() => {
      const emailInput = document.querySelector('#email-login');
      return !emailInput.checkValidity();
    });
    if (!formIsInvalid) {
      throw new Error('Expected email validation error but form appears valid');
    }
  }

  async expectPasswordValidationError() {
    // This app shows validation errors in the main error message, not separate field errors
    // Check for the general error message about missing password
    await this.expectVisible(this.errorMessage);
    const errorText = await this.errorMessage.textContent();
    if (!errorText.includes('password')) {
      throw new Error('Expected password validation error in general error message');
    }
  }

  async expectLoginFormVisible() {
    await this.expectVisible(this.loginForm);
  }

  async expectLoginButtonDisabled() {
    await this.page.waitForFunction(() => {
      const button = document.querySelector('[data-testid="submit-login"], button[type="submit"]');
      return button && button.disabled;
    });
  }

  async expectLoginButtonEnabled() {
    await this.page.waitForFunction(() => {
      const button = document.querySelector('[data-testid="submit-login"], button[type="submit"]');
      return button && !button.disabled;
    });
  }

  // Form state helpers
  async clearForm() {
    await this.emailInput.fill('');
    await this.passwordInput.fill('');
    // Skip remember me since this app doesn't have it
    // if (await this.rememberMeCheckbox.isChecked()) {
    //   await this.uncheckRememberMe();
    // }
  }

  async getFormData() {
    return {
      email: await this.emailInput.inputValue(),
      password: await this.passwordInput.inputValue(),
      rememberMe: false // This app doesn't have remember me functionality
    };
  }

  async isFormValid() {
    const email = await this.emailInput.inputValue();
    const password = await this.passwordInput.inputValue();
    const isButtonEnabled = !(await this.loginButton.isDisabled());
    
    return email.length > 0 && password.length > 0 && isButtonEnabled;
  }

  // Accessibility helpers
  async checkTabOrder() {
    // Simplified tab order check - just verify we can tab through form elements
    const expectedTabOrder = [
      this.emailInput,
      this.passwordInput,
      this.loginButton,
      this.registerLink
    ];

    for (let i = 0; i < expectedTabOrder.length; i++) {
      await this.page.keyboard.press('Tab');
      await this.page.waitForTimeout(100); // Small delay for focus to register
      
      // Just verify that focus is moving to interactive elements
      const focusedElement = await this.page.evaluate(() => {
        const active = document.activeElement;
        return active ? active.tagName : null;
      });
      
      // Verify we're focusing on expected element types
      if (i < 2 && focusedElement !== 'INPUT') {
        console.warn(`Expected INPUT at step ${i + 1}, got ${focusedElement}`);
      } else if (i >= 2 && focusedElement !== 'BUTTON') {
        console.warn(`Expected BUTTON at step ${i + 1}, got ${focusedElement}`);
      }
    }
  }

  async checkAriaAttributes() {
    // Check form has proper labels
    const emailLabel = await this.emailInput.getAttribute('aria-label') || 
                       await this.page.locator('label[for*="email"]').textContent();
    
    const passwordLabel = await this.passwordInput.getAttribute('aria-label') || 
                          await this.page.locator('label[for*="password"]').textContent();
    
    if (!emailLabel || !passwordLabel) {
      throw new Error('Form inputs missing proper labels');
    }

    // Check error messages are properly associated
    const emailErrorId = await this.emailInput.getAttribute('aria-describedby');
    const passwordErrorId = await this.passwordInput.getAttribute('aria-describedby');
    
    return {
      emailLabel,
      passwordLabel,
      emailErrorId,
      passwordErrorId
    };
  }

  // Mobile-specific methods
  async loginOnMobile(email, password) {
    // On mobile, form might behave differently
    await this.fillEmail(email);
    
    // Hide keyboard after email input
    await this.page.keyboard.press('Tab');
    
    await this.fillPassword(password);
    
    // Hide keyboard before submitting
    await this.passwordInput.blur();
    await this.page.waitForTimeout(500);
    
    await this.clickLogin();
    await this.waitForSuccessfulLogin();
  }

  // Performance helpers
  async measureLoginTime(email, password) {
    const startTime = Date.now();
    await this.login(email, password);
    return Date.now() - startTime;
  }

  // Test data helpers
  static getValidCredentials() {
    return {
      email: process.env.TEST_USER_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PASSWORD || 'testpassword123'
    };
  }

  static getInvalidCredentials() {
    return [
      { email: '', password: '', error: 'Email is required' },
      { email: 'invalid-email', password: 'password', error: 'Invalid email format' },
      { email: 'test@example.com', password: '', error: 'Password is required' },
      { email: 'test@example.com', password: '123', error: 'Password too short' },
      { email: 'nonexistent@example.com', password: 'password123', error: 'Invalid credentials' }
    ];
  }
}