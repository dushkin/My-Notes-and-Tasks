// tests/components/Tree.test.jsx
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import Tree from '../../src/components/Tree';

// Basic Mock for handlers
const mockHandlers = {
  onSelect: jest.fn(),
  onToggleExpand: jest.fn(),
  onToggleTask: jest.fn(),
  onDragStart: jest.fn(),
  onDrop: jest.fn(),
  onContextMenu: jest.fn(),
  onRename: jest.fn(), // Called when rename is initiated (e.g., double-click)
  onDragEnd: jest.fn(),
  setInlineRenameValue: jest.fn(),
  finishInlineRename: jest.fn(),
  cancelInlineRename: jest.fn(),
};

const sampleItems = [
   { id: 'f1', type: 'folder', label: 'Folder 1', children: [
        { id: 'f1-n1', type: 'note', label: 'Note 1.1' },
    ]},
   { id: 'f2', type: 'folder', label: 'Folder 2', children: [] },
   { id: 't1', type: 'task', label: 'Task 1', completed: false },
   { id: 'n1', type: 'note', label: 'Note 1' },
];


describe('<Tree />', () => {
  beforeEach(() => {
    // Reset mocks before each test
    Object.values(mockHandlers).forEach(mock => mock.mockClear());
  });

  const defaultProps = {
    items: [],
    selectedItemId: null,
    inlineRenameId: null,
    inlineRenameValue: '',
    expandedFolders: {},
    draggedId: null,
    ...mockHandlers,
  };

  test('renders navigation role', () => {
    render(<Tree {...defaultProps} />);
    expect(screen.getByRole('navigation', {name: "Notes and Tasks Tree"})).toBeInTheDocument();
  });

  test('renders empty list when items array is empty', () => {
    render(<Tree {...defaultProps} items={[]} />);
    const list = screen.getByRole('navigation');
    expect(within(list).queryAllByRole('listitem').length).toBe(0);
  });

   test('renders top-level items correctly', () => {
    render(<Tree {...defaultProps} items={sampleItems} />);
    expect(screen.getByText('Folder 1')).toBeInTheDocument();
    expect(screen.getByText('Folder 2')).toBeInTheDocument();
    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Note 1')).toBeInTheDocument();
    expect(screen.getByRole('navigation').querySelectorAll(':scope > ul > li').length).toBe(4);
  });

   test('does not render children if folder is not expanded', () => {
     render(<Tree {...defaultProps} items={sampleItems} expandedFolders={{}} />);
     expect(screen.queryByText('Note 1.1')).not.toBeInTheDocument();
   });

    test('renders children if folder is expanded', () => {
      render(<Tree {...defaultProps} items={sampleItems} expandedFolders={{ f1: true }} />);
      expect(screen.getByText('Note 1.1')).toBeInTheDocument();
   });

   test('calls onSelect with item ID when an item is clicked', () => {
     render(<Tree {...defaultProps} items={sampleItems} />);
     const note1Label = screen.getByText('Note 1');
     const clickableDiv = note1Label.closest('div[class*="flex items-center"]');
     expect(clickableDiv).toBeInTheDocument(); // Ensure we found the clickable area
     if (clickableDiv) {
         fireEvent.click(clickableDiv);
         expect(mockHandlers.onSelect).toHaveBeenCalledWith('n1');
     } else {
         throw new Error("Could not find clickable div for Note 1");
     }
   });

    test('calls onToggleExpand when folder expand button is clicked', () => {
      render(<Tree {...defaultProps} items={sampleItems} />);
      const folder1Item = screen.getByText('Folder 1').closest('li');
      if (!folder1Item) throw new Error('Folder 1 li not found');
      const expandButton = within(folder1Item).getByRole('button', { name: /Expand Folder 1/i });
      fireEvent.click(expandButton);
      // *** FIX: Expect only one argument ***
      expect(mockHandlers.onToggleExpand).toHaveBeenCalledWith('f1');
   });

   test('calls onToggleTask when task checkbox area is clicked', () => {
      render(<Tree {...defaultProps} items={sampleItems} />);
      const task1Item = screen.getByText('Task 1').closest('li');
       if (!task1Item) throw new Error('Task 1 li not found');
      const checkboxButton = within(task1Item).getByRole('checkbox');
      fireEvent.click(checkboxButton);
      expect(mockHandlers.onToggleTask).toHaveBeenCalledWith('t1', true); // Toggles from false to true
   });

    test('calls onContextMenu when an item is right-clicked', () => {
       render(<Tree {...defaultProps} items={sampleItems} />);
       const folder2Label = screen.getByText('Folder 2');
       const clickableDiv = folder2Label.closest('div[class*="flex items-center"]');
       expect(clickableDiv).toBeInTheDocument();
       if(clickableDiv) {
           fireEvent.contextMenu(clickableDiv);
           expect(mockHandlers.onContextMenu).toHaveBeenCalledTimes(1);
           expect(mockHandlers.onContextMenu.mock.calls[0][1]).toMatchObject({ id: 'f2', type: 'folder', label: 'Folder 2'});
           expect(mockHandlers.onSelect).toHaveBeenCalledWith('f2');
       } else {
            throw new Error("Could not find clickable div for Folder 2");
       }
   });

   test('displays input when inlineRenameId matches item ID', () => {
        render(<Tree {...defaultProps} items={sampleItems} inlineRenameId="n1" inlineRenameValue="Note 1" />);
        const input = screen.getByDisplayValue('Note 1');
        expect(input).toBeInTheDocument();
        expect(input).toHaveRole('textbox');
        const note1Item = input.closest('li');
        expect(note1Item).toBeInTheDocument();
        expect(within(note1Item).queryByText('Note 1')).not.toBeInTheDocument();
   });

    test('calls onDragStart when item drag starts', () => {
         render(<Tree {...defaultProps} items={sampleItems} />);
         const note1 = screen.getByText('Note 1').closest('li');
         if (!note1) throw new Error('Note 1 li not found');
         fireEvent.dragStart(note1);
         expect(mockHandlers.onDragStart).toHaveBeenCalledTimes(1);
         expect(mockHandlers.onDragStart.mock.calls[0][1]).toBe('n1');
    });

     test('calls onDragEnd when item drag ends', () => {
         render(<Tree {...defaultProps} items={sampleItems} />);
         const note1 = screen.getByText('Note 1').closest('li');
         if (!note1) throw new Error('Note 1 li not found');
         fireEvent.dragStart(note1);
         fireEvent.dragEnd(note1);
         expect(mockHandlers.onDragEnd).toHaveBeenCalledTimes(1);
    });

});