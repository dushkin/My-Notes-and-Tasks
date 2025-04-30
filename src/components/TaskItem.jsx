import React from "react";

const TaskItem = ({ task, onToggle }) => {
  if (!task) return null;
  return (
    <div className="p-4">
      <label className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={e => onToggle(e.target.checked)}
          className="form-checkbox"
        />
        <span className={task.completed ? "line-through text-gray-500" : ""}>
          {task.label}
        </span>
      </label>
    </div>
  );
};

export default TaskItem;