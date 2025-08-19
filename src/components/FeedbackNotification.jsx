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
      className={`fixed top-4 right-4 z-50 w-auto max-w-sm transition-all duration-300 transform ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      } ${getTypeStyles(type)}`}
    >
      <div className="flex justify-between items-center">
        <div className="flex-1 pr-4">
          <p className="text-sm font-medium">{message}</p>
        </div>
        <button 
          className="flex-shrink-0 ml-2 p-1 rounded-full hover:bg-opacity-20 hover:bg-current transition-colors" 
          aria-label="Close message"
          onClick={onClose}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg" 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="lucide lucide-circle-x w-4 h-4" 
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <path d="m15 9-6 6"></path>
            <path d="m9 9 6 6"></path>
          </svg>
        </button>
      </div>
    </div>
  );
};

// Helper function for different notification types
const getTypeStyles = (type) => {
  const baseStyles = "px-4 py-3 border shadow-lg rounded-md";
  
  switch (type) {
    case 'success':
      return `${baseStyles} bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-400 dark:border-green-600`;
    case 'error':
      return `${baseStyles} bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-400 dark:border-red-600`;
    case 'warning':
      return `${baseStyles} bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-yellow-400 dark:border-yellow-600`;
    case 'info':
    default:
      return `${baseStyles} bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-400 dark:border-blue-600`;
  }
};

export default FeedbackNotification;