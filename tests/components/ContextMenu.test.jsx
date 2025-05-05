// tests/components/ContextMenu.test.jsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ContextMenu from '../../src/components/ContextMenu';

// Mock lucide-react icons used in ContextMenu
jest.mock('lucide-react', () => ({
  // Ensure all icons used are mocked
  Scissors: () => <svg data-testid="icon-scissors" />,
  Copy: () => <svg data-testid="icon-copy" />,
  ClipboardPaste: () => <svg data-testid="icon-paste" />,
  Upload: () => <svg data-testid="icon-upload" />,
  Download: () => <svg data-testid="icon-download" />,
}));


describe('<ContextMenu />', () => {
  // Mock all handlers passed as props
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
    onDuplicate: jest.fn(), // New
    onExportItem: jest.fn(), // New
    onImportItem: jest.fn(), // New
    onExportTree: jest.fn(), // New
    onImportTree: jest.fn(), // New
    onClose: jest.fn(),
  };

  // Sample items for testing different contexts
  const folderItem = { id: 'f1', type: 'folder', label: 'My Folder' };
  const noteItem = { id: 'n1', type: 'note', label: 'My Note' };
  const clipboardItemMock = { id: 'clip1', type: 'note', label: 'Clipped Note' };

  // Default props structure
  const defaultProps = {
    visible: true,
    x: 100,
    y: 150,
    item: null,
    isEmptyArea: false,
    clipboardItem: null, // No item on clipboard initially
    ...mockHandlers,
  };


  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  test('does not render when visible is false', () => {
    const { container } = render(<ContextMenu {...defaultProps} visible={false} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders at correct position', () => {
    // Render with an item so menu has content
    render(<ContextMenu {...defaultProps} item={noteItem} isEmptyArea={false}/>);
    // Find the main menu div
    const menu = screen.getByRole('button', {name: /Rename/i}).closest('div[class*="fixed"]');
    expect(menu).toHaveStyle(`top: ${defaultProps.y}px`);
    expect(menu).toHaveStyle(`left: ${defaultProps.x}px`);
  });

  // === Tests for Empty Area ===
  describe('When isEmptyArea is true', () => {
     test('renders Add Root Folder, Paste (if clipboard has item), Export Tree, Import Tree', () => {
      // Case 1: Clipboard empty
      const { rerender } = render(<ContextMenu {...defaultProps} isEmptyArea={true} item={null} clipboardItem={null} />);
      expect(screen.getByRole('button', { name: /Add Root Folder/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Export Full Tree/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Import Full Tree/i })).toBeInTheDocument();
      // Paste should NOT be rendered if clipboard is empty
      expect(screen.queryByRole('button', { name: /Paste/i })).not.toBeInTheDocument();
      // Item-specific actions should not be present
      expect(screen.queryByRole('button', { name: /Rename/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Cut/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Duplicate/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Export Item/i })).not.toBeInTheDocument();

       // Case 2: Clipboard has item
      rerender(<ContextMenu {...defaultProps} isEmptyArea={true} item={null} clipboardItem={clipboardItemMock} />);
      expect(screen.getByRole('button', { name: /Add Root Folder/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Export Full Tree/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Import Full Tree/i })).toBeInTheDocument();
       // Paste SHOULD be rendered if clipboard has item
      expect(screen.getByRole('button', { name: /Paste/i })).toBeInTheDocument();
    });

     test('calls correct handlers for empty area actions', () => {
        render(<ContextMenu {...defaultProps} isEmptyArea={true} item={null} clipboardItem={clipboardItemMock} />);

        fireEvent.click(screen.getByRole('button', { name: /Add Root Folder/i }));
        expect(mockHandlers.onAddRootFolder).toHaveBeenCalledTimes(1);
        expect(mockHandlers.onClose).toHaveBeenCalledTimes(1); // Close should be called after action

        fireEvent.click(screen.getByRole('button', { name: /Paste/i }));
        expect(mockHandlers.onPaste).toHaveBeenCalledTimes(1);
        expect(mockHandlers.onClose).toHaveBeenCalledTimes(2);

        fireEvent.click(screen.getByRole('button', { name: /Export Full Tree/i }));
        expect(mockHandlers.onExportTree).toHaveBeenCalledTimes(1);
        expect(mockHandlers.onClose).toHaveBeenCalledTimes(3);

        fireEvent.click(screen.getByRole('button', { name: /Import Full Tree/i }));
        expect(mockHandlers.onImportTree).toHaveBeenCalledTimes(1);
        expect(mockHandlers.onClose).toHaveBeenCalledTimes(4);
     });
  });

  // === Tests for Folder Item ===
  describe('When item is a folder', () => {
     test('renders all folder actions', () => {
        // Case 1: Clipboard empty
        const { rerender } = render(<ContextMenu {...defaultProps} isEmptyArea={false} item={folderItem} clipboardItem={null} />);
        expect(screen.getByRole('button', { name: /Add Folder Here/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Add Note Here/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Add Task Here/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Cut/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Copy/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Duplicate/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Export Item/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Import under Item/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Rename/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
        // Paste should not be rendered
        expect(screen.queryByRole('button', { name: /Paste Here/i })).not.toBeInTheDocument();

         // Case 2: Clipboard has item
        rerender(<ContextMenu {...defaultProps} isEmptyArea={false} item={folderItem} clipboardItem={clipboardItemMock} />);
        // Paste SHOULD be rendered
        expect(screen.getByRole('button', { name: /Paste Here/i })).toBeInTheDocument();
     });

       test('calls correct handlers for folder actions', () => {
            render(<ContextMenu {...defaultProps} isEmptyArea={false} item={folderItem} clipboardItem={clipboardItemMock}/>); // Enable paste for test

            fireEvent.click(screen.getByRole('button', { name: /Add Folder Here/i }));
            expect(mockHandlers.onAddFolder).toHaveBeenCalledTimes(1);
            fireEvent.click(screen.getByRole('button', { name: /Add Note Here/i }));
            expect(mockHandlers.onAddNote).toHaveBeenCalledTimes(1);
            fireEvent.click(screen.getByRole('button', { name: /Add Task Here/i }));
            expect(mockHandlers.onAddTask).toHaveBeenCalledTimes(1);
            fireEvent.click(screen.getByRole('button', { name: /Cut/i }));
            expect(mockHandlers.onCut).toHaveBeenCalledTimes(1);
            fireEvent.click(screen.getByRole('button', { name: /Copy/i }));
            expect(mockHandlers.onCopy).toHaveBeenCalledTimes(1);
            fireEvent.click(screen.getByRole('button', { name: /Duplicate/i }));
            expect(mockHandlers.onDuplicate).toHaveBeenCalledTimes(1);
            fireEvent.click(screen.getByRole('button', { name: /Paste Here/i }));
            expect(mockHandlers.onPaste).toHaveBeenCalledTimes(1);
            fireEvent.click(screen.getByRole('button', { name: /Export Item/i }));
            expect(mockHandlers.onExportItem).toHaveBeenCalledTimes(1);
            fireEvent.click(screen.getByRole('button', { name: /Import under Item/i }));
            expect(mockHandlers.onImportItem).toHaveBeenCalledTimes(1);
            fireEvent.click(screen.getByRole('button', { name: /Rename/i }));
            expect(mockHandlers.onRename).toHaveBeenCalledTimes(1);
            fireEvent.click(screen.getByRole('button', { name: /Delete/i }));
            expect(mockHandlers.onDelete).toHaveBeenCalledTimes(1);

            // Check onClose was called after each action
            expect(mockHandlers.onClose).toHaveBeenCalledTimes(11);
       });
  });

    // === Tests for Note/Task Item ===
  describe('When item is a note/task', () => {
     test('renders note/task actions (no add/paste/import)', () => {
        render(<ContextMenu {...defaultProps} isEmptyArea={false} item={noteItem} clipboardItem={clipboardItemMock} />); // Clipboard full, shouldn't matter

        // Should not be present
        expect(screen.queryByRole('button', { name: /Add Folder Here/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Add Note Here/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Add Task Here/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Paste Here/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Import under Item/i })).not.toBeInTheDocument();

        // Should be present
        expect(screen.getByRole('button', { name: /Cut/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Copy/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Duplicate/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Export Item/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Rename/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
     });

       test('calls correct handlers for note/task actions', () => {
            render(<ContextMenu {...defaultProps} isEmptyArea={false} item={noteItem} />);
            fireEvent.click(screen.getByRole('button', { name: /Cut/i }));
            expect(mockHandlers.onCut).toHaveBeenCalledTimes(1);
            fireEvent.click(screen.getByRole('button', { name: /Copy/i }));
            expect(mockHandlers.onCopy).toHaveBeenCalledTimes(1);
             fireEvent.click(screen.getByRole('button', { name: /Duplicate/i }));
            expect(mockHandlers.onDuplicate).toHaveBeenCalledTimes(1);
            fireEvent.click(screen.getByRole('button', { name: /Export Item/i }));
            expect(mockHandlers.onExportItem).toHaveBeenCalledTimes(1);
            fireEvent.click(screen.getByRole('button', { name: /Rename/i }));
            expect(mockHandlers.onRename).toHaveBeenCalledTimes(1);
            fireEvent.click(screen.getByRole('button', { name: /Delete/i }));
            expect(mockHandlers.onDelete).toHaveBeenCalledTimes(1);

            expect(mockHandlers.onClose).toHaveBeenCalledTimes(6);
       });
  });

    // === General Tests ===
    test('calls onClose when clicking outside', () => {
        render(<div><ContextMenu {...defaultProps} item={noteItem} /> Outside </div>); // Need item to render something
        // Click outside the menu
        fireEvent.mouseDown(screen.getByText('Outside'));
        expect(mockHandlers.onClose).toHaveBeenCalledTimes(1);
    });

    test('calls onClose when Escape key is pressed', () => {
        render(<ContextMenu {...defaultProps} item={noteItem} />); // Need item to render something
        // Menu itself doesn't automatically get focus, fire on body/window
        fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
        expect(mockHandlers.onClose).toHaveBeenCalledTimes(1);
    });

});