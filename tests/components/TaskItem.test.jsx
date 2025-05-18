// tests/components/TaskItem.test.jsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import TaskItem from "../../src/components/TaskItem";

describe("<TaskItem /> Component", () => {
  const mockToggle = jest.fn();

  beforeEach(() => {
    mockToggle.mockClear();
  });

  test("returns null if no task prop is provided", () => {
    const { container } = render(<TaskItem onToggle={mockToggle} />);
    expect(container.firstChild).toBeNull();
  });

  test("renders task label and unchecked checkbox for incomplete task", () => {
    const task = {
      id: "t1",
      type: "task",
      label: "Test Task Incomplete",
      completed: false,
    };
    render(<TaskItem task={task} onToggle={mockToggle} />);
    const checkbox = screen.getByRole("checkbox");
    const label = screen.getByText(task.label);
    expect(checkbox).not.toBeChecked();
    expect(label).not.toHaveClass("line-through");
  });

  test("renders task label and checked checkbox for completed task", () => {
    const task = {
      id: "t2",
      type: "task",
      label: "Test Task Complete",
      completed: true,
    };
    render(<TaskItem task={task} onToggle={mockToggle} />);
    const checkbox = screen.getByRole("checkbox");
    const label = screen.getByText(task.label);
    expect(checkbox).toBeChecked();
    expect(label).toHaveClass("line-through");
  });

  test("calls onToggle with true when incomplete task checkbox is clicked", () => {
    const task = {
      id: "t1",
      type: "task",
      label: "Test Task",
      completed: false,
    };
    render(<TaskItem task={task} onToggle={mockToggle} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(mockToggle).toHaveBeenCalledWith(true);
  });

  test("calls onToggle with false when completed task checkbox is clicked", () => {
    const task = {
      id: "t2",
      type: "task",
      label: "Test Task",
      completed: true,
    };
    render(<TaskItem task={task} onToggle={mockToggle} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(mockToggle).toHaveBeenCalledWith(false);
  });

  test("calls onToggle when label is clicked", () => {
    const task = {
      id: "t1",
      type: "task",
      label: "Clickable Label",
      completed: false,
    };
    render(<TaskItem task={task} onToggle={mockToggle} />);
    fireEvent.click(screen.getByText(task.label));
    expect(mockToggle).toHaveBeenCalledWith(true);
  });
});
