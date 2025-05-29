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
import { jsPDF } from "jspdf"; // Not used in this snippet but keep if used elsewhere
import * as bidiNS from "unicode-bidirectional"; // Not used in this snippet but keep if used elsewhere
import { notoSansHebrewBase64 } from "../fonts/NotoSansHebrewBase64"; // Not used in this snippet
import { useSettings } from "../contexts/SettingsContext";
import { itemMatches } from "../utils/searchUtils";
import { useUndoRedo } from "./useUndoRedo";
import { authFetch } from "../services/apiClient";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";

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

// Renamed and updated function for client-side duplication logic
export const assignClientPropsForDuplicate = (item) => {
  const newItem = { ...item };
  const now = new Date().toISOString();

  // Assign new client-side ID for the duplicate
  newItem.id = `client-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .substring(2, 9)}`;

  // Set client-side timestamps for the duplicate.
  // The backend will override these with server-authoritative timestamps upon saving the new item.
  newItem.createdAt = now;
  newItem.updatedAt = now;

  if (item.type === "folder" && Array.isArray(item.children)) {
    // Recursively assign new IDs and timestamps for children of a duplicated folder
    newItem.children = item.children.map((child) =>
      assignClientPropsForDuplicate(child)
    );
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
  const [isFetchingTree, setIsFetchingTree] = useState(false);

  const selectedItem = useMemo(
    () => findItemById(tree, selectedItemId),
    [tree, selectedItemId]
  );

  const fetchUserTreeInternal = useCallback(
    async (token) => {

      setIsFetchingTree(true);
      try {
        const response = await authFetch(`/items/tree`);

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ message: "Failed to parse error response" }));

          console.error(
            response.status,
            errorData
          );

          resetTreeHistory([]);
          setIsFetchingTree(false);
          return;
        }

        const data = await response.json();

        if (data && Array.isArray(data.notesTree)) {
          resetTreeHistory(data.notesTree);
        } else {
          resetTreeHistory([]);
        }
      } catch (error) {
        resetTreeHistory([]);
      } finally {
        setIsFetchingTree(false);
      }
    },
    [resetTreeHistory]
  );

  useEffect(() => {
    try {
      if (Array.isArray(tree))
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tree));
    } catch (error) {
      console.error("Failed to save tree to localStorage:", error);
    }
  }, [tree]);

  useEffect(() => {
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
    async (newItemData, parentId) => {
      const trimmedLabel = newItemData?.label?.trim();
      if (!trimmedLabel) return { success: false, error: "Label is required." };
      if (!["folder", "note", "task"].includes(newItemData.type))
        return { success: false, error: "Invalid item type." };

      const payload = {
        label: trimmedLabel,
        type: newItemData.type,
      };
      if (newItemData.type === "note" || newItemData.type === "task") {
        payload.content = newItemData.content || "";
        payload.direction = newItemData.direction || "ltr";
      }
      if (newItemData.type === "task") {
        payload.completed = !!newItemData.completed;
      }

      try {
        const endpoint = parentId ? `/items/${parentId}` : `/items`;

        // Use authFetch instead of manual fetch
        const response = await authFetch(endpoint, {
          method: "POST",
          body: JSON.stringify(payload),
          // authFetch handles Content-Type and Authorization headers
        });

        const createdItemFromServer = await response.json();
        if (!response.ok)
          return {
            success: false,
            error:
              createdItemFromServer.error ||
              `Failed to add item: ${response.status}`,
          };

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
        }
        return { success: true, item: createdItemFromServer };
      } catch (error) {
        console.error("addItem API error:", error);
        return { success: false, error: "Network error adding item." };
      }
    },
    [tree, setTreeWithUndo, expandFolderPath, settings.autoExpandNewFolders]
  );

  const updateNoteContent = useCallback(
    async (itemId, updates) => {
      try {
        const response = await authFetch(`/items/${itemId}`, {
          method: "PATCH",
          body: JSON.stringify(updates),
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
    async (taskId, updates) => {
      try {
        const response = await authFetch(`/items/${taskId}`, {
          method: "PATCH",
          body: JSON.stringify(updates),
        });
        const updatedItemFromServer = await response.json();
        if (!response.ok)
          return {
            success: false,
            error: updatedItemFromServer.error || "Failed to update task.",
          };

        const mapRecursiveTask = (items, id, serverUpdates) =>
          items.map((i) =>
            i.id === id
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
    async (itemId, newLabel) => {
      const trimmedLabel = newLabel?.trim();
      if (!trimmedLabel || !itemId)
        return { success: false, error: "Invalid ID or name." };

      const { parentArray } = findParentAndSiblings(tree, itemId);

      if (hasSiblingWithName(parentArray || tree, trimmedLabel, itemId)) {
        return {
          success: false,
          error: `Item "${trimmedLabel}" already exists.`,
        };
      }

      try {
        const response = await authFetch(`/items/${itemId}`, {
          method: "PATCH",
          body: JSON.stringify({ label: trimmedLabel }),
        });
        const updatedItemFromServer = await response.json();
        if (!response.ok)
          return {
            success: false,
            error: updatedItemFromServer.error || "Rename failed.",
          };

        const mapRecursiveRename = (items, id, serverUpdates) =>
          items.map((i) =>
            i.id === id
              ? { ...i, ...serverUpdates }
              : Array.isArray(i.children)
              ? {
                  ...i,
                  children: mapRecursiveRename(i.children, id, serverUpdates),
                }
              : i
          );
        const newTreeState = mapRecursiveRename(
          tree,
          itemId,
          updatedItemFromServer
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
    async (idToDelete) => {
      if (!idToDelete) return { success: false, error: "No ID for deletion." };

      try {
        const response = await authFetch(`/items/${idToDelete}`, {
          method: "DELETE",
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
        return { success: true };
      } catch (error) {
        console.error("deleteItem API error:", error);
        return { success: false, error: "Network error deleting." };
      }
    },
    [tree, selectedItemId, setTreeWithUndo]
  );

  const duplicateItem = useCallback(
    async (itemId) => {
      const itemToDuplicate = findItemById(tree, itemId);
      if (!itemToDuplicate)
        return { success: false, error: "Item to duplicate not found." };
      const { parent } = findParentAndSiblings(tree, itemId);
      const parentId = parent?.id ?? null;

      // Use the renamed and updated function
      let newDuplicateDataForServer = assignClientPropsForDuplicate(
        structuredClone(itemToDuplicate)
      );

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
      newDuplicateDataForServer.label = newLabel;
      // Client-side createdAt/updatedAt are set by assignClientPropsForDuplicate
      // Backend will create its own authoritative timestamps for the new item.

      const result = await addItem(newDuplicateDataForServer, parentId);
      // addItem sends necessary fields (label, type, content, etc.)
      // The id, createdAt, updatedAt from newDuplicateDataForServer are for optimistic client-side state,
      // but the backend will generate its own id and timestamps for the actual new item.
      // The `result.item` from `addItem` will contain the server-authoritative item.

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
    async (targetFolderId, droppedItemId) => {
      // This function primarily updates client-side state.
      // The actual persistence of the move (and timestamp updates)
      // will happen when the entire tree is sent to the backend,
      // likely via replaceUserTree, where the backend's
      // ensureServerSideIdsAndStructure will update all `updatedAt` timestamps.
      // For more granular server-side timestamp updates on move,
      // a dedicated backend endpoint for moving items would be needed.

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
          error: "Cannot drop folder into itself or one ofits descendants.",
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

      // Optimistically update client-side timestamps for immediate feedback
      const now = new Date().toISOString();
      const updatedItemToDrop = {
        ...structuredClone(itemToDrop),
        updatedAt: now,
      };

      // Remove original, then insert copy with updated timestamp
      let newTreeState = deleteItemRecursive(tree, currentDraggedId);
      newTreeState = insertItemRecursive(
        newTreeState,
        targetFolderId,
        updatedItemToDrop // Insert the copy which has the client-side updated timestamp
      );

      // Update timestamp of parent folder(s) client-side as well
      const updateParentTimestamp = (nodes, parentIdToUpdate) => {
        return nodes.map((node) => {
          if (node.id === parentIdToUpdate) {
            return { ...node, updatedAt: now };
          }
          if (node.children && Array.isArray(node.children)) {
            return {
              ...node,
              children: updateParentTimestamp(node.children, parentIdToUpdate),
            };
          }
          return node;
        });
      };

      if (targetFolderId) {
        newTreeState = updateParentTimestamp(newTreeState, targetFolderId);
      }
      const oldParent = findParentAndSiblings(tree, currentDraggedId)?.parent;
      if (oldParent?.id && oldParent.id !== targetFolderId) {
        newTreeState = updateParentTimestamp(newTreeState, oldParent.id);
      }

      if (newTreeState) {
        setTreeWithUndo(newTreeState);
        if (settings.autoExpandNewFolders && targetFolderId) {
          setTimeout(() => expandFolderPath(targetFolderId), 0);
        }
        return {
          success: true,
          message:
            "Item moved locally. Save tree to persist changes with server timestamps.",
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
    ]
  );

  const copyItem = useCallback(
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
    async (targetFolderId) => {
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

      if (clipboardMode === "copy") {
        let itemToInsertData = assignClientPropsForDuplicate(
          structuredClone(clipboardItem)
        ); // Use the new function

        let baseName = clipboardItem.label;
        let newLabel = baseName;
        let copyCounter = 0;
        while (hasSiblingWithName(targetSiblings, newLabel, null)) {
          copyCounter++;
          newLabel = `${baseName} (copy${
            copyCounter > 1 ? ` ${copyCounter}` : ""
          })`;
        }
        itemToInsertData.label = newLabel;
        // Timestamps (createdAt, updatedAt) are set by assignClientPropsForDuplicate
        // The backend will handle authoritative timestamps upon saving.

        const addResult = await addItem(itemToInsertData, targetFolderId);
        if (
          addResult.success &&
          targetFolderId &&
          settings.autoExpandNewFolders
        )
          expandFolderPath(targetFolderId);

        // Clear clipboard after successful paste if desired
        // setClipboardItem(null);
        // setClipboardMode(null);
        return addResult;
      } else if (clipboardMode === "cut" && cutItemId) {
        const itemToMove = structuredClone(clipboardItem);
        if (
          findParentAndSiblings(tree, cutItemId)?.parent?.id ===
            targetFolderId &&
          itemToMove.label === clipboardItem.label // No name change essentially means pasting in same place
        ) {
          // If cutting and pasting into the same parent folder without a name change,
          // it's effectively a no-op for structure, but we clear the clipboard.
          setClipboardItem(null);
          setClipboardMode(null);
          setCutItemId(null);
          return {
            success: true,
            item: itemToMove, // Return the item that was "moved"
            message: "Item 'pasted' in the same location. Clipboard cleared.",
          };
        }

        if (hasSiblingWithName(targetSiblings, itemToMove.label, null)) {
          // excludeId should be null if it's a "new" item in the target
          // If name conflict, do not proceed with cut-paste
          return {
            success: false,
            error: `An item named "${itemToMove.label}" already exists in the target folder. Cut operation cancelled.`,
          };
        }

        // Optimistic client-side update for cut-paste
        const now = new Date().toISOString();
        itemToMove.updatedAt = now; // Client-side optimistic update

        let tempTree = deleteItemRecursive(tree, cutItemId);
        tempTree = insertItemRecursive(tempTree, targetFolderId, itemToMove);

        // Update parent timestamps optimistically
        const updateParentTimestamp = (nodes, parentIdToUpdate) => {
          return nodes.map((node) => {
            if (node.id === parentIdToUpdate) {
              return { ...node, updatedAt: now };
            }
            if (node.children && Array.isArray(node.children)) {
              return {
                ...node,
                children: updateParentTimestamp(
                  node.children,
                  parentIdToUpdate
                ),
              };
            }
            return node;
          });
        };
        if (targetFolderId) {
          tempTree = updateParentTimestamp(tempTree, targetFolderId);
        }
        const oldParent = findParentAndSiblings(tree, cutItemId)?.parent;
        if (oldParent?.id && oldParent.id !== targetFolderId) {
          tempTree = updateParentTimestamp(tempTree, oldParent.id);
        }

        setTreeWithUndo(tempTree);

        // Clear clipboard after cut-paste
        const originalCutItem = clipboardItem; // Hold reference before clearing
        setClipboardItem(null);
        setClipboardMode(null);
        setCutItemId(null);

        if (targetFolderId && settings.autoExpandNewFolders)
          expandFolderPath(targetFolderId);

        return {
          success: true,
          item: originalCutItem, // Return the item that was conceptually moved
          message:
            "Item moved locally. Save tree to persist changes with server timestamps.",
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
      addItem, // addItem is used for copy-paste
    ]
  );

  const handleExport = useCallback(
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
        // PDF export logic (placeholder)
        alert("PDF export is not yet fully implemented.");
      }
    },
    [tree, selectedItemId]
  );

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
            const importedRawData = JSON.parse(e.target.result);

            // Remove manual token check
            // const token = getAuthToken();
            // if (!token) {
            //     resolveOuter({
            //         success: false,
            //         error: "Authentication required to save imported data.",
            //     });
            //     return;
            // }

            let processedTreeForServer;

            if (importTargetOption === "entire") {
              processedTreeForServer = Array.isArray(importedRawData)
                ? importedRawData
                : [importedRawData];
            } else {
              // ... rest of the logic for "selected" option
            }

            // Use authFetch instead of manual fetch
            const response = await authFetch(`/items/tree`, {
              method: "PUT",
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

            // ... rest of the function
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

  window.fetchUserTree = fetchUserTreeInternal;

  return {
    fetchUserTree: fetchUserTreeInternal,
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
    isFetchingTree,
  };
};
