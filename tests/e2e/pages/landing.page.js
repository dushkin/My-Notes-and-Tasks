import { expect } from '@playwright/test';

export default class LandingPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.betaBanner = page.locator('.beta-banner--landing');
    this.signUpBtn = page.getByRole('button', { name: /^🚀 Sign up free! \(Up to 100 items\)$/ });
    this.logo = page.getByRole('heading', { name: 'Notes & Tasks' });
    this.personalAreaBtn = page.getByRole('button', { name: /Personal Area/i });
  }

  /** Navigate to the landing page */
  async goto() {
    await this.page.goto('http://localhost:5173'); // default load event
  }

  async expectLogo() {
    await expect(this.logo).toBeVisible();
  }

  /** Verify the hero sign-up button is visible */
  async expectSignUpVisible() {
    await expect(this.signUpBtn).toBeVisible();
  }

  /** Verify the "Personal Area" button is visible */
  async expectPersonalAreaVisible() {
    await expect(this.personalAreaBtn).toBeVisible();
  }
}
