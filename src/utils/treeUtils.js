/**
 * Sorts items: folders first, then notes, then tasks, then alphabetically by label.
 * Ensures the input is an array and returns a new sorted array.
 * @param {Array|undefined|null} items - Array of items to sort.
 * @returns {Array} A new sorted array, or an empty array if input is invalid.
 */
export const sortItems = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }
  return [...items].sort((a, b) => {
    if (a.type === "folder" && b.type !== "folder") return -1;
    if (a.type !== "folder" && b.type === "folder") return 1;
    if (a.type === "note" && b.type === "task") return -1;
    if (a.type === "task" && b.type === "note") return 1;
    return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
  });
};


/**
 * Finds an item by its ID within a nested tree structure recursively.
 * @param {Array} nodes - The array of tree nodes to search within.
 * @param {String} id - The ID of the item to find.
 * @returns {Object|null} The found item object or null if not found.
 */
const findItemById = (nodes, id) => {
    if (!Array.isArray(nodes)) {
        return null;
    }
    for (const item of nodes) {
        if (item.id === id) {
            return item;
        }
        // Make sure to check if children is an array before recursing
        if (Array.isArray(item.children)) {
            const found = findItemById(item.children, id);
            if (found) {
                return found;
            }
        }
    }
    return null;
};


/**
 * Checks if a potential target item (checkId) is the same as or a descendant of a given parent item.
 * @param {Object|null} parentItem - The potential ancestor item object.
 * @param {String} checkId - The ID of the item being checked (the dragged item's ID).
 * @returns {Boolean} True if checkId is the same as or a descendant of parentItem.
 */
const isDescendantOrSelf = (parentItem, checkId) => {
    if (!parentItem) {
        return false;
    }
    if (parentItem.id === checkId) {
        // console.log(`Drop check: Target ancestor ${parentItem.id} is the same as the dragged item ${checkId}`);
        return true;
    }
    if (Array.isArray(parentItem.children) && parentItem.children.length > 0) {
        return parentItem.children.some(child => isDescendantOrSelf(child, checkId));
    }
    return false;
};


/**
 * Handles the core logic for dropping an item onto a target folder in the tree.
 * Performs validation and returns the new tree state if successful, otherwise null.
 * @param {Array} currentTree - The current, complete tree state.
 * @param {String} targetId - The ID of the folder item being dropped onto.
 * @param {String} draggedId - The ID of the item being dragged.
 * @returns {Array|null} The new tree state array if drop is successful, otherwise null.
 */
export const handleDrop = (currentTree, targetId, draggedId) => { // Removed setTreeState param
  // --- 1. Basic Validation ---
  if (!targetId || !draggedId || targetId === draggedId) {
      console.warn("Drop cancelled: Invalid IDs or target is the same as the dragged item.", { targetId, draggedId });
      return null; // Return null on failure
  }

  // --- 2. Find Target and Dragged Item Data ---
  const targetItem = findItemById(currentTree, targetId);
  const draggedItemData = findItemById(currentTree, draggedId); // Find data before removal

  // --- 3. Advanced Validation ---
  if (!targetItem) {
      console.warn(`Drop cancelled: Target item ${targetId} could not be found.`);
      return null; // Target doesn't exist
  }
  if (targetItem.type !== 'folder') {
      console.warn(`Drop cancelled: Target item ${targetId} ('${targetItem.label}') is not a folder.`);
      return null; // Target is not a folder
  }
   if (!draggedItemData) {
      // This case should ideally not happen if draggedId comes from a valid item
      console.error(`Drop cancelled: Dragged item data for ${draggedId} not found.`);
      return null;
  }
  // Prevent dropping a folder into itself or one of its descendants
  if (draggedItemData.type === 'folder' && isDescendantOrSelf(draggedItemData, targetId)) {
      console.warn(`Drop prevented: Cannot drop folder ${draggedId} ('${draggedItemData.label}') into itself or a descendant folder ${targetId} ('${targetItem.label}').`);
      return null; // Invalid drop location
  }

  // --- 4. Validation Passed: Proceed with Tree Modification ---
  console.log(`Drop validated: Preparing to move item ${draggedId} ('${draggedItemData.label}') into folder ${targetId} ('${targetItem.label}')`);
  let draggedItemCopy = null; // Variable to hold the deep copy of the dragged item

  // --- 4a. Remove the dragged item recursively ---
  // This function returns a new array structure without the dragged item.
  const removeItemRecursive = (items) => {
    let itemFoundAndRemoved = false; // Flag for this level/branch
    const newItems = []; // Build the new array for this level
    for (const item of items) {
      if (item.id === draggedId) {
        // Found the item to remove
        try {
            // *** Create and store a DEEP COPY ***
            draggedItemCopy = JSON.parse(JSON.stringify(item));
            console.log("Stored deep copy of dragged item:", draggedItemCopy);
        } catch (error) {
            console.error("Failed to deep copy dragged item:", error, item);
            // Fallback or cancel? For now, fallback to shallow copy.
            draggedItemCopy = { ...item };
        }
        itemFoundAndRemoved = true;
        // Skip adding it to newItems, effectively removing it
      } else {
        // This item is not the one being dragged, keep it.
        const newItem = { ...item }; // Create a shallow copy of the item itself
        // If the item has children, recurse into them
        if (Array.isArray(newItem.children)) {
          const result = removeItemRecursive(newItem.children);
          // If the dragged item was found and removed within the children,
          // update this item's children array with the new one returned.
          if (result.itemFoundAndRemoved) {
            newItem.children = result.newChildren;
            itemFoundAndRemoved = true; // Propagate removal status upwards
          }
        }
        // Add the item (potentially with updated children) to the new array
        newItems.push(newItem);
      }
    }
    // Return the new array for this level and whether removal occurred
    return { newChildren: newItems, itemFoundAndRemoved };
  };

  // Start the removal process from the root of the current tree
  const { newChildren: treeWithoutDraggedItem, itemFoundAndRemoved: removed } = removeItemRecursive(currentTree);

  // Safety check: If removal failed or the copy wasn't created, abort.
  if (!removed || !draggedItemCopy) {
    console.error("Drop failed: Removal did not occur or item copy failed.", { draggedId, removed, hasDraggedItemCopy: !!draggedItemCopy });
    return null; // Return null indicating failure
  }

  // --- 4b. Insert the copied item into the target folder recursively ---
  // This function takes the tree *after* removal and returns a new tree with the item inserted.
  const insertItemRecursive = (items) => {
    // Map over the items at the current level
    return items.map((item) => {
      // Check if the current item is the target folder
      if (item.id === targetId) {
        // It's the target (already validated as a folder)
        console.log(`Inserting item copy ${draggedId} into children of target ${targetId}`);
        // Return a new folder object with the *copied* dragged item added to its children
        return {
          ...item, // Copy properties of the target folder
          // Ensure children is an array, add the deep copy, and sort
          children: sortItems([...(item.children || []), draggedItemCopy]), // Use the deep copy
        };
      }
      // If not the target, but has children, recurse into children
      if (Array.isArray(item.children)) {
        // Return a new item object with potentially modified children
        return { ...item, children: insertItemRecursive(item.children) };
      }
      // Not the target and no children, return the item unchanged
      return item;
    });
  };

  // Start the insertion process using the tree structure from after removal
  const finalTree = insertItemRecursive(treeWithoutDraggedItem);

  // --- 5. Return the final state ---
  console.log("Drop successful, returning final tree structure.");
  return finalTree; // Return the calculated new tree state
};
