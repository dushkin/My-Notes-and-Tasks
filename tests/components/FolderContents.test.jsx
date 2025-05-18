// tests/components/FolderContents.test.jsx
import React from "react";
import {
  render,
  screen,
  fireEvent,
  within,
  // waitFor, // Not used in this version, can be added if async issues are suspected
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import FolderContents from "../../src/components/FolderContents";

// Mock lucide-react MoreVertical icon
jest.mock("lucide-react", () => ({
  ...jest.requireActual("lucide-react"),
  MoreVertical: () => <svg data-item-id="icon-more-vertical" />,
}));

describe("<FolderContents /> Component", () => {
  const mockOnSelect = jest.fn();
  const mockOnToggleExpand = jest.fn();
  const mockHandleDragStart = jest.fn();
  const mockHandleDragEnd = jest.fn();
  const mockOnShowItemMenu = jest.fn();

  const emptyFolder = {
    id: "f0",
    type: "folder",
    label: "Empty Folder",
    children: [],
  };

  // Define folderWithChildren inside beforeEach or ensure it's immutable if defined outside
  // For simplicity here, defined once. If tests mutate it, move to beforeEach.
  const folderWithChildrenData = {
    id: "f1",
    type: "folder",
    label: "Folder With Items",
    children: [
      { id: "f2", type: "folder", label: "Subfolder Alpha", children: [] },
      { id: "n1", type: "note", label: "Note Beta" },
      { id: "t1", type: "task", label: "Task Gamma", completed: false },
      { id: "t2", type: "task", label: "Task Delta", completed: true },
    ],
  };

  const baseDefaultProps = {
    onSelect: mockOnSelect,
    onToggleExpand: mockOnToggleExpand,
    expandedItems: {},
    handleDragStart: mockHandleDragStart,
    handleDragEnter: jest.fn(),
    handleDragOver: jest.fn(),
    handleDragLeave: jest.fn(),
    handleDrop: jest.fn(),
    handleDragEnd: mockHandleDragEnd,
    draggedId: null,
    dragOverItemId: null,
    onShowItemMenu: mockOnShowItemMenu,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // If folderWithChildren could be mutated by tests (it shouldn't with this data),
    // re-initialize it here:
    // folderWithChildren = { ...folderWithChildrenData, children: [...folderWithChildrenData.children.map(c => ({...c}))] };
  });

  test("renders empty message when folder has no children", () => {
    render(<FolderContents {...baseDefaultProps} folder={emptyFolder} />);
    expect(screen.getByText("This folder is empty.")).toBeInTheDocument();
  });

  test("renders children items sorted correctly", () => {
    render(
      <FolderContents
        {...baseDefaultProps}
        folder={folderWithChildrenData}
        expandedItems={{ f2: false }}
      />
    );

    // STEP 1: UNCOMMENT THE LINE BELOW, RUN TEST, AND INSPECT CONSOLE OUTPUT
    // console.log("DEBUG OUTPUT for 'renders children items sorted correctly':");
    // screen.debug(undefined, 300000); // Debug the whole screen

    // STEP 2: Try querying with a simple regex first
    const listItems = screen.queryAllByTestId(/^item-/);

    // STEP 3: If listItems.length is 0, the screen.debug() output is crucial.
    // It will show if the `<li>` elements with `data-item-id="item-..."` are actually rendered.
    // If they are NOT rendered, the problem is in FolderContents not receiving/processing `folder.children`.
    // If they ARE rendered, the query itself or test runner environment might have an issue.

    expect(listItems.length).toBe(4);

    // These assertions assume listItems are found and sorted correctly.
    // sortItems: Folder (f2), Note (n1), Task (t2-Delta), Task (t1-Gamma)
    expect(
      within(listItems[0]).getByText("Subfolder Alpha")
    ).toBeInTheDocument();
    expect(within(listItems[1]).getByText("Note Beta")).toBeInTheDocument();
    expect(within(listItems[2]).getByText("Task Delta")).toBeInTheDocument();
    expect(within(listItems[3]).getByText("Task Gamma")).toBeInTheDocument();
  });

  test("calls onSelect when an item is clicked", async () => {
    const user = userEvent.setup();
    render(
      <FolderContents {...baseDefaultProps} folder={folderWithChildrenData} />
    );
    // Use getByTestId which throws if not found. If this passes, items are rendered.
    const noteListItem = screen.getByTestId("item-n1");
    await user.click(noteListItem);
    expect(mockOnSelect).toHaveBeenCalledWith("n1");
  });

  test("calls onToggleExpand when folder expand button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <FolderContents
        {...baseDefaultProps}
        folder={folderWithChildrenData}
        expandedItems={{ f2: false }}
      />
    );
    const subfolderItem = screen.getByTestId("item-f2");
    const expandButton = within(subfolderItem).getByRole("button", {
      name: /Expand Subfolder Alpha/i,
    });
    await user.click(expandButton);
    expect(mockOnToggleExpand).toHaveBeenCalledWith("f2");
  });

  test("calls onShowItemMenu when More options button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <FolderContents {...baseDefaultProps} folder={folderWithChildrenData} />
    );
    const noteItemLi = screen.getByTestId("item-n1");
    const moreButton = within(noteItemLi).getByRole("button", {
      name: /More options for Note Beta/i,
    });
    await user.click(moreButton);
    expect(mockOnShowItemMenu).toHaveBeenCalledTimes(1);
    // Find the actual item object from the mock data to ensure the correct one is passed
    const expectedNoteItem = folderWithChildrenData.children.find(
      (child) => child.id === "n1"
    );
    expect(mockOnShowItemMenu).toHaveBeenCalledWith(
      expectedNoteItem,
      expect.any(HTMLElement)
    );
  });

  test("calls drag handlers when an item is dragged", () => {
    render(
      <FolderContents {...baseDefaultProps} folder={folderWithChildrenData} />
    );
    const draggableItem = screen.getByTestId("item-n1");
    fireEvent.dragStart(draggableItem);
    expect(mockHandleDragStart).toHaveBeenCalledWith(expect.any(Object), "n1");
    fireEvent.dragEnd(draggableItem);
    expect(mockHandleDragEnd).toHaveBeenCalledWith(expect.any(Object));
  });

  test("applies opacity when item is being dragged", () => {
    render(
      <FolderContents
        {...baseDefaultProps}
        folder={folderWithChildrenData}
        draggedId="n1" // Simulate n1 being dragged
      />
    );
    const noteItemLi = screen.getByTestId("item-n1");
    expect(noteItemLi).toHaveClass("opacity-40");
  });

  test("shows folder icon correctly (open/closed)", () => {
    const { rerender } = render(
      <FolderContents
        {...baseDefaultProps}
        folder={folderWithChildrenData}
        expandedItems={{ f2: false }} // f2 is initially closed
      />
    );
    const subfolderItem = screen.getByTestId("item-f2");
    expect(within(subfolderItem).getByText("📁")).toBeInTheDocument(); // Closed icon

    rerender(
      <FolderContents
        {...baseDefaultProps}
        folder={folderWithChildrenData}
        expandedItems={{ f2: true }} // Now f2 is open
      />
    );
    // Re-query after rerender
    const openedSubfolderItem = screen.getByTestId("item-f2");
    expect(within(openedSubfolderItem).getByText("📂")).toBeInTheDocument(); // Open icon
  });

  test("shows task completion status correctly", () => {
    render(
      <FolderContents {...baseDefaultProps} folder={folderWithChildrenData} />
    );

    const taskDeltaItem = screen.getByTestId("item-t2"); // Task Delta, completed: true
    expect(within(taskDeltaItem).getByText("✅")).toBeInTheDocument();
    expect(within(taskDeltaItem).getByText("Task Delta")).toHaveClass(
      "line-through"
    );

    const taskGammaItem = screen.getByTestId("item-t1"); // Task Gamma, completed: false
    expect(within(taskGammaItem).getByText("⬜️")).toBeInTheDocument();
    expect(within(taskGammaItem).getByText("Task Gamma")).not.toHaveClass(
      "line-through"
    );
  });
});
