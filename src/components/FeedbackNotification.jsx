import React, { useState, useEffect } from "react";

const FeedbackNotification = ({ message, type = "info", duration = 3000, onClose, style = {} }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onClose && onClose();
      }, 300); // Wait for fade out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800';
      case 'error':
        return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800';
      case 'info':
      default:
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  return (
    <div
      className={`fixed right-4 z-[9999] max-w-sm w-full transition-all duration-300 transform ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
      style={{ top: '1rem', ...style }}
    >
      <div
        className={`p-4 rounded-lg border shadow-lg ${getTypeStyles()}`}
      >
        <div className="flex items-start">
          <div className="flex-shrink-0 mr-3 text-lg">
            {getIcon()}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{message}</p>
          </div>
          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(() => {
                onClose && onClose();
              }, 300);
            }}
            className="flex-shrink-0 ml-3 text-lg opacity-70 hover:opacity-100 transition-opacity"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackNotification;
