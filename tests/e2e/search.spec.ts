import { test, expect, Page, Locator } from "@playwright/test";

async function loginAndSetupTree(page: Page) {
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

  const notesTree = [
    {
      id: "folder1",
      label: "Recipes",
      type: "folder",
      children: [
        {
          id: "note1",
          label: "Pasta Recipe",
          type: "note",
          content: "<p>Ingredients: pasta, tomatoes, garlic.</p>",
        },
        {
          id: "note2",
          label: "Cake Recipe",
          type: "note",
          content: "<p>Ingredients: flour, sugar, eggs.</p>",
        },
      ],
    },
    {
      id: "folder2",
      label: "Work Documents",
      type: "folder",
      children: [
        {
          id: "note3",
          label: "Project Plan",
          type: "note",
          content: "<p>Main plan for the project.</p>",
        },
        {
          id: "task1",
          label: "Submit Report",
          type: "task",
          content: "<p>Report details about pasta consumption.</p>",
          completed: false,
        },
      ],
    },
    {
      id: "note4",
      label: "Shopping List",
      type: "note",
      content: "<p>Tomatoes, pasta, eggs, milk.</p>",
    },
  ];
  await page.route("**/api/items/tree", async (route) => {
    await route.fulfill({ json: { notesTree }, status: 200 });
  });

  await page.locator("input#email-login").fill("test@example.com");
  await page.locator("input#password-login").fill("password");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(
    page.getByRole("heading", { name: "Notes & Tasks" })
  ).toBeVisible();
}

const getSearchSheetLocator = (page: Page): Locator => {
  return page.locator('[data-item-id="search-sheet-container"]');
};

// Revised Helper: Finds the clickable container of a search result item
// by checking if its main display paragraph contains the specified text substring.
const getSearchResultEntryLocator = (
  page: Page,
  searchSheetLocator: Locator,
  visibleTextSubstring: string
): Locator => {
  return searchSheetLocator
    .locator("div.p-3.sm\\:p-2.border-b") // This is the container for each search result item
    .filter({
      // Filter for containers that have a descendant p.text-base.md:text-sm containing the text
      has: page.locator("p.text-base.md\\:text-sm", {
        hasText: visibleTextSubstring,
      }),
    });
};

test.describe("Search Functionality", () => {
  test.beforeEach(async ({ page }) => {
    await loginAndSetupTree(page);
  });

  test("should open search sheet, find items by label, and select a result", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Search (Ctrl+Shift+F)" }).click();

    const searchSheet = getSearchSheetLocator(page);
    await expect(searchSheet).toBeVisible({ timeout: 10000 });

    const searchInput = searchSheet.locator("input#global-search-input");
    await expect(searchInput).toBeVisible();

    await searchInput.fill("Pasta");

    // When searching "Pasta", "Pasta Recipe" label matches.
    // "Submit Report" content contains "pasta".
    // "Shopping List" content contains "pasta".
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Pasta Recipe")
    ).toBeVisible();
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Submit Report")
    ).toBeVisible();
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Shopping List")
    ).toBeVisible();

    await getSearchResultEntryLocator(
      page,
      searchSheet,
      "Pasta Recipe"
    ).click();

    await expect(searchSheet).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator(".ProseMirror")).toContainText(
      "Ingredients: pasta, tomatoes, garlic."
    );
    await expect(
      page.getByRole("heading", { name: "Pasta Recipe" })
    ).toBeVisible();
  });

  test("should find items by content and respect case sensitivity option", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Search (Ctrl+Shift+F)" }).click();
    const searchSheet = getSearchSheetLocator(page);
    await expect(searchSheet).toBeVisible({ timeout: 10000 });
    const searchInput = searchSheet.locator("input#global-search-input");
    await expect(searchInput).toBeVisible();

    await searchInput.fill("tomatoes");
    // "Pasta Recipe" content: "...tomatoes..."
    // "Shopping List" content: "Tomatoes..."
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Pasta Recipe")
    ).toBeVisible();
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Shopping List")
    ).toBeVisible();
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Submit Report")
    ).not.toBeVisible();

    await searchSheet.getByRole("button", { name: "Case Sensitive" }).click();

    await searchInput.fill("Tomatoes"); // Exact case for "Shopping List"
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Pasta Recipe")
    ).not.toBeVisible(); // "tomatoes" != "Tomatoes"
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Shopping List")
    ).toBeVisible();

    await searchInput.fill("tomatoes"); // Lowercase, case-sensitive ON
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Pasta Recipe")
    ).toBeVisible(); // "tomatoes" == "tomatoes"
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Shopping List")
    ).not.toBeVisible(); // "Tomatoes" != "tomatoes"

    await searchSheet.getByRole("button", { name: "Case Sensitive" }).click(); // Toggle off
    await searchInput.fill("tomatoes");
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Pasta Recipe")
    ).toBeVisible();
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Shopping List")
    ).toBeVisible(); // Should now find "Tomatoes"
  });

  test("should find items with whole word option", async ({ page }) => {
    await page.getByRole("button", { name: "Search (Ctrl+Shift+F)" }).click();
    const searchSheet = getSearchSheetLocator(page);
    await expect(searchSheet).toBeVisible({ timeout: 10000 });
    const searchInput = searchSheet.locator("input#global-search-input");
    await expect(searchInput).toBeVisible();

    await searchInput.fill("plan");
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Project Plan")
    ).toBeVisible();

    await searchSheet.getByRole("button", { name: "Whole Word" }).click();
    await searchInput.fill("plan");
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Project Plan")
    ).toBeVisible();

    await searchInput.fill("pla");
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Project Plan")
    ).not.toBeVisible();

    await searchSheet.getByRole("button", { name: "Whole Word" }).click();
    await searchInput.fill("pla");
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Project Plan")
    ).toBeVisible();
  });

  test('should show "No matches" if search yields no results', async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Search (Ctrl+Shift+F)" }).click();
    const searchSheet = getSearchSheetLocator(page);
    await expect(searchSheet).toBeVisible({ timeout: 10000 });
    const searchInput = searchSheet.locator("input#global-search-input");
    await expect(searchInput).toBeVisible();

    await searchInput.fill("xyznonexistentquery123");
    await expect(searchSheet.getByText("No matches.")).toBeVisible();
  });

  test("should close search sheet with close button", async ({ page }) => {
    await page.getByRole("button", { name: "Search (Ctrl+Shift+F)" }).click();
    const searchSheet = getSearchSheetLocator(page);
    await expect(searchSheet).toBeVisible({ timeout: 10000 });

    await searchSheet.getByRole("button", { name: "Close Search" }).click();
    await expect(searchSheet).not.toBeVisible({ timeout: 5000 });
  });
});
