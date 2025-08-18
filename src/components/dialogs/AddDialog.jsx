import React, { useEffect, useState, useRef } from "react";
import LoadingButton from "../ui/LoadingButton";
import ReminderSetter from "../reminders/ReminderSetter";
import { useFocusTrap } from "../../hooks/useFocusTrap";

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
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  useFocusTrap(dialogRef, isOpen);

  // Handle viewport height changes for keyboard
  useEffect(() => {
    const updateViewportHeight = () => {
      setViewportHeight(window.innerHeight);
    };

    window.addEventListener('resize', updateViewportHeight);
    // Also listen to visual viewport changes (better for mobile keyboards)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewportHeight);
    }

    return () => {
      window.removeEventListener('resize', updateViewportHeight);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateViewportHeight);
      }
    };
  }, []);

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

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current.focus();
      }, 100);
    }
  }, [isOpen]);

  // Scroll reminder section into view when keyboard might appear
  useEffect(() => {
    if (!isOpen || newItemType !== 'task') return;

    const handleFocusIn = (e) => {
      // If focusing on an element inside the reminder section
      const reminderSection = document.querySelector('.reminder-section');
      if (reminderSection && reminderSection.contains(e.target)) {
        setTimeout(() => {
          reminderSection.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }, 300); // Wait for keyboard animation
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
  }, [isOpen, newItemType]);

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
    <div className="add-dialog-container fixed inset-0 bg-black bg-opacity-50 flex justify-center items-start sm:items-center z-50 p-4 overflow-y-auto">
      <div
        ref={dialogRef}
        className="add-dialog-content bg-white dark:bg-zinc-800 p-6 rounded shadow-lg w-full max-w-md overflow-y-auto mt-4 sm:mt-0"
        style={{
          maxHeight: `${Math.min(viewportHeight * 0.9, viewportHeight - 100)}px`
        }}
      >
        <div className="flex flex-col h-full">
          <h2 className="text-xl font-bold mb-4 flex-shrink-0">Add {newItemType}</h2>
          
          <div className="flex-1 overflow-y-auto min-h-0">
            <form onSubmit={handleSubmit} className="flex flex-col h-full">
              <div className="flex-1 space-y-4">
                <div>
                  <input
                    ref={inputRef}
                    type="text"
                    value={newItemLabel ?? ""}
                    onChange={(e) => setNewItemLabel(e.target.value)}
                    className={`border p-2 rounded w-full text-gray-900 dark:text-gray-100 bg-white dark:bg-zinc-700 ${
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
                    <p id="add-error-message" className="text-red-600 text-sm mt-1">
                      {errorMessage}
                    </p>
                  )}
                </div>
                
                {newItemType === 'task' && (
                  <div className="reminder-section">
                    <ReminderSetter onSetReminder={handleReminderChange} />
                  </div>
                )}
              </div>

              <div className="dialog-buttons mt-6 flex justify-end space-x-2 flex-shrink-0 pt-4 border-t border-zinc-200 dark:border-zinc-600">
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
      </div>
    </div>
  );
};

export default AddDialog;