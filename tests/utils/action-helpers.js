/**
 * Common action helpers for Playwright tests
 * These functions provide reusable patterns for common testing scenarios
 */

// Authentication helpers
export const authHelpers = {
  async loginWithCredentials(page, email, password) {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"], input[type="email"]', email);
    await page.fill('[data-testid="password-input"], input[type="password"]', password);
    await page.click('[data-testid="submit-login"], button[type="submit"]');
    
    // Wait for successful login
    await page.waitForURL(/\/(dashboard|app|home)/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  },

  async logout(page) {
    await page.click('[data-testid="user-menu"], .user-menu');
    await page.click('[data-testid="logout-button"], .logout-button');
    await page.waitForURL(/\/login/, { timeout: 10000 });
  },

  async ensureAuthenticated(page) {
    const isAuthenticated = await page.locator('[data-testid="user-menu"]')
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    
    if (!isAuthenticated) {
      const credentials = {
        email: process.env.TEST_USER_EMAIL || 'test@example.com',
        password: process.env.TEST_USER_PASSWORD || 'testpassword'
      };
      await this.loginWithCredentials(page, credentials.email, credentials.password);
    }
  }
};

// Navigation helpers
export const navHelpers = {
  async navigateToSection(page, section) {
    const sectionMap = {
      'dashboard': '/',
      'settings': '/settings',
      'profile': '/profile',
      'help': '/help'
    };
    
    const path = sectionMap[section.toLowerCase()];
    if (!path) {
      throw new Error(`Unknown section: ${section}`);
    }
    
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  },

  async waitForNavigation(page, expectedUrl) {
    await page.waitForURL(expectedUrl, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  },

  async goBack(page) {
    await page.goBack();
    await page.waitForLoadState('networkidle');
  },

  async refresh(page) {
    await page.reload();
    await page.waitForLoadState('networkidle');
  }
};

// Form helpers
export const formHelpers = {
  async fillForm(page, formData, formSelector = 'form') {
    const form = page.locator(formSelector);
    await form.waitFor({ state: 'visible' });
    
    for (const [fieldName, value] of Object.entries(formData)) {
      const field = form.locator(`[name="${fieldName}"], [data-testid="${fieldName}"]`);
      
      const fieldType = await field.getAttribute('type') || 
                       await field.evaluate(el => el.tagName.toLowerCase());
      
      switch (fieldType) {
        case 'checkbox':
          if (value) {
            await field.check();
          } else {
            await field.uncheck();
          }
          break;
        case 'radio':
          await field.check();
          break;
        case 'select':
          await field.selectOption(value);
          break;
        case 'file':
          await field.setInputFiles(value);
          break;
        case 'textarea':
          await field.fill(value);
          break;
        default:
          await field.fill(value);
      }
      
      // Trigger blur for validation
      await field.blur();
    }
  },

  async submitForm(page, formSelector = 'form') {
    const form = page.locator(formSelector);
    const submitButton = form.locator('button[type="submit"], input[type="submit"], .submit-button');
    
    await submitButton.click();
    await page.waitForLoadState('networkidle');
  },

  async clearForm(page, formSelector = 'form') {
    const form = page.locator(formSelector);
    const inputs = form.locator('input:not([type="submit"]):not([type="button"]), textarea, select');
    
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const type = await input.getAttribute('type') || 
                  await input.evaluate(el => el.tagName.toLowerCase());
      
      switch (type) {
        case 'checkbox':
        case 'radio':
          await input.uncheck();
          break;
        case 'select':
          await input.selectOption('');
          break;
        default:
          await input.fill('');
      }
    }
  },

  async getFormData(page, formSelector = 'form') {
    const form = page.locator(formSelector);
    return await form.evaluate((formEl) => {
      const formData = new FormData(formEl);
      const data = {};
      
      for (const [key, value] of formData.entries()) {
        data[key] = value;
      }
      
      return data;
    });
  },

  async waitForFormValidation(page, formSelector = 'form') {
    const form = page.locator(formSelector);
    
    // Wait for validation messages to appear
    await page.waitForTimeout(500);
    
    const errors = await form.locator('.error, [role="alert"], .invalid').all();
    const errorMessages = [];
    
    for (const error of errors) {
      if (await error.isVisible()) {
        errorMessages.push(await error.textContent());
      }
    }
    
    return errorMessages;
  }
};

// Modal/Dialog helpers
export const modalHelpers = {
  async waitForModal(page, modalSelector = '[role="dialog"], .modal') {
    const modal = page.locator(modalSelector);
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    return modal;
  },

  async closeModal(page, modalSelector = '[role="dialog"], .modal') {
    const modal = page.locator(modalSelector);
    const closeButton = modal.locator('[data-testid="close"], .close, [aria-label="Close"]');
    
    if (await closeButton.isVisible({ timeout: 2000 })) {
      await closeButton.click();
    } else {
      // Try ESC key as fallback
      await page.keyboard.press('Escape');
    }
    
    await modal.waitFor({ state: 'hidden', timeout: 5000 });
  },

  async confirmDialog(page, confirmSelector = '[data-testid="confirm"], .confirm') {
    const confirmButton = page.locator(confirmSelector);
    await confirmButton.click();
    
    // Wait for dialog to disappear
    await page.waitForTimeout(500);
  },

  async cancelDialog(page, cancelSelector = '[data-testid="cancel"], .cancel') {
    const cancelButton = page.locator(cancelSelector);
    await cancelButton.click();
    
    // Wait for dialog to disappear
    await page.waitForTimeout(500);
  }
};

// Wait helpers
export const waitHelpers = {
  async waitForElement(page, selector, options = {}) {
    const { state = 'visible', timeout = 5000 } = options;
    const element = page.locator(selector);
    await element.waitFor({ state, timeout });
    return element;
  },

  async waitForText(page, selector, expectedText, timeout = 5000) {
    await page.waitForFunction(
      ({ selector, text }) => {
        const element = document.querySelector(selector);
        return element && element.textContent.includes(text);
      },
      { selector, text: expectedText },
      { timeout }
    );
  },

  async waitForUrl(page, urlPattern, timeout = 10000) {
    await page.waitForURL(urlPattern, { timeout });
  },

  async waitForNetworkIdle(page, timeout = 30000) {
    await page.waitForLoadState('networkidle', { timeout });
  },

  async waitForSpinner(page, spinnerSelector = '[data-testid="loading"], .loading, .spinner') {
    // Wait for spinner to appear
    const spinner = page.locator(spinnerSelector);
    await spinner.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
      // Spinner might not appear, which is fine
    });
    
    // Wait for spinner to disappear
    await spinner.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {
      // Spinner might not exist, which is fine
    });
  },

  async waitForApiCall(page, urlPattern, method = 'GET') {
    return await page.waitForResponse(response => {
      return response.url().match(urlPattern) && response.request().method() === method;
    });
  }
};

