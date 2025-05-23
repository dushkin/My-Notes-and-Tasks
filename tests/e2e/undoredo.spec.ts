import { test, expect, Page, Locator } from "@playwright/test";

// Define a type for tree items
interface TreeItem {
  id: string;
  label: string;
  type: "folder" | "note" | "task";
  children?: TreeItem[];
  content?: string;
  completed?: boolean;
}

async function loginAndGetTreeNav(page: Page): Promise<Locator> {
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
    const undoButton = page.getByRole("button", { name: "Undo (Ctrl+Z)" });
    const redoButton = page.getByRole("button", { name: "Redo (Ctrl+Y)" });

    await expect(undoButton).toBeDisabled();
    await expect(redoButton).toBeDisabled();

    let currentMockedTree: TreeItem[] = [];

    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({ json: { notesTree: currentMockedTree } });
    });

    await page.route(
      "**/api/items",
      async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            json: {
              id: "undoredo-folder-1",
              label: folderName,
              type: "folder",
              children: [],
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

    currentMockedTree = [
      {
        id: "undoredo-folder-1",
        label: folderName,
        type: "folder",
        children: [],
      },
    ];
    await expect(treeNav.getByText(folderName, { exact: true })).toBeVisible({
      timeout: 7000,
    });

    await expect(undoButton).toBeEnabled();
    await expect(redoButton).toBeDisabled();

    currentMockedTree = [];
    await undoButton.click();
    await expect(
      treeNav.getByText(folderName, { exact: true })
    ).not.toBeVisible({ timeout: 7000 });
    await expect(undoButton).toBeDisabled();
    await expect(redoButton).toBeEnabled();

    currentMockedTree = [
      {
        id: "undoredo-folder-1",
        label: folderName,
        type: "folder",
        children: [],
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
    const setupFolderName = "SetupFolderForDeleteTest";
    const undoButton = page.getByRole("button", { name: "Undo (Ctrl+Z)" });
    const redoButton = page.getByRole("button", { name: "Redo (Ctrl+Y)" });

    let currentMockedTreeForDeleteTest: TreeItem[] = [];

    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({
        json: { notesTree: currentMockedTreeForDeleteTest },
      });
    });

    await page.route(
      "**/api/items",
      async (route) => {
        const reqBody = route.request().postDataJSON();
        if (
          route.request().method() === "POST" &&
          reqBody.type === "folder" &&
          reqBody.label === setupFolderName
        ) {
          await route.fulfill({
            json: {
              id: "setup-folder-del",
              label: setupFolderName,
              type: "folder",
              children: [],
            },
            status: 201,
          });
        } else {
          await route.continue();
        }
      },
      { times: 1 }
    );

    currentMockedTreeForDeleteTest = [];
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("button", { name: "Add Root Folder" }).click();
    await page.getByPlaceholder("Enter folder name").fill(setupFolderName);
    await page.getByRole("button", { name: "Add" }).click();

    currentMockedTreeForDeleteTest = [
      {
        id: "setup-folder-del",
        label: setupFolderName,
        type: "folder",
        children: [],
      },
    ];
    await expect(
      treeNav.getByText(setupFolderName, { exact: true })
    ).toBeVisible({ timeout: 7000 });

    await page.route(
      "**/api/items/setup-folder-del",
      async (route) => {
        const reqBody = route.request().postDataJSON();
        if (
          route.request().method() === "POST" &&
          reqBody.type === "note" &&
          reqBody.label === itemName
        ) {
          await route.fulfill({
            json: {
              id: "item-del-undo",
              label: itemName,
              type: "note",
              content: "",
            },
            status: 201,
          });
        } else {
          await route.continue();
        }
      },
      { times: 1 }
    );

    const setupFolderItem = treeNav.locator(
      'li[data-item-id="setup-folder-del"]'
    );
    await setupFolderItem.hover();
    await setupFolderItem
      .getByRole("button", { name: `More options for ${setupFolderName}` })
      .click();
    await page.getByRole("button", { name: "Add Note Here" }).click();
    await page.getByPlaceholder("Enter note name").fill(itemName);
    await page.getByRole("button", { name: "Add" }).click();

    currentMockedTreeForDeleteTest = [
      {
        id: "setup-folder-del",
        label: setupFolderName,
        type: "folder",
        children: [
          { id: "item-del-undo", label: itemName, type: "note", content: "" },
        ],
      },
    ];
    await expect(
      setupFolderItem.getByText(itemName, { exact: true })
    ).toBeVisible({ timeout: 7000 });

    await page.route("**/api/items/item-del-undo", async (route) => {
      if (route.request().method() === "DELETE") {
        await route.fulfill({ status: 200, json: { message: "Item deleted" } });
      } else {
        route.continue();
      }
    });

    page.on("dialog", (dialog) => dialog.accept());
    const itemEntry = treeNav.locator('li[data-item-id="item-del-undo"]');
    await itemEntry.hover();
    await itemEntry
      .getByRole("button", { name: `More options for ${itemName}` })
      .click();
    await page.getByRole("button", { name: "🗑️ Delete" }).click();

    currentMockedTreeForDeleteTest = [
      {
        id: "setup-folder-del",
        label: setupFolderName,
        type: "folder",
        children: [],
      },
    ];
    await expect(treeNav.getByText(itemName, { exact: true })).not.toBeVisible({
      timeout: 7000,
    });
    await expect(undoButton).toBeEnabled(); // Delete action performed
    await expect(redoButton).toBeDisabled();

    // Undo Delete
    currentMockedTreeForDeleteTest = [
      {
        id: "setup-folder-del",
        label: setupFolderName,
        type: "folder",
        children: [
          { id: "item-del-undo", label: itemName, type: "note", content: "" },
        ],
      },
    ];
    await undoButton.click();
    await expect(treeNav.getByText(itemName, { exact: true })).toBeVisible({
      timeout: 7000,
    });
    await expect(redoButton).toBeEnabled();
    // After undoing the delete, the "add note" and "add folder" are still in the past stack
    await expect(undoButton).toBeEnabled(); // <<<< CORRECTED ASSERTION

    // Redo Delete
    currentMockedTreeForDeleteTest = [
      {
        id: "setup-folder-del",
        label: setupFolderName,
        type: "folder",
        children: [],
      },
    ];
    await redoButton.click();
    await expect(treeNav.getByText(itemName, { exact: true })).not.toBeVisible({
      timeout: 7000,
    });
    await expect(undoButton).toBeEnabled(); // Because the "add" operations can still be undone
    await expect(redoButton).toBeDisabled(); // After redo, future stack is empty
  });
});
