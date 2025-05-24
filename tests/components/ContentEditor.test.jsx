// tests/components/ContentEditor.test.jsx
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ContentEditor from "../../src/components/ContentEditor";

jest.mock("../../src/components/TipTapEditor", () => {
  return jest.fn(({ content, initialDirection }) => (
    <div data-item-id="mock-tiptap-editor">
      <div data-item-id="mock-tiptap-content">{content}</div>
      <input
        type="hidden"
        data-item-id="mock-tiptap-direction"
        value={initialDirection}
      />
    </div>
  ));
});

const toExpectedFormat = (isoString) => {
  if (!isoString) return "N/A";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "Invalid Date";
  return date.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

describe("<ContentEditor /> for Timestamps", () => {
  const mockOnSaveItemData = jest.fn();
  const defaultFontFamily = "Arial";

  const baseItem = {
    id: "note1",
    type: "note",
    label: "Test Note with Timestamps",
    content: "<p>Some content</p>",
    direction: "ltr",
  };

  test("should display createdAt and updatedAt timestamps correctly", () => {
    const createdAtISO = new Date(2024, 0, 15, 10, 30, 0).toISOString();
    const updatedAtISO = new Date(2024, 0, 16, 12, 45, 0).toISOString();

    const itemWithTimestamps = {
      ...baseItem,
      createdAt: createdAtISO,
      updatedAt: updatedAtISO,
    };

    render(
      <ContentEditor
        item={itemWithTimestamps}
        onSaveItemData={mockOnSaveItemData}
        defaultFontFamily={defaultFontFamily}
      />
    );

    expect(
      screen.getByText(`Created: ${toExpectedFormat(createdAtISO)}`)
    ).toBeInTheDocument();
    expect(
      screen.getByText(`Last Modified: ${toExpectedFormat(updatedAtISO)}`)
    ).toBeInTheDocument();
  });

  test("should display N/A if createdAt is missing", () => {
    const updatedAtISO = new Date().toISOString();
    const itemWithoutCreatedAt = {
      ...baseItem,
      label: "Note Missing CreatedAt",
      updatedAt: updatedAtISO,
      createdAt: null,
    };
    render(
      <ContentEditor
        item={itemWithoutCreatedAt}
        onSaveItemData={mockOnSaveItemData}
        defaultFontFamily={defaultFontFamily}
      />
    );
    expect(screen.getByText(`Created: N/A`)).toBeInTheDocument();
    expect(
      screen.getByText(`Last Modified: ${toExpectedFormat(updatedAtISO)}`)
    ).toBeInTheDocument();
  });

  test("should display N/A if updatedAt is missing", () => {
    const createdAtISO = new Date().toISOString();
    const itemWithoutUpdatedAt = {
      ...baseItem,
      label: "Note Missing UpdatedAt",
      createdAt: createdAtISO,
      updatedAt: undefined,
    };
    render(
      <ContentEditor
        item={itemWithoutUpdatedAt}
        onSaveItemData={mockOnSaveItemData}
        defaultFontFamily={defaultFontFamily}
      />
    );
    expect(
      screen.getByText(`Created: ${toExpectedFormat(createdAtISO)}`)
    ).toBeInTheDocument();
    expect(screen.getByText(`Last Modified: N/A`)).toBeInTheDocument();
  });

  test('should display "Invalid Date" for invalid timestamp strings', () => {
    const itemWithInvalidTimestamps = {
      ...baseItem,
      label: "Note Invalid Timestamps",
      createdAt: "not-a-date",
      updatedAt: "also-not-a-date",
    };
    render(
      <ContentEditor
        item={itemWithInvalidTimestamps}
        onSaveItemData={mockOnSaveItemData}
        defaultFontFamily={defaultFontFamily}
      />
    );
    expect(screen.getByText("Created: Invalid Date")).toBeInTheDocument();
    expect(screen.getByText("Last Modified: Invalid Date")).toBeInTheDocument();
  });

  test("should display item label", () => {
    const item = {
      ...baseItem,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    render(
      <ContentEditor
        item={item}
        onSaveItemData={mockOnSaveItemData}
        defaultFontFamily={defaultFontFamily}
      />
    );
    expect(
      screen.getByRole("heading", { name: item.label })
    ).toBeInTheDocument();
  });

  test("should pass content and direction to mock TipTapEditor", () => {
    const item = {
      ...baseItem,
      content: "<p>Unique Content</p>",
      direction: "rtl",
    };
    render(
      <ContentEditor
        item={item}
        onSaveItemData={mockOnSaveItemData}
        defaultFontFamily={defaultFontFamily}
      />
    );
    expect(screen.getByTestId("mock-tiptap-content")).toHaveTextContent(
      "Unique Content"
    );
    expect(screen.getByTestId("mock-tiptap-direction")).toHaveValue("rtl");
  });
});
