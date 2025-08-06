/**
 * Custom assertion helpers for Playwright tests
 * Provides reusable patterns for common test assertions
 */

import { expect } from '@playwright/test';

// Element visibility assertions
export const visibilityAssertions = {
  async expectVisible(page, selector, timeout = 5000) {
    const element = page.locator(selector);
    await expect(element).toBeVisible({ timeout });
  },

  async expectHidden(page, selector, timeout = 5000) {
    const element = page.locator(selector);
    await expect(element).toBeHidden({ timeout });
  },

  async expectElementCount(page, selector, expectedCount, timeout = 5000) {
    const elements = page.locator(selector);
    await expect(elements).toHaveCount(expectedCount, { timeout });
  },

  async expectAtLeastOneVisible(page, selectors) {
    let isAnyVisible = false;
    
    for (const selector of selectors) {
      const element = page.locator(selector);
      if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
        isAnyVisible = true;
        break;
      }
    }
    
    if (!isAnyVisible) {
      throw new Error(`None of the elements are visible: ${selectors.join(', ')}`);
    }
  }
};

// Text content assertions
export const textAssertions = {
  async expectText(page, selector, expectedText, options = {}) {
    const { exact = false, timeout = 5000 } = options;
    const element = page.locator(selector);
    
    if (exact) {
      await expect(element).toHaveText(expectedText, { timeout });
    } else {
      await expect(element).toContainText(expectedText, { timeout });
    }
  },

  async expectTexts(page, selector, expectedTexts, timeout = 5000) {
    const elements = page.locator(selector);
    await expect(elements).toHaveText(expectedTexts, { timeout });
  },

  async expectTextNotPresent(page, selector, forbiddenText, timeout = 5000) {
    const element = page.locator(selector);
    await expect(element).not.toContainText(forbiddenText, { timeout });
  },

  async expectEmptyText(page, selector, timeout = 5000) {
    const element = page.locator(selector);
    await expect(element).toHaveText('', { timeout });
  },

  async expectTextPattern(page, selector, pattern, timeout = 5000) {
    const element = page.locator(selector);
    const text = await element.textContent({ timeout });
    
    if (!pattern.test(text)) {
      throw new Error(`Text "${text}" does not match pattern ${pattern}`);
    }
  }
};

