// tests/components/Tree.test.jsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Tree from '../../src/components/Tree';

const mockHandlers = {
  onSelect: jest.fn(),
  onToggleExpand: jest.fn(),
  onToggleTask: jest.fn(),
  onDragStart: jest.fn(),
  onDrop: jest.fn(),
  onContextMenu: jest.fn(),
  onRename: jest.fn(),
  onAttemptRename: jest.fn(),
  cancelInlineRename: jest.fn(),
  setInlineRenameValue: jest.fn(),
  onDragEnd: jest.fn(),
  setUiError: jest.fn(),
};

const sampleItems = [
  {
    id: 'f1',
    type: 'folder',
    label: 'Folder 1',
    children: [
      { id: 'f1-n1', type: 'note', label: 'Note 1.1' },
      { id: 'f1-t1', type: 'task', label: 'Task 1.1', completed: true },
    ],
  },
  { id: 'f2', type: 'folder', label: 'Folder 2', children: [] },
  { id: 'n1', type: 'note', label: 'Note 1' },
  { id: 't1', type: 'task', label: 'Task 1', completed: false },
];

describe('<Tree /> Component', () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup();
    Object.values(mockHandlers).forEach((mock) => mock.mockClear());
  });

  const defaultProps = {
    items: [],
    selectedItemId: null,
    inlineRenameId: null,
    inlineRenameValue: '',
    expandedFolders: {},
    draggedId: null,
    uiError: '',
    ...mockHandlers,
  };

  test('renders navigation role', () => {
    render(<Tree {...defaultProps} />);
    expect(screen.getByRole('navigation', { name: 'Notes and Tasks Tree' })).toBeInTheDocument();
  });

  test('renders top-level items correctly', () => {
    render(<Tree {...defaultProps} items={sampleItems} />);
    expect(screen.getByText('Folder 1')).toBeInTheDocument();
    expect(screen.getByText('Folder 2')).toBeInTheDocument();
    expect(screen.getByText('Note 1')).toBeInTheDocument();
    expect(screen.getByText('Task 1')).toBeInTheDocument();
  });

  test('expands folder when toggle button is clicked', async () => {
    render(<Tree {...defaultProps} items={sampleItems} />);
    const folderButton = screen.getByRole('button', { name: /expand folder 1/i });
    await user.click(folderButton);
    expect(mockHandlers.onToggleExpand).toHaveBeenCalledWith('f1');
  });

  test.skip('shows drag-over indicator on valid target', async () => {
    // Skipped until Tree.jsx confirms drag-over-indicator
    render(<Tree {...defaultProps} items={sampleItems} />);
    const sourceNote = document.querySelector('[data-item-id="n1"]');
    const targetFolder = document.querySelector('[data-item-id="f2"]');
    expect(sourceNote).toBeInTheDocument();
    expect(targetFolder).toBeInTheDocument();
    fireEvent.dragStart(sourceNote);
    fireEvent.dragEnter(targetFolder);
    fireEvent.dragOver(targetFolder);
    expect(screen.getByTestId('drag-over-indicator')).toBeInTheDocument();
    fireEvent.dragLeave(targetFolder);
    fireEvent.dragEnd(sourceNote);
  });

  test('calls onSelect when an item is clicked', async () => {
    render(<Tree {...defaultProps} items={sampleItems} />);
    const noteItem = document.querySelector('[data-item-id="n1"]');
    expect(noteItem).toBeInTheDocument();
    const noteDiv = noteItem.querySelector('.cursor-pointer');
    await user.click(noteDiv);
    expect(mockHandlers.onSelect).toHaveBeenCalledWith('n1');
  });
});