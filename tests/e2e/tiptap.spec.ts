import { test, expect, Page, Locator } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const NOTE_ID_FOR_EDITOR_TESTS = "editor-test-note-id";
const NOTE_LABEL_FOR_EDITOR_TESTS = "Tiptap Test Note";

interface SavedItemData {
  content?: string;
  direction?: "ltr" | "rtl";
  label?: string;
}

let lastSavedData: SavedItemData | null = null;
const saveDebounceTime = 1200;

async function setupEditorTest(
  page: Page,
  initialContent: string = "<p></p>",
  initialDirection: "ltr" | "rtl" = "ltr"
) {
  lastSavedData = null;

  await page.unroute("**/api/auth/login");
  await page.unroute("**/api/items/tree");
  await page.unroute(`**/api/items/${NOTE_ID_FOR_EDITOR_TESTS}`);

  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      json: {
        token: "fake-jwt-token",
        user: { id: "user123", email: "test@example.com" },
      },
      status: 200,
    });
  });

  await page.route("**/api/items/tree", async (route) => {
    await route.fulfill({
      json: {
        notesTree: [
          {
            id: NOTE_ID_FOR_EDITOR_TESTS,
            label: NOTE_LABEL_FOR_EDITOR_TESTS,
            type: "note",
            content: initialContent,
            direction: initialDirection,
          },
        ],
      },
      status: 200,
    });
  });

  await page.route(
    `**/api/items/${NOTE_ID_FOR_EDITOR_TESTS}`,
    async (route, request) => {
      if (request.method() === "PATCH") {
        lastSavedData = request.postDataJSON() as SavedItemData;
        await route.fulfill({
          json: {
            id: NOTE_ID_FOR_EDITOR_TESTS,
            label: NOTE_LABEL_FOR_EDITOR_TESTS,
            type: "note",
            content: lastSavedData?.content,
            direction: lastSavedData?.direction,
          },
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
  editorLocator: Locator,
  textToSelect: string
) {
  await editorLocator.focus();
  // More robust selection using page.evaluate
  const success = await editorLocator.evaluate((editorNode, text) => {
    const el = editorNode as HTMLElement;
    const fullTextContent = el.textContent || "";
    const startIndex = fullTextContent.indexOf(text);

    if (startIndex === -1) {
      // Fallback: if specific text not found (e.g., due to complex DOM structure or highlighting)
      // Attempt to select all content within the current focused element (often a <p>)
      const currentSelection = window.getSelection();
      if (currentSelection && currentSelection.focusNode) {
        const focusParent = currentSelection.focusNode.parentElement;
        if (
          focusParent &&
          focusParent.closest &&
          focusParent.closest(".ProseMirror")
        ) {
          // Ensure it's within editor
          const range = document.createRange();
          range.selectNodeContents(focusParent);
          currentSelection.removeAllRanges();
          currentSelection.addRange(range);
          return true; // Indicate some selection was made
        }
      }
      // If still no good selection, try TipTap's selectAll
      (el as any).editor?.commands.selectAll();
      return false; // Indicate precise selection failed
    }

    const selection = window.getSelection();
    const range = document.createRange();

    let charCount = 0;
    let startNodeRef: Node | null = null;
    let startOffsetRef = 0;
    let endNodeRef: Node | null = null;
    let endOffsetRef = 0;

    function findNodeAndOffsetRecursive(
      parentNode: Node,
      targetCharIndex: number
    ): { node: Node; offset: number } | null {
      for (let i = 0; i < parentNode.childNodes.length; i++) {
        const child = parentNode.childNodes[i];
        if (child.nodeType === Node.TEXT_NODE) {
          const nodeText = child.textContent || "";
          const len = nodeText.length;
          if (
            targetCharIndex >= charCount &&
            targetCharIndex <= charCount + len
          ) {
            return { node: child, offset: targetCharIndex - charCount };
          }
          charCount += len;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const found = findNodeAndOffsetRecursive(child, targetCharIndex);
          if (found) return found;
        }
      }
      return null;
    }

    charCount = 0;
    const startDetails = findNodeAndOffsetRecursive(el, startIndex);
    if (startDetails) {
      startNodeRef = startDetails.node;
      startOffsetRef = startDetails.offset;

      charCount = 0; // Reset for end offset calculation
      const endDetails = findNodeAndOffsetRecursive(
        el,
        startIndex + text.length
      );
      if (endDetails) {
        endNodeRef = endDetails.node;
        endOffsetRef = endDetails.offset;
      } else if (
        startNodeRef.textContent &&
        startOffsetRef + text.length <= startNodeRef.textContent.length
      ) {
        // If text is fully within the startNode
        endNodeRef = startNodeRef;
        endOffsetRef = startOffsetRef + text.length;
      }

      if (startNodeRef && endNodeRef && selection) {
        range.setStart(startNodeRef, startOffsetRef);
        range.setEnd(endNodeRef, endOffsetRef);
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
      }
    }
    // Fallback if specific text node for selection not found
    (el as any).editor?.commands.selectAll();
    return false; // Indicate precise selection failed
  }, textToSelect);
  if (!success) {
    // console.warn(`Precise selection for "${textToSelect}" failed, used selectAll as fallback.`);
  }
}

async function setEditorContent(
  page: Page,
  editorLocator: Locator,
  htmlContent: string
) {
  await editorLocator.focus();
  await editorLocator.evaluate((node, content) => {
    const tiptapEditor = (node as any).editor;
    if (tiptapEditor) {
      tiptapEditor.commands.setContent(content, true);
    } else {
      node.innerHTML = content;
    }
  }, htmlContent);
  await page.waitForResponse(
    (response) =>
      response.url().includes(`/api/items/${NOTE_ID_FOR_EDITOR_TESTS}`) &&
      response.request().method() === "PATCH",
    { timeout: saveDebounceTime + 1000 }
  );
}

async function waitForSave(page: Page, options?: { timeout?: number }) {
  const timeout = options?.timeout || saveDebounceTime + 1000;
  try {
    await page.waitForResponse(
      (response) =>
        response.url().includes(`/api/items/${NOTE_ID_FOR_EDITOR_TESTS}`) &&
        response.request().method() === "PATCH",
      { timeout: timeout }
    );
  } catch (e) {
    // This timeout is expected if an action doesn't trigger a save.
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
    await selectTextInEditor(editor, "Make me bold");
    await page.getByRole("button", { name: "Bold" }).click();
    await waitForSave(page);
    expect(lastSavedData?.content).toContain("<strong>Make me bold</strong>");
    await expect(editor.locator("strong")).toHaveText("Make me bold");
  });

  test("4. Should apply Italic style", async ({ page }) => {
    await editor.type("Make me italic");
    await selectTextInEditor(editor, "Make me italic");
    await page.getByRole("button", { name: "Italic" }).click();
    await waitForSave(page);
    expect(lastSavedData?.content).toContain("<em>Make me italic</em>");
    await expect(editor.locator("em")).toHaveText("Make me italic");
  });

  test("5. Should apply Underline style", async ({ page }) => {
    await editor.type("Make me underline");
    await selectTextInEditor(editor, "Make me underline");
    await page.getByRole("button", { name: "Underline" }).click();
    await waitForSave(page);
    expect(lastSavedData?.content).toContain("<u>Make me underline</u>");
    await expect(editor.locator("u")).toHaveText("Make me underline");
  });

  test("6. Should change Font Family", async ({ page }) => {
    await editor.type("Change my font");
    await selectTextInEditor(editor, "Change my font");
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
    await selectTextInEditor(editor, "Change my size");
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
    await selectTextInEditor(editor, "Linkable text");
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
      /<p>Go to <a [^>]*href="https:\/\/example\.com"[^>]*>https:\/\/example\.com<\/a> then press space\s?<\/p>/
    );
    await expect(editor.locator('a[href="https://example.com"]')).toHaveText(
      "https://example.com"
    );
  });

  test("12. Should apply Inline Code style", async ({ page }) => {
    await editor.type("Some code here");
    await selectTextInEditor(editor, "here");

    await page.getByRole("button", { name: "Inline Code" }).click();
    await waitForSave(page);
    expect(lastSavedData?.content).toMatch(
      /<p>Some code <code>here<\/code><\/p>/
    );
    await expect(editor.locator("code")).toHaveText("here");
  });

  test("13. Should create a Code Block", async ({ page }) => {
    await editor.type("const x = 10;");
    await selectTextInEditor(editor, "const x = 10;");
    await page.getByRole("button", { name: "Code Block" }).click();
    await waitForSave(page);
    expect(lastSavedData?.content).toBe(
      "<pre><code>const x = 10;</code></pre>"
    );
    await expect(editor.locator("pre code")).toContainText("const x = 10;");
  });

  test("14. Should align text to Center", async ({ page }) => {
    await editor.type("Center this text");
    await selectTextInEditor(editor, "Center this text");
    await page.getByRole("button", { name: "Align Center" }).click();
    await waitForSave(page);
    expect(lastSavedData?.content).toContain(
      '<p style="text-align: center">Center this text</p>'
    );
    await expect(editor.locator('p[style="text-align: center"]')).toBeVisible();
  });

  test("15. Should align text to Right", async ({ page }) => {
    await editor.type("Right align this");
    await selectTextInEditor(editor, "Right align this");
    await page.getByRole("button", { name: "Align Right" }).click();
    await waitForSave(page);
    expect(lastSavedData?.content).toContain(
      '<p style="text-align: right">Right align this</p>'
    );
    await expect(editor.locator('p[style="text-align: right"]')).toBeVisible();
  });

  test("16. Should revert text alignment to Left", async ({ page }) => {
    await editor.type("Align me then left");
    await selectTextInEditor(editor, "Align me then left");
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
    }); // Wait for button text to change
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
    }); // Wait for button text to change
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
    await selectTextInEditor(editor, "My H1 Title");
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
    await selectTextInEditor(editor, "Bold then not bold");
    const boldButton = page.getByRole("button", { name: "Bold" });
    await boldButton.click();
    await waitForSave(page);
    expect(lastSavedData?.content).toContain(
      "<strong>Bold then not bold</strong>"
    );

    await selectTextInEditor(editor, "Bold then not bold");
    await boldButton.click();
    await waitForSave(page);
    expect(lastSavedData?.content).not.toContain("<strong>");
    expect(lastSavedData?.content).toContain("Bold then not bold");
    await expect(editor.locator("strong")).not.toBeVisible();
  });

  test("28. Should toggle heading back to paragraph", async ({ page }) => {
    await editor.type("This is a heading");
    await selectTextInEditor(editor, "This is a heading");
    const styleDropdown = page.getByRole("combobox", { name: "Text Style" });
    await styleDropdown.selectOption({ label: "H1" });
    await waitForSave(page);
    expect(lastSavedData?.content).toBe("<h1>This is a heading</h1>");

    await selectTextInEditor(editor, "This is a heading");
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
    await page.keyboard.press("Tab");

    await waitForSave(page, { timeout: 500 });
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
    await editor.locator('li > p:has-text("Item Y")').focus();
    await page.keyboard.press("Tab");
    await waitForSave(page, { timeout: 500 });

    let contentAfterIndentAttempt =
      lastSavedData?.content || (await editor.innerHTML());
    expect(contentAfterIndentAttempt, "Content after indent attempt").toMatch(
      /<ul><li><p>Item X<\/p><\/li><li><p>Item Y<\/p><\/li><\/ul>/
    );

    await editor.locator('li > p:has-text("Item Y")').focus();
    await page.keyboard.press("Shift+Tab");
    await waitForSave(page, { timeout: 500 }); // Use waitForSave, but acknowledge it might time out if no save occurs.

    const contentAfterOutdentAttempt =
      lastSavedData?.content || (await editor.innerHTML());
    expect(contentAfterOutdentAttempt, "Content after outdent attempt").toMatch(
      /<ul><li><p>Item X<\/p><\/li><li><p>Item Y<\/p><\/li><\/ul>/
    );
  });

  test("31. Exploratory editing operations and validations", async ({
    page,
  }) => {

    test.setTimeout(60000); // Specifically for this test only

    await editor.type("Exploratory Test Start. ");
    await waitForSave(page);
    expect(lastSavedData?.content).toContain("<p>Exploratory Test Start. </p>");
    await expect(editor).toContainText("Exploratory Test Start.");

    const textToBold = "Make this bold.";
    await editor.type(textToBold + " ");
    await selectTextInEditor(editor, textToBold);

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
    await selectTextInEditor(editor, textToItalic);
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
    await selectTextInEditor(editor, textToUnderline);
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
    await selectTextInEditor(editor, textForFontFamily);
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
    await selectTextInEditor(editor, textForFontSize);
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
    await selectTextInEditor(editor, "Main Title");
    await page
      .getByRole("combobox", { name: "Text Style" })
      .selectOption({ label: "H1" });
    await waitForSave(page);
    expect(lastSavedData?.content).toMatch(
      new RegExp(`<h1>.*Main Title.*</h1>`)
    );

    await editor.locator('h1:has-text("Main Title")').focus();
    await editor.press("End");
    await editor.press("Enter");
    await editor.type("Paragraph after H1.");
    await waitForSave(page);
    expect(lastSavedData?.content).toMatch(
      new RegExp(`<h1>.*Main Title.*</h1><p>Paragraph after H1\\.</p>`)
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
    await editor.press("Enter");
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
    expect(lastSavedData?.content).not.toContain("Ordered 2");

    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await waitForSave(page);
    expect(lastSavedData?.content).toMatch(
      /<ol><li><p>Ordered 1<\/p><\/li><li><p>Ordered 2<\/p><\/li><\/ol>/
    );

    await editor.press("Enter");
    await page.getByRole("button", { name: "Numbered List" }).click();
    await editor.press("Enter");
    await editor.type("Centered text line.");
    await selectTextInEditor(editor, "Centered text line.");
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
    await selectTextInEditor(editor, "Playwright Link");
    await page.getByRole("button", { name: "Set Link" }).click();
    await waitForSave(page);
    expect(lastSavedData?.content).toContain('href="https://playwright.dev"');

    await editor.locator('a[href="https://playwright.dev"]').focus(); // Optional: ensure focus
    await editor.press("End"); // Move to the end of the link text "Playwright Link"
    await editor.press("ArrowRight"); // **** ADD THIS LINE: Move cursor OUTSIDE the <a> tag ****
    await editor.press("Space"); // Add a space in the main content area, after the link
    await editor.type("www.google.com");
    await editor.press("Space"); // This should now trigger auto-linking for www.google.com
    await waitForSave(page);
    expect(lastSavedData?.content).toContain('href="http://www.google.com"');

    await editor.press("Enter");
    await editor.type("Final Bold Text");
    await selectTextInEditor(editor, "Final Bold Text");
    const boldButton = page.getByRole("button", { name: "Bold" });
    await boldButton.click();
    await waitForSave(page);
    await selectTextInEditor(editor, "Final Bold Text");
    await boldButton.click();
    await waitForSave(page);
    expect(lastSavedData?.content).not.toContain(
      "<strong>Final Bold Text</strong>"
    );

    await editor.press("Enter");
    await editor.type("function test() {}");
    await selectTextInEditor(editor, "function test() {}");
    await page.getByRole("button", { name: "Code Block" }).click();
    await waitForSave(page);
    expect(lastSavedData?.content).toContain(
      "<pre><code>function test() {}</code></pre>"
    );

    const firstParaTextOriginal = "Exploratory Test Start.";
    const textToResizeInFirstPara = "Exploratory";
    await editor
      .locator(`h1:has-text("${firstParaTextOriginal.substring(0, 10)}")`) // Looks for <h1>
      .focus();
    await selectTextInEditor(editor, textToResizeInFirstPara);

    await page
      .getByRole("combobox", { name: "Font Size" })
      .selectOption({ label: "Small" });
    await waitForSave(page);
    expect(lastSavedData?.content).toContain(
      `<span style="font-size: 0.8em">${textToResizeInFirstPara}</span> Test Start.`
    );

    // Ensure focus is on the H1 block containing "Exploratory"
    const firstH1Block = editor.locator(`h1:has-text("${firstParaTextOriginal.substring(0, 10)}")`);
    await firstH1Block.focus();
    await editor.press("End"); // Move cursor to the very end of the content within that H1

    // Press Enter. This should create a new block after the H1.
    await editor.press("Enter");
    // At this point, the cursor is in a new block. Let's explicitly set its style to "Paragraph".
    // This will ensure the block that becomes empty (<p></p>) is indeed a paragraph.
    await page.getByRole("combobox", { name: "Text Style" }).selectOption({ label: "Paragraph" });

    // Now press Enter again. This should create a new paragraph below the current one.
    // The current paragraph (now empty) becomes the <p></p>.
    // The new paragraph is where "More breaks." will be typed.
    await editor.press("Enter");

    // Before typing, to be absolutely sure, set the style for this new line to "Paragraph" again.
    // This helps clear any sticky H1 formatting that might try to re-apply.
    await page.getByRole("combobox", { name: "Text Style" }).selectOption({ label: "Paragraph" });

    await editor.type("More breaks.");
    await waitForSave(page);
    expect(lastSavedData?.content).toMatch(
      new RegExp("<p></p><p[^>]*>(<strong><em><u>)?More breaks\\.") // Checks the start
    );

    const paraToMakeH2Text = "Paragraph after H1.";
    const paraToMakeH2 = editor
      .locator(`p:has-text("${paraToMakeH2Text}")`)
      .first();
    if (await paraToMakeH2.isVisible({ timeout: 1000 })) {
      await selectTextInEditor(editor, paraToMakeH2Text);
      await page
        .getByRole("combobox", { name: "Text Style" })
        .selectOption({ label: "H2" });
      await waitForSave(page);
      expect(lastSavedData?.content).toContain(`<h2>${paraToMakeH2Text}</h2>`);
    }

    await editor.press("End");
    await editor.press("Enter");
    const textForPartialDelete =
      "This is a long sentence for partial deletion.";
    const toDeleteFromSentence = "long sentence ";
    const expectedAfterDelete = "This is a for partial deletion.";
    await editor.type(textForPartialDelete);
    await waitForSave(page);
    await selectTextInEditor(editor, toDeleteFromSentence);
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

    await selectTextInEditor(editor, "Final Step 2"); // Assuming select last typed or relevant part for font change
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
    await editor.type("Exploratory test really complete.");
    await waitForSave(page);
    expect(lastSavedData?.content).toContain(
      "Exploratory test really complete."
    );
    await expect(editor).toContainText("Exploratory test really complete.");
  });
});
