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
import * as bidiNS from "unicode-bidirectional"; // Make sure this import is correct based on library usage
import { notoSansHebrewBase64 } from "../fonts/NotoSansHebrewBase64";
import { useSettings } from "../contexts/SettingsContext";
import { itemMatches } from "../utils/searchUtils"; // matchText is not directly used here, but itemMatches is
import { useUndoRedo } from "./useUndoRedo";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";

const getAuthToken = () => {
  const token = localStorage.getItem("userToken");
  if (!token) {
    // This console.warn is helpful during development
    // console.warn("getAuthToken: No token found in localStorage with key 'userToken'");
  }
  return token;
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

// Updated assignNewIds for client-side duplication/temp IDs more clearly
const assignNewIds = (item, isDuplication = false) => {
  const newItem = { ...item };

  // For duplications, or if an item truly needs a new client-side ID before server sync
  if (isDuplication || !item.id || item.id.startsWith("temp-")) {
    newItem.id = `client-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .substring(2, 9)}`;
  }

  if (item.type === "folder") {
    newItem.children = Array.isArray(item.children)
      ? item.children.map((child) => assignNewIds(child, isDuplication)) // Pass down isDuplication flag
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
      console.error(
        "Failed to load or parse tree from localStorage for initial state:",
        error
      );
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
    } catch (error) {
      return {};
    }
  });
  const [draggedId, setDraggedId] = useState(null);
  const [clipboardItem, setClipboardItem] = useState(null);
  const [clipboardMode, setClipboardMode] = useState(null);
  const [cutItemId, setCutItemId] = useState(null);

  const selectedItem = useMemo(
    () => findItemById(tree, selectedItemId),
    [tree, selectedItemId]
  );

  useEffect(() => {
    const fetchTreeFromServer = async () => {
      const token = getAuthToken();
      if (!token) {
        console.log(
          "useTree Effect: No token, using local tree (if any) or empty tree."
        );
        // resetTreeHistory([]); // Optionally clear local tree if no token
        return;
      }
      console.log(
        "useTree Effect: Token found, attempting to fetch tree from server."
      );
      try {
        const response = await fetch(`${API_BASE_URL}/items/tree`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log(
          "useTree Effect: fetchTreeFromServer response status:",
          response.status
        );
        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Failed to parse error response" }));
          if (response.status === 401) {
            console.error(
              "useTree Effect: Unauthorized (401) to fetch tree. Clearing local token."
            );
            localStorage.removeItem("userToken");
            resetTreeHistory([]);
            // Consider calling a global logout function or redirecting to login here
          } else {
            console.error(
              "useTree Effect: Server error fetching tree:",
              response.status,
              errorData
            );
            // Fallback to local tree or empty if preferred, instead of throwing
            // throw new Error(errorData.error || `Failed to fetch tree: ${response.statusText}`);
          }
          return;
        }
        const data = await response.json();
        if (data && Array.isArray(data.notesTree)) {
          console.log(
            "useTree Effect: Successfully fetched tree, resetting local state."
          );
          resetTreeHistory(data.notesTree);
        } else {
          console.warn(
            "useTree Effect: Fetched tree data is not in expected format, resetting to empty."
          );
          resetTreeHistory([]);
        }
      } catch (error) {
        console.error(
          "useTree Effect: Network or other error fetching tree from server:",
          error
        );
      }
    };
    fetchTreeFromServer();
  }, [resetTreeHistory]); // Only depends on resetTreeHistory (which is stable)

  useEffect(() => {
    // Save tree to localStorage (could be for offline or quick load)
    try {
      if (!Array.isArray(tree)) {
        console.error(
          "Attempted to save non-array tree data to localStorage:",
          tree
        );
        return;
      }
      // Avoid overwriting a potentially empty tree if it's still loading from server
      // Or simply save whatever `tree` is.
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tree));
    } catch (error) {
      console.error("Failed to save tree to localStorage:", error);
    }
  }, [tree]);

  useEffect(() => {
    // Save expanded folders
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
      } else {
        console.error(
          "replaceTree failed: Provided data is not an array.",
          newTreeData
        );
        return { success: false, error: "Import failed: Invalid data format." };
      }
    },
    [resetTreeHistory]
  );

  const expandFolderPath = useCallback(
    (folderId) => {
      if (!folderId) return;
      const findAncestors = (nodes, id, ancestors = []) => {
        if (!Array.isArray(nodes)) return null;
        for (const item of nodes) {
          if (item.id === id) return ancestors;
          if (item.type === "folder" && Array.isArray(item.children)) {
            const found = findAncestors(item.children, id, [
              ...ancestors,
              item.id,
            ]);
            if (found) return found;
          }
        }
        return null;
      };
      const currentTree = Array.isArray(tree) ? tree : [];
      const ancestors = findAncestors(currentTree, folderId);
      setExpandedFolders((prev) => {
        const next = { ...prev };
        if (ancestors) {
          ancestors.forEach((pid) => (next[pid] = true));
        }
        const targetItem = findItemById(currentTree, folderId);
        if (targetItem) next[folderId] = true;
        return next;
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
      console.log(
        `useTree: addItem - Called. newItemData:`,
        JSON.stringify(newItemData),
        `ParentID: ${parentId}`
      );

      const trimmedLabel = newItemData?.label?.trim();
      if (!newItemData || !trimmedLabel) {
        console.error(
          "useTree: addItem - Validation failed: Label is required."
        );
        return {
          success: false,
          error: "Invalid item data: Label is required.",
        };
      }
      if (!["folder", "note", "task"].includes(newItemData.type)) {
        console.error(
          `useTree: addItem - Validation failed: Invalid item type "${newItemData.type}".`
        );
        return { success: false, error: "Invalid item type." };
      }

      const token = getAuthToken();
      if (!token) {
        console.error(
          "useTree: addItem - No auth token found. Aborting API call."
        );
        return {
          success: false,
          error: "Authentication required. Please log in.",
        };
      }
      

      const payload = {
        label: trimmedLabel,
        type: newItemData.type,
      };
      if (newItemData.type === "note" || newItemData.type === "task") {
        payload.content = newItemData.content || ""; // Ensure content is at least an empty string
      }
      if (newItemData.type === "task") {
        payload.completed = !!newItemData.completed; // Ensure boolean
      }

      console.log(
        `useTree: addItem - Prepared payload for server:`,
        JSON.stringify(payload)
      );

      try {
        let endpoint = `${API_BASE_URL}/items`;
        if (parentId) {
          endpoint = `${API_BASE_URL}/items/${parentId}`;
        }
        

        console.log(
          `useTree: addItem - Initiating POST request to ${endpoint}`
        );
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        console.log(
          `useTree: addItem - Server response status: ${response.status} ${response.statusText}`
        );

        const responseBodyText = await response.text(); // Get response as text first for logging
        let responseData;
        try {
          responseData = JSON.parse(responseBodyText);
        } catch (parseError) {
          console.error(
            "useTree: addItem - Failed to parse server JSON response:",
            responseBodyText
          );
          // If server sent non-JSON error (like HTML for a 500 error page from a proxy)
          return {
            success: false,
            error: `Server returned non-JSON response (Status: ${response.status}). Check server logs.`,
          };
        }

        if (!response.ok) {
          console.error(
            "useTree: addItem - Server returned an error:",
            response.status,
            responseData
          );
          return {
            success: false,
            error:
              responseData.error ||
              `Failed to add item: Server responded with ${response.status}`,
          };
        }

        const createdItemFromServer = responseData; // Already parsed
        console.log(
          "useTree: addItem - Item successfully created on server:",
          JSON.stringify(createdItemFromServer, null, 2)
        );

        // Update local state with the item *returned from the server* (it has the server-generated ID)
        const newTreeState = insertItemRecursive(
          tree,
          parentId,
          createdItemFromServer
        );
        console.log(
          "useTree: addItem - Local tree state updated with server item."
        );
        setTreeWithUndo(newTreeState);

        if (parentId && settings.autoExpandNewFolders) {
          console.log(
            `useTree: addItem - Expanding folder path for parentId: ${parentId}`
          );
          setTimeout(() => expandFolderPath(parentId), 0);
        }
        return { success: true, item: createdItemFromServer };
      } catch (error) {
        console.error(
          "useTree: addItem - Network error or other exception during fetch:",
          error
        );
        // Check if it's a TypeError (e.g., API_BASE_URL is undefined)
        if (error instanceof TypeError) {
          console.error(
            "useTree: addItem - TypeError, check API_BASE_URL or network configuration.",
            error.message
          );
          return {
            success: false,
            error: `Configuration or Network error: ${error.message}`,
          };
        }
        return {
          success: false,
          error: "Network error or unexpected issue. Could not add item.",
        };
      }
    },
    [tree, setTreeWithUndo, expandFolderPath, settings.autoExpandNewFolders]
  );

  const updateNoteContent = useCallback(
    async (itemId, content) => {
      console.log(
        `useTree: updateNoteContent for item ${itemId}. Content snippet: ${
          typeof content === "string"
            ? content.substring(0, 30)
            : "[non-string content]"
        }...`
      );
      const token = getAuthToken();
      if (!token) {
        console.error(
          "useTree: updateNoteContent - No auth token found. Aborting API call."
        );
        return { success: false, error: "Authentication required." };
      }
      console.log(
        `useTree: updateNoteContent - Token found. Preparing to PATCH for item ${itemId}.`
      );
      try {
        const response = await fetch(`${API_BASE_URL}/items/${itemId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content }),
        });
        console.log(
          `useTree: updateNoteContent - Fetch response status for item ${itemId}: ${response.status}`
        );
        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Failed to parse server error response" }));
          console.error(
            "useTree: Server error updating note content:",
            response.status,
            errorData
          );
          return {
            success: false,
            error: errorData.error || "Failed to update note content.",
          };
        }
        const updatedItemFromServer = await response.json();
        console.log(
          `useTree: updateNoteContent - Successfully updated item ${itemId} on server. Response:`,
          updatedItemFromServer
        );
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
        console.error(
          `useTree: Network or other error updating note content for item ${itemId}:`,
          error
        );
        return {
          success: false,
          error: "Network error. Could not update note content.",
        };
      }
    },
    [tree, setTreeWithUndo]
  );

  const updateTask = useCallback(
    async (taskId, clientUpdates) => {
      console.log(
        `useTree: updateTask called for item ${taskId} with updates:`,
        clientUpdates
      );
      const token = getAuthToken();
      if (!token) {
        console.error(
          "useTree: updateTask - No auth token found. Aborting API call."
        );
        return { success: false, error: "Authentication required." };
      }
      console.log(
        `useTree: updateTask - Token found. Preparing to PATCH for item ${taskId}.`
      );
      try {
        const response = await fetch(`${API_BASE_URL}/items/${taskId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(clientUpdates),
        });
        console.log(
          `useTree: updateTask - Fetch response status for item ${taskId}: ${response.status}`
        );
        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Failed to parse server error response" }));
          console.error(
            "useTree: Server error updating task:",
            response.status,
            errorData
          );
          return {
            success: false,
            error: errorData.error || "Failed to update task.",
          };
        }
        const updatedItemFromServer = await response.json();
        console.log(
          `useTree: updateTask - Successfully updated item ${taskId} on server. Response:`,
          updatedItemFromServer
        );
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
        console.error(
          `useTree: Network or other error updating task for item ${taskId}:`,
          error
        );
        return {
          success: false,
          error: "Network error. Could not update task.",
        };
      }
    },
    [tree, setTreeWithUndo]
  );

  const renameItem = useCallback(
    async (itemId, newLabel) => {
      
      const trimmedLabel = newLabel?.trim();
      if (!trimmedLabel || !itemId)
        return { success: false, error: "Invalid ID or name." };
      const token = getAuthToken();
      if (!token) return { success: false, error: "Authentication required." };
      const { parentArray } = findParentAndSiblings(tree, itemId);
      if (hasSiblingWithName(parentArray, trimmedLabel, itemId)) {
        return {
          success: false,
          error: `Item "${trimmedLabel}" already exists in this location.`,
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
        console.log(
          `useTree: renameItem - Server response status: ${response.status}`
        );
        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Failed to parse server error response" }));
          console.error("useTree: Server error renaming item:", errorData);
          return {
            success: false,
            error: errorData.error || "Failed to rename item.",
          };
        }
        const updatedItemFromServer = await response.json();
        console.log(
          "useTree: renameItem - Item renamed on server:",
          updatedItemFromServer
        );
        const newTreeState = renameItemRecursive(
          tree,
          itemId,
          updatedItemFromServer.label
        );
        setTreeWithUndo(newTreeState);
        return { success: true, item: updatedItemFromServer };
      } catch (error) {
        console.error("useTree: Network error renaming item:", error);
        return {
          success: false,
          error: "Network error. Could not rename item.",
        };
      }
    },
    [tree, setTreeWithUndo]
  );

  const deleteItem = useCallback(
    async (idToDelete) => {
      
      if (!idToDelete)
        return { success: false, error: "No ID provided for deletion." };
      const token = getAuthToken();
      if (!token) return { success: false, error: "Authentication required." };
      try {
        const response = await fetch(`${API_BASE_URL}/items/${idToDelete}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log(
          `useTree: deleteItem - Server response status: ${response.status}`
        );
        if (!response.ok) {
          if (response.status === 404) {
            console.warn(
              `useTree: Item ${idToDelete} not found on server for deletion.`
            );
          } else {
            const errorData = await response.json().catch(() => ({
              error: "Failed to parse server error response",
            }));
            console.error("useTree: Server error deleting item:", errorData);
            return {
              success: false,
              error: errorData.error || "Failed to delete item on server.",
            };
          }
        }
        // Proceed with local deletion even if server 404'd (already deleted)
        const newTreeState = deleteItemRecursive(tree, idToDelete);
        setTreeWithUndo(newTreeState);
        if (selectedItemId === idToDelete) setSelectedItemId(null);
        setExpandedFolders((prev) => {
          if (prev.hasOwnProperty(idToDelete)) {
            const next = { ...prev };
            delete next[idToDelete];
            return next;
          }
          return prev;
        });
        setContextMenu((m) => (m.visible ? { ...m, visible: false } : m));
        
        return { success: true };
      } catch (error) {
        console.error("useTree: Network error deleting item:", error);
        return {
          success: false,
          error: "Network error. Could not delete item.",
        };
      }
    },
    [tree, selectedItemId, setTreeWithUndo] // Removed setContextMenu and setExpandedFolders if they don't change often
  );

  const duplicateItem = useCallback(
    async (itemId) => {
      console.warn(
        "useTree: duplicateItem - This function is mostly client-side. Server logic for true duplication with new IDs is needed."
      );
      const itemToDuplicate = findItemById(tree, itemId);
      if (!itemToDuplicate)
        return { success: false, error: "Item to duplicate not found." };
      const { parent, siblings } = findParentAndSiblings(tree, itemId);
      const parentId = parent?.id ?? null;
      let tempDuplicate = assignNewIds(structuredClone(itemToDuplicate), true); // Pass true for isDuplication
      let baseName = itemToDuplicate.label;
      let newLabel = `${baseName} (copy)`;
      let counter = 1;
      while (hasSiblingWithName(siblings, newLabel, null)) {
        counter++;
        newLabel = `${baseName} (copy ${counter})`;
      }
      tempDuplicate.label = newLabel;
      // Client-side simulation:
      const newTreeState = insertItemRecursive(tree, parentId, tempDuplicate);
      setTreeWithUndo(newTreeState);
      if (parentId && settings.autoExpandNewFolders) {
        setTimeout(() => expandFolderPath(parentId), 0);
      }
      setContextMenu((m) => ({ ...m, visible: false }));
      return { success: true, item: tempDuplicate };
    },
    [tree, setTreeWithUndo, expandFolderPath, settings.autoExpandNewFolders]
  );

  const handleDrop = useCallback(
    async (targetFolderId, droppedItemId) => {
      console.warn(
        "useTree: handleDrop (moving items) is mostly client-side. Robust server logic needed."
      );
      const currentDraggedId = droppedItemId || draggedId;
      setDraggedId(null);
      if (!currentDraggedId || targetFolderId === currentDraggedId)
        return { success: false, error: "Invalid drop." };
      const itemToDrop = findItemById(tree, currentDraggedId);
      const targetFolder = findItemById(tree, targetFolderId);
      if (!itemToDrop || !targetFolder || targetFolder.type !== "folder")
        return { success: false, error: "Invalid item/target." };
      if (
        itemToDrop.type === "folder" &&
        isSelfOrDescendant(tree, itemToDrop.id, targetFolderId)
      ) {
        return {
          success: false,
          error: "Cannot drop folder into itself/descendant.",
        };
      }
      if (
        hasSiblingWithName(targetFolder.children || [], itemToDrop.label, null)
      ) {
        return {
          success: false,
          error: `Item named "${itemToDrop.label}" already exists in target.`,
        };
      }
      const localTreeAfterDrop = treeHandleDropUtil(
        tree,
        targetFolderId,
        currentDraggedId
      );
      if (localTreeAfterDrop) {
        setTreeWithUndo(localTreeAfterDrop);
        if (settings.autoExpandNewFolders)
          toggleFolderExpand(targetFolderId, true);
        // TODO: API call to persist move on server
        return { success: true, message: "Local drop ok. Server sync needed." };
      }
      return { success: false, error: "Local drop failed." };
    },
    [
      draggedId,
      tree,
      setTreeWithUndo,
      toggleFolderExpand,
      settings.autoExpandNewFolders,
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
      setContextMenu((m) => ({ ...m, visible: false }));
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
      setContextMenu((m) => ({ ...m, visible: false }));
    },
    [tree]
  );

  const pasteItem = useCallback(
    async (targetFolderId) => {
      console.warn(
        "useTree: pasteItem is mostly client-side. Robust server logic needed for cut/paste persistence."
      );
      if (!clipboardItem) return { success: false, error: "Clipboard empty." };
      const token = getAuthToken();
      if (!token && clipboardMode === "cut" /* server ops */)
        return { success: false, error: "Auth required." };

      if (
        clipboardItem.type === "folder" &&
        isSelfOrDescendant(tree, clipboardItem.id, targetFolderId)
      ) {
        return {
          success: false,
          error: "Cannot paste folder into self/descendant.",
        };
      }
      const targetParent = targetFolderId
        ? findItemById(tree, targetFolderId)
        : null;
      if (targetFolderId && (!targetParent || targetParent.type !== "folder")) {
        return {
          success: false,
          error: "Target for paste not a valid folder.",
        };
      }
      const targetSiblings = targetFolderId
        ? targetParent.children || []
        : tree;
      let itemToInsert = structuredClone(clipboardItem);

      if (clipboardMode === "copy") {
        itemToInsert = assignNewIds(itemToInsert, true); // New IDs for copy
        let baseName = itemToInsert.label;
        let newLabel = baseName;
        let counter = 0;
        while (hasSiblingWithName(targetSiblings, newLabel, null)) {
          counter++;
          newLabel = `${baseName} (copy${counter > 1 ? ` ${counter}` : ""})`;
        }
        itemToInsert.label = newLabel;
        // TODO: API call to server to create 'itemToInsert' under 'targetFolderId'
      } else if (clipboardMode === "cut") {
        const isSameParent =
          findParentAndSiblings(tree, cutItemId)?.parent?.id === targetFolderId;
        if (
          !isSameParent &&
          hasSiblingWithName(targetSiblings, itemToInsert.label, cutItemId)
        ) {
          return {
            success: false,
            error: `Item named "${itemToInsert.label}" already exists.`,
          };
        }
        // TODO: API call to server: 1. Delete 'cutItemId'. 2. Create/move 'itemToInsert' (with original ID if possible) to 'targetFolderId'.
      }

      let newTreeState = insertItemRecursive(
        tree,
        targetFolderId,
        itemToInsert
      );
      if (clipboardMode === "cut" && cutItemId) {
        const pastedItemExists = findItemById(newTreeState, itemToInsert.id);
        if (pastedItemExists) {
          newTreeState = deleteItemRecursive(newTreeState, cutItemId);
        } else {
          return { success: false, error: "Local paste (cut) error." };
        }
      }
      setTreeWithUndo(newTreeState);
      if (clipboardMode === "cut") {
        setClipboardItem(null);
        setClipboardMode(null);
        setCutItemId(null);
      }
      if (targetFolderId && settings.autoExpandNewFolders) {
        setTimeout(() => expandFolderPath(targetFolderId), 0);
      }
      setContextMenu((m) => ({ ...m, visible: false }));
      return { success: true, item: itemToInsert };
    },
    [
      tree,
      clipboardItem,
      clipboardMode,
      cutItemId,
      setTreeWithUndo,
      settings.autoExpandNewFolders,
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
        try {
          const doc = new jsPDF();
          const FONT_NAME = "NotoSansHebrew",
            FONT_FILENAME = "NotoSansHebrew-Regular.ttf";
          const FONT_STYLE_NORMAL = "normal",
            FONT_STYLE_BOLD = "bold";
          if (notoSansHebrewBase64) {
            try {
              if (!doc.getFileFromVFS(FONT_FILENAME))
                doc.addFileToVFS(FONT_FILENAME, notoSansHebrewBase64);
              doc.addFont(FONT_FILENAME, FONT_NAME, FONT_STYLE_NORMAL);
              doc.addFont(FONT_FILENAME, FONT_NAME, FONT_STYLE_BOLD);
              doc.setFont(FONT_NAME, FONT_STYLE_NORMAL);
            } catch (fontError) {
              console.error("PDF Font setup error:", fontError);
              alert("Font error during PDF export.");
            }
          } else {
            console.warn("Hebrew font data not available for PDF export.");
          }

          const PAGE_MARGIN = 15,
            FONT_SIZE_LABEL = 12,
            FONT_SIZE_CONTENT = 10;
          const lineHeightFactor = doc.getLineHeightFactor
            ? doc.getLineHeightFactor()
            : 1.15;
          const LINE_SPACING_LABEL = FONT_SIZE_LABEL * lineHeightFactor,
            LINE_SPACING_CONTENT = FONT_SIZE_CONTENT * lineHeightFactor;
          const CONTENT_INDENT = 5;
          let cursorY = PAGE_MARGIN;
          const pageHeight = doc.internal.pageSize.getHeight(),
            pageWidth = doc.internal.pageSize.getWidth();
          const maxLineWidth = pageWidth - PAGE_MARGIN * 2;

          const addText = (text, x, y, options = {}) => {
            const {
              fontSize = FONT_SIZE_CONTENT,
              fontStyle = FONT_STYLE_NORMAL,
              isLabel = false,
            } = options;
            const currentLineHeight = isLabel
              ? LINE_SPACING_LABEL
              : LINE_SPACING_CONTENT;
            doc.setFont(FONT_NAME, fontStyle);
            doc.setFontSize(fontSize);
            const availableWidth = maxLineWidth - (x - PAGE_MARGIN);
            let processedTextForRendering = text;
            if (/[\u0590-\u05FF]/.test(text)) {
              // needsBiDi
              try {
                processedTextForRendering = reorder(
                  text,
                  embeddingLevels(text)
                );
              } catch (bidiError) {
                console.error("BiDi PDF error:", bidiError);
              }
            }
            const lines = doc.splitTextToSize(
              processedTextForRendering,
              availableWidth
            );
            lines.forEach((line) => {
              if (cursorY + currentLineHeight > pageHeight - PAGE_MARGIN) {
                doc.addPage();
                cursorY = PAGE_MARGIN;
                doc.setFont(FONT_NAME, fontStyle);
                doc.setFontSize(fontSize);
              }
              const isRTL = /[\u0590-\u05FF]/.test(line);
              doc.text(line, isRTL ? pageWidth - x : x, cursorY, {
                align: isRTL ? "right" : "left",
                lang: isRTL ? "he" : undefined,
              });
              cursorY += currentLineHeight;
            });
            if (lines.length > 0) cursorY += currentLineHeight * 0.3;
          };

          const buildPdfContent = (item, indentLevel = 0) => {
            if (!item) return;
            const currentIndent = PAGE_MARGIN + indentLevel * 10;
            const labelIcon =
              item.type === "folder"
                ? "📁"
                : item.type === "note"
                ? "📝"
                : item.type === "task"
                ? item.completed
                  ? "✅"
                  : "⬜️"
                : "❓";
            addText(
              `${labelIcon} ${item.label || "Untitled"}`,
              currentIndent,
              cursorY,
              {
                fontSize: FONT_SIZE_LABEL,
                fontStyle: FONT_STYLE_BOLD,
                isLabel: true,
              }
            );
            if (
              item.content &&
              (item.type === "note" || item.type === "task")
            ) {
              const plainTextContent = htmlToPlainTextWithNewlines(
                item.content
              );
              if (plainTextContent)
                addText(
                  plainTextContent,
                  currentIndent + CONTENT_INDENT,
                  cursorY,
                  { fontSize: FONT_SIZE_CONTENT, fontStyle: FONT_STYLE_NORMAL }
                );
            }
            if (
              item.type === "folder" &&
              Array.isArray(item.children) &&
              item.children.length > 0
            ) {
              cursorY += LINE_SPACING_CONTENT * 0.5;
              sortItems(item.children).forEach((child) =>
                buildPdfContent(child, indentLevel + 1)
              );
            }
          };
          doc.setFont(FONT_NAME, FONT_STYLE_NORMAL);
          doc.setFontSize(FONT_SIZE_CONTENT);
          if (target === "selected" && dataToExport)
            buildPdfContent(dataToExport, 0);
          else if (Array.isArray(dataToExport)) {
            sortItems(dataToExport).forEach((item, index) => {
              buildPdfContent(item, 0);
              if (index < dataToExport.length - 1) {
                cursorY += LINE_SPACING_LABEL;
                if (
                  cursorY >
                  pageHeight - PAGE_MARGIN - LINE_SPACING_LABEL * 2
                ) {
                  doc.addPage();
                  cursorY = PAGE_MARGIN;
                }
              }
            });
          }
          doc.save(fileName + ".pdf");
        } catch (error) {
          console.error("PDF export failed:", error);
          alert("Failed to generate PDF.");
        }
      }
    },
    [tree, selectedItemId]
  );

  const handleImport = useCallback(
    (file, importTargetOption) => {
      console.warn(
        "useTree: handleImport is mostly client-side. Robust server logic needed."
      );
      return new Promise((resolve) => {
        if (!file || file.type !== "application/json") {
          resolve({ success: false, error: "Please select a JSON file." });
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const importedData = JSON.parse(e.target.result);
            if (importTargetOption === "tree") {
              const newTree = Array.isArray(importedData)
                ? importedData.map((i) =>
                    assignNewIds(structuredClone(i), true)
                  )
                : [assignNewIds(structuredClone(importedData), true)];
              resolve(replaceTree(newTree));
            } else {
              const currentSel = findItemById(tree, selectedItemId);
              if (currentSel && currentSel.type === "folder") {
                const itemsToInsert = Array.isArray(importedData)
                  ? importedData.map((i) =>
                      assignNewIds(structuredClone(i), true)
                    )
                  : [assignNewIds(structuredClone(importedData), true)];
                let tempTree = tree;
                itemsToInsert.forEach(
                  (it) =>
                    (tempTree = insertItemRecursive(
                      tempTree,
                      currentSel.id,
                      it
                    ))
                );
                setTreeWithUndo(tempTree);
                if (settings.autoExpandNewFolders)
                  expandFolderPath(currentSel.id);
                resolve({ success: true });
              } else {
                resolve({
                  success: false,
                  error: "Target for import must be a folder.",
                });
              }
            }
          } catch (err) {
            resolve({ success: false, error: `Import error: ${err.message}` });
          }
        };
        reader.onerror = () =>
          resolve({ success: false, error: "File read error." });
        reader.readAsText(file);
      });
    },
    [
      tree,
      selectedItemId,
      replaceTree,
      setTreeWithUndo,
      settings.autoExpandNewFolders,
      expandFolderPath,
    ]
  );

  const searchItems = useCallback(
    (query, opts) => {
      if (!query) return [];
      const results = [];
      const currentTree = tree || [];
      const walk = (nodes) => {
        if (!Array.isArray(nodes)) return;
        nodes.forEach((it) => {
          if (itemMatches(it, query, opts)) results.push(it);
          if (it.type === "folder" && Array.isArray(it.children))
            walk(it.children);
        });
      };
      walk(currentTree);
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
    resetState: resetTreeHistory, // Expose resetState for logout or initial load scenarios
  };
};
