import { test, expect, Page } from "@playwright/test";
import packageJson from "../../package.json" assert { type: "json" };

async function loginAndOpenAboutDialog(page: Page) {
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
  await page.route("**/api/items/tree", async (route) => {
    await route.fulfill({ json: { notesTree: [] }, status: 200 });
  });
  await page.route("**/api/auth/verify-token", async (route) => {
    await route.fulfill({
      json: { valid: true, user: { id: "123", email: "test@example.com" } },
      status: 200,
    });
  });

  await page.locator("input#email-login").fill("test@example.com");
  await page.locator("input#password-login").fill("password");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(
    page.getByRole("heading", { name: "Notes & Tasks" })
  ).toBeVisible();

  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("button", { name: "About" }).click();
}

test.describe("About Dialog", () => {
  test("should display about information and close", async ({ page }) => {
    await loginAndOpenAboutDialog(page);

    const dialogContent = page.locator(
      "div.bg-white.dark\\:bg-zinc-800.p-6.rounded.shadow-lg"
    );
    await expect(dialogContent).toBeVisible();
    await expect(
      dialogContent.getByRole("heading", { name: "About Notes & Tasks App" })
    ).toBeVisible();

    const appName = "Notes & Tasks App";
    const appVersion = packageJson.version;
    const currentYear = new Date().getFullYear().toString();

    await expect(
      dialogContent.getByRole("heading", { name: `About ${appName}` })
    ).toBeVisible();
    await expect(
      dialogContent.getByText(`${appName} © ${currentYear}`)
    ).toBeVisible();
    await expect(
      dialogContent.getByText(`Version: ${appVersion}`)
    ).toBeVisible();
    await expect(dialogContent.getByText("© TT")).toBeVisible();

    await dialogContent.getByRole("button", { name: "Close" }).click();
    await expect(dialogContent).not.toBeVisible();
  });
});
