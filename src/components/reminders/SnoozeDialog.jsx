import React, { useState, useRef, useEffect } from "react";
import Modal from "../dialogs/Modal";
import { useFocusTrap } from "../../hooks/useFocusTrap";

const SnoozeDialog = ({ isOpen, onClose, onSnooze, itemTitle }) => {
  const [snoozeValue, setSnoozeValue] = useState("15");
  const [snoozeUnit, setSnoozeUnit] = useState("minutes");
  const [showCustom, setShowCustom] = useState(false);
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, isOpen);

  // Reset state when the dialog opens
  useEffect(() => {
    if (isOpen) {
      setShowCustom(false);
      setSnoozeValue("15");
      setSnoozeUnit("minutes");
    }
  }, [isOpen]);

  // Handler for one-click quick snooze options
  const handleQuickSnooze = (value, unit) => {
    onSnooze(value, unit);
    onClose();
  };

  // Handler for the custom snooze confirmation button
  const handleCustomConfirm = () => {
    const value = parseInt(snoozeValue, 10);
    if (isNaN(value) || value <= 0) {
      const input = dialogRef.current?.querySelector("#snooze-value");
      if (input) {
        input.focus();
        input.select();
      }
      return;
    }
    onSnooze(value, snoozeUnit);
    onClose();
  };
  
  // Dynamically define the buttons in the footer
  const actions = [
    { label: "Cancel", onClick: onClose, variant: "secondary" },
  ];
  if (showCustom) {
    actions.push({
      label: "Set Snooze",
      onClick: handleCustomConfirm,
      variant: "primary",
      autoFocus: true,
      className: "ml-3",
    });
  }

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
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <strong>Item:</strong> {itemTitle}
          </p>
        )}

        {showCustom ? (
          // Custom Snooze View
          <div>
            <label htmlFor="snooze-value" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Snooze for
            </label>
            <div className="flex space-x-2">
              <input
                id="snooze-value"
                type="number"
                value={snoozeValue}
                onChange={(e) => setSnoozeValue(e.target.value)}
                min="1"
                placeholder="e.g., 15"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400"
              />
              <select
                aria-label="Snooze unit"
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
        ) : (
          // Quick Snooze View (Default)
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Snooze for...
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => handleQuickSnooze(5, "minutes")} className="px-3 py-2 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">5 minutes</button>
              <button onClick={() => handleQuickSnooze(10, "minutes")} className="px-3 py-2 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">10 minutes</button>
              <button onClick={() => handleQuickSnooze(30, "minutes")} className="px-3 py-2 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">30 minutes</button>
              <button onClick={() => handleQuickSnooze(1, "hours")} className="px-3 py-2 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">1 hour</button>
            </div>
            <button
              onClick={() => setShowCustom(true)}
              className="mt-3 w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Custom...
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default SnoozeDialog;