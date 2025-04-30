// src/hooks/useTree.js
import { useState, useEffect, useCallback, useMemo } from "react";
import { LOCAL_STORAGE_KEY } from "../utils/constants";
import { sortItems, handleDrop as treeHandleDropUtil } from "../utils/treeUtils";

// Helper function to find an item by ID
const findItemById = (nodes, id) => {
  if (!id || !Array.isArray(nodes)) {
    return null;
  }
  for (const item of nodes) {
    if (item.id === id) {
      return item;
    }
    if (Array.isArray(item.children)) {
      const found = findItemById(item.children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
};


export const useTree = () => {
  const EXPANDED_KEY = `${LOCAL_STORAGE_KEY}_expanded`;
  // --- State ---
  const [tree, setTree] = useState(() => { /* ... load tree ... */
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      console.error("Failed to load tree from localStorage.");
      return [];
    }
  });
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [contextMenu, setContextMenu] = useState({ /* ... context menu state ... */
    visible: false, x: 0, y: 0, item: null, isEmptyArea: false,
  });
  const [expandedFolders, setExpandedFolders] = useState(() => { /* ... load expanded ... */
    try {
      const stored = localStorage.getItem(EXPANDED_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      console.error("Failed to load expanded folders from localStorage.");
      return {};
    }
  });
  const [draggedId, setDraggedId] = useState(null);

  // --- Derived State ---
  const selectedItem = useMemo(() => {
    // console.log(`useMemo DERIVING selectedItem: Searching for ID=${selectedItemId} in current tree.`);
    const foundItem = findItemById(tree, selectedItemId);
    // console.log(`useMemo DERIVING selectedItem: Result for ID=${selectedItemId}:`, foundItem);
    return foundItem;
  }, [tree, selectedItemId]);

  // --- Persistence Effects ---
  useEffect(() => { /* ... persist expandedFolders ... */
    try {
      localStorage.setItem(EXPANDED_KEY, JSON.stringify(expandedFolders));
    } catch (error) {
      console.error("Failed to save expanded folders to localStorage:", error);
    }
  }, [expandedFolders]);

  const setTreeAndPersist = useCallback((newTreeOrCallback) => { /* ... persist tree ... */
    setTree(prevTree => {
      const newTree = typeof newTreeOrCallback === 'function'
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


  // --- Tree Manipulation Functions ---
  const toggleFolderExpand = useCallback((id, forced) => {
    console.log(`Toggling expand for ${id}, forced: ${forced}`);
    setExpandedFolders((prev) => ({
      ...prev,
      [id]: forced !== undefined ? forced : !prev[id],
    }));
  }, []); // Empty dependency array, function logic is self-contained

  const expandFolderPath = useCallback((folderId) => { /* ... expand path ... */
    const findPath = (nodes, id, path = []) => {
      if (!Array.isArray(nodes)) return [];
      for (const it of nodes) {
        if (it.id === id) return [...path];
        if (Array.isArray(it.children)) {
          const directChildMatch = it.children.find(child => child.id === id);
          if (directChildMatch) return [...path, it.id];

          const p = findPath(it.children, id, [...path, it.id]);
          if (p.length > path.length + 1) return p;
        }
      }
      return [];
    };
    const path = findPath(tree, folderId);
    setExpandedFolders((prev) => {
      const next = { ...prev };
      [...path, folderId].forEach(pid => { next[pid] = true; });
      return next;
    });
  }, [tree]);

  const updateNoteContent = useCallback((noteId, content) => {
    const recurse = (items) =>
      items.map((it) =>
        it.id === noteId
          ? { ...it, content } // Directly uses the received content
          : Array.isArray(it.children)
            ? { ...it, children: recurse(it.children) }
            : it
      );
    setTreeAndPersist(recurse);
  }, [setTreeAndPersist]);

  const updateTaskContent = useCallback((taskId, content) => { /* ... update task ... */
    const recurse = (items) =>
      items.map((it) =>
        it.id === taskId
          ? { ...it, content }
          : Array.isArray(it.children)
            ? { ...it, children: recurse(it.children) }
            : it
      );
    setTreeAndPersist(recurse);
  }, [setTreeAndPersist]);


  // --- Drag and Drop Handler (Updated) ---
  const handleDrop = useCallback((targetId) => {
    const currentDraggedId = draggedId;
    if (!currentDraggedId || targetId === currentDraggedId) {
      setDraggedId(null); return;
    }
    const nextTree = treeHandleDropUtil(tree, targetId, currentDraggedId);

    if (nextTree) {
      console.log("handleDrop (useTree): Drop successful, updating tree state.");
      setTreeAndPersist(nextTree); // Update the tree first

      // *** FIX: Ensure target folder remains expanded ***
      console.log(`handleDrop (useTree): Ensuring target folder ${targetId} is expanded.`);
      toggleFolderExpand(targetId, true); // Force target folder to be expanded

      // Keep item selected if it was the one dragged
      if (selectedItemId === currentDraggedId) {
        console.log("handleDrop (useTree): Dropped item was selected. Keeping ID selected:", currentDraggedId);
        // No state change needed for selectedItemId itself, useMemo handles the object update
      }
    } else {
      console.log("handleDrop (useTree): Drop deemed invalid by treeUtils.");
    }
    setDraggedId(null); // Reset draggedId regardless
  }, [draggedId, tree, selectedItemId, setTreeAndPersist, toggleFolderExpand]); // Added toggleFolderExpand dependency


  // Delete item
  const deleteItem = useCallback((id) => { /* ... delete item ... */
    const recurse = (items) =>
      items
        .filter((it) => it.id !== id)
        .map((it) =>
          Array.isArray(it.children)
            ? { ...it, children: recurse(it.children) }
            : it
        );
    setTreeAndPersist(recurse);
    if (selectedItemId === id) {
      setSelectedItemId(null);
    }
    setContextMenu((m) => ({ ...m, visible: false }));
  }, [selectedItemId, setTreeAndPersist]);


  const handleEmptyAreaContextMenu = useCallback((e) => { /* ... handle empty context ... */
    e.preventDefault();
    setContextMenu({
      visible: true, x: e.clientX, y: e.clientY, item: null, isEmptyArea: true,
    });
  }, []);

  // --- Return values exposed by the hook ---
  return {
    tree,
    setTree: setTreeAndPersist,
    selectedItem,
    selectedItemId,
    selectItemById: setSelectedItemId,
    contextMenu,
    setContextMenu,
    expandedFolders,
    toggleFolderExpand, // Expose the memoized version
    expandFolderPath,
    handleEmptyAreaContextMenu,
    updateNoteContent,
    updateTaskContent,
    deleteItem,
    draggedId,
    setDraggedId,
    handleDrop,
  };
};
