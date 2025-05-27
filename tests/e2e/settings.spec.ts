import { test, expect, Page } from "@playwright/test";

async function loginAndOpenSettings(page: Page) {
  await page.goto("/");
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      json: {
        accessToken: "fake-jwt-token",
        refreshToken: "fake-refresh-token",
        user: { id: "123", email: "test@example.com" },
      },
      status: 200,
    });
  });
  await page.route("**/api/auth/verify-token", async (route) => {
    await route.fulfill({
      json: { valid: true, user: { id: "123", email: "test@example.com" } },
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

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(
    page.getByRole("heading", { name: "Settings" }).first()
  ).toBeVisible();
}

test.describe("Settings Dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const initialSettings = {
        theme: "system",
        autoExpandNewFolders: true,
        editorFontFamily: "Arial",
        editorFontSize: "3",
        defaultExportFormat: "json",
        autoExportEnabled: false,
        autoExportIntervalMinutes: 30,
      };
      localStorage.setItem("appSettings", JSON.stringify(initialSettings));
    });
    await loginAndOpenSettings(page);
  });

  test("should display current settings and allow theme change", async ({
    page,
  }) => {
    const themeSelect = page.locator('[data-item-id="setting-theme-select"]');
    await expect(themeSelect).toHaveValue("system");

    await themeSelect.selectOption({ label: "Dark" });
    await expect(themeSelect).toHaveValue("dark");
    let settingsInStorage = await page.evaluate(() =>
      localStorage.getItem("appSettings")
    );
    expect(JSON.parse(settingsInStorage || "{}").theme).toBe("dark");

    await themeSelect.selectOption({ label: "Light" });
    await expect(themeSelect).toHaveValue("light");
    settingsInStorage = await page.evaluate(() =>
      localStorage.getItem("appSettings")
    );
    expect(JSON.parse(settingsInStorage || "{}").theme).toBe("light");
  });

  test("should allow changing auto-expand new folders", async ({ page }) => {
    const autoExpandCheckbox = page.locator(
      '[data-item-id="setting-autoexpand-checkbox"]'
    );
    await expect(autoExpandCheckbox).toBeChecked();

    await autoExpandCheckbox.uncheck();
    await expect(autoExpandCheckbox).not.toBeChecked();
    let settingsInStorage = await page.evaluate(() =>
      localStorage.getItem("appSettings")
    );
    expect(JSON.parse(settingsInStorage || "{}").autoExpandNewFolders).toBe(
      false
    );

    await autoExpandCheckbox.check();
    await expect(autoExpandCheckbox).toBeChecked();
    settingsInStorage = await page.evaluate(() =>
      localStorage.getItem("appSettings")
    );
    expect(JSON.parse(settingsInStorage || "{}").autoExpandNewFolders).toBe(
      true
    );
  });

  test("should allow changing default editor font family", async ({ page }) => {
    const fontFamilySelect = page.locator(
      '[data-item-id="setting-fontfamily-select"]'
    );
    await expect(fontFamilySelect).toHaveValue("Arial");

    await fontFamilySelect.selectOption({ label: "Verdana" });
    await expect(fontFamilySelect).toHaveValue("Verdana");
    const settingsInStorage = await page.evaluate(() =>
      localStorage.getItem("appSettings")
    );
    expect(JSON.parse(settingsInStorage || "{}").editorFontFamily).toBe(
      "Verdana"
    );
  });

  test("should allow changing default editor font size", async ({ page }) => {
    const fontSizeSelect = page.locator(
      '[data-item-id="setting-fontsize-select"]'
    );
    await expect(fontSizeSelect).toHaveValue("3");

    await fontSizeSelect.selectOption({ label: "Largest" });
    await expect(fontSizeSelect).toHaveValue("5");
    const settingsInStorage = await page.evaluate(() =>
      localStorage.getItem("appSettings")
    );
    expect(JSON.parse(settingsInStorage || "{}").editorFontSize).toBe("5");
  });

  test("should allow changing default export format", async ({ page }) => {
    const jsonRadio = page.locator(
      '[data-item-id="setting-exportformat-json"]'
    );
    const pdfRadio = page.locator('[data-item-id="setting-exportformat-pdf"]');

    await expect(jsonRadio).toBeChecked();
    await expect(pdfRadio).not.toBeChecked();

    await pdfRadio.check();
    await expect(pdfRadio).toBeChecked();
    await expect(jsonRadio).not.toBeChecked();
    let settingsInStorage = await page.evaluate(() =>
      localStorage.getItem("appSettings")
    );
    expect(JSON.parse(settingsInStorage || "{}").defaultExportFormat).toBe(
      "pdf"
    );

    await jsonRadio.check();
    await expect(jsonRadio).toBeChecked();
    settingsInStorage = await page.evaluate(() =>
      localStorage.getItem("appSettings")
    );
    expect(JSON.parse(settingsInStorage || "{}").defaultExportFormat).toBe(
      "json"
    );
  });

  test("should allow changing auto export settings", async ({ page }) => {
    const autoExportEnabledCheckbox = page.locator(
      '[data-item-id="setting-autoexportenabled-checkbox"]'
    );
    const autoExportIntervalInput = page.locator(
      '[data-item-id="setting-autoexportinterval-input"]'
    );

    await expect(autoExportEnabledCheckbox).not.toBeChecked();
    await expect(autoExportIntervalInput).toBeDisabled();

    await autoExportEnabledCheckbox.check();
    await expect(autoExportEnabledCheckbox).toBeChecked();
    await expect(autoExportIntervalInput).toBeEnabled();
    let settingsInStorage = await page.evaluate(() =>
      localStorage.getItem("appSettings")
    );
    expect(JSON.parse(settingsInStorage || "{}").autoExportEnabled).toBe(true);

    await autoExportIntervalInput.fill("15");
    await expect(autoExportIntervalInput).toHaveValue("15");
    settingsInStorage = await page.evaluate(() =>
      localStorage.getItem("appSettings")
    );
    expect(
      JSON.parse(settingsInStorage || "{}").autoExportIntervalMinutes
    ).toBe(15);

    await autoExportIntervalInput.fill("3");
    await expect(autoExportIntervalInput).toHaveValue("5"); // App logic enforces min 5
    settingsInStorage = await page.evaluate(() =>
      localStorage.getItem("appSettings")
    );
    expect(
      JSON.parse(settingsInStorage || "{}").autoExportIntervalMinutes
    ).toBe(5);

    await autoExportEnabledCheckbox.uncheck();
    await expect(autoExportEnabledCheckbox).not.toBeChecked();
    await expect(autoExportIntervalInput).toBeDisabled();
    settingsInStorage = await page.evaluate(() =>
      localStorage.getItem("appSettings")
    );
    expect(JSON.parse(settingsInStorage || "{}").autoExportEnabled).toBe(false);
  });

  test("should reset settings to default", async ({ page }) => {
    const themeSelect = page.locator('[data-item-id="setting-theme-select"]');
    await themeSelect.selectOption({ label: "Dark" });
    await expect(themeSelect).toHaveValue("dark");

    page.on("dialog", async (dialog) => {
      expect(dialog.message()).toBe("Reset all settings to default?");
      await dialog.accept();
    });

    await page.locator('[data-item-id="setting-resetsettings-button"]').click();

    await expect(themeSelect).toHaveValue("system");
    const settingsInStorage = await page.evaluate(() =>
      localStorage.getItem("appSettings")
    );
    const parsedSettings = JSON.parse(settingsInStorage || "{}");
    expect(parsedSettings.theme).toBe("system");
    expect(parsedSettings.autoExpandNewFolders).toBe(true);
    expect(parsedSettings.editorFontFamily).toBe("Arial");
  });

  test("should reset application data after confirmation", async ({ page }) => {
    let confirmDialogCount = 0;
    page.on("dialog", async (dialog) => {
      confirmDialogCount++;
      if (confirmDialogCount === 1) {
        expect(dialog.message()).toContain(
          "WARNING: This will permanently delete all application data"
        );
        await dialog.accept();
      } else if (confirmDialogCount === 2) {
        expect(dialog.message()).toContain(
          "Application settings have been reset."
        );
        await dialog.accept();
      } else {
        await dialog.dismiss();
      }
    });

    await page.locator('[data-item-id="setting-resetdata-button"]').click();
    await page.waitForFunction(() =>
      window.localStorage.getItem("appSettings")?.includes('"theme":"system"')
    );

    const themeSelect = page.locator('[data-item-id="setting-theme-select"]');
    await expect(themeSelect).toHaveValue("system");
    const settingsInStorage = await page.evaluate(() =>
      localStorage.getItem("appSettings")
    );
    expect(JSON.parse(settingsInStorage || "{}").theme).toBe("system");
    expect(confirmDialogCount).toBe(2);
  });

  test("should filter settings based on search", async ({ page }) => {
    const searchInput = page.locator('[data-item-id="settings-search-input"]');
    await searchInput.fill("theme");

    await expect(
      page.locator('[data-item-id="setting-row-theme"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-item-id="setting-row-autoExpandNewFolders"]')
    ).not.toBeVisible();

    await searchInput.fill("export");
    await expect(
      page.locator('[data-item-id="setting-row-defaultExportFormat"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-item-id="setting-group-autoExportGroup"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-item-id="setting-row-theme"]')
    ).not.toBeVisible();
  });

  test("should close settings dialog", async ({ page }) => {
    const settingsDialogContent = page.locator(
      '[data-item-id="settings-dialog-content"]'
    );
    await expect(settingsDialogContent).toBeVisible();

    await page.locator('[data-item-id="settings-close-button-header"]').click();
    await expect(settingsDialogContent).not.toBeVisible();

    await page.getByRole("button", { name: "Settings" }).click();
    await expect(settingsDialogContent).toBeVisible();
    await page.locator('[data-item-id="settings-close-button-footer"]').click();
    await expect(settingsDialogContent).not.toBeVisible();
  });
});
