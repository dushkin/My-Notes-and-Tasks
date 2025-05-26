import { test, expect, Page, Locator } from "@playwright/test";

const testItems = [
  { id: "f1", label: "Recipes", type: "folder", children: [
      { id: "n1", label: "Pasta Recipe", type: "note", content: "<p>Ingredients: pasta, tomatoes, garlic.</p><p>Instructions: cook pasta, make sauce...</p>", createdAt: "2023-01-01T10:00:00Z", updatedAt: "2023-01-01T11:00:00Z"},
      { id: "n2", label: "Cake Recipe", type: "note", content: "<p>Flour, sugar, eggs.</p>", createdAt: "2023-01-02T10:00:00Z", updatedAt: "2023-01-02T11:00:00Z" }
    ], createdAt: "2023-01-01T09:00:00Z", updatedAt: "2023-01-01T09:00:00Z" },
  { id: "f2", label: "Work Tasks", type: "folder", children: [
      { id: "t1", label: "Submit Report", type: "task", completed: false, content: "<p>Finalize and submit Q3 report.</p>", createdAt: "2023-01-03T10:00:00Z", updatedAt: "2023-01-03T11:00:00Z" },
      { id: "t2", label: "Team Meeting", type: "task", completed: true, content: "<p>Discuss project updates.</p>", createdAt: "2023-01-04T10:00:00Z", updatedAt: "2023-01-04T11:00:00Z" }
    ], createdAt: "2023-01-03T09:00:00Z", updatedAt: "2023-01-03T09:00:00Z" },
  { id: "n3", label: "Shopping List", type: "note", content: "<p>Milk, Bread, Pasta, Eggs</p>", createdAt: "2023-01-05T10:00:00Z", updatedAt: "2023-01-05T11:00:00Z" },
];


async function setupSearchTest(page: Page) {
  await page.goto("/");

  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      json: {
        token: "fake-jwt-token",
        user: { id: "searchUser", email: "search@example.com" },
      },
      status: 200,
    });
  });

  await page.route("**/api/items/tree", async (route) => {
    await route.fulfill({ json: { notesTree: testItems }, status: 200 });
  });

  if (await page.locator("input#email-login").isVisible({timeout: 2000})) {
    await page.locator("input#email-login").fill("search@example.com");
    await page.locator("input#password-login").fill("password");
    await page.getByRole("button", { name: "Login" }).click();
  }
  await expect(page.getByRole('button', { name: 'Search (Ctrl+Shift+F)'})).toBeVisible({timeout: 10000});
}

function getSearchInput(page: Page, searchSheet: Locator) {
  return searchSheet.locator('input#global-search-input');
}

function getSearchOptionButton(searchSheet: Locator, optionName: 'Case Sensitive' | 'Whole Word' | 'Use Regular Expression') {
  return searchSheet.getByRole('button', { name: optionName });
}

function getSearchResultEntryLocator(page: Page, searchSheet: Locator, itemText: string) {
  // This locator finds a search result item div that contains a paragraph with the specified itemText.
  // It's specific to the structure in SearchResultsPane.jsx
  return searchSheet
    .locator('div.p-3.sm\\:p-2.border-b') // The container div for each result item
    .filter({ has: page.locator('p.text-base.md\\:text-sm').filter({ hasText: itemText }) });
}


