// src/components/AboutDialog.jsx
import React from "react";

const AboutDialog = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const appName = "Notes & Tasks App"; // You can change this
  const appVersion = "1.3";
  const currentYear = new Date().getFullYear(); // Get the current year

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-zinc-800 p-6 rounded shadow-lg w-96 text-center">
        <h2 className="text-xl font-bold mb-4">About {appName}</h2>
        <div className="space-y-2 mb-6 text-zinc-800 dark:text-zinc-200">
          {/* 1. App Name with Copyright */}
          <p>{appName} &copy; {currentYear}</p>
          {/* 2. App Version */}
          <p>Version: {appVersion}</p>
        </div>
        <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            autoFocus // Focus the close button when dialog opens
        >
            Close
        </button>
      </div>
    </div>
  );
};

export default AboutDialog;