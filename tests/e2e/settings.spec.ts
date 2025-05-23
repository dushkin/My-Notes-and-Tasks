import { test, expect, Page } from "@playwright/test";

async function loginAndOpenSettings(page: Page) {
  await page.goto("/");
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      json: {
        token: "fake-jwt-token",
        user: { id: "123", email: "test@example.com" },
      },
      status: 200,
    });
  });
  await page.route("**/api/items/tree", async (route) => {
    await route.fulfill({ json: { notesTree: [] }, status: 200 });
  });

  await page.locator("input#email-login").fill("test@example.com");
  await page.locator("input#password-login").fill("password");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(
    page.getByRole("heading", { name: "Notes & Tasks" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click(); // [cite: 1378]
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible(); // [cite: 1591]
}

test.describe("Settings Dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const initialSettings = {
        theme: "system", // [cite: 1808]
        autoExpandNewFolders: true, // [cite: 1808]
        editorFontFamily: "Arial", // [cite: 1809]
        editorFontSize: "3", // [cite: 1810]
        defaultExportFormat: "json", // [cite: 1810]
        autoExportEnabled: false, // [cite: 1810]
        autoExportIntervalMinutes: 30, // [cite: 1810]
      };
      localStorage.setItem("appSettings", JSON.stringify(initialSettings));
    });
    await loginAndOpenSettings(page);
  });

  test("should display current settings and allow theme change", async ({
    page,
  }) => {
    const themeSelect = page.locator('[data-item-id="setting-theme-select"]'); // [cite: 1560]
    await expect(themeSelect).toHaveValue("system"); // [cite: 1808]

    await themeSelect.selectOption({ label: "Dark" }); // [cite: 1560, 1803]
    await expect(themeSelect).toHaveValue("dark");
    let settingsInStorage = await page.evaluate(() =>
      localStorage.getItem("appSettings")
    );
    expect(settingsInStorage).toContain('"theme":"dark"'); // [cite: 1816]

    await themeSelect.selectOption({ label: "Light" });
    await expect(themeSelect).toHaveValue("light");
    settingsInStorage = await page.evaluate(() =>
      localStorage.getItem("appSettings")
    );
    expect(settingsInStorage).toContain('"theme":"light"');
  });

  test("should allow changing auto-expand new folders", async ({ page }) => {
    const autoExpandCheckbox = page.locator(
      '[data-item-id="setting-autoexpand-checkbox"]'
    ); // [cite: 1562]
    await expect(autoExpandCheckbox).toBeChecked(); // [cite: 1808]

    await autoExpandCheckbox.uncheck(); // [cite: 1563]
    await expect(autoExpandCheckbox).not.toBeChecked();
    let settingsInStorage = await page.evaluate(() =>
      localStorage.getItem("appSettings")
    );
    expect(settingsInStorage).toContain('"autoExpandNewFolders":false'); // [cite: 1816]

    await autoExpandCheckbox.check();
    await expect(autoExpandCheckbox).toBeChecked();
    settingsInStorage = await page.evaluate(() =>
      localStorage.getItem("appSettings")
    );
    expect(settingsInStorage).toContain('"autoExpandNewFolders":true');
  });

  test("should allow changing default editor font family", async ({ page }) => {
    const fontFamilySelect = page.locator(
      '[data-item-id="setting-fontfamily-select"]'
    ); // [cite: 1564]
    await expect(fontFamilySelect).toHaveValue("Arial"); // [cite: 1809]

    await fontFamilySelect.selectOption({ label: "Verdana" }); // [cite: 1565, 1806]
    await expect(fontFamilySelect).toHaveValue("Verdana");
    const settingsInStorage = await page.evaluate(() =>
      localStorage.getItem("appSettings")
    );
    expect(settingsInStorage).toContain('"editorFontFamily":"Verdana"');
  });

  test("should allow changing default editor font size", async ({ page }) => {
    const fontSizeSelect = page.locator(
      '[data-item-id="setting-fontsize-select"]'
    ); // [cite: 1567]
    await expect(fontSizeSelect).toHaveValue("3"); // Initial from defaultSettings [cite: 1810]

    await fontSizeSelect.selectOption({ label: "Largest" }); // [cite: 1568, 1807]
    await expect(fontSizeSelect).toHaveValue("5");
    const settingsInStorage = await page.evaluate(() =>
      localStorage.getItem("appSettings")
    );
    expect(settingsInStorage).toContain('"editorFontSize":"5"');
  });

  test("should allow changing default export format", async ({ page }) => {
    const jsonRadio = page.locator(
      '[data-item-id="setting-exportformat-json"]'
    ); // [cite: 1570]
    const pdfRadio = page.locator('[data-item-id="setting-exportformat-pdf"]'); // [cite: 1570]

    await expect(jsonRadio).toBeChecked(); // [cite: 1810]
    await expect(pdfRadio).not.toBeChecked();

    await pdfRadio.check(); // [cite: 1571]
    await expect(pdfRadio).toBeChecked();
    await expect(jsonRadio).not.toBeChecked();
    let settingsInStorage = await page.evaluate(() =>
      localStorage.getItem("appSettings")
    );
    expect(settingsInStorage).toContain('"defaultExportFormat":"pdf"');

    await jsonRadio.check();
    await expect(jsonRadio).toBeChecked();
    settingsInStorage = await page.evaluate(() =>
      localStorage.getItem("appSettings")
    );
    expect(settingsInStorage).toContain('"defaultExportFormat":"json"');
  });

  test("should allow changing auto export settings", async ({ page }) => {
    const autoExportEnabledCheckbox = page.locator(
      '[data-item-id="setting-autoexportenabled-checkbox"]'
    ); // [cite: 1574]
    const autoExportIntervalInput = page.locator(
      '[data-item-id="setting-autoexportinterval-input"]'
    ); // [cite: 1577]

    // Initially disabled
    await expect(autoExportEnabledCheckbox).not.toBeChecked(); // [cite: 1810]
    await expect(autoExportIntervalInput).toBeDisabled(); // Based on app logic [cite: 1601]

    // Enable auto export
    await autoExportEnabledCheckbox.check(); // [cite: 1575]
    await expect(autoExportEnabledCheckbox).toBeChecked();
    await expect(autoExportIntervalInput).toBeEnabled();
    let settingsInStorage = await page.evaluate(() =>
      localStorage.getItem("appSettings")
    );
    expect(settingsInStorage).toContain('"autoExportEnabled":true');

    // Change interval
    await autoExportIntervalInput.fill("15"); // [cite: 1579]
    await expect(autoExportIntervalInput).toHaveValue("15");
    settingsInStorage = await page.evaluate(() =>
      localStorage.getItem("appSettings")
    );
    expect(settingsInStorage).toContain('"autoExportIntervalMinutes":15');

    // Test min interval
    await autoExportIntervalInput.fill("3");
    await expect(autoExportIntervalInput).toHaveValue("5"); // App logic enforces min 5 [cite: 1578]
    settingsInStorage = await page.evaluate(() =>
      localStorage.getItem("appSettings")
    );
    expect(settingsInStorage).toContain('"autoExportIntervalMinutes":5');

    // Disable auto export
    await autoExportEnabledCheckbox.uncheck();
    await expect(autoExportEnabledCheckbox).not.toBeChecked();
    await expect(autoExportIntervalInput).toBeDisabled();
    settingsInStorage = await page.evaluate(() =>
      localStorage.getItem("appSettings")
    );
    expect(settingsInStorage).toContain('"autoExportEnabled":false');
  });

  test("should reset settings to default", async ({ page }) => {
    // Change a setting first
    const themeSelect = page.locator('[data-item-id="setting-theme-select"]'); // [cite: 1560]
    await themeSelect.selectOption({ label: "Dark" }); // [cite: 1560]
    await expect(themeSelect).toHaveValue("dark");

    // Handle confirmation dialog
    page.on("dialog", async (dialog) => {
      expect(dialog.message()).toBe("Reset all settings to default?"); // [cite: 1581]
      await dialog.accept();
    });

    await page.locator('[data-item-id="setting-resetsettings-button"]').click();

    // Verify theme is reset to system (default)
    await expect(themeSelect).toHaveValue("system"); // [cite: 1808]
    const settingsInStorage = await page.evaluate(() =>
      localStorage.getItem("appSettings")
    );
    const parsedSettings = JSON.parse(settingsInStorage || "{}");
    expect(parsedSettings.theme).toBe("system"); // [cite: 1808]
    expect(parsedSettings.autoExpandNewFolders).toBe(true); // [cite: 1808]
  });

  test("should reset application data after confirmation", async ({ page }) => {
    // Setup confirmation dialog handling
    let confirmDialogCount = 0;
    page.on("dialog", async (dialog) => {
      confirmDialogCount++;
      if (confirmDialogCount === 1) {
        // First confirmation for the action itself
        expect(dialog.message()).toContain(
          "WARNING: This will permanently delete all application data"
        ); // [cite: 1584]
        await dialog.accept();
      } else if (confirmDialogCount === 2) {
        // Second alert from resetApplicationData
        expect(dialog.message()).toContain(
          "Application settings have been reset."
        ); // [cite: 1821]
        await dialog.accept();
      } else {
        await dialog.dismiss(); // Should not happen
      }
    });

    await page.locator('[data-item-id="setting-resetdata-button"]').click();

    // Verify settings are reset (e.g., theme)
    const themeSelect = page.locator('[data-item-id="setting-theme-select"]'); // [cite: 1560]
    await expect(themeSelect).toHaveValue("system"); // Default theme [cite: 1808]
    const settingsInStorage = await page.evaluate(() =>
      localStorage.getItem("appSettings")
    );
    expect(JSON.parse(settingsInStorage || "{}").theme).toBe("system"); // [cite: 1808]

    // Add check for localStorage.getItem(LOCAL_STORAGE_KEY) if App.jsx handles it in resetApplicationData
    // For now, the hook only alerts and resets settings.
    expect(confirmDialogCount).toBe(2); // Ensure both dialogs were handled
  });

  test("should filter settings based on search", async ({ page }) => {
    const searchInput = page.locator('[data-item-id="settings-search-input"]'); // [cite: 1593]
    await searchInput.fill("theme");

    await expect(
      page.locator('[data-item-id="setting-row-theme"]')
    ).toBeVisible(); // [cite: 1594]
    await expect(
      page.locator('[data-item-id="setting-row-autoExpandNewFolders"]')
    ).not.toBeVisible();
    await expect(
      page.locator('[data-item-id="setting-row-editorFontFamily"]')
    ).not.toBeVisible();

    await searchInput.fill("export");
    await expect(
      page.locator('[data-item-id="setting-row-defaultExportFormat"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-item-id="setting-group-autoExportGroup"]')
    ).toBeVisible(); // [cite: 1596]
    await expect(
      page.locator('[data-item-id="setting-row-theme"]')
    ).not.toBeVisible();
  });

  test("should close settings dialog", async ({ page }) => {
    await expect(
      page.locator('[data-item-id="settings-dialog-content"]')
    ).toBeVisible(); // [cite: 1590]
    await page.getByRole("button", { name: "Close Settings" }).first().click(); // Header close button [cite: 1591, 1592]
    await expect(
      page.locator('[data-item-id="settings-dialog-content"]')
    ).not.toBeVisible();

    await page.getByRole("button", { name: "Settings" }).click(); // [cite: 1378]
    await expect(
      page.locator('[data-item-id="settings-dialog-content"]')
    ).toBeVisible();
    await page.locator('[data-item-id="settings-close-button-footer"]').click(); // Footer close button [cite: 1621]
    await expect(
      page.locator('[data-item-id="settings-dialog-content"]')
    ).not.toBeVisible();
  });
});