// Form assertions
export const formAssertions = {
  async expectFormValue(page, selector, expectedValue, timeout = 5000) {
    const element = page.locator(selector);
    await expect(element).toHaveValue(expectedValue, { timeout });
  },

  async expectCheckboxChecked(page, selector, timeout = 5000) {
    const element = page.locator(selector);
    await expect(element).toBeChecked({ timeout });
  },

  async expectCheckboxUnchecked(page, selector, timeout = 5000) {
    const element = page.locator(selector);
    await expect(element).not.toBeChecked({ timeout });
  },

  async expectSelectValue(page, selector, expectedValue, timeout = 5000) {
    const element = page.locator(selector);
    await expect(element).toHaveValue(expectedValue, { timeout });
  },

  async expectFormDisabled(page, formSelector = 'form', timeout = 5000) {
    const form = page.locator(formSelector);
    const inputs = form.locator('input, select, textarea, button');
    const count = await inputs.count();
    
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      await expect(input).toBeDisabled({ timeout });
    }
  },

  async expectFormEnabled(page, formSelector = 'form', timeout = 5000) {
    const form = page.locator(formSelector);
    const inputs = form.locator('input, select, textarea, button');
    const count = await inputs.count();
    
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      await expect(input).toBeEnabled({ timeout });
    }
  },

  async expectValidationError(page, fieldSelector, expectedError, timeout = 5000) {
    // Look for error message near the field
    const field = page.locator(fieldSelector);
    const errorSelectors = [
      `${fieldSelector} + .error`,
      `${fieldSelector} ~ .error`,
      `[data-testid="${fieldSelector}-error"]`,
      `[aria-describedby="${await field.getAttribute('aria-describedby')}"]`
    ];
    
    let errorFound = false;
    for (const selector of errorSelectors) {
      try {
        const errorElement = page.locator(selector);
        if (await errorElement.isVisible({ timeout: 1000 })) {
          await expect(errorElement).toContainText(expectedError, { timeout });
          errorFound = true;
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (!errorFound) {
      throw new Error(`Validation error "${expectedError}" not found for field ${fieldSelector}`);
    }
  }
};

// URL and navigation assertions
export const navigationAssertions = {
  async expectUrl(page, expectedUrl, timeout = 10000) {
    await expect(page).toHaveURL(expectedUrl, { timeout });
  },

  async expectUrlContains(page, urlPart, timeout = 10000) {
    await expect(page).toHaveURL(new RegExp(urlPart), { timeout });
  },

  async expectTitle(page, expectedTitle, timeout = 5000) {
    await expect(page).toHaveTitle(expectedTitle, { timeout });
  },

  async expectTitleContains(page, titlePart, timeout = 5000) {
    await expect(page).toHaveTitle(new RegExp(titlePart), { timeout });
  }
};

// State assertions
export const stateAssertions = {
  async expectEnabled(page, selector, timeout = 5000) {
    const element = page.locator(selector);
    await expect(element).toBeEnabled({ timeout });
  },

  async expectDisabled(page, selector, timeout = 5000) {
    const element = page.locator(selector);
    await expect(element).toBeDisabled({ timeout });
  },

  async expectFocused(page, selector, timeout = 5000) {
    const element = page.locator(selector);
    await expect(element).toBeFocused({ timeout });
  },

  async expectNotFocused(page, selector, timeout = 5000) {
    const element = page.locator(selector);
    await expect(element).not.toBeFocused({ timeout });
  },

  async expectHasClass(page, selector, className, timeout = 5000) {
    const element = page.locator(selector);
    await expect(element).toHaveClass(new RegExp(className), { timeout });
  },

  async expectNotHasClass(page, selector, className, timeout = 5000) {
    const element = page.locator(selector);
    await expect(element).not.toHaveClass(new RegExp(className), { timeout });
  },

  async expectAttribute(page, selector, attributeName, expectedValue, timeout = 5000) {
    const element = page.locator(selector);
    await expect(element).toHaveAttribute(attributeName, expectedValue, { timeout });
  },

  async expectAttributeContains(page, selector, attributeName, expectedValue, timeout = 5000) {
    const element = page.locator(selector);
    await expect(element).toHaveAttribute(attributeName, new RegExp(expectedValue), { timeout });
  }
};

// List and table assertions
export const listAssertions = {
  async expectListOrder(page, listSelector, expectedItems) {
    const items = page.locator(listSelector).locator('> *');
    const actualTexts = await items.allTextContents();
    
    expect(actualTexts).toEqual(expectedItems);
  },

  async expectListContains(page, listSelector, expectedItem) {
    const items = page.locator(listSelector).locator('> *');
    const itemsWithText = items.filter({ hasText: expectedItem });
    await expect(itemsWithText).toHaveCount(1, { timeout: 5000 });
  },

  async expectListNotContains(page, listSelector, forbiddenItem) {
    const items = page.locator(listSelector).locator('> *');
    const itemsWithText = items.filter({ hasText: forbiddenItem });
    await expect(itemsWithText).toHaveCount(0, { timeout: 5000 });
  },

  async expectTableRow(page, tableSelector, rowIndex, expectedData) {
    const row = page.locator(tableSelector).locator('tr').nth(rowIndex);
    const cells = row.locator('td, th');
    
    for (let i = 0; i < expectedData.length; i++) {
      const cell = cells.nth(i);
      await expect(cell).toContainText(expectedData[i]);
    }
  },

  async expectTableColumn(page, tableSelector, columnIndex, expectedData) {
    const table = page.locator(tableSelector);
    const cells = table.locator(`tr td:nth-child(${columnIndex + 1}), tr th:nth-child(${columnIndex + 1})`);
    
    await expect(cells).toHaveText(expectedData);
  }
};

// Content assertions
export const contentAssertions = {
  async expectContentLoaded(page, contentSelector = 'main, .content, [role="main"]') {
    const content = page.locator(contentSelector);
    await expect(content).toBeVisible();
    
    // Ensure content is not empty
    const text = await content.textContent();
    expect(text.trim().length).toBeGreaterThan(0);
  },

  async expectNoContent(page, contentSelector = 'main, .content, [role="main"]') {
    const content = page.locator(contentSelector);
    const text = await content.textContent();
    expect(text.trim().length).toBe(0);
  },

  async expectImageLoaded(page, imgSelector) {
    const img = page.locator(imgSelector);
    await expect(img).toBeVisible();
    
    // Check if image actually loaded
    const isLoaded = await img.evaluate((imgEl) => {
      return imgEl.complete && imgEl.naturalHeight !== 0;
    });
    
    expect(isLoaded).toBe(true);
  },

  async expectVideoCanPlay(page, videoSelector) {
    const video = page.locator(videoSelector);
    await expect(video).toBeVisible();
    
    const canPlay = await video.evaluate((videoEl) => {
      return videoEl.readyState >= 3; // HAVE_FUTURE_DATA
    });
    
    expect(canPlay).toBe(true);
  }
};

// Error and message assertions
export const messageAssertions = {
  async expectSuccessMessage(page, expectedMessage, timeout = 5000) {
    const successSelectors = [
      '[data-testid="success-message"]',
      '.success-message',
      '.alert-success',
      '[role="alert"].success'
    ];
    
    for (const selector of successSelectors) {
      const element = page.locator(selector);
      if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(element).toContainText(expectedMessage, { timeout });
        return;
      }
    }
    
    throw new Error(`Success message "${expectedMessage}" not found`);
  },

  async expectErrorMessage(page, expectedMessage, timeout = 5000) {
    const errorSelectors = [
      '[data-testid="error-message"]',
      '.error-message',
      '.alert-error',
      '[role="alert"].error'
    ];
    
    for (const selector of errorSelectors) {
      const element = page.locator(selector);
      if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(element).toContainText(expectedMessage, { timeout });
        return;
      }
    }
    
    throw new Error(`Error message "${expectedMessage}" not found`);
  },

  async expectWarningMessage(page, expectedMessage, timeout = 5000) {
    const warningSelectors = [
      '[data-testid="warning-message"]',
      '.warning-message',
      '.alert-warning',
      '[role="alert"].warning'
    ];
    
    for (const selector of warningSelectors) {
      const element = page.locator(selector);
      if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(element).toContainText(expectedMessage, { timeout });
        return;
      }
    }
    
    throw new Error(`Warning message "${expectedMessage}" not found`);
  },

  async expectNoMessages(page) {
    const messageSelectors = [
      '[data-testid$="-message"]',
      '.alert',
      '[role="alert"]',
      '.notification'
    ];
    
    for (const selector of messageSelectors) {
      const elements = page.locator(selector);
      const count = await elements.count();
      
      if (count > 0) {
        const visibleCount = await elements.evaluateAll(els => 
          els.filter(el => el.offsetParent !== null).length
        );
        
        expect(visibleCount).toBe(0);
      }
    }
  }
};

