import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

declare global {
  interface Window {
    fetchUserTree: () => Promise<void>;
  }
}

const now = new Date().toISOString();

async function loginAndOpenNote(
  page: Page,
  noteId: string,
  noteLabel: string,
  noteContent: string
) {
  // For debugging: Log all outgoing requests before setting up mocks
  page.on("request", (request) =>
    console.log("[DEBUG] Outgoing request detected:", request.url())
  );

  page.on("response", (response) =>
    console.log("[DEBUG] Response received:", response.status(), response.url())
  );

  const treeMockUrlPattern = "**/api/items/tree";
  let treeMockHit = false;

  console.log("Registering mock for /api/items/tree...");
  await page.route(treeMockUrlPattern, async (route) => {
    console.log(
      `[Test DEBUG] Intercepted route for /api/items/tree. Fulfilling with note: ${noteLabel}`
    );
    treeMockHit = true;
    await route.fulfill({
      json: {
        notesTree: [
          {
            id: noteId,
            label: noteLabel,
            type: "note",
            content: noteContent,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
      status: 200,
    });
  });

  console.log("Mock registered successfully.");

  await page.goto("/");

  // Ensure a valid token is stored before any API requests.
  await page.evaluate(() => {
    console.log("[DEBUG] Storing fake token in localStorage...");
    localStorage.setItem("userToken", "fake-jwt-token");
  });

  // Log token before making any request to verify it's set correctly
  await page.evaluate(() => {
    console.log(
      "[DEBUG] Token before fetch:",
      localStorage.getItem("userToken")
    );
  });

  // Unroute and re-route auth endpoints for login
  await page.unroute("**/api/auth/login");
  await page.unroute("**/api/auth/verify-token");

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
    await route.fulfill({ json: { valid: false }, status: 200 });
  });

  // Log in to the app
  await page.locator("input#email-login").fill("test@example.com");
  await page.locator("input#password-login").fill("password");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(
    page.getByRole("heading", { name: "Notes & Tasks" })
  ).toBeVisible({ timeout: 10000 });

  // Allow a brief delay for React state updates
  await page.waitForTimeout(500);

  // Set up a listener for the /api/items/tree response before triggering fetchUserTree
  console.log("[DEBUG] Setting up response listener for /api/items/tree...");
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/items/tree") && response.status() === 200,
    { timeout: 10000 }
  );

  // Manually trigger the tree fetch (ensuring it sends a valid token)
  await page.evaluate(() => {
    console.log("[DEBUG] Manually triggering fetchUserTree...");
    (window as any).fetchUserTree();
  });

  // Await the response and verify it was successful
  const response = await responsePromise;
  console.log(
    "[DEBUG] Received /api/items/tree response with status:",
    response.status()
  );

  // Verify that the tree mock was hit
  expect(
    treeMockHit,
    "/api/items/tree mock was not hit after login and manual trigger."
  ).toBe(true);

  // Continue with UI validations
  const treeNavigationArea = page.getByRole("navigation", {
    name: "Notes and Tasks Tree",
  });
  await expect(treeNavigationArea).toBeVisible({ timeout: 10000 });

  const noteItemLocator = treeNavigationArea.locator(
    `li[data-item-id="${noteId}"]`
  );
  await expect(noteItemLocator).toBeVisible({ timeout: 15000 });
  await expect(
    noteItemLocator.getByText(noteLabel, { exact: true })
  ).toBeVisible({
    timeout: 5000,
  });

  await noteItemLocator.click();
  await expect(page.locator(".ProseMirror")).toBeVisible();
}

