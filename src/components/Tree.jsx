// src/components/Tree.jsx
import React, { useRef, useState, useEffect, useCallback } from "react";
// Ensure isSelfOrDescendant is imported
import { sortItems, isSelfOrDescendant } from "../utils/treeUtils";

const INDENT_SIZE = 16; // Pixels for indentation per level

const Tree = ({
  items,
  selectedItemId,
  onSelect,
  inlineRenameId,
  inlineRenameValue,
  setInlineRenameValue,
  onAttemptRename, // Renamed prop
  cancelInlineRename,
  expandedFolders,
  onToggleExpand,
  onToggleTask,
  draggedId,
  onDragStart,
  onDrop,
  onContextMenu,
  onRename, // Handler to INITIATE rename
  onDragEnd,
  uiError,
  setUiError,
}) => {
  const navRef = useRef(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [localRenameError, setLocalRenameError] = useState('');

  // --- Focus Management ---
  const refocusTree = useCallback(() => {
    requestAnimationFrame(() => {
      navRef.current?.focus({ preventScroll: true });
    });
  }, []);

  // --- Clear local rename error when external error changes or rename value changes ---
  useEffect(() => {
      if (inlineRenameId) {
        setLocalRenameError('');
      }
  }, [uiError, inlineRenameId]);

  // --- Keyboard Navigation Helpers (getVisible, findParent) ---
   const getVisible = useCallback((nodes, currentExpandedFolders) => {
      let out = [];
      const currentNodes = Array.isArray(nodes) ? nodes : [];
      sortItems(currentNodes).forEach((it) => {
          out.push(it);
          if (it.type === "folder" && Array.isArray(it.children) && currentExpandedFolders[it.id]) {
              out = out.concat(getVisible(it.children, currentExpandedFolders));
          }
      });
      return out;
   }, []); // sortItems doesn't change, only dependencies are arguments

   const findParent = useCallback((nodes, childId, parent = null) => {
        const currentNodes = Array.isArray(nodes) ? nodes : [];
        for (const it of currentNodes) {
            if (it.id === childId) return parent;
            if (Array.isArray(it.children)) {
                const p = findParent(it.children, childId, it);
                if (p) return p;
            }
        }
        return null;
    }, []); // No dependencies needed

  // --- Keyboard Event Handler ---
  const handleKeyDown = useCallback((e) => {
    const activeElement = document.activeElement;
    const isRenameInputFocused = activeElement?.closest(`li[data-item-id="${inlineRenameId}"] input`);

    if (isRenameInputFocused) {
        if (e.key === "Enter" || e.key === "Escape") {
            // Let input's onKeyDown handle these
        }
        // Allow other typing in the input
        return; // Stop tree navigation if renaming
    }

    const treeNav = navRef.current;
    const isTreeAreaFocused = treeNav && (treeNav === activeElement || treeNav.contains(activeElement) || activeElement === document.body); // Include body focus check
    if (!isTreeAreaFocused && !(activeElement === document.body && selectedItemId)) return; // Only handle if tree area or body has focus (and an item is selected for body focus case)


    const visibleItems = getVisible(items, expandedFolders);
    const currentIndex = visibleItems.findIndex((it) => it.id === selectedItemId);
    const currentItem = currentIndex !== -1 ? visibleItems[currentIndex] : null;

    let nextItemId = null;

    switch (e.key) {
        case "ArrowDown":
            e.preventDefault();
            if (visibleItems.length === 0) break;
            nextItemId = currentIndex < visibleItems.length - 1
                ? visibleItems[currentIndex + 1].id
                : (currentIndex === -1 ? visibleItems[0].id : null); // Select first if none selected, otherwise stay at last
            if (nextItemId) onSelect(nextItemId);
            break;
        case "ArrowUp":
            e.preventDefault();
            if (visibleItems.length === 0) break;
            nextItemId = currentIndex > 0
                ? visibleItems[currentIndex - 1].id
                : (currentIndex === -1 ? visibleItems[0].id : null); // Select first if none selected, otherwise stay at first
             if (nextItemId) onSelect(nextItemId);
            break;
        case "ArrowRight":
             e.preventDefault();
             if (currentItem) {
                 if (currentItem.type === "folder") {
                     if (!expandedFolders[currentItem.id]) {
                         onToggleExpand(currentItem.id, true); // Expand if collapsed
                     } else if (Array.isArray(currentItem.children) && currentItem.children.length > 0) {
                         // If already expanded and has children, select first child
                          const sortedChildren = sortItems(currentItem.children);
                          if (sortedChildren.length > 0) {
                              onSelect(sortedChildren[0].id);
                          }
                     }
                 }
             }
            break;
        case "ArrowLeft":
              e.preventDefault();
              if (currentItem) {
                  if (currentItem.type === "folder" && expandedFolders[currentItem.id]) {
                       onToggleExpand(currentItem.id, false); // Collapse if expanded
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
  }, [items, expandedFolders, selectedItemId, onSelect, onToggleExpand, findParent, getVisible, onToggleTask, inlineRenameId]);


  // --- Drag and Drop Handlers ---
  const handleDragOver = useCallback((e, item) => {
    e.preventDefault();
    e.stopPropagation();
    // Use imported isSelfOrDescendant
    if (item?.type === 'folder' && item.id !== draggedId && !isSelfOrDescendant(items, draggedId, item.id) ) {
        setDragOverId(item.id);
    } else {
        setDragOverId(null);
    }
  }, [draggedId, items]); // Added items dependency

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(null);
  }, []);

  const handleItemDrop = useCallback((e, targetItem) => {
    e.preventDefault();
    e.stopPropagation();
    const currentDragOverId = dragOverId; // Read state before resetting
    setDragOverId(null);

    // Ensure drop target is the one highlighted and meets criteria
    if (targetItem?.id === currentDragOverId && targetItem?.type === 'folder' && targetItem.id !== draggedId) {
        onDrop(targetItem.id); // Call main drop handler passed from App
    } else {
        console.log("Drop occurred on invalid target or conditions not met.");
        // Drag state is cleared by onDragEnd anyway
    }
  }, [dragOverId, draggedId, onDrop]); // Dependencies


  // --- Recursive Rendering Function ---
  const renderItems = useCallback((nodes, depth = 0) => (
    <ul className="list-none p-0 m-0">
      {(Array.isArray(nodes) ? sortItems(nodes) : []).map((item) => {
        const isBeingDragged = item.id === draggedId;
        const isDragOverTarget = item.id === dragOverId;
        const isSelected = item.id === selectedItemId;
        const isRenaming = item.id === inlineRenameId;
        const hasError = isRenaming && (localRenameError || uiError);

        return (
           <li
            key={item.id}
            data-item-id={item.id} // Useful for testing/debugging
            className={`group relative text-sm ${isBeingDragged ? 'opacity-40' : ''}`}
            draggable={!isRenaming} // Prevent dragging while renaming
            onDragStart={(e) => {
                 if (isRenaming) { e.preventDefault(); return; }
                 e.stopPropagation(); // Prevent parent drag handlers
                 onDragStart(e, item.id);
             }}
            onDragOver={(e) => handleDragOver(e, item)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleItemDrop(e, item)}
            onDragEnd={onDragEnd}
          >
            {/* Drag over indicator - ADDED data-testid */}
            {isDragOverTarget && (
               <div
                 data-testid="drag-over-indicator"
                 className="absolute inset-y-0 left-0 right-0 bg-blue-200 dark:bg-blue-800 opacity-30 rounded pointer-events-none z-0"
                 aria-hidden="true"
               ></div>
            )}

            {/* Item Content Wrapper */}
            <div
               className={`relative z-10 flex items-center cursor-pointer rounded py-0.5 pr-1 ${
                 isSelected && !isRenaming // Don't show blue background if renaming this item
                   ? "bg-blue-600 text-white"
                   : "hover:bg-zinc-100 dark:hover:bg-zinc-700"
               } ${isDragOverTarget ? 'bg-blue-100 dark:bg-blue-900 text-zinc-900 dark:text-zinc-100' : ''}`} // Style for drag target
               style={{ paddingLeft: `${depth * INDENT_SIZE}px` }}
               onClick={(e) => {
                   if (isBeingDragged || isRenaming) return; // Prevent select during drag/rename
                   e.stopPropagation();
                   onSelect(item.id);
               }}
               onContextMenu={(e) => {
                  if (draggedId || isRenaming) { e.preventDefault(); return; } // Prevent menu during drag/rename
                  e.preventDefault();
                  e.stopPropagation();
                  onSelect(item.id); // Ensure item is selected before showing menu
                  onContextMenu(e, item);
               }}
                onDoubleClick={(e) => {
                    if (isRenaming) return; // Prevent double-click action if already renaming
                    e.stopPropagation();
                    onRename(item); // Call initiation handler from props
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
                   ) : ( <span className="inline-block w-4" aria-hidden="true"></span> )} {/* Placeholder for alignment */}
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
                    ) : ( <span aria-hidden="true">📝</span> )} {/* Default to note icon */}
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
                             setLocalRenameError(''); // Clear local error first
                             if(setUiError) setUiError(''); // Clear external error via prop
                        }}
                        onClick={(e) => e.stopPropagation()} // Prevent selection change on click inside input
                        onBlur={() => {
                            // Use onAttemptRename which handles validation in App.jsx/useTree
                            if (onAttemptRename) onAttemptRename();
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                 e.preventDefault(); // Prevent form submission if applicable
                                 if (onAttemptRename) onAttemptRename();
                            } else if (e.key === "Escape") {
                                e.preventDefault();
                                cancelInlineRename();
                                refocusTree(); // Refocus tree after cancelling rename
                            }
                         }}
                        autoFocus // Focus input when it appears
                        onFocus={(e) => e.target.select()} // Select text on focus
                        aria-invalid={!!hasError}
                        aria-describedby={hasError ? `${item.id}-rename-error` : undefined}
                       />
                       {/* Display Error Message Below Input */}
                       {hasError && (
                       <span id={`${item.id}-rename-error`} className="absolute left-1 top-full mt-0.5 text-xs text-red-600 dark:text-red-400 whitespace-normal z-10">
                               {localRenameError || uiError}
                           </span>
                       )}
                      </>
                    ) : (
                        // Display item label, apply strikethrough if task is completed
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
  ), [
      // Include all state and props used within the callback and its nested functions
      items, selectedItemId, inlineRenameId, inlineRenameValue, expandedFolders,
      draggedId, dragOverId, onSelect, setInlineRenameValue, onAttemptRename,
      cancelInlineRename, onToggleExpand, onToggleTask, onDragStart, handleDragOver,
      handleDragLeave, handleItemDrop, onDrop, onContextMenu, onRename, onDragEnd,
      refocusTree, uiError, setUiError, localRenameError,
      // Also include dependencies of callbacks used inside, like handleDragOver's deps
      handleItemDrop, // Ensure handlers used inside are listed if they have dependencies
  ]);

  // Main Tree Navigation container
  return (
    <nav
        ref={navRef}
        className="overflow-auto h-full p-1 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded"
        tabIndex={0} // Make focusable for keyboard navigation
        onKeyDown={handleKeyDown} // Use unified handler
        onContextMenu={(e) => {
             // Context menu on empty area (when clicking directly on the nav element)
             if (!draggedId && !inlineRenameId && e.target === navRef.current) {
                  e.preventDefault();
                  onSelect(null); // Deselect any selected item
                  onContextMenu(e, null); // Show empty area menu
             } else if (draggedId || inlineRenameId) {
                e.preventDefault(); // Prevent browser default menu during drag/rename
             }
             // Allow context menu event to bubble up from items (handled by item's onContextMenu)
         }}
        aria-label="Notes and Tasks Tree"
     >
      {renderItems(items)}
    </nav>
  );
};

export default Tree;