test.describe("Search Functionality", () => {
  test.beforeEach(async ({ page }) => {
    await setupSearchTest(page);
  });

  test("should open search sheet, find items by label, and select a result", async ({ page }) => {
    const searchButton = page.getByRole('button', { name: 'Search (Ctrl+Shift+F)'});
    await searchButton.click();

    const searchSheet = page.locator('[data-item-id="search-sheet-container"]');
    await expect(searchSheet).toBeVisible();

    const searchInput = getSearchInput(page, searchSheet);
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Report");

    // Wait for results to potentially load/filter
    await page.waitForTimeout(500); // Small delay for UI update

    await expect(
        getSearchResultEntryLocator(page, searchSheet, "Submit Report")
      ).toBeVisible();
    await expect(
        getSearchResultEntryLocator(page, searchSheet, "Shopping List")
      ).not.toBeVisible(); // Assuming "Report" doesn't match "Shopping List" label significantly

    const resultToSelect = getSearchResultEntryLocator(page, searchSheet, "Submit Report");
    await resultToSelect.click();

    await expect(searchSheet).not.toBeVisible(); // Sheet should close
    await expect(page.locator(".ProseMirror")).toBeVisible(); // Editor should be visible
    await expect(page.getByRole('heading', { name: 'Submit Report'})).toBeVisible(); // Selected item's title in editor
  });


  test("should find items by content and respect case sensitivity option", async ({ page }) => {
    await page.getByRole('button', { name: 'Search (Ctrl+Shift+F)'}).click();
    const searchSheet = page.locator('[data-item-id="search-sheet-container"]');
    await expect(searchSheet).toBeVisible();
    const searchInput = getSearchInput(page, searchSheet);

    // Search for "pasta" (lowercase) - case-insensitive by default
    await searchInput.fill("pasta");
    await page.waitForTimeout(500);

    // Simpler check for "Pasta Recipe" text first for debugging
    const pastaRecipeResultTextSimple = searchSheet.getByText("Pasta Recipe");
    await expect(pastaRecipeResultTextSimple).toBeVisible({ timeout: 7000 });

    // Original locator (if the simple one passes, this one should ideally pass too)
    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Pasta Recipe")
    ).toBeVisible({ timeout: 7000 });

    const shoppingListResultTextSimple = searchSheet.getByText("Shopping List");
    await expect(shoppingListResultTextSimple).toBeVisible({ timeout: 7000 });

    await expect(
      getSearchResultEntryLocator(page, searchSheet, "Shopping List")
    ).toBeVisible({ timeout: 7000 });


    // Enable Case Sensitive search
    const caseSensitiveButton = getSearchOptionButton(searchSheet, "Case Sensitive");
    await caseSensitiveButton.click();
    await page.waitForTimeout(500); // Wait for search to re-run with new option

    // "pasta" (lowercase) should NOT find "Pasta Recipe" or "Shopping List" (which contains "Pasta") when case-sensitive
    await expect(getSearchResultEntryLocator(page, searchSheet, "Pasta Recipe")).not.toBeVisible();
    await expect(getSearchResultEntryLocator(page, searchSheet, "Shopping List")).not.toBeVisible();


    // Search for "Pasta" (uppercase) - case-sensitive
    await searchInput.fill("Pasta");
    await page.waitForTimeout(500);
    await expect(getSearchResultEntryLocator(page, searchSheet, "Pasta Recipe")).toBeVisible(); // Should find "Pasta Recipe" by label/title
    await expect(getSearchResultEntryLocator(page, searchSheet, "Shopping List")).toBeVisible(); // Should find "Shopping List" by content "Pasta"


    // Disable Case Sensitive search again
    await caseSensitiveButton.click();
    await searchInput.fill("pasta"); // back to lowercase
    await page.waitForTimeout(500);
    await expect(getSearchResultEntryLocator(page, searchSheet, "Pasta Recipe")).toBeVisible();
    await expect(getSearchResultEntryLocator(page, searchSheet, "Shopping List")).toBeVisible();
  });


  test("should respect whole word option", async ({ page }) => {
    await page.getByRole('button', { name: 'Search (Ctrl+Shift+F)'}).click();
    const searchSheet = page.locator('[data-item-id="search-sheet-container"]');
    await expect(searchSheet).toBeVisible();
    const searchInput = getSearchInput(page, searchSheet);
    const wholeWordButton = getSearchOptionButton(searchSheet, "Whole Word");

    // Search for "past" - should find "Pasta Recipe" (substring match)
    await searchInput.fill("past");
    await page.waitForTimeout(500);
    await expect(getSearchResultEntryLocator(page, searchSheet, "Pasta Recipe")).toBeVisible();

    // Enable Whole Word
    await wholeWordButton.click();
    await page.waitForTimeout(500); // Wait for search to re-run

    // "past" should NOT find "Pasta Recipe" when whole word is enabled
    await expect(getSearchResultEntryLocator(page, searchSheet, "Pasta Recipe")).not.toBeVisible();

    // Search for "Pasta" (whole word)
    await searchInput.fill("Pasta");
    await page.waitForTimeout(500);
    await expect(getSearchResultEntryLocator(page, searchSheet, "Pasta Recipe")).toBeVisible(); // Found by label
    await expect(getSearchResultEntryLocator(page, searchSheet, "Shopping List")).toBeVisible(); // Found by content "Pasta"


    // Disable Whole Word again
    await wholeWordButton.click();
    await searchInput.fill("past");
    await page.waitForTimeout(500);
    await expect(getSearchResultEntryLocator(page, searchSheet, "Pasta Recipe")).toBeVisible();
  });

  test("should show 'No matches' message", async ({ page }) => {
    await page.getByRole('button', { name: 'Search (Ctrl+Shift+F)'}).click();
    const searchSheet = page.locator('[data-item-id="search-sheet-container"]');
    await expect(searchSheet).toBeVisible();
    const searchInput = getSearchInput(page, searchSheet);

    await searchInput.fill("NonExistentTermXYZ123");
    await page.waitForTimeout(500);

    await expect(searchSheet.getByText("No matches.")).toBeVisible();
  });

  test("should clear search results when query is cleared", async ({ page }) => {
    await page.getByRole('button', { name: 'Search (Ctrl+Shift+F)'}).click();
    const searchSheet = page.locator('[data-item-id="search-sheet-container"]');
    await expect(searchSheet).toBeVisible();
    const searchInput = getSearchInput(page, searchSheet);

    await searchInput.fill("Report");
    await page.waitForTimeout(500);
    await expect(getSearchResultEntryLocator(page, searchSheet, "Submit Report")).toBeVisible();

    await searchInput.fill("");
    await page.waitForTimeout(500);
    // "No matches" might appear briefly or the list just becomes empty.
    // Depending on implementation, either check for "No matches" or that previous results are gone.
    await expect(getSearchResultEntryLocator(page, searchSheet, "Submit Report")).not.toBeVisible();
    // If an empty query shows "No matches":
    // await expect(searchSheet.getByText("No matches.")).toBeVisible();
  });

  test("should close search sheet with escape key", async ({ page }) => {
    await page.getByRole('button', { name: 'Search (Ctrl+Shift+F)'}).click();
    const searchSheet = page.locator('[data-item-id="search-sheet-container"]');
    await expect(searchSheet).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(searchSheet).not.toBeVisible();
  });

  test("should close search sheet with close button", async ({ page }) => {
    await page.getByRole('button', { name: 'Search (Ctrl+Shift+F)'}).click();
    const searchSheet = page.locator('[data-item-id="search-sheet-container"]');
    await expect(searchSheet).toBeVisible();

    const closeButton = searchSheet.getByRole('button', { name: 'Close Search' });
    await closeButton.click();
    await expect(searchSheet).not.toBeVisible();
  });
});