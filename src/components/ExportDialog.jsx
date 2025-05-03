// src/components/ExportDialog.jsx
import React, { useState, useEffect } from "react";

const ExportDialog = ({ isOpen, context, onClose, onExport }) => {
  // Initialize target based on context, default to 'selected' if no context
  const [target, setTarget] = useState(() => {
    if (context === 'tree') return 'entire';
    if (context === 'item') return 'selected';
    return 'selected'; // Default if no context or unknown context
  });

  // Update target if context changes while dialog is open (though unlikely)
  useEffect(() => {
     if (isOpen) {
        if (context === 'tree') setTarget('entire');
        else if (context === 'item') setTarget('selected');
        // If context is null, don't force change, keep user's last selection or default
     }
  }, [context, isOpen]);


  if (!isOpen) return null;

  const handleExportClick = (format) => {
    onExport(target, format); // Pass the currently selected target state
    onClose();
  };

  // Determine if radio buttons should be shown
  const showRadioButtons = context !== 'item' && context !== 'tree';
  const dialogTitle = context === 'tree' ? "Export Full Tree"
                      : context === 'item' ? "Export Selected Item"
                      : "Export Options"; // Generic title if context is not specific


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-zinc-800 p-6 rounded shadow-lg w-80">
        <h2 className="text-xl font-bold mb-4">{dialogTitle}</h2>

        {/* Conditionally render Radio Buttons */}
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
               />
               <span className="ml-2">Entire Tree</span>
             </label>
           </div>
        )}

        {/* Format Selection */}
        <div className="mb-4">
          <p className="mb-2 font-medium">Format</p>
          <div className="flex justify-around">
            <button
              onClick={() => handleExportClick("json")}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              JSON
            </button>
            <button
              onClick={() => handleExportClick("pdf")}
              className="px-4 py-2 bg-green-600 text-white rounded"
            >
              PDF
            </button>
          </div>
        </div>

        {/* Cancel Button */}
        <button
          onClick={onClose}
          className="w-full px-4 py-2 border rounded mt-2"
         >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ExportDialog;