// tests/components/ImportDialog.test.jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ImportDialog from '../../src/components/ImportDialog';

describe('<ImportDialog />', () => {
  const mockOnClose = jest.fn();
  const mockOnImport = jest.fn();
  const selectedItemMock = { id: 'folder1', label: 'My Folder', type: 'folder' };

  const defaultProps = {
    isOpen: true,
    context: 'item', // Default to import under item
    selectedItem: selectedItemMock,
    onClose: mockOnClose,
    onImport: mockOnImport,
  };

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnImport.mockClear();
  });

  test('does not render when isOpen is false', () => {
    const { container } = render(<ImportDialog {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders correctly for "import under item" context', () => {
    render(<ImportDialog {...defaultProps} />);
    expect(screen.getByRole('heading', { name: /Import Under "My Folder"/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Under Selected Item/i)).toBeChecked();
    expect(screen.getByLabelText(/Into empty tree or overwrite existing data/i)).not.toBeChecked();
    expect(screen.getByLabelText(/Select JSON File/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled(); // No file selected
  });

  test('renders correctly for "tree" (full import) context', () => {
    render(<ImportDialog {...defaultProps} context="tree" selectedItem={null} />);
    expect(screen.getByRole('heading', { name: /Import Tree \(Overwrite Existing\)/i })).toBeInTheDocument();
    // Radio buttons might be hidden or "Replace Entire Tree" forced checked
    // Based on current ImportDialog, radio buttons are hidden if context="tree"
    expect(screen.queryByLabelText(/Under Selected Item/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Into empty tree or overwrite existing data/i)).not.toBeInTheDocument();
    expect(screen.getByText(/This will replace your entire current tree/i)).toBeInTheDocument();
  });

  test('enables import button when a file is selected', async () => {
    const user = userEvent.setup();
    render(<ImportDialog {...defaultProps} />);
    const fileInput = screen.getByLabelText(/Select JSON File/i);
    const file = new File(['{"test":"data"}'], 'test.json', { type: 'application/json' });
    
    await user.upload(fileInput, file);
    expect(screen.getByText(/Selected: test.json/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled();
  });

  test('calls onImport with file and target when Import button is clicked', async () => {
    const user = userEvent.setup();
    mockOnImport.mockResolvedValue({ success: true }); // Mock onImport to resolve
    render(<ImportDialog {...defaultProps} context="item" selectedItem={selectedItemMock} />);
    const fileInput = screen.getByLabelText(/Select JSON File/i);
    const file = new File(['{"id":"1","label":"Test"}'], 'import.json', { type: 'application/json' });
    await user.upload(fileInput, file);
    
    const importButton = screen.getByRole('button', { name: 'Import' });
    await user.click(importButton);

    await waitFor(() => {
      expect(mockOnImport).toHaveBeenCalledWith(file, 'selected'); // 'selected' because context is 'item'
    });
  });

  test('calls onImport with "entire" target if that option is selected', async () => {
    const user = userEvent.setup();
    mockOnImport.mockResolvedValue({ success: true });
     // Render without specific item context to allow radio button choice
    render(<ImportDialog isOpen={true} context="generic" selectedItem={null} onClose={mockOnClose} onImport={mockOnImport} />);
    
    const fileInput = screen.getByLabelText(/Select JSON File/i);
    const file = new File(['[{"id":"1"}]'], 'tree.json', { type: 'application/json' });
    await user.upload(fileInput, file);

    // Select "Replace Entire Tree"
    const entireTreeRadio = screen.getByLabelText(/Into empty tree or overwrite existing data/i);
    await user.click(entireTreeRadio);
    
    const importButton = screen.getByRole('button', { name: 'Import' });
    await user.click(importButton);

    await waitFor(() => {
      expect(mockOnImport).toHaveBeenCalledWith(file, 'entire');
    });
  });


  test('calls onClose when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<ImportDialog {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /Close/i })); // Changed from Cancel to Close
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('displays import message on success', async () => {
    const user = userEvent.setup();
    mockOnImport.mockResolvedValue({ success: true, message: "Test import successful" });
    render(<ImportDialog {...defaultProps} />);
    const fileInput = screen.getByLabelText(/Select JSON File/i);
    const file = new File(['{}'], 'test.json', { type: 'application/json' });
    await user.upload(fileInput, file);
    await user.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() => {
      expect(screen.getByText("Test import successful")).toBeInTheDocument();
      expect(screen.getByText("Test import successful")).toHaveClass('bg-green-100');
    });
  });

  test('displays import message on failure', async () => {
    const user = userEvent.setup();
    mockOnImport.mockResolvedValue({ success: false, error: "Test import failed" });
    render(<ImportDialog {...defaultProps} />);
    const fileInput = screen.getByLabelText(/Select JSON File/i);
    const file = new File(['{}'], 'test.json', { type: 'application/json' });
    await user.upload(fileInput, file);
    await user.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() => {
      expect(screen.getByText("Test import failed")).toBeInTheDocument();
      expect(screen.getByText("Test import failed")).toHaveClass('bg-red-100');
    });
  });
});