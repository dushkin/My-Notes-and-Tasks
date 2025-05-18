// tests/components/Tree.test.jsx
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import Tree from "../../src/components/Tree";

// Mock lucide-react MoreVertical icon
jest.mock("lucide-react", () => ({
  ...jest.requireActual("lucide-react"), // Import and retain default behavior
  MoreVertical: () => <svg data-item-id="icon-more-vertical" />,
}));

const mockHandlers = {
  onSelect: jest.fn(),
  onToggleExpand: jest.fn(),
  onToggleTask: jest.fn(),
  onDragStart: jest.fn(),
  onDrop: jest.fn(),
  onNativeContextMenu: jest.fn(),
  onShowItemMenu: jest.fn(),
  onRename: jest.fn(),
  onAttemptRename: jest.fn(),
  cancelInlineRename: jest.fn(),
  setInlineRenameValue: jest.fn(),
  onDragEnd: jest.fn(),
  setUiError: jest.fn(),
};

const sampleItems = [
  {
    id: "f1",
    type: "folder",
    label: "Folder 1",
    children: [
      { id: "f1-n1", type: "note", label: "Note 1.1" },
      { id: "f1-t1", type: "task", label: "Task 1.1", completed: true },
    ],
  },
  { id: "f2", type: "folder", label: "Folder 2", children: [] },
  { id: "n1", type: "note", label: "Note Alpha" },
  { id: "t1", type: "task", label: "Task Beta", completed: false },
];

describe("<Tree /> Component", () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup();
    Object.values(mockHandlers).forEach((mock) => mock.mockClear());
  });

  const defaultProps = {
    items: [],
    selectedItemId: null,
    inlineRenameId: null,
    inlineRenameValue: "",
    expandedFolders: {},
    draggedId: null,
    uiError: "",
    ...mockHandlers,
  };

  test("renders navigation role", () => {
    render(<Tree {...defaultProps} />);
    expect(
      screen.getByRole("navigation", { name: "Notes and Tasks Tree" })
    ).toBeInTheDocument();
  });

  test("renders and sorts top-level items correctly", () => {
    render(<Tree {...defaultProps} items={sampleItems} />);
    const renderedItems = screen.getAllByRole("listitem");
    expect(renderedItems[0]).toHaveTextContent("Folder 1");
    expect(renderedItems[1]).toHaveTextContent("Folder 2");
    expect(renderedItems[2]).toHaveTextContent("Note Alpha");
    expect(renderedItems[3]).toHaveTextContent("Task Beta");
  });

  test("calls onSelect when an item main div is clicked", async () => {
    render(<Tree {...defaultProps} items={sampleItems} />);
    const noteAlphaTextElement = screen.getByText("Note Alpha");
    // The clickable element is the div that has the onClick handler for selection.
    // Based on Tree.jsx, this is the div with classes like 'relative z-10 flex items-center...'
    const clickableDiv = noteAlphaTextElement.closest("div.relative.z-10");

    if (!clickableDiv) {
      throw new Error(
        "Clickable div for 'Note Alpha' not found based on current selector. Check Tree.jsx structure."
      );
    }
    // If the component was updated to have role="button" on the clickable div, this would be:
    // const clickableDiv = noteAlphaTextElement.closest('div[role="button"]');

    await user.click(clickableDiv);
    expect(mockHandlers.onSelect).toHaveBeenCalledWith("n1");
  });

  test("calls onToggleExpand when folder expand button is clicked", async () => {
    render(<Tree {...defaultProps} items={sampleItems} expandedFolders={{}} />);
    const folder1Item = screen.getByText("Folder 1").closest("li");
    if (!folder1Item) throw new Error("List item for 'Folder 1' not found");
    const expandButton = within(folder1Item).getByRole("button", {
      name: /Expand Folder 1/i,
    });
    await user.click(expandButton);
    expect(mockHandlers.onToggleExpand).toHaveBeenCalledWith("f1");
  });

  test("calls onToggleTask when task checkbox area is clicked", async () => {
    render(<Tree {...defaultProps} items={sampleItems} />);
    const taskItem = screen.getByText("Task Beta").closest("li");
    if (!taskItem) throw new Error("List item for 'Task Beta' not found");
    const checkboxButton = within(taskItem).getByRole("checkbox", {
      name: /Mark task Task Beta as complete/i,
    });
    await user.click(checkboxButton);
    expect(mockHandlers.onToggleTask).toHaveBeenCalledWith("t1", true);
  });

  test("calls onShowItemMenu when more options button is clicked", async () => {
    render(<Tree {...defaultProps} items={sampleItems} />);
    const noteItem = screen.getByText("Note Alpha").closest("li");
    if (!noteItem) throw new Error("List item for 'Note Alpha' not found");
    const moreButton = within(noteItem).getByRole("button", {
      name: /More options for Note Alpha/i,
    });
    await user.click(moreButton);
    expect(mockHandlers.onShowItemMenu).toHaveBeenCalledWith(
      expect.objectContaining({ id: "n1", label: "Note Alpha" }),
      expect.any(HTMLElement)
    );
  });

  test("calls onNativeContextMenu when tree area is right-clicked (empty area)", async () => {
    render(<Tree {...defaultProps} items={sampleItems} />);
    const treeNav = screen.getByRole("navigation", {
      name: "Notes and Tasks Tree",
    });
    fireEvent.contextMenu(treeNav);
    expect(mockHandlers.onSelect).toHaveBeenCalledWith(null);
    expect(mockHandlers.onNativeContextMenu).toHaveBeenCalledWith(
      expect.any(Object),
      null
    );
  });

  test("calls onNativeContextMenu when an item is right-clicked", async () => {
    render(<Tree {...defaultProps} items={sampleItems} />);
    const noteItemLi = screen.getByText("Note Alpha").closest("li");
    if (!noteItemLi) throw new Error("Note Alpha list item not found");
    fireEvent.contextMenu(noteItemLi);
    expect(mockHandlers.onSelect).toHaveBeenCalledWith("n1");
    expect(mockHandlers.onNativeContextMenu).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ id: "n1" })
    );
  });

  test("renders inline rename input when inlineRenameId matches an item", () => {
    render(
      <Tree
        {...defaultProps}
        items={sampleItems}
        inlineRenameId="n1"
        inlineRenameValue="Renaming Note"
      />
    );
    const input = screen.getByDisplayValue("Renaming Note");
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
    expect(
      screen.queryByText("Note Alpha", { selector: "span" })
    ).not.toBeInTheDocument();
  });

  test("displays uiError message when inline renaming and error exists", () => {
    const errorMessage = "Name conflict!";
    render(
      <Tree
        {...defaultProps}
        items={sampleItems}
        inlineRenameId="n1"
        uiError={errorMessage}
        inlineRenameValue="Note Alpha" // Provide a value for the input
      />
    );
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    const input = screen.getByDisplayValue("Note Alpha"); // Find by current value
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "n1-rename-error");
  });
});
