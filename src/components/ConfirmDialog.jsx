// src/components/ConfirmDialog.jsx
import React from "react";
import { AlertTriangle, Trash2, RotateCcw, AlertCircle } from "lucide-react";

const ConfirmDialog = ({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  variant = "default", // "default", "danger", "warning"
}) => {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case "danger":
        return {
          icon: <Trash2 className="w-6 h-6 text-red-500" />,
          confirmButton: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
          headerColor: "text-red-700 dark:text-red-400",
        };
      case "warning":
        return {
          icon: <AlertTriangle className="w-6 h-6 text-yellow-500" />,
          confirmButton: "bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500",
          headerColor: "text-yellow-700 dark:text-yellow-400",
        };
      default:
        return {
          icon: <AlertCircle className="w-6 h-6 text-blue-500" />,
          confirmButton: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
          headerColor: "text-blue-700 dark:text-blue-400",
        };
    }
  };

  const variantStyles = getVariantStyles();

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      onCancel();
    } else if (e.key === "Enter") {
      onConfirm();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4 backdrop-blur-sm">
      <div
        className="bg-white dark:bg-zinc-800 p-6 rounded-lg shadow-xl w-full max-w-md border border-zinc-200 dark:border-zinc-700"
        onKeyDown={handleKeyDown}
        tabIndex={-1}
        autoFocus
      >
        <div className="flex items-start space-x-4 mb-4">
          <div className="flex-shrink-0 mt-0.5">
            {variantStyles.icon}
          </div>
          <div className="flex-1">
            <h3 className={`text-lg font-semibold mb-2 ${variantStyles.headerColor}`}>
              {title}
            </h3>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {message}
            </p>
          </div>
        </div>
        
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-500 dark:focus:ring-offset-zinc-800 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`w-full sm:w-auto px-4 py-2 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-zinc-800 transition-colors ${variantStyles.confirmButton}`}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;