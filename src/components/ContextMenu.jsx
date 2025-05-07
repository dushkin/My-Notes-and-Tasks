// src/components/ContextMenu.jsx
import React, { useRef, useEffect } from "react";
import { Scissors, Copy, ClipboardPaste, Upload, Download } from "lucide-react";

const ContextMenu = ({
  visible,
  x,
  y,
  item,
  isEmptyArea,
  clipboardItem,
  // Actions
  onAddRootFolder,
  onAddFolder,
  onAddNote,
  onAddTask,
  onRename,
  onDelete,
  onCopy,
  onCut,
  onPaste,
  onDuplicate,
  // Modified Import/Export handlers accepting context
  onExportItem,
  onImportItem,
  onExportTree,
  onImportTree,
  onClose,
}) => {
  const contextMenuRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        visible &&
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target)
      ) {
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

  const canPaste = !!clipboardItem;
  const itemPadding = "px-4 py-2.5 sm:py-2"; // Consistent padding for items

  return (
    <div
      ref={contextMenuRef}
      className="fixed z-50 bg-white dark:bg-zinc-800 border border-zinc-500 rounded shadow-md text-base md:text-sm min-w-[180px]" // Adjusted base font size
      style={{ top: y, left: x }}
    >
      {/* --- Actions for Empty Area --- */}
      {isEmptyArea && (
        <>
          <button
            className={`block w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2`}
            onClick={() => {
              onAddRootFolder();
              onClose();
            }}
          >
            ➕ Add Root Folder
          </button>
          <hr className="my-1 border-zinc-300 dark:border-zinc-600" />
          {canPaste && (
            <button
              className={`block w-full ${itemPadding} text-left flex items-center gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-700`}
              onClick={() => {
                onPaste();
                onClose();
              }}
              title="Paste item at root"
            >
              <ClipboardPaste className="w-4 h-4" /> Paste
            </button>
          )}
          {canPaste && (
            <hr className="my-1 border-zinc-300 dark:border-zinc-600" />
          )}
          <button
            className={`block w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2`}
            onClick={() => {
              onExportTree();
              onClose();
            }}
            title="Export the entire tree"
          >
            <Download className="w-4 h-4" /> Export Full Tree...
          </button>
          <button
            className={`block w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2`}
            onClick={() => {
              onImportTree();
              onClose();
            }}
            title="Import items into the tree"
          >
            <Upload className="w-4 h-4" /> Import Full Tree...
          </button>
        </>
      )}

      {/* --- Actions for Existing Item --- */}
      {!isEmptyArea && item && (
        <>
          {item.type === "folder" && (
            <>
              <button
                className={`block w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2`}
                onClick={() => {
                  onAddFolder();
                  onClose();
                }}
              >
                ➕ Add Folder Here
              </button>
              <button
                className={`block w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2`}
                onClick={() => {
                  onAddNote();
                  onClose();
                }}
              >
                ➕ Add Note Here
              </button>
              <button
                className={`block w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2`}
                onClick={() => {
                  onAddTask();
                  onClose();
                }}
              >
                ➕ Add Task Here
              </button>
              <hr className="my-1 border-zinc-300 dark:border-zinc-600" />
            </>
          )}

          <button
            className={`block w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2`}
            onClick={() => {
              onCut();
              onClose();
            }}
          >
            <Scissors className="w-4 h-4" /> Cut
          </button>
          <button
            className={`block w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2`}
            onClick={() => {
              onCopy();
              onClose();
            }}
          >
            <Copy className="w-4 h-4" /> Copy
          </button>
          <button
            className={`block w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2`}
            onClick={() => {
              onDuplicate();
              onClose();
            }}
          >
            <Copy className="w-4 h-4 opacity-0" aria-hidden="true" />
            Duplicate
          </button>
          {item.type === "folder" && canPaste && (
            <button
              className={`block w-full ${itemPadding} text-left flex items-center gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-700`}
              onClick={() => {
                onPaste();
                onClose();
              }}
              title={`Paste item into ${item.label}`}
            >
              <ClipboardPaste className="w-4 h-4" /> Paste Here
            </button>
          )}
          <hr className="my-1 border-zinc-300 dark:border-zinc-600" />

          <button
            className={`block w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2`}
            onClick={() => {
              onExportItem();
              onClose();
            }}
            title={`Export '${item.label}' and its contents`}
          >
            <Download className="w-4 h-4" /> Export Item...
          </button>
          {item.type === "folder" && (
            <button
              className={`block w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2`}
              onClick={() => {
                onImportItem();
                onClose();
              }}
              title={`Import items under '${item.label}'`}
            >
              <Upload className="w-4 h-4" /> Import under Item...
            </button>
          )}
          <hr className="my-1 border-zinc-300 dark:border-zinc-600" />

          <button
            className={`block w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2`}
            onClick={() => {
              onRename();
              onClose();
            }}
          >
            ✏️ Rename
          </button>
          <button
            className={`block w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2`}
            onClick={() => {
              onDelete();
              onClose();
            }}
          >
            🗑️ Delete
          </button>
        </>
      )}
    </div>
  );
};

export default ContextMenu;
