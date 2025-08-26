import React, { useState } from "react";
import { sortItems } from "../../utils/treeUtils";
import { formatRemainingTime } from "../../utils/reminderUtils";
import { useLiveCountdowns } from "../../hooks/useLiveCountdown";
import SetReminderDialog from "../reminders/SetReminderDialog";
import { setReminder } from "../../utils/reminderUtils";
import ContextMenu from "../tree/ContextMenu"; // Ensure ContextMenu is imported if used here
import { MoreVertical } from "lucide-react";
import { getTextAlignmentClasses, getTextDirection } from "../../utils/rtlUtils";

const FolderContents = ({
  folder,
  onSelect,
  handleDragStart,
  handleDragEnter,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleDragEnd,
  draggedId,
  dragOverItemId,
  onToggleExpand,
  expandedItems,
  onShowItemMenu,
  reminders = {},
  // Add these props if they're being passed from parent
  contextMenu,
  clipboardItem,
  handleAdd,
  handleRename,
  handleDelete,
  handleCopy,
  handleCut,
  handlePaste,
  handleDuplicate,
  handleExport,
  handleImport,
  handleCloseContextMenu,
}) => {
  const [isReminderDialogOpen, setIsReminderDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  
  // Use live countdown hook for real-time updates
  const liveCountdowns = useLiveCountdowns(reminders || {});

  const handleSetReminder = (item) => {
    setSelectedItem(item);
    setIsReminderDialogOpen(true);
  };

  const handleConfirmReminder = (id, timestamp, repeatOptions) => {
    const itemTitle = selectedItem?.label || 'Untitled';
    setReminder(id, timestamp, repeatOptions, itemTitle);
    setIsReminderDialogOpen(false);
  };

  const hasChildren =
    folder && Array.isArray(folder.children) && folder.children.length > 0;
  if (!hasChildren) {
    return (
      <p className="text-zinc-500 dark:text-zinc-400 italic p-3">
        This folder is empty.
      </p>
    );
  }

  return (
    <div>
      <ul className="space-y-1 sm:space-y-2">
        {sortItems(folder.children).map((child) => {
          const isBeingDragged = child.id === draggedId;
          const reminder = reminders && reminders[child.id] ? reminders[child.id] : null; // Get reminder for this item
          const isDragOverTarget =
            child.id === dragOverItemId && child.type === "folder";

          return (
            <li
              key={child.id}
              data-item-id={`item-${child.id}`}
              className={`group relative flex items-center p-3 sm:p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded cursor-pointer ${
                isBeingDragged ? "opacity-40" : ""
              }`}
              onClick={() => onSelect && onSelect(child.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onSelect && onSelect(child.id);
                }
              }}
              draggable={true}
              onDragStart={(e) =>
                handleDragStart && handleDragStart(e, child.id)
              }
              onDragEnter={(e) =>
                handleDragEnter && handleDragEnter(e, child.id)
              }
              onDragOver={(e) => handleDragOver && handleDragOver(e)}
              onDragLeave={(e) => handleDragLeave && handleDragLeave(e)}
              onDrop={(e) => handleDrop && handleDrop(e, child.id)}
              onDragEnd={(e) => handleDragEnd && handleDragEnd(e)}
              aria-label={`${child.label} (${
                child.type.charAt(0).toUpperCase() + child.type.slice(1)
              })`}
            >
              {isDragOverTarget && (
                <div
                  data-item-id="drag-over-indicator"
                  className="absolute inset-y-0 left-0 right-0 bg-blue-200 dark:bg-blue-800 opacity-30 rounded pointer-events-none z-0"
                  aria-hidden="true"
                ></div>
              )}
              {/* Expand/Collapse Button & Icon Area */}
              <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center mr-1 z-10">
                {child.type === "folder" && onToggleExpand && expandedItems ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleExpand(child.id);
                    }}
                    className={`flex items-center justify-center h-full w-full text-xs rounded-sm p-0.5 text-zinc-500 dark:text-zinc-400 hover:bg-black/10 dark:hover:bg-white/10 focus:ring-1 focus:ring-blue-400`}
                    aria-expanded={!!expandedItems[child.id]}
                    aria-label={
                      expandedItems[child.id]
                        ? `Collapse ${child.label}`
                        : `Expand ${child.label}`
                    }
                    title={expandedItems[child.id] ? `Collapse` : `Expand`}
                  >
                    {" "}
                    {expandedItems[child.id] ? "▾" : "▸"}{" "}
                  </button>
                ) : (
                  <span
                    className="inline-block w-full h-full"
                    aria-hidden="true"
                  >
                    &nbsp;
                  </span>
                )}
              </div>
              {/* Item Icon */}
              <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center mr-1.5 sm:mr-1 z-10">
                {child.type === "folder"
                  ? expandedItems && expandedItems[child.id]
                    ? "📂"
                    : "📁"
                  : child.type === "note"
                  ? "📝"
                  : child.completed
                  ? "✅"
                  : "⬜️"}
              </div>
              {/* Label */}
              <span
                className={`flex-grow truncate z-10 text-base md:text-sm ${
                  child.type === "task" && child.completed
                    ? "line-through text-zinc-500 dark:text-zinc-400"
                    : ""
                } ${getTextAlignmentClasses(child.label)}`}
                dir={getTextDirection(child.label)}
              >
                {child.label}
                {reminder && (
                  <span className="ml-2 text-green-600 dark:text-green-400 text-xs">
                    ({liveCountdowns[child.id] || formatRemainingTime(reminder.timestamp)})
                  </span>
                )}
              </span>
              {/* Type Indicator */}
              <span className="ml-2 text-zinc-500 text-xs sm:text-sm z-10 flex-shrink-0">
                {" "}
                ({child.type.charAt(0).toUpperCase() + child.type.slice(1)})
              </span>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation(); // Prevent the li's onClick
                  if (onShowItemMenu) {
                    onShowItemMenu(child, e.currentTarget); // Pass item and button element
                  }
                }}
                className={`ml-1 p-1 rounded hover:bg-black/10 dark:hover:bg-white/20 text-zinc-500 dark:text-zinc-400 opacity-0 group-hover:opacity-100 focus:opacity-100 flex-shrink-0`} // Show on hover/focus
                aria-label={`More options for ${child.label}`}
                title="More options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </li>
          );
        })}
      </ul>
      {/* Reminder Dialog */}
      <SetReminderDialog
        isOpen={isReminderDialogOpen}
        onClose={() => setIsReminderDialogOpen(false)}
        onSetReminder={handleConfirmReminder}
        item={selectedItem}
      />
      {/* ContextMenu - Only render if contextMenu is defined */}
      {contextMenu && (
        <ContextMenu
          visible={contextMenu.visible}
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          isEmptyArea={contextMenu.isEmptyArea}
          clipboardItem={clipboardItem}
          onAdd={handleAdd}
          onRename={handleRename}
          onDelete={handleDelete}
          onCopy={handleCopy}
          onCut={handleCut}
          onPaste={handlePaste}
          onDuplicate={handleDuplicate}
          onExport={handleExport}
          onImport={handleImport}
          onClose={handleCloseContextMenu}
          onSetReminder={handleSetReminder}
        />
      )}
    </div>
  );
};

export default FolderContents;