import { test, expect, Page } from "@playwright/test";

const TEST_USER_EMAIL = `testuser_${Date.now()}@example.com`;
const TEST_USER_PASSWORD = "TestPassword123!";

// Helper function for registration
async function registerUser(page: Page, email: string, password: string) {
  await page.getByRole("button", { name: "Create one" }).click(); // [cite: 184]
  await expect(
    page.getByRole("heading", { name: "Create Account" })
  ).toBeVisible(); // [cite: 204]

  await page.locator("input#email-register").fill(email); // [cite: 207]
  await page.locator("input#password-register").fill(password); // [cite: 210]
  await page
    .locator("input#confirmPassword-register")
    .waitFor({ timeout: 5000 });
  await page.locator("input#confirmPassword-register").fill(password); // [cite: 212]
  await page.getByRole("button", { name: "Create Account" }).click(); // [cite: 213]
}

// Helper function for login
async function loginUser(page: Page, email: string, password: string) {
  await expect(
    page.getByRole("heading", { name: "Login to Notes & Tasks" })
  ).toBeVisible(); // [cite: 175]
  await page.locator("input#email-login").fill(email); // [cite: 178]
  await page.locator("input#password-login").fill(password); // [cite: 181]
  await page.getByRole("button", { name: "Login" }).click(); // [cite: 182]
}

test.describe("Authentication", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should allow a user to register", async ({ page }) => {
    // Mock the API response for registration
    await page.route("**/api/auth/register", async (route) => {
      const json = { message: "User registered successfully" };
      await route.fulfill({ json, status: 201 });
    });

    // Start waiting for the dialog event *before* triggering it.
    const dialogPromise = page.waitForEvent("dialog", { timeout: 15000 });

    await registerUser(page, TEST_USER_EMAIL, TEST_USER_PASSWORD);

    // Wait for the dialog event to occur and get the dialog object.
    const dialog = await dialogPromise;
    const messageFromDialog = dialog.message();
    await dialog.accept(); // Dismiss the dialog

    expect(messageFromDialog).toContain(
      "Registration successful! Please log in."
    ); // [cite: 200]
    // After successful registration, it should switch to the login view [cite: 201, 215]
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
    await page
      .locator("input#confirmPassword-register")
      .waitFor({ timeout: 5000 });
    await page.locator("input#confirmPassword-register").fill("wrongpassword");
    await page.getByRole("button", { name: "Create Account" }).click();
    // Ensure the error message element becomes visible and then check its text
    const errorMessageLocator = page.locator(
      '[data-item-id="register-error-message"]'
    ); // [cite: 205]
    await expect(errorMessageLocator).toBeVisible({ timeout: 7000 }); // Wait for element to appear
    await expect(errorMessageLocator).toHaveText("Passwords do not match."); // [cite: 193]
  });

  test("should show error if registration fields are empty", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Create one" }).click(); // [cite: 184]

    // Simulate user attempting to enter empty input (forces validation)
    await page.locator("input#email-register").fill(" ");
    await page.locator("input#password-register").fill(" ");
    await page.locator("input#confirmPassword-register").fill(" ");

    // Click "Create Account" to trigger validation
    await page.getByRole("button", { name: "Create Account" }).click(); // [cite: 213]

    // Ensure the error message element becomes visible and check its text
    const errorMessageLocator = page.locator(
      '[data-item-id="register-error-message"]'
    );
    await expect(errorMessageLocator).toBeVisible({ timeout: 7000 });
    await expect(errorMessageLocator).toHaveText("Please fill in all fields.");
  });

  test("should allow a registered user to login and see the main app", async ({
    page,
  }) => {
    // Mock successful login
    await page.route("**/api/auth/login", async (route) => {
      const json = {
        token: "fake-jwt-token",
        user: { email: TEST_USER_EMAIL, id: "123" },
      };
      await route.fulfill({ json, status: 200 });
    });

    // Mock successful tree fetch after login
    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({ json: { notesTree: [] }, status: 200 });
    });

    // Assume user is on login page or was redirected after registration
    await loginUser(page, TEST_USER_EMAIL, TEST_USER_PASSWORD);

    // Check if login was successful by looking for an element in the main app view
    await expect(
      page.getByRole("heading", { name: "Notes & Tasks" })
    ).toBeVisible(); // [cite: 1402]
    // Check local storage for token
    const token = await page.evaluate(() => localStorage.getItem("userToken"));
    expect(token).toBe("fake-jwt-token"); // [cite: 171]
  });

  test("should show error if login fields are empty", async ({ page }) => {
    await loginUser(page, "", "");
    // Ensure the error message element becomes visible and then check its text
    const errorMessageLocator = page.locator(
      '[data-item-id="login-error-message"]'
    ); // [cite: 176]
    await expect(errorMessageLocator).toBeVisible({ timeout: 7000 }); // Wait for element to appear
    await expect(errorMessageLocator).toHaveText(
      "Please enter both email and password."
    ); // [cite: 163]
  });

  test("should show error for invalid login credentials", async ({ page }) => {
    // Mock failed login
    await page.route("**/api/auth/login", async (route) => {
      await route.fulfill({
        json: { error: "Invalid credentials" },
        status: 401,
      });
    });

    await loginUser(page, "wrong@example.com", "wrongpassword");
    const errorMessageLocator = page.locator(
      '[data-item-id="login-error-message"]'
    ); // [cite: 176]
    await expect(errorMessageLocator).toBeVisible({ timeout: 7000 });
    await expect(errorMessageLocator).toHaveText("Invalid credentials"); // [cite: 169]
  });

  test("should allow a user to logout", async ({ page }) => {
    // Mock successful login
    await page.route("**/api/auth/login", async (route) => {
      const json = {
        token: "fake-jwt-token",
        user: { email: TEST_USER_EMAIL, id: "123" },
      };
      await route.fulfill({ json, status: 200 });
    });
    await page.route("**/api/items/tree", async (route) => {
      // Mock tree fetch
      await route.fulfill({ json: { notesTree: [] } });
    });

    await loginUser(page, TEST_USER_EMAIL, TEST_USER_PASSWORD);
    await expect(
      page.getByRole("heading", { name: "Notes & Tasks" })
    ).toBeVisible(); // [cite: 1402]

    await page.getByRole("button", { name: "More actions" }).click(); // [cite: 1411]
    await page.getByRole("button", { name: "Logout" }).click(); // [cite: 1422]

    await expect(
      page.getByRole("heading", { name: "Login to Notes & Tasks" })
    ).toBeVisible(); // [cite: 175]
    const token = await page.evaluate(() => localStorage.getItem("userToken"));
    expect(token).toBeNull(); // [cite: 1304]
  });
});
