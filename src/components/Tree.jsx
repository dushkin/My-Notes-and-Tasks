// src/components/Tree.jsx
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
  // finishInlineRename, // Replaced by onAttemptRename
  onAttemptRename, // New prop: Called when user tries to commit rename (Enter/Blur)
  cancelInlineRename,
  expandedFolders,
  onToggleExpand,
  onToggleTask,
  draggedId,
  onDragStart,
  onDrop,
  onContextMenu,
  onRename, // Handler to INITIATE rename (e.g., F2, double-click)
  onDragEnd,
  uiError, // New prop for displaying external errors (e.g., duplicate name)
  setUiError, // New prop to allow clearing the error on input change
}) => {
  const navRef = useRef(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [localRenameError, setLocalRenameError] = useState(''); // Error specific to inline rename

  // --- Focus Management ---
  const refocusTree = useCallback(() => {
    requestAnimationFrame(() => {
      navRef.current?.focus({ preventScroll: true });
    });
  }, []);

  // --- Clear local rename error when external error changes or rename value changes ---
  useEffect(() => {
      if (inlineRenameId) { // Only clear if we are actually renaming
        setLocalRenameError(''); // Clear local error if external error appears/changes
        // We also clear it onChange below
      }
  }, [uiError, inlineRenameId]);


  // --- Keyboard Navigation Helpers (getVisible, findParent) ---
  // ... (getVisible and findParent remain the same) [229-232]
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
   }, []); // sortItems is implicitly used

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
    }, []);


  // --- Keyboard Event Handler ---
  const handleKeyDown = useCallback((e) => {
    const activeElement = document.activeElement;
    // Check if the event target is the inline rename input specifically
    const isRenameInputFocused = activeElement?.closest(`li[data-item-id="${inlineRenameId}"] input`);

    if (isRenameInputFocused) {
        // Let Enter/Escape be handled by the input's onKeyDown directly
        if (e.key === "Enter" || e.key === "Escape") {
           // Input handler will call preventDefault if needed
        } else {
           // Allow typing in the input
        }
        return; // Stop processing tree navigation keys if rename input is focused
    }


      // Get the flat list of currently visible items
      const visibleItems = getVisible(items, expandedFolders);
      // Find the index of the currently selected item in the visible list
      const currentIndex = visibleItems.findIndex((it) => it.id === selectedItemId);
       const currentItem = currentIndex !== -1 ? visibleItems[currentIndex] : null;

      switch (e.key) {
          case "ArrowDown":
              e.preventDefault();
              if (currentIndex < visibleItems.length - 1) {
                  onSelect(visibleItems[currentIndex + 1].id);
              } else if (currentIndex === -1 && visibleItems.length > 0) {
                  onSelect(visibleItems[0].id);
              }
              break;
          case "ArrowUp":
              e.preventDefault();
              if (currentIndex > 0) {
                  onSelect(visibleItems[currentIndex - 1].id);
              }
              break;
          case "ArrowRight":
               e.preventDefault();
               if (currentItem && currentItem.type === "folder" && !expandedFolders[currentItem.id]) {
                   onToggleExpand(currentItem.id, true); // Force expand
               }
              break;
          case "ArrowLeft":
                e.preventDefault();
                if (currentItem) {
                    if (currentItem.type === "folder" && expandedFolders[currentItem.id]) {
                         onToggleExpand(currentItem.id, false); // Force collapse
                    } else {
                         const parent = findParent(items, currentItem.id);
                         if (parent) {
                            onSelect(parent.id); // Select the parent
                         }
                    }
                }
              break;
          case " ": // Spacebar
              e.preventDefault();
              if (currentItem && currentItem.type === "task") {
                  onToggleTask(currentItem.id, !currentItem.completed);
              }
              break;
           // F2 handled globally in App.jsx
          default:
              break;
      }
  }, [items, expandedFolders, selectedItemId, onSelect, onToggleExpand, findParent, getVisible, onToggleTask, inlineRenameId]); // Added inlineRenameId


  // --- Drag and Drop Handlers (Internal for visual feedback) ---
  const handleDragOver = useCallback((e, item) => {
    e.preventDefault();
    e.stopPropagation();
    // Allow drop only on folders that are not the dragged item itself or its descendants
     if (item?.type === 'folder' && item.id !== draggedId && !isSelfOrDescendant(items, draggedId, item.id) ) {
        setDragOverId(item.id);
    } else {
        setDragOverId(null); // Don't highlight invalid targets
    }
  }, [draggedId, items]); // Added items dependency for isSelfOrDescendant

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(null);
  }, []);

  // Handles the actual drop event *on* a list item
  const handleItemDrop = useCallback((e, targetItem) => {
    e.preventDefault();
    e.stopPropagation();
    const currentDragOverId = dragOverId;
    setDragOverId(null); // Reset visual indicator immediately

    // Validate drop target (must be the folder we were hovering over)
    if (targetItem?.id === currentDragOverId && targetItem?.type === 'folder' && targetItem.id !== draggedId) {
        onDrop(targetItem.id); // Call the main drop handler passed from App
    } else {
        console.log("Drop occurred on invalid target or conditions not met.");
        // Drag state (draggedId) will be cleared by onDragEnd anyway
    }
  }, [dragOverId, draggedId, onDrop]);


  // --- Recursive Rendering Function ---
  const renderItems = useCallback((nodes, depth = 0) => (
    <ul className="list-none p-0 m-0">
      {(Array.isArray(nodes) ? sortItems(nodes) : []).map((item) => {
        const isBeingDragged = item.id === draggedId;
        const isDragOverTarget = item.id === dragOverId;
        const isSelected = item.id === selectedItemId;
        const isRenaming = item.id === inlineRenameId;
        const hasError = isRenaming && (localRenameError || uiError); // Check both local and external errors

        return (
           <li
            key={item.id}
            data-item-id={item.id} // Add data attribute for easier focus targeting
            className={`group relative text-sm ${isBeingDragged ? 'opacity-40' : ''}`}
            draggable={!isRenaming}
            onDragStart={(e) => {
                 if (isRenaming) { e.preventDefault(); return; }
                 e.stopPropagation();
                 onDragStart(e, item.id);
            }}
            onDragOver={(e) => handleDragOver(e, item)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleItemDrop(e, item)}
            onDragEnd={onDragEnd}
          >
            {/* Drag over indicator */}
            {isDragOverTarget && (
                <div className="absolute inset-y-0 left-0 right-0 bg-blue-200 dark:bg-blue-800 opacity-30 rounded pointer-events-none z-0" aria-hidden="true"></div>
            )}

            {/* Item Content Wrapper */}
            <div
               className={`relative z-10 flex items-center cursor-pointer rounded py-0.5 pr-1 ${
                 isSelected && !isRenaming // Don't show blue background if renaming this item
                   ? "bg-blue-600 text-white"
                   : "hover:bg-zinc-100 dark:hover:bg-zinc-700"
               } ${isDragOverTarget ? 'bg-blue-100 dark:bg-blue-900 text-zinc-900 dark:text-zinc-100' : ''}`}
               style={{ paddingLeft: `${depth * INDENT_SIZE}px` }}
               onClick={(e) => {
                   if (isBeingDragged || isRenaming) return;
                   e.stopPropagation();
                   onSelect(item.id);
               }}
               onContextMenu={(e) => {
                  if (isBeingDragged || isRenaming) { e.preventDefault(); return; }
                  e.preventDefault();
                  e.stopPropagation();
                  onSelect(item.id); // Ensure item is selected
                  onContextMenu(e, item);
               }}
                onDoubleClick={(e) => {
                    if (isRenaming) return;
                    e.stopPropagation();
                    // Trigger rename via onRename (passed from App)
                    onRename(item);
                }}
            >
              {/* Expand/Collapse Button */}
              <div className="w-4 h-5 flex-shrink-0 flex items-center justify-center mr-1">
                  {item.type === "folder" ? (
                     <button
                       onClick={(e) => { e.stopPropagation(); onToggleExpand(item.id); }}
                       className={`flex items-center justify-center h-full w-full focus:outline-none text-xs rounded-sm ${isSelected && !isRenaming ? 'text-white' : 'text-zinc-500 dark:text-zinc-400'} hover:bg-black/10 dark:hover:bg-white/10`}
                       aria-expanded={!!expandedFolders[item.id]}
                       aria-label={expandedFolders[item.id] ? `Collapse ${item.label}` : `Expand ${item.label}`}
                       title={expandedFolders[item.id] ? `Collapse` : `Expand`}
                      >
                        {expandedFolders[item.id] ? "▾" : "▸"}
                     </button>
                   ) : ( <span className="inline-block w-4" aria-hidden="true"></span> )}
              </div>

              {/* Item Icon */}
              <div className="mr-1 flex-shrink-0 flex items-center">
                  {item.type === "folder" ? (
                      <span className={`${!item.children || item.children.length === 0 ? "opacity-50" : ""}`} aria-hidden="true">
                         {expandedFolders[item.id] ? "📂" : "📁"}
                      </span>
                    ) : item.type === "task" ? (
                      <button
                         onClick={(e) => { e.stopPropagation(); onToggleTask(item.id, !item.completed); }}
                         className="focus:outline-none flex items-center cursor-pointer"
                         aria-checked={!!item.completed}
                         role="checkbox"
                         aria-label={`Mark task ${item.label} as ${item.completed ? 'incomplete' : 'complete'}`}
                         title={`Mark as ${item.completed ? 'incomplete' : 'complete'}`}
                       >
                        {item.completed ? "✅" : "⬜️"}
                      </button>
                    ) : ( <span aria-hidden="true">📝</span> )}
              </div>

              {/* Label or Rename Input */}
              <div className="flex-1 truncate relative" style={{ minWidth: 0 }}>
                  {isRenaming ? (
                      <>
                      <input
                        type="text"
                        className={`w-full bg-white dark:bg-zinc-800 outline-none border px-1 py-0 text-sm rounded ${
                            hasError ? 'border-red-500 text-red-700 dark:text-red-400' : 'border-blue-400 text-black dark:text-white'
                        }`}
                        value={inlineRenameValue}
                        onChange={(e) => {
                             setInlineRenameValue(e.target.value);
                             // Clear errors on change
                             setLocalRenameError('');
                             if(setUiError) setUiError(''); // Clear external error too
                        }}
                        onClick={(e) => e.stopPropagation()} // Prevent selection change
                        onBlur={() => {
                            // Use onAttemptRename which handles validation in App.jsx
                            if (onAttemptRename) onAttemptRename();
                             // Refocus tree needed regardless of success/fail unless Esc was pressed
                             // refocusTree(); // Moved after attempt if needed
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                if (onAttemptRename) onAttemptRename();
                                // Refocus might happen in App after rename attempt
                            } else if (e.key === "Escape") {
                                e.preventDefault();
                                cancelInlineRename();
                                refocusTree(); // Definitely refocus on cancel
                            }
                         }}
                        autoFocus
                        onFocus={(e) => e.target.select()}
                        aria-invalid={!!hasError}
                        aria-describedby={hasError ? `${item.id}-rename-error` : undefined}
                       />
                       {/* Display Error Message Below Input */}
                       {hasError && (
                           <span id={`${item.id}-rename-error`} className="absolute left-1 top-full mt-0.5 text-xs text-red-600 dark:text-red-400 whitespace-normal">
                               {localRenameError || uiError}
                           </span>
                       )}
                       </>
                    ) : (
                        <span className={` ${item.type === 'task' && item.completed ? 'line-through text-zinc-500 dark:text-zinc-400' : ''}`}>
                            {item.label}
                        </span>
                    )}
              </div>
            </div> {/* End Item Content Wrapper */}

            {/* Recursive render for children */}
            {item.type === "folder" && Array.isArray(item.children) && expandedFolders[item.id] &&
              renderItems(item.children, depth + 1)}

          </li> // End List Item
        );
      })}
    </ul>
  ), [
      items, selectedItemId, inlineRenameId, inlineRenameValue, expandedFolders,
      draggedId, dragOverId, onSelect, setInlineRenameValue, onAttemptRename,
      cancelInlineRename, onToggleExpand, onToggleTask, onDragStart, handleDragOver,
      handleDragLeave, handleItemDrop, onDrop, onContextMenu, onRename, onDragEnd,
      refocusTree, uiError, setUiError, localRenameError // Include error states
  ]);

  // Main Tree Navigation container
  return (
    <nav
        ref={navRef}
        className="overflow-auto h-full p-1 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded"
        tabIndex={0} // Make focusable
        onKeyDown={handleKeyDown} // Use unified handler
        onContextMenu={(e) => {
             // Context menu on empty area
             if (!draggedId && !inlineRenameId && e.target === navRef.current) {
                  e.preventDefault();
                  onSelect(null); // Deselect
                  onContextMenu(e, null); // Show empty area menu
             } else if (draggedId || inlineRenameId) {
                  e.preventDefault(); // Prevent browser menu during drag/rename
             }
             // Allow context menu on items (handled by item's onContextMenu)
         }}
        aria-label="Notes and Tasks Tree"
     >
      {renderItems(items)}
    </nav>
  );
};

export default Tree;