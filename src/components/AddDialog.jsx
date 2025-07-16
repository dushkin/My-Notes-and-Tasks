import React, { useEffect, useState, useRef } from "react";
import LoadingButton from "./LoadingButton";
import ReminderSetter from "./reminders/ReminderSetter";
import { useFocusTrap } from "../hooks/useFocusTrap";

const AddDialog = ({
  isOpen,
  newItemType,
  newItemLabel,
  setNewItemLabel,
  onAdd,
  onAddWithReminder,
  onClose,
  errorMessage,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);
  const dialogRef = useRef(null);
  const [reminderTime, setReminderTime] = useState(null);
  const [repeatOptions, setRepeatOptions] = useState(null);
  useFocusTrap(dialogRef, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (reminderTime) {
        await onAddWithReminder(reminderTime, repeatOptions);
      } else {
        await onAdd();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReminderChange = (time, repeat) => {
    setReminderTime(time);
    setRepeatOptions(repeat);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div
        ref={dialogRef}
        className="bg-white dark:bg-zinc-800 p-6 rounded shadow-lg w-96"
      >
        <h2 className="text-xl font-bold mb-4">Add {newItemType}</h2>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={newItemLabel ?? ""}
            onChange={(e) => setNewItemLabel(e.target.value)}
            className={`border p-2 rounded w-full mb-2 text-gray-900 dark:text-gray-100 bg-white dark:bg-zinc-700 ${
              errorMessage
                ? "border-red-500"
                : "border-gray-300 dark:border-gray-600"
            }`}
            placeholder={`Enter ${newItemType} name`}
            aria-invalid={!!errorMessage}
            aria-describedby={errorMessage ? "add-error-message" : undefined}
            disabled={isLoading}
            maxLength={512}
          />
          {errorMessage && (
            <p id="add-error-message" className="text-red-600 text-sm mb-2">
              {errorMessage}
            </p>
          )}
          
          {newItemType === 'task' && (
            <ReminderSetter onSetReminder={handleReminderChange} />
          )}

          <div className="mt-4 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              disabled={isLoading}
            >
              Cancel
            </button>
            <LoadingButton
              type="submit"
              isLoading={isLoading}
              loadingText="Adding..."
              variant="primary"
            >
              Add
            </LoadingButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddDialog;