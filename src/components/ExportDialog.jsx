// src/components/ExportDialog.jsx
import React, { useState, useEffect } from "react";

// Added defaultFormat prop
const ExportDialog = ({ isOpen, context, onClose, onExport, defaultFormat = 'json' }) => {
  // Initialize target based on context, default to 'selected' if no context
  const [target, setTarget] = useState(() => {
    if (context === 'tree') return 'entire';
    if (context === 'item') return 'selected';
    return 'selected';
  });

  // NEW: State for selected format, initialized by prop
  const [format, setFormat] = useState(defaultFormat);

  // Update target if context changes
  useEffect(() => {
     if (isOpen) {
        if (context === 'tree') setTarget('entire');
        else if (context === 'item') setTarget('selected');
        setFormat(defaultFormat); // Reset format on open based on default
     }
  }, [context, isOpen, defaultFormat]); // Add defaultFormat dependency

  if (!isOpen) return null;

  const handleExportClick = () => {
    onExport(target, format); // Pass the currently selected format state
    onClose();
  };

  const showRadioButtons = context !== 'item' && context !== 'tree';
  const dialogTitle = context === 'tree' ? "Export Full Tree"
                      : context === 'item' ? "Export Selected Item"
                      : "Export Options";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-zinc-800 p-6 rounded shadow-lg w-80">
        <h2 className="text-xl font-bold mb-4">{dialogTitle}</h2>

        {/* Conditionally render Target Radio Buttons */}
        {showRadioButtons && (
           <div className="mb-4">
             <p className="mb-2 font-medium">Export Target</p>
             <label className="inline-flex items-center mr-4"> <input type="radio" name="exportTarget" value="selected" checked={target === "selected"} onChange={() => setTarget("selected")} /> <span className="ml-2">Selected Item</span> </label>
             <label className="inline-flex items-center"> <input type="radio" name="exportTarget" value="entire" checked={target === "entire"} onChange={() => setTarget("entire")} /> <span className="ml-2">Entire Tree</span> </label>
           </div>
        )}

        {/* Format Selection */}
        <div className="mb-4">
          <p className="mb-2 font-medium">Format</p>
          {/* UPDATED: Use radio buttons for format selection */}
           <div className="flex space-x-4">
               <label className="flex items-center space-x-1 cursor-pointer">
                   <input
                       type="radio"
                       name="exportFormat"
                       value="json"
                       checked={format === 'json'}
                       onChange={(e) => setFormat(e.target.value)}
                       className="form-radio text-blue-600"
                   />
                   <span>JSON</span>
               </label>
               <label className="flex items-center space-x-1 cursor-pointer">
                   <input
                       type="radio"
                       name="exportFormat"
                       value="pdf"
                       checked={format === 'pdf'}
                       onChange={(e) => setFormat(e.target.value)}
                       className="form-radio text-green-600"
                   />
                   <span>PDF</span>
               </label>
           </div>
        </div>

        {/* Export Button */}
        <button
          onClick={handleExportClick} // Call unified handler
          className={`w-full px-4 py-2 text-white rounded mt-4 ${format === 'json' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
        >
          Export as {format.toUpperCase()}
        </button>

        {/* Cancel Button */}
        <button
           onClick={onClose}
           className="w-full px-4 py-2 border dark:border-zinc-600 rounded mt-2 hover:bg-zinc-100 dark:hover:bg-zinc-700"
         >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ExportDialog;