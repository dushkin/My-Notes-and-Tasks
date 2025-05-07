// src/components/FolderContents.jsx
import React from "react";
import { sortItems } from "../utils/treeUtils";

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
}) => {
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
          const isDragOverTarget =
            child.id === dragOverItemId && child.type === "folder";

          return (
            <li
              key={child.id}
              data-testid={`item-${child.id}`}
              className={`relative flex items-center p-3 sm:p-2 group hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded cursor-pointer ${
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
                  data-testid="drag-over-indicator"
                  className="absolute inset-y-0 left-0 right-0 bg-blue-200 dark:bg-blue-800 opacity-30 rounded pointer-events-none z-0"
                  aria-hidden="true"
                ></div>
              )}
              {/* Expand/Collapse Button & Icon Area */}
              <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center mr-1 z-10">
                {" "}
                {/* Consistent width for icon/button area */}
                {child.type === "folder" && onToggleExpand && expandedItems ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleExpand(child.id);
                    }}
                    className={`flex items-center justify-center h-full w-full focus:outline-none text-xs rounded-sm p-0.5 text-zinc-500 dark:text-zinc-400 hover:bg-black/10 dark:hover:bg-white/10`}
                    aria-expanded={!!expandedItems[child.id]}
                    aria-label={
                      expandedItems[child.id]
                        ? `Collapse ${child.label}`
                        : `Expand ${child.label}`
                    }
                    title={expandedItems[child.id] ? `Collapse` : `Expand`}
                  >
                    {expandedItems[child.id] ? "▾" : "▸"}
                  </button>
                ) : (
                  <span
                    className="inline-block w-full h-full"
                    aria-hidden="true"
                  >
                    &nbsp;
                  </span> /* Placeholder for alignment if not folder */
                )}
              </div>

              {/* Item Icon */}
              <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center mr-1.5 sm:mr-1 z-10">
                {" "}
                {/* Consistent width and centering */}
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
              <span
                className={`truncate z-10 text-base md:text-sm ${
                  child.type === "task" && child.completed
                    ? "line-through text-zinc-500 dark:text-zinc-400"
                    : ""
                }`}
              >
                {child.label}
              </span>
              <span className="ml-2 text-zinc-500 text-xs sm:text-sm z-10">
                ({child.type.charAt(0).toUpperCase() + child.type.slice(1)})
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default FolderContents;
