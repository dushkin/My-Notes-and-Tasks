import { test, expect, Page } from "@playwright/test";

const TEST_USER_EMAIL = `testuser_${Date.now()}@example.com`;
const TEST_USER_PASSWORD = "TestPassword123!";

async function registerUser(page: Page, email: string, password: string) {
  await page.getByRole("button", { name: "Create one" }).click();
  await expect(
    page.getByRole("heading", { name: "Create Account" })
  ).toBeVisible();

  await page.locator("input#email-register").fill(email);
  await page.locator("input#password-register").fill(password);
  await page.locator("input#confirmPassword-register").fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();
}

async function loginUser(page: Page, email: string, password: string) {
  await expect(
    page.getByRole("heading", { name: "Login to Notes & Tasks" })
  ).toBeVisible();
  await page.locator("input#email-login").fill(email);
  await page.locator("input#password-login").fill(password);
  await page.getByRole("button", { name: "Login" }).click();
}

test.describe("Authentication", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should allow a user to register", async ({ page }) => {
    await page.route("**/api/auth/register", async (route) => {
      const json = { message: "User registered successfully" };
      await route.fulfill({ json, status: 201 });
    });

    const dialogPromise = page.waitForEvent("dialog");
    await registerUser(page, TEST_USER_EMAIL, TEST_USER_PASSWORD);
    const dialog = await dialogPromise;
    expect(dialog.message()).toContain(
      "Registration successful! Please log in."
    );
    await dialog.accept();

    await expect(
      page.getByRole("heading", { name: "Login to Notes & Tasks" })
    ).toBeVisible();
  });

  test("should show error if registration passwords do not match", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Create one" }).click();
    await page.locator("input#email-register").fill(TEST_USER_EMAIL);
    await page.locator("input#password-register").fill(TEST_USER_PASSWORD);
    await page.locator("input#confirmPassword-register").fill("wrongpassword");
    await page.getByRole("button", { name: "Create Account" }).click();

    const errorMessageLocator = page.locator(
      '[data-item-id="register-error-message"]'
    );
    await expect(errorMessageLocator).toBeVisible();
    await expect(errorMessageLocator).toHaveText("Passwords do not match.");
  });

  test("should show error if registration fields are empty", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Create one" }).click();
    await page.locator("input#email-register").fill(""); // Empty email
    await page.locator("input#password-register").fill(TEST_USER_PASSWORD);
    await page
      .locator("input#confirmPassword-register")
      .fill(TEST_USER_PASSWORD);
    await page.getByRole("button", { name: "Create Account" }).click();

    const errorMessageLocator = page.locator(
      '[data-item-id="register-error-message"]'
    );
    await expect(errorMessageLocator).toBeVisible();
    await expect(errorMessageLocator).toHaveText("Please fill in all fields.");
  });

  test("should allow a registered user to login and see the main app", async ({
    page,
  }) => {
    await page.route("**/api/auth/login", async (route) => {
      const json = {
        accessToken: "fake-jwt-token",
        refreshToken: "fake-refresh-token",
        user: { email: TEST_USER_EMAIL, id: "123" },
      };
      await route.fulfill({ json, status: 200 });
    });
    await page.route("**/api/auth/verify-token", async (route) => {
      await route.fulfill({
        json: { valid: true, user: { id: "123", email: TEST_USER_EMAIL } },
        status: 200,
      });
    });
    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({ json: { notesTree: [] }, status: 200 });
    });

    await loginUser(page, TEST_USER_EMAIL, TEST_USER_PASSWORD);

    await expect(
      page.getByRole("heading", { name: "Notes & Tasks" })
    ).toBeVisible();
    const accessToken = await page.evaluate(() =>
      localStorage.getItem("accessToken")
    );
    expect(accessToken).toBe("fake-jwt-token");
    const refreshToken = await page.evaluate(() =>
      localStorage.getItem("refreshToken")
    );
    expect(refreshToken).toBe("fake-refresh-token");
  });

  test("should show error if login fields are empty", async ({ page }) => {
    await loginUser(page, "", "");
    const errorMessageLocator = page.locator(
      '[data-item-id="login-error-message"]'
    );
    await expect(errorMessageLocator).toBeVisible();
    await expect(errorMessageLocator).toHaveText(
      "Please enter both email and password."
    );
  });

  test("should show error for invalid login credentials", async ({ page }) => {
    await page.route("**/api/auth/login", async (route) => {
      await route.fulfill({
        json: { error: "Invalid credentials" },
        status: 401,
      });
    });

    await loginUser(page, "wrong@example.com", "wrongpassword");
    const errorMessageLocator = page.locator(
      '[data-item-id="login-error-message"]'
    );
    await expect(errorMessageLocator).toBeVisible();
    await expect(errorMessageLocator).toHaveText("Invalid credentials");
  });

  test("should allow a user to logout", async ({ page }) => {
    await page.route("**/api/auth/login", async (route) => {
      await route.fulfill({
        json: {
          accessToken: "fake-jwt-token",
          refreshToken: "fake-refresh-token",
          user: { email: TEST_USER_EMAIL, id: "123" },
        },
        status: 200,
      });
    });
    await page.route("**/api/auth/verify-token", async (route) => {
      await route.fulfill({
        json: { valid: true, user: { id: "123", email: TEST_USER_EMAIL } },
        status: 200,
      });
    });
    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({ json: { notesTree: [] }, status: 200 });
    });
    await page.route("**/api/auth/logout", async (route) => {
      await route.fulfill({ status: 200, json: { message: "Logged out" } });
    });

    await loginUser(page, TEST_USER_EMAIL, TEST_USER_PASSWORD);
    await expect(
      page.getByRole("heading", { name: "Notes & Tasks" })
    ).toBeVisible();

    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("button", { name: "Logout" }).click();

    await expect(
      page.getByRole("heading", { name: "Login to Notes & Tasks" })
    ).toBeVisible();
    const token = await page.evaluate(() =>
      localStorage.getItem("accessToken")
    );
    expect(token).toBeNull();
    const refreshToken = await page.evaluate(() =>
      localStorage.getItem("refreshToken")
    );
    expect(refreshToken).toBeNull();
  });
});
