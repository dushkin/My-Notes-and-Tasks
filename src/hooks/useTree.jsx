// src/hooks/useTree.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { LOCAL_STORAGE_KEY } from "../utils/constants";
import {
  sortItems,
  handleDrop as treeHandleDropUtil,
  deleteItemRecursive,
  renameItemRecursive,
  insertItemRecursive,
  isSelfOrDescendant,
  findItemById,
  findParentAndSiblings,
  hasSiblingWithName,
  getItemPath,
} from "../utils/treeUtils";
import { jsPDF } from "jspdf";
import * as bidiNS from "unicode-bidirectional";
import { notoSansHebrewBase64 } from "../fonts/NotoSansHebrewBase64";
import { useSettings } from "../contexts/SettingsContext";
import { itemMatches } from "../utils/searchUtils";
import { useUndoRedo } from "./useUndoRedo";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";

const getAuthToken = () => {
  return localStorage.getItem("userToken");
};

const embeddingLevels = bidiNS.embeddingLevels || bidiNS.getEmbeddingLevels;
const reorder = bidiNS.reorder || bidiNS.getReorderedString;

function htmlToPlainTextWithNewlines(html) {
  if (!html) return "";
  let text = html;
  text = text.replace(
    /<(div|p|h[1-6]|li|blockquote|pre|tr|hr)[^>]*>/gi,
    "\n$&"
  );
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<[^>]+>/g, "");
  try {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = text;
    text = tempDiv.textContent || tempDiv.innerText || "";
  } catch (e) {
    console.error("Error decoding HTML entities for PDF export:", e);
  }
  return text.trim().replace(/(\r\n|\r|\n){2,}/g, "\n");
}

const assignNewIds = (item, isDuplication = false) => {
  // Ensure this line is correct
  const newItem = { ...item };
  if (
    isDuplication ||
    !item.id ||
    item.id.startsWith("temp-") ||
    item.id.startsWith("client-")
  ) {
    newItem.id = `client-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .substring(2, 9)}`;
  }
  if (item.type === "folder") {
    newItem.children = Array.isArray(item.children)
      ? item.children.map((child) => assignNewIds(child, isDuplication))
      : [];
  }
  return newItem;
};

