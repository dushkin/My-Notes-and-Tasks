// tests/components/ExportDialog.test.jsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ExportDialog from '../../src/components/ExportDialog';

describe('<ExportDialog />', () => {
  const mockOnClose = jest.fn();
  const mockOnExport = jest.fn();

  const defaultProps = {
    isOpen: true,
    context: null, // Generic context, allows choosing target
    defaultFormat: 'json',
    onClose: mockOnClose,
    onExport: mockOnExport,
  };

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnExport.mockClear();
  });

  test('does not render when isOpen is false', () => {
    const { container } = render(<ExportDialog {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders correctly with default props (generic context)', () => {
    render(<ExportDialog {...defaultProps} />);
    expect(screen.getByRole('heading', { name: /Export Options/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Selected Item/i)).toBeChecked(); // Default target
    expect(screen.getByLabelText(/JSON/i)).toBeChecked(); // Default format
    expect(screen.getByRole('button', { name: /Export as JSON/i })).toBeInTheDocument();
  });

  test('renders correctly for "item" context', () => {
    render(<ExportDialog {...defaultProps} context="item" />);
    expect(screen.getByRole('heading', { name: /Export Selected Item/i })).toBeInTheDocument();
    // Target radio buttons should not be shown
    expect(screen.queryByLabelText(/Selected Item/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Entire Tree/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/JSON/i)).toBeChecked();
  });

  test('renders correctly for "tree" context', () => {
    render(<ExportDialog {...defaultProps} context="tree" />);
    expect(screen.getByRole('heading', { name: /Export Full Tree/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Selected Item/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Entire Tree/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/PDF/i)).not.toBeChecked(); // JSON is default
  });

  test('allows changing export target when context is generic', async () => {
    const user = userEvent.setup();
    render(<ExportDialog {...defaultProps} context={null} />); // Generic context
    const entireTreeRadio = screen.getByLabelText(/Entire Tree/i);
    await user.click(entireTreeRadio);
    expect(entireTreeRadio).toBeChecked();
  });

  test('allows changing export format', async () => {
    const user = userEvent.setup();
    render(<ExportDialog {...defaultProps} />);
    const pdfRadio = screen.getByLabelText(/PDF/i);
    await user.click(pdfRadio);
    expect(pdfRadio).toBeChecked();
    expect(screen.getByRole('button', { name: /Export as PDF/i })).toBeInTheDocument();
  });

  test('calls onExport with correct target and format', async () => {
    const user = userEvent.setup();
    render(<ExportDialog {...defaultProps} context={null} />); // Generic to allow target change
    
    // Change target and format
    await user.click(screen.getByLabelText(/Entire Tree/i));
    await user.click(screen.getByLabelText(/PDF/i));
    
    await user.click(screen.getByRole('button', { name: /Export as PDF/i }));
    expect(mockOnExport).toHaveBeenCalledWith('entire', 'pdf');
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('calls onExport with "selected" target if context is "item"', async () => {
    const user = userEvent.setup();
    render(<ExportDialog {...defaultProps} context="item" defaultFormat="pdf" />);
    await user.click(screen.getByRole('button', { name: /Export as PDF/i }));
    expect(mockOnExport).toHaveBeenCalledWith('selected', 'pdf');
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('calls onClose when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<ExportDialog {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('uses defaultFormat prop correctly', () => {
    render(<ExportDialog {...defaultProps} defaultFormat="pdf" />);
    expect(screen.getByLabelText(/PDF/i)).toBeChecked();
    expect(screen.getByRole('button', {name: /Export as PDF/i})).toBeInTheDocument();
  });
});