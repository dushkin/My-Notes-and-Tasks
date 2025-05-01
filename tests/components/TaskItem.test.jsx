import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TaskItem from '../../src/components/TaskItem';

describe('TaskItem component', () => {
  test('returns null if no task prop is provided', () => {
    const { container } = render(<TaskItem />);
    expect(container.firstChild).toBeNull();
  });

  test('renders task label and checkbox', () => {
    const mockToggle = jest.fn();
    const task = { label: 'Test Task', completed: false };
    render(<TaskItem task={task} onToggle={mockToggle} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    expect(screen.getByText('Test Task')).toBeInTheDocument();

    fireEvent.click(checkbox);
    expect(mockToggle).toHaveBeenCalled();
  });
});
