import { test, expect, Page } from "@playwright/test";

const now = new Date().toISOString();

async function loginToApp(page: Page) {
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
  await page.route(
    "**/api/items/tree",
    async (route) => {
      await route.fulfill({ json: { notesTree: [] }, status: 200 });
    },
    { times: 1 }
  );
  await page.locator("input#email-login").fill("test@example.com");
  await page.locator("input#password-login").fill("password");
  await page.getByRole("button", { name: "Login" }).click();
  await page.waitForResponse("**/api/auth/verify-token");
  await page.waitForResponse("**/api/items/tree");
  await expect(
    page.getByRole("heading", { name: "Notes & Tasks" })
  ).toBeVisible({ timeout: 10000 });
}

const getErrorDisplayLocator = (page: Page) => {
  return page.locator('[data-item-id="error-display-message"]');
};

test.describe("API Error Handling", () => {
  test("should display UI error message when adding a root folder fails", async ({
    page,
  }) => {
    await loginToApp(page);
    const folderName = "Error Folder";

    await page.route("**/api/items", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 500,
          json: { error: "Server failed to create folder" },
        });
      } else {
        route.continue();
      }
    });
    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({ json: { notesTree: [] }, status: 200 });
    });

    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("button", { name: "Add Root Folder" }).click();
    await expect(
      page.getByRole("heading", { name: "Add folder" })
    ).toBeVisible();
    await page.getByPlaceholder("Enter folder name").fill(folderName);
    await page.getByRole("button", { name: "Add" }).click();
    await page.waitForTimeout(500); // Allow React to process state

    const errorDisplay = getErrorDisplayLocator(page);
    await expect(errorDisplay).toBeVisible({ timeout: 10000 });
    await expect(errorDisplay).toContainText("Server failed to create folder");

    const treeNav = page.getByRole("navigation", {
      name: "Notes and Tasks Tree",
    });
    await expect(treeNav.getByText(folderName)).not.toBeVisible();
  });

  test("should display UI error message when renaming an item fails", async ({
    page,
  }) => {
    const originalName = "RenameFail Original";
    const newName = "RenameFail New";
    const itemId = "rename-fail-1";

    await loginToApp(page);

    await page.unrouteAll();
    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({
        json: {
          notesTree: [
            {
              id: itemId,
              label: originalName,
              type: "folder",
              children: [],
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
        status: 200,
      });
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForResponse("**/api/items/tree");
    await expect(
      page.getByRole("heading", { name: "Notes & Tasks" })
    ).toBeVisible();

    const treeNav = page.getByRole("navigation", {
      name: "Notes and Tasks Tree",
    });
    const treeContent = await treeNav.textContent();
    console.log("Tree Navigation Content:", treeContent);
    await expect(treeNav.getByText(originalName)).toBeVisible({
      timeout: 10000,
    });

    await page.route(`**/api/items/${itemId}`, async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 400,
          json: { error: "Invalid name for renaming" },
        });
      } else {
        route.continue();
      }
    });

    const folderItem = treeNav.locator(`li[data-item-id="${itemId}"]`);
    await folderItem.hover();
    await folderItem
      .getByRole("button", { name: `More options for ${originalName}` })
      .click();
    await page.getByRole("button", { name: "✏️ Rename" }).click();

    const renameInput = folderItem.locator('input[type="text"]');
    await renameInput.fill(newName);
    await renameInput.press("Enter");

    const errorDisplay = getErrorDisplayLocator(page);
    await expect(errorDisplay).toBeVisible({ timeout: 10000 });
    await expect(errorDisplay).toContainText("Invalid name for renaming");

    await expect(treeNav.getByText(originalName)).toBeVisible();
    await expect(treeNav.getByText(newName)).not.toBeVisible();
  });

  test("should display UI error message when deleting an item fails", async ({
    page,
  }) => {
    const itemName = "DeleteFail Item";
    const itemId = "delete-fail-1";
    await loginToApp(page);

    await page.unrouteAll();
    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({
        json: {
          notesTree: [
            {
              id: itemId,
              label: itemName,
              type: "note",
              content: "",
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
        status: 200,
      });
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForResponse("**/api/items/tree");
    await expect(
      page.getByRole("heading", { name: "Notes & Tasks" })
    ).toBeVisible();

    const treeNav = page.getByRole("navigation", {
      name: "Notes and Tasks Tree",
    });
    const treeContent = await treeNav.textContent();
    console.log("Tree Navigation Content:", treeContent);
    await expect(treeNav.getByText(itemName)).toBeVisible({ timeout: 10000 });

    await page.route(`**/api/items/${itemId}`, async (route) => {
      if (route.request().method() === "DELETE") {
        await route.fulfill({
          status: 503,
          json: { error: "Deletion service unavailable" },
        });
      } else {
        route.continue();
      }
    });

    page.on("dialog", (dialog) => dialog.accept());
    const itemEntry = treeNav.locator(`li[data-item-id="${itemId}"]`);
    await itemEntry.hover();
    await itemEntry
      .getByRole("button", { name: `More options for ${itemName}` })
      .click();
    await page.getByRole("button", { name: "🗑️ Delete" }).click();

    const errorDisplay = getErrorDisplayLocator(page);
    await expect(errorDisplay).toBeVisible({ timeout: 10000 });
    await expect(errorDisplay).toContainText("Deletion service unavailable");
    await expect(treeNav.getByText(itemName)).toBeVisible();
  });

  test("should display UI error message when saving note content fails", async ({
    page,
  }) => {
    const noteName = "NoteSaveFail";
    const noteId = "note-save-fail-1";
    await loginToApp(page);

    await page.unrouteAll();
    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({
        json: {
          notesTree: [
            {
              id: noteId,
              label: noteName,
              type: "note",
              content: "<p>Initial.</p>",
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
        status: 200,
      });
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForResponse("**/api/items/tree");
    await expect(
      page.getByRole("heading", { name: "Notes & Tasks" })
    ).toBeVisible();

    const treeNav = page.getByRole("navigation", {
      name: "Notes and Tasks Tree",
    });
    const treeContent = await treeNav.textContent();
    console.log("Tree Navigation Content:", treeContent);
    await expect(treeNav.getByText(noteName)).toBeVisible({ timeout: 10000 });
    await treeNav.getByText(noteName).click();

    const editor = page.locator(".ProseMirror");
    await expect(editor).toBeVisible({ timeout: 10000 });

    await page.route(`**/api/items/${noteId}`, async (route, request) => {
      if (request.method() === "PATCH") {
        await route.fulfill({
          status: 400,
          json: { error: "Cannot save content, validation failed" },
        });
      } else {
        route.continue();
      }
    });
    await editor.fill("New problematic content");
    await page.waitForTimeout(1500); // For debounced save

    const errorDisplay = getErrorDisplayLocator(page);
    await expect(errorDisplay).toBeVisible({ timeout: 10000 });
    await expect(errorDisplay).toContainText(
      "Cannot save content, validation failed"
    );
  });
});
