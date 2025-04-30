import React, { useRef, useEffect } from "react";

const ContextMenu = ({
  visible,
  x,
  y,
  item,
  isEmptyArea,
  onAddRootFolder,
  onAddFolder,
  onAddNote,
  onAddTask,
  onRename,
  onDelete,
  onClose,
}) => {
  const contextMenuRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (visible && contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleEscapeKey = (e) => {
      if (e.key === "Escape" && visible) {
        onClose();
      }
    };

    window.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleEscapeKey);
    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleEscapeKey);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      ref={contextMenuRef}
      className="fixed z-50 bg-white dark:bg-zinc-800 border border-zinc-500 rounded shadow-md text-sm"
      style={{ top: y, left: x }}
    >
      {isEmptyArea ? (
        <button
          className="block w-full px-4 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700"
          onClick={onAddRootFolder}
        >
          ➕ Add Root Folder
        </button>
      ) : (
        <>
          {item?.type === "folder" && (
            <>
              <button
                className="block w-full px-4 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700"
                onClick={onAddFolder}
              >
                ➕ Add Folder Here
              </button>
              <button
                className="block w-full px-4 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700"
                onClick={onAddNote}
              >
                ➕ Add Note Here
              </button>
              <button
                className="block w-full px-4 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700"
                onClick={onAddTask}
              >
                ➕ Add Task Here
              </button>
              <hr className="my-1 border-zinc-300 dark:border-zinc-600" />
            </>
          )}
          <button
            className="block w-full px-4 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700"
            onClick={onRename}
          >
            ✏️ Rename
          </button>
          <button
            className="block w-full px-4 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700"
            onClick={onDelete}
          >
            🗑️ Delete
          </button>
        </>
      )}
    </div>
  );
};

export default ContextMenu;