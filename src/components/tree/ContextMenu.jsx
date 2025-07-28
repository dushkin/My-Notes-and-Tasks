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
  // Debug props
  if (visible) {
    console.log('🔧 ContextMenu props debug:', {
      hasOnCopy: typeof onCopy === 'function',
      hasOnCut: typeof onCut === 'function',
      hasOnPaste: typeof onPaste === 'function',
      itemId: item?.id,
      itemType: item?.type
    });
  }
  const contextMenuRef = useRef(null);
  
  // Debug logging for onClose prop
  if (visible && typeof onClose !== 'function') {
    console.error('ContextMenu rendered with invalid onClose prop:', {
      onClose,
      typeofOnClose: typeof onClose,
      visible,
      allProps: arguments[0]
    });
  }

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
          } else {
            console.error('ContextMenu: onClose is not a function', typeof onClose);
          }
        }, 10);
      }
    };
    const handleEscapeKey = (e) => {
      if (e.key === "Escape" && visible) {
        if (typeof onClose === 'function') {
          onClose();
        } else {
          console.error('ContextMenu: onClose is not a function', typeof onClose);
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
  
  // Debug clipboard state
  if (visible) {
    console.log('ContextMenu clipboard debug:', {
      hasClipboardItem: !!clipboardItem,
      clipboardItemType: clipboardItem?.type,
      clipboardItemLabel: clipboardItem?.label,
      targetItemType: item?.type,
      isEmptyArea,
      canPaste,
      fullClipboardItem: clipboardItem ? { id: clipboardItem.id, type: clipboardItem.type, label: clipboardItem.label } : null
    });
    
    // Debug menu rendering
    console.log('📋 ContextMenu rendered with:', {
      itemType: item?.type,
      itemLabel: item?.label,
      isEmptyArea,
      willShowCopyButton: !isEmptyArea && item,
      willShowPasteButton: !isEmptyArea && item && item.type === "folder" && canPaste
    });
  }

  return (
    <div
      ref={contextMenuRef}
      role="menu"
      aria-label={
        isEmptyArea ? "Tree context menu" : `Context menu for ${item?.label}`
      }
      className="fixed z-50 bg-white dark:bg-zinc-800 border border-zinc-500 rounded-md shadow-lg text-base md:text-sm min-w-[200px] py-1"
      style={{ top: y, left: x }}
    >
      {/* --- Actions for Empty Area --- */}
      {isEmptyArea && (
        <>
          <button
            role="menuitem"
            className={`flex items-center w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700`}
            onClick={() => {
              onAdd("folder", null);
              onClose();
            }}
          >
            <Plus
              className={`${iconBaseClass} text-purple-500 dark:text-purple-400`}
            />{" "}
            Add Root Folder
          </button>
          <hr
            className="my-1 border-zinc-200 dark:border-zinc-700"
            role="separator"
          />
          {canPaste && (
            <button
              role="menuitem"
              className={`flex items-center w-full ${itemPadding} text-left hover:bg-zinc-100 dark:hover:bg-zinc-700`}
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
                onClick={() => {
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
                onClick={() => {
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
                onClick={() => {
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
            onPointerDown={() => {
              console.log('✂️ ContextMenu Cut button clicked:', { itemId: item.id, itemType: item.type, itemLabel: item.label });
              if (typeof onCut === 'function') {
                onCut(item.id);
                console.log('✅ Cut function called successfully');
              } else {
                console.error('❌ onCut is not a function:', typeof onCut);
              }
              if (typeof onClose === 'function') {
                onClose();
              }
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
            onPointerDown={(e) => {
              console.log('🔄 ContextMenu Copy button clicked:', { itemId: item.id, itemType: item.type, itemLabel: item.label });
              
              if (typeof onCopy === 'function') {
                onCopy(item.id);
                console.log('✅ Copy function called successfully');
              } else {
                console.error('❌ onCopy is not a function:', typeof onCopy);
              }
              
              // Close menu immediately
              if (typeof onClose === 'function') {
                onClose();
              }
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
              onPointerDown={() => {
                console.log('📋 Paste button clicked:', { 
                  targetFolderId: item.id, 
                  targetFolderLabel: item.label,
                  clipboardItemType: clipboardItem?.type,
                  clipboardItemLabel: clipboardItem?.label 
                });
                
                if (typeof onPaste === 'function') {
                  onPaste(item.id);
                  console.log('✅ Paste function called successfully');
                } else {
                  console.error('❌ onPaste is not a function:', typeof onPaste);
                }
                
                if (typeof onClose === 'function') {
                  onClose();
                }
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
