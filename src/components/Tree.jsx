// src/components/Tree.jsx
import React, { useRef } from "react";
import { sortItems } from "../utils/treeUtils"; // Utility for sorting items

// Define the indentation size for nested items
const INDENT_SIZE = 16; // Indentation size in pixels

/**
 * Tree component renders the hierarchical file/folder structure.
 * Handles item selection, expansion, drag & drop, context menu, and inline renaming.
 */
const Tree = ({
  items, // Array of root items in the tree
  selectedItemId, // ID of the currently selected item
  inlineRenameId, // ID of the item being renamed inline
  inlineRenameValue, // Current value of the inline rename input
  setInlineRenameValue, // Function to update the inline rename value
  finishInlineRename, // Function to finalize the rename operation
  cancelInlineRename, // Function to cancel the inline rename operation
  expandedFolders, // Object tracking expanded folder IDs ( { folderId: true } )
  onToggleExpand, // Function to toggle folder expansion state
  onSelect, // Function to handle item selection
  onToggleTask, // Function to toggle the completed state of a task
  onDragStart, // Function to handle the start of a drag operation
  onDrop, // Function to handle the drop operation
  onContextMenu, // Function to handle right-click context menu requests
  onRename, // Function to initiate the inline rename mode for an item
}) => {
  // Ref for the main navigation container to manage focus
  const navRef = useRef(null);

  /**
   * Flattens the tree structure into a list of visible items based on expanded folders.
   * Used for keyboard navigation (up/down arrows).
   * @param {Array} nodes - The array of tree nodes to flatten.
   * @returns {Array} A flat array of visible items.
   */
  const getVisible = (nodes) => {
    let out = [];
    // Sort items at the current level before processing
    sortItems(nodes).forEach((it) => {
      out.push(it); // Add the item itself
      // If it's an expanded folder, recursively add its children
      if (it.type === "folder" && it.children && expandedFolders[it.id]) {
        out = out.concat(getVisible(it.children));
      }
    });
    return out;
  };

  /**
   * Finds the parent of a given item ID in the tree structure.
   * Used for ArrowLeft keyboard navigation (collapse folder or move to parent).
   * @param {Array} nodes - The array of tree nodes to search within.
   * @param {String} childId - The ID of the item whose parent is needed.
   * @param {Object|null} parent - The potential parent node during recursion.
   * @returns {Object|null} The parent node object or null if not found or it's a root item.
   */
  const findParent = (nodes, childId, parent = null) => {
    for (const it of nodes) {
      if (it.id === childId) return parent; // Found the item, return its parent
      // If the item has children, search recursively within them
      if (it.children) {
        const p = findParent(it.children, childId, it); // Pass current item as parent
        if (p) return p; // If found in children, return the result
      }
    }
    return null; // Not found in this branch
  };

  /**
   * Handles keyboard navigation (Arrow keys, Space, F2) within the tree.
   * @param {Event} e - The keyboard event object.
   */
  const handleKeyDown = (e) => {
    // Ignore keydown events if focus is inside the inline rename input
    if (e.target.tagName === "INPUT") return;

    const visible = getVisible(items); // Get the flat list of currently visible items
    const idx = visible.findIndex((it) => it.id === selectedItemId); // Find index of selected item

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault(); // Prevent page scrolling
        if (idx < visible.length - 1) { // If not the last item
          onSelect(visible[idx + 1]); // Select the next item
        } else if (idx === -1 && visible.length > 0) { // If nothing selected, select first
          onSelect(visible[0]);
        }
        break;
      case "ArrowUp":
        e.preventDefault(); // Prevent page scrolling
        if (idx > 0) { // If not the first item
          onSelect(visible[idx - 1]); // Select the previous item
        }
        break;
      case "ArrowRight":
        e.preventDefault();
        const curR = idx !== -1 ? visible[idx] : null; // Get the current item
        // If it's a collapsed folder, expand it
        if (curR && curR.type === "folder" && !expandedFolders[curR.id]) {
          onToggleExpand(curR.id, true); // Force expand
        }
        // Potentially move to the first child in the future, or just next sibling for now
        // else if (curR && idx < visible.length - 1) {
        //   onSelect(visible[idx + 1]); // Move to next visible item (could be child or sibling)
        // }
        break;
      case "ArrowLeft":
        e.preventDefault();
        const curL = idx !== -1 ? visible[idx] : null; // Get the current item
        // If it's an expanded folder, collapse it
        if (curL && curL.type === "folder" && expandedFolders[curL.id]) {
          onToggleExpand(curL.id, false); // Force collapse
        } else if (curL) { // If it's not an expanded folder (or not a folder)
          const parent = findParent(items, curL.id); // Find its parent
          if (parent) {
            onSelect(parent); // Select the parent item
          }
        }
        break;
      case " ": // Handle Space key (often used for toggling)
      case "Spacebar": // Handle older browser key value
        e.preventDefault();
        if (idx === -1) return; // Ignore if nothing selected
        const cur = visible[idx];
        // If the selected item is a task, toggle its completion state
        if (cur.type === "task") {
          onToggleTask(cur.id, !cur.completed);
        }
        break;
      case "F2": // Handle F2 key for renaming
        e.preventDefault();
        if (idx === -1) return; // Ignore if nothing selected
        const renItem = visible[idx];
        onRename(renItem.id); // Trigger the rename action for the selected item
        break;
      default:
        break; // Do nothing for other keys
    }
  };

  /**
   * Recursively renders the tree items.
   * @param {Array} nodes - The array of nodes to render at the current level.
   * @param {number} depth - The current nesting depth for indentation.
   * @returns {JSX.Element} The rendered list of items.
   */
  const renderItems = (nodes, depth = 0) => (
    <ul className="list-none p-0 m-0"> {/* Basic list styling reset */}
      {sortItems(nodes).map((item) => ( // Sort items before mapping
        <li
          key={item.id} // Unique key for React
          className="py-0.5 group" // Minimal vertical padding, group for potential hover effects
          draggable // Enable dragging for this item
          onDragStart={(e) => onDragStart(e, item.id)} // Handle drag start
          onDrop={(e) => onDrop(e, item.id)} // Handle drop onto this item
          onDragOver={(e) => e.preventDefault()} // Necessary to allow dropping
        >
          {/* This div represents the main interactive row for the item */}
          <div
             className={`flex items-center cursor-pointer rounded ${ // Flex layout, pointer cursor, rounded corners
               item.id === selectedItemId
                 ? "bg-blue-600 text-white" // Selected item style
                 : "hover:bg-gray-100 dark:hover:bg-zinc-700" // Hover style for non-selected items
             }`}
             // Apply indentation using padding-left based on depth
             style={{ paddingLeft: `${depth * INDENT_SIZE}px` }}
             // Select item when the row (excluding specific buttons) is clicked
             onClick={(e) => {
                 e.stopPropagation(); // Prevent event bubbling
                 onSelect(item); // Call the selection handler
             }}
             // Show context menu on right-click
             onContextMenu={(e) => {
                e.preventDefault(); // Prevent default browser context menu
                e.stopPropagation();
                onContextMenu(e, item); // Call the context menu handler
             }}
          >
            {/* --- 1. Expand/Collapse Arrow Area --- */}
            <div className="w-4 h-5 flex-shrink-0 flex items-center justify-center"> {/* Fixed width container for alignment */}
              {item.type === "folder" ? (
                // Button to toggle folder expansion
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent selection when clicking arrow
                    onToggleExpand(item.id); // Call the toggle handler
                  }}
                  className="flex items-center justify-center h-full w-full focus:outline-none text-xs" // Style the button
                  aria-expanded={!!expandedFolders[item.id]} // Accessibility attribute
                  aria-label={expandedFolders[item.id] ? `Collapse ${item.label}` : `Expand ${item.label}`} // Accessibility label
                >
                  {/* Arrow icon changes based on expansion state */}
                  {expandedFolders[item.id] ? "▾" : "▸"}
                </button>
              ) : (
                 // Non-folders get an empty spacer to maintain alignment
                 <span className="inline-block w-4"></span>
              )}
            </div>

            {/* --- 2. Icon Area --- */}
            <div className="mx-1 flex-shrink-0 flex items-center"> {/* Container for the item type icon */}
              {item.type === "folder" ? (
                // Folder icon - appearance might depend on expansion or emptiness
                <span className={`${!item.children || item.children.length === 0 ? "opacity-50" : ""}`}> {/* Dim empty folders */}
                   {expandedFolders[item.id] ? "📂" : "📁"} {/* Open/Closed folder icon */}
                </span>
              ) : item.type === "task" ? (
                // Task checkbox - acts as a button
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent selection when clicking checkbox
                    onToggleTask(item.id, !item.completed); // Call toggle task handler
                  }}
                  className="focus:outline-none flex items-center" // Style the button
                  aria-checked={!!item.completed} // Accessibility attribute
                  role="checkbox" // Accessibility role
                  aria-label={`Mark task ${item.label} as ${item.completed ? 'incomplete' : 'complete'}`} // Accessibility label
                >
                  {item.completed ? "✅" : "⬜️"} {/* Checked/Unchecked icon */}
                </button>
              ) : (
                // Default icon for other types (e.g., notes)
                <span>📝</span> /* Note Icon */
              )}
            </div>

            {/* --- 3. Label or Rename Input Area --- */}
            <div className="flex-1 truncate pr-1"> {/* Takes remaining space, truncates long text */}
              {item.id === inlineRenameId ? (
                // Display input field when inline renaming is active
                <input
                  type="text"
                  className="w-full bg-white dark:bg-zinc-800 text-black dark:text-white outline-none border border-blue-400 px-1 text-sm" // Input field styling
                  value={inlineRenameValue}
                  onChange={(e) => setInlineRenameValue(e.target.value)} // Update state on change
                  onClick={(e) => e.stopPropagation()} // Prevent selection when clicking input itself
                  // Finish or cancel rename on blur/Enter/Escape
                  onBlur={() => {
                    finishInlineRename(); // Finish on blur
                    // Optionally refocus the tree for keyboard nav
                    // navRef.current?.focus({ preventScroll: true });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                       e.preventDefault(); // Prevent form submission if wrapped
                       finishInlineRename(); // Finish on Enter
                       // navRef.current?.focus({ preventScroll: true });
                    } else if (e.key === "Escape") {
                       cancelInlineRename(); // Cancel on Escape
                       // navRef.current?.focus({ preventScroll: true });
                    }
                  }}
                  autoFocus // Automatically focus the input when it appears
                />
              ) : (
                 // Display the item label normally
                 <span className="text-sm">{item.label}</span> // Ensure consistent text size
              )}
            </div>
          </div> {/* End of the main interactive row div */}

          {/* --- 4. Recursive Rendering for Children --- */}
          {/* If the item is a folder, has children, and is expanded, render its children */}
          {item.type === "folder" &&
            item.children &&
            expandedFolders[item.id] &&
            renderItems(item.children, depth + 1)} {/* Increase depth for indentation */}
        </li> // End of the list item
      ))}
    </ul> // End of the list
  );

  // --- Component Return ---
  return (
    // The main navigation container for the tree
    <nav
      ref={navRef} // Assign the ref
      className="overflow-auto h-full p-1 text-zinc-900 dark:text-zinc-100" // Allow scrolling, fill height, add padding, set text color
      tabIndex={0} // Make the nav element focusable for keyboard navigation
      onKeyDown={handleKeyDown} // Attach the keyboard handler
      // Handle context menu clicks in the empty area of the tree
      onContextMenu={(e) => {
        // Check if the click was directly on the nav element (not on an item)
        if (e.target === navRef.current) {
            e.preventDefault();
            onContextMenu(e, null); // Pass null item to indicate empty area context
        }
        // If the click was on padding or an item, the item's context handler will catch it
      }}
      aria-label="Notes and Tasks Tree" // Accessibility label for the tree navigation
    >
      {/* Start rendering the tree from the root items */}
      {renderItems(items)}
    </nav>
  );
};

export default Tree; // Export the component
