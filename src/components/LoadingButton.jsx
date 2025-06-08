// src/components/LoadingButton.jsx
import React from "react";
import { Loader2 } from "lucide-react";

const LoadingButton = ({
  isLoading = false,
  children,
  loadingText = "Loading...",
  disabled = false,
  onClick,
  className = "",
  variant = "primary", // "primary", "secondary", "danger", "success"
  type = "button",
  size = "default", // "small", "default", "large"
  ...props
}) => {
  const baseClasses = "inline-flex items-center justify-center font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-zinc-800 transition-all duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed";
  
  const sizeClasses = {
    small: "px-2.5 py-1.5 text-xs",
    default: "px-4 py-2 text-sm",
    large: "px-6 py-3 text-base"
  };

  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
    secondary: "border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-600 focus:ring-zinc-500",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    success: "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500"
  };

  const spinnerSize = {
    small: "w-3 h-3",
    default: "w-4 h-4",
    large: "w-5 h-5"
  };

  const finalClassName = `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`;
  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      className={finalClassName}
      onClick={onClick}
      disabled={isDisabled}
      {...props}
    >
      {isLoading && (
        <Loader2 className={`${spinnerSize[size]} animate-spin mr-2`} />
      )}
      {isLoading ? loadingText : children}
    </button>
  );
};

export default LoadingButton;