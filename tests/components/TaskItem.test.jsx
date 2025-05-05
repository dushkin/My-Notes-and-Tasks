// tests/components/TaskItem.test.jsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom'; // Ensure jest-dom matchers are available
import TaskItem from '../../src/components/TaskItem';

describe('<TaskItem /> Component', () => {
  const mockToggle = jest.fn();

  beforeEach(() => {
      mockToggle.mockClear();
  });

  test('returns null if no task prop is provided', () => {
    const { container } = render(<TaskItem onToggle={mockToggle}/>); // Pass required onToggle
    expect(container.firstChild).toBeNull();
  });

  test('renders task label and unchecked checkbox for incomplete task', () => {
    const task = { id: 't1', type: 'task', label: 'Test Task Incomplete', completed: false };
    render(<TaskItem task={task} onToggle={mockToggle} />);

    const checkbox = screen.getByRole('checkbox');
    const label = screen.getByText(task.label);

    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
    expect(label).toBeInTheDocument();
    expect(label).not.toHaveClass('line-through'); // Check styling for incomplete
  });

  test('renders task label and checked checkbox for completed task', () => {
    const task = { id: 't2', type: 'task', label: 'Test Task Complete', completed: true };
    render(<TaskItem task={task} onToggle={mockToggle} />);

    const checkbox = screen.getByRole('checkbox');
    const label = screen.getByText(task.label);

    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeChecked();
    expect(label).toBeInTheDocument();
    expect(label).toHaveClass('line-through'); // Check styling for completed
  });

  test('calls onToggle with correct value when checkbox is clicked (incomplete -> complete)', () => {
    const task = { id: 't1', type: 'task', label: 'Test Task Incomplete', completed: false };
    render(<TaskItem task={task} onToggle={mockToggle} />);
    const checkbox = screen.getByRole('checkbox');

    fireEvent.click(checkbox);
    expect(mockToggle).toHaveBeenCalledTimes(1);
    // When clicking an unchecked box, the event target's checked value becomes true
    expect(mockToggle).toHaveBeenCalledWith(true);
  });

   test('calls onToggle with correct value when checkbox is clicked (complete -> incomplete)', () => {
    const task = { id: 't2', type: 'task', label: 'Test Task Complete', completed: true };
    render(<TaskItem task={task} onToggle={mockToggle} />);
    const checkbox = screen.getByRole('checkbox');

    fireEvent.click(checkbox);
    expect(mockToggle).toHaveBeenCalledTimes(1);
    // When clicking a checked box, the event target's checked value becomes false
    expect(mockToggle).toHaveBeenCalledWith(false);
  });

   test('calls onToggle when label is clicked', () => {
    // Clicking the label should also toggle the checkbox due to the <label> wrapping
    const task = { id: 't1', type: 'task', label: 'Clickable Label', completed: false };
    render(<TaskItem task={task} onToggle={mockToggle} />);
    const label = screen.getByText(task.label);

    fireEvent.click(label);
    expect(mockToggle).toHaveBeenCalledTimes(1);
    expect(mockToggle).toHaveBeenCalledWith(true);
  });
});