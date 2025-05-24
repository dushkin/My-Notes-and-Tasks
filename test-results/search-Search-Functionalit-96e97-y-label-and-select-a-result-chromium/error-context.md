# Test info

- Name: Search Functionality >> should open search sheet, find items by label, and select a result
- Location: C:\Users\TalTe\Dev Projects\my-notes-and-tasks\tests\e2e\search.spec.ts:100:3

# Error details

```
Error: Timed out 5000ms waiting for expect(locator).toBeVisible()

Locator: locator('[data-item-id="search-sheet-container"]').locator('div.p-3.sm\\:p-2.border-b').filter({ has: locator('p.text-base.md\\:text-sm').filter({ hasText: 'Submit Report' }) })
Expected: visible
Received: <element(s) not found>
Call log:
  - expect.toBeVisible with timeout 5000ms
  - waiting for locator('[data-item-id="search-sheet-container"]').locator('div.p-3.sm\\:p-2.border-b').filter({ has: locator('p.text-base.md\\:text-sm').filter({ hasText: 'Submit Report' }) })

    at C:\Users\TalTe\Dev Projects\my-notes-and-tasks\tests\e2e\search.spec.ts:121:7
```

# Page snapshot

```yaml
- banner:
  - heading "Notes & Tasks" [level=1]
  - button "Undo (Ctrl+Z)" [disabled]
  - button "Redo (Ctrl+Y)" [disabled]
  - button "Search (Ctrl+Shift+F)"
  - button "Settings"
  - button "More actions"
- main:
  - navigation "Notes and Tasks Tree":
    - list:
      - listitem:
        - button "Expand Recipes": ▸
        - text: Recipes
        - button "More options for Recipes"
      - listitem:
        - button "Expand Work Documents": ▸
        - text: Work Documents
        - button "More options for Work Documents"
      - listitem:
        - text: Shopping List
        - button "More options for Shopping List"
  - separator
  - text: Select or create an item to view or edit its content.
- textbox "Search...": Pasta
- button "Case Sensitive"
- button "Whole Word"
- button "Use Regular Expression (Disabled)" [disabled]
- button "Close Search"
- paragraph:
  - text: Recipes /
  - strong: Pasta
  - text: Recipe(label & content)
- paragraph:
  - strong: Pasta
  - text: Recipe
- paragraph: Work Documents / Submit Report(content)
- paragraph:
  - text: ...eport details about
  - strong: pasta
  - text: consumption.
- paragraph: Shopping List(content)
- paragraph:
  - text: Tomatoes,
  - strong: pasta
  - text: ", eggs, milk."
- button
```

# Test source

