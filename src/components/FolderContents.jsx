// src/components/FolderContents.jsx
import React from "react";
import { sortItems } from "../utils/treeUtils";

/**
 * Displays the contents (children) of a selected folder.
 * Allows selecting child items.
 */
const FolderContents = ({
  folder,
  onSelect,
  // Props needed for drag-and-drop functionality passed down
  handleDragStart,
  handleDragEnter,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleDragEnd,
  draggedId, // Needed to apply opacity
  dragOverItemId, // ID of the item currently being dragged over (for visual feedback)
  onToggleExpand, // Pass toggle handler
  expandedItems, // Pass expanded state
}) => {
  // Ensure the folder prop exists and has a valid children array
  const hasChildren = folder && Array.isArray(folder.children) && folder.children.length > 0;

  if (!hasChildren) {
    return <p className="text-zinc-400 italic">This folder is empty.</p>;
  }

  // If folder has children, render the list
  return (
    <div>
      <ul className="space-y-2">
        {/* Sort and map over the children */}
        {sortItems(folder.children).map((child) => {
          const isBeingDragged = child.id === draggedId;
          const isDragOverTarget = child.id === dragOverItemId && child.type === 'folder'; // Only folders can be drop targets here

          return (
            <li
              key={child.id} // Unique key for each child item
              data-testid={`item-${child.id}`} // ADDED data-testid
              className={`relative flex items-center p-2 group hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded cursor-pointer ${isBeingDragged ? 'opacity-40' : ''}`}
              onClick={() => onSelect && onSelect(child.id)}
              role="button" // Indicate it's clickable
              tabIndex={0} // Make it focusable
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { onSelect && onSelect(child.id); } }} // Allow selection with Enter/Space
              draggable={true} // Make items draggable
              onDragStart={(e) => handleDragStart && handleDragStart(e, child.id)}
              onDragEnter={(e) => handleDragEnter && handleDragEnter(e, child.id)}
              onDragOver={(e) => handleDragOver && handleDragOver(e)}
              onDragLeave={(e) => handleDragLeave && handleDragLeave(e)}
              onDrop={(e) => handleDrop && handleDrop(e, child.id)}
              onDragEnd={(e) => handleDragEnd && handleDragEnd(e)}
              aria-label={`${child.label} (${child.type.charAt(0).toUpperCase() + child.type.slice(1)})`} // Added aria-label for clarity
            >
              {/* Drag over indicator - shown only on folders */}
               {isDragOverTarget && (
                <div
                  data-testid="drag-over-indicator" // Existing test ID
                  className="absolute inset-y-0 left-0 right-0 bg-blue-200 dark:bg-blue-800 opacity-30 rounded pointer-events-none z-0"
                  aria-hidden="true"
                ></div>
               )}

               {/* Indentation and Toggle Button placeholder/actual button */}
               <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center mr-1 z-10">
                 {child.type === 'folder' && onToggleExpand && expandedItems ? (
                   <button
                     onClick={(e) => {
                       e.stopPropagation(); // Prevent li's onClick
                       onToggleExpand(child.id);
                     }}
                     className={`flex items-center justify-center h-full w-full focus:outline-none text-xs rounded-sm text-zinc-500 dark:text-zinc-400 hover:bg-black/10 dark:hover:bg-white/10`}
                     aria-expanded={!!expandedItems[child.id]}
                     aria-label={expandedItems[child.id] ? `Collapse ${child.label}` : `Expand ${child.label}`}
                     title={expandedItems[child.id] ? `Collapse` : `Expand`}
                   >
                     {expandedItems[child.id] ? "▾" : "▸"}
                   </button>
                 ) : (
                   <span className="inline-block w-4" aria-hidden="true"></span> /* Placeholder */
                 )}
               </div>

              {/* Display appropriate icon based on child type */}
              <span className="mr-1 z-10" aria-hidden="true">
                {child.type === "folder" ? (expandedItems && expandedItems[child.id] ? "📂" : "📁") : child.type === "note" ? "📝" : child.completed ? "✅" : "⬜️"}
              </span>
              {/* Display the child's label */}
              <span className={`truncate z-10 ${child.type === 'task' && child.completed ? 'line-through text-zinc-500 dark:text-zinc-400' : ''}`}>{child.label}</span>
              {/* Display the child's type */}
              <span className="ml-2 text-zinc-500 text-sm z-10">
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