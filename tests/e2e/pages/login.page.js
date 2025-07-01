class LoginPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.emailInput = page.locator('#email-login');
    this.passwordInput = page.locator('#password-login');
    this.submitButton = page.locator('button[type="submit"]');
  }

  async goto() {
    await this.page.goto('http://localhost:5173/login');
  }

  async login(email, password) {
    
    console.log(`[LoginPage] Attempting login with email: ${email}`);
    
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    
    // Click submit button and wait for navigation
    await this.submitButton.click();
    console.log('[LoginPage] Submit button clicked');
    
    // Wait for navigation to /app with a longer timeout
    try {
      await this.page.waitForURL('**/app', { timeout: 45000 });
      console.log('[LoginPage] Successfully navigated to /app');
    } catch (error) {
      console.log('[LoginPage] Navigation timeout, checking current state...');
      
      const currentUrl = this.page.url();
      console.log(`[LoginPage] Current URL: ${currentUrl}`);
      
      // Check for error messages on the login page
      const errorMessage = await this.page.locator('[role="alert"], .text-red-500, .error').textContent().catch(() => null);
      if (errorMessage) {
        console.error(`[LoginPage] Login error: ${errorMessage}`);
        throw new Error(`Login failed: ${errorMessage}`);
      }
      
      // If we're still on login page, the login might have failed silently
      if (currentUrl.includes('/login')) {
        await this.page.screenshot({ path: `debug-login-failed-${Date.now()}.png` });
        throw new Error('Login failed - still on login page after 45 seconds');
      }
      
      // If we're on a different page, maybe login worked but URL pattern didn't match
      if (!currentUrl.includes('/app')) {
        console.warn(`[LoginPage] Unexpected URL after login: ${currentUrl}`);
      }
      
      throw error;
    }
  }

}
export default LoginPage;
export { LoginPage };
