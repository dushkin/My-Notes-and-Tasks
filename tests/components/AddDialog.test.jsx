// tests/components/AddDialog.test.jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddDialog from '../../src/components/AddDialog';

describe('<AddDialog />', () => {
  const mockOnLabelChange = jest.fn();
  const mockOnAdd = jest.fn();
  const mockOnCancel = jest.fn();

  // Updated props to use errorMessage
  const defaultProps = {
    isOpen: true,
    newItemType: 'folder',
    newItemLabel: '',
    errorMessage: '', // Use errorMessage instead of showError
    onLabelChange: mockOnLabelChange,
    onAdd: mockOnAdd,
    onCancel: mockOnCancel,
  };

  beforeEach(() => {
    // Clear mock calls before each test
    mockOnLabelChange.mockClear();
    mockOnAdd.mockClear();
    mockOnCancel.mockClear();
  });

  test('does not render when isOpen is false', () => {
    const { container } = render(<AddDialog {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders correct title based on newItemType', () => {
    const { rerender } = render(<AddDialog {...defaultProps} newItemType="folder" />);
    expect(screen.getByRole('heading', { name: /Add folder/i })).toBeInTheDocument();

    rerender(<AddDialog {...defaultProps} newItemType="note" />);
    expect(screen.getByRole('heading', { name: /Add note/i })).toBeInTheDocument();

    rerender(<AddDialog {...defaultProps} newItemType="task" />);
    expect(screen.getByRole('heading', { name: /Add task/i })).toBeInTheDocument();
  });

  test('renders input, calls onLabelChange, and focuses input', async () => {
    render(<AddDialog {...defaultProps} />);
    const input = screen.getByPlaceholderText(/Enter folder name/i);
    expect(input).toBeInTheDocument();
    // Focus happens in useEffect, might need waitFor
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveValue('');

    fireEvent.change(input, { target: { value: 'New Folder Name' } });
    expect(mockOnLabelChange).toHaveBeenCalledTimes(1);
    // We test the controlled value by passing it back in props in other tests
  });

   test('displays specific error message when errorMessage prop is set', () => {
    const errorText = "Duplicate name detected!";
    render(<AddDialog {...defaultProps} errorMessage={errorText} />);
    expect(screen.getByText(errorText)).toBeInTheDocument();
    // Check ARIA attribute
    const input = screen.getByPlaceholderText(/Enter folder name/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'add-error-message'); // ID of the error p tag
    expect(input).toHaveClass('border-red-500'); // Check error styling
  });

   test('does not display error message when errorMessage is empty', () => {
    render(<AddDialog {...defaultProps} errorMessage="" />);
    // Use queryByRole for absence check
    const errorElement = screen.queryByRole('alert'); // Assuming error message <p> might have alert role implicitly
    expect(errorElement).not.toBeInTheDocument(); // Or query by specific text if needed
     const input = screen.getByPlaceholderText(/Enter folder name/i);
     expect(input).not.toHaveAttribute('aria-invalid', 'true');
     expect(input).not.toHaveAttribute('aria-describedby');
     expect(input).not.toHaveClass('border-red-500');
  });

  test('calls onCancel when Cancel button is clicked', () => {
    render(<AddDialog {...defaultProps} />);
    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelButton);
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  test('calls onAdd when Add button is clicked', () => {
    // Render with a non-empty label to ensure button isn't implicitly disabled by lack of value
    render(<AddDialog {...defaultProps} newItemLabel="Valid Name"/>);
    const addButton = screen.getByRole('button', { name: /Add/i });
    fireEvent.click(addButton);
    expect(mockOnAdd).toHaveBeenCalledTimes(1);
  });

  test('calls onAdd when form is submitted (e.g., pressing Enter in input)', () => {
    render(<AddDialog {...defaultProps} newItemLabel="Valid Name"/>);
    const form = screen.getByRole('button', { name: /Add/i }).closest('form');
     if (!form) throw new Error("Could not find form element");
     fireEvent.submit(form);
    expect(mockOnAdd).toHaveBeenCalledTimes(1);
  });

  // Optional: Test disabled state if implemented
  // test('Add button is disabled when newItemLabel is empty/whitespace', () => {
  //   const { rerender } = render(<AddDialog {...defaultProps} newItemLabel="" />);
  //   expect(screen.getByRole('button', { name: /Add/i })).toBeDisabled();

  //   rerender(<AddDialog {...defaultProps} newItemLabel="   " />);
  //   expect(screen.getByRole('button', { name: /Add/i })).toBeDisabled();

  //   rerender(<AddDialog {...defaultProps} newItemLabel="Valid" />);
  //   expect(screen.getByRole('button', { name: /Add/i })).toBeEnabled();
  // });
});