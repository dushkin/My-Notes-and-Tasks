import { test, expect, Page } from "@playwright/test";
// Corrected import for JSON modules in ESM for Playwright tests
import packageJson from "../../package.json" assert { type: "json" };

async function loginAndOpenAboutDialog(page: Page) {
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

  // Open "More actions" menu then "About"
  await page.getByRole("button", { name: "More actions" }).click(); // [cite: 1037]
  await page.getByRole("button", { name: "About" }).click(); // [cite: 1046]
}

test.describe("About Dialog", () => {
  test("should display about information and close", async ({ page }) => {
    await loginAndOpenAboutDialog(page);

    const dialog = page.locator('div[role="dialog"]', { // Assuming the dialog has a role="dialog"
      hasText: "About Notes & Tasks App",
    }); 
    // Check visibility using a more robust method if the role isn't consistently set
    // For example, checking based on a unique class or data-item-id of the dialog container
    // The existing fallback is reasonable if the primary locator is flaky.
    if (!(await dialog.isVisible())) {
      await expect(
        page
          .locator(".fixed.inset-0.bg-black.bg-opacity-50") // This selector points to the overlay
          .filter({ hasText: "About Notes & Tasks App" }) // This filter would apply to the overlay, not the dialog content directly
          .locator('> div.bg-white') // Assuming the dialog content is a direct child div with bg-white
      ).toBeVisible();
    } else {
      await expect(dialog).toBeVisible();
    }

    const appName = "Notes & Tasks App"; // [cite: 3]
    const appVersion = packageJson.version; 
    const currentYear = new Date().getFullYear().toString(); // [cite: 4]

    await expect(
      page.getByRole("heading", { name: `About ${appName}` })
    ).toBeVisible(); // [cite: 5]
    await expect(page.getByText(`${appName} © ${currentYear}`)).toBeVisible(); // [cite: 5]
    await expect(page.getByText(`Version: ${appVersion}`)).toBeVisible(); // [cite: 5]
    await expect(page.getByText("© TT")).toBeVisible(); // [cite: 5]

    // Close dialog
    await page.getByRole("button", { name: "Close" }).click(); // [cite: 6]
    
    // Check dialog is not visible
    // Re-using the more specific content container if the role="dialog" on the overlay was problematic
    if (await page.locator('.fixed.inset-0.bg-black.bg-opacity-50 > div.bg-white', { hasText: "About Notes & Tasks App"}).isVisible({ timeout: 500 }).catch(() => false)) {
      await expect(
        page
          .locator(".fixed.inset-0.bg-black.bg-opacity-50")
          .filter({ hasText: "About Notes & Tasks App" })
          .locator('> div.bg-white')
      ).not.toBeVisible();
    } else {
      await expect(dialog).not.toBeVisible();
    }
  });
});