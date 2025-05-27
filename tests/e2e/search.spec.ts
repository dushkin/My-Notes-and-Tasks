import { test, expect, Page, Locator } from "@playwright/test";

const now = new Date().toISOString();

const testItems = [
  {
    id: "f1",
    label: "Recipes",
    type: "folder",
    createdAt: now,
    updatedAt: now,
    children: [
      {
        id: "n1",
        label: "Pasta Recipe",
        type: "note",
        content:
          "<p>Ingredients: pasta, tomatoes, garlic.</p><p>Instructions: cook pasta, make sauce...</p>",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "n2",
        label: "Cake Recipe",
        type: "note",
        content: "<p>Flour, sugar, eggs.</p>",
        createdAt: now,
        updatedAt: now,
      },
    ],
  },
  {
    id: "f2",
    label: "Work Tasks",
    type: "folder",
    createdAt: now,
    updatedAt: now,
    children: [
      {
        id: "t1",
        label: "Submit Report",
        type: "task",
        completed: false,
        content: "<p>Finalize and submit Q3 report.</p>",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "t2",
        label: "Team Meeting",
        type: "task",
        completed: true,
        content: "<p>Discuss project updates.</p>",
        createdAt: now,
        updatedAt: now,
      },
    ],
  },
  {
    id: "n3",
    label: "Shopping List",
    type: "note",
    content: "<p>Milk, Bread, Pasta, Eggs</p>",
    createdAt: now,
    updatedAt: now,
  },
];

async function setupSearchTest(page: Page) {
  await page.goto("/");

  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      json: {
        accessToken: "fake-jwt-token",
        refreshToken: "fake-refresh-token",
        user: { id: "searchUser", email: "search@example.com" },
      },
      status: 200,
    });
  });
  await page.route("**/api/auth/verify-token", async (route) => {
    await route.fulfill({
      json: {
        valid: true,
        user: { id: "searchUser", email: "search@example.com" },
      },
      status: 200,
    });
  });
  await page.route("**/api/items/tree", async (route) => {
    await route.fulfill({ json: { notesTree: testItems }, status: 200 });
  });
  if (await page.locator("input#email-login").isVisible({ timeout: 2000 })) {
    await page.locator("input#email-login").fill("search@example.com");
    await page.locator("input#password-login").fill("password");
    await page.getByRole("button", { name: "Login" }).click();
  }
  await expect(
    page.getByRole("button", { name: "Search (Ctrl+Shift+F)" })
  ).toBeVisible({ timeout: 10000 });
}

function getSearchInput(searchSheet: Locator) {
  return searchSheet.locator("input#global-search-input");
}

function getSearchOptionButton(
  searchSheet: Locator,
  optionName: "Case Sensitive" | "Whole Word" | "Use Regular Expression"
) {
  return searchSheet.getByRole("button", { name: optionName });
}

function getSearchResultEntryLocator(
  page: Page,
  searchSheet: Locator,
  itemTextSnippet: string
) {
  return searchSheet
    .locator('div[class*="p-3 sm:p-2 border-b"]')
    .filter({
      has: page
        .locator('p[class*="text-base md:text-sm"]')
        .filter({
          hasText: new RegExp(
            itemTextSnippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
          ),
        }),
    });
}

