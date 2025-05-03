// src/hooks/useTree.js
import { useState, useEffect, useCallback, useMemo } from "react";
import { LOCAL_STORAGE_KEY } from "../utils/constants";
import {
  sortItems,
  handleDrop as treeHandleDropUtil,
  deleteItemRecursive,
  renameItemRecursive,
  insertItemRecursive,
  isSelfOrDescendant,
} from "../utils/treeUtils";

// Helper function to find an item by its ID (declared only once here)
const findItemById = (nodes, id) => {
  if (!id || !Array.isArray(nodes)) return null;
  for (const item of nodes) {
    if (item.id === id) return item;
    if (Array.isArray(item.children)) {
      const found = findItemById(item.children, id);
      if (found) return found;
    }
  }
  return null;
};

export const useTree = () => {
  const EXPANDED_KEY = `${LOCAL_STORAGE_KEY}_expanded`;
  const [tree, setTree] = useState(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      console.error("Failed to load tree from localStorage.");
      return [];
    }
  });
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    item: null,
    isEmptyArea: false,
  });
  const [expandedFolders, setExpandedFolders] = useState(() => {
    try {
      const stored = localStorage.getItem(EXPANDED_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      console.error("Failed to load expanded folders from localStorage.");
      return {};
    }
  });
  const [draggedId, setDraggedId] = useState(null);
  // Clipboard state
  const [clipboardItem, setClipboardItem] = useState(null);
  const [clipboardMode, setClipboardMode] = useState(null);
  const [cutItemId, setCutItemId] = useState(null);

  // Derived state: determine the selectedItem from the tree and selectedItemId
  const selectedItem = useMemo(() => findItemById(tree, selectedItemId), [tree, selectedItemId]);

  // Persist expandedFolders in localStorage
  useEffect(() => {
    try {
      localStorage.setItem(EXPANDED_KEY, JSON.stringify(expandedFolders));
    } catch (error) {
      console.error("Failed to save expanded folders to localStorage:", error);
    }
  }, [expandedFolders]);

  // Internal helper: setTreeAndPersist
  const setTreeAndPersist = useCallback((newTreeOrCallback) => {
    setTree((prevTree) => {
      const newTree =
        typeof newTreeOrCallback === "function"
          ? newTreeOrCallback(prevTree)
          : newTreeOrCallback;
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newTree));
      } catch (error) {
        console.error("Failed to save tree to localStorage:", error);
      }
      return newTree;
    });
  }, []);

  // expandFolderPath: Expand a folder and all its ancestors.
  const expandFolderPath = useCallback(
    (folderId) => {
      // Recursively find ancestors.
      const findAncestors = (nodes, id, ancestors = []) => {
        for (const item of nodes) {
          if (item.id === id) return ancestors;
          if (item.children) {
            const found = findAncestors(item.children, id, [...ancestors, item.id]);
            if (found) return found;
          }
        }
        return null;
      };
      const ancestors = findAncestors(tree, folderId, []);
      setExpandedFolders((prev) => {
        const next = { ...prev };
        if (ancestors) {
          ancestors.forEach((pid) => (next[pid] = true));
        }
        next[folderId] = true;
        return next;
      });
    },
    [tree]
  );

  const toggleFolderExpand = useCallback((id, forced) => {
    setExpandedFolders((prev) => ({ ...prev, [id]: forced !== undefined ? forced : !prev[id] }));
  }, []);

  // updateNoteContent and updateTaskContent – recursively update content
  const updateNoteContent = useCallback(
    (noteId, content) => {
      const recurse = (items) =>
        items.map((it) =>
          it.id === noteId
            ? { ...it, content }
            : Array.isArray(it.children)
            ? { ...it, children: recurse(it.children) }
            : it
        );
      setTreeAndPersist(recurse);
    },
    [setTreeAndPersist]
  );

  const updateTaskContent = useCallback(
    (taskId, content) => {
      const recurse = (items) =>
        items.map((it) =>
          it.id === taskId
            ? { ...it, content }
            : Array.isArray(it.children)
            ? { ...it, children: recurse(it.children) }
            : it
        );
      setTreeAndPersist(recurse);
    },
    [setTreeAndPersist]
  );

  // renameItem (using the imported renameItemRecursive)
  const renameItem = useCallback(
    (itemId, newLabel) => {
      if (!newLabel || !itemId) return;
      setTreeAndPersist((currentTree) => renameItemRecursive(currentTree, itemId, newLabel));
    },
    [setTreeAndPersist]
  );

  // deleteItem (using the imported deleteItemRecursive)
  const deleteItem = useCallback(
    (idToDelete) => {
      setTreeAndPersist((currentTree) => deleteItemRecursive(currentTree, idToDelete));
      if (selectedItemId === idToDelete) setSelectedItemId(null);
      setExpandedFolders((prev) => {
        const next = { ...prev };
        delete next[idToDelete];
        return next;
      });
      setContextMenu((m) => ({ ...m, visible: false }));
    },
    [selectedItemId, setTreeAndPersist]
  );

  // handleDrop (using the imported treeHandleDropUtil)
  const handleDrop = useCallback(
    (targetId) => {
      const currentDraggedId = draggedId;
      if (!currentDraggedId || targetId === currentDraggedId) {
        setDraggedId(null);
        return;
      }
      const nextTree = treeHandleDropUtil(tree, targetId, currentDraggedId);
      if (nextTree) {
        setTreeAndPersist(nextTree);
        toggleFolderExpand(targetId, true);
      } else {
        console.warn("Drop deemed invalid by treeUtils.");
      }
      setDraggedId(null);
    },
    [draggedId, tree, setTreeAndPersist, toggleFolderExpand]
  );

  // Clipboard Operations
  const copyItem = useCallback(
    (itemId) => {
      const itemToCopy = findItemById(tree, itemId);
      if (itemToCopy) {
        try {
          const deepCopy =
            typeof structuredClone === "function"
              ? structuredClone(itemToCopy)
              : JSON.parse(JSON.stringify(itemToCopy));
          setClipboardItem(deepCopy);
          setClipboardMode("copy");
          setCutItemId(null);
          console.log("Copied item:", itemToCopy.label);
        } catch (e) {
          console.error("Failed to copy item:", e);
          setClipboardItem(null);
          setClipboardMode(null);
          setCutItemId(null);
        }
      }
      setContextMenu((m) => ({ ...m, visible: false }));
    },
    [tree]
  );

  const cutItem = useCallback(
    (itemId) => {
      const itemToCut = findItemById(tree, itemId);
      if (itemToCut) {
        try {
          const deepCopy =
            typeof structuredClone === "function"
              ? structuredClone(itemToCut)
              : JSON.parse(JSON.stringify(itemToCut));
          setClipboardItem(deepCopy);
          setClipboardMode("cut");
          setCutItemId(itemId);
          console.log("Cut item:", itemToCut.label);
        } catch (e) {
          console.error("Failed to cut item:", e);
          setClipboardItem(null);
          setClipboardMode(null);
          setCutItemId(null);
        }
      }
      setContextMenu((m) => ({ ...m, visible: false }));
    },
    [tree]
  );

  // addItem (using the imported insertItemRecursive)
  const addItem = useCallback(
    (newItem, parentId) => {
      setTreeAndPersist((prevTree) => insertItemRecursive(prevTree, parentId, newItem));
    },
    [setTreeAndPersist]
  );

  // --- NEW: Duplicate Item ---
  // This function deep-clones the item (and its subtree), assigns new IDs,
  // appends "-dup" to the top-level label, and then inserts it as a sibling.
  const duplicateItem = useCallback((itemId) => {
    const itemToDuplicate = findItemById(tree, itemId);
    if (!itemToDuplicate) return;

    // Deep-clone the item (using JSON for simplicity)
    let duplicate = JSON.parse(JSON.stringify(itemToDuplicate));
    // Recursively assign new IDs using your existing helper.
    duplicate = assignNewIds(duplicate);
    // Append "-dup" only to the top-level label.
    duplicate.label = duplicate.label + "-dup";

    // Helper: find the parent and index of the item in the tree.
    const findParentAndIndex = (nodes, id, parent = null) => {
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === id) return { parent, index: i };
        if (nodes[i].children) {
          const res = findParentAndIndex(nodes[i].children, id, nodes[i]);
          if (res) return res;
        }
      }
      return null;
    };

    const parentInfo = findParentAndIndex(tree, itemId);
    if (parentInfo && parentInfo.parent) {
      // Insert duplicate as a sibling under the parent.
      const parentId = parentInfo.parent.id;
      setTreeAndPersist((prevTree) => {
        const updateTree = (nodes) =>
          nodes.map((node) => {
            if (node.id === parentId) {
              const currentChildren = Array.isArray(node.children) ? node.children : [];
              return { ...node, children: [...currentChildren, duplicate] };
            } else if (node.children) {
              return { ...node, children: updateTree(node.children) };
            }
            return node;
          });
        return updateTree(prevTree);
      });
    } else {
      // If no parent exists (the item is at root), add to the root level.
      setTreeAndPersist((prevTree) => [...prevTree, duplicate]);
    }
    setContextMenu((m) => ({ ...m, visible: false }));
  }, [tree, setTreeAndPersist, setContextMenu]);

  // pasteItem:
  // After updating the tree, if a target folder is provided, schedule a call to expandFolderPath.
  const pasteItem = useCallback(
    (targetFolderId) => {
      if (!clipboardItem) {
        console.warn("Clipboard is empty.");
        setContextMenu((m) => ({ ...m, visible: false }));
        return;
      }
      const originalClipboardItemId = clipboardItem.id;
      if (
        clipboardItem.type === "folder" &&
        isSelfOrDescendant(tree, originalClipboardItemId, targetFolderId)
      ) {
        console.warn(
          `Paste prevented: Cannot paste folder '${clipboardItem.label}' into itself or a descendant.`
        );
        alert(`Cannot paste folder '${clipboardItem.label}' into itself or one of its subfolders.`);
        setContextMenu((m) => ({ ...m, visible: false }));
        return;
      }
      const itemToPasteWithNewIds = assignNewIds(clipboardItem);
      const originalIdToDeleteIfCut = cutItemId;
      setTreeAndPersist((currentTree) => {
        let newTree = insertItemRecursive(currentTree, targetFolderId, itemToPasteWithNewIds);
        if (findItemById(newTree, itemToPasteWithNewIds.id)) {
          if (clipboardMode === "cut" && originalIdToDeleteIfCut) {
            console.log("Cut/Paste: Deleting original", originalIdToDeleteIfCut);
            newTree = deleteItemRecursive(newTree, originalIdToDeleteIfCut);
            setCutItemId(null);
          }
        } else {
          console.warn("Paste target folder not found or invalid during state update:", targetFolderId);
          newTree = currentTree;
        }
        return newTree;
      });
      if (targetFolderId) {
        setTimeout(() => {
          expandFolderPath(targetFolderId);
        }, 0);
      }
      setContextMenu((m) => ({ ...m, visible: false }));
    },
    [clipboardItem, clipboardMode, cutItemId, tree, setTreeAndPersist, expandFolderPath]
  );

  const handleEmptyAreaContextMenu = useCallback((e) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, item: null, isEmptyArea: true });
  }, []);

  return {
    tree,
    selectedItem,
    selectedItemId,
    selectItemById: setSelectedItemId,
    contextMenu,
    setContextMenu,
    expandedFolders,
    toggleFolderExpand,
    expandFolderPath,
    handleEmptyAreaContextMenu,
    updateNoteContent,
    updateTaskContent,
    renameItem,
    deleteItem,
    draggedId,
    setDraggedId,
    handleDrop,
    clipboardItem,
    clipboardMode,
    cutItemId,
    copyItem,
    cutItem,
    pasteItem,
    addItem,
    duplicateItem, // NEW: expose duplicateItem
  };
}; // End of useTree hook

// Helper: assignNewIds (declared only once)
const assignNewIds = (item) => {
  const newItem = {
    ...item,
    id: Date.now().toString() + "-" + Math.random().toString(36).substring(2, 9),
  };
  if (Array.isArray(newItem.children)) {
    newItem.children = newItem.children.map(assignNewIds);
  }
  return newItem;
};
