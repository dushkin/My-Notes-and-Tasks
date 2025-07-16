import React, { useState, useRef, useEffect } from "react";
import Modal from "../Modal";
import { useFocusTrap } from "../../hooks/useFocusTrap";

const SnoozeDialog = ({ isOpen, onClose, onSnooze, itemTitle }) => {
  const [snoozeValue, setSnoozeValue] = useState("10");
  const [snoozeUnit, setSnoozeUnit] = useState("minutes");
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, isOpen);

  // Reset values when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSnoozeValue("10");
      setSnoozeUnit("minutes");
    }
  }, [isOpen]);

  const handleConfirm = () => {
    const value = parseInt(snoozeValue, 10);
    if (isNaN(value) || value <= 0) {
      alert("Please enter a valid positive number");
      return;
    }
    onSnooze(value, snoozeUnit);
    onClose();
  };

  const handleQuickSnooze = (value, unit) => {
    onSnooze(value, unit);
    onClose();
  };

  const actions = [
    { label: "Cancel", onClick: onClose, variant: "secondary" },
    { label: "Snooze", onClick: handleConfirm, variant: "primary", autoFocus: true },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`⏰ Snooze Reminder`}
      actions={actions}
      dialogRef={dialogRef}
    >
      <div className="space-y-4">
        {itemTitle && (
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            <strong>Item:</strong> {itemTitle}
          </div>
        )}

        {/* Quick Snooze Options */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Quick Snooze
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleQuickSnooze(5, "minutes")}
              className="px-3 py-2 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            >
              5 minutes
            </button>
            <button
              onClick={() => handleQuickSnooze(10, "minutes")}
              className="px-3 py-2 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            >
              10 minutes
            </button>
            <button
              onClick={() => handleQuickSnooze(30, "minutes")}
              className="px-3 py-2 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            >
              30 minutes
            </button>
            <button
              onClick={() => handleQuickSnooze(1, "hours")}
              className="px-3 py-2 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            >
              1 hour
            </button>
          </div>
        </div>

        {/* Custom Snooze */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Custom Snooze
          </h4>
          <div className="flex space-x-2">
            <input
              type="number"
              value={snoozeValue}
              onChange={(e) => setSnoozeValue(e.target.value)}
              min="1"
              placeholder="e.g., 15"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400"
            />
            <select
              value={snoozeUnit}
              onChange={(e) => setSnoozeUnit(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400"
            >
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </div>
        </div>

        {/* Preview */}
        <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded">
          <strong>Preview:</strong> Reminder will be snoozed for {snoozeValue} {snoozeUnit}
          {snoozeValue && !isNaN(parseInt(snoozeValue)) && (
            <span className="block mt-1">
              Next reminder: {new Date(Date.now() + getMilliseconds(parseInt(snoozeValue), snoozeUnit)).toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </Modal>
  );
};

// Helper function to calculate milliseconds
const getMilliseconds = (value, unit) => {
  switch (unit) {
    case 'seconds':
      return value * 1000;
    case 'minutes':
      return value * 60 * 1000;
    case 'hours':
      return value * 60 * 60 * 1000;
    case 'days':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 0;
  }
};

export default SnoozeDialog;