// Scroll helpers
export const scrollHelpers = {
  async scrollToElement(page, selector) {
    const element = page.locator(selector);
    await element.scrollIntoViewIfNeeded();
  },

  async scrollToTop(page) {
    await page.evaluate(() => window.scrollTo(0, 0));
  },

  async scrollToBottom(page) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  },

  async scrollBy(page, x, y) {
    await page.evaluate(({ x, y }) => window.scrollBy(x, y), { x, y });
  },

  async infiniteScroll(page, selector, targetCount) {
    let currentCount = 0;
    let attempts = 0;
    const maxAttempts = 20;
    
    while (currentCount < targetCount && attempts < maxAttempts) {
      currentCount = await page.locator(selector).count();
      
      if (currentCount < targetCount) {
        await this.scrollToBottom(page);
        await page.waitForTimeout(1000); // Wait for new items to load
        attempts++;
      }
    }
    
    return currentCount;
  }
};

// Table helpers
export const tableHelpers = {
  async getTableData(page, tableSelector = 'table') {
    return await page.locator(tableSelector).evaluate((table) => {
      const rows = Array.from(table.querySelectorAll('tr'));
      return rows.map(row => {
        const cells = Array.from(row.querySelectorAll('td, th'));
        return cells.map(cell => cell.textContent.trim());
      });
    });
  },

  async getRowData(page, rowIndex, tableSelector = 'table') {
    const row = page.locator(tableSelector).locator('tr').nth(rowIndex);
    return await row.evaluate((rowEl) => {
      const cells = Array.from(rowEl.querySelectorAll('td, th'));
      return cells.map(cell => cell.textContent.trim());
    });
  },

  async clickRowByText(page, text, tableSelector = 'table') {
    const row = page.locator(tableSelector).locator('tr').filter({ hasText: text });
    await row.click();
  },

  async sortTable(page, columnIndex, tableSelector = 'table') {
    const header = page.locator(tableSelector).locator('th').nth(columnIndex);
    await header.click();
    await page.waitForTimeout(500); // Wait for sort to complete
  }
};

