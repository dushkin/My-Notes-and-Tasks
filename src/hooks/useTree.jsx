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
import * as bidi from "unicode-bidirectional";
import { notoSansHebrewBase64 } from "../fonts/NotoSansHebrewBase64";
import { useSettings } from "../contexts/SettingsContext";
import { itemMatches } from "../utils/searchUtils";
import { useUndoRedo } from "./useUndoRedo";
import { authFetch } from "../services/apiClient";
import { API_BASE_URL } from '../services/apiClient.js';
import { htmlToPlainText } from "../utils/htmlUtils";
import { useRealTimeSync } from "./useRealTimeSync";

// Decode HTML entities if they exist
const decodeHtmlEntities = (str) => {
  if (!str || typeof str !== 'string') return str;
  
  // Check if the string contains HTML entities
  if (str.includes('&lt;') || str.includes('&gt;') || str.includes('&amp;')) {
    // Create a temporary DOM element to decode
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
  }
  
  return str;
};

// Safe content conversion that prevents [object Object]
const safeStringify = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    // Decode HTML entities if present
    return decodeHtmlEntities(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    // Handle the specific case where content data is passed as an object
    if (value.content && typeof value.content === 'string') {
      console.warn('⚠️ Extracting content from object:', value);
      return decodeHtmlEntities(value.content);
    }
    console.warn('⚠️ Attempted to stringify object as content:', value);
    return '';
  }
  return String(value);
};

// Unique tab/session identifier
const TAB_ID =
  sessionStorage.getItem("tab_id") ||
  (() => {
    const id = Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem("tab_id", id);
    return id;
  })();

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