```ts
   21 |         {
   22 |           id: "note1",
   23 |           label: "Pasta Recipe",
   24 |           type: "note",
   25 |           content: "<p>Ingredients: pasta, tomatoes, garlic.</p>",
   26 |         },
   27 |         {
   28 |           id: "note2",
   29 |           label: "Cake Recipe",
   30 |           type: "note",
   31 |           content: "<p>Ingredients: flour, sugar, eggs.</p>",
   32 |         },
   33 |       ],
   34 |     },
   35 |     {
   36 |       id: "folder2",
   37 |       label: "Work Documents",
   38 |       type: "folder",
   39 |       children: [
   40 |         {
   41 |           id: "note3",
   42 |           label: "Project Plan",
   43 |           type: "note",
   44 |           content: "<p>Main plan for the project.</p>",
   45 |         },
   46 |         {
   47 |           id: "task1",
   48 |           label: "Submit Report",
   49 |           type: "task",
   50 |           content: "<p>Report details about pasta consumption.</p>",
   51 |           completed: false,
   52 |         },
   53 |       ],
   54 |     },
   55 |     {
   56 |       id: "note4",
   57 |       label: "Shopping List",
   58 |       type: "note",
   59 |       content: "<p>Tomatoes, pasta, eggs, milk.</p>",
   60 |     },
   61 |   ];
   62 |   await page.route("**/api/items/tree", async (route) => {
   63 |     await route.fulfill({ json: { notesTree }, status: 200 });
   64 |   });
   65 |
   66 |   await page.locator("input#email-login").fill("test@example.com");
   67 |   await page.locator("input#password-login").fill("password");
   68 |   await page.getByRole("button", { name: "Login" }).click();
   69 |   await expect(
   70 |     page.getByRole("heading", { name: "Notes & Tasks" })
   71 |   ).toBeVisible();
   72 | }
   73 |
   74 | const getSearchSheetLocator = (page: Page): Locator => {
   75 |   return page.locator('[data-item-id="search-sheet-container"]');
   76 | };
   77 |
   78 | // Revised Helper: Finds the clickable container of a search result item
   79 | // by checking if its main display paragraph contains the specified text substring.
   80 | const getSearchResultEntryLocator = (
   81 |   page: Page,
   82 |   searchSheetLocator: Locator,
   83 |   visibleTextSubstring: string
   84 | ): Locator => {
   85 |   return searchSheetLocator
   86 |     .locator("div.p-3.sm\\:p-2.border-b") // This is the container for each search result item
   87 |     .filter({
   88 |       // Filter for containers that have a descendant p.text-base.md:text-sm containing the text
   89 |       has: page.locator("p.text-base.md\\:text-sm", {
   90 |         hasText: visibleTextSubstring,
   91 |       }),
   92 |     });
   93 | };
   94 |
   95 | test.describe("Search Functionality", () => {
   96 |   test.beforeEach(async ({ page }) => {
   97 |     await loginAndSetupTree(page);
   98 |   });
   99 |
  100 |   test("should open search sheet, find items by label, and select a result", async ({
  101 |     page,
  102 |   }) => {
  103 |     await page.getByRole("button", { name: "Search (Ctrl+Shift+F)" }).click();
  104 |
  105 |     const searchSheet = getSearchSheetLocator(page);
  106 |     await expect(searchSheet).toBeVisible({ timeout: 10000 });
  107 |
  108 |     const searchInput = searchSheet.locator("input#global-search-input");
  109 |     await expect(searchInput).toBeVisible();
  110 |
  111 |     await searchInput.fill("Pasta");
  112 |
  113 |     // When searching "Pasta", "Pasta Recipe" label matches.
  114 |     // "Submit Report" content contains "pasta".
  115 |     // "Shopping List" content contains "pasta".
  116 |     await expect(
  117 |       getSearchResultEntryLocator(page, searchSheet, "Pasta Recipe")
  118 |     ).toBeVisible();
  119 |     await expect(
  120 |       getSearchResultEntryLocator(page, searchSheet, "Submit Report")
> 121 |     ).toBeVisible();
      |       ^ Error: Timed out 5000ms waiting for expect(locator).toBeVisible()
  122 |     await expect(
  123 |       getSearchResultEntryLocator(page, searchSheet, "Shopping List")
  124 |     ).toBeVisible();
  125 |
  126 |     await getSearchResultEntryLocator(
  127 |       page,
  128 |       searchSheet,
  129 |       "Pasta Recipe"
  130 |     ).click();
  131 |
  132 |     await expect(searchSheet).not.toBeVisible({ timeout: 5000 });
  133 |     await expect(page.locator(".ProseMirror")).toContainText(
  134 |       "Ingredients: pasta, tomatoes, garlic."
  135 |     );
  136 |     await expect(
  137 |       page.getByRole("heading", { name: "Pasta Recipe" })
  138 |     ).toBeVisible();
  139 |   });
  140 |
  141 |   test("should find items by content and respect case sensitivity option", async ({
  142 |     page,
  143 |   }) => {
  144 |     await page.getByRole("button", { name: "Search (Ctrl+Shift+F)" }).click();
  145 |     const searchSheet = getSearchSheetLocator(page);
  146 |     await expect(searchSheet).toBeVisible({ timeout: 10000 });
  147 |     const searchInput = searchSheet.locator("input#global-search-input");
  148 |     await expect(searchInput).toBeVisible();
  149 |
  150 |     await searchInput.fill("tomatoes");
  151 |     // "Pasta Recipe" content: "...tomatoes..."
  152 |     // "Shopping List" content: "Tomatoes..."
  153 |   
  154 |     const pastaRecipeResultText = searchSheet.getByText("Pasta Recipe");
  155 |     await expect(pastaRecipeResultText).toBeVisible({ timeout: 7000 }); // Increased timeout for this debug step
  156 |
  157 |     // If the above passes, then try your original locator for Pasta Recipe again, perhaps with a longer timeout
  158 |     await expect(
  159 |       getSearchResultEntryLocator(page, searchSheet, "Pasta Recipe")
  160 |     ).toBeVisible({ timeout: 7000 });
  161 |
  162 |
  163 |     // Then check for Shopping List
  164 |     const shoppingListResultText = searchSheet.getByText("Shopping List");
  165 |     await expect(shoppingListResultText).toBeVisible({ timeout: 7000 });
  166 |
  167 |     await expect(
  168 |       getSearchResultEntryLocator(page, searchSheet, "Shopping List")
  169 |     ).toBeVisible({ timeout: 7000 });
  170 |
  171 |     await expect(
  172 |       getSearchResultEntryLocator(page, searchSheet, "Submit Report")
  173 |     ).not.toBeVisible();
  174 |
  175 |     await searchSheet.getByRole("button", { name: "Case Sensitive" }).click();
  176 |
  177 |     await searchInput.fill("Tomatoes"); // Exact case for "Shopping List"
  178 |     await expect(
  179 |       getSearchResultEntryLocator(page, searchSheet, "Pasta Recipe")
  180 |     ).not.toBeVisible(); // "tomatoes" != "Tomatoes"
  181 |     await expect(
  182 |       getSearchResultEntryLocator(page, searchSheet, "Shopping List")
  183 |     ).toBeVisible();
  184 |
  185 |     await searchInput.fill("tomatoes"); // Lowercase, case-sensitive ON
  186 |     await expect(
  187 |       getSearchResultEntryLocator(page, searchSheet, "Pasta Recipe")
  188 |     ).toBeVisible(); // "tomatoes" == "tomatoes"
  189 |     await expect(
  190 |       getSearchResultEntryLocator(page, searchSheet, "Shopping List")
  191 |     ).not.toBeVisible(); // "Tomatoes" != "tomatoes"
  192 |
  193 |     await searchSheet.getByRole("button", { name: "Case Sensitive" }).click(); // Toggle off
  194 |     await searchInput.fill("tomatoes");
  195 |     await expect(
  196 |       getSearchResultEntryLocator(page, searchSheet, "Pasta Recipe")
  197 |     ).toBeVisible();
  198 |     await expect(
  199 |       getSearchResultEntryLocator(page, searchSheet, "Shopping List")
  200 |     ).toBeVisible(); // Should now find "Tomatoes"
  201 |   });
  202 |
  203 |   test("should find items with whole word option", async ({ page }) => {
  204 |     await page.getByRole("button", { name: "Search (Ctrl+Shift+F)" }).click();
  205 |     const searchSheet = getSearchSheetLocator(page);
  206 |     await expect(searchSheet).toBeVisible({ timeout: 10000 });
  207 |     const searchInput = searchSheet.locator("input#global-search-input");
  208 |     await expect(searchInput).toBeVisible();
  209 |
  210 |     await searchInput.fill("plan");
  211 |     await expect(
  212 |       getSearchResultEntryLocator(page, searchSheet, "Project Plan")
  213 |     ).toBeVisible();
  214 |
  215 |     await searchSheet.getByRole("button", { name: "Whole Word" }).click();
  216 |     await searchInput.fill("plan");
  217 |     await expect(
  218 |       getSearchResultEntryLocator(page, searchSheet, "Project Plan")
  219 |     ).toBeVisible();
  220 |
  221 |     await searchInput.fill("pla");
```