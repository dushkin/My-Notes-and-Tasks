// src/utils/treeUtils.js

/**
 * Sorts items: folders first, then notes, then tasks, then alphabetically by label.
 * Returns a new sorted array (the original array is not mutated).
 */
export const sortItems = (items) => {
  if (!Array.isArray(items)) return []; // Return empty array if input is not an array
  // Create a shallow copy before sorting to avoid mutating the original array
  return [...items].sort((a, b) => {
    // Basic type checks to prevent errors if items lack 'type' or 'label'
    const typeA = a?.type ?? '';
    const typeB = b?.type ?? '';
    const labelA = a?.label ?? '';
    const labelB = b?.label ?? '';

    // Sort folders before notes/tasks
    if (typeA === "folder" && typeB !== "folder") return -1;
    if (typeA !== "folder" && typeB === "folder") return 1;

    // Sort notes before tasks (if types are not folders)
    if (typeA === "note" && typeB === "task") return -1;
    if (typeA === "task" && typeB === "note") return 1;

    // If types are the same (or both not folder/note/task), sort by label (case-insensitive)
    return labelA.localeCompare(labelB, undefined, { sensitivity: "base" });
  });
};

/**
 * Recursively deletes an item (by id) from a tree structure.
 * Returns a new tree array.
 */
export const deleteItemRecursive = (items, idToDelete) => {
  // Ensure working with an array, return empty if input is invalid
  const baseItems = Array.isArray(items) ? items : [];
  if (!idToDelete) return baseItems; // Return original array if no ID provided

  // Filter out the item at the current level
  return baseItems
    .filter((it) => it.id !== idToDelete)
    .map((it) => {
      // If the item is a folder and has children, recursively process its children
      if (it.type === "folder" && Array.isArray(it.children)) {
        const updatedChildren = deleteItemRecursive(it.children, idToDelete);
        // Only return a new object if children array actually changed
        return updatedChildren !== it.children ? { ...it, children: updatedChildren } : it;
      }
      // Return the item as is if it's not the one to delete or has no children to process
      return it;
    });
};

/**
 * Recursively finds an item by its id.
 * Returns the item object or null if not found.
 */
export const findItemById = (nodes, id) => {
  // Basic validation
  if (!Array.isArray(nodes) || !id) return null;

  for (const item of nodes) {
    // Check if the current item is the one we're looking for
    if (item.id === id) return item;

    // If the item is a folder and has children, search recursively within its children
    if (item.type === "folder" && Array.isArray(item.children)) {
      const found = findItemById(item.children, id);
      // If found in children, return the result immediately
      if (found) return found;
    }
  }
  // Item not found in the current level or its descendants
  return null;
};


/**
 * Finds the parent object and the siblings array of an item identified by itemId.
 * Returns an object { parent: object | null, siblings: array }.
 * If itemId is null (meaning root), parent is null and siblings is the root array.
 * If itemId is not found, returns { parent: null, siblings: [] }.
 */
export const findParentAndSiblings = (tree, itemId) => {
  // Ensure the input tree is an array
  if (!Array.isArray(tree)) {
    console.error("findParentAndSiblings: Input 'tree' is not an array.");
    return { parent: null, siblings: [] };
  }

  // Handle the case where we want the context for the root level
  if (itemId === null) {
    return { parent: null, siblings: tree };
  }

  // Recursive helper function to search the tree
  const findRecursive = (nodes, idToFind, currentParent = null) => {
    // Ensure nodes is an array before iterating
    if (!Array.isArray(nodes)) return null;

    for (let i = 0; i < nodes.length; i++) {
      const item = nodes[i];
      // Check if the current item is the one we are looking for
      if (item.id === idToFind) {
        // Found the item. Return its parent and the array containing the item (siblings).
        return { parent: currentParent, siblings: nodes };
      }
      // If the item is a folder and has children, recurse into the children
      if (item.type === "folder" && Array.isArray(item.children) && item.children.length > 0) {
        // Pass the current item as the parent for the next level of recursion
        const foundInChildren = findRecursive(item.children, idToFind, item);
        // If found in the recursive call, return the result immediately
        if (foundInChildren) return foundInChildren;
      }
    }
    // Item not found in this branch of the tree
    return null;
  };

  // Start the recursive search from the root of the tree
  const result = findRecursive(tree, itemId, null);

  if (result) {
    // Item was found, return the result { parent, siblings }
    return result;
  } else {
    // Item not found anywhere in the tree
    console.warn(`findParentAndSiblings: Could not find item with id ${itemId}`);
    // Return a default object indicating not found
    return { parent: null, siblings: [] };
  }
};

