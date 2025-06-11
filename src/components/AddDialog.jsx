import React, { useEffect, useState } from "react";
import LoadingButton from "./LoadingButton";

const AddDialog = ({
  isOpen,
  newItemType,
  newItemLabel,
  onLabelChange,
  onAdd,
  onCancel,
  errorMessage,
}) => {
  // --- All hooks must be called at the top level, unconditionally. ---
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = React.useRef(null);

  useEffect(() => {
    // It's okay to have conditional logic *inside* a hook.
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);
  // --- End of hooks section ---

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onAdd();
    } finally {
      setIsLoading(false);
    }
  };

  // This conditional return is now placed *after* all hook calls, which is correct.
  if (!isOpen) {
    return null;
  }

  // The JSX is returned only when isOpen is true.
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-zinc-800 p-6 rounded shadow-lg w-96">
        <h2 className="text-lg font-bold mb-4">Add {newItemType}</h2>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={newItemLabel ?? ""}
            onChange={onLabelChange}
            className={`border p-2 rounded w-full mb-2 text-gray-900 dark:text-gray ${
              errorMessage
                ? "border-red-500"
                : "border-gray-300 dark:border-gray-600"
            }`}
            placeholder={`Enter ${newItemType} name`}
            aria-invalid={!!errorMessage}
            aria-describedby={errorMessage ? "add-error-message" : undefined}
            disabled={isLoading}
            maxLength={255}
          />
          {errorMessage && (
            <p id="add-error-message" className="text-red-600 text-sm mb-2">
              {errorMessage}
            </p>
          )}
          <div className="mt-4 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border rounded dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              disabled={isLoading}
            >
              Cancel
            </button>
            <LoadingButton
              type="submit"
              isLoading={isLoading}
              loadingText="Adding..."
              variant="primary"
            >
              Add
            </LoadingButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddDialog;
