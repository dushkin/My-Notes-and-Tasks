export class BasePage {
  constructor(page) {
    this.page = page;
  }

  // Common page elements
  get loadingSpinner() {
    return this.page.locator('[data-testid="loading-spinner"], .loading-spinner');
  }

  get errorMessage() {
    return this.page.locator('[data-testid="error-message"], [role="alert"]');
  }

  get successMessage() {
    return this.page.locator('[data-testid="success-message"], .success-message');
  }

  get modal() {
    return this.page.locator('[data-testid="modal"], .modal, [role="dialog"]');
  }

  get confirmDialog() {
    return this.page.locator('[data-testid="confirm-dialog"]');
  }

  // Common actions
  async goto(path = '/') {
    await this.page.goto(path);
    await this.waitForPageLoad();
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.waitForSpinnerToDisappear();
  }

  async waitForSpinnerToDisappear() {
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {
      // Spinner might not exist, which is fine
    });
  }

  async waitForErrorToDisappear() {
    await this.errorMessage.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {
      // Error might not exist, which is fine
    });
  }

  async clickAndWait(locator, waitFor = 'networkidle') {
    await locator.click();
    if (waitFor === 'networkidle') {
      await this.page.waitForLoadState('networkidle');
    } else if (waitFor === 'domcontentloaded') {
      await this.page.waitForLoadState('domcontentloaded');
    }
    await this.waitForSpinnerToDisappear();
  }

  async fillAndBlur(locator, value) {
    await locator.fill(value);
    await locator.blur();
  }

  async selectOption(locator, value) {
    await locator.selectOption(value);
    await this.page.waitForTimeout(100); // Brief wait for any change handlers
  }

  async uploadFile(locator, filePath) {
    await locator.setInputFiles(filePath);
    await this.waitForSpinnerToDisappear();
  }

  async waitForModal() {
    await this.modal.waitFor({ state: 'visible', timeout: 5000 });
  }

  async closeModal() {
    const closeButton = this.modal.locator('[data-testid="close-modal"], .close-button, [aria-label="Close"]');
    await closeButton.click();
    await this.modal.waitFor({ state: 'hidden', timeout: 5000 });
  }

  async confirmAction() {
    const confirmButton = this.confirmDialog.locator('[data-testid="confirm-button"], .confirm-button');
    await confirmButton.click();
    await this.confirmDialog.waitFor({ state: 'hidden', timeout: 5000 });
  }

  async cancelAction() {
    const cancelButton = this.confirmDialog.locator('[data-testid="cancel-button"], .cancel-button');
    await cancelButton.click();
    await this.confirmDialog.waitFor({ state: 'hidden', timeout: 5000 });
  }

  // Keyboard shortcuts
  async pressEscape() {
    await this.page.keyboard.press('Escape');
  }

  async pressEnter() {
    await this.page.keyboard.press('Enter');
  }

  async pressCtrlS() {
    await this.page.keyboard.press('Control+s');
  }

  async pressCtrlZ() {
    await this.page.keyboard.press('Control+z');
  }

  // Mobile-specific actions
  async swipeLeft() {
    const viewport = this.page.viewportSize();
    await this.page.touchscreen.tap(viewport.width - 50, viewport.height / 2);
    await this.page.touchscreen.tap(50, viewport.height / 2);
  }

  async swipeRight() {
    const viewport = this.page.viewportSize();
    await this.page.touchscreen.tap(50, viewport.height / 2);
    await this.page.touchscreen.tap(viewport.width - 50, viewport.height / 2);
  }

  // Validation helpers
  async expectVisible(locator, timeout = 5000) {
    await locator.waitFor({ state: 'visible', timeout });
  }

  async expectHidden(locator, timeout = 5000) {
    await locator.waitFor({ state: 'hidden', timeout });
  }

  async expectText(locator, expectedText, timeout = 5000) {
    await locator.waitFor({ state: 'visible', timeout });
    await this.page.waitForFunction(
      ({ selector, expected }) => {
        const element = document.querySelector(selector);
        return element && element.textContent.includes(expected);
      },
      { selector: await locator.first().getAttribute('data-testid') || await locator.first().tagName, expected: expectedText },
      { timeout }
    );
  }

  // Error handling
  async getErrorMessages() {
    const errors = await this.errorMessage.all();
    const messages = [];
    for (const error of errors) {
      if (await error.isVisible()) {
        messages.push(await error.textContent());
      }
    }
    return messages;
  }

  async hasErrors() {
    return await this.errorMessage.first().isVisible({ timeout: 1000 }).catch(() => false);
  }

  // Accessibility helpers
  async checkFocusTrapping() {
    // Press Tab multiple times and ensure focus stays within the modal/dialog
    const activeElements = [];
    
    for (let i = 0; i < 10; i++) {
      await this.page.keyboard.press('Tab');
      const activeElement = await this.page.evaluate(() => {
        const active = document.activeElement;
        return {
          tagName: active.tagName,
          id: active.id,
          className: active.className,
          testId: active.getAttribute('data-testid')
        };
      });
      activeElements.push(activeElement);
    }
    
    return activeElements;
  }

  async checkAriaLabels() {
    const elementsWithoutLabels = await this.page.evaluate(() => {
      const interactive = document.querySelectorAll('button, input, select, textarea, [role="button"], [role="link"]');
      const issues = [];
      
      interactive.forEach(element => {
        const hasLabel = element.getAttribute('aria-label') || 
                         element.getAttribute('aria-labelledby') ||
                         element.textContent.trim() ||
                         element.getAttribute('title');
        
        if (!hasLabel) {
          issues.push({
            tagName: element.tagName,
            className: element.className,
            id: element.id
          });
        }
      });
      
      return issues;
    });
    
    return elementsWithoutLabels;
  }

  // Performance helpers
  async measurePageLoadTime() {
    const startTime = Date.now();
    await this.waitForPageLoad();
    return Date.now() - startTime;
  }

  async getPerformanceMetrics() {
    return await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
      };
    });
  }
}