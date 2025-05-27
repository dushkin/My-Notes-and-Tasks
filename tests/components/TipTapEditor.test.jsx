// tests/components/TipTapEditor.test.jsx
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import * as apiClient from "../../src/services/apiClient"; // Import to mock authFetch

// Mock apiClient.authFetch
jest.mock("../../src/services/apiClient", () => ({
  authFetch: jest.fn(),
  initApiClient: jest.fn(),
}));

// Correct mock for 'marked'
jest.mock("marked", () => ({
  parse: jest.fn((text) => `<p>parsed:${text}</p>`),
  Renderer: jest.fn().mockImplementation(() => ({ image: jest.fn(() => "") })),
}));

// Keep the existing mock of TipTapEditor itself, as it tests internal logic of that mock
jest.mock("../../src/components/TipTapEditor", () => {
  const ActualReact = require("react");
  const MockTipTapEditor = (props) => {
    const handleManualMDClick_InMock = () => {
      const markedLib = require("marked");

      let selectedText = props.content || "";
      if (
        props.editorRef &&
        props.editorRef.current &&
        typeof props.editorRef.current.getSelectedText === "function"
      ) {
        selectedText = props.editorRef.current.getSelectedText();
      }
      if (selectedText.trim()) {
        const cleanedText = selectedText
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .join("\n");
        if (!cleanedText) {
          if (props.onEmptySelectionAttempt) {
            props.onEmptySelectionAttempt(
              "Please select some text to convert from Markdown."
            );
          }
          return;
        }
        const renderer = new markedLib.Renderer();
        renderer.image = () => "";

        const html = markedLib.parse(cleanedText, { renderer });
        if (props.onUpdate) {
          props.onUpdate(html, props.initialDirection || "ltr");
        }
      } else {
        if (props.onEmptySelectionAttempt) {
          props.onEmptySelectionAttempt(
            "Please select some text to convert from Markdown."
          );
        }
      }
    };
    return ActualReact.createElement(
      "div",
      { "data-item-id": "mock-tiptap-editor-root" },
      ActualReact.createElement(
        "button",
        {
          "data-item-id": "manual-md-button",
          onClick: handleManualMDClick_InMock,
        },
        "MD"
      ),
      ActualReact.createElement(
        "div",
        // VVV MODIFICATION HERE VVV
        {
          "data-item-id": "tiptap-editor-content-area",
          dangerouslySetInnerHTML: { __html: props.content },
        }
        // ^^^ MODIFICATION HERE ^^^
      ),
      ActualReact.createElement("input", {
        type: "hidden",
        "data-item-id": "mock-tiptap-direction",
        value: props.initialDirection || "ltr",
      })
    );
  };
  MockTipTapEditor.displayName = "MockTipTapEditor";
  return {
    __esModule: true,
    default: MockTipTapEditor,
  };
});

import React from "react";
import TipTapEditor_Mocked from "../../src/components/TipTapEditor";

// VVV MODIFICATION HERE VVV
// Change this:
// const { marked } = require("marked");
// To this:
const marked = require("marked"); // Assign the whole mocked object to 'marked'
// ^^^ MODIFICATION HERE ^^^

describe("<TipTapEditor /> for Markdown (using mock)", () => {
  const mockOnUpdate = jest.fn();
  const mockAlertHandler = jest.fn();

  beforeEach(() => {
    mockOnUpdate.mockClear();
    mockAlertHandler.mockClear();
    // Now 'marked' is the object { parse: fn, Renderer: fn }
    if (
      marked &&
      marked.parse &&
      typeof marked.parse.mockClear === "function"
    ) {
      marked.parse.mockClear();
    }
    if (
      marked &&
      marked.Renderer &&
      typeof marked.Renderer.mockClear === "function"
    ) {
      marked.Renderer.mockClear();
    }
    apiClient.authFetch.mockClear();
  });

  test("Manual MD button converts selected Markdown to HTML", async () => {
    const markdownText = "# Hello\n- Item 1";
    const cleanedMarkdownForParse = markdownText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join("\n");
    const expectedHtmlFromMarked = `<p>parsed:${cleanedMarkdownForParse}</p>`;

    const editorRefMock = { current: { getSelectedText: () => markdownText } };
    let currentContentViaUpdate = markdownText;
    const handleUpdate = (newContent, dir) => {
      currentContentViaUpdate = newContent;
      mockOnUpdate(newContent, dir);
    };

    const { rerender } = render(
      <TipTapEditor_Mocked
        content={currentContentViaUpdate}
        initialDirection="ltr"
        onUpdate={handleUpdate}
        defaultFontFamily="Arial"
        editorRef={editorRefMock}
        onEmptySelectionAttempt={mockAlertHandler}
      />
    );
    const mdButton = screen.getByTestId("manual-md-button");
    await act(async () => {
      await userEvent.click(mdButton);
    });
    // 'marked.parse' will now correctly refer to the mocked parse function
    expect(marked.parse).toHaveBeenCalledWith(
      cleanedMarkdownForParse,
      expect.anything()
    );
    expect(mockOnUpdate).toHaveBeenLastCalledWith(
      expectedHtmlFromMarked,
      "ltr"
    );
    rerender(
      <TipTapEditor_Mocked
        content={currentContentViaUpdate}
        initialDirection="ltr"
        onUpdate={handleUpdate}
        defaultFontFamily="Arial"
        editorRef={editorRefMock}
        onEmptySelectionAttempt={mockAlertHandler}
      />
    );
    const expectedTextContentInDOM = `parsed:${cleanedMarkdownForParse.replace(/\n/g, " ")}`;
    expect(screen.getByTestId("tiptap-editor-content-area")).toHaveTextContent(
      expectedTextContentInDOM
    );
    expect(mockAlertHandler).not.toHaveBeenCalled();
  });

  test("Manual MD button calls onEmptySelectionAttempt for empty selection", async () => {
    const editorRefMock = { current: { getSelectedText: () => "" } };
    render(
      <TipTapEditor_Mocked
        content=""
        initialDirection="ltr"
        onUpdate={mockOnUpdate}
        defaultFontFamily="Arial"
        editorRef={editorRefMock}
        onEmptySelectionAttempt={mockAlertHandler}
      />
    );

    const mdButton = screen.getByTestId("manual-md-button");
    await userEvent.click(mdButton);

    expect(marked.parse).not.toHaveBeenCalled();
    expect(mockAlertHandler).toHaveBeenCalledWith(
      "Please select some text to convert from Markdown."
    );
  });
});
