import React from "react";

const AddDialog = ({
  isOpen,
  newItemType,
  newItemLabel,
  showError,
  onLabelChange,
  onAdd,
  onCancel,
}) => {
  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-zinc-800 p-6 rounded shadow-lg w-96">
        <h2 className="text-lg font-bold mb-4">Add {newItemType}</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={newItemLabel}
            onChange={onLabelChange}
            className="border p-2 rounded w-full mb-2 text-gray-900 dark:text-gray"
            placeholder={`Enter ${newItemType} name`}
            autoFocus
          />
          {showError && (
            <p className="text-red-600 text-sm mb-2">Name cannot be empty.</p>
          )}
          <div className="mt-4 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded"
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