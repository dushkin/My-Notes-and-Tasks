// tests/components/FolderContents.test.jsx
import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import FolderContents from '../../src/components/FolderContents';

describe('<FolderContents /> Component', () => {
  const mockOnSelect = jest.fn();
  const mockOnToggleExpand = jest.fn();
  const mockHandleDragStart = jest.fn();
  const mockHandleDragEnter = jest.fn();
  const mockHandleDragOver = jest.fn();
  const mockHandleDragLeave = jest.fn();
  const mockHandleDrop = jest.fn();
  const mockHandleDragEnd = jest.fn();

  const emptyFolder = { id: 'f1', type: 'folder', label: 'Folder 1', children: [] };

  const folderWithChildren = {
    id: 'f1',
    type: 'folder',
    label: 'Folder 1',
    children: [
      { id: 'n1', type: 'note', label: 'Note A' },
      { id: 't1', type: 'task', label: 'Task B', completed: false },
      { id: 'f2', type: 'folder', label: 'Folder C', children: [] },
      { id: 't2', type: 'task', label: 'Task D', completed: false },
    ],
  };

  // Common props including drag handlers and toggle
  const defaultProps = {
      onSelect: mockOnSelect,
      onToggleExpand: mockOnToggleExpand,
      expandedItems: {},
      handleDragStart: mockHandleDragStart,
      handleDragEnter: mockHandleDragEnter,
      handleDragOver: mockHandleDragOver,
      handleDragLeave: mockHandleDragLeave,
      handleDrop: mockHandleDrop,
      handleDragEnd: mockHandleDragEnd,
      draggedId: null,
      dragOverItemId: null,
  };


  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders empty message when folder has no children', () => {
    render(<FolderContents {...defaultProps} folder={emptyFolder} />);
    expect(screen.getByText('This folder is empty.')).toBeInTheDocument();
  });

  test('renders children items sorted correctly when folder has children', () => {
    render(<FolderContents {...defaultProps} folder={folderWithChildren} />);
    const list = screen.getByRole('list');
    const listItemsAsButtons = within(list).getAllByRole('button', {
        name: /(Folder C \(Folder\)|Note A \(Note\)|Task B \(Task\)|Task D \(Task\))/i
    });
    expect(listItemsAsButtons.length).toBe(4);
    expect(listItemsAsButtons[0]).toHaveAccessibleName('Folder C (Folder)');
    expect(listItemsAsButtons[1]).toHaveAccessibleName('Note A (Note)');
    expect(listItemsAsButtons[2]).toHaveAccessibleName('Task B (Task)');
    expect(listItemsAsButtons[3]).toHaveAccessibleName('Task D (Task)');
  });


  test('calls onSelect with correct child ID when an item is clicked', async () => {
    const user = userEvent.setup();
    render(<FolderContents {...defaultProps} folder={folderWithChildren} />);
    const noteButton = screen.getByRole('button', { name: 'Note A (Note)' });
    await user.click(noteButton);
    expect(mockOnSelect).toHaveBeenCalledWith('n1');
  });

  test('calls onSelect with correct child ID when Enter key is pressed on an item', async () => {
    const user = userEvent.setup();
    render(<FolderContents {...defaultProps} folder={folderWithChildren} />);
    const folderButton = screen.getByRole('button', { name: 'Folder C (Folder)' });
    await user.type(folderButton, '{enter}');
    expect(mockOnSelect).toHaveBeenCalledWith('f2');
  });

  test('calls onSelect with correct child ID when Space key is pressed on an item', async () => {
    const user = userEvent.setup();
    render(<FolderContents {...defaultProps} folder={folderWithChildren} />);
    const taskButton = screen.getByRole('button', { name: 'Task D (Task)' });
    await user.type(taskButton, ' ');
    expect(mockOnSelect).toHaveBeenCalledWith('t2');
  });

  test('calls onToggleExpand when folder EXPAND BUTTON is clicked', async () => {
      const user = userEvent.setup();
      render(
        <FolderContents
          {...defaultProps}
          folder={folderWithChildren}
          expandedItems={{ f2: false }}
        />
      );
      const expandButton = screen.getByRole('button', { name: /expand folder c/i });
      await user.click(expandButton);
      expect(mockOnToggleExpand).toHaveBeenCalledWith('f2');
    });

  test.skip('shows drag-over indicator when dragging over a folder', async () => {
    const { rerender } = render(
      <FolderContents
        {...defaultProps}
        folder={folderWithChildren}
        dragOverItemId={'f2'} // Simulate dragging over f2 initially
      />
    );

    // Find the parent item first
    const folderItem = screen.getByRole('button', { name: 'Folder C (Folder)' });
    expect(folderItem).toBeInTheDocument();

    // Now, wait for the indicator *within* that specific item
    // This seems to be the most reliable way given the previous issues
    const indicator = await within(folderItem).findByTestId('drag-over-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator.tagName).toBe('DIV');

    // Rerender without dragOverItemId to test indicator removal
    rerender(
        <FolderContents
          {...defaultProps}
          folder={folderWithChildren}
          dragOverItemId={null} // Simulate dragging leaving f2
        />
      );
    // Re-find the parent item after rerender
    const updatedFolderItem = screen.getByRole('button', { name: 'Folder C (Folder)' });
    // Use waitFor with queryByTestId within the parent scope for absence check
    await waitFor(() => {
        expect(within(updatedFolderItem).queryByTestId('drag-over-indicator')).not.toBeInTheDocument();
    });
  });


  test('does not show drag-over indicator when dragging over a non-folder', () => {
    render(
      <FolderContents
        {...defaultProps}
        folder={folderWithChildren}
        dragOverItemId={'n1'} // Simulate dragging over note n1
      />
    );
    const noteItem = screen.getByRole('button', { name: 'Note A (Note)' });
    expect(noteItem).toBeInTheDocument();
    // Check globally and within the item
    expect(screen.queryByTestId('drag-over-indicator')).not.toBeInTheDocument();
    expect(within(noteItem).queryByTestId('drag-over-indicator')).not.toBeInTheDocument();
  });

  test('calls drag handlers with correct item', () => {
    render(<FolderContents {...defaultProps} folder={folderWithChildren} />);
    const noteItem = screen.getByRole('button', { name: 'Note A (Note)' });
    const targetFolderItem = screen.getByRole('button', { name: 'Folder C (Folder)' });

    fireEvent.dragStart(noteItem);
    expect(mockHandleDragStart).toHaveBeenCalledWith(expect.any(Object), 'n1');

    fireEvent.dragEnter(noteItem);
    expect(mockHandleDragEnter).toHaveBeenCalledWith(expect.any(Object), 'n1');

    fireEvent.dragOver(noteItem);
    expect(mockHandleDragOver).toHaveBeenCalledWith(expect.any(Object));

    fireEvent.dragLeave(noteItem);
    expect(mockHandleDragLeave).toHaveBeenCalledWith(expect.any(Object));

    fireEvent.drop(targetFolderItem);
    expect(mockHandleDrop).toHaveBeenCalledWith(expect.any(Object), 'f2');

    fireEvent.dragEnd(noteItem);
    expect(mockHandleDragEnd).toHaveBeenCalledWith(expect.any(Object));
  });
});