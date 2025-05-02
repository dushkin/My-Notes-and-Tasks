// tests/components/ContextMenu.test.jsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ContextMenu from '../../src/components/ContextMenu';

// Mock the icons to simplify testing
jest.mock('lucide-react', () => ({
  Scissors: () => <svg data-testid="icon-scissors" />,
  Copy: () => <svg data-testid="icon-copy" />,
  ClipboardPaste: () => <svg data-testid="icon-paste" />,
}));


describe('<ContextMenu />', () => {
  const mockOnAddRootFolder = jest.fn();
  const mockOnAddFolder = jest.fn();
  const mockOnAddNote = jest.fn();
  const mockOnAddTask = jest.fn();
  const mockOnRename = jest.fn();
  const mockOnDelete = jest.fn();
  const mockOnCopy = jest.fn();
  const mockOnCut = jest.fn();
  const mockOnPaste = jest.fn();
  const mockOnClose = jest.fn();

  const folderItem = { id: 'f1', type: 'folder', label: 'My Folder' }; // Dummy item
  const noteItem = { id: 'n1', type: 'note', label: 'My Note' };

  const defaultProps = {
    visible: true,
    x: 100,
    y: 150,
    item: null, // Default to no item
    isEmptyArea: false, // Default to not empty area
    clipboardItem: null,
    onAddRootFolder: mockOnAddRootFolder,
    onAddFolder: mockOnAddFolder,
    onAddNote: mockOnAddNote,
    onAddTask: mockOnAddTask,
    onRename: mockOnRename,
    onDelete: mockOnDelete,
    onCopy: mockOnCopy,
    onCut: mockOnCut,
    onPaste: mockOnPaste,
    onClose: mockOnClose,
  };


  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('does not render when visible is false', () => {
    const { container } = render(<ContextMenu {...defaultProps} visible={false} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders at correct position', () => {
    // *** FIX: Provide an item so that buttons render ***
    render(<ContextMenu {...defaultProps} item={noteItem} isEmptyArea={false}/>);
    // Now find a button that *will* exist, like Rename
    const menu = screen.getByRole('button', {name: /Rename/i}).closest('div[class*="fixed"]');
    expect(menu).toHaveStyle(`top: ${defaultProps.y}px`);
    expect(menu).toHaveStyle(`left: ${defaultProps.x}px`);
  });

  // === Tests for Empty Area ===
  describe('When isEmptyArea is true', () => {
     test('renders Add Root Folder and Paste', () => {
      render(<ContextMenu {...defaultProps} isEmptyArea={true} item={null} />);
      expect(screen.getByRole('button', { name: /Add Root Folder/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Paste/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Rename/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Cut/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Copy/i })).not.toBeInTheDocument();
    });

     test('Paste is disabled if clipboard is empty', () => {
        render(<ContextMenu {...defaultProps} isEmptyArea={true} item={null} clipboardItem={null} />);
        const pasteButton = screen.getByRole('button', { name: /Paste/i });
        expect(pasteButton).toBeDisabled();
        expect(pasteButton).toHaveClass('cursor-not-allowed');
    });

     test('Paste is enabled if clipboard has item', () => {
        render(<ContextMenu {...defaultProps} isEmptyArea={true} item={null} clipboardItem={{ id: 'clip1', type: 'note', label: 'Clip' }} />);
        const pasteButton = screen.getByRole('button', { name: /Paste/i });
        expect(pasteButton).toBeEnabled();
        expect(pasteButton).not.toHaveClass('cursor-not-allowed');
        fireEvent.click(pasteButton);
        expect(mockOnPaste).toHaveBeenCalledTimes(1);
     });

      test('calls onAddRootFolder on click', () => {
        render(<ContextMenu {...defaultProps} isEmptyArea={true} item={null} />);
        fireEvent.click(screen.getByRole('button', { name: /Add Root Folder/i }));
        expect(mockOnAddRootFolder).toHaveBeenCalledTimes(1);
     });
  });

  // === Tests for Folder Item ===
  describe('When item is a folder', () => {
     test('renders folder actions, cut, copy, paste, rename, delete', () => {
        render(<ContextMenu {...defaultProps} isEmptyArea={false} item={folderItem} />);
        expect(screen.getByRole('button', { name: /Add Folder Here/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Add Note Here/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Add Task Here/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Cut/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Copy/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Paste Here/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Rename/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Add Root Folder/i })).not.toBeInTheDocument();
     });

      test('Paste Here is enabled/disabled based on clipboard', () => {
          const { rerender } = render(<ContextMenu {...defaultProps} isEmptyArea={false} item={folderItem} clipboardItem={null} />);
          let pasteButton = screen.getByRole('button', { name: /Paste Here/i });
          expect(pasteButton).toBeDisabled();

          rerender(<ContextMenu {...defaultProps} isEmptyArea={false} item={folderItem} clipboardItem={{ id: 'c1', type: 'note' }} />);
          pasteButton = screen.getByRole('button', { name: /Paste Here/i });
          expect(pasteButton).toBeEnabled();
      });

       test('calls correct handlers for folder actions', () => {
            render(<ContextMenu {...defaultProps} isEmptyArea={false} item={folderItem} clipboardItem={{}}/>); // Enable paste for test
            fireEvent.click(screen.getByRole('button', { name: /Add Folder Here/i }));
            expect(mockOnAddFolder).toHaveBeenCalledTimes(1);
            fireEvent.click(screen.getByRole('button', { name: /Add Note Here/i }));
            expect(mockOnAddNote).toHaveBeenCalledTimes(1);
            fireEvent.click(screen.getByRole('button', { name: /Add Task Here/i }));
            expect(mockOnAddTask).toHaveBeenCalledTimes(1);
            fireEvent.click(screen.getByRole('button', { name: /Cut/i }));
            expect(mockOnCut).toHaveBeenCalledTimes(1);
            fireEvent.click(screen.getByRole('button', { name: /Copy/i }));
            expect(mockOnCopy).toHaveBeenCalledTimes(1);
            fireEvent.click(screen.getByRole('button', { name: /Paste Here/i }));
            expect(mockOnPaste).toHaveBeenCalledTimes(1);
            fireEvent.click(screen.getByRole('button', { name: /Rename/i }));
            expect(mockOnRename).toHaveBeenCalledTimes(1);
            fireEvent.click(screen.getByRole('button', { name: /Delete/i }));
            expect(mockOnDelete).toHaveBeenCalledTimes(1);
       });
  });

    // === Tests for Note/Task Item ===
  describe('When item is a note/task', () => {
     test('renders cut, copy, rename, delete but no add/paste actions', () => {
        render(<ContextMenu {...defaultProps} isEmptyArea={false} item={noteItem} />);
        expect(screen.queryByRole('button', { name: /Add Folder Here/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Add Note Here/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Add Task Here/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Paste Here/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Add Root Folder/i })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Cut/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Copy/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Rename/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
     });

       test('calls correct handlers for note/task actions', () => {
            render(<ContextMenu {...defaultProps} isEmptyArea={false} item={noteItem} />);
            fireEvent.click(screen.getByRole('button', { name: /Cut/i }));
            expect(mockOnCut).toHaveBeenCalledTimes(1);
            fireEvent.click(screen.getByRole('button', { name: /Copy/i }));
            expect(mockOnCopy).toHaveBeenCalledTimes(1);
            fireEvent.click(screen.getByRole('button', { name: /Rename/i }));
            expect(mockOnRename).toHaveBeenCalledTimes(1);
            fireEvent.click(screen.getByRole('button', { name: /Delete/i }));
            expect(mockOnDelete).toHaveBeenCalledTimes(1);
       });
  });

    // === General Tests ===
    test('calls onClose when clicking outside', () => {
        render(<div><ContextMenu {...defaultProps} item={noteItem} /> Outside </div>); // Need item to render something
        // Click outside the menu
        fireEvent.mouseDown(screen.getByText('Outside'));
        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    test('calls onClose when Escape key is pressed', () => {
        render(<ContextMenu {...defaultProps} item={noteItem} />); // Need item to render something
        // Menu itself doesn't automatically get focus, fire on body/window
        fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

});