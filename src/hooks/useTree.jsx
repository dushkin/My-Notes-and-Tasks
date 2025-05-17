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
} from "../utils/treeUtils"; // These are your client-side utils
import { jsPDF } from "jspdf";
import * as bidiNS from "unicode-bidirectional";
import { notoSansHebrewBase64 } from "../fonts/NotoSansHebrewBase64";
import { useSettings } from "../contexts/SettingsContext";
import { itemMatches } from "../utils/searchUtils";
import { useUndoRedo } from "./useUndoRedo";

// Ensure API_BASE_URL is correctly defined. Your original file had:
// const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
// If it's not defined, default it:
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";

const getAuthToken = () => {
  const token = localStorage.getItem("userToken");
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

// Your existing assignNewIds function
const assignNewIds = (item, isDuplication = false) => {
  const newItem = { ...item };
  if (isDuplication || !item.id || item.id.startsWith("temp-")) {
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
          } else {
            console.error(
              "useTree Effect: Server error fetching tree:",
              response.status,
              errorData
            );
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
  }, [resetTreeHistory]);

  useEffect(() => {
    try {
      if (!Array.isArray(tree)) {
        console.error(
          "Attempted to save non-array tree data to localStorage:",
          tree
        );
        return;
      }
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
    // Your existing expandFolderPath
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
          ancestors.forEach((pid) => {
            const item = findItemById(currentTree, pid);
            if (item && item.type === "folder") next[pid] = true;
          });
        }
        const targetItem = findItemById(currentTree, folderId);
        if (targetItem && targetItem.type === "folder") next[folderId] = true; // Ensure target is also expanded if it's a folder
        return next;
      });
    },
    [tree] // findItemById is a util, not state/prop
  );

  const toggleFolderExpand = useCallback((id, forceState) => {
    if (!id) return;
    setExpandedFolders((prev) => ({
      ...prev,
      [id]: forceState !== undefined ? Boolean(forceState) : !prev[id],
    }));
  }, []);

  // Your existing addItem, updateNoteContent, updateTask, renameItem, deleteItem,
  // duplicateItem, handleDrop, copyItem, cutItem, pasteItem, handleExport, searchItems
  // These should remain as they are in your file, unless they also need changes for DB persistence (which is a separate effort from import)
  // For brevity, I am not re-listing all of them here but assuming they are present from your file.
  // Example structure for one of them:
  const addItem = useCallback(
    async (newItemData, parentId) => {
      /* ... your existing addItem logic ... */
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

        const newTreeState = insertItemRecursive(tree, parentId, responseData);
        setTreeWithUndo(newTreeState);
        if (parentId && settings.autoExpandNewFolders)
          setTimeout(() => expandFolderPath(parentId), 0);
        return { success: true, item: responseData };
      } catch (error) {
        console.error("addItem API error:", error);
        return { success: false, error: "Network error adding item." };
      }
    },
    [tree, setTreeWithUndo, expandFolderPath, settings.autoExpandNewFolders]
  );

  const updateNoteContent = useCallback(
    async (itemId, content) => {
      /* ... your existing updateNoteContent logic ... */
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

        const newTreeState = tree.map(function mapAndUpdate(i) {
          if (i.id === itemId) return { ...i, ...updatedItemFromServer };
          if (i.children)
            return { ...i, children: i.children.map(mapAndUpdate) };
          return i;
        });
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
    async (taskId, clientUpdates) => {
      /* ... your existing updateTask logic ... */
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

        const newTreeState = tree.map(function mapAndUpdate(i) {
          if (i.id === taskId) return { ...i, ...updatedItemFromServer };
          if (i.children)
            return { ...i, children: i.children.map(mapAndUpdate) };
          return i;
        });
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
      /* ... your existing renameItem logic ... */
      const trimmedLabel = newLabel?.trim();
      if (!trimmedLabel || !itemId)
        return { success: false, error: "Invalid ID or name." };
      const token = getAuthToken();
      if (!token) return { success: false, error: "Authentication required." };
      const { parentArray } = findParentAndSiblings(tree, itemId);
      if (hasSiblingWithName(parentArray, trimmedLabel, itemId)) {
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
    async (idToDelete) => {
      /* ... your existing deleteItem logic ... */
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
      /* ... your existing duplicateItem logic, ensure it calls addItem for persistence ... */
      const itemToDuplicate = findItemById(tree, itemId);
      if (!itemToDuplicate)
        return { success: false, error: "Item to duplicate not found." };

      const { parent, siblings } = findParentAndSiblings(tree, itemId);
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
        setContextMenu((m) => ({ ...m, visible: false }));
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
      /* ... your existing handleDrop logic, note it's mostly client-side ... */
      console.warn(
        "useTree: handleDrop (moving items) is mostly client-side. Robust server logic needed for persistence."
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
            "Local drop successful. Backend persistence for item move not yet implemented.",
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
      /* ... your existing copyItem logic ... */
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
      /* ... your existing cutItem logic ... */
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
      /* ... your existing pasteItem logic, note it's mostly client-side for 'cut' ... */
      console.warn(
        "useTree: pasteItem is mostly client-side. Robust server logic needed for cut/paste persistence."
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
        if (addResult.success) {
          if (targetFolderId && settings.autoExpandNewFolders)
            expandFolderPath(targetFolderId);
        }
        setContextMenu((m) => ({ ...m, visible: false }));
        return addResult;
      } else if (clipboardMode === "cut" && cutItemId) {
        if (cutItemId === targetFolderId)
          return { success: false, error: "Cannot cut an item into itself." };

        if (
          findParentAndSiblings(tree, cutItemId)?.parent?.id !==
            targetFolderId &&
          hasSiblingWithName(targetSiblings, itemToInsert.label, cutItemId)
        ) {
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
        setContextMenu((m) => ({ ...m, visible: false }));
        return {
          success: true,
          item: itemToInsert,
          message:
            "Item moved locally. Server persistence for move not implemented.",
        };
      }
      setContextMenu((m) => ({ ...m, visible: false }));
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
    (target, format) => {
      /* ... your existing handleExport logic ... */
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
        // PDF export logic as before
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

  // MODIFIED handleImport:
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
            if (!token && importTargetOption === "entire") {
              // Token needed for server save
              resolveOuter({
                success: false,
                error: "Authentication required to save imported tree.",
              });
              return;
            }

            if (importTargetOption === "entire") {
              // Client-side processing of IDs (optional, backend can also sanitize)
              const newTreeForClientAndServer = Array.isArray(importedData)
                ? importedData.map((i) =>
                    assignNewIds(structuredClone(i), true)
                  )
                : [assignNewIds(structuredClone(importedData), true)];

              console.log(
                "Attempting to save entire imported tree to server:",
                newTreeForClientAndServer
              );
              const response = await fetch(`${API_BASE_URL}/items/tree`, {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ newTree: newTreeForClientAndServer }),
              });
              const responseData = await response.json();

              if (!response.ok) {
                console.error(
                  "Server error saving imported tree:",
                  responseData
                );
                resolveOuter({
                  success: false,
                  error:
                    responseData.error ||
                    "Failed to save imported tree to server.",
                });
                return;
              }

              // If successful, update local state with the tree returned from server
              const result = replaceTree(
                responseData.notesTree || newTreeForClientAndServer
              ); // Prefer server's version
              resolveOuter({
                ...result,
                message: responseData.message || "Tree imported and saved.",
              });
            } else {
              // "selected" - import under an item (remains client-side for DB persistence for now)
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
                setTreeWithUndo(tempTree); // Updates localStorage via useEffect
                if (settings.autoExpandNewFolders)
                  expandFolderPath(currentSel.id);
                console.warn(
                  "Import under selected item is currently client-side only for DB persistence without further backend changes."
                );
                resolveOuter({
                  success: true,
                  message:
                    "Items imported locally. Backend save for this mode needs specific implementation.",
                });
              } else {
                resolveOuter({
                  success: false,
                  error: "Target for import must be a selected folder.",
                });
              }
            }
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
      setTreeWithUndo,
      settings.autoExpandNewFolders,
      expandFolderPath,
    ] // API_BASE_URL is stable, getAuthToken is stable
  );

  const searchItems = useCallback(
    (query, opts) => {
      /* ... your existing searchItems logic ... */
      if (!query) return [];
      const results = [];
      const currentTree = tree || [];
      const walk = (nodes, currentPathSegments) => {
        if (!Array.isArray(nodes)) return;
        nodes.forEach((it) => {
          if (!it) return;
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
    handleImport, // Ensure this is the modified one
    searchItems,
    getItemPath,
    expandFolderPath,
    undoTreeChange,
    redoTreeChange,
    canUndoTree,
    canRedoTree,
    resetState: resetTreeHistory,
  };
};
