import React, { useRef, useEffect } from "react";
import {
  Scissors,
  Copy,
  ClipboardPaste,
  Upload,
  Download,
  Plus,
  Pencil,
  Bell,
  Trash2,
  Copy as DuplicateIcon, // Using an alias for clarity
} from "lucide-react";

const ContextMenu = ({
  visible,
  x,
  y,
  item,
  isEmptyArea,
  clipboardItem,
  // Actions
  onAdd,
  onRename,
  onDelete,
  onCopy,
  onCut,
  onPaste,
  onDuplicate,
  onSetReminder,
  onExport,
  onImport,
  onClose = () => console.warn('ContextMenu: onClose not provided, using default no-op'),
}) => {
  const contextMenuRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        visible &&
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target)
      ) {
        // Add a small delay to allow click events to complete
        setTimeout(() => {
          if (typeof onClose === 'function') {
            onClose();
          }
        }, 100);
      }
    };
    
    const handleEscapeKey = (e) => {
      if (e.key === "Escape" && visible) {
        if (typeof onClose === 'function') {
          onClose();
        }
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

      // Position menu above the trigger point (bottom-up approach)
      // Subtract an additional 1px to account for border and ensure direct contact
      adjustedY = y - rect.height - 1;

      // Adjust horizontal position if menu overflows right edge
      if (x + rect.width > viewportWidth - 10) {
        adjustedX = viewportWidth - rect.width - 10;
      }

      // Adjust horizontal position if menu overflows left edge
      if (adjustedX < 10) {
        adjustedX = 10;
      }

      // If menu would go above viewport, position it below instead
      if (adjustedY < 10) {
        adjustedY = y + 10; // Small gap below trigger
      }

      // If still doesn't fit below, center it vertically
      if (adjustedY + rect.height > viewportHeight - 10) {
        adjustedY = Math.max(10, (viewportHeight - rect.height) / 2);
      }

      // Always update position to use the actual measured dimensions
      menu.style.left = `${adjustedX}px`;
      menu.style.top = `${adjustedY}px`;
      
      // Ensure menu height matches content exactly
      menu.style.height = 'auto';
      menu.style.maxHeight = 'none';
      
    }
  }, [visible, x, y]);

  if (!visible) return null;

  const canPaste = !!clipboardItem;
  const itemPadding = "px-4 py-2.5 sm:py-2"; // Consistent padding for items
  const iconBaseClass = "w-4 h-4 mr-2"; // Shared icon base style (size, margin)

  return (
    <div
      ref={contextMenuRef}
      role="menu"
      aria-label={
        isEmptyArea ? "Tree context menu" : `Context menu for ${item?.label}`
      }
      className={`fixed z-50 bg-white dark:bg-zinc-800 border border-zinc-500 rounded-md shadow-lg text-base md:text-sm min-w-[200px] ${isEmptyArea ? 'w-fit h-fit' : ''}`}
      style={{ top: y, left: x }}
    >
      {/* --- Actions for Empty Area --- */}
      {isEmptyArea && (
        <>
          <button
            role="menuitem"
            className={`flex items-center w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 ${isEmptyArea ? 'pt-1' : ''} ${isEmptyArea && !canPaste ? 'pb-1' : ''}`}
            onClick={() => {
              onAdd("folder", null);
              onClose();
            }}
          >
            <Plus
              className={`${iconBaseClass} text-purple-500 dark:text-purple-400`}
            />{" "}
            Add root folder
          </button>
          {canPaste && (
            <>
              <hr
                className="my-1 border-zinc-200 dark:border-zinc-700"
                role="separator"
              />
              <button
                role="menuitem"
                className={`flex items-center w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 pb-1`}
                onClick={() => {
                  onPaste(null);
                  onClose();
                }}
                title="Paste item at root"
              >
                <ClipboardPaste
                  className={`${iconBaseClass} text-green-500 dark:text-green-400`}
                />{" "}
                Paste
              </button>
            </>
          )}
        </>
      )}

      {/* --- Actions for Existing Item --- */}
      {!isEmptyArea && item && (
        <>
          {item.type === "folder" && (
            <>
              <button
                role="menuitem"
                className={`flex items-center w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAdd("folder", item);
                  onClose();
                }}
              >
                <Plus
                  className={`${iconBaseClass} text-purple-500 dark:text-purple-400`}
                />{" "}
                Add Folder Here
              </button>
              <button
                role="menuitem"
                className={`flex items-center w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAdd("note", item);
                  onClose();
                }}
              >
                <Plus
                  className={`${iconBaseClass} text-purple-500 dark:text-purple-400`}
                />{" "}
                Add Note Here
              </button>
              <button
                role="menuitem"
                className={`flex items-center w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAdd("task", item);
                  onClose();
                }}
              >
                <Plus
                  className={`${iconBaseClass} text-purple-500 dark:text-purple-400`}
                />{" "}
                Add Task Here
              </button>
              <hr
                className="my-1 border-zinc-200 dark:border-zinc-700"
                role="separator"
              />
            </>
          )}

          <button
            role="menuitem"
            className={`flex items-center w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700`}
            onClick={() => {
              onCut(item.id);
              onClose();
            }}
          >
            <Scissors
              className={`${iconBaseClass} text-orange-500 dark:text-orange-400`}
            />{" "}
            Cut
          </button>
          <button
            role="menuitem"
            className={`flex items-center w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700`}
            onClick={() => {
              onCopy(item.id);
              onClose();
            }}
          >
            <Copy
              className={`${iconBaseClass} text-blue-500 dark:text-blue-400`}
            />{" "}
            Copy
          </button>
          <button
            role="menuitem"
            className={`flex items-center w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700`}
            onClick={() => {
              onDuplicate(item.id);
              onClose();
            }}
          >
            <DuplicateIcon
              className={`${iconBaseClass} text-blue-500 dark:text-blue-400`}
            />{" "}
            Duplicate
          </button>
          {item.type === "folder" && canPaste && (
            <button
              role="menuitem"
              className={`flex items-center w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700`}
              onClick={() => {
                onPaste(item.id);
                onClose();
              }}
              title={`Paste item into ${item.label}`}
            >
              <ClipboardPaste
                className={`${iconBaseClass} text-green-500 dark:text-green-400`}
              />{" "}
              Paste Here
            </button>
          )}
          <hr
            className="my-1 border-zinc-200 dark:border-zinc-700"
            role="separator"
          />

          {item.type === "task" && !item.completed && (
            <button
              role="menuitem"
              className={`flex items-center w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700`}
              onClick={() => {
                if (typeof onSetReminder === "function") {
                  onSetReminder(item);
                } else {
                  console.warn(
                    "onSetReminder prop is missing or not a function"
                  );
                }
                onClose();
              }}
            >
              <Bell
                className={`${iconBaseClass} text-blue-500 dark:text-blue-400`}
              />{" "}
              Set Reminder
            </button>
          )}

          <button
            role="menuitem"
            className={`flex items-center w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700`}
            onClick={() => {
              onRename(item);
              onClose();
            }}
          >
            <Pencil
              className={`${iconBaseClass} text-yellow-500 dark:text-yellow-400`}
            />{" "}
            Rename
          </button>
          <button
            role="menuitem"
            className={`flex items-center w-full ${itemPadding} text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40`}
            onClick={() => {
              onDelete(item);
              onClose();
            }}
          >
            <Trash2
              className={`${iconBaseClass} text-red-600 dark:text-red-400`}
            />{" "}
            Delete
          </button>
        </>
      )}
    </div>
  );
};

export default ContextMenu;
