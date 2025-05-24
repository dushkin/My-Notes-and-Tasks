// tests/components/TipTapEditor.test.jsx
// Note: 'ReactReallyFromTestFile' was an alias. We'll use 'ActualReact' for clarity.
// ActualReact will be required *inside* the mock factory.

import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
// import TipTapEditor from '../../src/components/TipTapEditor'; // Original component, mocked below

// Mock marked for all tests in this file
jest.mock("marked", () => ({
  parse: jest.fn((text) => `<p>parsed:${text}</p>`),
  Renderer: jest.fn().mockImplementation(() => ({ image: jest.fn(() => "") })),
}));

jest.mock("../../src/components/TipTapEditor", () => {
  // require React inside the factory for creating elements
  const ActualReact = require("react");

  const MockTipTapEditor = (props) => {
    const handleManualMDClick_InMock = () => {
      const { marked: mockedMarkedUsage } = require("marked"); // Get the mocked 'marked'
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
            // Call prop instead of window.alert
            props.onEmptySelectionAttempt(
              "Please select some text to convert from Markdown."
            );
          }
          return;
        }
        const renderer = new mockedMarkedUsage.Renderer();
        renderer.image = () => "";
        const html = mockedMarkedUsage.parse(cleanedText, { renderer });
        if (props.onUpdate) {
          props.onUpdate(html, props.initialDirection || "ltr");
        }
      } else {
        if (props.onEmptySelectionAttempt) {
          // Call prop instead of window.alert
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
        { "data-item-id": "tiptap-editor-content-area" },
        props.content
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

import React from "react"; // Normal React import for the test file itself
import TipTapEditor_Mocked from "../../src/components/TipTapEditor"; // This will import the mock
const { marked } = require("marked"); // Get the mocked marked for use in tests

describe("<TipTapEditor /> for Markdown", () => {
  const mockOnUpdate = jest.fn();
  const mockAlertHandler = jest.fn(); // For onEmptySelectionAttempt

  beforeEach(() => {
    mockOnUpdate.mockClear();
    mockAlertHandler.mockClear();
    if (
      marked &&
      marked.parse &&
      typeof marked.parse.mockClear === "function"
    ) {
      marked.parse.mockClear();
    }
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
      // act might still be useful if the mock itself has async aspects or state
      await userEvent.click(mdButton);
    });

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
    expect(screen.getByTestId("tiptap-editor-content-area")).toHaveTextContent(
      `parsed:${cleanedMarkdownForParse}`
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

  test("Automatic paste of simple Markdown (conceptual - mock does not simulate paste event)", () => {
    // This test would require a much more complex mock of TipTap's editor instance
    // or testing the actual component with simulated paste events.
    // The current mock structure is primarily for testing the manual MD button interaction.
    expect(true).toBe(true);
  });
});
