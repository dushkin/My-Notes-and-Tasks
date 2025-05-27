import { test, expect, Page, Locator } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const NOTE_ID_FOR_EDITOR_TESTS = "editor-test-note-id";
const NOTE_LABEL_FOR_EDITOR_TESTS = "Tiptap Test Note";

interface SavedItemData {
  id?: string;
  content?: string;
  direction?: "ltr" | "rtl";
  type?: string;
  label?: string;
  createdAt?: string;
  updatedAt?: string;
}

let lastSavedData: SavedItemData | null = null;
const saveDebounceTime = 1000; // Aligned with ContentEditor.jsx
const waitForSaveTimeout = saveDebounceTime + 500;

const formatDateForDisplay = (isoString: string): string => {
  if (!isoString || isNaN(new Date(isoString).getTime())) return "Invalid Date";
  return new Date(isoString).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

async function setupEditorTest(
  page: Page,
  initialContent: string = "<p></p>",
  initialDirection: "ltr" | "rtl" = "ltr",
  initialTimestamps?: { createdAt?: string; updatedAt?: string }
) {
  lastSavedData = null;
  await page.unroute("**/api/auth/login");
  await page.unroute("**/api/items/tree");
  await page.unroute(`**/api/items/${NOTE_ID_FOR_EDITOR_TESTS}`);
  await page.unroute("**/api/auth/verify-token");

  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      json: {
        accessToken: "fake-jwt-token",
        refreshToken: "fake-refresh-token",
        user: { id: "user123", email: "test@example.com" },
      },
      status: 200,
    });
  });
  await page.route("**/api/auth/verify-token", async (route) => {
    await route.fulfill({
      json: { valid: true, user: { id: "user123", email: "test@example.com" } },
      status: 200,
    });
  });

  const now = new Date().toISOString();
  const noteData = {
    id: NOTE_ID_FOR_EDITOR_TESTS,
    label: NOTE_LABEL_FOR_EDITOR_TESTS,
    type: "note",
    content: initialContent,
    direction: initialDirection,
    createdAt: initialTimestamps?.createdAt || now,
    updatedAt: initialTimestamps?.updatedAt || now,
  };
  await page.route("**/api/items/tree", async (route) => {
    await route.fulfill({
      json: {
        notesTree: [noteData],
      },
      status: 200,
    });
  });
  await page.route(
    `**/api/items/${NOTE_ID_FOR_EDITOR_TESTS}`,
    async (route, request) => {
      if (request.method() === "PATCH") {
        const requestBody = request.postDataJSON() as SavedItemData;
        const currentServerTimestamp = new Date().toISOString();
        lastSavedData = {
          // Simulate server response
          id: NOTE_ID_FOR_EDITOR_TESTS,
          label: NOTE_LABEL_FOR_EDITOR_TESTS,
          type: "note",
          content: requestBody.content,
          direction: requestBody.direction,
          createdAt: noteData.createdAt, // CreatedAt should not change on update
          updatedAt: currentServerTimestamp,
        };
        await route.fulfill({
          json: lastSavedData,
          status: 200,
        });
      } else {
        await route.continue();
      }
    }
  );
  await page.goto("/");

  if (await page.locator("input#email-login").isVisible({ timeout: 3000 })) {
    await page.locator("input#email-login").fill("test@example.com");
    await page.locator("input#password-login").fill("password");
    await page.getByRole("button", { name: "Login" }).click();
  }

  await expect(
    page.getByRole("heading", { name: "Notes & Tasks" })
  ).toBeVisible({ timeout: 10000 });
  const noteInTree = page
    .getByRole("navigation", { name: "Notes and Tasks Tree" })
    .getByText(NOTE_LABEL_FOR_EDITOR_TESTS);
  await expect(noteInTree).toBeVisible({ timeout: 7000 });
  await noteInTree.click();

  const editorLocator = page.locator(".ProseMirror");
  await expect(editorLocator).toBeVisible({ timeout: 10000 });
  await expect(editorLocator).toHaveAttribute("dir", initialDirection, {
    timeout: 7000,
  });

  const initialContentText = initialContent.replace(/<[^>]*>/g, "").trim();
  if (initialContentText.length > 0 && initialContent !== "<p></p>") {
    await expect(editorLocator).toContainText(
      initialContentText.substring(0, 15),
      { timeout: 7000 }
    );
  }
  await expect(
    page.getByRole("heading", { name: NOTE_LABEL_FOR_EDITOR_TESTS })
  ).toBeVisible();
}

const getEditor = (page: Page): Locator => {
  return page.locator(".ProseMirror");
};

