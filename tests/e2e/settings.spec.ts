import { test, expect, Page } from '@playwright/test';

async function loginAndOpenSettings(page: Page) {
  await page.goto('/');
  await page.route('**/api/auth/login', async route => {
    await route.fulfill({ json: { token: 'fake-jwt-token', user: { id: '123', email: 'test@example.com'} }, status: 200 });
  });
  await page.route('**/api/items/tree', async route => {
    await route.fulfill({ json: { notesTree: [] }, status: 200 });
  });

  await page.locator('input#email-login').fill('test@example.com');
  await page.locator('input#password-login').fill('password');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('heading', { name: 'Notes & Tasks' })).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).click(); // [cite: 1409]
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible(); // [cite: 322]
}

test.describe('Settings Dialog', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept localStorage reads for 'appSettings' to provide a consistent initial state
    await page.addInitScript(() => {
      const initialSettings = {
        theme: "system", // [cite: 539]
        autoExpandNewFolders: true, // [cite: 539]
        editorFontFamily: "Arial", // [cite: 540]
        editorFontSize: "3", // [cite: 541]
        defaultExportFormat: "json", // [cite: 541]
        autoExportEnabled: false, // [cite: 541]
        autoExportIntervalMinutes: 30, // [cite: 541]
      };
      localStorage.setItem('appSettings', JSON.stringify(initialSettings));
    });
    await loginAndOpenSettings(page);
  });

  test('should display current settings and allow theme change', async ({ page }) => {
    // Check initial theme (system)
    const themeSelect = page.locator('[data-item-id="setting-theme-select"]'); // [cite: 291]
    await expect(themeSelect).toHaveValue('system'); // [cite: 539]

    // Change theme to Dark
    await themeSelect.selectOption({ label: 'Dark' }); // [cite: 290, 292, 534]
    await expect(themeSelect).toHaveValue('dark');

    // Verify localStorage update (Playwright can't directly check document.documentElement.className easily)
    const settingsInStorage = await page.evaluate(() => localStorage.getItem('appSettings'));
    expect(settingsInStorage).toContain('"theme":"dark"'); // [cite: 547]

    // Change theme to Light
    await themeSelect.selectOption({ label: 'Light' });
    await expect(themeSelect).toHaveValue('light');
    const settingsInStorageLight = await page.evaluate(() => localStorage.getItem('appSettings'));
    expect(settingsInStorageLight).toContain('"theme":"light"');
  });

  test('should allow changing auto-expand new folders', async ({ page }) => {
    const autoExpandCheckbox = page.locator('[data-item-id="setting-autoexpand-checkbox"]'); // [cite: 293]
    await expect(autoExpandCheckbox).toBeChecked(); // Initial from defaultSettings [cite: 539]

    await autoExpandCheckbox.uncheck(); // [cite: 293]
    await expect(autoExpandCheckbox).not.toBeChecked();
    let settingsInStorage = await page.evaluate(() => localStorage.getItem('appSettings'));
    expect(settingsInStorage).toContain('"autoExpandNewFolders":false'); // [cite: 547]

    await autoExpandCheckbox.check();
    await expect(autoExpandCheckbox).toBeChecked();
    settingsInStorage = await page.evaluate(() => localStorage.getItem('appSettings'));
    expect(settingsInStorage).toContain('"autoExpandNewFolders":true');
  });

  test('should allow changing default editor font family', async ({ page }) => {
    const fontFamilySelect = page.locator('[data-item-id="setting-fontfamily-select"]'); // [cite: 295]
    await expect(fontFamilySelect).toHaveValue('Arial'); // Initial from defaultSettings [cite: 539, 540]

    await fontFamilySelect.selectOption({ label: 'Verdana' }); // [cite: 295, 296, 537]
    await expect(fontFamilySelect).toHaveValue('Verdana');
    const settingsInStorage = await page.evaluate(() => localStorage.getItem('appSettings'));
    expect(settingsInStorage).toContain('"editorFontFamily":"Verdana"');
  });


  test('should allow changing default export format', async ({ page }) => {
    const jsonRadio = page.locator('[data-item-id="setting-exportformat-json"]'); // [cite: 301]
    const pdfRadio = page.locator('[data-item-id="setting-exportformat-pdf"]'); // [cite: 301]

    await expect(jsonRadio).toBeChecked(); // Initial default [cite: 541]
    await expect(pdfRadio).not.toBeChecked();

    await pdfRadio.check(); // [cite: 302]
    await expect(pdfRadio).toBeChecked();
    await expect(jsonRadio).not.toBeChecked();
    let settingsInStorage = await page.evaluate(() => localStorage.getItem('appSettings'));
    expect(settingsInStorage).toContain('"defaultExportFormat":"pdf"');

    await jsonRadio.check();
    await expect(jsonRadio).toBeChecked();
    settingsInStorage = await page.evaluate(() => localStorage.getItem('appSettings'));
    expect(settingsInStorage).toContain('"defaultExportFormat":"json"');
  });


  test('should filter settings based on search', async ({ page }) => {
    const searchInput = page.locator('[data-item-id="settings-search-input"]'); // [cite: 324]
    await searchInput.fill('theme');

    await expect(page.locator('[data-item-id="setting-row-theme"]')).toBeVisible(); // [cite: 343]
    await expect(page.locator('[data-item-id="setting-row-autoExpandNewFolders"]')).not.toBeVisible();
    await expect(page.locator('[data-item-id="setting-row-editorFontFamily"]')).not.toBeVisible();

    await searchInput.fill('export');
    await expect(page.locator('[data-item-id="setting-row-defaultExportFormat"]')).toBeVisible();
    await expect(page.locator('[data-item-id="setting-group-autoExportGroup"]')).toBeVisible(); // [cite: 326]
    await expect(page.locator('[data-item-id="setting-row-theme"]')).not.toBeVisible();
  });


  test('should close settings dialog', async ({ page }) => {
    await expect(page.locator('[data-item-id="settings-dialog-content"]')).toBeVisible(); // [cite: 321]
    await page.getByRole('button', { name: 'Close Settings' }).first().click(); // Header close button [cite: 322, 323]
    await expect(page.locator('[data-item-id="settings-dialog-content"]')).not.toBeVisible();

    // Reopen
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.locator('[data-item-id="settings-dialog-content"]')).toBeVisible();
    await page.locator('[data-item-id="settings-close-button-footer"]').click(); // Footer close button [cite: 352]
    await expect(page.locator('[data-item-id="settings-dialog-content"]')).not.toBeVisible();
  });

});