// Performance assertions
export const performanceAssertions = {
  async expectPageLoadTime(page, maxLoadTime = 3000) {
    const loadTime = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return navigation.loadEventEnd - navigation.loadEventStart;
    });
    
    expect(loadTime).toBeLessThan(maxLoadTime);
  },

  async expectFirstContentfulPaint(page, maxTime = 2000) {
    const fcp = await page.evaluate(() => {
      const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
      return fcpEntry ? fcpEntry.startTime : 0;
    });
    
    expect(fcp).toBeLessThan(maxTime);
  },

  async expectNoSlowRequests(page, maxTime = 5000) {
    const slowRequests = await page.evaluate((maxTime) => {
      return performance.getEntriesByType('resource')
        .filter(entry => entry.duration > maxTime)
        .map(entry => ({ name: entry.name, duration: entry.duration }));
    }, maxTime);
    
    expect(slowRequests).toHaveLength(0);
  }
};

// Accessibility assertions
export const a11yAssertions = {
  async expectProperHeadingStructure(page) {
    const headings = await page.evaluate(() => {
      const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      return Array.from(headingElements).map(h => ({
        level: parseInt(h.tagName.charAt(1)),
        text: h.textContent.trim()
      }));
    });
    
    // Check that headings follow proper hierarchy
    let previousLevel = 0;
    for (const heading of headings) {
      if (heading.level > previousLevel + 1) {
        throw new Error(`Heading level jumps from h${previousLevel} to h${heading.level}: "${heading.text}"`);
      }
      previousLevel = heading.level;
    }
  },

  async expectAriaLabels(page, selector) {
    const elements = page.locator(selector);
    const count = await elements.count();
    
    for (let i = 0; i < count; i++) {
      const element = elements.nth(i);
      const hasLabel = await element.evaluate(el => {
        return el.getAttribute('aria-label') || 
               el.getAttribute('aria-labelledby') ||
               el.textContent.trim() ||
               el.getAttribute('title');
      });
      
      if (!hasLabel) {
        const tagName = await element.evaluate(el => el.tagName);
        throw new Error(`${tagName} element missing accessible label`);
      }
    }
  },

  async expectKeyboardNavigation(page, interactiveSelector = 'button, input, select, textarea, a[href], [tabindex]') {
    const elements = page.locator(interactiveSelector);
    const count = await elements.count();
    
    if (count === 0) return;
    
    // Start from first element
    await elements.first().focus();
    
    // Tab through all elements
    for (let i = 1; i < count; i++) {
      await page.keyboard.press('Tab');
      
      const focusedElement = page.locator(':focus');
      const isFocused = await elements.nth(i).evaluate((el, focusedEl) => {
        return el === focusedEl;
      }, await focusedElement.elementHandle());
      
      if (!isFocused) {
        throw new Error(`Keyboard navigation broken at element ${i}`);
      }
    }
  }
};

// Custom matchers for common patterns
export const customMatchers = {
  async expectToBeInViewport(page, selector) {
    const element = page.locator(selector);
    const boundingBox = await element.boundingBox();
    const viewport = page.viewportSize();
    
    expect(boundingBox).not.toBeNull();
    expect(boundingBox.x).toBeGreaterThanOrEqual(0);
    expect(boundingBox.y).toBeGreaterThanOrEqual(0);
    expect(boundingBox.x + boundingBox.width).toBeLessThanOrEqual(viewport.width);
    expect(boundingBox.y + boundingBox.height).toBeLessThanOrEqual(viewport.height);
  },

  async expectToHaveValidationError(page, fieldSelector, expectedError) {
    await formAssertions.expectValidationError(page, fieldSelector, expectedError);
  },

  async expectToLoadWithinTime(page, maxTime = 3000) {
    const startTime = Date.now();
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(maxTime);
  }
};