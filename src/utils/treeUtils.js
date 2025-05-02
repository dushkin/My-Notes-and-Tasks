// src/utils/treeUtils.js

/**
 * Sorts items: folders first, then notes, then tasks, then alphabetically by label.
 * Returns a new sorted array (the original array is not mutated).
 */
export const sortItems = (items) => {
  if (!Array.isArray(items)) return [];
  return [...items].sort((a, b) => {
    if (a.type === "folder" && b.type !== "folder") return -1;
    if (a.type !== "folder" && b.type === "folder") return 1;
    if (a.type === "note" && b.type === "task") return -1;
    if (a.type === "task" && b.type === "note") return 1;
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  });
};

/**
 * Recursively deletes an item (by id) from a tree structure.
 */
export const deleteItemRecursive = (items, idToDelete) => {
  const baseItems = Array.isArray(items) ? items : [];
  return baseItems
    .filter((it) => it.id !== idToDelete)
    .map((it) =>
      Array.isArray(it.children)
        ? { ...it, children: deleteItemRecursive(it.children, idToDelete) }
        : it
    );
};

/**
 * Recursively renames an item in the tree.
 */
export const renameItemRecursive = (items, idToRename, newLabel) => {
  const baseItems = Array.isArray(items) ? items : [];
  return baseItems.map((it) => {
    if (it.id === idToRename) {
      return { ...it, label: newLabel };
    }
    if (Array.isArray(it.children)) {
      const updatedChildren = renameItemRecursive(it.children, idToRename, newLabel);
      return updatedChildren !== it.children ? { ...it, children: updatedChildren } : it;
    }
    return it;
  });
};

/**
 * Recursively inserts an item into the tree structure.
 * If targetFolderId is null, the item is added to the root.
 */
export const insertItemRecursive = (nodes, targetFolderId, itemToInsert) => {
  const baseNodes = Array.isArray(nodes) ? nodes : [];
  if (targetFolderId === null) {
    return sortItems([...baseNodes, itemToInsert]);
  }
  return baseNodes.map((node) => {
    if (node.id === targetFolderId && node.type === "folder") {
      const currentChildren = Array.isArray(node.children) ? node.children : [];
      return {
        ...node,
        children: sortItems([...currentChildren, itemToInsert]),
      };
    } else if (Array.isArray(node.children)) {
      const updatedChildren = insertItemRecursive(node.children, targetFolderId, itemToInsert);
      return updatedChildren !== node.children ? { ...node, children: updatedChildren } : node;
    }
    return node;
  });
};

/**
 * Helper: Recursively finds an item by its id.
 */
const findItemById = (nodes, id) => {
  if (!Array.isArray(nodes)) return null;
  for (const item of nodes) {
    if (item.id === id) return item;
    if (Array.isArray(item.children)) {
      const found = findItemById(item.children, id);
      if (found) return found;
    }
  }
  return null;
};

/**
 * Checks if (given the entire tree "nodes") the item with id "checkItemId" is the same as
 * or an ancestor of the item with id "potentialTargetId".
 */
export const isSelfOrDescendant = (nodes, checkItemId, potentialTargetId) => {
  if (!checkItemId || !potentialTargetId) return false;
  if (checkItemId === potentialTargetId) return true;
  const item = findItemById(nodes, checkItemId);
  if (!item || !Array.isArray(item.children)) return false;
  const checkChildren = (children) => {
    for (const child of children) {
      if (child.id === potentialTargetId) return true;
      if (child.type === "folder" && Array.isArray(child.children)) {
        if (checkChildren(child.children)) return true;
      }
    }
    return false;
  };
  return checkChildren(item.children);
};

/**
 * Handles the drop operation.
 * Validates and then removes the dragged item from the tree and inserts it into the target folder.
 */
export const handleDrop = (currentTree, targetId, draggedId) => {
  if (!targetId || !draggedId || targetId === draggedId) {
    console.warn("Drop cancelled: Invalid IDs or target is the same as the dragged item.", {
      targetId,
      draggedId,
    });
    return null;
  }
  const targetItem = findItemById(currentTree, targetId);
  const draggedItemData = findItemById(currentTree, draggedId);
  if (!targetItem) {
    console.warn(`Drop cancelled: Target item ${targetId} could not be found.`);
    return null;
  }
  if (targetItem.type !== "folder") {
    console.warn(`Drop cancelled: Target item ${targetId} ('${targetItem.label}') is not a folder.`);
    return null;
  }
  if (!draggedItemData) {
    console.error(`Drop cancelled: Dragged item data for ${draggedId} not found.`);
    return null;
  }
  if (draggedItemData.type === "folder" && isSelfOrDescendant(currentTree, draggedItemData.id, targetId)) {
    console.warn(
      `Drop prevented: Cannot drop folder ${draggedId} ('${draggedItemData.label}') into itself or a descendant folder ${targetId} ('${targetItem.label}').`
    );
    return null;
  }
  console.log(
    `Drop validated: Preparing to move item ${draggedId} ('${draggedItemData.label}') into folder ${targetId} ('${targetItem.label}')`
  );
  let draggedItemCopy = null;
  const removeItemRecursive = (items) => {
    let itemFoundAndRemoved = false;
    const newItems = [];
    for (const item of items) {
      if (item.id === draggedId) {
        try {
          draggedItemCopy = JSON.parse(JSON.stringify(item));
          console.log("Stored deep copy of dragged item:", draggedItemCopy);
        } catch (error) {
          console.error("Failed to deep copy dragged item:", error, item);
          draggedItemCopy = { ...item };
        }
        itemFoundAndRemoved = true;
      } else {
        const newItem = { ...item };
        if (Array.isArray(newItem.children)) {
          const result = removeItemRecursive(newItem.children);
          if (result.itemFoundAndRemoved) {
            newItem.children = result.newChildren;
            itemFoundAndRemoved = true;
          }
        }
        newItems.push(newItem);
      }
    }
    return { newChildren: newItems, itemFoundAndRemoved };
  };

  const { newChildren: treeWithoutDraggedItem, itemFoundAndRemoved: removed } = removeItemRecursive(currentTree);
  if (!removed || !draggedItemCopy) {
    console.error("Drop failed: Removal did not occur or item copy failed.", {
      draggedId,
      removed,
      hasDraggedItemCopy: !!draggedItemCopy,
    });
    return null;
  }
  const insertItemRecursiveInternal = (items) => {
    return items.map((item) => {
      if (item.id === targetId) {
        console.log(`Inserting item copy ${draggedId} into children of target ${targetId}`);
        return {
          ...item,
          children: sortItems([...(item.children || []), draggedItemCopy]),
        };
      }
      if (Array.isArray(item.children)) {
        return { ...item, children: insertItemRecursiveInternal(item.children) };
      }
      return item;
    });
  };

  const finalTree = insertItemRecursiveInternal(treeWithoutDraggedItem);
  console.log("Drop successful, returning final tree structure.");
  return finalTree;
};
