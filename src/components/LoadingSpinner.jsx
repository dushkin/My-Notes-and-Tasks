// src/components/LoadingSpinner.jsx
import React from "react";
import { Loader2 } from "lucide-react";

const LoadingSpinner = ({ 
  size = "default", 
  className = "", 
  text = "",
  variant = "default" // "default", "overlay", "button", "inline"
}) => {
  const sizeClasses = {
    small: "w-4 h-4",
    default: "w-6 h-6",
    large: "w-8 h-8",
    xl: "w-12 h-12"
  };

  const variantClasses = {
    default: "text-blue-600 dark:text-blue-400",
    overlay: "text-white",
    button: "text-current",
    inline: "text-zinc-500 dark:text-zinc-400"
  };

  const spinnerClasses = `${sizeClasses[size]} ${variantClasses[variant]} animate-spin ${className}`;

  if (variant === "overlay") {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
        <div className="bg-white dark:bg-zinc-800 p-6 rounded-lg shadow-xl flex flex-col items-center space-y-3">
          <Loader2 className={`w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin`} />
          {text && (
            <p className="text-zinc-700 dark:text-zinc-300 text-sm font-medium">
              {text}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (variant === "inline" && text) {
    return (
      <div className="flex items-center space-x-2">
        <Loader2 className={spinnerClasses} />
        <span className="text-sm text-zinc-600 dark:text-zinc-400">{text}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center">
      <Loader2 className={spinnerClasses} />
      {text && (
        <span className="ml-2 text-sm text-zinc-600 dark:text-zinc-400">
          {text}
        </span>
      )}
    </div>
  );
};

export default LoadingSpinner;