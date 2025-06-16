import React, { useState, useEffect, useRef } from "react";
import LoadingButton from "./LoadingButton";
import { useFocusTrap } from "../hooks/useFocusTrap";

const ExportDialog = ({
  isOpen,
  context,
  onClose,
  onExport,
  defaultFormat = "json",
}) => {
  const [target, setTarget] = useState(() => {
    if (context === "tree") return "entire";
    if (context === "item") return "selected";
    return "selected";
  });
  const [format, setFormat] = useState(defaultFormat);
  const [isExporting, setIsExporting] = useState(false);
  
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, isOpen);

  useEffect(() => {
    if (isOpen) {
      if (context === "tree") setTarget("entire");
      else if (context === "item") setTarget("selected");
      setFormat(defaultFormat);
      setIsExporting(false);
    }
  }, [context, isOpen, defaultFormat]);

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

  const handleExportClick = async () => {
    setIsExporting(true);
    try {
      await onExport(target, format);
    } finally {
      setIsExporting(false);
    }
    onClose();
  };

  const showRadioButtons = context !== "item" && context !== "tree";
  const dialogTitle =
    context === "tree"
      ? "Export Full Tree"
      : context === "item"
      ? "Export Selected Item"
      : "Export Options";
      
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div ref={dialogRef} className="bg-white dark:bg-zinc-800 p-6 rounded shadow-lg w-80">
        <h2 className="text-xl font-bold mb-4">{dialogTitle}</h2>

        {showRadioButtons && (
          <div className="mb-4">
            <p className="mb-2 font-medium">Export Target</p>
            <label className="inline-flex items-center mr-4">
              <input
                type="radio"
                name="exportTarget"
                value="selected"
                checked={target === "selected"}
                onChange={() => setTarget("selected")}
                disabled={isExporting}
              />
              <span className="ml-2">Selected Item</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="exportTarget"
                value="entire"
                checked={target === "entire"}
                onChange={() => setTarget("entire")}
                disabled={isExporting}
              />
              <span className="ml-2">Entire Tree</span>
            </label>
          </div>
        )}

        <div className="mb-4">
          <p className="mb-2 font-medium">Format</p>
          <div className="flex space-x-4">
            <label className="flex items-center space-x-1 cursor-pointer">
              <input
                type="radio"
                name="exportFormat"
                value="json"
                checked={format === "json"}
                onChange={(e) => setFormat(e.target.value)}
                className="form-radio text-blue-600"
                disabled={isExporting}
              />
              <span>JSON</span>
            </label>
            <label className="flex items-center space-x-1 cursor-pointer">
              <input
                type="radio"
                name="exportFormat"
                value="pdf"
                checked={format === "pdf"}
                onChange={(e) => setFormat(e.target.value)}
                className="form-radio text-green-600"
                disabled={isExporting}
              />
              <span>PDF</span>
            </label>
          </div>
        </div>

        <LoadingButton
          onClick={handleExportClick}
          isLoading={isExporting}
          loadingText="Exporting..."
          className="w-full mb-2"
          variant={format === "json" ? "primary" : "success"}
        >
          Export as {format.toUpperCase()}
        </LoadingButton>

        <button
          onClick={onClose}
          className="w-full px-4 py-2 border dark:border-zinc-600 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
          disabled={isExporting}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ExportDialog;