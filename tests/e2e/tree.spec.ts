import { test, expect, Page } from "@playwright/test";

async function login(page: Page) {
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
    // Initial empty tree
    await route.fulfill({ json: { notesTree: [] }, status: 200 });
  });
  await page.locator("input#email-login").fill("test@example.com");
  await page.locator("input#password-login").fill("password");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(
    page.getByRole("heading", { name: "Notes & Tasks" })
  ).toBeVisible();
}

test.describe("Tree Operations", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should add a new root folder", async ({ page }) => {
    const folderName = "My New Root Folder";

    await page.route("**/api/items", async (route) => {
      // Mock POST to /api/items for root folder
      const requestBody = route.request().postDataJSON();
      expect(requestBody.label).toBe(folderName);
      expect(requestBody.type).toBe("folder");
      await route.fulfill({
        json: {
          id: "folder-1",
          label: folderName,
          type: "folder",
          children: [],
        },
        status: 201,
      });
    });
    await page.route("**/api/items/tree", async (route) => {
      // Mock subsequent tree fetch
      await route.fulfill({
        json: {
          notesTree: [
            { id: "folder-1", label: folderName, type: "folder", children: [] },
          ],
        },
        status: 200,
      });
    });

    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("button", { name: "Add Root Folder" }).click();

    await expect(
      page.getByRole("heading", { name: "Add folder" })
    ).toBeVisible();
    await page.getByPlaceholder("Enter folder name").fill(folderName);
    await page.getByRole("button", { name: "Add" }).click();

    await expect(
      page
        .getByRole("navigation", { name: "Notes and Tasks Tree" })
        .getByText(folderName, { exact: true })
    ).toBeVisible();
  });

  test("should add a note inside a folder via context menu", async ({
    page,
  }) => {
    const folderName = "Test Folder for Note";
    const noteName = "My Test Note";

    // Initial state: one folder exists
    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({
        json: {
          notesTree: [
            {
              id: "folder-ctx-1",
              label: folderName,
              type: "folder",
              children: [],
            },
          ],
        },
        status: 200,
      });
    });
    await page.reload(); // Reload to apply the new tree state
    await expect(
      page
        .getByRole("navigation", { name: "Notes and Tasks Tree" })
        .getByText(folderName)
    ).toBeVisible();

    // Mock POST to /api/items/folder-ctx-1 for the new note
    await page.route("**/api/items/folder-ctx-1", async (route) => {
      const requestBody = route.request().postDataJSON();
      expect(requestBody.label).toBe(noteName);
      expect(requestBody.type).toBe("note");
      await route.fulfill({
        json: { id: "note-1", label: noteName, type: "note", content: "" },
        status: 201,
      });
    });

    // Mock tree update after adding note
    await page.route(
      "**/api/items/tree",
      async (route, request) => {
        if (request.method() === "GET") {
          // Ensure we only mock GET for tree refresh
          await route.fulfill({
            json: {
              notesTree: [
                {
                  id: "folder-ctx-1",
                  label: folderName,
                  type: "folder",
                  children: [
                    {
                      id: "note-1",
                      label: noteName,
                      type: "note",
                      content: "",
                    },
                  ],
                },
              ],
            },
            status: 200,
          });
        } else {
          await route.continue();
        }
      },
      { times: 1 }
    );

    // Open context menu for the folder
    const folderItem = page.locator(`li[data-item-id="folder-ctx-1"]`);
    await folderItem.hover();
    await folderItem
      .getByRole("button", { name: `More options for ${folderName}` })
      .click();

    await page.getByRole("button", { name: "Add Note Here" }).click();

    await expect(page.getByRole("heading", { name: "Add note" })).toBeVisible();
    await page.getByPlaceholder("Enter note name").fill(noteName);
    await page.getByRole("button", { name: "Add" }).click();

    // Wait for potential UI update and tree re-render
    await page.waitForLoadState("domcontentloaded");
    // Or a more specific wait for the tree to contain the note or for the folder to be expandable.

    // Expand folder to see the note
    const expandButton = page.locator(
      `li[data-item-id="folder-ctx-1"] button[aria-label="Expand ${folderName}"]`
    );
    // Check if the folder needs expansion (it might be auto-expanded by app logic)
    const isExpanded = await page
      .locator(
        `li[data-item-id="folder-ctx-1"] button[aria-label="Collapse ${folderName}"]`
      )
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    if (!isExpanded && (await expandButton.isVisible())) {
      await expandButton.click();
    }

    await expect(
      page
        .getByRole("navigation", { name: "Notes and Tasks Tree" })
        .getByText(noteName, { exact: true })
    ).toBeVisible();
  });

  test("should rename an item via context menu", async ({ page }) => {
    const originalName = "Folder to Rename";
    const newName = "Renamed Folder";

    // Initial state: one folder
    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({
        json: {
          notesTree: [
            {
              id: "rename-folder-1",
              label: originalName,
              type: "folder",
              children: [],
            },
          ],
        },
        status: 200,
      });
    });
    await page.reload();
    await expect(
      page
        .getByRole("navigation", { name: "Notes and Tasks Tree" })
        .getByText(originalName)
    ).toBeVisible();

    // Mock PATCH for rename
    await page.route("**/api/items/rename-folder-1", async (route) => {
      const reqBody = route.request().postDataJSON();
      expect(reqBody.label).toBe(newName);
      await route.fulfill({
        json: {
          id: "rename-folder-1",
          label: newName,
          type: "folder",
          children: [],
        },
        status: 200,
      });
    });
    // Mock tree update after rename
    await page.route(
      "**/api/items/tree",
      async (route, request) => {
        if (request.method() === "GET") {
          await route.fulfill({
            json: {
              notesTree: [
                {
                  id: "rename-folder-1",
                  label: newName,
                  type: "folder",
                  children: [],
                },
              ],
            },
            status: 200,
          });
        } else {
          await route.continue();
        }
      },
      { times: 1 }
    );

    const folderItem = page.locator(`li[data-item-id="rename-folder-1"]`);
    await folderItem.hover();
    await folderItem
      .getByRole("button", { name: `More options for ${originalName}` })
      .click();

    await page.getByRole("button", { name: "✏️ Rename" }).click();

    // Inline rename input should appear
    const renameInput = page.locator(
      `li[data-item-id="rename-folder-1"] input[type="text"]`
    );
    await expect(renameInput).toBeVisible();
    await expect(renameInput).toHaveValue(originalName);

    await renameInput.fill(newName);
    await renameInput.press("Enter");

    await expect(
      page
        .getByRole("navigation", { name: "Notes and Tasks Tree" })
        .getByText(newName, { exact: true })
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Notes and Tasks Tree" })
        .getByText(originalName, { exact: true })
    ).not.toBeVisible();
  });

  test("should delete an item via context menu", async ({ page }) => {
    const itemName = "Folder to Delete";
    // Initial state: one folder
    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({
        json: {
          notesTree: [
            {
              id: "delete-folder-1",
              label: itemName,
              type: "folder",
              children: [],
            },
          ],
        },
        status: 200,
      });
    });
    await page.reload();
    await expect(
      page
        .getByRole("navigation", { name: "Notes and Tasks Tree" })
        .getByText(itemName)
    ).toBeVisible();

    // Mock DELETE request
    await page.route("**/api/items/delete-folder-1", async (route) => {
      await route.fulfill({
        status: 200,
        json: { message: "Item deleted successfully" },
      });
    });
    // Mock tree update after delete (empty tree)
    await page.route(
      "**/api/items/tree",
      async (route, request) => {
        if (request.method() === "GET") {
          await route.fulfill({ json: { notesTree: [] }, status: 200 });
        } else {
          await route.continue();
        }
      },
      { times: 1 }
    );

    page.on("dialog", async (dialog) => {
      // Handle confirm dialog
      expect(dialog.message()).toContain(`Delete "${itemName}"?`);
      await dialog.accept();
    });

    const folderItem = page.locator('li[data-item-id="delete-folder-1"]');
    await folderItem.hover();
    await folderItem
      .getByRole("button", { name: `More options for ${itemName}` })
      .click();

    await page.getByRole("button", { name: "🗑️ Delete" }).click();

    await expect(
      page
        .getByRole("navigation", { name: "Notes and Tasks Tree" })
        .getByText(itemName, { exact: true })
    ).not.toBeVisible();
  });
});