test.describe("Search Functionality", () => {
  test.beforeEach(async ({ page }) => {
    await setupSearchTest(page);
  });

  test("should open search sheet, find items by label, and select a result", async ({
    page,
  }) => {
    const searchButton = page.getByRole("button", {
      name: "Search (Ctrl+Shift+F)",
    });
    await searchButton.click();

    const searchSheet = page.locator('[data-item-id="search-sheet-container"]');
    await expect(searchSheet).toBeVisible();

    const searchInput = getSearchInput(searchSheet);
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Report");
    await page.waitForTimeout(500);

    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Submit Report")
    ).toBeVisible();
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Shopping List")
    ).not.toBeVisible();

    const resultToSelect = getSearchResultEntryLocator(
      page,
      searchSheet,
      "Submit Report"
    );
    await resultToSelect.click();

    await expect(searchSheet).not.toBeVisible();
    await expect(page.locator(".ProseMirror")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Submit Report" })
    ).toBeVisible();
  });

  test("should find items by content and respect case sensitivity option", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Search (Ctrl+Shift+F)" }).click();
    const searchSheet = page.locator('[data-item-id="search-sheet-container"]');
    await expect(searchSheet).toBeVisible();
    const searchInput = getSearchInput(searchSheet);

    await searchInput.fill("pasta");
    await page.waitForTimeout(500);
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Pasta Recipe")
    ).toBeVisible({ timeout: 7000 });
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Shopping List")
    ).toBeVisible({ timeout: 7000 });

    const caseSensitiveButton = getSearchOptionButton(
      searchSheet,
      "Case Sensitive"
    );
    await caseSensitiveButton.click();
    await page.waitForTimeout(500);

    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Pasta Recipe")
    ).not.toBeVisible();
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Shopping List")
    ).not.toBeVisible();

    await searchInput.fill("Pasta");
    await page.waitForTimeout(500);
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Pasta Recipe")
    ).toBeVisible();
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Shopping List")
    ).toBeVisible();

    await caseSensitiveButton.click();
    await searchInput.fill("pasta");
    await page.waitForTimeout(500);
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Pasta Recipe")
    ).toBeVisible();
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Shopping List")
    ).toBeVisible();
  });

  test("should respect whole word option", async ({ page }) => {
    await page.getByRole("button", { name: "Search (Ctrl+Shift+F)" }).click();
    const searchSheet = page.locator('[data-item-id="search-sheet-container"]');
    await expect(searchSheet).toBeVisible();
    const searchInput = getSearchInput(searchSheet);
    const wholeWordButton = getSearchOptionButton(searchSheet, "Whole Word");

    await searchInput.fill("past");
    await page.waitForTimeout(500);
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Pasta Recipe")
    ).toBeVisible();

    await wholeWordButton.click();
    await page.waitForTimeout(500);

    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Pasta Recipe")
    ).not.toBeVisible();

    await searchInput.fill("Pasta");
    await page.waitForTimeout(500);
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Pasta Recipe")
    ).toBeVisible();
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Shopping List")
    ).toBeVisible();

    await wholeWordButton.click();
    await searchInput.fill("past");
    await page.waitForTimeout(500);
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Pasta Recipe")
    ).toBeVisible();
  });

  test("should show 'No matches' message", async ({ page }) => {
    await page.getByRole("button", { name: "Search (Ctrl+Shift+F)" }).click();
    const searchSheet = page.locator('[data-item-id="search-sheet-container"]');
    await expect(searchSheet).toBeVisible();
    const searchInput = getSearchInput(searchSheet);

    await searchInput.fill("NonExistentTermXYZ123");
    await page.waitForTimeout(500);

    await expect(searchSheet.getByText("No matches.")).toBeVisible();
  });

  test("should clear search results when query is cleared", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Search (Ctrl+Shift+F)" }).click();
    const searchSheet = page.locator('[data-item-id="search-sheet-container"]');
    await expect(searchSheet).toBeVisible();
    const searchInput = getSearchInput(searchSheet);

    await searchInput.fill("Report");
    await page.waitForTimeout(500);
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Submit Report")
    ).toBeVisible();

    await searchInput.fill("");
    await page.waitForTimeout(500);
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Submit Report")
    ).not.toBeVisible();
    await expect(searchSheet.getByText("No matches.")).toBeVisible();
  });

  test("should close search sheet with escape key", async ({ page }) => {
    await page.getByRole("button", { name: "Search (Ctrl+Shift+F)" }).click();
    const searchSheet = page.locator('[data-item-id="search-sheet-container"]');
    await expect(searchSheet).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(searchSheet).not.toBeVisible();
  });

  test("should close search sheet with close button", async ({ page }) => {
    await page.getByRole("button", { name: "Search (Ctrl+Shift+F)" }).click();
    const searchSheet = page.locator('[data-item-id="search-sheet-container"]');
    await expect(searchSheet).toBeVisible();

    const closeButton = searchSheet.getByRole("button", {
      name: "Close Search",
    });
    await closeButton.click();
    await expect(searchSheet).not.toBeVisible();
  });
});