async function selectTextInEditor(
  blockToSelectIn: Locator,
  textToSelect: string
) {
  await blockToSelectIn.focus();
  // Simplified selection for Playwright: type, then select all in that block
  // For more precise sub-string selection, a more complex evaluate might be needed
  // This approach assumes `textToSelect` is the primary content of the current focused block.
  if (textToSelect) {
    // Ensure textToSelect is not empty
    const fullText = (await blockToSelectIn.textContent()) || "";
    if (fullText.includes(textToSelect)) {
      await blockToSelectIn.evaluate((editorNode, text) => {
        const el = editorNode as HTMLElement;
        const selection = window.getSelection();
        if (!selection) return false;
        const range = document.createRange();

        function findTextNode(
          parentNode: Node,
          searchText: string
        ): { node: Node; startIndex: number } | null {
          for (const childNode of Array.from(parentNode.childNodes)) {
            if (childNode.nodeType === Node.TEXT_NODE) {
              const index = childNode.textContent?.indexOf(searchText) ?? -1;
              if (index !== -1) {
                return { node: childNode, startIndex: index };
              }
            } else if (childNode.nodeType === Node.ELEMENT_NODE) {
              const foundInChild = findTextNode(childNode, searchText);
              if (foundInChild) return foundInChild;
            }
          }
          return null;
        }

        const foundTextDetails = findTextNode(el, text);
        if (foundTextDetails) {
          range.setStart(foundTextDetails.node, foundTextDetails.startIndex);
          range.setEnd(
            foundTextDetails.node,
            foundTextDetails.startIndex + text.length
          );
          selection.removeAllRanges();
          selection.addRange(range);
          return true;
        }
        // Fallback to select all if specific text not found easily (e.g. complex structure)
        // or if textToSelect spans multiple nodes which this simple find doesn't handle.
        range.selectNodeContents(el);
        selection.removeAllRanges();
        selection.addRange(range);
        return false; // Indicate fallback was used
      }, textToSelect);
    } else {
      // Fallback if textToSelect isn't found, select all content in the block.
      await blockToSelectIn.evaluate((editorNode) => {
        const selection = window.getSelection();
        if (!selection) return;
        const range = document.createRange();
        range.selectNodeContents(editorNode);
        selection.removeAllRanges();
        selection.addRange(range);
      });
    }
  } else {
    // If textToSelect is empty, select all
    await blockToSelectIn.evaluate((editorNode) => {
      const selection = window.getSelection();
      if (!selection) return;
      const range = document.createRange();
      range.selectNodeContents(editorNode);
      selection.removeAllRanges();
      selection.addRange(range);
    });
  }
}

async function waitForSave(page: Page, options?: { timeout?: number }) {
  const timeout = options?.timeout || waitForSaveTimeout;
  try {
    await page.waitForResponse(
      (response) =>
        response.url().includes(`/api/items/${NOTE_ID_FOR_EDITOR_TESTS}`) &&
        response.request().method() === "PATCH",
      { timeout: timeout }
    );
  } catch (e) {
    // This timeout is acceptable if an action doesn't trigger a save immediately or if save already happened.
  }
}

