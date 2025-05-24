import { test, expect, Page } from "@playwright/test";

async function loginToApp(page: Page) {
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
  // This initial tree mock is ONLY for the first tree load that happens as part of loginToApp sequence.
  await page.route(
    "**/api/items/tree",
    async (route) => {
      // console.log('[TEST DEBUG] loginToApp: Serving initial empty tree post-login.');
      await route.fulfill({ json: { notesTree: [] }, status: 200 });
    },
    { times: 1 }
  );

  await page.locator("input#email-login").fill("test@example.com");
  await page.locator("input#password-login").fill("password");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(
    page.getByRole("heading", { name: "Notes & Tasks" })
  ).toBeVisible();
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

    // Mock failed API response for adding item
    await page.route("**/api/items", async (route) => {
      // console.log('[TEST DEBUG] ADD_FAIL: Mocking POST /api/items to fail.');
      await route.fulfill({
        status: 500,
        json: { error: "Server failed to create folder" },
      });
    });

    // If the app tries to refresh the tree after a failed add, ensure it gets an empty tree (or pre-add state)
    await page.route("**/api/items/tree", async (route) => {
      // console.log('[TEST DEBUG] ADD_FAIL: Mocking GET /api/items/tree to be empty after failed add.');
      await route.fulfill({ json: { notesTree: [] }, status: 200 });
    });

    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("button", { name: "Add Root Folder" }).click();
    await expect(
      page.getByRole("heading", { name: "Add folder" })
    ).toBeVisible();
    await page.getByPlaceholder("Enter folder name").fill(folderName);
    await page.getByRole("button", { name: "Add" }).click();

    const errorDisplay = getErrorDisplayLocator(page);
    await expect(errorDisplay).toBeVisible({ timeout: 7000 });
    await expect(errorDisplay).toContainText("Server failed to create folder");

    await page.waitForTimeout(2000);
    await expect(
      page
        .getByRole("navigation", { name: "Notes and Tasks Tree" })
        .getByText(folderName)
    ).not.toBeVisible();
  });

  test("should display UI error message when renaming an item fails", async ({
    page,
  }) => {
    const originalName = "RenameFail Original";
    const newName = "RenameFail New";

    await loginToApp(page);

    // Setup initial tree state for this specific test
    await page.route("**/api/items/tree", async (route) => {
      // console.log('[TEST DEBUG] RENAME_FAIL: Serving tree for setup (originalName).');
      await route.fulfill({
        json: {
          notesTree: [
            {
              id: "rename-fail-1",
              label: originalName,
              type: "folder",
              children: [],
            },
          ],
        },
        status: 200,
      });
    });
    // Trigger a reload or action that fetches the tree to apply the mock above.
    // If loginToApp already lands on the main page and tree is fetched, this might be automatic.
    // To be sure, a reload or navigating away and back (or just relying on subsequent actions to fetch)
    await page.reload(); // This will use the mock defined above.

    const treeNav = page.getByRole("navigation", {
      name: "Notes and Tasks Tree",
    });
    await expect(treeNav.getByText(originalName)).toBeVisible({
      timeout: 10000,
    });

    // Mock failed API response for renaming (PATCH)
    await page.route("**/api/items/rename-fail-1", async (route) => {
      if (route.request().method() === "PATCH") {
        // console.log('[TEST DEBUG] RENAME_FAIL: Mocking PATCH /api/items/rename-fail-1 to fail.');
        await route.fulfill({
          status: 400,
          json: { error: "Invalid name for renaming" },
        });
      } else {
        route.continue();
      }
    });

    // Mock subsequent tree refresh to show original name after failed rename
    await page.route("**/api/items/tree", async (route) => {
      // console.log('[TEST DEBUG] RENAME_FAIL: Serving tree AFTER FAILED RENAME (should be originalName).');
      await route.fulfill({
        json: {
          notesTree: [
            {
              id: "rename-fail-1",
              label: originalName,
              type: "folder",
              children: [],
            },
          ],
        },
        status: 200,
      });
    });

    const folderItem = treeNav.locator(`li[data-item-id="rename-fail-1"]`);
    await folderItem.hover();
    await folderItem
      .getByRole("button", { name: `More options for ${originalName}` })
      .click();
    await page.getByRole("button", { name: "✏️ Rename" }).click();

    const renameInput = folderItem.locator('input[type="text"]');
    await renameInput.fill(newName);
    await renameInput.press("Enter");

    const errorDisplay = getErrorDisplayLocator(page);
    await expect(errorDisplay).toBeVisible({ timeout: 7000 });
    await expect(errorDisplay).toContainText("Invalid name for renaming");

    await page.waitForTimeout(200);
    await expect(treeNav.getByText(originalName)).toBeVisible();
    await expect(treeNav.getByText(newName)).not.toBeVisible();
  });

  test("should display UI error message when deleting an item fails", async ({
    page,
  }) => {
    const itemName = "DeleteFail Item";
    await loginToApp(page);

    await page.route("**/api/items/tree", async (route) => {
      // console.log('[TEST DEBUG] DELETE_FAIL: Serving tree for setup (itemName).');
      await route.fulfill({
        json: {
          notesTree: [
            { id: "delete-fail-1", label: itemName, type: "note", content: "" },
          ],
        },
        status: 200,
      });
    });
    await page.reload();

    const treeNav = page.getByRole("navigation", {
      name: "Notes and Tasks Tree",
    });
    await expect(treeNav.getByText(itemName)).toBeVisible({ timeout: 7000 });

    await page.route("**/api/items/delete-fail-1", async (route) => {
      if (route.request().method() === "DELETE") {
        // console.log('[TEST DEBUG] DELETE_FAIL: Mocking DELETE /api/items/delete-fail-1 to fail.');
        await route.fulfill({
          status: 503,
          json: { error: "Deletion service unavailable" },
        });
      } else {
        route.continue();
      }
    });

    // Mock subsequent tree refresh
    await page.route("**/api/items/tree", async (route) => {
      // console.log('[TEST DEBUG] DELETE_FAIL: Serving tree AFTER FAILED DELETE (should still contain item).');
      await route.fulfill({
        json: {
          notesTree: [
            { id: "delete-fail-1", label: itemName, type: "note", content: "" },
          ],
        },
        status: 200,
      });
    });

    page.on("dialog", (dialog) => dialog.accept());
    const itemEntry = treeNav.locator('li[data-item-id="delete-fail-1"]');
    await itemEntry.hover();
    await itemEntry
      .getByRole("button", { name: `More options for ${itemName}` })
      .click();
    await page.getByRole("button", { name: "🗑️ Delete" }).click();

    const errorDisplay = getErrorDisplayLocator(page);
    await expect(errorDisplay).toBeVisible({ timeout: 7000 });
    await expect(errorDisplay).toContainText("Deletion service unavailable");

    await page.waitForTimeout(200);
    await expect(treeNav.getByText(itemName)).toBeVisible();
  });

  test("should display UI error message when saving note content fails", async ({
    page,
  }) => {
    const noteName = "NoteSaveFail";
    await loginToApp(page);

    await page.route("**/api/items/tree", async (route) => {
      // console.log('[TEST DEBUG] SAVE_CONTENT_FAIL: Serving tree for setup (noteName).');
      await route.fulfill({
        json: {
          notesTree: [
            {
              id: "note-save-fail-1",
              label: noteName,
              type: "note",
              content: "<p>Initial.</p>",
            },
          ],
        },
        status: 200,
      });
    });
    await page.reload();

    const treeNav = page.getByRole("navigation", {
      name: "Notes and Tasks Tree",
    });
    await expect(treeNav.getByText(noteName)).toBeVisible({ timeout: 7000 });
    await treeNav.getByText(noteName).click(); // Open the note

    const editor = page.locator(".ProseMirror");
    await expect(editor).toBeVisible({ timeout: 7000 });

    await page.route(
      "**/api/items/note-save-fail-1",
      async (route, request) => {
        if (request.method() === "PATCH") {
          // console.log('[TEST DEBUG] SAVE_CONTENT_FAIL: Mocking PATCH /api/items/note-save-fail-1 to fail.');
          await route.fulfill({
            status: 400,
            json: { error: "Cannot save content, validation failed" },
          });
        } else {
          route.continue();
        }
      }
    );

    await editor.fill("New problematic content");
    await page.waitForTimeout(1500); // For debounced save

    const errorDisplay = getErrorDisplayLocator(page);
    await expect(errorDisplay).toBeVisible({ timeout: 7000 });
    await expect(errorDisplay).toContainText(
      "Cannot save content, validation failed"
    );
  });
});
