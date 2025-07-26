import React, { useState, useRef, useEffect } from "react";
import { X } from 'lucide-react';

const SnoozeDialog = ({ isOpen, onClose, onSnooze, itemTitle }) => {
  const [snoozeValue, setSnoozeValue] = useState("15");
  const [snoozeUnit, setSnoozeUnit] = useState("minutes");
  const [showCustom, setShowCustom] = useState(false);
  const dialogRef = useRef(null);
  const customInputRef = useRef(null);

  // Effect to handle the Escape key to close the modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Reset state when the dialog opens
  useEffect(() => {
    if (isOpen) {
      setShowCustom(false);
      setSnoozeValue("15");
      setSnoozeUnit("minutes");
    }
  }, [isOpen]);

  // Auto-focus custom input when switching to custom mode
  useEffect(() => {
    if (showCustom && customInputRef.current) {
      setTimeout(() => {
        customInputRef.current.focus();
        customInputRef.current.select();
      }, 100);
    }
  }, [showCustom]);

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
        input.focus(); input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input.select();
      }
      return;
    }
    onSnooze(value, snoozeUnit);
    onClose();
  };
  if (!isOpen) return null;

  // Dynamically define the buttons in the footer with consistent styling
  const actions = [
    { 
      label: "Cancel", 
      onClick: onClose, 
      variant: "secondary",
      className: "flex-1" // Use flex-1 for equal width
    },
  ];
  if (showCustom) {
    actions.push({
      label: "Set Snooze",
      onClick: handleCustomConfirm,
      variant: "primary",
      autoFocus: true,
      className: "flex-1", // Use flex-1 for equal width
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 backdrop-blur-sm"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={dialogRef}
        className="bg-white dark:bg-zinc-800 p-6 rounded-lg shadow-xl w-full max-w-md border border-zinc-200 dark:border-zinc-700"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-zinc-200 dark:border-zinc-600">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            ⏰ Snooze Reminder
          </h3>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 rounded-full text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="text-zinc-700 dark:text-zinc-300">
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
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                  <input
                    ref={customInputRef}
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
        </div>

        {/* Modal Footer with Action Buttons */}
        {actions && actions.length > 0 && (
          <div className="mt-6 pt-4 border-t dark:border-zinc-600 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            {actions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                autoFocus={action.autoFocus}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${action.className || ''} ${
                  action.variant === 'primary' 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-2 focus:ring-blue-500 focus:ring-offset-2' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-100 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SnoozeDialog;