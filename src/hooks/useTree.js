// src/hooks/useTree.js
import { useState, useEffect } from "react";
import { LOCAL_STORAGE_KEY } from "../utils/constants";
import { sortItems, handleDrop as treeHandleDrop } from "../utils/treeUtils";

export const useTree = () => {
  const EXPANDED_KEY = `${LOCAL_STORAGE_KEY}_expanded`;

  // Tree data
  const [tree, setTree] = useState(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [selectedItem, setSelectedItem] = useState(null);
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    item: null,
    isEmptyArea: false,
  });

  // Persisted expand/collapse state
  const [expandedFolders, setExpandedFolders] = useState(() => {
    try {
      const stored = localStorage.getItem(EXPANDED_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(EXPANDED_KEY, JSON.stringify(expandedFolders));
    } catch {}
  }, [expandedFolders]);

  // Toggle one folder
  const toggleFolderExpand = (id, forced) =>
    setExpandedFolders((prev) => ({
      ...prev,
      [id]: forced !== undefined ? forced : !prev[id],
    }));

  // Expand a folder and its ancestors
  const expandFolderPath = (folderId) => {
    const findPath = (items, id, path = []) => {
      for (const it of items) {
        if (it.id === id) return [...path];
        if (it.children) {
          const p = findPath(it.children, id, [...path, it.id]);
          if (p.length) return p;
        }
      }
      return [];
    };
    const path = findPath(tree, folderId);
    setExpandedFolders((prev) => {
      const next = { ...prev };
      for (const pid of [...path, folderId]) next[pid] = true;
      return next;
    });
  };

  // Generic tree updater + persist
  const updateTree = (fn) =>
    setTree((prev) => {
      const next = fn(prev);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
      return next;
    });

  // Update note content
  const updateNoteContent = (noteId, content) => {
    const recurse = (items) =>
      items.map((it) =>
        it.id === noteId
          ? { ...it, content }
          : it.children
          ? { ...it, children: recurse(it.children) }
          : it
      );
    updateTree(recurse);
    if (selectedItem?.id === noteId) {
      setSelectedItem((s) => ({ ...s, content }));
    }
  };

  // Update task content
  const updateTaskContent = (taskId, content) => {
    const recurse = (items) =>
      items.map((it) =>
        it.id === taskId
          ? { ...it, content }
          : it.children
          ? { ...it, children: recurse(it.children) }
          : it
      );
    updateTree(recurse);
    if (selectedItem?.id === taskId) {
      setSelectedItem((s) => ({ ...s, content }));
    }
  };

  // Drag & drop
  const handleDrop = (targetId, draggedId) =>
    treeHandleDrop(tree, targetId, draggedId, setTree);

  // Delete item & close menu
  const deleteItem = (id) => {
    const recurse = (items) =>
      items
        .filter((it) => it.id !== id)
        .map((it) =>
          it.children ? { ...it, children: recurse(it.children) } : it
        );
    updateTree(recurse);
    if (selectedItem?.id === id) setSelectedItem(null);
    setContextMenu((m) => ({ ...m, visible: false }));
  };

  return {
    tree,
    setTree,
    selectedItem,
    setSelectedItem,
    contextMenu,
    setContextMenu,
    expandedFolders,
    toggleFolderExpand,
    expandFolderPath,
    handleEmptyAreaContextMenu: (e) => {
      e.preventDefault();
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        item: null,
        isEmptyArea: true,
      });
    },
    updateNoteContent,
    updateTaskContent,
    deleteItem,
    handleDrop,
  };
};
