import React, { useRef, useEffect } from "react";
import { 
    Scissors, 
    Copy, 
    ClipboardPaste, 
    Upload, 
    Download, 
    Plus, 
    Pencil, 
    Trash2,
    Copy as DuplicateIcon // Using an alias for clarity
} from "lucide-react";

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

  useEffect(() => {
    if (visible && contextMenuRef.current) {
      const menu = contextMenuRef.current;
      const rect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      // Adjust horizontal position if menu overflows right edge
      if (x + rect.width > viewportWidth - 10) {
        adjustedX = viewportWidth - rect.width - 10;
      }
      
      // Adjust horizontal position if menu overflows left edge
      if (adjustedX < 10) {
        adjustedX = 10;
      }

      // Adjust vertical position if menu overflows bottom edge
      if (y + rect.height > viewportHeight - 10) {
        adjustedY = viewportHeight - rect.height - 10;
      }
      
      // Adjust vertical position if menu overflows top edge
      if (adjustedY < 10) {
        adjustedY = 10;
      }

      if (adjustedX !== x || adjustedY !== y) {
        menu.style.left = `${adjustedX}px`;
        menu.style.top = `${adjustedY}px`;
      }
    }
  }, [visible, x, y]);

  if (!visible) return null;

  const canPaste = !!clipboardItem;
  const itemPadding = "px-4 py-2.5 sm:py-2"; // Consistent padding for items
  const iconBaseClass = "w-4 h-4 mr-2"; // Shared icon base style (size, margin)

  return (
    <div
      ref={contextMenuRef}
      className="fixed z-50 bg-white dark:bg-zinc-800 border border-zinc-500 rounded-md shadow-lg text-base md:text-sm min-w-[200px] py-1" // Adjusted base font size
      style={{ top: y, left: x }}
    >
      {/* --- Actions for Empty Area --- */}
      {isEmptyArea && (
        <>
          <button
            className={`flex items-center w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700`}
            onClick={() => {
              onAddRootFolder();
              onClose();
            }}
          >
            <Plus className={`${iconBaseClass} text-purple-500 dark:text-purple-400`} /> Add Root Folder
          </button>
          <hr className="my-1 border-zinc-200 dark:border-zinc-700" />
          {canPaste && (
            <button
              className={`flex items-center w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700`}
              onClick={() => {
                onPaste();
                onClose();
              }}
              title="Paste item at root"
            >
              <ClipboardPaste className={`${iconBaseClass} text-green-500 dark:text-green-400`} /> Paste
            </button>
          )}
          {canPaste && (
            <hr className="my-1 border-zinc-200 dark:border-zinc-700" />
          )}
          <button
            className={`flex items-center w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700`}
            onClick={() => {
              onExportTree();
              onClose();
            }}
            title="Export the entire tree"
          >
            <Download className={`${iconBaseClass} text-teal-500 dark:text-teal-400`} /> Export Full Tree...
          </button>
          <button
            className={`flex items-center w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700`}
            onClick={() => {
              onImportTree();
              onClose();
            }}
            title="Import items into the tree"
          >
            <Upload className={`${iconBaseClass} text-cyan-500 dark:text-cyan-400`} /> Import Full Tree...
          </button>
        </>
      )}

      {/* --- Actions for Existing Item --- */}
      {!isEmptyArea && item && (
        <>
          {item.type === "folder" && (
            <>
              <button
                className={`flex items-center w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700`}
                onClick={() => { onAddFolder(); onClose(); }}
              >
                <Plus className={`${iconBaseClass} text-purple-500 dark:text-purple-400`} /> Add Folder Here
              </button>
              <button
                className={`flex items-center w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700`}
                onClick={() => { onAddNote(); onClose(); }}
              >
                <Plus className={`${iconBaseClass} text-purple-500 dark:text-purple-400`} /> Add Note Here
              </button>
              <button
                className={`flex items-center w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700`}
                onClick={() => { onAddTask(); onClose(); }}
              >
                <Plus className={`${iconBaseClass} text-purple-500 dark:text-purple-400`} /> Add Task Here
              </button>
              <hr className="my-1 border-zinc-200 dark:border-zinc-700" />
            </>
          )}

          <button
            className={`flex items-center w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700`}
            onClick={() => { onCut(); onClose(); }}
          >
            <Scissors className={`${iconBaseClass} text-orange-500 dark:text-orange-400`} /> Cut
          </button>
          <button
            className={`flex items-center w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700`}
            onClick={() => { onCopy(); onClose(); }}
          >
            <Copy className={`${iconBaseClass} text-blue-500 dark:text-blue-400`} /> Copy
          </button>
          <button
            className={`flex items-center w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700`}
            onClick={() => { onDuplicate(); onClose(); }}
          >
            <DuplicateIcon className={`${iconBaseClass} text-blue-500 dark:text-blue-400`} /> Duplicate
          </button>
          {item.type === "folder" && canPaste && (
            <button
              className={`flex items-center w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700`}
              onClick={() => { onPaste(); onClose(); }}
              title={`Paste item into ${item.label}`}
            >
              <ClipboardPaste className={`${iconBaseClass} text-green-500 dark:text-green-400`} /> Paste Here
            </button>
          )}
          <hr className="my-1 border-zinc-200 dark:border-zinc-700" />

          <button
            className={`flex items-center w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700`}
            onClick={() => { onExportItem(); onClose(); }}
            title={`Export '${item.label}' and its contents`}
          >
            <Download className={`${iconBaseClass} text-teal-500 dark:text-teal-400`} /> Export Item...
          </button>
          {item.type === "folder" && (
            <button
              className={`flex items-center w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700`}
              onClick={() => { onImportItem(); onClose(); }}
              title={`Import items under '${item.label}'`}
            >
              <Upload className={`${iconBaseClass} text-cyan-500 dark:text-cyan-400`} /> Import under Item...
            </button>
          )}
          <hr className="my-1 border-zinc-200 dark:border-zinc-700" />

          <button
            className={`flex items-center w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700`}
            onClick={() => { onRename(); onClose(); }}
          >
            <Pencil className={`${iconBaseClass} text-yellow-500 dark:text-yellow-400`} /> Rename
          </button>
          <button
            className={`flex items-center w-full ${itemPadding} text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40`}
            onClick={() => { onDelete(); onClose(); }}
          >
            <Trash2 className={`${iconBaseClass} text-red-600 dark:text-red-400`} /> Delete
          </button>
        </>
      )}
    </div>
  );
};

export default ContextMenu;