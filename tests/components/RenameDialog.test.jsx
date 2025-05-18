// tests/components/RenameDialog.test.jsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import RenameDialog from "../../src/components/RenameDialog";

describe("<RenameDialog />", () => {
  const mockOnNameChange = jest.fn();
  const mockOnRename = jest.fn();
  const mockOnCancel = jest.fn();

  const defaultProps = {
    isOpen: true,
    item: { id: "1", label: "Old Label" },
    newName: "Old Label",
    onNameChange: mockOnNameChange,
    onRename: mockOnRename,
    onCancel: mockOnCancel,
  };

  beforeEach(() => {
    mockOnNameChange.mockClear();
    mockOnRename.mockClear();
    mockOnCancel.mockClear();
  });

  test("does not render when isOpen is false", () => {
    const { container } = render(
      <RenameDialog {...defaultProps} isOpen={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  test("renders correct title with item label", () => {
    render(<RenameDialog {...defaultProps} />);
    expect(
      screen.getByRole("heading", { name: /Rename “Old Label”/i })
    ).toBeInTheDocument();
  });

  test("renders input with current name, calls onNameChange, and focuses input", () => {
    render(<RenameDialog {...defaultProps} />);
    const input = screen.getByDisplayValue("Old Label");
    expect(input).toBeInTheDocument();
    expect(input).toHaveFocus(); // autoFocus should work

    fireEvent.change(input, { target: { value: "New Label Value" } });
    expect(mockOnNameChange).toHaveBeenCalledTimes(1);
    // The event object itself is passed, so checking e.target.value is fine if needed by the handler
    // expect(mockOnNameChange).toHaveBeenCalledWith(expect.objectContaining({ target: { value: 'New Label Value' } }));
  });

  test("calls onCancel when Cancel button is clicked", () => {
    render(<RenameDialog {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  test("calls onRename when Rename button is clicked", () => {
    render(<RenameDialog {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Rename/i }));
    expect(mockOnRename).toHaveBeenCalledTimes(1);
  });

  test("calls onRename when form is submitted", () => {
    render(<RenameDialog {...defaultProps} />);
    const form = screen
      .getByRole("button", { name: /Rename/i })
      .closest("form");
    if (!form) throw new Error("Form not found");
    fireEvent.submit(form);
    expect(mockOnRename).toHaveBeenCalledTimes(1);
  });
});