/**
 * Recursively renames an item in the tree. (Internal logic).
 * Returns a new tree array with the item renamed.
 */
export const renameItemRecursive = (items, idToRename, newLabel) => {
  const baseItems = Array.isArray(items) ? items : [];
  const trimmedLabel = newLabel.trim(); // Ensure label is trimmed

  return baseItems.map((it) => {
    // If this is the item to rename, return a new object with the updated label
    if (it.id === idToRename) {
      return { ...it, label: trimmedLabel };
    }
    // If the item has children, recursively attempt to rename within the children
    if (Array.isArray(it.children)) {
      const updatedChildren = renameItemRecursive(it.children, idToRename, trimmedLabel);
      // Only create a new parent object if the children array actually changed
      return updatedChildren !== it.children ? { ...it, children: updatedChildren } : it;
    }
    // If not the item and has no children (or not a folder), return the item unchanged
    return it;
  });
};

/**
 * Recursively inserts an item into the tree structure.
 * If targetFolderId is null, the item is added to the root.
 * Ensures the children list of the target folder remains sorted.
 * Returns a new tree array.
 */
export const insertItemRecursive = (nodes, targetFolderId, itemToInsert) => {
  const baseNodes = Array.isArray(nodes) ? nodes : [];

  // Case 1: Add to root
  if (targetFolderId === null) {
    // Add the new item and sort the root level
    return sortItems([...baseNodes, itemToInsert]);
  }

  // Case 2: Add to a specific folder
  return baseNodes.map((node) => {
    // If this node is the target folder
    if (node.id === targetFolderId && node.type === "folder") {
      const currentChildren = Array.isArray(node.children) ? node.children : [];
      // Return a new folder object with the new item added and children sorted
      return {
        ...node,
        children: sortItems([...currentChildren, itemToInsert]),
      };
    }
    // If the node has children, recurse into them
    else if (Array.isArray(node.children)) {
      const updatedChildren = insertItemRecursive(node.children, targetFolderId, itemToInsert);
      // Only create a new node object if its children actually changed
      return updatedChildren !== node.children ? { ...node, children: updatedChildren } : node;
    }
    // If not the target and no children to recurse into, return the node unchanged
    return node;
  });
};

/**
 * Checks if a name conflicts with existing siblings (case-insensitive comparison).
 * excludeId is used during rename to avoid comparing an item with itself.
 */
export const hasSiblingWithName = (siblings, nameToCheck, excludeId = null) => {
  // Basic validation: ensure siblings is an array and nameToCheck is provided
  if (!Array.isArray(siblings) || !nameToCheck) return false;

  // Normalize the name to check (trim whitespace, convert to lowercase)
  const normalizedName = nameToCheck.trim().toLowerCase();
  // If the normalized name is empty, it cannot conflict
  if (!normalizedName) return false;

  // Check if 'some' sibling matches the criteria
  return siblings.some(sibling =>
    sibling &&                                  // Ensure sibling exists
    sibling.id !== excludeId &&                 // Don't compare item with itself if excludeId is given
    sibling.label &&                            // Ensure sibling has a label
    sibling.label.trim().toLowerCase() === normalizedName // Perform case-insensitive comparison
  );
};

/**
 * Checks if 'checkItemId' is the same as or an ancestor of 'potentialTargetId'.
 * Used to prevent dropping/pasting a folder into itself or its descendants.
 */