// Rest of the file (test.describe block) remains the same
test.describe("Content Editor (TipTap)", () => {
  const noteId = "note-editor-1";
  const noteLabel = "Editable Note";
  const initialContent = "<p>Initial content.</p>";
  const updatedContentText = "This is updated content.";
  const debouncedSaveTime = 1500;

  test("should load existing content and allow editing", async ({
    page,
  }) => {
    await loginAndOpenNote(page, noteId, noteLabel, initialContent);

    const editor = page.locator(".ProseMirror");
    await expect(editor).toContainText("Initial content.");

    let patchRequestBody: any = null;
    await page.route(`**/api/items/${noteId}`, async (route, request) => {
      if (request.method() === "PATCH") {
        patchRequestBody = request.postDataJSON();
        await route.fulfill({
          json: {
            id: noteId,
            label: noteLabel,
            type: "note",
            content: patchRequestBody.content,
            direction: patchRequestBody.direction || "ltr",
            createdAt: now,
            updatedAt: new Date().toISOString(),
          },
          status: 200,
        });
      } else {
        await route.continue();
      }
    });

    await editor.fill("");
    await editor.type(updatedContentText);
    await page.waitForTimeout(debouncedSaveTime);

    expect(patchRequestBody).not.toBeNull();
    expect(patchRequestBody.content).toContain(updatedContentText);
    await expect(editor).toContainText(updatedContentText);
  });

  test("should allow using toolbar buttons like bold", async ({ page }) => {
    await loginAndOpenNote(page, noteId, noteLabel, "<p>Make me bold.</p>");
    const editor = page.locator(".ProseMirror");
    await expect(editor).toContainText("Make me bold.");

    await editor.focus();
    await editor.press("Control+A");

    let patchRequestBody: any = null;
    await page.route(`**/api/items/${noteId}`, async (route, request) => {
      if (request.method() === "PATCH") {
        patchRequestBody = request.postDataJSON();
        await route.fulfill({
          json: {
            id: noteId,
            label: noteLabel,
            type: "note",
            content: patchRequestBody.content,
            direction: patchRequestBody.direction || "ltr",
            createdAt: now,
            updatedAt: new Date().toISOString(),
          },
          status: 200,
        });
      } else {
        await route.continue();
      }
    });
    await page.getByRole("button", { name: "Bold" }).click();
    await page.waitForTimeout(debouncedSaveTime);

    expect(patchRequestBody).not.toBeNull();
    expect(patchRequestBody.content).toContain(
      "<strong>Make me bold.</strong>"
    );
    const boldElement = editor.locator("strong");
    await expect(boldElement).toBeVisible();
    await expect(boldElement).toHaveText("Make me bold.");
  });

  test("should add an image via file picker", async ({ page }) => {
    const imagePath = "tests/e2e/test-image.png";
    const imageUrlFromServer = "http://localhost:5001/uploads/test-image.png";

    const imageFilePath = path.resolve(imagePath);
    if (!fs.existsSync(imageFilePath)) {
      const PngMinimal = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        "base64"
      );
      fs.writeFileSync(imageFilePath, PngMinimal);
    }

    await loginAndOpenNote(
      page,
      noteId,
      noteLabel,
      "<p>Content before image.</p>"
    );

    await page.route("**/api/images/upload", async (route) => {
      await route.fulfill({ json: { url: imageUrlFromServer }, status: 200 });
    });

    let patchRequestBody: any = null;
    await page.route(`**/api/items/${noteId}`, async (route, request) => {
      if (request.method() === "PATCH") {
        patchRequestBody = request.postDataJSON();
        await route.fulfill({
          json: {
            id: noteId,
            label: noteLabel,
            type: "note",
            content: patchRequestBody.content,
            direction: patchRequestBody.direction || "ltr",
            createdAt: now,
            updatedAt: new Date().toISOString(),
          },
          status: 200,
        });
      } else {
        await route.continue();
      }
    });
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Upload Image" }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(imageFilePath);

    await page.waitForTimeout(debouncedSaveTime + 500);

    expect(patchRequestBody).not.toBeNull();
    expect(patchRequestBody.content).toMatch(
      new RegExp(`<img[^>]*src="${imageUrlFromServer}"[^>]*>`)
    );
    await expect(
      page.locator(`.ProseMirror img[src="${imageUrlFromServer}"]`)
    ).toBeVisible();
  });
});
