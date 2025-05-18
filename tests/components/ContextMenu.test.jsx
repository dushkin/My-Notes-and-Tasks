// tests/components/ContextMenu.test.jsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import ContextMenu from "../../src/components/ContextMenu";

jest.mock("lucide-react", () => ({
  Scissors: () => <svg data-item-id="icon-scissors" />,
  Copy: () => <svg data-item-id="icon-copy" />,
  ClipboardPaste: () => <svg data-item-id="icon-paste" />,
  Upload: () => <svg data-item-id="icon-upload" />,
  Download: () => <svg data-item-id="icon-download" />,
}));

describe("<ContextMenu />", () => {
  const mockHandlers = {
    onAddRootFolder: jest.fn(),
    onAddFolder: jest.fn(),
    onAddNote: jest.fn(),
    onAddTask: jest.fn(),
    onRename: jest.fn(),
    onDelete: jest.fn(),
    onCopy: jest.fn(),
    onCut: jest.fn(),
    onPaste: jest.fn(),
    onDuplicate: jest.fn(),
    onExportItem: jest.fn(),
    onImportItem: jest.fn(),
    onExportTree: jest.fn(),
    onImportTree: jest.fn(),
    onClose: jest.fn(),
  };
  const folderItem = { id: "f1", type: "folder", label: "My Folder" };
  const noteItem = { id: "n1", type: "note", label: "My Note" };
  const clipboardItemMock = {
    id: "clip1",
    type: "note",
    label: "Clipped Note",
  };
  const defaultProps = {
    visible: true,
    x: 100,
    y: 150,
    item: null,
    isEmptyArea: false,
    clipboardItem: null,
    ...mockHandlers,
  };

  beforeEach(() => jest.clearAllMocks());

  test("does not render when visible is false", () => {
    const { container } = render(
      <ContextMenu {...defaultProps} visible={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  test("renders at correct position", () => {
    render(
      <ContextMenu {...defaultProps} item={noteItem} isEmptyArea={false} />
    );
    const menu = screen
      .getByRole("button", { name: /Rename/i })
      .closest('div[class*="fixed"]');
    expect(menu).toHaveStyle(`top: ${defaultProps.y}px`);
    expect(menu).toHaveStyle(`left: ${defaultProps.x}px`);
  });

  describe("When isEmptyArea is true", () => {
    test("renders correct empty area actions", () => {
      const { rerender } = render(
        <ContextMenu
          {...defaultProps}
          isEmptyArea={true}
          item={null}
          clipboardItem={null}
        />
      );
      expect(
        screen.getByRole("button", { name: /Add Root Folder/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Export Full Tree/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Import Full Tree/i })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Paste/i })
      ).not.toBeInTheDocument();

      rerender(
        <ContextMenu
          {...defaultProps}
          isEmptyArea={true}
          item={null}
          clipboardItem={clipboardItemMock}
        />
      );
      expect(
        screen.getByRole("button", { name: /Paste/i })
      ).toBeInTheDocument();
    });
    test("calls correct handlers for empty area actions", () => {
      render(
        <ContextMenu
          {...defaultProps}
          isEmptyArea={true}
          item={null}
          clipboardItem={clipboardItemMock}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /Add Root Folder/i }));
      expect(mockHandlers.onAddRootFolder).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: /Paste/i }));
      expect(mockHandlers.onPaste).toHaveBeenCalledTimes(1);
      fireEvent.click(
        screen.getByRole("button", { name: /Export Full Tree/i })
      );
      expect(mockHandlers.onExportTree).toHaveBeenCalledTimes(1);
      fireEvent.click(
        screen.getByRole("button", { name: /Import Full Tree/i })
      );
      expect(mockHandlers.onImportTree).toHaveBeenCalledTimes(1);
      expect(mockHandlers.onClose).toHaveBeenCalledTimes(4);
    });
  });

  describe("When item is a folder", () => {
    test("renders all folder actions", () => {
      const { rerender } = render(
        <ContextMenu
          {...defaultProps}
          isEmptyArea={false}
          item={folderItem}
          clipboardItem={null}
        />
      );
      expect(
        screen.getByRole("button", { name: /Add Folder Here/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Add Note Here/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Add Task Here/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Import under Item/i })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Paste Here/i })
      ).not.toBeInTheDocument();
      rerender(
        <ContextMenu
          {...defaultProps}
          isEmptyArea={false}
          item={folderItem}
          clipboardItem={clipboardItemMock}
        />
      );
      expect(
        screen.getByRole("button", { name: /Paste Here/i })
      ).toBeInTheDocument();
    });
    test("calls correct handlers for folder actions", () => {
      render(
        <ContextMenu
          {...defaultProps}
          isEmptyArea={false}
          item={folderItem}
          clipboardItem={clipboardItemMock}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /Add Folder Here/i }));
      expect(mockHandlers.onAddFolder).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: /Add Note Here/i }));
      expect(mockHandlers.onAddNote).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: /Add Task Here/i }));
      expect(mockHandlers.onAddTask).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: /Cut/i }));
      expect(mockHandlers.onCut).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: /Copy/i }));
      expect(mockHandlers.onCopy).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: /Duplicate/i }));
      expect(mockHandlers.onDuplicate).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: /Paste Here/i }));
      expect(mockHandlers.onPaste).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: /Export Item/i }));
      expect(mockHandlers.onExportItem).toHaveBeenCalledTimes(1);
      fireEvent.click(
        screen.getByRole("button", { name: /Import under Item/i })
      );
      expect(mockHandlers.onImportItem).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: /Rename/i }));
      expect(mockHandlers.onRename).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: /Delete/i }));
      expect(mockHandlers.onDelete).toHaveBeenCalledTimes(1);
      expect(mockHandlers.onClose).toHaveBeenCalledTimes(11);
    });
  });

  describe("When item is a note/task", () => {
    test("renders note/task actions (no add/paste/import)", () => {
      render(
        <ContextMenu
          {...defaultProps}
          isEmptyArea={false}
          item={noteItem}
          clipboardItem={clipboardItemMock}
        />
      );
      expect(
        screen.queryByRole("button", { name: /Add Folder Here/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Paste Here/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Import under Item/i })
      ).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Cut/i })).toBeInTheDocument();
    });
    test("calls correct handlers for note/task actions", () => {
      render(
        <ContextMenu {...defaultProps} isEmptyArea={false} item={noteItem} />
      );
      fireEvent.click(screen.getByRole("button", { name: /Cut/i }));
      expect(mockHandlers.onCut).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: /Copy/i }));
      expect(mockHandlers.onCopy).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: /Duplicate/i }));
      expect(mockHandlers.onDuplicate).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: /Export Item/i }));
      expect(mockHandlers.onExportItem).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: /Rename/i }));
      expect(mockHandlers.onRename).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: /Delete/i }));
      expect(mockHandlers.onDelete).toHaveBeenCalledTimes(1);
      expect(mockHandlers.onClose).toHaveBeenCalledTimes(6);
    });
  });

  test("calls onClose when clicking outside", () => {
    render(
      <div>
        <ContextMenu {...defaultProps} item={noteItem} /> Outside{" "}
      </div>
    );
    fireEvent.mouseDown(screen.getByText("Outside"));
    expect(mockHandlers.onClose).toHaveBeenCalledTimes(1);
  });
  test("calls onClose when Escape key is pressed", () => {
    render(<ContextMenu {...defaultProps} item={noteItem} />);
    fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });
    expect(mockHandlers.onClose).toHaveBeenCalledTimes(1);
  });
});
