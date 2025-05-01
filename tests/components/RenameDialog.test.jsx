import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import RenameDialog from '../../src/components/RenameDialog';

describe('RenameDialog component', () => {
  const defaultProps = {
    isOpen: true,
    item: { id: '1', name: 'Old Name' },
    newName: 'Old Name',
    onNameChange: jest.fn(),
    onRename: jest.fn(),
    onCancel: jest.fn(),
  };

  test('does not render when isOpen is false', () => {
    const { container } = render(<RenameDialog {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders input with current name and calls callbacks', () => {
    render(<RenameDialog {...defaultProps} />);
    const input = screen.getByDisplayValue('Old Name');
    fireEvent.change(input, { target: { value: 'New Name' } });
    expect(defaultProps.onNameChange).toHaveBeenCalled();
    const renameButton = screen.getByText('Rename');
    fireEvent.click(renameButton);
    expect(defaultProps.onRename).toHaveBeenCalled();
  });
});