export const useTree = () => {
  const EXPANDED_KEY = `${LOCAL_STORAGE_KEY}_expanded`;
  const { settings } = useSettings();

  const initialTreeState = (() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Failed to load tree from localStorage:", error);
      return [];
    }
  })();

  const {
    state: tree,
    setState: setTreeWithUndo,
    resetState: resetTreeHistory,
    undo: undoTreeChange,
    redo: redoTreeChange,
    canUndo: canUndoTree,
    canRedo: canRedoTree,
  } = useUndoRedo(initialTreeState);

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
      return {};
    }
  });
  const [draggedId, setDraggedId] = useState(null);
  const [clipboardItem, setClipboardItem] = useState(null);
  const [clipboardMode, setClipboardMode] = useState(null);
  const [cutItemId, setCutItemId] = useState(null);
  const [isFetchingTree, setIsFetchingTree] = useState(false); // For loading state

  const selectedItem = useMemo(
    () => findItemById(tree, selectedItemId),
    [tree, selectedItemId]
  );

  const fetchUserTreeInternal = useCallback(
    async (token) => {
      if (!token) {
        console.log(
          "fetchUserTreeInternal: No token provided, clearing/resetting tree."
        );
        resetTreeHistory([]); // Or load from localStorage if preferred for logged-out
        setIsFetchingTree(false);
        return;
      }
      setIsFetchingTree(true);
      console.log(
        "fetchUserTreeInternal: Token found, fetching tree from server."
      );
      try {
        const response = await fetch(`${API_BASE_URL}/items/tree`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log(
          "fetchUserTreeInternal: fetchTreeFromServer response status:",
          response.status
        );
        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Failed to parse error response" }));
          if (response.status === 401) {
            console.error(
              "fetchUserTreeInternal: Unauthorized (401). Token might be invalid."
            );
            localStorage.removeItem("userToken"); // Critical: remove invalid token
            // Consider calling a global logout handler if App.jsx passes one down
          } else {
            console.error(
              "fetchUserTreeInternal: Server error fetching tree:",
              response.status,
              errorData
            );
          }
          resetTreeHistory([]); // Clear tree on error
          setIsFetchingTree(false);
          return; // Explicitly return on error
        }
        const data = await response.json();
        if (data && Array.isArray(data.notesTree)) {
          console.log(
            "fetchUserTreeInternal: Successfully fetched tree, resetting local state."
          );
          resetTreeHistory(data.notesTree);
        } else {
          console.warn(
            "fetchUserTreeInternal: Fetched tree data is not in expected format, using empty tree."
          );
          resetTreeHistory([]);
        }
      } catch (error) {
        console.error(
          "fetchUserTreeInternal: Network or other error fetching tree:",
          error
        );
        resetTreeHistory([]); // Clear tree on error
      } finally {
        setIsFetchingTree(false);
      }
    },
    [resetTreeHistory]
  ); // API_BASE_URL is stable

  // Effect for initial load and when token changes (e.g., after login)
  // This will be triggered by App.jsx calling fetchUserTree after login.
  // For initial load, App.jsx will also call this if a token is found.
  // The useEffect that was here before is effectively replaced by App.jsx controlling the fetch.

  useEffect(() => {
    // Persist tree to localStorage
    try {
      if (Array.isArray(tree))
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tree));
    } catch (error) {
      console.error("Failed to save tree to localStorage:", error);
    }
  }, [tree]);

  useEffect(() => {
    // Persist expanded folders
    try {
      localStorage.setItem(EXPANDED_KEY, JSON.stringify(expandedFolders));
    } catch (error) {
      console.error("Failed to save expanded folders:", error);
    }
  }, [expandedFolders]);

  const selectItemById = useCallback((id) => setSelectedItemId(id), []);
  const replaceTree = useCallback(
    (newTreeData) => {
      if (Array.isArray(newTreeData)) {
        resetTreeHistory(newTreeData);
        setSelectedItemId(null);
        setExpandedFolders({});
        return { success: true };
      }
      console.error("replaceTree failed: Data is not an array.", newTreeData);
      return { success: false, error: "Import failed: Invalid data format." };
    },
    [resetTreeHistory]
  );

  const expandFolderPath = useCallback(
    /* ... (Your existing robust expandFolderPath) ... */
    (itemIdToExpand) => {
      if (!itemIdToExpand) return;
      const pathIds = [];
      const findPathRecursive = (nodes, targetId, currentPathSegmentsIds) => {
        for (const node of nodes) {
          if (!node || !node.id) continue;
          if (node.id === targetId) {
            pathIds.push(...currentPathSegmentsIds, node.id);
            return true;
          }
          if (node.type === "folder" && Array.isArray(node.children)) {
            if (
              findPathRecursive(node.children, targetId, [
                ...currentPathSegmentsIds,
                node.id,
              ])
            ) {
              return true;
            }
          }
        }
        return false;
      };
      findPathRecursive(tree, itemIdToExpand, []);
      setExpandedFolders((prev) => {
        const next = { ...prev };
        let changed = false;
        pathIds.forEach((id) => {
          const item = findItemById(tree, id);
          if (item && item.type === "folder" && !next[id]) {
            next[id] = true;
            changed = true;
          }
        });
        const targetItem = findItemById(tree, itemIdToExpand);
        if (
          targetItem &&
          targetItem.type === "folder" &&
          !next[itemIdToExpand]
        ) {
          next[itemIdToExpand] = true;
          changed = true;
        }
        return changed ? next : prev;
      });
    },
    [tree]
  );

  const toggleFolderExpand = useCallback((id, forceState) => {
    if (!id) return;
    setExpandedFolders((prev) => ({
      ...prev,
      [id]: forceState !== undefined ? Boolean(forceState) : !prev[id],
    }));
  }, []);

  const addItem = useCallback(
    /* ... (Your existing addItem with API calls) ... */
    async (newItemData, parentId) => {
      const trimmedLabel = newItemData?.label?.trim();
      if (!trimmedLabel) return { success: false, error: "Label is required." };
      if (!["folder", "note", "task"].includes(newItemData.type))
        return { success: false, error: "Invalid item type." };
      const token = getAuthToken();
      if (!token) return { success: false, error: "Authentication required." };
      const payload = { label: trimmedLabel, type: newItemData.type };
      if (newItemData.type === "note" || newItemData.type === "task")
        payload.content = newItemData.content || "";
      if (newItemData.type === "task")
        payload.completed = !!newItemData.completed;
      try {
        const endpoint = parentId
          ? `${API_BASE_URL}/items/${parentId}`
          : `${API_BASE_URL}/items`;
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const responseData = await response.json();
        if (!response.ok)
          return {
            success: false,
            error:
              responseData.error || `Failed to add item: ${response.status}`,
          };
        const createdItemFromServer = responseData;
        const newTreeState = insertItemRecursive(
          tree,
          parentId,
          createdItemFromServer
        );
        setTreeWithUndo(newTreeState);
        if (parentId && settings.autoExpandNewFolders) {
          setTimeout(() => expandFolderPath(parentId), 0);
        } else if (
          !parentId &&
          createdItemFromServer.type === "folder" &&
          settings.autoExpandNewFolders
        ) {
          setTimeout(() => expandFolderPath(createdItemFromServer.id), 0);
        } // Expand new root folder
        return { success: true, item: createdItemFromServer };
      } catch (error) {
        console.error("addItem API error:", error);
        return { success: false, error: "Network error adding item." };
      }
    },
    [tree, setTreeWithUndo, expandFolderPath, settings.autoExpandNewFolders]
  );

  const updateNoteContent = useCallback(
    /* ... (Your existing updateNoteContent with API calls) ... */
    async (itemId, content) => {
      const token = getAuthToken();
      if (!token) return { success: false, error: "Authentication required." };
      try {
        const response = await fetch(`${API_BASE_URL}/items/${itemId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content }),
        });
        const updatedItemFromServer = await response.json();
        if (!response.ok)
          return {
            success: false,
            error: updatedItemFromServer.error || "Failed to update note.",
          };
        const mapRecursive = (items, id, serverUpdates) =>
          items.map((i) =>
            i.id === id
              ? { ...i, ...serverUpdates }
              : Array.isArray(i.children)
              ? { ...i, children: mapRecursive(i.children, id, serverUpdates) }
              : i
          );
        const newTreeState = mapRecursive(tree, itemId, updatedItemFromServer);
        setTreeWithUndo(newTreeState);
        return { success: true, item: updatedItemFromServer };
      } catch (error) {
        console.error("updateNoteContent API error:", error);
        return { success: false, error: "Network error updating note." };
      }
    },
    [tree, setTreeWithUndo]
  );

  const updateTask = useCallback(
    /* ... (Your existing updateTask with API calls) ... */
    async (taskId, clientUpdates) => {
      const token = getAuthToken();
      if (!token) return { success: false, error: "Authentication required." };
      try {
        const response = await fetch(`${API_BASE_URL}/items/${taskId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(clientUpdates),
        });
        const updatedItemFromServer = await response.json();
        if (!response.ok)
          return {
            success: false,
            error: updatedItemFromServer.error || "Failed to update task.",
          };
        const mapRecursiveTask = (items, id, serverUpdates) =>
          items.map((i) =>
            i.id === id && i.type === "task"
              ? { ...i, ...serverUpdates }
              : Array.isArray(i.children)
              ? {
                  ...i,
                  children: mapRecursiveTask(i.children, id, serverUpdates),
                }
              : i
          );
        const newTreeState = mapRecursiveTask(
          tree,
          taskId,
          updatedItemFromServer
        );
        setTreeWithUndo(newTreeState);
        return { success: true, item: updatedItemFromServer };
      } catch (error) {
        console.error("updateTask API error:", error);
        return { success: false, error: "Network error updating task." };
      }
    },
    [tree, setTreeWithUndo]
  );

  const renameItem = useCallback(
    /* ... (Your existing renameItem with API calls) ... */
    async (itemId, newLabel) => {
      const trimmedLabel = newLabel?.trim();
      if (!trimmedLabel || !itemId)
        return { success: false, error: "Invalid ID or name." };
      const token = getAuthToken();
      if (!token) return { success: false, error: "Authentication required." };
      const { parentArray } = findParentAndSiblings(tree, itemId);
      if (hasSiblingWithName(parentArray || [], trimmedLabel, itemId)) {
        return {
          success: false,
          error: `Item "${trimmedLabel}" already exists.`,
        };
      }
      try {
        const response = await fetch(`${API_BASE_URL}/items/${itemId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ label: trimmedLabel }),
        });
        const updatedItemFromServer = await response.json();
        if (!response.ok)
          return {
            success: false,
            error: updatedItemFromServer.error || "Rename failed.",
          };
        const newTreeState = renameItemRecursive(
          tree,
          itemId,
          updatedItemFromServer.label
        );
        setTreeWithUndo(newTreeState);
        return { success: true, item: updatedItemFromServer };
      } catch (error) {
        console.error("renameItem API error:", error);
        return { success: false, error: "Network error renaming." };
      }
    },
    [tree, setTreeWithUndo]
  );

  const deleteItem = useCallback(
    /* ... (Your existing deleteItem with API calls) ... */
    async (idToDelete) => {
      if (!idToDelete) return { success: false, error: "No ID for deletion." };
      const token = getAuthToken();
      if (!token) return { success: false, error: "Authentication required." };
      try {
        const response = await fetch(`${API_BASE_URL}/items/${idToDelete}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok && response.status !== 404) {
          const errorData = await response.json().catch(() => ({}));
          return {
            success: false,
            error: errorData.error || "Delete failed on server.",
          };
        }
        const newTreeState = deleteItemRecursive(tree, idToDelete);
        setTreeWithUndo(newTreeState);
        if (selectedItemId === idToDelete) setSelectedItemId(null);
        setExpandedFolders((prev) => {
          const next = { ...prev };
          if (prev.hasOwnProperty(idToDelete)) delete next[idToDelete];
          return next;
        });
        // setContextMenu((m) => (m.visible ? { ...m, visible: false } : m)); // Usually handled by App.jsx
        return { success: true };
      } catch (error) {
        console.error("deleteItem API error:", error);
        return { success: false, error: "Network error deleting." };
      }
    },
    [tree, selectedItemId, setTreeWithUndo /* setContextMenu not a direct dep*/]
  );

  const duplicateItem = useCallback(
    /* ... (Your existing duplicateItem, ensure it calls addItem for DB persistence) ... */
    async (itemId) => {
      const itemToDuplicate = findItemById(tree, itemId);
      if (!itemToDuplicate)
        return { success: false, error: "Item to duplicate not found." };
      const { parent } = findParentAndSiblings(tree, itemId);
      const parentId = parent?.id ?? null;
      let newDuplicate = assignNewIds(structuredClone(itemToDuplicate), true);
      let baseName = itemToDuplicate.label;
      let newLabel = `${baseName} (copy)`;
      let counter = 1;
      const targetSiblings = parentId
        ? findItemById(tree, parentId)?.children || []
        : tree;
      while (hasSiblingWithName(targetSiblings, newLabel, null)) {
        counter++;
        newLabel = `${baseName} (copy ${counter})`;
      }
      newDuplicate.label = newLabel;
      const result = await addItem(newDuplicate, parentId);
      if (result.success && result.item) {
        if (parentId && settings.autoExpandNewFolders) {
          setTimeout(() => expandFolderPath(parentId), 0);
        }
        return { success: true, item: result.item };
      } else {
        return {
          success: false,
          error: result.error || "Failed to save duplicated item.",
        };
      }
    },
    [tree, addItem, settings.autoExpandNewFolders, expandFolderPath]
  );

  const handleDrop = useCallback(
    /* ... (Your existing handleDrop, still mostly client-side for DB) ... */
    async (targetFolderId, droppedItemId) => {
      console.warn(
        "useTree: handleDrop (moving items) is client-side for DB persistence. Needs server endpoint."
      );
      const currentDraggedId = droppedItemId || draggedId;
      setDraggedId(null);
      if (!currentDraggedId || targetFolderId === currentDraggedId)
        return { success: false, error: "Invalid drop." };
      const itemToDrop = findItemById(tree, currentDraggedId);
      const targetFolder = findItemById(tree, targetFolderId);
      if (!itemToDrop || !targetFolder || targetFolder.type !== "folder")
        return { success: false, error: "Invalid item or target folder." };
      if (
        itemToDrop.type === "folder" &&
        isSelfOrDescendant(tree, itemToDrop.id, targetFolderId)
      ) {
        return {
          success: false,
          error: "Cannot drop folder into itself or one of its descendants.",
        };
      }
      if (
        hasSiblingWithName(targetFolder.children || [], itemToDrop.label, null)
      ) {
        return {
          success: false,
          error: `Item named "${itemToDrop.label}" already exists in the target folder.`,
        };
      }
      const newTreeState = treeHandleDropUtil(
        tree,
        targetFolderId,
        currentDraggedId
      );
      if (newTreeState) {
        setTreeWithUndo(newTreeState);
        if (settings.autoExpandNewFolders && targetFolderId) {
          setTimeout(() => expandFolderPath(targetFolderId), 0);
        }
        return {
          success: true,
          message:
            "Local drop successful. Server persistence for item move not yet implemented.",
        };
      }
      return { success: false, error: "Local drop simulation failed." };
    },
    [
      tree,
      draggedId,
      setTreeWithUndo,
      settings.autoExpandNewFolders,
      expandFolderPath,
      treeHandleDropUtil,
    ]
  );

  const copyItem = useCallback(
    /* ... (Your existing copyItem) ... */
    (itemId) => {
      const itemToCopy = findItemById(tree, itemId);
      if (itemToCopy) {
        try {
          const deepCopy = structuredClone(itemToCopy);
          setClipboardItem(deepCopy);
          setClipboardMode("copy");
          setCutItemId(null);
        } catch (e) {
          console.error("Error copying item:", e);
          setClipboardItem(null);
          setClipboardMode(null);
          setCutItemId(null);
        }
      }
    },
    [tree]
  );

  const cutItem = useCallback(
    /* ... (Your existing cutItem) ... */
    (itemId) => {
      const itemToCut = findItemById(tree, itemId);
      if (itemToCut) {
        try {
          const deepCopy = structuredClone(itemToCut);
          setClipboardItem(deepCopy);
          setClipboardMode("cut");
          setCutItemId(itemId);
        } catch (e) {
          console.error("Error cutting item:", e);
          setClipboardItem(null);
          setClipboardMode(null);
          setCutItemId(null);
        }
      }
    },
    [tree]
  );

  const pasteItem = useCallback(
    /* ... (Your existing pasteItem, 'copy' uses addItem, 'cut' is client-side for DB) ... */
    async (targetFolderId) => {
      console.warn(
        "useTree: pasteItem: 'cut' persistence needs backend. 'copy' uses addItem."
      );
      if (!clipboardItem)
        return { success: false, error: "Clipboard is empty." };
      const targetParent = targetFolderId
        ? findItemById(tree, targetFolderId)
        : null;
      if (targetFolderId && (!targetParent || targetParent.type !== "folder")) {
        return {
          success: false,
          error: "Target for paste must be a valid folder or root.",
        };
      }
      if (
        clipboardItem.type === "folder" &&
        isSelfOrDescendant(tree, clipboardItem.id, targetFolderId)
      ) {
        return {
          success: false,
          error: "Cannot paste a folder into itself or one of its descendants.",
        };
      }
      const targetSiblings = targetFolderId
        ? targetParent?.children || []
        : tree;
      let itemToInsert = structuredClone(clipboardItem);
      if (clipboardMode === "copy") {
        itemToInsert = assignNewIds(itemToInsert, true);
        let baseName = itemToInsert.label;
        let newLabel = baseName;
        let copyCounter = 0;
        while (hasSiblingWithName(targetSiblings, newLabel, null)) {
          copyCounter++;
          newLabel = `${baseName} (copy${
            copyCounter > 1 ? ` ${copyCounter}` : ""
          })`;
        }
        itemToInsert.label = newLabel;
        const addResult = await addItem(itemToInsert, targetFolderId);
        if (
          addResult.success &&
          targetFolderId &&
          settings.autoExpandNewFolders
        )
          expandFolderPath(targetFolderId);
        return addResult;
      } else if (clipboardMode === "cut" && cutItemId) {
        if (
          cutItemId === targetFolderId &&
          findParentAndSiblings(tree, cutItemId)?.parent?.id === targetFolderId
        ) {
          setClipboardItem(null);
          setClipboardMode(null);
          setCutItemId(null);
          return {
            success: true,
            item: itemToInsert,
            message: "Item 'pasted' in the same location.",
          };
        }
        if (
          findParentAndSiblings(tree, cutItemId)?.parent?.id !==
            targetFolderId &&
          hasSiblingWithName(targetSiblings, itemToInsert.label, null)
        ) {
          // Check if name exists unless it's the same item not changing name context
          return {
            success: false,
            error: `An item named "${itemToInsert.label}" already exists in the target folder.`,
          };
        }
        console.warn(
          "Cut & Paste: Persistence of item move not fully implemented on backend. Simulating client-side."
        );
        let tempTree = deleteItemRecursive(tree, cutItemId);
        tempTree = insertItemRecursive(tempTree, targetFolderId, itemToInsert);
        setTreeWithUndo(tempTree);
        setClipboardItem(null);
        setClipboardMode(null);
        setCutItemId(null);
        if (targetFolderId && settings.autoExpandNewFolders)
          expandFolderPath(targetFolderId);
        return {
          success: true,
          item: itemToInsert,
          message:
            "Item moved locally. Server persistence for move needs to be implemented.",
        };
      }
      return { success: false, error: "Invalid paste operation." };
    },
    [
      tree,
      clipboardItem,
      clipboardMode,
      cutItemId,
      setTreeWithUndo,
      settings.autoExpandNewFolders,
      expandFolderPath,
      addItem,
    ]
  );

  const handleExport = useCallback(
    /* ... (Your existing handleExport, no DB interaction) ... */
    (target, format) => {
      let dataToExport;
      let fileName;
      const currentSelectedItem = findItemById(tree, selectedItemId);
      if (target === "selected") {
        if (!currentSelectedItem) {
          alert("No item selected.");
          return;
        }
        dataToExport = currentSelectedItem;
        fileName = `${currentSelectedItem.label}-export`;
      } else {
        dataToExport = tree;
        fileName = "tree-export";
      }
      if (format === "json") {
        try {
          const jsonStr = JSON.stringify(dataToExport, null, 2);
          const blob = new Blob([jsonStr], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName + ".json";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (error) {
          console.error("JSON export failed:", error);
          alert("Failed to export JSON.");
        }
      } else if (format === "pdf") {
        /* ... your PDF logic ... */
      }
    },
    [tree, selectedItemId]
  );

  // ** MODIFIED handleImport to use PUT for both "entire" and "selected" (by sending full tree) **
  const handleImport = useCallback(
    async (file, importTargetOption) => {
      return new Promise((resolveOuter) => {
        if (!file || file.type !== "application/json") {
          resolveOuter({ success: false, error: "Please select a JSON file." });
          return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const importedData = JSON.parse(e.target.result);
            const token = getAuthToken();
            if (!token) {
              resolveOuter({
                success: false,
                error: "Authentication required to save imported data.",
              });
              return;
            }

            let processedTreeForServer;

            if (importTargetOption === "entire") {
              processedTreeForServer = Array.isArray(importedData)
                ? importedData.map((i) =>
                    assignNewIds(structuredClone(i), true)
                  )
                : [assignNewIds(structuredClone(i), true)];
              console.log(
                "Attempting to save entire imported tree to server (from 'entire' option):",
                processedTreeForServer.length,
                "items"
              );
            } else {
              // "selected" - import under an item
              const currentSel = findItemById(tree, selectedItemId);
              if (currentSel && currentSel.type === "folder") {
                const itemsToInsert = Array.isArray(importedData)
                  ? importedData.map((i) =>
                      assignNewIds(structuredClone(i), true)
                    )
                  : [assignNewIds(structuredClone(importedData), true)];

                let tempTree = [...tree]; // Start with a fresh copy of the current tree
                itemsToInsert.forEach((it) => {
                  if (!it.label || !it.type || !it.id) {
                    console.warn(
                      "Skipping invalid item during import under selected:",
                      it
                    );
                    return;
                  }
                  // Ensure no name conflicts before inserting
                  const parentForInsert = findItemById(tempTree, currentSel.id); // Find parent in potentially modified tempTree
                  const siblingsForInsert = parentForInsert?.children || [];
                  if (hasSiblingWithName(siblingsForInsert, it.label, null)) {
                    // Handle name conflict, e.g., by renaming 'it' or skipping
                    console.warn(
                      `Name conflict for "${it.label}" under "${currentSel.label}". Skipping item or implement renaming.`
                    );
                    // For now, skip: (or you could try to auto-rename 'it.label' here)
                    // return; // Or, if you must insert, it might overwrite or backend might reject
                  }
                  tempTree = insertItemRecursive(tempTree, currentSel.id, it);
                });
                processedTreeForServer = tempTree;
                console.log(
                  "Attempting to save modified tree (import under selected) to server:",
                  processedTreeForServer.length,
                  "root items"
                );
              } else {
                resolveOuter({
                  success: false,
                  error: "Target for import must be a selected folder.",
                });
                return;
              }
            }

            const response = await fetch(`${API_BASE_URL}/items/tree`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ newTree: processedTreeForServer }),
            });
            const responseData = await response.json();

            if (!response.ok) {
              console.error("Server error saving imported tree:", responseData);
              resolveOuter({
                success: false,
                error:
                  responseData.error ||
                  "Failed to save imported tree to server.",
              });
              return;
            }

            replaceTree(responseData.notesTree || processedTreeForServer);

            if (
              importTargetOption === "selected" &&
              selectedItemId &&
              settings.autoExpandNewFolders
            ) {
              expandFolderPath(selectedItemId);
            } else if (
              importTargetOption === "entire" &&
              responseData.notesTree?.length > 0 &&
              responseData.notesTree[0].type === "folder" &&
              settings.autoExpandNewFolders
            ) {
              expandFolderPath(responseData.notesTree[0].id); // Expand first root folder if any
            }

            resolveOuter({
              success: true,
              message:
                responseData.message || "Data imported and saved successfully.",
            });
          } catch (err) {
            console.error("Import processing error:", err);
            resolveOuter({
              success: false,
              error: `Import error: ${err.message}`,
            });
          }
        };
        reader.onerror = () => {
          console.error("File read error during import.");
          resolveOuter({ success: false, error: "File read error." });
        };
        reader.readAsText(file);
      });
    },
    [
      tree,
      selectedItemId,
      replaceTree,
      settings.autoExpandNewFolders,
      expandFolderPath,
    ]
  );

  const searchItems = useCallback(
    (query, opts) => {
      // Your existing searchItems
      if (!query) return [];
      const results = [];
      const currentTree = tree || [];
      const walk = (nodes, currentPathSegments = []) => {
        if (!Array.isArray(nodes)) return;
        nodes.forEach((it) => {
          if (!it || typeof it.label !== "string") return;
          const itemPath = [...currentPathSegments, it.label].join(" / ");
          if (itemMatches(it, query, opts)) {
            results.push({ ...it, path: itemPath });
          }
          if (it.type === "folder" && Array.isArray(it.children)) {
            walk(it.children, [...currentPathSegments, it.label]);
          }
        });
      };
      walk(currentTree, []);
      return results;
    },
    [tree]
  );

  return {
    tree,
    selectedItem,
    selectedItemId,
    contextMenu,
    expandedFolders,
    draggedId,
    clipboardItem,
    clipboardMode,
    cutItemId,
    setContextMenu,
    setDraggedId,
    selectItemById,
    toggleFolderExpand,
    updateNoteContent,
    updateTask,
    addItem,
    renameItem,
    deleteItem,
    duplicateItem,
    handleDrop,
    copyItem,
    cutItem,
    pasteItem,
    handleExport,
    handleImport,
    searchItems,
    getItemPath,
    expandFolderPath,
    undoTreeChange,
    redoTreeChange,
    canUndoTree,
    canRedoTree,
    resetState: resetTreeHistory,
    fetchUserTree: fetchUserTreeInternal, // Expose the internal fetch function
    isFetchingTree, // Expose loading state
  };
};
