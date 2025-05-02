// tests/components/AddDialog.test.jsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddDialog from '../../src/components/AddDialog';

describe('<AddDialog />', () => {
  const mockOnLabelChange = jest.fn();
  const mockOnAdd = jest.fn();
  const mockOnCancel = jest.fn();

  const defaultProps = {
    isOpen: true,
    newItemType: 'folder',
    newItemLabel: '',
    showError: false,
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
    render(<AddDialog {...defaultProps} newItemType="note" />);
    expect(screen.getByRole('heading', { name: /Add note/i })).toBeInTheDocument();

    render(<AddDialog {...defaultProps} newItemType="task" />);
    // Use queryByRole and getByRole to handle re-render if needed, or unmount first
    expect(screen.getByRole('heading', { name: /Add task/i })).toBeInTheDocument();
  });

  test('renders input, calls onLabelChange, and focuses input', () => {
    render(<AddDialog {...defaultProps} />);
    const input = screen.getByPlaceholderText(/Enter folder name/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(input).toHaveValue('');

    fireEvent.change(input, { target: { value: 'New Folder Name' } });
    expect(mockOnLabelChange).toHaveBeenCalledTimes(1);
    // Note: We don't check input value directly after fireEvent.change because the state is controlled by the parent.
    // We re-render with the expected prop value if needed for further checks.
  });

   test('displays error message when showError is true', () => {
    render(<AddDialog {...defaultProps} showError={true} />);
    expect(screen.getByText(/Name cannot be empty./i)).toBeInTheDocument();
  });

   test('does not display error message when showError is false', () => {
    render(<AddDialog {...defaultProps} showError={false} />);
    expect(screen.queryByText(/Name cannot be empty./i)).not.toBeInTheDocument();
  });

  test('calls onCancel when Cancel button is clicked', () => {
    render(<AddDialog {...defaultProps} />);
    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelButton);
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  test('calls onAdd when Add button is clicked', () => {
    render(<AddDialog {...defaultProps} newItemLabel="Valid Name"/>);
    const addButton = screen.getByRole('button', { name: /Add/i });
    fireEvent.click(addButton);
    expect(mockOnAdd).toHaveBeenCalledTimes(1);
  });

  test('calls onAdd when form is submitted (e.g., pressing Enter)', () => {
    render(<AddDialog {...defaultProps} newItemLabel="Valid Name"/>);
    const form = screen.getByRole('button', { name: /Add/i }).closest('form'); // Find the form element
     if (form) {
      fireEvent.submit(form);
    } else {
      throw new Error("Could not find form element");
    }
    expect(mockOnAdd).toHaveBeenCalledTimes(1);
  });
});