import React, { useEffect } from "react";
import { XCircle } from "lucide-react";
import LoadingButton from "./LoadingButton.jsx";

const ErrorDisplay = ({ message, type = "error", onClose, currentUser }) => {
  useEffect(() => {
    if (
      currentUser?.token &&
      typeof window.subscribeAfterLogin === "function"
    ) {
      window.subscribeAfterLogin();
    }
  }, [currentUser]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => onClose(), 8000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);
  
  if (!message) {
    return null;
  }

  const baseClasses =
    "fixed right-3 left-3 md:left-auto md:max-w-lg z-[100] px-4 py-3 rounded-lg shadow-xl flex justify-between items-center text-sm transition-all duration-300 ease-in-out";
  const typeClasses =
    type === "success"
      ? "bg-green-100 dark:bg-green-800/80 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-200"
      : type === "info"
      ? "bg-sky-100 dark:bg-sky-800/80 border border-sky-400 dark:border-sky-600 text-sky-700 dark:text-sky-200"
      : "bg-red-100 dark:bg-red-800/80 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200";
  const iconColor =
    type === "success"
      ? "text-green-500 hover:text-green-700 dark:text-green-300 dark:hover:text-green-100"
      : type === "info"
      ? "text-sky-500 hover:text-sky-700 dark:text-sky-300 dark:hover:text-sky-100"
      : "text-red-500 hover:text-red-700 dark:text-red-300 dark:hover:text-red-100";
  
  return (
    <div
      data-item-id="error-display-message"
      className={`${baseClasses} ${typeClasses}`}
      style={{ top: "calc(var(--beta-banner-height, 0px) + 0.75rem)" }}
      role="alert"
    >
      <span>{message}</span>
      <LoadingButton
        onClick={onClose}
        className={`ml-3 -mr-1 -my-1 p-1 ${iconColor} rounded-full focus:outline-none focus:ring-2 focus:ring-current`}
        aria-label="Close message"
        variant="secondary"
        size="small"
      >
        <XCircle className="w-5 h-5" />
      </LoadingButton>
    </div>
  );
};

export default ErrorDisplay;