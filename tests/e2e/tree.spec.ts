import { test, expect, Page } from "@playwright/test";

const now = new Date().toISOString();

async function login(page: Page) {
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
  // This mock is for the fetchUserTree call that happens during/immediately after login
  await page.route("**/api/items/tree", async (route) => {
    // console.log("LOGIN: Servicing initial GET /api/items/tree with empty tree");
    await route.fulfill({ json: { notesTree: [] }, status: 200 });
  }, { times: 1 }); // Ensures this mock is only used once for the initial login load

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
    await page.unroute("**/api/items/tree"); // Allow specific mocks per test
  });

  test("should add a new root folder", async ({ page }) => {
    const folderName = "My New Root Folder";
    const folderId = "server-folder-1";

    await page.route("**/api/items", async (route) => {
      const requestBody = route.request().postDataJSON();
      expect(requestBody.label).toBe(folderName);
      expect(requestBody.type).toBe("folder");
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
    });
    await page.route("**/api/items/tree", async (route) => {
      // For refresh after add
      await route.fulfill({
        json: {
          notesTree: [
            {
              id: folderId,
              label: folderName,
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
    const folderId = "folder-ctx-1";
    const noteName = "My Test Note";
    const noteId = "server-note-1";

    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({
        json: {
          notesTree: [
            {
              id: folderId,
              label: folderName,
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
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page
        .getByRole("navigation", { name: "Notes and Tasks Tree" })
        .getByText(folderName)
    ).toBeVisible();

    await page.route(`**/api/items/${folderId}`, async (route) => {
      // Route for adding item to specific parent
      const requestBody = route.request().postDataJSON();
      expect(requestBody.label).toBe(noteName);
      expect(requestBody.type).toBe("note");
      await route.fulfill({
        json: {
          id: noteId,
          label: noteName,
          type: "note",
          content: "",
          createdAt: now,
          updatedAt: now,
        },
        status: 201,
      });
    });

    // Mock for tree refresh AFTER note is added
    await page.unroute("**/api/items/tree"); // Clear previous general mock
    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({
        json: {
          notesTree: [
            {
              id: folderId,
              label: folderName,
              type: "folder",
              createdAt: now,
              updatedAt: now,
              children: [
                {
                  id: noteId,
                  label: noteName,
                  type: "note",
                  content: "",
                  createdAt: now,
                  updatedAt: now,
                },
              ],
            },
          ],
        },
        status: 200,
      });
    });

    const folderItem = page.locator(`li[data-item-id="${folderId}"]`);
    await folderItem.hover();
    await folderItem
      .getByRole("button", { name: `More options for ${folderName}` })
      .click();
    await page.getByRole("button", { name: "Add Note Here" }).click();

    await expect(page.getByRole("heading", { name: "Add note" })).toBeVisible();
    await page.getByPlaceholder("Enter note name").fill(noteName);
    await page.getByRole("button", { name: "Add" }).click();

    // Wait for the tree to potentially update and expand
    await page.waitForTimeout(500);

    const expandButton = page.locator(
      `li[data-item-id="${folderId}"] button[title="Expand"]`
    );
    const collapseButton = page.locator(
      `li[data-item-id="${folderId}"] button[title="Collapse"]`
    );

    if (await expandButton.isVisible()) {
      await expandButton.click();
    }
    await expect(collapseButton).toBeVisible(); // Ensure it's expanded

    await expect(
      page
        .getByRole("navigation", { name: "Notes and Tasks Tree" })
        .getByText(noteName, { exact: true })
    ).toBeVisible();
  });

  test("should rename an item via context menu", async ({ page }) => {
    const originalName = "Folder to Rename";
    const newName = "Renamed Folder";
    const itemId = "rename-folder-1";

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
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page
        .getByRole("navigation", { name: "Notes and Tasks Tree" })
        .getByText(originalName)
    ).toBeVisible();

    await page.route(`**/api/items/${itemId}`, async (route) => {
      const reqBody = route.request().postDataJSON();
      expect(reqBody.label).toBe(newName);
      await route.fulfill({
        json: {
          id: itemId,
          label: newName,
          type: "folder",
          children: [],
          createdAt: now,
          updatedAt: new Date().toISOString(),
        },
        status: 200,
      });
    });
    // Mock for tree refresh AFTER rename
    await page.unroute("**/api/items/tree");
    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({
        json: {
          notesTree: [
            {
              id: itemId,
              label: newName,
              type: "folder",
              children: [],
              createdAt: now,
              updatedAt: new Date().toISOString(),
            },
          ],
        },
        status: 200,
      });
    });

    const folderItem = page.locator(`li[data-item-id="${itemId}"]`);
    await folderItem.hover();
    await folderItem
      .getByRole("button", { name: `More options for ${originalName}` })
      .click();
    await page.getByRole("button", { name: "✏️ Rename" }).click();

    const renameInput = page.locator(
      `li[data-item-id="${itemId}"] input[type="text"]`
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
    const itemId = "delete-folder-1";
    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({
        json: {
          notesTree: [
            {
              id: itemId,
              label: itemName,
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
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page
        .getByRole("navigation", { name: "Notes and Tasks Tree" })
        .getByText(itemName)
    ).toBeVisible();

    await page.route(`**/api/items/${itemId}`, async (route) => {
      // For DELETE
      await route.fulfill({
        status: 200,
        json: { message: "Item deleted successfully" },
      });
    });
    // Mock for tree refresh AFTER delete
    await page.unroute("**/api/items/tree");
    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({ json: { notesTree: [] }, status: 200 });
    });

    page.on("dialog", async (dialog) => {
      expect(dialog.message()).toContain(`Delete "${itemName}"?`);
      await dialog.accept();
    });

    const folderItem = page.locator(`li[data-item-id="${itemId}"]`);
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

  test("should drag and drop a note into a folder", async ({ page }) => {
    const folderName = "Target Folder";
    const folderId = "folder-drag-target";
    const noteName = "Draggable Note";
    const noteId = "note-to-drag";

    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({
        json: {
          notesTree: [
            {
              id: folderId,
              label: folderName,
              type: "folder",
              children: [],
              createdAt: now,
              updatedAt: now,
            },
            {
              id: noteId,
              label: noteName,
              type: "note",
              content: "drag me",
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
        status: 200,
      });
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    const treeNav = page.getByRole("navigation", {
      name: "Notes and Tasks Tree",
    });
    await expect(treeNav.getByText(folderName)).toBeVisible();
    await expect(treeNav.getByText(noteName)).toBeVisible();

    // Mock for tree refresh AFTER D&D. Client side D&D updates updatedAt.
    // Server side PUT /api/items/tree would be the ultimate persistence.
    // For this E2E, we simulate the client's optimistic update.
    await page.unroute("**/api/items/tree");
    await page.route("**/api/items/tree", async (route) => {
      const newTimestamp = new Date().toISOString();
      await route.fulfill({
        json: {
          notesTree: [
            {
              id: folderId,
              label: folderName,
              type: "folder",
              createdAt: now,
              updatedAt: newTimestamp,
              children: [
                {
                  id: noteId,
                  label: noteName,
                  type: "note",
                  content: "drag me",
                  createdAt: now,
                  updatedAt: newTimestamp,
                },
              ],
            },
          ],
        },
        status: 200,
      });
    });

    const noteToDrag = page.locator(`li[data-item-id="${noteId}"]`);
    const folderToDropOn = page.locator(`li[data-item-id="${folderId}"]`);
    await noteToDrag.dragTo(folderToDropOn.locator("> div").first()); // Drag to the div inside li
    await page.waitForTimeout(500); // For drop processing and potential re-render

    const expandButton = folderToDropOn.getByRole("button", {
      name: `Expand ${folderName}`,
    });
    if (await expandButton.isVisible()) {
      await expandButton.click();
    }
    await expect(
      folderToDropOn.getByRole("button", { name: `Collapse ${folderName}` })
    ).toBeVisible();

    const noteInsideFolder = folderToDropOn.getByText(noteName, {
      exact: true,
    });
    await expect(noteInsideFolder).toBeVisible();
    // Check the note is no longer at the root
    await expect(
      treeNav.locator(`:scope > ul > li[data-item-id="${noteId}"]`)
    ).not.toBeVisible();
  });

  test("should cut and paste an item", async ({ page }) => {
    const folderToMoveName = "Folder To Move";
    const folderToMoveId = "folder-to-move-1";
    const targetFolderName = "Destination Folder";
    const targetFolderId = "target-folder-1";

    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({
        json: {
          notesTree: [
            {
              id: folderToMoveId,
              label: folderToMoveName,
              type: "folder",
              children: [],
              createdAt: now,
              updatedAt: now,
            },
            {
              id: targetFolderId,
              label: targetFolderName,
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
    await page.reload({ waitUntil: "domcontentloaded" });
    const treeNav = page.getByRole("navigation", {
      name: "Notes and Tasks Tree",
    });
    await expect(
      treeNav.getByText(folderToMoveName, { exact: true })
    ).toBeVisible();
    await expect(
      treeNav.getByText(targetFolderName, { exact: true })
    ).toBeVisible();

    // Mock for tree refresh AFTER paste.
    // Client side cut-paste updates updatedAt.
    await page.unroute("**/api/items/tree");
    await page.route("**/api/items/tree", async (route) => {
      const newTimestamp = new Date().toISOString();
      await route.fulfill({
        json: {
          notesTree: [
            {
              id: targetFolderId,
              label: targetFolderName,
              type: "folder",
              createdAt: now,
              updatedAt: newTimestamp,
              children: [
                {
                  id: folderToMoveId,
                  label: folderToMoveName,
                  type: "folder",
                  children: [],
                  createdAt: now,
                  updatedAt: newTimestamp,
                },
              ],
            },
          ],
        },
        status: 200,
      });
    });

    const itemToMove = treeNav.locator(`li[data-item-id="${folderToMoveId}"]`);
    await itemToMove.hover();
    await itemToMove
      .getByRole("button", { name: `More options for ${folderToMoveName}` })
      .click();
    await page.getByRole("button", { name: "Cut" }).click();

    const destinationFolder = treeNav.locator(
      `li[data-item-id="${targetFolderId}"]`
    );
    await destinationFolder.hover();
    await destinationFolder
      .getByRole("button", { name: `More options for ${targetFolderName}` })
      .click();
    await page.getByRole("button", { name: "Paste Here" }).click();
    await page.waitForTimeout(500);

    const expandButton = destinationFolder.getByRole("button", {
      name: `Expand ${targetFolderName}`,
    });
    if (await expandButton.isVisible()) {
      await expandButton.click();
    }
    await expect(
      destinationFolder.getByRole("button", {
        name: `Collapse ${targetFolderName}`,
      })
    ).toBeVisible();

    await expect(
      destinationFolder.getByText(folderToMoveName, { exact: true })
    ).toBeVisible();
    await expect(
      treeNav.locator(`:scope > ul > li[data-item-id="${folderToMoveId}"]`)
    ).not.toBeVisible();
  });

  test("should copy and paste an item (as a copy)", async ({ page }) => {
    const itemToCopyName = "Note to Copy";
    const itemToCopyId = "note-to-copy-1";
    const targetFolderName = "Paste Target Folder";
    const targetFolderId = "paste-target-folder-1";
    const copiedItemId = "server-copied-note-id"; // Server generates new ID for copy
    const newTimestamp = new Date().toISOString();

    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({
        json: {
          notesTree: [
            {
              id: itemToCopyId,
              label: itemToCopyName,
              type: "note",
              content: "original",
              createdAt: now,
              updatedAt: now,
            },
            {
              id: targetFolderId,
              label: targetFolderName,
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
    await page.reload({ waitUntil: "domcontentloaded" });
    const treeNav = page.getByRole("navigation", {
      name: "Notes and Tasks Tree",
    });
    await expect(
      treeNav.getByText(itemToCopyName, { exact: true })
    ).toBeVisible();
    await expect(
      treeNav.getByText(targetFolderName, { exact: true })
    ).toBeVisible();

    // Mock for addItem call during paste
    await page.route(`**/api/items/${targetFolderId}`, async (route) => {
      const reqBody = route.request().postDataJSON();
      // For copy, label might be suffixed by client if name exists, but here assume it's the first copy
      expect(reqBody.label).toBe(itemToCopyName);
      expect(reqBody.type).toBe("note");
      await route.fulfill({
        json: {
          id: copiedItemId,
          label: itemToCopyName,
          type: "note",
          content: "original",
          createdAt: newTimestamp,
          updatedAt: newTimestamp,
        },
        status: 201,
      });
    });
    // Mock for tree refresh AFTER paste
    await page.unroute("**/api/items/tree");
    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({
        json: {
          notesTree: [
            {
              id: itemToCopyId,
              label: itemToCopyName,
              type: "note",
              content: "original",
              createdAt: now,
              updatedAt: now,
            },
            {
              id: targetFolderId,
              label: targetFolderName,
              type: "folder",
              createdAt: now,
              updatedAt: newTimestamp,
              children: [
                {
                  id: copiedItemId,
                  label: itemToCopyName,
                  type: "note",
                  content: "original",
                  createdAt: newTimestamp,
                  updatedAt: newTimestamp,
                },
              ],
            },
          ],
        },
        status: 200,
      });
    });

    const itemToCopy = treeNav.locator(`li[data-item-id="${itemToCopyId}"]`);
    await itemToCopy.hover();
    await itemToCopy
      .getByRole("button", { name: `More options for ${itemToCopyName}` })
      .click();
    await page.getByRole("button", { name: "Copy", exact: true }).click();

    const destinationFolder = treeNav.locator(
      `li[data-item-id="${targetFolderId}"]`
    );
    await destinationFolder.hover();
    await destinationFolder
      .getByRole("button", { name: `More options for ${targetFolderName}` })
      .click();
    await page.getByRole("button", { name: "Paste Here" }).click();
    await page.waitForTimeout(500);

    const expandButton = destinationFolder.getByRole("button", {
      name: `Expand ${targetFolderName}`,
    });
    if (await expandButton.isVisible()) {
      await expandButton.click();
    }
    await expect(
      destinationFolder.getByRole("button", {
        name: `Collapse ${targetFolderName}`,
      })
    ).toBeVisible();

    await expect(
      destinationFolder.getByText(itemToCopyName, { exact: true })
    ).toBeVisible();
    await expect(
      treeNav
        .locator(`:scope > ul > li[data-item-id="${itemToCopyId}"]`)
        .getByText(itemToCopyName, { exact: true })
    ).toBeVisible();
  });

  test("should duplicate an item", async ({ page }) => {
    const itemToDuplicateName = "Original Note";
    const itemToDuplicateId = "original-note-1";
    const duplicatedItemNameExpected = `${itemToDuplicateName} (copy)`; // useTree logic adds (copy)
    const duplicatedItemId = "server-duplicated-note-id";
    const newTimestamp = new Date().toISOString();

    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({
        json: {
          notesTree: [
            {
              id: itemToDuplicateId,
              label: itemToDuplicateName,
              type: "note",
              content: "content",
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
        status: 200,
      });
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    const treeNav = page.getByRole("navigation", {
      name: "Notes and Tasks Tree",
    });
    await expect(
      treeNav.getByText(itemToDuplicateName, { exact: true })
    ).toBeVisible();

    // Mock for addItem call during duplicate (as it's added to same parent or root)
    await page.route(`**/api/items`, async (route) => {
      // Assuming duplicate of root item
      if (route.request().method() === "POST") {
        const reqBody = route.request().postDataJSON();
        expect(reqBody.label).toBe(duplicatedItemNameExpected);
        expect(reqBody.type).toBe("note");
        await route.fulfill({
          json: {
            id: duplicatedItemId,
            label: duplicatedItemNameExpected,
            type: "note",
            content: "content",
            createdAt: newTimestamp,
            updatedAt: newTimestamp,
          },
          status: 201,
        });
      } else {
        route.continue();
      }
    });
    // Mock for tree refresh AFTER duplicate
    await page.unroute("**/api/items/tree");
    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({
        json: {
          notesTree: [
            {
              id: itemToDuplicateId,
              label: itemToDuplicateName,
              type: "note",
              content: "content",
              createdAt: now,
              updatedAt: now,
            },
            {
              id: duplicatedItemId,
              label: duplicatedItemNameExpected,
              type: "note",
              content: "content",
              createdAt: newTimestamp,
              updatedAt: newTimestamp,
            },
          ],
        },
        status: 200,
      });
    });

    const itemToDuplicate = treeNav.locator(
      `li[data-item-id="${itemToDuplicateId}"]`
    );
    await itemToDuplicate.hover();
    await itemToDuplicate
      .getByRole("button", { name: `More options for ${itemToDuplicateName}` })
      .click();
    await page.getByRole("button", { name: "Duplicate" }).click();
    await page.waitForTimeout(500);

    await expect(
      treeNav.getByText(duplicatedItemNameExpected, { exact: true })
    ).toBeVisible();
    await expect(
      treeNav.getByText(itemToDuplicateName, { exact: true })
    ).toBeVisible();
  });
});
