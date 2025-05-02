// src/components/Tree.jsx
// --- V-- Add useCallback here ---V
import React, { useRef, useState, useEffect, useCallback } from "react";
import { sortItems } from "../utils/treeUtils";

const INDENT_SIZE = 16; // Pixels for indentation per level

const Tree = ({
  items,
  selectedItemId,
  onSelect,
  inlineRenameId,
  inlineRenameValue,
  setInlineRenameValue,
  finishInlineRename,
  cancelInlineRename,
  expandedFolders,
  onToggleExpand,
  onToggleTask, // Prop for toggling task completion
  draggedId,
  onDragStart,
  onDrop, // Handler for successful drop from useTree
  onContextMenu, // Handler for context menu request
  onRename, // Handler to initiate rename (likely calls startInlineRename)
  onDragEnd, // Handler for end of drag operation
}) => {
  const navRef = useRef(null); // Ref for the main navigation container
  const [dragOverId, setDragOverId] = useState(null); // State to track which item is being dragged over

  // --- Focus Management ---
  // Function to refocus the tree container, e.g., after rename input blur
  const refocusTree = useCallback(() => {
      requestAnimationFrame(() => {
        // Check if navRef.current exists before calling focus
        navRef.current?.focus({ preventScroll: true });
      });
  }, []); // No dependencies needed


  // --- Keyboard Navigation Helpers ---
  // Recursively get a flat list of visible items based on expanded state
   const getVisible = useCallback((nodes, currentExpandedFolders) => {
      let out = [];
      const currentNodes = Array.isArray(nodes) ? nodes : []; // Ensure nodes is an array
      sortItems(currentNodes).forEach((it) => {
          out.push(it);
          // If item is a folder, is expanded, and has children, recurse
          if (it.type === "folder" && Array.isArray(it.children) && currentExpandedFolders[it.id]) {
              out = out.concat(getVisible(it.children, currentExpandedFolders));
          }
      });
      return out;
   }, []); // Depends on sortItems implicitly

   // Recursively find the parent of a given child ID
   const findParent = useCallback((nodes, childId, parent = null) => {
        const currentNodes = Array.isArray(nodes) ? nodes : [];
        for (const it of currentNodes) {
            if (it.id === childId) return parent; // Found the item, return its parent
            if (Array.isArray(it.children)) {
                const p = findParent(it.children, childId, it); // Recurse, passing current item as potential parent
                if (p) return p; // If found in recursion, return the result
            }
        }
        return null; // Not found in this branch
    }, []); // No dependencies needed

  // --- Keyboard Event Handler ---
  const handleKeyDown = useCallback((e) => {
      // Ignore keyboard events if inline rename input has focus
      if (e.target.tagName === "INPUT") return;

      // Get the flat list of currently visible items
      const visibleItems = getVisible(items, expandedFolders);
      // Find the index of the currently selected item in the visible list
      const currentIndex = visibleItems.findIndex((it) => it.id === selectedItemId);
      const currentItem = currentIndex !== -1 ? visibleItems[currentIndex] : null;

      switch (e.key) {
          case "ArrowDown":
              e.preventDefault();
              if (currentIndex < visibleItems.length - 1) {
                  // Select next visible item
                  onSelect(visibleItems[currentIndex + 1].id);
              } else if (currentIndex === -1 && visibleItems.length > 0) {
                  // If nothing selected, select the first item
                  onSelect(visibleItems[0].id);
              }
              break;
          case "ArrowUp":
              e.preventDefault();
              // Select previous visible item
              if (currentIndex > 0) {
                  onSelect(visibleItems[currentIndex - 1].id);
              }
              break;
          case "ArrowRight":
               e.preventDefault();
               // If a collapsed folder is selected, expand it
               if (currentItem && currentItem.type === "folder" && !expandedFolders[currentItem.id]) {
                   onToggleExpand(currentItem.id, true); // Force expand
               }
              break;
          case "ArrowLeft":
                e.preventDefault();
                if (currentItem) {
                    // If an expanded folder is selected, collapse it
                    if (currentItem.type === "folder" && expandedFolders[currentItem.id]) {
                         onToggleExpand(currentItem.id, false); // Force collapse
                    }
                    // If any item (or collapsed folder) is selected, try selecting its parent
                    else {
                         const parent = findParent(items, currentItem.id);
                         if (parent) {
                            onSelect(parent.id); // Select the parent
                         }
                    }
                }
              break;
          case " ": // Spacebar
          case "Spacebar": // For older browser compatibility
              e.preventDefault();
              // If a task is selected, toggle its completion state
              if (currentItem && currentItem.type === "task") {
                  onToggleTask(currentItem.id, !currentItem.completed);
              }
              break;
          // F2 is handled globally in App.jsx now for rename trigger
          // case "F2": ...
          default:
              break; // Ignore other keys
      }
  }, [items, expandedFolders, selectedItemId, onSelect, onToggleExpand, findParent, getVisible, onToggleTask]); // Add dependencies


  // --- Drag and Drop Handlers (Internal to Tree for visual feedback) ---
  const handleDragOver = useCallback((e, item) => {
      e.preventDefault(); // Necessary to allow dropping
      e.stopPropagation();
      // Allow drop only on folders that are not the dragged item itself
      if (item?.type === 'folder' && item.id !== draggedId) {
          setDragOverId(item.id); // Set state to highlight this folder
      } else {
          setDragOverId(null); // Don't highlight if not a valid folder target
      }
   }, [draggedId]); // Depends on draggedId

  const handleDragLeave = useCallback((e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverId(null); // Clear highlight when leaving a potential target
  }, []);

  // Handles the actual drop event *on* a list item
  const handleItemDrop = useCallback((e, targetItem) => {
      e.preventDefault();
      e.stopPropagation();
      const currentDragOverId = dragOverId; // Capture the ID of the item we were just dragging over
      setDragOverId(null); // Reset visual indicator immediately

      // Check if the drop is valid:
      // 1. Drop target is the same as the item we were hovering over.
      // 2. Target is a folder.
      // 3. Target is not the item being dragged.
      if (targetItem?.id === currentDragOverId && targetItem?.type === 'folder' && targetItem.id !== draggedId) {
          onDrop(targetItem.id); // Call the main drop handler passed from App (which calls useTree's handleDrop)
      } else {
          // console.log("Drop occurred on invalid target or conditions not met.");
          // Drag state (draggedId) will be cleared by onDragEnd anyway
      }
  }, [dragOverId, draggedId, onDrop]); // Dependencies


  // --- Recursive Rendering Function ---
  // Using useCallback here because it depends on many props/state and helps memoization if Tree re-renders often
  const renderItems = useCallback((nodes, depth = 0) => (
    <ul className="list-none p-0 m-0">
      {/* Ensure nodes is an array before mapping */}
      {(Array.isArray(nodes) ? sortItems(nodes) : []).map((item) => {
        const isBeingDragged = item.id === draggedId;
        const isDragOverTarget = item.id === dragOverId;
        const isSelected = item.id === selectedItemId;
        const isRenaming = item.id === inlineRenameId;

        return (
           <li
            key={item.id}
            className={`group relative text-sm ${isBeingDragged ? 'opacity-40' : ''}`} // Basic styling, opacity if dragged
            draggable={!isRenaming} // Only draggable if not currently renaming this item
            // --- Drag and Drop Event Handlers ---
            onDragStart={(e) => { // When dragging starts on this item
                 if (isRenaming) { e.preventDefault(); return; } // Prevent drag during rename
                 e.stopPropagation(); // Prevent event bubbling
                 onDragStart(e, item.id); // Call handler passed from App (sets draggedId)
            }}
            onDragOver={(e) => handleDragOver(e, item)} // Handle hovering over potential targets
            onDragLeave={handleDragLeave} // Handle leaving potential targets
            onDrop={(e) => handleItemDrop(e, item)} // Handle actual drop attempt on this item
            onDragEnd={onDragEnd} // <-- Add onDragEnd handler here (calls handler from App -> clears draggedId)
          >
            {/* Drag over indicator (visual feedback) */}
            {isDragOverTarget && (
                <div className="absolute inset-y-0 left-0 right-0 bg-blue-200 dark:bg-blue-800 opacity-30 rounded pointer-events-none z-0" aria-hidden="true"></div>
            )}

            {/* Item Content Wrapper */}
            <div
               className={`relative z-10 flex items-center cursor-pointer rounded py-0.5 pr-1 ${ // Adjusted padding
                 isSelected
                   ? "bg-blue-600 text-white" // Selected style
                   : "hover:bg-zinc-100 dark:hover:bg-zinc-700" // Hover style (only if not selected)
               } ${isDragOverTarget ? 'bg-blue-100 dark:bg-blue-900 text-zinc-900 dark:text-zinc-100' : ''}`} // Drag over style override
               style={{ paddingLeft: `${depth * INDENT_SIZE}px` }} // Indentation
               // --- Interaction Handlers ---
               onClick={(e) => { // Handle selection via click
                   // Prevent selection changes if clicking the item being dragged or renamed
                   if (isBeingDragged || isRenaming) return;
                   e.stopPropagation();
                   onSelect(item.id); // Call selection handler passed from App
               }}
               onContextMenu={(e) => { // Handle context menu request
                  if (isBeingDragged || isRenaming) { e.preventDefault(); return; } // Prevent menu during drag/rename
                  e.preventDefault(); // Prevent default browser context menu
                  e.stopPropagation();
                  onSelect(item.id); // Ensure item is selected before showing menu
                  onContextMenu(e, item); // Call handler passed from App (shows menu)
               }}
                onDoubleClick={(e) => { // Handle double-click actions
                    if (isRenaming) return; // Do nothing if already renaming
                    e.stopPropagation();
                    // Example: Rename non-folders, toggle folders
                    if (item.type !== 'folder') {
                       onRename(item); // Trigger rename (calls startInlineRename via App)
                    } else {
                       onToggleExpand(item.id); // Toggle folder expansion
                    }
                }}
            >
              {/* Expand/Collapse Button */}
              <div className="w-4 h-5 flex-shrink-0 flex items-center justify-center mr-1">
                   {item.type === "folder" ? (
                     <button
                       onClick={(e) => { e.stopPropagation(); onToggleExpand(item.id); }}
                       className="flex items-center justify-center h-full w-full focus:outline-none text-xs rounded-sm hover:bg-black/10 dark:hover:bg-white/10"
                       aria-expanded={!!expandedFolders[item.id]}
                       aria-label={expandedFolders[item.id] ? `Collapse ${item.label}` : `Expand ${item.label}`}
                       title={expandedFolders[item.id] ? `Collapse` : `Expand`}
                      >
                       {expandedFolders[item.id] ? "▾" : "▸"}
                     </button>
                   ) : ( <span className="inline-block w-4" aria-hidden="true"></span> /* Placeholder for alignment */ )}
              </div>

              {/* Item Icon */}
              <div className="mr-1 flex-shrink-0 flex items-center">
                  {item.type === "folder" ? (
                      <span className={`${!item.children || item.children.length === 0 ? "opacity-50" : ""}`} aria-hidden="true">
                         {expandedFolders[item.id] ? "📂" : "📁"} {/* Open/Closed folder icon */}
                      </span>
                   ) : item.type === "task" ? (
                       // Make checkbox part of the button/clickable area
                      <button
                         onClick={(e) => { e.stopPropagation(); onToggleTask(item.id, !item.completed); }}
                         className="focus:outline-none flex items-center cursor-pointer"
                         aria-checked={!!item.completed}
                         role="checkbox"
                         aria-label={`Mark task ${item.label} as ${item.completed ? 'incomplete' : 'complete'}`}
                         title={`Mark as ${item.completed ? 'incomplete' : 'complete'}`}
                       >
                        {item.completed ? "✅" : "⬜️"} {/* Task icon */}
                      </button>
                    ) : ( <span aria-hidden="true">📝</span> /* Note icon */ )}
              </div>

              {/* Label or Rename Input */}
              <div className="flex-1 truncate" style={{ minWidth: 0 }}> {/* Allow truncation */}
                    {isRenaming ? (
                      <input
                        type="text"
                        className="w-full bg-white dark:bg-zinc-800 text-black dark:text-white outline-none border border-blue-400 px-1 py-0 text-sm rounded" // Adjusted py
                        value={inlineRenameValue}
                        onChange={(e) => setInlineRenameValue(e.target.value)}
                        onClick={(e) => e.stopPropagation()} // Prevent click propagation from input
                        onBlur={() => { finishInlineRename(); refocusTree(); }} // Finish rename on blur, refocus tree
                        onKeyDown={(e) => { // Finish on Enter, cancel on Escape
                            if (e.key === "Enter") { e.preventDefault(); finishInlineRename(); refocusTree(); }
                            else if (e.key === "Escape") { cancelInlineRename(); refocusTree(); }
                         }}
                        autoFocus // Focus input on render
                        // Select text on focus for easier editing
                        onFocus={(e) => e.target.select()}
                       />
                    ) : (
                        // Apply different style if task is completed
                        <span className={` ${item.type === 'task' && item.completed ? 'line-through text-zinc-500 dark:text-zinc-400' : ''}`}>
                            {item.label}
                        </span>
                    )}
              </div>
            </div> {/* End Item Content Wrapper */}

            {/* Recursive render for children if folder is expanded */}
            {item.type === "folder" && Array.isArray(item.children) && expandedFolders[item.id] &&
              renderItems(item.children, depth + 1)}

          </li> // End List Item
        );
      })}
    </ul>
  ), [ // Dependencies for renderItems callback: Include all props/state/callbacks used within
      items,
      selectedItemId,
      inlineRenameId,
      inlineRenameValue,
      expandedFolders,
      draggedId,
      dragOverId,
      // depth, // depth changes on recursion, not needed as dependency here
      onSelect,
      setInlineRenameValue,
      finishInlineRename,
      cancelInlineRename,
      onToggleExpand,
      onToggleTask,
      onDragStart,
      handleDragOver, // Use the memoized handlers defined above
      handleDragLeave,
      handleItemDrop,
      onDrop, // Keep onDrop if handleItemDrop calls it
      onContextMenu,
      onRename,
      onDragEnd,
      refocusTree // Include memoized refocusTree
  ]);


  // Main Tree Navigation container
  return (
    <nav
        ref={navRef} // Assign ref for focusing
        className="overflow-auto h-full p-1 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded" // Styling and focus outline
        tabIndex={0} // Make the container focusable for keyboard navigation
        onKeyDown={handleKeyDown} // Attach keyboard handler
        onContextMenu={(e) => { // Handle context menu on the empty padding area of the nav
             // Check if the click target is the nav element itself (not one of its children/items)
             if (!draggedId && !inlineRenameId && e.target === navRef.current) {
                  e.preventDefault();
                  onSelect(null); // Deselect any currently selected item
                  onContextMenu(e, null); // Show context menu for empty area
             } else if (draggedId || inlineRenameId) {
                  // Prevent the default browser context menu during drag or rename
                  e.preventDefault();
             }
         }}
        aria-label="Notes and Tasks Tree" // Accessibility label
     >
      {renderItems(items)}
    </nav>
  );
};

export default Tree;