// tests/components/AddDialog.test.jsx
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import AddDialog from "../../src/components/AddDialog";

describe("<AddDialog />", () => {
  const mockOnLabelChange = jest.fn();
  const mockOnAdd = jest.fn();
  const mockOnCancel = jest.fn();

  const defaultProps = {
    isOpen: true,
    newItemType: "folder",
    newItemLabel: "",
    errorMessage: "",
    onLabelChange: mockOnLabelChange,
    onAdd: mockOnAdd,
    onCancel: mockOnCancel,
  };

  beforeEach(() => {
    mockOnLabelChange.mockClear();
    mockOnAdd.mockClear();
    mockOnCancel.mockClear();
  });

  test("does not render when isOpen is false", () => {
    const { container } = render(
      <AddDialog {...defaultProps} isOpen={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  test("renders correct title based on newItemType", () => {
    const { rerender } = render(
      <AddDialog {...defaultProps} newItemType="folder" />
    );
    expect(
      screen.getByRole("heading", { name: /Add folder/i })
    ).toBeInTheDocument();

    rerender(<AddDialog {...defaultProps} newItemType="note" />);
    expect(
      screen.getByRole("heading", { name: /Add note/i })
    ).toBeInTheDocument();

    rerender(<AddDialog {...defaultProps} newItemType="task" />);
    expect(
      screen.getByRole("heading", { name: /Add task/i })
    ).toBeInTheDocument();
  });

  test("renders input, calls onLabelChange, and focuses input", async () => {
    render(<AddDialog {...defaultProps} />);
    const input = screen.getByPlaceholderText(/Enter folder name/i);
    expect(input).toBeInTheDocument();
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveValue("");

    fireEvent.change(input, { target: { value: "New Folder Name" } });
    expect(mockOnLabelChange).toHaveBeenCalledTimes(1);
  });

  test("displays specific error message when errorMessage prop is set", () => {
    const errorText = "Duplicate name detected!";
    render(<AddDialog {...defaultProps} errorMessage={errorText} />);
    expect(screen.getByText(errorText)).toBeInTheDocument();
    const input = screen.getByPlaceholderText(/Enter folder name/i);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "add-error-message");
    expect(input).toHaveClass("border-red-500");
  });

  test("does not display error message when errorMessage is empty", () => {
    render(<AddDialog {...defaultProps} errorMessage="" />);
    const errorParagraph = screen.queryByText("Duplicate name detected!"); // Example error text
    expect(errorParagraph).not.toBeInTheDocument();
    const input = screen.getByPlaceholderText(/Enter folder name/i);
    expect(input).not.toHaveAttribute("aria-invalid", "true");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(input).not.toHaveClass("border-red-500");
  });

  test("calls onCancel when Cancel button is clicked", () => {
    render(<AddDialog {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  test("calls onAdd when Add button is clicked", () => {
    render(<AddDialog {...defaultProps} newItemLabel="Valid Name" />);
    fireEvent.click(screen.getByRole("button", { name: /Add/i }));
    expect(mockOnAdd).toHaveBeenCalledTimes(1);
  });

  test("calls onAdd when form is submitted", () => {
    render(<AddDialog {...defaultProps} newItemLabel="Valid Name" />);
    const form = screen.getByRole("button", { name: /Add/i }).closest("form");
    if (!form) throw new Error("Could not find form element");
    fireEvent.submit(form);
    expect(mockOnAdd).toHaveBeenCalledTimes(1);
  });
});
