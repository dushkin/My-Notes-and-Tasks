import React, { useState, useEffect, useRef } from "react";
import packageJson from "../../package.json";
import logo from "../assets/logo_dual_32x32.png";
import { useFocusTrap } from "../hooks/useFocusTrap";

const AboutDialog = ({ isOpen, onClose }) => {
  const appName = "Notes & Tasks App";
  const appVersion = packageJson.version;
  const appLicense = packageJson.license;
  const currentYear = new Date().getFullYear();
  
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, isOpen);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div ref={dialogRef} className="bg-white dark:bg-zinc-800 p-6 rounded shadow-lg w-96 text-center">
        <img src={logo} alt="Application Logo" className="mx-auto mb-4 h-12 w-12" />
        <h2 className="text-xl font-bold mb-4">About {appName}</h2>
        <div className="space-y-2 mb-6 text-zinc-800 dark:text-zinc-200">
          <p>
            {appName} &copy; {currentYear}
          </p>
          <p>&copy; TT</p>
          <p>Version: {appVersion}</p>
          <p>{license}</p>
        </div>
        <button
          onClick={onClose}
          className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          autoFocus
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default AboutDialog;