export const useTree = (currentUser) => {
  const EXPANDED_KEY = `${LOCAL_STORAGE_KEY}_expanded`;
  const { settings } = useSettings();

  const initialTreeState = useMemo(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      const validArray = Array.isArray(parsed) ? parsed : [];
      
      // Debug localStorage content types and auto-fix corruption
      console.log("💾 Loading initial tree from localStorage:", validArray.length, "items");
      let hasCorruption = false;
      
      const cleanTree = (items) => {
        return items.map(item => {
          if (!item) return item;
          
          // Check for corrupted content
          if (item.content === '[object Object]') {
            console.warn(`🔧 Auto-fixing corrupted content for item ${item.id}`);
            hasCorruption = true;
            return { ...item, content: '' };
          }
          
          // Check for non-string content
          if (item.content && typeof item.content !== 'string') {
            console.warn(`⚠️ localStorage item (${item.id}) has non-string content:`, typeof item.content, item.content);
            hasCorruption = true;
            return { ...item, content: safeStringify(item.content) };
          }
          
          // Recursively clean children
          if (item.children && Array.isArray(item.children)) {
            const cleanedChildren = cleanTree(item.children);
            return { ...item, children: cleanedChildren };
          }
          
          return item;
        });
      };
      
      const cleanedArray = cleanTree(validArray);
      
      // If we found corruption, save the cleaned version
      if (hasCorruption) {
        console.log('💾 Saving cleaned tree back to localStorage');
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cleanedArray));
      }
      
      return cleanedArray;
    } catch (error) {
      console.error("Failed to load tree from localStorage:", error);
      return [];
    }
  }, []); // Empty dependency array - only calculate once
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

  const selectedItem = useMemo(() => {
    const item = findItemById(tree, selectedItemId);
    if (item) {
      // Ensure content is always a string
      const normalizedItem = {
        ...item,
        content: safeStringify(item.content)
      };
      
      console.log('🎯 Selected item from tree:', {
        id: normalizedItem.id,
        contentType: typeof normalizedItem.content,
        contentValue: normalizedItem.content,
        contentPreview: normalizedItem.content.substring(0, 100) || '(empty)'
      });
      
      return normalizedItem;
    }
    return item;
  }, [tree, selectedItemId]);

  // Real-time sync handlers
  const handleItemUpdatedFromSocket = useCallback((updatedItem) => {
    if (!updatedItem || !updatedItem.id) return;
    
    console.log('📡 Full socket event data:', updatedItem);
    
    // Ensure content is properly handled
    const safeUpdatedItem = { ...updatedItem };
    if (safeUpdatedItem.content && typeof safeUpdatedItem.content !== 'string') {
      console.warn('⚠️ Socket update contained non-string content:', typeof safeUpdatedItem.content, safeUpdatedItem.content);
      safeUpdatedItem.content = safeStringify(safeUpdatedItem.content);
    } else if (safeUpdatedItem.content) {
      console.log('📡 Socket content received:', safeUpdatedItem.content);
    }
    
    // Update the tree with the new item data
    const mapRecursiveUpdate = (items, id, serverUpdates) =>
      items.map((i) =>
        i.id === id
          ? { ...i, ...serverUpdates }
          : Array.isArray(i.children)
          ? {
              ...i,
              children: mapRecursiveUpdate(i.children, id, serverUpdates),
            }
          : i
      );
    
    const updatedTree = mapRecursiveUpdate(tree, updatedItem.id, safeUpdatedItem);
    setTreeWithUndo(updatedTree);
    
    console.log('📡 Item updated from real-time sync:', updatedItem.id);
  }, [tree, setTreeWithUndo]);

  const handleItemDeletedFromSocket = useCallback((data) => {
    if (!data || !data.itemId) return;
    
    const newTreeState = deleteItemRecursive(tree, data.itemId);
    setTreeWithUndo(newTreeState);
    
    // Clear selection if deleted item was selected
    if (selectedItemId === data.itemId) {
      setSelectedItemId(null);
    }
    
    console.log('📡 Item deleted from real-time sync:', data.itemId);
  }, [tree, selectedItemId, setTreeWithUndo]);

  const handleTreeUpdatedFromSocket = useCallback((newTree) => {
    if (Array.isArray(newTree)) {
      setTreeWithUndo(newTree);
      console.log('📡 Tree structure updated from real-time sync');
    }
  }, [setTreeWithUndo]);

  // Initialize real-time sync
  const { emitToOtherDevices, isConnected: isSocketConnected } = useRealTimeSync(
    handleItemUpdatedFromSocket,
    handleItemDeletedFromSocket,
    handleTreeUpdatedFromSocket,
    true // enabled
  );

  const currentItemCount = useMemo(() => countTotalItems(tree), [tree]);

  const fetchUserTree = useCallback(
    async (preserveHistory = false) => {
      setIsFetchingTree(true);
      try {
        const response = await authFetch(`/items`, { cache: "no-store" });
        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ message: "Failed to parse error response" }));
          console.error(response.status, errorData);
          console.warn("⚠️ Server error - preserving current tree state and undo history");
          // Don't reset tree state on server errors - preserve current state and history
          return;
        }
        const data = await response.json();
        if (data && Array.isArray(data.notesTree)) {
          console.log("📥 Fetched tree from server:", data.notesTree.length, "items");
          
          // Normalize tree data to ensure all content properties are strings
          const normalizeTreeData = (items) => {
            return items.map(item => {
              const normalizedItem = {
                ...item,
                content: safeStringify(item.content)
              };
              
              // Debug log for problematic items
              if (item.content !== normalizedItem.content) {
                console.warn(`🔧 Normalized content for item ${item.id}:`, {
                  original: typeof item.content,
                  normalized: typeof normalizedItem.content
                });
              }
              
              // Recursively normalize children
              if (normalizedItem.children && Array.isArray(normalizedItem.children)) {
                normalizedItem.children = normalizeTreeData(normalizedItem.children);
              }
              
              return normalizedItem;
            });
          };
          
          const normalizedTree = normalizeTreeData(data.notesTree);
          
          if (preserveHistory) {
            setTreeWithUndo(normalizedTree);
          } else {
            resetTreeHistory(normalizedTree);
          }
        } else {
          console.warn("⚠️ Invalid server response - preserving current tree state and undo history");
          // Don't reset tree state on invalid response - preserve current state and history
        }
      } catch (error) {
        console.error("📡 Network error fetching tree:", error);
        console.warn("⚠️ Network error - preserving current tree state and undo history");
        // Don't reset tree state on network errors - preserve current state and history
      } finally {
        setIsFetchingTree(false);
      }
    },
    [resetTreeHistory, setTreeWithUndo]
  );

  useEffect(() => {
    try {
      if (Array.isArray(tree)) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tree));
        // Cache tree data for reminder monitor
        localStorage.setItem("cached_tree_data", JSON.stringify(tree));
        // Also make it available globally for reminder monitor
        window.treeData = tree;
      }
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

  const broadcastSync = useCallback(() => {
    if (typeof BroadcastChannel !== "undefined") {
      const bc = new BroadcastChannel("notes-sync");
      bc.postMessage({ type: "tree-updated", tabId: TAB_ID });
      bc.close();
    } else {
      localStorage.setItem("notesTreeSync", Date.now().toString());
      localStorage.removeItem("notesTreeSync");
    }
  }, []);

  // MODIFIED & CORRECTED SYNC LOGIC
  useEffect(() => {
    // New, more specific handler for BroadcastChannel
    const handleSync = (event) => {
      // First, check if the message is specifically for a tree update.
      if (event?.data?.type !== "tree-updated") {
        // Ignore other messages (like logout signals).
        return;
      }

      // Then, check if it came from the same tab.
      if (event?.data?.tabId === TAB_ID) {
        return; // Ignore own messages.
      }

      // Only if it's a tree update from another tab, reload the tree.
      console.log("Detected tree update in another tab, reloading…");
      fetchUserTree(true); // Preserve history when syncing from other tabs
    };

    // Handler for the localStorage fallback
    const handleStorageSync = (e) => {
      // The key must match the one used in `broadcastSync`
      if (e.key === "notesTreeSync") {
        console.log("Detected tree update via storage, reloading…");
        fetchUserTree(true); // Preserve history when syncing via storage
      }
    };

    // --- Setup and Cleanup Logic ---
    if (typeof BroadcastChannel !== "undefined") {
      const bc = new BroadcastChannel("notes-sync");
      bc.onmessage = handleSync;

      // Cleanup function for BroadcastChannel
      return () => {
        bc.close();
      };
    } else {
      window.addEventListener("storage", handleStorageSync);

      // Cleanup function for the storage event listener
      return () => {
        window.removeEventListener("storage", handleStorageSync);
      };
    }
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
    async (itemId, content, direction) => {
      try {
        // Build updates object - ensure content is a string
        const stringContent = safeStringify(content);
        const updates = { content: stringContent };
        if (direction) {
          updates.direction = direction;
        }

        // Use SyncManager if available for better offline support
        if (window.MyNotesApp?.syncManager && navigator.onLine) {
          try {
            const operation = {
              type: 'UPDATE_CONTENT',
              data: {
                id: itemId,
                content,
                direction,
                timestamp: Date.now()
              }
            };
            
            // Try direct sync first
            await window.MyNotesApp.syncManager.syncUpdateContent({
              id: itemId,
              content: stringContent,
              direction
            });
            
            console.log('📝 Content updated via SyncManager:', itemId);
            return { success: true };
            
          } catch (syncError) {
            // If SyncManager fails, add to queue and fall back to direct API
            console.warn('SyncManager failed, falling back to direct API:', syncError);
            const operation = {
              type: 'UPDATE_CONTENT',
              data: {
                id: itemId,
                content: stringContent,
                direction,
                timestamp: Date.now()
              }
            };
            window.MyNotesApp.syncManager.addToSyncQueue(operation);
          }
        }

        // Direct API call (fallback or when SyncManager not available)
        const response = await authFetch(`/items/${itemId}`, {
          method: "PATCH",
          body: updates,
        });
        const updatedItemFromServer = await response.json();

        if (!response.ok) {
          return {
            success: false,
            error: updatedItemFromServer.error || "Failed to update note.",
          };
        }

        // Don't refetch entire tree for content updates - just update locally
        // Ensure server response content is properly handled
        const safeServerUpdate = { ...updatedItemFromServer };
        if (safeServerUpdate.content && typeof safeServerUpdate.content !== 'string') {
          console.warn('⚠️ Server response contained non-string content:', typeof safeServerUpdate.content, safeServerUpdate.content);
          safeServerUpdate.content = safeStringify(safeServerUpdate.content);
        }
        
        const mapRecursiveUpdate = (items, id, serverUpdates) =>
          items.map((i) =>
            i.id === id
              ? { ...i, ...serverUpdates }
              : Array.isArray(i.children)
              ? {
                  ...i,
                  children: mapRecursiveUpdate(i.children, id, serverUpdates),
                }
              : i
          );
        
        const updatedTree = mapRecursiveUpdate(tree, itemId, safeServerUpdate);
        setTreeWithUndo(updatedTree);

        return { success: true, item: updatedItemFromServer };
      } catch (error) {
        console.error("updateNoteContent API error:", error);
        
        // Add to sync queue on error
        if (window.MyNotesApp?.syncManager) {
          try {
            const operation = {
              type: 'UPDATE_CONTENT',
              data: {
                id: itemId,
                content: stringContent,
                direction,
                timestamp: Date.now()
              }
            };
            window.MyNotesApp.syncManager.addToSyncQueue(operation);
            console.log('📝 Added failed update to sync queue:', itemId);
          } catch (syncError) {
            console.error('Failed to add to sync queue:', syncError);
          }
        }
        
        return { success: false, error: "Network error updating note." };
      }
    },
    [tree, setTreeWithUndo]
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
        setExpandedFolders((prevExpanded) => {
          // First, check if the key we want to delete actually exists.
          if (!prevExpanded.hasOwnProperty(idToDelete)) {
            return prevExpanded; // If not, return the original state to prevent a re-render.
          }
          // If the key exists, create a new object, delete the key, and return the new state.
          const nextExpanded = { ...prevExpanded };
          delete nextExpanded[idToDelete];
          return nextExpanded;
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

      // Use bulk tree update for better performance and reliability
      try {
        // Create the new tree structure with the duplicated item inserted
        const newTreeState = insertItemRecursive(tree, parentId, newDuplicateDataForServer);
        
        // Update the entire tree on the server in one operation
        const response = await authFetch(`/items/tree`, {
          method: "PUT",
          body: JSON.stringify({ newTree: newTreeState }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Server responded with ${response.status}`);
        }

        // Update the local state
        setTreeWithUndo(newTreeState);

        // Note: Real-time sync will handle the server-client sync automatically

        if (parentId && settings.autoExpandNewFolders) {
          setTimeout(() => expandFolderPath(parentId), 0);
        }

        return { success: true };
      } catch (error) {
        console.error("duplicateItem error:", error);
        // Restore original tree state on error, preserving undo history
        await fetchUserTree(true);
        return {
          success: false,
          error: error.message || "Network error duplicating item.",
        };
      }
    },
    [
      tree,
      setTreeWithUndo,
      settings.autoExpandNewFolders,
      expandFolderPath,
      currentItemCount,
      currentUser,
      fetchUserTree,
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

        // Get the updated tree from server and use setTreeWithUndo for undo/redo support
        const treeResponse = await authFetch(`/items`, { cache: "no-store" });
        if (treeResponse.ok) {
          const treeData = await treeResponse.json();
          if (treeData && Array.isArray(treeData.notesTree)) {
            setTreeWithUndo(treeData.notesTree);
          }
        } else {
          // Fallback to fetchUserTree if direct fetch fails, preserving undo history
          await fetchUserTree(true);
        }

        if (targetFolderId) {
          expandFolderPath(targetFolderId);
        }

        return { success: true };
      } catch (err) {
        console.error("Move (handleDrop) API error:", err);
        await fetchUserTree(true);
        return {
          success: false,
          error: err.message || "A network error occurred during the move.",
        };
      }
    },
    [draggedId, tree, fetchUserTree, expandFolderPath, setTreeWithUndo]
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

        // Use bulk tree update for better performance and reliability
        try {
          // Create the new tree structure with the copied item inserted
          const newTreeState = insertItemRecursive(tree, targetFolderId, itemToInsertData);
          
          // Update the entire tree on the server in one operation
          const response = await authFetch(`/items/tree`, {
            method: "PUT",
            body: JSON.stringify({ newTree: newTreeState }),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server responded with ${response.status}`);
          }

          // Update the local state
          setTreeWithUndo(newTreeState);

          // Note: Real-time sync will handle the server-client sync automatically

          if (targetFolderId && settings.autoExpandNewFolders) {
            expandFolderPath(targetFolderId);
          }

          return { success: true };
        } catch (error) {
          console.error("pasteItem copy error:", error);
          // Restore original tree state on error, preserving undo history
          await fetchUserTree(true);
          return {
            success: false,
            error: error.message || "Network error pasting item.",
          };
        }
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

          // Get the updated tree from server and use setTreeWithUndo for undo/redo support
          const treeResponse = await authFetch(`/items`, { cache: "no-store" });
          if (treeResponse.ok) {
            const treeData = await treeResponse.json();
            if (treeData && Array.isArray(treeData.notesTree)) {
              setTreeWithUndo(treeData.notesTree);
            }
          } else {
            // Fallback to fetchUserTree if direct fetch fails, preserving undo history
            await fetchUserTree(true);
          }
          
          if (targetFolderId && settings.autoExpandNewFolders) {
            expandFolderPath(targetFolderId);
          }

          return { success: true, item: data.data.movedItem };
        } catch (err) {
          console.error("Move (pasteItem) API error:", err);
          await fetchUserTree(true); // Resync state on failure, preserving undo history
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
      fetchUserTree,
      setTreeWithUndo,
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
          exportToPDF(dataToExport, fileName);
        } catch (error) {
          console.error("PDF export failed:", error);
          alert("Failed to export PDF: " + error.message);
        }
      }
    },
    [tree, selectedItemId]
  );

  const hasRTLCharacters = (text) => {
    if (!text) return false;
    const rtlChars =
      /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
    return rtlChars.test(text);
  };

  const hasNonLatinCharacters = (text) => {
    if (!text) return false;
    const nonLatinChars =
      /[^\u0000-\u024F\u1E00-\u1EFF\u2C60-\u2C7F\uA720-\uA7FF]/;
    return nonLatinChars.test(text);
  };

  const processBidiText = (text) => {
    if (!text) return "";
    try {
      if (
        bidi.default &&
        typeof bidi.default.bidiReorderParagraph === "function"
      ) {
        return bidi.default.bidiReorderParagraph(text);
      }
      if (typeof bidi.bidiReorderParagraph === "function") {
        return bidi.bidiReorderParagraph(text);
      }
      return text;
    } catch (error) {
      console.warn("Bidirectional text processing failed:", error);
      return text; // Fallback to original text
    }
  };

  // MODIFIED: Final version using manual line drawing with block-height calculation.
  const exportToPDF = (data, fileName) => {
    const doc = new jsPDF();
    const margin = 15;
    let cursorY = margin;
    const lineSpacing = 7;
    const indentWidth = 8;
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();

    try {
      doc.addFileToVFS("NotoSansHebrew-Regular.ttf", notoSansHebrewBase64);
      doc.addFont("NotoSansHebrew-Regular.ttf", "NotoSansHebrew", "normal");
      doc.setFont("NotoSansHebrew");
    } catch (e) {
      console.error("Failed to load custom font for PDF:", e);
      doc.setFont("helvetica");
    }

    const renderNodeAndChildren = (item, ancestorsLastStatus) => {
      if (!item) return;

      // 1. Calculate the height of the item's own content block first.
      const indentLevel = ancestorsLastStatus.length;
      const textX = margin + indentLevel * indentWidth;
      let labelLines = [];
      if (item.label) {
        const labelText = processBidiText(item.label);
        labelLines = doc.splitTextToSize(labelText, pageWidth - textX - 10);
      }

      let contentLines = [];
      if (item.content) {
        const plainTextContent = htmlToPlainText(item.content);
        if (plainTextContent) {
          const processedContent = processBidiText(plainTextContent);
          const contentIndentX = textX + indentWidth;
          contentLines = doc.splitTextToSize(
            processedContent,
            pageWidth - contentIndentX - margin
          );
        }
      }

      const localBlockHeight =
        (labelLines.length + contentLines.length) * lineSpacing;

      // Check for page break before rendering anything.
      if (cursorY + localBlockHeight > pageHeight - margin) {
        doc.addPage();
        cursorY = margin;
      }
      const startY = cursorY;

      // 2. Draw the tree lines for the current item.
      doc.setDrawColor(180, 180, 180); // Set line color to a light gray
      doc.setLineWidth(0.25);

      if (indentLevel > 0) {
        const parentIndentX = margin + (indentLevel - 1) * indentWidth;

        // Draw horizontal connector
        doc.line(
          parentIndentX,
          startY + lineSpacing / 2,
          textX,
          startY + lineSpacing / 2
        );

        // Draw ancestor vertical "pass-through" lines
        ancestorsLastStatus.slice(0, -1).forEach((isLast, i) => {
          if (!isLast) {
            const x = margin + i * indentWidth;
            // Draw a segment for the current item's height
            doc.line(x, startY, x, startY + localBlockHeight + lineSpacing);
          }
        });

        const isCurrentLast =
          ancestorsLastStatus[ancestorsLastStatus.length - 1];
        if (!isCurrentLast) {
          // If this item isn't the last, its parent's vertical line must continue through it
          doc.line(
            parentIndentX,
            startY,
            parentIndentX,
            startY + localBlockHeight + lineSpacing
          );
        }
      }

      // 3. Render the text content.
      const icon =
        item.type === "folder" ? "📁" : item.type === "note" ? "📝" : "☐";
      const iconWidth = doc.getTextWidth(`${icon} `);
      doc.text(icon, textX, startY + lineSpacing / 2, { baseline: "middle" });
      doc.text(labelLines, textX + iconWidth, startY + lineSpacing - 2);
      cursorY += labelLines.length * lineSpacing;

      if (contentLines.length > 0) {
        const contentIndentX = textX + indentWidth;
        doc.text(contentLines, contentIndentX, cursorY + lineSpacing - 2);
        cursorY += contentLines.length * lineSpacing;
      }

      cursorY += lineSpacing; // Padding after the item

      // 4. Recursively render children.
      if (item.type === "folder" && Array.isArray(item.children)) {
        item.children.forEach((child, index) => {
          const isLastChild = index === item.children.length - 1;
          renderNodeAndChildren(child, [...ancestorsLastStatus, isLastChild]);
        });
      }
    };

    const itemsToRender = Array.isArray(data) ? data : [data];
    itemsToRender.forEach((item, index) => {
      const isLast = index === itemsToRender.length - 1;
      renderNodeAndChildren(item, [isLast]);
    });

    doc.save(`${fileName}.pdf`);
  };

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
              const importedItems = Array.isArray(importedRawData)
                ? importedRawData
                : [importedRawData];

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
              const itemsToImport = Array.isArray(importedRawData)
                ? importedRawData
                : [importedRawData];

              const targetParent = selectedItemId
                ? findItemById(tree, selectedItemId)
                : null;
              const targetSiblings = targetParent
                ? targetParent.children || []
                : tree;

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

            // Get the updated tree from server and use setTreeWithUndo for undo/redo support
            const treeResponse = await authFetch(`/items`, { cache: "no-store" });
            if (treeResponse.ok) {
              const treeData = await treeResponse.json();
              if (treeData && Array.isArray(treeData.notesTree)) {
                setTreeWithUndo(treeData.notesTree);
              }
            } else {
              // Fallback to fetchUserTree if direct fetch fails, preserving undo history
              await fetchUserTree(true);
            }
            
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
    [tree, selectedItemId, fetchUserTree, setTreeWithUndo]
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

  window.fetchUserTree = fetchUserTree;
  window.clearTreeCache = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem('notes_tree');
    localStorage.removeItem('lastSyncedTimestamp');
    console.log('🧹 Cleared all tree cache from localStorage');
  };
  
  window.fixCorruptedContent = () => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!stored) return;
      
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return;
      
      let fixed = false;
      const cleanTree = (items) => {
        return items.map(item => {
          if (item.content === '[object Object]') {
            console.log('🔧 Fixed corrupted content for item:', item.id);
            fixed = true;
            return { ...item, content: '' };
          }
          if (item.children && Array.isArray(item.children)) {
            return { ...item, children: cleanTree(item.children) };
          }
          return item;
        });
      };
      
      const cleanedTree = cleanTree(parsed);
      if (fixed) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cleanedTree));
        console.log('✅ Fixed and saved cleaned tree to localStorage');
        window.location.reload();
      } else {
        console.log('ℹ️ No corrupted content found');
      }
    } catch (error) {
      console.error('❌ Error fixing corrupted content:', error);
    }
  };
  return {
    fetchUserTree,
    tree,
    setTreeWithUndo,
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
    // Real-time sync status
    isSocketConnected,
    emitToOtherDevices,
  };
};
