// src/components/ImportDialog.jsx
import React, { useState } from "react";

const ImportDialog = ({ isOpen, onClose, onImport }) => {
  const [target, setTarget] = useState("selected"); // "selected" or "entire"
  const [file, setFile] = useState(null);
  
  if (!isOpen) return null;
  
  const handleFileChange = (e) => {
    if(e.target.files && e.target.files[0]){
      setFile(e.target.files[0]);
    }
  };
  
  const handleImport = () => {
    if(file) {
      onImport(file, target);
      onClose();
    } else {
      alert("Please select a file first.");
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-zinc-800 p-6 rounded shadow-lg w-80">
        <h2 className="text-xl font-bold mb-4">Import Options</h2>
        <div className="mb-4">
          <p className="mb-2 font-medium">Import Target</p>
          <label className="inline-flex items-center mr-4">
            <input
              type="radio"
              name="importTarget"
              value="selected"
              checked={target === "selected"}
              onChange={() => setTarget("selected")}
            />
            <span className="ml-2">Under Selected Item</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              name="importTarget"
              value="entire"
              checked={target === "entire"}
              onChange={() => setTarget("entire")}
            />
            <span className="ml-2">Top Level (Replace Tree)</span>
          </label>
        </div>
        <div className="mb-4">
          <input type="file" accept=".json" onChange={handleFileChange} />
        </div>
        <div className="flex justify-around">
          <button 
            onClick={handleImport}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Import
          </button>
          <button 
            onClick={onClose}
            className="px-4 py-2 border rounded"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportDialog;
