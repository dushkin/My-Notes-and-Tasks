import { test, expect, Page, Locator } from "@playwright/test";

interface TreeItem {
  id: string;
  label: string;
  type: "folder" | "note" | "task";
  children?: TreeItem[];
  content?: string;
  completed?: boolean;
  createdAt: string;
  updatedAt: string;
}
const now = new Date().toISOString();

async function loginAndGetTreeNav(page: Page): Promise<Locator> {
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
  // Initial tree load is empty
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
  await expect(
    page.getByRole("heading", { name: "Notes & Tasks" })
  ).toBeVisible();
  return page.getByRole("navigation", { name: "Notes and Tasks Tree" });
}

test.describe("Undo/Redo Functionality", () => {
  let treeNav: Locator;

  test("should undo and redo adding a root folder", async ({ page }) => {
    treeNav = await loginAndGetTreeNav(page);

    const folderName = "UndoRedo Folder";
    const folderId = "undoredo-folder-1";
    const undoButton = page.getByRole("button", { name: "Undo (Ctrl+Z)" });
    const redoButton = page.getByRole("button", { name: "Redo (Ctrl+Y)" });

    await expect(undoButton).toBeDisabled();
    await expect(redoButton).toBeDisabled();

    let currentMockedTree: TreeItem[] = [];

    // This route will be used for tree refreshes triggered by operations
    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({ json: { notesTree: currentMockedTree } });
    });

    // Mock for the ADD operation
    await page.route(
      "**/api/items",
      async (route) => {
        if (route.request().method() === "POST") {
          currentMockedTree = [
            {
              id: folderId,
              label: folderName,
              type: "folder",
              children: [],
              createdAt: now,
              updatedAt: now,
            },
          ];
          await route.fulfill({
            json: {
              id: folderId,
              label: folderName,
              type: "folder",
              children: [],
              createdAt: now,
              updatedAt: now,
            },
            status: 201,
          });
        } else {
          await route.continue();
        }
      },
      { times: 1 }
    );

    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("button", { name: "Add Root Folder" }).click();
    await page.getByPlaceholder("Enter folder name").fill(folderName);
    await page.getByRole("button", { name: "Add" }).click();

    await expect(treeNav.getByText(folderName, { exact: true })).toBeVisible({
      timeout: 7000,
    });
    await expect(undoButton).toBeEnabled();
    await expect(redoButton).toBeDisabled();

    // UNDO Add
    currentMockedTree = []; // Tree state after undoing the add
    await undoButton.click();
    await expect(
      treeNav.getByText(folderName, { exact: true })
    ).not.toBeVisible({ timeout: 7000 });
    await expect(undoButton).toBeDisabled();
    await expect(redoButton).toBeEnabled();

    // REDO Add
    currentMockedTree = [
      {
        id: folderId,
        label: folderName,
        type: "folder",
        children: [],
        createdAt: now,
        updatedAt: now,
      },
    ];
    await redoButton.click();
    await expect(treeNav.getByText(folderName, { exact: true })).toBeVisible({
      timeout: 7000,
    });
    await expect(undoButton).toBeEnabled();
    await expect(redoButton).toBeDisabled();
  });

  test("should undo and redo deleting an item", async ({ page }) => {
    treeNav = await loginAndGetTreeNav(page);

    const itemName = "Item To Delete For Undo";
    const itemId = "item-del-undo";
    const setupFolderName = "SetupFolderForDeleteTest";
    const setupFolderId = "setup-folder-del";

    const undoButton = page.getByRole("button", { name: "Undo (Ctrl+Z)" });
    const redoButton = page.getByRole("button", { name: "Redo (Ctrl+Y)" });
    let currentMockedTreeForDeleteTest: TreeItem[] = [];

    // Generic tree refresh mock
    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({
        json: { notesTree: currentMockedTreeForDeleteTest },
      });
    });

    // 1. Add Setup Folder
    await page.route(
      "**/api/items",
      async (route) => {
        // For adding root folder
        if (
          route.request().method() === "POST" &&
          route.request().postDataJSON()?.label === setupFolderName
        ) {
          currentMockedTreeForDeleteTest = [
            {
              id: setupFolderId,
              label: setupFolderName,
              type: "folder",
              children: [],
              createdAt: now,
              updatedAt: now,
            },
          ];
          await route.fulfill({
            json: currentMockedTreeForDeleteTest[0],
            status: 201,
          });
        } else {
          route.continue();
        }
      },
      { times: 1 }
    );
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("button", { name: "Add Root Folder" }).click();
    await page.getByPlaceholder("Enter folder name").fill(setupFolderName);
    await page.getByRole("button", { name: "Add" }).click();
    await expect(
      treeNav.getByText(setupFolderName, { exact: true })
    ).toBeVisible({ timeout: 7000 });

    // 2. Add Note inside Setup Folder
    await page.route(
      `**/api/items/${setupFolderId}`,
      async (route) => {
        // For adding note to folder
        if (
          route.request().method() === "POST" &&
          route.request().postDataJSON()?.label === itemName
        ) {
          const newItem = {
            id: itemId,
            label: itemName,
            type: "note" as "note",
            content: "",
            createdAt: now,
            updatedAt: now,
          };
          currentMockedTreeForDeleteTest = [
            { ...currentMockedTreeForDeleteTest[0], children: [newItem] },
          ];
          await route.fulfill({ json: newItem, status: 201 });
        } else {
          route.continue();
        }
      },
      { times: 1 }
    );
    const setupFolderItem = treeNav.locator(
      `li[data-item-id="${setupFolderId}"]`
    );
    await setupFolderItem.hover();
    await setupFolderItem
      .getByRole("button", { name: `More options for ${setupFolderName}` })
      .click();
    await page.getByRole("button", { name: "Add Note Here" }).click();
    await page.getByPlaceholder("Enter note name").fill(itemName);
    await page.getByRole("button", { name: "Add" }).click();
    await expect(treeNav.getByText(itemName, { exact: true })).toBeVisible({
      timeout: 7000,
    });

    // 3. Delete the Note
    await page.route(`**/api/items/${itemId}`, async (route) => {
      // For deleting the note
      if (route.request().method() === "DELETE") {
        currentMockedTreeForDeleteTest = [
          { ...currentMockedTreeForDeleteTest[0], children: [] },
        ];
        await route.fulfill({ status: 200, json: { message: "Item deleted" } });
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
    await expect(treeNav.getByText(itemName, { exact: true })).not.toBeVisible({
      timeout: 7000,
    });

    await expect(undoButton).toBeEnabled();
    await expect(redoButton).toBeDisabled();

    // 4. UNDO Delete
    const noteItemRestored: TreeItem = {
      id: itemId,
      label: itemName,
      type: "note",
      content: "",
      createdAt: now,
      updatedAt: now,
    };
    currentMockedTreeForDeleteTest = [
      { ...currentMockedTreeForDeleteTest[0], children: [noteItemRestored] },
    ];
    await undoButton.click();
    await expect(treeNav.getByText(itemName, { exact: true })).toBeVisible({
      timeout: 7000,
    });
    await expect(redoButton).toBeEnabled();
    await expect(undoButton).toBeEnabled();

    // 5. REDO Delete
    currentMockedTreeForDeleteTest = [
      { ...currentMockedTreeForDeleteTest[0], children: [] },
    ];
    await redoButton.click();
    await expect(treeNav.getByText(itemName, { exact: true })).not.toBeVisible({
      timeout: 7000,
    });
    await expect(undoButton).toBeEnabled();
    await expect(redoButton).toBeDisabled();
  });
});