export const isSelfOrDescendant = (nodes, checkItemId, potentialTargetId) => {
  // Basic validation: requires both IDs
  if (!checkItemId || !potentialTargetId) return false;
  // An item is its own ancestor in this context
  if (checkItemId === potentialTargetId) return true;

  // Find the item that might be the ancestor
  const item = findItemById(nodes, checkItemId);
  // If the item isn't found, or it's not a folder, it can't be an ancestor
  if (!item || item.type !== "folder" || !Array.isArray(item.children)) return false;

  // Recursive helper to check children
  const checkChildren = (children) => {
    if (!Array.isArray(children)) return false;
    for (const child of children) {
      // If a child matches the target ID, then the target is a descendant
      if (child.id === potentialTargetId) return true;
      // If the child is a folder, recursively check its children
      if (child.type === "folder" && Array.isArray(child.children)) {
        if (checkChildren(child.children)) return true; // Found in sub-branch
      }
    }
    // Target not found in this branch
    return false;
  };

  // Start the check from the children of the potential ancestor item
  return checkChildren(item.children);
};

/**
 * Handles the drop operation validation and data preparation for drag-and-drop.
 * Returns a new tree structure if drop is valid, otherwise null.
 * Includes validation for target type, ancestor dropping, and name conflicts.
 */
export const handleDrop = (currentTree, targetId, draggedId) => {
  // --- Basic Validation ---
  if (!targetId || !draggedId || targetId === draggedId) {
    console.warn("Drop cancelled: Invalid IDs or target is the same as the dragged item.", { targetId, draggedId });
    return null;
  }

  // --- Find Items ---
  const targetItem = findItemById(currentTree, targetId);
  const draggedItemData = findItemById(currentTree, draggedId);

  // --- Target Validation ---
  if (!targetItem) {
    console.warn(`Drop cancelled: Target item ${targetId} could not be found.`);
    return null;
  }
  if (targetItem.type !== "folder") {
    console.warn(`Drop cancelled: Target item ${targetId} ('${targetItem.label}') is not a folder.`);
    return null;
  }

  // --- Dragged Item Validation ---
  if (!draggedItemData) {
    console.error(`Drop cancelled: Dragged item data for ${draggedId} not found.`);
    return null;
  }

  // --- Ancestor Check (Prevent dropping a folder into itself/descendant) ---
  if (draggedItemData.type === "folder" && isSelfOrDescendant(currentTree, draggedItemData.id, targetId)) {
    const errorMsg = `Cannot drop folder '${draggedItemData.label}' into itself or one of its subfolders.`;
    console.warn("Drop prevented: Ancestor check failed.", errorMsg);
    alert(errorMsg); // User feedback
    return null;
  }

  // --- Sibling Name Conflict Check (Prevent dropping if name exists in target) ---
  const targetSiblings = targetItem.children || [];
  if (hasSiblingWithName(targetSiblings, draggedItemData.label, null)) { // excludeId is null because it's a new item in this context
      const errorMsg = `Cannot move item: An item named '${draggedItemData.label}' already exists in the target folder '${targetItem.label}'.`;
      console.warn("Drop prevented: Name conflict.", errorMsg);
      alert(errorMsg); // User feedback
      return null;
  }


  // --- Drop Logic ---
  // 1. Deep copy the dragged item (using structuredClone if available, fallback to JSON)
  let draggedItemCopy;
  try {
    draggedItemCopy = typeof structuredClone === "function"
      ? structuredClone(draggedItemData)
      : JSON.parse(JSON.stringify(draggedItemData));
  } catch (error) {
    console.error("Failed to deep copy dragged item:", error, draggedItemData);
    return null; // Abort if copy fails
  }

  // 2. Remove the original dragged item recursively from a copy of the tree
  const treeWithoutDraggedItem = deleteItemRecursive(currentTree, draggedId);
   // Verify removal happened (optional but good practice)
   if (JSON.stringify(treeWithoutDraggedItem) === JSON.stringify(currentTree)) {
      console.error("Drop failed: Removal of dragged item did not change the tree structure.", { draggedId });
      // This indicates the draggedId might not have been found, despite earlier checks.
      return null;
   }


  // 3. Insert the copy into the target folder recursively
  const finalTree = insertItemRecursive(treeWithoutDraggedItem, targetId, draggedItemCopy);
   // Verify insertion happened (optional but good practice)
    if (JSON.stringify(finalTree) === JSON.stringify(treeWithoutDraggedItem)) {
      console.error("Drop failed: Insertion of dragged item copy did not change the tree structure.", { targetId, draggedId });
      // This indicates the targetId might not have been found during insertion.
      return null;
    }

  return finalTree; // Return the new tree structure
};