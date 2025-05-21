import { test, expect, Page } from "@playwright/test";
import * as fs from "fs"; // Use top-level static import for Node.js modules
import * as path from "path"; // Use top-level static import

async function loginAndOpenNote(
  page: Page,
  noteId: string,
  noteLabel: string,
  noteContent: string
) {
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
    await route.fulfill({
      json: {
        notesTree: [
          { id: noteId, label: noteLabel, type: "note", content: noteContent },
        ],
      },
      status: 200,
    });
  });

  await page.locator("input#email-login").fill("test@example.com");
  await page.locator("input#password-login").fill("password");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page.getByText(noteLabel, { exact: true })).toBeVisible();
  await page.getByText(noteLabel, { exact: true }).click(); // Select the note
  await expect(page.locator(".ProseMirror")).toBeVisible(); // [cite: 1478]
}

test.describe("Content Editor (TipTap)", () => {
  const noteId = "note-editor-1";
  const noteLabel = "Editable Note";
  const initialContent = "<p>Initial content.</p>";
  const updatedContentText = "This is updated content.";
  // const updatedContentHtml = `<p>${updatedContentText}</p>`; // Not directly used in assertion for this test

  test("should load existing content and allow editing", async ({ page }) => {
    await loginAndOpenNote(page, noteId, noteLabel, initialContent);

    const editor = page.locator(".ProseMirror"); // [cite: 1478]
    await expect(editor).toContainText("Initial content."); // Check initial content

    // Mock PATCH request for content update
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
          },
          status: 200,
        });
      } else {
        await route.continue();
      }
    });

    await editor.fill(""); // Clear existing content
    await editor.type(updatedContentText);

    // Wait for debounce/save to trigger
    await page.waitForTimeout(1500); // Wait for debouncedSaveContent from ContentEditor.jsx [cite: 26]

    expect(patchRequestBody).not.toBeNull();
    // TipTap might add an extra paragraph if cleared and typed, or keep the initial one.
    // So, check if the new text is present.
    expect(patchRequestBody.content).toContain(updatedContentText);

    await expect(editor).toContainText(updatedContentText);
  });

  test("should allow using toolbar buttons like bold", async ({ page }) => {
    await loginAndOpenNote(page, noteId, noteLabel, "<p>Make me bold.</p>");
    const editor = page.locator(".ProseMirror"); // [cite: 1478]
    await expect(editor).toContainText("Make me bold.");

    // Select text "Make me bold"
    // A more reliable way to select text in ProseMirror might be needed if this is flaky
    // For simple cases, focusing and sending select all, then typing, or using keyboard shortcuts might work.
    // Or, clicking to focus, then using keyboard to select:
    await editor.focus();
    await editor.press("Control+A"); // Or 'Meta+A' on macOS

    // Mock PATCH request
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
          },
          status: 200,
        });
      } else {
        await route.continue();
      }
    });

    // Click Bold button
    await page.getByRole("button", { name: "Bold" }).click(); // [cite: 411]

    await page.waitForTimeout(1500); // Wait for debounced save [cite: 26]

    expect(patchRequestBody).not.toBeNull();
    expect(patchRequestBody.content).toContain(
      "<strong>Make me bold.</strong>"
    );

    // Check if editor shows bolded text
    const boldElement = editor.locator("strong");
    await expect(boldElement).toBeVisible();
    await expect(boldElement).toHaveText("Make me bold.");
  });

  test("should add an image via file picker", async ({ page }) => {
    const imagePath = "tests/e2e/test-image.png"; // Ensure this file exists
    const imageUrlFromServer = "http://localhost:5001/uploads/test-image.png"; // Example server URL

    // Create a dummy image file for uploading if it doesn't exist
    const imageFilePath = path.resolve(imagePath);
    if (!fs.existsSync(imageFilePath)) {
      // Create a minimal valid PNG.
      const PngMinimal = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        "base64"
      );
      fs.writeFileSync(imageFilePath, PngMinimal);
      console.log(`Created dummy test image at: ${imageFilePath}`);
    }

    await loginAndOpenNote(
      page,
      noteId,
      noteLabel,
      "<p>Content before image.</p>"
    );

    // Mock image upload
    await page.route("**/api/images/upload", async (route) => {
      await route.fulfill({ json: { url: imageUrlFromServer }, status: 200 });
    });

    // Mock note content update after image is added
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

    await page.waitForTimeout(1500); // Wait for upload and save

    expect(patchRequestBody).not.toBeNull();
    // Use a regex to check for the img tag with the correct src, allowing for other attributes
    expect(patchRequestBody.content).toMatch(
      new RegExp(`<img[^>]*src="${imageUrlFromServer}"[^>]*>`)
    );

    await expect(
      page.locator(`.ProseMirror img[src="${imageUrlFromServer}"]`)
    ).toBeVisible();
  });
});
