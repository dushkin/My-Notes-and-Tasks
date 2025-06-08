// src/components/ImportDialog.jsx
import React, { useState, useEffect } from "react";
import LoadingButton from "./LoadingButton";
import LoadingSpinner from "./LoadingSpinner";

const ImportDialog = ({ isOpen, context, onClose, onImport, selectedItem }) => {
  const [target, setTarget] = useState("entire");
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (context === "tree") {
        setTarget("entire");
      } else if (context === "item") {
        setTarget("selected");
      } else {
        setTarget(selectedItem ? "selected" : "entire");
      }
      setFile(null);
      setImporting(false);
      setImportMessage("");
    }
  }, [context, isOpen, selectedItem]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setImportMessage("");
    } else {
      setFile(null);
    }
  };

  const handleImportClick = async () => {
    if (file) {
      setImporting(true);
      setImportMessage("");
      const result = await onImport(file, target);
      setImporting(false);
      if (result && result.success) {
        setImportMessage(result.message || "Import successful!");
      } else {
        setImportMessage(result?.error || "Import failed. Please try again.");
      }
    } else {
      setImportMessage("Please select a file first.");
    }
  };

  const isFullTreeImportContext = context === "tree";
  const isImportUnderItemContext = context === "item";

  let dialogTitle = "Import Data";
  if (isFullTreeImportContext) {
    dialogTitle = "Import Tree (Overwrite Existing)";
  } else if (isImportUnderItemContext && selectedItem) {
    dialogTitle = `Import Under "${selectedItem.label}"`;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-800 p-6 rounded-lg shadow-xl w-full max-w-md sm:max-w-sm">
        <h2 className="text-lg sm:text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
          {dialogTitle}
        </h2>

        {!isFullTreeImportContext && (
          <div className="mb-4">
            <p className="mb-2 font-medium text-sm text-zinc-700 dark:text-zinc-300">
              Import Target
            </p>
            <div className="space-y-2">
              <label className="flex items-center cursor-pointer p-2 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
                <input
                  type="radio"
                  name="importTarget"
                  value="selected"
                  checked={target === "selected"}
                  onChange={() => {
                    setTarget("selected");
                    setImportMessage("");
                  }}
                  disabled={importing || !selectedItem}
                  className="form-radio h-4 w-4 text-blue-600 disabled:opacity-50 dark:focus:ring-blue-500 focus:ring-offset-0 dark:bg-zinc-700 dark:border-zinc-600"
                />
                <span
                  className={`ml-2 text-sm text-zinc-700 dark:text-zinc-200 ${
                    !selectedItem ? "opacity-50" : ""
                  }`}
                >
                  Under Selected Item{" "}
                  {selectedItem
                    ? `(${selectedItem.label})`
                    : "(No item selected)"}
                </span>
              </label>
              <label className="flex items-center cursor-pointer p-2 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
                <input
                  type="radio"
                  name="importTarget"
                  value="entire"
                  checked={target === "entire"}
                  onChange={() => {
                    setTarget("entire");
                    setImportMessage("");
                  }}
                  disabled={importing}
                  className="form-radio h-4 w-4 text-blue-600 dark:focus:ring-blue-500 focus:ring-offset-0 dark:bg-zinc-700 dark:border-zinc-600"
                />
                <span className="ml-2 text-sm text-zinc-700 dark:text-zinc-200">
                  Into empty tree or overwrite existing data
                </span>
              </label>
            </div>
          </div>
        )}
        {isFullTreeImportContext && (
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            This will replace your entire current tree with the contents of the
            JSON file.
          </p>
        )}

        <div className="mb-6">
          <label
            className="block mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300"
            htmlFor="import-file"
          >
            Select JSON File
          </label>
          <input
            type="file"
            id="import-file"
            accept=".json,application/json"
            onChange={handleFileChange}
            disabled={importing}
            className="block w-full text-sm text-zinc-500 dark:text-zinc-300
                       file:mr-4 file:py-2 file:px-4
                       file:rounded-md file:border-0
                       file:text-sm file:font-semibold
                       file:bg-blue-100 dark:file:bg-zinc-700
                       file:text-blue-700 dark:file:text-blue-300
                       hover:file:bg-blue-200 dark:hover:file:bg-zinc-600
                       focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-zinc-800
                       disabled:opacity-50"
          />
          {file && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Selected: {file.name}
            </p>
          )}
        </div>

        {importing && (
          <div className="mb-4">
            <LoadingSpinner 
              variant="inline" 
              text="Importing data..." 
              size="default"
            />
          </div>
        )}

        {importMessage && !importing && (
          <p
            className={`text-sm mb-4 p-2 rounded ${
              (importMessage.toLowerCase().includes("successful") ||
                importMessage.toLowerCase().includes("saved")) &&
              !importMessage.toLowerCase().includes("failed") &&
              !importMessage.toLowerCase().includes("error")
                ? "bg-green-100 dark:bg-green-900/60 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700"
                : "bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700"
            }`}
          >
            {importMessage}
          </p>
        )}

        <div className="mt-6 flex flex-col sm:flex-row-reverse gap-3">
          <LoadingButton
            onClick={handleImportClick}
            isLoading={importing}
            loadingText="Importing..."
            disabled={
              !file ||
              (target === "selected" &&
                !selectedItem &&
                !isFullTreeImportContext)
            }
            className="w-full sm:w-auto"
            variant="primary"
          >
            Import
          </LoadingButton>
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className="w-full sm:w-auto inline-flex justify-center rounded-md border border-zinc-300 dark:border-zinc-600 shadow-sm px-4 py-2 bg-white dark:bg-zinc-700 text-base font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-600 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-zinc-800 focus:ring-indigo-500 sm:text-sm disabled:opacity-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportDialog;