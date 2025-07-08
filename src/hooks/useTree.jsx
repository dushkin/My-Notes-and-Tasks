// src/hooks/useTree.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { LOCAL_STORAGE_KEY } from "../utils/constants";
import {
  sortItems,
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
import { authFetch } from "../services/apiClient";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";

// === FREE PLAN LIMITATION ===
const FREE_PLAN_ITEM_LIMIT = 100;

/** Checks if the user has active paid access (active or cancelled but until period end) */
function hasActiveAccess(user) {
  if (!user) return false;
  if (user.subscriptionStatus === "active") return true;
  if (
    user.subscriptionStatus === "cancelled" &&
    new Date(user.subscriptionEndsAt) > new Date()
  ) {
    return true;
  }
  return false;
}

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

export const assignClientPropsForDuplicate = (item) => {
  const newItem = { ...item };
  const now = new Date().toISOString();

  newItem.id = `client-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .substring(2, 9)}`;
  newItem.createdAt = now;
  newItem.updatedAt = now;

  if (item.type === "folder" && Array.isArray(item.children)) {
    newItem.children = item.children.map((child) =>
      assignClientPropsForDuplicate(child)
    );
  }

  return newItem;
};

const countTotalItems = (nodes) => {
  if (!Array.isArray(nodes)) return 0;
  let count = nodes.length;
  for (const node of nodes) {
    if (node.children && Array.isArray(node.children)) {
      count += countTotalItems(node.children);
    }
  }
  return count;
};

// === MODIFIED: Hook now accepts currentUser to check for role ===
export const useTree = (currentUser) => {
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

  const currentItemCount = useMemo(() => countTotalItems(tree), [tree]);

  const fetchUserTree = useCallback(async () => {
    setIsFetchingTree(true);
    try {
      const response = await authFetch(`/items`, { cache: "no-store" });
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: "Failed to parse error response" }));
        console.error(response.status, errorData);
        resetTreeHistory([]);
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
  }, [resetTreeHistory]);
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

  // Cross-tab sync: reload tree when updated in other tabs
  useEffect(() => {
    const handleSync = () => {
      console.log("Detected tree update in another tab, reloading…");
      fetchUserTree();
    };
    let bc;
    if (typeof BroadcastChannel !== "undefined") {
      bc = new BroadcastChannel("notes-sync");
      bc.onmessage = handleSync;
    } else {
      window.addEventListener("storage", (e) => {
        if (e.key === "notesTreeSync") handleSync();
      });
    }
    return () => {
      if (bc) bc.close();
      window.removeEventListener("storage", handleSync);
    };
  }, [fetchUserTree]);

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
      if (
        currentUser?.role !== "admin" &&
        !hasActiveAccess(currentUser) &&
        currentItemCount >= FREE_PLAN_ITEM_LIMIT
      ) {
        return {
          success: false,
          error:
            "You have reached the 100-item limit for the free plan. Please upgrade to add more.",
        };
      }

      const trimmedLabel = newItemData?.label?.trim();
      if (!trimmedLabel) return { success: false, error: "Label is required." };
      if (!["folder", "note", "task"].includes(newItemData.type))
        return { success: false, error: "Invalid item type." };

      if (parentId === null && newItemData.type !== "folder") {
        return {
          success: false,
          error: "Only folders can be created at the root level.",
        };
      }

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
        const response = await authFetch(endpoint, {
          method: "POST",
          body: JSON.stringify(payload),
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
        if (error && error.message) {
          return { success: false, error: error.message };
        }

        return { success: false, error: "Network error adding item." };
      }
    },
    [
      tree,
      setTreeWithUndo,
      expandFolderPath,
      settings.autoExpandNewFolders,
      currentItemCount,
      currentUser,
    ]
  );
  const updateNoteContent = useCallback(
    async (itemId, updates) => {
      try {
        const response = await authFetch(`/items/${itemId}`, {
          method: "PATCH",
          body: JSON.stringify(updates),
        });
        const updatedItemFromServer = await response.json();

        if (!response.ok) {
          return {
            success: false,
            error: updatedItemFromServer.error || "Failed to update note.",
          };
        }

        await fetchUserTree();

        return { success: true, item: updatedItemFromServer };
      } catch (error) {
        console.error("updateNoteContent API error:", error);
        return { success: false, error: "Network error updating note." };
      }
    },
    // Note that the dependencies for the hook have also changed.
    [fetchUserTree]
  );

  const updateTask = useCallback(
    async (taskId, updates) => {
      if (updates.hasOwnProperty("completed")) {
        const optimisticTreeState = tree.map((item) =>
          updateItemOptimistically(item, taskId, updates)
        );
        setTreeWithUndo(optimisticTreeState);
      }

      try {
        const response = await authFetch(`/items/${taskId}`, {
          method: "PATCH",
          body: JSON.stringify(updates),
        });
        const updatedItemFromServer = await response.json();

        if (!response.ok) {
          if (updates.hasOwnProperty("completed")) {
            const revertedTreeState = tree.map((item) =>
              updateItemOptimistically(item, taskId, {
                completed: !updates.completed,
              })
            );
            setTreeWithUndo(revertedTreeState);
          }
          return {
            success: false,
            error: updatedItemFromServer.error || "Failed to update task.",
          };
        }

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
        const finalTreeState = mapRecursiveTask(
          tree,
          taskId,
          updatedItemFromServer
        );
        setTreeWithUndo(finalTreeState);

        return { success: true, item: updatedItemFromServer };
      } catch (error) {
        console.error("updateTask API error:", error);
        if (updates.hasOwnProperty("completed")) {
          const revertedTreeState = tree.map((item) =>
            updateItemOptimistically(item, taskId, {
              completed: !updates.completed,
            })
          );
          setTreeWithUndo(revertedTreeState);
        }

        return { success: false, error: "Network error updating task." };
      }
    },
    [tree, setTreeWithUndo]
  );
  const updateItemOptimistically = (item, targetId, updates) => {
    if (item.id === targetId) {
      return { ...item, ...updates };
    }
    if (item.children && Array.isArray(item.children)) {
      return {
        ...item,
        children: item.children.map((child) =>
          updateItemOptimistically(child, targetId, updates)
        ),
      };
    }
    return item;
  };

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
        if (error && error.message) {
          return { success: false, error: error.message };
        }

        return { success: false, error: "Network error renaming item." };
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

      // === MODIFIED: Check for user role before applying limit ===
      if (currentUser?.role !== "admin") {
        const itemsToCreate = countTotalItems([itemToDuplicate]);
        if (currentItemCount + itemsToCreate > FREE_PLAN_ITEM_LIMIT) {
          return {
            success: false,
            error: `This action would exceed the 100-item limit for the free plan. Please upgrade.`,
          };
        }
      }

      const { parent } = findParentAndSiblings(tree, itemId);
      const parentId = parent?.id ?? null;

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

      const createItemWithChildren = async (itemData, currentParentId) => {
        const payload = {
          label: itemData.label,
          type: itemData.type,
        };

        if (itemData.type === "note" || itemData.type === "task") {
          payload.content = itemData.content || "";
          payload.direction = itemData.direction || "ltr";
        }
        if (itemData.type === "task") {
          payload.completed = !!itemData.completed;
        }

        try {
          const endpoint = currentParentId
            ? `/items/${currentParentId}`
            : `/items`;
          const response = await authFetch(endpoint, {
            method: "POST",
            body: JSON.stringify(payload),
          });
          const createdItemFromServer = await response.json();

          if (!response.ok) {
            throw new Error(
              createdItemFromServer.error ||
                `Failed to create item: ${response.status}`
            );
          }

          if (
            itemData.type === "folder" &&
            Array.isArray(itemData.children) &&
            itemData.children.length > 0
          ) {
            const createdChildren = [];
            for (const childData of itemData.children) {
              const createdChild = await createItemWithChildren(
                childData,
                createdItemFromServer.id
              );
              if (createdChild) {
                createdChildren.push(createdChild);
              }
            }
            createdItemFromServer.children = createdChildren;
          }

          return createdItemFromServer;
        } catch (error) {
          console.error("Error creating item during duplication:", error);
          throw error;
        }
      };

      try {
        const createdItem = await createItemWithChildren(
          newDuplicateDataForServer,
          parentId
        );
        const newTreeState = insertItemRecursive(tree, parentId, createdItem);
        setTreeWithUndo(newTreeState);

        if (parentId && settings.autoExpandNewFolders) {
          setTimeout(() => expandFolderPath(parentId), 0);
        }

        return { success: true, item: createdItem };
      } catch (error) {
        console.error("duplicateItem error:", error);
        if (error && error.message) {
          return { success: false, error: error.message };
        }

        return { success: false, error: "Network error duplicating item." };
      }
    },
    [
      tree,
      findParentAndSiblings,
      insertItemRecursive,
      setTreeWithUndo,
      settings.autoExpandNewFolders,
      expandFolderPath,
      currentItemCount,
      currentUser,
    ]
  );

  const handleDrop = useCallback(
    async (targetFolderId, droppedItemId) => {
      const currentDraggedId = droppedItemId || draggedId;
      setDraggedId(null);

      if (
        !currentDraggedId ||
        (targetFolderId === currentDraggedId && currentDraggedId !== null)
      ) {
        return {
          success: false,
          error: "Invalid drop: An item cannot be dropped into itself.",
        };
      }

      const itemToDrop = findItemById(tree, currentDraggedId);
      if (!itemToDrop) {
        return { success: false, error: "Dragged item not found." };
      }

      if (targetFolderId === null && itemToDrop.type !== "folder") {
        return {
          success: false,
          error: "Only folders can be moved to the root level.",
        };
      }

      const targetFolder = targetFolderId
        ? findItemById(tree, targetFolderId)
        : null;
      if (targetFolderId && (!targetFolder || targetFolder.type !== "folder")) {
        return {
          success: false,
          error:
            "Invalid target: Drops are only allowed on folders or the root.",
        };
      }

      if (isSelfOrDescendant(tree, currentDraggedId, targetFolderId)) {
        return {
          success: false,
          error:
            "Invalid move: Cannot move a folder into itself or one of its children.",
        };
      }

      const targetChildren = targetFolder ? targetFolder.children || [] : tree;
      if (
        hasSiblingWithName(targetChildren, itemToDrop.label, currentDraggedId)
      ) {
        return {
          success: false,
          error: `An item named "${itemToDrop.label}" already exists in the target location.`,
        };
      }

      const newIndex = targetChildren.length; // Simple append

      try {
        const response = await authFetch(`/items/${currentDraggedId}/move`, {
          method: "PATCH",
          body: JSON.stringify({ newParentId: targetFolderId, newIndex }),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(
            data.error || `Server responded with ${response.status}`
          );
        }

        await fetchUserTree();

        if (targetFolderId) {
          expandFolderPath(targetFolderId);
        }

        return { success: true };
      } catch (err) {
        console.error("Move (handleDrop) API error:", err);
        await fetchUserTree();
        return {
          success: false,
          error: err.message || "A network error occurred during the move.",
        };
      }
    },
    [draggedId, tree, fetchUserTree, expandFolderPath]
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

      if (targetFolderId === null && clipboardItem.type !== "folder") {
        return {
          success: false,
          error: "Only folders can be pasted at the root level.",
        };
      }

      const targetParent = targetFolderId
        ? findItemById(tree, targetFolderId)
        : null;
      if (targetFolderId && (!targetParent || targetParent.type !== "folder")) {
        return {
          success: false,
          error: "Target for paste must be a valid folder or root.",
        };
      }
      if (isSelfOrDescendant(tree, clipboardItem.id, targetFolderId)) {
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
        );
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
        const addResult = await addItem(itemToInsertData, targetFolderId);
        if (
          addResult.success &&
          targetFolderId &&
          settings.autoExpandNewFolders
        ) {
          expandFolderPath(targetFolderId);
        }
        return addResult;
      } else if (clipboardMode === "cut" && cutItemId) {
        const itemToMove = clipboardItem;
        const parentInfo = findParentAndSiblings(tree, cutItemId);
        const oldParentId = parentInfo.parent ? parentInfo.parent.id : null;
        if (oldParentId === targetFolderId) {
          setClipboardItem(null);
          setClipboardMode(null);
          setCutItemId(null);
          return {
            success: true,
            message: "Item is already in the target location.",
          };
        }

        if (hasSiblingWithName(targetSiblings, itemToMove.label, null)) {
          return {
            success: false,
            error: `An item named "${itemToMove.label}" already exists in the target folder. Cut operation cancelled.`,
          };
        }

        const newIndex = targetSiblings.length;
        try {
          const response = await authFetch(`/items/${cutItemId}/move`, {
            method: "PATCH",
            body: JSON.stringify({ newParentId: targetFolderId, newIndex }),
          });
          if (!response.ok) {
            const data = await response.json();
            throw new Error(
              data.error || `Server responded with ${response.status}`
            );
          }
          const data = await response.json();

          setClipboardItem(null);
          setClipboardMode(null);
          setCutItemId(null);

          await fetchUserTree();
          if (targetFolderId && settings.autoExpandNewFolders) {
            expandFolderPath(targetFolderId);
          }

          return { success: true, item: data.data.movedItem };
        } catch (err) {
          console.error("Move (pasteItem) API error:", err);
          await fetchUserTree(); // Resync state on failure
          return {
            success: false,
            error: err.message || "A network error occurred during the move.",
          };
        }
      }
      return { success: false, error: "Invalid paste operation." };
    },
    [
      tree,
      clipboardItem,
      clipboardMode,
      cutItemId,
      settings.autoExpandNewFolders,
      expandFolderPath,
      addItem,
      fetchUserTree,
      currentItemCount,
      currentUser,
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
            let processedTreeForServer;

            if (importTargetOption === "entire") {
              // For entire tree replacement, check for duplicates at root level
              const importedItems = Array.isArray(importedRawData)
                ? importedRawData
                : [importedRawData];

              // Check for duplicate names at root level
              const rootItemNames = new Set();
              for (const item of importedItems) {
                if (!item || typeof item.label !== "string") continue;
                if (rootItemNames.has(item.label)) {
                  resolveOuter({
                    success: false,
                    error: `Duplicate item name "${item.label}" found in import data at root level.`,
                  });
                  return;
                }
                rootItemNames.add(item.label);
              }

              processedTreeForServer = importedItems;
            } else {
              // Import under selected item - check for conflicts with existing siblings
              const itemsToImport = Array.isArray(importedRawData)
                ? importedRawData
                : [importedRawData];

              // Get the target location's existing children
              const targetParent = selectedItemId
                ? findItemById(tree, selectedItemId)
                : null;
              const targetSiblings = targetParent
                ? targetParent.children || []
                : tree;

              // Check each item to import for name conflicts
              for (const itemToImport of itemsToImport) {
                if (!itemToImport || typeof itemToImport.label !== "string")
                  continue;

                if (
                  hasSiblingWithName(targetSiblings, itemToImport.label, null)
                ) {
                  const targetLocation = targetParent
                    ? `folder "${targetParent.label}"`
                    : "root level";
                  resolveOuter({
                    success: false,
                    error: `Cannot import "${itemToImport.label}" - an item with this name already exists in ${targetLocation}.`,
                  });
                  return;
                }
              }

              // Also check for duplicates within the import data itself
              const importNameSet = new Set();
              for (const item of itemsToImport) {
                if (!item || typeof item.label !== "string") continue;
                if (importNameSet.has(item.label)) {
                  resolveOuter({
                    success: false,
                    error: `Duplicate item name "${item.label}" found in import data.`,
                  });
                  return;
                }
                importNameSet.add(item.label);
              }

              // If no conflicts, proceed with import
              let updatedTree = tree;
              itemsToImport.forEach((item) => {
                updatedTree = insertItemRecursive(
                  updatedTree,
                  selectedItemId,
                  item
                );
              });
              processedTreeForServer = updatedTree;
            }

            const response = await authFetch(`/items/tree`, {
              method: "PUT",
              body: JSON.stringify({ newTree: processedTreeForServer }),
            });
            const responseData = await response.json();
            if (!response.ok) {
              console.error("Server error saving imported tree:", responseData);
              resolveOuter({
                success: false,
                error: "Failed to save imported tree to server.",
              });
              return;
            }

            // Refresh tree on success
            await fetchUserTree();
            resolveOuter({
              success: true,
              message: "Import successful! Tree has been updated.",
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
    [tree, selectedItemId, fetchUserTree]
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
  // Make fetchUserTree available globally for debugging
  window.fetchUserTree = fetchUserTree;
  return {
    fetchUserTree,
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
    currentItemCount,
  };
};