test.describe("TipTap Editor Functionality", () => {
  let editor: Locator;

  test.beforeEach(async ({ page }) => {
    await setupEditorTest(page, "<p></p>", "ltr");
    editor = getEditor(page);
  });

  test("1. Should allow typing basic text and save it", async ({ page }) => {
    await editor.fill("Hello World");
    await waitForSave(page);
    expect(lastSavedData?.content).toBe("<p>Hello World</p>");
  });

  test("2. Should load existing content correctly", async ({ page }) => {
    const existingHTML = "<p>Existing Content Here</p>";
    await setupEditorTest(page, existingHTML, "ltr");
    editor = getEditor(page);

    await expect(editor).toContainText("Existing Content Here");
    const currentEditorHTML = await editor.innerHTML();
    expect(currentEditorHTML).toBe(existingHTML);
  });

  test("3. Should apply Bold style", async ({ page }) => {
    await editor.type("Make me bold");
    await selectTextInEditor(editor.locator("p"), "Make me bold");
    await page.getByRole("button", { name: "Bold" }).click();
    await waitForSave(page);
    expect(lastSavedData?.content).toContain("<strong>Make me bold</strong>");
    await expect(editor.locator("strong")).toHaveText("Make me bold");
  });

  test("4. Should apply Italic style", async ({ page }) => {
    await editor.type("Make me italic");
    await selectTextInEditor(editor.locator("p"), "Make me italic");
    await page.getByRole("button", { name: "Italic" }).click();
    await waitForSave(page);
    expect(lastSavedData?.content).toContain("<em>Make me italic</em>");
    await expect(editor.locator("em")).toHaveText("Make me italic");
  });

  test("5. Should apply Underline style", async ({ page }) => {
    await editor.type("Make me underline");
    await selectTextInEditor(editor.locator("p"), "Make me underline");
    await page.getByRole("button", { name: "Underline" }).click();
    await waitForSave(page);
    expect(lastSavedData?.content).toContain("<u>Make me underline</u>");
    await expect(editor.locator("u")).toHaveText("Make me underline");
  });

  test("6. Should change Font Family", async ({ page }) => {
    await editor.type("Change my font");
    await selectTextInEditor(editor.locator("p"), "Change my font");
    await page
      .getByRole("combobox", { name: "Font Family" })
      .selectOption("Verdana");
    await waitForSave(page);
    expect(lastSavedData?.content).toContain(
      '<span style="font-family: Verdana">Change my font</span>'
    );
    await expect(
      editor.locator('span[style*="font-family: Verdana"]')
    ).toContainText("Change my font");
  });

  test("7. Should change Font Size", async ({ page }) => {
    await editor.type("Change my size");
    await selectTextInEditor(editor.locator("p"), "Change my size");
    await page
      .getByRole("combobox", { name: "Font Size" })
      .selectOption({ label: "Large" });
    await waitForSave(page);
    expect(lastSavedData?.content).toContain(
      '<span style="font-size: 1.2em">Change my size</span>'
    );
    await expect(
      editor.locator('span[style*="font-size: 1.2em"]')
    ).toContainText("Change my size");
  });

  test("8. Should create a Bullet List", async ({ page }) => {
    await editor.type("Item 1");
    await page.getByRole("button", { name: "Bulleted List" }).click();
    await editor.press("Enter");
    await editor.type("Item 2");
    await waitForSave(page);
    expect(lastSavedData?.content).toMatch(
      /<ul><li><p>Item 1<\/p><\/li><li><p>Item 2<\/p><\/li><\/ul>/
    );
    await expect(editor.locator("ul > li")).toHaveCount(2);
  });

  test("9. Should create a Numbered List", async ({ page }) => {
    await editor.type("First item");
    await page.getByRole("button", { name: "Numbered List" }).click();
    await editor.press("Enter");
    await editor.type("Second item");
    await waitForSave(page);
    expect(lastSavedData?.content).toMatch(
      /<ol><li><p>First item<\/p><\/li><li><p>Second item<\/p><\/li><\/ol>/
    );
    await expect(editor.locator("ol > li")).toHaveCount(2);
  });

  test("10. Should create a link via toolbar prompt", async ({ page }) => {
    page.on("dialog", async (dialog) => {
      expect(dialog.type()).toBe("prompt");
      expect(dialog.message()).toBe("Enter URL:");
      await dialog.accept("https://example.com");
    });
    await editor.type("Linkable text");
    await selectTextInEditor(editor.locator("p"), "Linkable text");
    await page.getByRole("button", { name: "Set Link" }).click();
    await waitForSave(page);

    expect(lastSavedData?.content).toContain('href="https://example.com"');
    expect(lastSavedData?.content).toMatch(
      /<p>.*<a [^>]*href="https:\/\/example\.com"[^>]*>Linkable text<\/a>.*<\/p>/
    );
    await expect(editor.locator('a[href="https://example.com"]')).toHaveText(
      "Linkable text"
    );
  });

  test("11. Should auto-detect and convert typed URL to link (on space)", async ({
    page,
  }) => {
    await editor.type("Go to https://example.com then press space");
    await editor.press("Space");
    await waitForSave(page);

    expect(lastSavedData?.content).toContain('href="https://example.com"');
    expect(lastSavedData?.content).toMatch(
      /<p>Go to <a [^>]*href="https:\/\/example\.com"[^>]*>https:\/\/example\.com<\/a> then press space\s*<\/p>/
    );
    await expect(editor.locator('a[href="https://example.com"]')).toHaveText(
      "https://example.com"
    );
  });

  test("12. Should apply Inline Code style", async ({ page }) => {
    await editor.type("Some code here");
    await selectTextInEditor(
      editor.locator('p:has-text("Some code here")'),
      "here"
    );
    await page.getByRole("button", { name: "Inline Code" }).click();
    await waitForSave(page);
    expect(lastSavedData?.content).toMatch(
      /<p>Some code <code>here<\/code><\/p>/
    );
    await expect(editor.locator("code")).toHaveText("here");
  });

  test("13. Should create a Code Block", async ({ page }) => {
    await editor.type("const x = 10;");
    await selectTextInEditor(editor.locator("p"), "const x = 10;");
    await page.getByRole("button", { name: "Code Block" }).click();
    await waitForSave(page);
    expect(lastSavedData?.content).toBe(
      "<pre><code>const x = 10;</code></pre>"
    );
    await expect(editor.locator("pre code")).toContainText("const x = 10;");
  });

  test("14. Should align text to Center", async ({ page }) => {
    await editor.type("Center this text");
    await selectTextInEditor(editor.locator("p"), "Center this text");
    await page.getByRole("button", { name: "Align Center" }).click();
    await waitForSave(page);
    expect(lastSavedData?.content).toContain(
      '<p style="text-align: center">Center this text</p>'
    );
    await expect(editor.locator('p[style="text-align: center"]')).toBeVisible();
  });

  test("15. Should align text to Right", async ({ page }) => {
    await editor.type("Right align this");
    await selectTextInEditor(editor.locator("p"), "Right align this");
    await page.getByRole("button", { name: "Align Right" }).click();
    await waitForSave(page);
    expect(lastSavedData?.content).toContain(
      '<p style="text-align: right">Right align this</p>'
    );
    await expect(editor.locator('p[style="text-align: right"]')).toBeVisible();
  });

  test("16. Should revert text alignment to Left", async ({ page }) => {
    await editor.type("Align me then left");
    await selectTextInEditor(editor.locator("p"), "Align me then left");
    await page.getByRole("button", { name: "Align Center" }).click();
    await waitForSave(page);

    await page.getByRole("button", { name: "Align Left" }).click();
    await waitForSave(page);

    expect(lastSavedData?.content).not.toContain("text-align: center");
    expect(lastSavedData?.content).not.toContain("text-align: right");
    const expectedContent = lastSavedData?.content?.includes(
      'style="text-align: left"'
    )
      ? '<p style="text-align: left">Align me then left</p>'
      : "<p>Align me then left</p>";
    expect(lastSavedData?.content).toBe(expectedContent);
    await expect(
      editor.locator(
        'p:not([style*="text-align: center"]):not([style*="text-align: right"])'
      )
    ).toContainText("Align me then left");
  });

  test("17. Should switch editor direction to RTL and persist", async ({
    page,
  }) => {
    await setupEditorTest(page, "<p>Hello</p>", "ltr");
    editor = getEditor(page);
    await expect(editor).toHaveAttribute("dir", "ltr", { timeout: 7000 });

    const ltrButton = page.getByTitle("Text Direction: LTR").last();
    await expect(ltrButton).toBeVisible({ timeout: 10000 });
    await ltrButton.click();

    await expect(page.getByTitle("Text Direction: RTL").last()).toBeVisible({
      timeout: 7000,
    });
    await editor.type("טקסט בעברית");
    await waitForSave(page);

    expect(lastSavedData?.direction).toBe("rtl");
    expect(lastSavedData?.content).toContain("טקסט בעברית");
    await expect(editor).toHaveAttribute("dir", "rtl");

    const savedContent = lastSavedData?.content;
    const savedDirection = lastSavedData?.direction;
    await setupEditorTest(
      page,
      savedContent || "<p></p>",
      savedDirection || "rtl"
    );
    editor = getEditor(page);
    await expect(editor).toHaveAttribute("dir", "rtl");
    await expect(editor).toContainText("טקסט בעברית");
  });

  test("18. Should switch editor direction back to LTR and persist", async ({
    page,
  }) => {
    await setupEditorTest(page, "<p>טקסט התחלתי</p>", "rtl");
    editor = getEditor(page);
    await expect(editor).toHaveAttribute("dir", "rtl", { timeout: 7000 });

    const rtlButton = page.getByTitle("Text Direction: RTL").last();
    await expect(rtlButton).toBeVisible({ timeout: 10000 });
    await rtlButton.click();

    await expect(page.getByTitle("Text Direction: LTR").last()).toBeVisible({
      timeout: 7000,
    });
    await editor.type(" Text in English");
    await waitForSave(page);

    expect(lastSavedData?.direction).toBe("ltr");
    expect(lastSavedData?.content).toContain("Text in English");
    await expect(editor).toHaveAttribute("dir", "ltr");

    const savedContent = lastSavedData?.content;
    const savedDirection = lastSavedData?.direction;
    await setupEditorTest(
      page,
      savedContent || "<p></p>",
      savedDirection || "ltr"
    );
    editor = getEditor(page);
    await expect(editor).toHaveAttribute("dir", "ltr");
    expect(await editor.innerHTML()).toContain("Text in English");
  });

  test("19. Should upload an image and display it", async ({ page }) => {
    const imagePath = "tests/e2e/test-image.png";
    const serverImageUrl = "http://localhost:5001/uploads/test-image-mock.png";

    if (!fs.existsSync(imagePath)) {
      fs.writeFileSync(
        imagePath,
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
          "base64"
        )
      );
    }

    await page.route("**/api/images/upload", async (route) => {
      await route.fulfill({ json: { url: serverImageUrl }, status: 200 });
    });

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Upload Image" }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(imagePath);

    await waitForSave(page);
    expect(lastSavedData?.content).toMatch(
      new RegExp(`<img[^>]*src="${serverImageUrl}"[^>]*>`)
    );
    await expect(editor.locator(`img[src="${serverImageUrl}"]`)).toBeVisible();
  });

  test("20. Should delete an image from content", async ({ page }) => {
    const serverImageUrl =
      "http://localhost:5001/uploads/test-image-to-delete.png";
    const initialHtmlWithImage = `<p>Here is an image <img src="${serverImageUrl}"> to delete.</p>`;

    await setupEditorTest(page, initialHtmlWithImage, "ltr");
    editor = getEditor(page);
    await expect(editor.locator(`img[src="${serverImageUrl}"]`)).toBeVisible();

    await editor.locator(`img[src="${serverImageUrl}"]`).click();
    await page.keyboard.press("Delete");
    await waitForSave(page);

    expect(lastSavedData?.content).not.toContain(
      `<img src="${serverImageUrl}"`
    );
    expect(lastSavedData?.content).toMatch(
      /<p>Here is an image\s*to delete\.<\/p>/
    );
    await expect(
      editor.locator(`img[src="${serverImageUrl}"]`)
    ).not.toBeVisible();
  });

  test("21. Should undo a text input", async ({ page }) => {
    await editor.type("Initial text. ");
    await waitForSave(page);
    const contentBeforeUndoableAction = lastSavedData?.content;

    await editor.type("Text to undo.");
    await waitForSave(page);

    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await waitForSave(page);

    expect(lastSavedData?.content).toBe(contentBeforeUndoableAction);
    await expect(editor).toContainText("Initial text.");
    await expect(editor).not.toContainText("Text to undo.");
  });

  test("22. Should redo a text input", async ({ page }) => {
    await editor.type("Content. ");
    await waitForSave(page);
    const contentAfterFirstType = lastSavedData?.content;

    await editor.type("More content.");
    await waitForSave(page);
    const contentAfterSecondType = lastSavedData?.content;

    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await waitForSave(page);
    expect(lastSavedData?.content).toBe(contentAfterFirstType);

    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await waitForSave(page);

    expect(lastSavedData?.content).toBe(contentAfterSecondType);
    await expect(editor).toContainText("Content. More content.");
  });

  test("23. Should create new paragraph on Enter", async ({ page }) => {
    await editor.type("First line");
    await editor.press("Enter");
    await editor.type("Second line");
    await waitForSave(page);
    expect(lastSavedData?.content).toBe("<p>First line</p><p>Second line</p>");
  });

  test("24. Should apply Heading 1 style", async ({ page }) => {
    await editor.type("My H1 Title");
    await selectTextInEditor(editor.locator("p"), "My H1 Title");
    await page
      .getByRole("combobox", { name: "Text Style" })
      .selectOption({ label: "H1" });
    await waitForSave(page);
    expect(lastSavedData?.content).toBe("<h1>My H1 Title</h1>");
    await expect(editor.locator("h1")).toContainText("My H1 Title");
  });

  test("25. Should display placeholder text", async ({ page }) => {
    await setupEditorTest(page, "<p></p>", "ltr");
    editor = getEditor(page);
    await expect(
      editor.locator("p.is-editor-empty:first-child")
    ).toHaveAttribute(
      "data-placeholder",
      "Start typing, paste an image, or click the image icon to upload...",
      { timeout: 7000 }
    );
  });

  test("26. Should hide placeholder text on typing", async ({ page }) => {
    await setupEditorTest(page, "<p></p>", "ltr");
    editor = getEditor(page);
    const placeholderText =
      "Start typing, paste an image, or click the image icon to upload...";
    await expect(
      editor.locator("p.is-editor-empty:first-child")
    ).toHaveAttribute("data-placeholder", placeholderText, { timeout: 7000 });

    await editor.type("Some text");
    await waitForSave(page);
    await expect(editor.locator("p.is-editor-empty")).not.toBeVisible();
  });

  test("27. Should clear Bold style", async ({ page }) => {
    await editor.type("Bold then not bold");
    await selectTextInEditor(editor.locator("p"), "Bold then not bold");
    const boldButton = page.getByRole("button", { name: "Bold" });
    await boldButton.click();
    await waitForSave(page);
    expect(lastSavedData?.content).toContain(
      "<strong>Bold then not bold</strong>"
    );

    await selectTextInEditor(editor.locator("strong"), "Bold then not bold");
    await boldButton.click();
    await waitForSave(page);
    expect(lastSavedData?.content).not.toContain("<strong>");
    expect(lastSavedData?.content).toContain("<p>Bold then not bold</p>");
    await expect(editor.locator("strong")).not.toBeVisible();
  });

  test("28. Should toggle heading back to paragraph", async ({ page }) => {
    await editor.type("This is a heading");
    await selectTextInEditor(editor.locator("p"), "This is a heading");
    const styleDropdown = page.getByRole("combobox", { name: "Text Style" });
    await styleDropdown.selectOption({ label: "H1" });
    await waitForSave(page);
    expect(lastSavedData?.content).toBe("<h1>This is a heading</h1>");

    await selectTextInEditor(editor.locator("h1"), "This is a heading");
    await styleDropdown.selectOption({ label: "Paragraph" });
    await waitForSave(page);
    expect(lastSavedData?.content).toBe("<p>This is a heading</p>");
    await expect(editor.locator("p")).toContainText("This is a heading");
    await expect(editor.locator("h1")).not.toBeVisible();
  });

  test("29. List item should not indent with Tab if not producing nested HTML", async ({
    page,
  }) => {
    await editor.type("Item A");
    await page.getByRole("button", { name: "Bulleted List" }).click();
    await editor.press("Enter");
    await editor.type("Item B");
    await editor.locator('li > p:has-text("Item B")').focus();
    await page.keyboard.press("Tab"); // Standard Tab in Tiptap doesn't indent lists by default

    await waitForSave(page, { timeout: 500 }); // Shorter wait as no change expected
    const currentContent = lastSavedData?.content || (await editor.innerHTML());
    expect(currentContent).toMatch(
      /<ul><li><p>Item A<\/p><\/li><li><p>Item B<\/p><\/li><\/ul>/
    );
  });

  test("30. List item should not outdent with Shift+Tab if not indented", async ({
    page,
  }) => {
    await editor.type("Item X");
    await page.getByRole("button", { name: "Bulleted List" }).click();
    await editor.press("Enter");
    await editor.type("Item Y");
    // Standard Tab in Tiptap doesn't indent lists by default
    await editor.locator('li > p:has-text("Item Y")').focus();
    await page.keyboard.press("Tab");
    await waitForSave(page, { timeout: 500 });

    let contentAfterIndentAttempt =
      lastSavedData?.content || (await editor.innerHTML());
    expect(contentAfterIndentAttempt, "Content after indent attempt").toMatch(
      /<ul><li><p>Item X<\/p><\/li><li><p>Item Y<\/p><\/li><\/ul>/
    );

    await editor.locator('li > p:has-text("Item Y")').focus();
    await page.keyboard.press("Shift+Tab"); // Standard Shift+Tab in Tiptap doesn't outdent lists by default
    await waitForSave(page, { timeout: 500 });

    const contentAfterOutdentAttempt =
      lastSavedData?.content || (await editor.innerHTML());
    expect(contentAfterOutdentAttempt, "Content after outdent attempt").toMatch(
      /<ul><li><p>Item X<\/p><\/li><li><p>Item Y<\/p><\/li><\/ul>/
    );
  });

  test("31. Exploratory editing operations and validations", async ({
    page,
  }) => {
    test.setTimeout(90000); // Increased timeout for this long test

    await editor.type("Exploratory Test Start. ");
    await waitForSave(page);
    expect(lastSavedData?.content).toContain("<p>Exploratory Test Start. </p>");
    await expect(editor).toContainText("Exploratory Test Start.");

    const textToBold = "Make this bold.";
    await editor.type(textToBold + " ");
    await selectTextInEditor(editor.locator("p").first(), textToBold);
    await page.getByRole("button", { name: "Bold" }).click();
    await waitForSave(page);
    expect(lastSavedData?.content).toContain(`<strong>${textToBold}</strong>`);
    await expect(
      editor.locator(`strong:has-text("${textToBold}")`)
    ).toBeVisible();

    await editor.press("ArrowRight");
    await editor.press("Space");
    const textToItalic = "And this italic.";
    await editor.type(`${textToItalic} `);
    await selectTextInEditor(editor.locator("p").first(), textToItalic);
    await page.getByRole("button", { name: "Italic" }).click();
    await waitForSave(page);
    expect(lastSavedData?.content).toContain(`<em>${textToItalic}</em>`);
    await expect(
      editor.locator(`em:has-text("${textToItalic}")`)
    ).toBeVisible();

    await editor.press("ArrowRight");
    await editor.press("Space");
    const textToUnderline = "Underline this.";
    await editor.type(`${textToUnderline} `);
    await selectTextInEditor(editor.locator("p").first(), textToUnderline);
    await page.getByRole("button", { name: "Underline" }).click();
    await waitForSave(page);
    expect(lastSavedData?.content).toContain(`<u>${textToUnderline}</u>`);
    await expect(
      editor.locator(`u:has-text("${textToUnderline}")`)
    ).toBeVisible();

    await editor.press("ArrowRight");
    await editor.press("Space");
    const textForFontFamily = "Verdana font.";
    await editor.type(`${textForFontFamily} `);
    await selectTextInEditor(editor.locator("p").first(), textForFontFamily);
    await page
      .getByRole("combobox", { name: "Font Family" })
      .selectOption("Verdana");
    await waitForSave(page);
    expect(lastSavedData?.content).toMatch(
      new RegExp(
        `<span style="font-family: Verdana">.*${textForFontFamily.replace(
          ".",
          "\\."
        )}.*</span>`
      )
    );

    await editor.press("ArrowRight");
    await editor.press("Space");
    const textForFontSize = "Large size.";
    await editor.type(`${textForFontSize} `);
    await selectTextInEditor(editor.locator("p").first(), textForFontSize);
    await page
      .getByRole("combobox", { name: "Font Size" })
      .selectOption({ label: "Large" });
    await waitForSave(page);
    expect(lastSavedData?.content).toMatch(
      new RegExp(
        `<span[^>]*style="[^"]*font-size: 1.2em[^"]*"[^>]*>.*${textForFontSize.replace(
          ".",
          "\\."
        )}.*</span>`
      )
    );

    await editor.press("ArrowRight");
    await editor.press("Enter");
    await editor.type("Main Title");
    await selectTextInEditor(
      editor.locator('p:has-text("Main Title")'),
      "Main Title"
    );
    await page
      .getByRole("combobox", { name: "Text Style" })
      .selectOption({ label: "H1" });
    await waitForSave(page);
    expect(lastSavedData?.content).toMatch(new RegExp(`<h1>Main Title</h1>`));

    await editor.locator('h1:has-text("Main Title")').focus();
    await editor.press("End");
    await editor.press("Enter");
    await editor.type("Paragraph after H1.");
    await waitForSave(page);
    expect(lastSavedData?.content).toMatch(
      new RegExp(`<h1>Main Title</h1><p>Paragraph after H1\\.</p>`)
    );

    await editor.press("Enter");
    await editor.type("Bullet 1");
    await page.getByRole("button", { name: "Bulleted List" }).click();
    await editor.press("Enter");
    await editor.type("Bullet 2");
    await waitForSave(page);
    expect(lastSavedData?.content).toMatch(
      /<ul><li><p>Bullet 1<\/p><\/li><li><p>Bullet 2<\/p><\/li><\/ul>/
    );

    await editor.press("Enter");
    await page.getByRole("button", { name: "Bulleted List" }).click();
    await editor.type("Ordered 1");
    await page.getByRole("button", { name: "Numbered List" }).click();
    await editor.press("Enter");
    await editor.type("Ordered 2");
    await waitForSave(page);
    expect(lastSavedData?.content).toMatch(
      /<ol><li><p>Ordered 1<\/p><\/li><li><p>Ordered 2<\/p><\/li><\/ol>/
    );

    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await waitForSave(page);
    expect(lastSavedData?.content).not.toContain("<p>Ordered 2</p>");
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await waitForSave(page);
    expect(lastSavedData?.content).toMatch(
      /<ol><li><p>Ordered 1<\/p><\/li><li><p>Ordered 2<\/p><\/li><\/ol>/
    );

    await editor.press("Enter");
    await page.getByRole("button", { name: "Numbered List" }).click();
    await editor.type("Centered text line.");
    await selectTextInEditor(
      editor.locator('p:has-text("Centered text line.")'),
      "Centered text line."
    );
    await page.getByRole("button", { name: "Align Center" }).click();
    await waitForSave(page);
    expect(lastSavedData?.content).toContain(
      '<p style="text-align: center">Centered text line.</p>'
    );

    await page.getByTitle("Text Direction: LTR").last().click();
    await waitForSave(page);
    expect(lastSavedData?.direction).toBe("rtl");
    await editor.type(" טקסט מימין לשמאל.");
    await waitForSave(page);
    expect(lastSavedData?.content).toContain("טקסט מימין לשמאל.");
    await page.getByTitle("Text Direction: RTL").last().click();
    await waitForSave(page);
    expect(lastSavedData?.direction).toBe("ltr");

    const imagePath = "tests/e2e/test-image.png";
    const serverImageUrl =
      "http://localhost:5001/uploads/exploratory-image.png";
    if (!fs.existsSync(imagePath)) {
      fs.writeFileSync(
        imagePath,
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
          "base64"
        )
      );
    }
    await page.route("**/api/images/upload", async (route) => {
      await route.fulfill({ json: { url: serverImageUrl }, status: 200 });
    });
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Upload Image" }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(imagePath);
    await waitForSave(page);
    expect(lastSavedData?.content).toMatch(
      new RegExp(`<img[^>]*src="${serverImageUrl}"[^>]*>`)
    );
    await editor.locator(`img[src="${serverImageUrl}"]`).click();
    await page.keyboard.press("Delete");
    await waitForSave(page);
    expect(lastSavedData?.content).not.toMatch(
      new RegExp(`<img[^>]*src="${serverImageUrl}"[^>]*>`)
    );

    page.once("dialog", async (dialog) => {
      if (dialog.message() === "Enter URL:")
        await dialog.accept("https://playwright.dev");
    });
    await editor.press("Enter");
    await editor.type("Playwright Link");
    await selectTextInEditor(
      editor.locator('p:has-text("Playwright Link")'),
      "Playwright Link"
    );
    await page.getByRole("button", { name: "Set Link" }).click();
    await waitForSave(page);
    expect(lastSavedData?.content).toContain('href="https://playwright.dev"');

    await editor.locator('a[href="https://playwright.dev"]').focus();
    await editor.press("End");
    await editor.press("ArrowRight");
    await editor.press("Space");
    await editor.type("www.google.com");
    await editor.press("Space");
    await waitForSave(page);
    expect(lastSavedData?.content).toContain('href="http://www.google.com"');

    await editor.press("Enter");
    await editor.type("Final Bold Text");
    await selectTextInEditor(
      editor.locator('p:has-text("Final Bold Text")'),
      "Final Bold Text"
    );
    const boldButton = page.getByRole("button", { name: "Bold" });
    await boldButton.click();
    await waitForSave(page);
    await selectTextInEditor(
      editor.locator('strong:has-text("Final Bold Text")'),
      "Final Bold Text"
    );
    await boldButton.click();
    await waitForSave(page);
    expect(lastSavedData?.content).not.toContain(
      "<strong>Final Bold Text</strong>"
    );

    await editor.press("Enter");
    await editor.type("function test() {}");
    await selectTextInEditor(
      editor.locator('p:has-text("function test() {}")'),
      "function test() {}"
    );
    await page.getByRole("button", { name: "Code Block" }).click();
    await waitForSave(page);
    expect(lastSavedData?.content).toContain(
      "<pre><code>function test() {}</code></pre>"
    );

    const firstParagraphText = "Exploratory Test Start.";
    const textToResizeInFirstPara = "Exploratory";
    const firstPElement = editor.locator("p").first();
    await expect(firstPElement).toContainText(firstParagraphText);
    await firstPElement.focus();
    await selectTextInEditor(firstPElement, textToResizeInFirstPara);
    await page
      .getByRole("combobox", { name: "Font Size" })
      .selectOption({ label: "Small" });
    await waitForSave(page);
    const firstPContentAfterResize = await editor
      .locator("p")
      .first()
      .innerHTML();
    expect(firstPContentAfterResize).toContain(
      `<span style="font-size: 0.8em">${textToResizeInFirstPara}</span>`
    );

    const lastBlock = editor.locator("p, ol, ul, h1, h2, h3, pre").last();
    await lastBlock.focus();
    await editor.press("End");
    await editor.press("Enter");
    await page
      .getByRole("combobox", { name: "Text Style" })
      .selectOption({ label: "Paragraph" });
    await editor.press("Enter");
    await page
      .getByRole("combobox", { name: "Text Style" })
      .selectOption({ label: "Paragraph" });
    await editor.type("More breaks.");
    await waitForSave(page);
    expect(lastSavedData?.content).toMatch(/<p><\/p><p>More breaks\.<\/p>/);

    const paraToMakeH2Text = "Paragraph after H1.";
    const paraToMakeH2 = editor
      .locator(`p:has-text("${paraToMakeH2Text}")`)
      .first();
    if (await paraToMakeH2.isVisible({ timeout: 2000 })) {
      await selectTextInEditor(paraToMakeH2, paraToMakeH2Text);
      await page
        .getByRole("combobox", { name: "Text Style" })
        .selectOption({ label: "H2" });
      await waitForSave(page);
      expect(lastSavedData?.content).toContain(`<h2>${paraToMakeH2Text}</h2>`);
    } else {
      const h2Element = editor
        .locator(`h2:has-text("${paraToMakeH2Text}")`)
        .first();
      await expect(h2Element).toBeVisible({ timeout: 1000 });
    }

    const lastContentBlock = editor
      .locator("p, ol, ul, h1, h2, h3, pre")
      .last();
    await lastContentBlock.focus();
    await editor.press("End");
    await editor.press("Enter");
    await page
      .getByRole("combobox", { name: "Text Style" })
      .selectOption({ label: "Paragraph" });
    const textForPartialDelete =
      "This is a long sentence for partial deletion.";
    const toDeleteFromSentence = "long sentence ";
    const expectedAfterDelete = "This is a for partial deletion.";
    await editor.type(textForPartialDelete);
    await waitForSave(page);
    await selectTextInEditor(
      editor.locator(`p:has-text("${textForPartialDelete}")`),
      toDeleteFromSentence
    );
    await page.keyboard.press("Delete");
    await waitForSave(page);
    expect(lastSavedData?.content).toContain(`<p>${expectedAfterDelete}</p>`);

    await editor.press("End");
    await editor.press("Enter");
    await editor.type("Final Step 1");
    await page.getByRole("button", { name: "Numbered List" }).click();
    await editor.press("Enter");
    await editor.type("Final Step 2");
    await waitForSave(page);
    expect(lastSavedData?.content).toMatch(
      /<ol><li><p>Final Step 1<\/p><\/li><li><p>Final Step 2<\/p><\/li><\/ol>/
    );

    await selectTextInEditor(
      editor.locator('li > p:has-text("Final Step 2")'),
      "Final Step 2"
    );
    await page
      .getByRole("combobox", { name: "Font Family" })
      .selectOption("Arial");
    await waitForSave(page);
    expect(lastSavedData?.content).toContain("font-family: Arial");

    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await waitForSave(page);
    expect(lastSavedData?.content).not.toContain("font-family: Arial");

    await editor.locator("p, ol, ul, h1, h2, h3, pre").last().focus();
    await editor.press("End");
    await editor.press("Enter");
    await page
      .getByRole("combobox", { name: "Text Style" })
      .selectOption({ label: "Paragraph" });
    await editor.type("Exploratory test really complete.");
    await waitForSave(page);
    expect(lastSavedData?.content).toContain(
      "<p>Exploratory test really complete.</p>"
    );
    await expect(editor).toContainText("Exploratory test really complete.");
  });

  test("32. Should correctly paste Markdown and convert to HTML", async ({
    page,
  }) => {
    await setupEditorTest(page, "<p></p>", "ltr");
    editor = getEditor(page);

    const markdownToPaste =
      "# Markdown Heading 1\n\n* List item 1\n* List item 2\n\n**Bold text** and *italic text*.";
    await editor.focus();
    await page.evaluate(async (markdown) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/plain", markdown);
      const pasteEvent = new ClipboardEvent("paste", {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true,
      });
      document.activeElement?.dispatchEvent(pasteEvent);
    }, markdownToPaste);
    await waitForSave(page);

    expect(lastSavedData?.content).toContain("<h1>Markdown Heading 1</h1>");
    expect(lastSavedData?.content).toMatch(
      /<ul><li><p>List item 1<\/p><\/li><li><p>List item 2<\/p><\/li><\/ul>/
    );
    expect(lastSavedData?.content).toContain("<strong>Bold text</strong>");
    expect(lastSavedData?.content).toContain("<em>italic text</em>");

    await expect(editor.locator("h1")).toContainText("Markdown Heading 1");
    await expect(editor.locator("ul > li").first()).toContainText(
      "List item 1"
    );
    await expect(editor.locator("ul > li").last()).toContainText("List item 2");
    await expect(editor.locator("strong")).toContainText("Bold text");
    await expect(editor.locator("em")).toContainText("italic text");
  });

  test("33. Should display and update timestamps correctly", async ({
    page,
  }) => {
    const initialCreatedAt = new Date(
      Date.now() - 2 * 60 * 60 * 1000
    ).toISOString();
    const initialUpdatedAt = new Date(
      Date.now() - 1 * 60 * 60 * 1000
    ).toISOString();

    await setupEditorTest(page, "<p>Timestamp Test</p>", "ltr", {
      createdAt: initialCreatedAt,
      updatedAt: initialUpdatedAt,
    });
    editor = getEditor(page);

    const formattedCreatedAt = formatDateForDisplay(initialCreatedAt);
    const formattedInitialUpdatedAt = formatDateForDisplay(initialUpdatedAt);

    const createdTimestampLocator = page.locator(
      `p[title="${initialCreatedAt}"]`
    );
    await expect(createdTimestampLocator).toContainText(
      `Created: ${formattedCreatedAt}`
    );
    const updatedTimestampLocator = page.locator(
      `p[title="${initialUpdatedAt}"]`
    );
    await expect(updatedTimestampLocator).toContainText(
      `Last Modified: ${formattedInitialUpdatedAt}`
    );

    await editor.type(" More text.");
    await waitForSave(page);

    expect(lastSavedData).not.toBeNull();
    const newUpdatedAt = lastSavedData!.updatedAt!;
    expect(newUpdatedAt).not.toBe(initialUpdatedAt);
    expect(new Date(newUpdatedAt).getTime()).toBeGreaterThan(
      new Date(initialUpdatedAt).getTime()
    );
    expect(lastSavedData!.createdAt).toBe(initialCreatedAt);

    const newFormattedUpdatedAt = formatDateForDisplay(newUpdatedAt);
    const newUpdatedTimestampLocator = page.locator(
      `p[title="${newUpdatedAt}"]`
    );
    await expect(createdTimestampLocator).toContainText(
      `Created: ${formattedCreatedAt}`
    ); // CreatedAt remains
    await expect(newUpdatedTimestampLocator).toContainText(
      `Last Modified: ${newFormattedUpdatedAt}`
    );
    await expect(
      page.locator(`p[title="${initialUpdatedAt}"]`)
    ).not.toBeVisible(); // Old updatedAt title should be gone
  });
});
