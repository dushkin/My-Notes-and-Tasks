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
    await page.reload();
    await expect(
      page
        .getByRole("navigation", { name: "Notes and Tasks Tree" })
        .getByText(folderName)
    ).toBeVisible();

    await page.route("**/api/items/folder-ctx-1", async (route) => {
      const requestBody = route.request().postDataJSON();
      expect(requestBody.label).toBe(noteName);
      expect(requestBody.type).toBe("note");
      await route.fulfill({
        json: { id: "note-1", label: noteName, type: "note", content: "" },
        status: 201,
      });
    });

    await page.route(
      "**/api/items/tree",
      async (route, request) => {
        if (request.method() === "GET") {
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

    const folderItem = page.locator(`li[data-item-id="folder-ctx-1"]`);
    await folderItem.hover();
    await folderItem
      .getByRole("button", { name: `More options for ${folderName}` })
      .click();

    await page.getByRole("button", { name: "Add Note Here" }).click();

    await expect(page.getByRole("heading", { name: "Add note" })).toBeVisible();
    await page.getByPlaceholder("Enter note name").fill(noteName);
    await page.getByRole("button", { name: "Add" }).click();

    await page.waitForLoadState("domcontentloaded");

    const expandButton = page.locator(
      `li[data-item-id="folder-ctx-1"] button[aria-label="Expand ${folderName}"]`
    );
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

    await page.route("**/api/items/delete-folder-1", async (route) => {
      await route.fulfill({
        status: 200,
        json: { message: "Item deleted successfully" },
      });
    });
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

  test("should drag and drop a note into a folder", async ({ page }) => {
    const folderName = "Target Folder";
    const noteName = "Draggable Note";

    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({
        json: {
          notesTree: [
            {
              id: "folder-drag-target",
              label: folderName,
              type: "folder",
              children: [],
            },
            {
              id: "note-to-drag",
              label: noteName,
              type: "note",
              content: "drag me",
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
        .getByText(folderName)
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Notes and Tasks Tree" })
        .getByText(noteName)
    ).toBeVisible();

    await page.route(
      "**/api/items/tree",
      async (route, request) => {
        if (request.method() === "GET") {
          await route.fulfill({
            json: {
              notesTree: [
                {
                  id: "folder-drag-target",
                  label: folderName,
                  type: "folder",
                  children: [
                    {
                      id: "note-to-drag",
                      label: noteName,
                      type: "note",
                      content: "drag me",
                    },
                  ],
                },
              ],
            },
            status: 200,
          });
        } else {
          route.continue();
        }
      },
      { times: 1 }
    );

    const noteToDrag = page.locator('li[data-item-id="note-to-drag"]');
    const folderToDropOn = page.locator(
      'li[data-item-id="folder-drag-target"]'
    );

    await noteToDrag.dragTo(folderToDropOn);

    await page.waitForTimeout(500);

    const expandButton = folderToDropOn.getByRole("button", {
      name: `Expand ${folderName}`,
    });
    const isExpanded = await folderToDropOn
      .getByRole("button", { name: `Collapse ${folderName}` })
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    if (!isExpanded && (await expandButton.isVisible())) {
      await expandButton.click();
    }

    const treeNavigation = page.getByRole("navigation", {
      name: "Notes and Tasks Tree",
    });
    const noteInsideFolder = folderToDropOn.getByText(noteName, {
      exact: true,
    });
    await expect(noteInsideFolder).toBeVisible();

    await expect(
      treeNavigation.locator(`:scope > ul > li[data-item-id="note-to-drag"]`)
    ).not.toBeVisible();
  });

  test("should cut and paste an item", async ({ page }) => {
    const folderToMoveName = "Folder To Move";
    const targetFolderName = "Destination Folder";

    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({
        json: {
          notesTree: [
            {
              id: "folder-to-move-1",
              label: folderToMoveName,
              type: "folder",
              children: [],
            },
            {
              id: "target-folder-1",
              label: targetFolderName,
              type: "folder",
              children: [],
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
    await expect(
      treeNav.getByText(folderToMoveName, { exact: true })
    ).toBeVisible();
    await expect(
      treeNav.getByText(targetFolderName, { exact: true })
    ).toBeVisible();

    await page.route(
      "**/api/items/tree",
      async (route, request) => {
        if (request.method() === "GET") {
          await route.fulfill({
            json: {
              notesTree: [
                {
                  id: "target-folder-1",
                  label: targetFolderName,
                  type: "folder",
                  children: [
                    {
                      id: "folder-to-move-1",
                      label: folderToMoveName,
                      type: "folder",
                      children: [],
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

    const itemToMove = treeNav.locator('li[data-item-id="folder-to-move-1"]');
    await itemToMove.hover();
    await itemToMove
      .getByRole("button", { name: `More options for ${folderToMoveName}` })
      .click();
    await page.getByRole("button", { name: "Cut" }).click();

    const destinationFolder = treeNav.locator(
      'li[data-item-id="target-folder-1"]'
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
    const isExpanded = await destinationFolder
      .getByRole("button", { name: `Collapse ${targetFolderName}` })
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    if (!isExpanded && (await expandButton.isVisible())) {
      await expandButton.click();
    }

    await expect(
      destinationFolder.getByText(folderToMoveName, { exact: true })
    ).toBeVisible();
    await expect(
      treeNav.locator(`:scope > ul > li[data-item-id="folder-to-move-1"]`)
    ).not.toBeVisible();
  });

  test("should copy and paste an item (as a copy)", async ({ page }) => {
    const itemToCopyName = "Note to Copy";
    const targetFolderName = "Paste Target Folder";
    const expectedLabelInApiCall = itemToCopyName;
    const expectedLabelInTreeAfterPaste = itemToCopyName;

    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({
        json: {
          notesTree: [
            {
              id: "note-to-copy-1",
              label: itemToCopyName,
              type: "note",
              content: "original",
            },
            {
              id: "paste-target-folder-1",
              label: targetFolderName,
              type: "folder",
              children: [],
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
    await expect(
      treeNav.getByText(itemToCopyName, { exact: true })
    ).toBeVisible();
    await expect(
      treeNav.getByText(targetFolderName, { exact: true })
    ).toBeVisible();

    await page.route(`**/api/items/paste-target-folder-1`, async (route) => {
      const reqBody = route.request().postDataJSON();
      expect(reqBody.label).toBe(expectedLabelInApiCall);
      expect(reqBody.type).toBe("note");
      await route.fulfill({
        json: {
          id: "copied-note-id",
          label: expectedLabelInApiCall,
          type: "note",
          content: "original",
        },
        status: 201,
      });
    });

    await page.route(
      "**/api/items/tree",
      async (route, request) => {
        if (request.method() === "GET") {
          await route.fulfill({
            json: {
              notesTree: [
                {
                  id: "note-to-copy-1",
                  label: itemToCopyName,
                  type: "note",
                  content: "original",
                },
                {
                  id: "paste-target-folder-1",
                  label: targetFolderName,
                  type: "folder",
                  children: [
                    {
                      id: "copied-note-id",
                      label: expectedLabelInTreeAfterPaste,
                      type: "note",
                      content: "original",
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

    const itemToCopy = treeNav.locator('li[data-item-id="note-to-copy-1"]');
    await itemToCopy.hover();
    await itemToCopy
      .getByRole("button", { name: `More options for ${itemToCopyName}` })
      .click();
    await page.getByRole("button", { name: "Copy", exact: true }).click();

    const destinationFolder = treeNav.locator(
      'li[data-item-id="paste-target-folder-1"]'
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
    const isExpanded = await destinationFolder
      .getByRole("button", { name: `Collapse ${targetFolderName}` })
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    if (!isExpanded && (await expandButton.isVisible())) {
      await expandButton.click();
    }

    await expect(
      destinationFolder.getByText(expectedLabelInTreeAfterPaste, {
        exact: true,
      })
    ).toBeVisible();
    // Verify the original item is still at the root
    await expect(
      treeNav
        .locator(':scope > ul > li[data-item-id="note-to-copy-1"]')
        .getByText(itemToCopyName, { exact: true })
    ).toBeVisible();
  });

  test("should duplicate an item", async ({ page }) => {
    const itemToDuplicateName = "Original Note";
    const duplicatedItemNameExpected = `${itemToDuplicateName} (copy)`;

    await page.route("**/api/items/tree", async (route) => {
      await route.fulfill({
        json: {
          notesTree: [
            {
              id: "original-note-1",
              label: itemToDuplicateName,
              type: "note",
              content: "content",
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
    await expect(
      treeNav.getByText(itemToDuplicateName, { exact: true })
    ).toBeVisible();

    await page.route(`**/api/items`, async (route) => {
      if (route.request().method() === "POST") {
        const reqBody = route.request().postDataJSON();
        expect(reqBody.label).toBe(duplicatedItemNameExpected);
        expect(reqBody.type).toBe("note");
        await route.fulfill({
          json: {
            id: "duplicated-note-id",
            label: duplicatedItemNameExpected,
            type: "note",
            content: "content",
          },
          status: 201,
        });
      } else {
        route.continue();
      }
    });

    await page.route(
      "**/api/items/tree",
      async (route, request) => {
        if (request.method() === "GET") {
          await route.fulfill({
            json: {
              notesTree: [
                {
                  id: "original-note-1",
                  label: itemToDuplicateName,
                  type: "note",
                  content: "content",
                },
                {
                  id: "duplicated-note-id",
                  label: duplicatedItemNameExpected,
                  type: "note",
                  content: "content",
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

    const itemToDuplicate = treeNav.locator(
      'li[data-item-id="original-note-1"]'
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
