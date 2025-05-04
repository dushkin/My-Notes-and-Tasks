// src/components/AddDialog.jsx
import React, { useEffect } from "react"; // Import useEffect

const AddDialog = ({
  isOpen,
  newItemType,
  newItemLabel,
  // showError, // Replaced by errorMessage
  onLabelChange,
  onAdd,
  onCancel,
  errorMessage, // New prop for specific error messages
}) => {
  if (!isOpen) return null;

  const inputRef = React.useRef(null); // Ref for the input element

  // Focus the input when the dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      // Select text if it's not empty (useful if reopening after error)
      // if (newItemLabel) {
      //   inputRef.current.select();
      // }
    }
  }, [isOpen]); // Dependency array includes isOpen


  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd(); // onAdd should now handle validation feedback
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-zinc-800 p-6 rounded shadow-lg w-96">
        <h2 className="text-lg font-bold mb-4">Add {newItemType}</h2>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef} // Assign ref to the input
            type="text"
            value={newItemLabel}
            onChange={onLabelChange}
            className={`border p-2 rounded w-full mb-2 text-gray-900 dark:text-gray ${errorMessage ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`} // Highlight if error
            placeholder={`Enter ${newItemType} name`}
            // autoFocus // Replaced by useEffect focus management
            aria-invalid={!!errorMessage} // Accessibility
            aria-describedby={errorMessage ? "add-error-message" : undefined}
          />
          {/* Display specific error message */}
          {errorMessage && (
            <p id="add-error-message" className="text-red-600 text-sm mb-2">{errorMessage}</p>
          )}
          <div className="mt-4 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border rounded dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              // Optionally disable add button if label is empty, though validation handles it
              // disabled={!newItemLabel.trim()}
            >
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddDialog;