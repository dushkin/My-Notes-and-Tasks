// src/components/ContextMenu.jsx
import React, { useRef, useEffect } from "react";
import { Scissors, Copy, ClipboardPaste } from 'lucide-react'; // Import icons

const ContextMenu = ({
  visible,
  x,
  y,
  item, // The item right-clicked on
  isEmptyArea, // True if right-clicked on empty tree space
  clipboardItem, // The item currently in the clipboard state
  // --- Action Handlers ---
  onAddRootFolder,
  onAddFolder,
  onAddNote,
  onAddTask,
  onRename,
  onDelete,
  onCopy,   // <-- New handler
  onCut,    // <-- New handler
  onPaste,  // <-- New handler (will need target logic in App.jsx)
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

  const canPaste = !!clipboardItem; // Paste is possible if clipboard has an item
  // Determine if the current target is a valid paste location
  const isPasteTargetValid = isEmptyArea || (item?.type === 'folder');

  return (
    <div
      ref={contextMenuRef}
      className="fixed z-50 bg-white dark:bg-zinc-800 border border-zinc-500 rounded shadow-md text-sm min-w-[150px]" // Added min-width
      style={{ top: y, left: x }}
    >
      {/* --- Actions for Empty Area --- */}
      {isEmptyArea && (
        <>
          <button
            className="block w-full px-4 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
            onClick={onAddRootFolder}
          >
             ➕ Add Root Folder
          </button>
          <hr className="my-1 border-zinc-300 dark:border-zinc-600" />
          <button
            className={`block w-full px-4 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2 ${!canPaste ? 'text-zinc-400 cursor-not-allowed' : ''}`}
            onClick={onPaste}
            disabled={!canPaste} // Disable if nothing to paste
            title={!canPaste ? "Nothing to paste" : "Paste item"}
          >
            <ClipboardPaste className="w-4 h-4" /> Paste
          </button>
        </>
      )}

      {/* --- Actions for Existing Item --- */}
      {!isEmptyArea && item && (
        <>
          {/* --- Add actions (if folder) --- */}
          {item.type === "folder" && (
            <>
              <button
                className="block w-full px-4 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
                onClick={onAddFolder}
              >
                 ➕ Add Folder Here
              </button>
              <button
                className="block w-full px-4 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
                onClick={onAddNote}
              >
                 ➕ Add Note Here
              </button>
              <button
                className="block w-full px-4 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
                onClick={onAddTask}
              >
                 ➕ Add Task Here
              </button>
              <hr className="my-1 border-zinc-300 dark:border-zinc-600" />
            </>
          )}

          {/* --- Cut/Copy/Paste --- */}
           <button
            className="block w-full px-4 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
            onClick={onCut}
          >
            <Scissors className="w-4 h-4" /> Cut
          </button>
          <button
            className="block w-full px-4 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
            onClick={onCopy}
          >
            <Copy className="w-4 h-4" /> Copy
          </button>
          {/* Paste option only appears on folders */}
           {item.type === 'folder' && (
               <button
                    className={`block w-full px-4 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2 ${!canPaste ? 'text-zinc-400 cursor-not-allowed' : ''}`}
                    onClick={onPaste}
                    disabled={!canPaste}
                    title={!canPaste ? "Nothing to paste" : `Paste item into ${item.label}`}
               >
                    <ClipboardPaste className="w-4 h-4" /> Paste Here
               </button>
           )}
          <hr className="my-1 border-zinc-300 dark:border-zinc-600" />

          {/* --- Rename/Delete --- */}
          <button
            className="block w-full px-4 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
            onClick={onRename}
          >
            ✏️ Rename
          </button>
          <button
            className="block w-full px-4 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
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