// File upload helpers
export const uploadHelpers = {
  async uploadFile(page, inputSelector, filePath) {
    const input = page.locator(inputSelector);
    await input.setInputFiles(filePath);
  },

  async uploadMultipleFiles(page, inputSelector, filePaths) {
    const input = page.locator(inputSelector);
    await input.setInputFiles(filePaths);
  },

  async dragAndDropFile(page, filePath, dropZoneSelector) {
    // This is a simplified version - real drag and drop with files is complex
    const dropZone = page.locator(dropZoneSelector);
    
    // Simulate file drop
    await dropZone.evaluate((zone, path) => {
      const event = new DragEvent('drop', {
        bubbles: true,
        cancelable: true
      });
      
      // This would need actual file data transfer
      zone.dispatchEvent(event);
    }, filePath);
  }
};

// Search helpers
export const searchHelpers = {
  async performSearch(page, query, searchInputSelector = '[data-testid="search-input"], .search-input') {
    const searchInput = page.locator(searchInputSelector);
    await searchInput.fill(query);
    await searchInput.press('Enter');
    await page.waitForLoadState('networkidle');
  },

  async clearSearch(page, searchInputSelector = '[data-testid="search-input"], .search-input') {
    const searchInput = page.locator(searchInputSelector);
    await searchInput.fill('');
    await searchInput.press('Enter');
    await page.waitForLoadState('networkidle');
  },

  async getSearchResults(page, resultsSelector = '[data-testid="search-results"] .result-item') {
    const results = page.locator(resultsSelector);
    const count = await results.count();
    const items = [];
    
    for (let i = 0; i < count; i++) {
      const item = results.nth(i);
      items.push({
        text: await item.textContent(),
        href: await item.getAttribute('href'),
        visible: await item.isVisible()
      });
    }
    
    return items;
  },

  async filterResults(page, filterSelector, filterValue) {
    const filter = page.locator(filterSelector);
    await filter.selectOption(filterValue);
    await page.waitForLoadState('networkidle');
  }
};

// Keyboard helpers
export const keyboardHelpers = {
  async pressKey(page, key) {
    await page.keyboard.press(key);
  },

  async pressKeyCombo(page, keys) {
    await page.keyboard.press(keys.join('+'));
  },

  async typeWithDelay(page, text, delay = 100) {
    for (const char of text) {
      await page.keyboard.type(char);
      await page.waitForTimeout(delay);
    }
  },

  shortcuts: {
    save: 'Control+s',
    copy: 'Control+c',
    paste: 'Control+v',
    cut: 'Control+x',
    undo: 'Control+z',
    redo: 'Control+y',
    selectAll: 'Control+a',
    find: 'Control+f',
    newTab: 'Control+t',
    closeTab: 'Control+w',
    refresh: 'F5'
  }
};

// Drag and drop helpers
export const dragDropHelpers = {
  async dragAndDrop(page, sourceSelector, targetSelector) {
    const source = page.locator(sourceSelector);
    const target = page.locator(targetSelector);
    
    await source.dragTo(target);
  },

  async dragToPosition(page, sourceSelector, x, y) {
    const source = page.locator(sourceSelector);
    const sourceBox = await source.boundingBox();
    
    if (sourceBox) {
      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(x, y);
      await page.mouse.up();
    }
  },

  async reorderList(page, listSelector, fromIndex, toIndex) {
    const items = page.locator(listSelector).locator('> *');
    const fromItem = items.nth(fromIndex);
    const toItem = items.nth(toIndex);
    
    await fromItem.dragTo(toItem);
  }
};