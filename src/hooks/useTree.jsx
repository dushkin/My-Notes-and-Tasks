// src/hooks/useTree.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { LOCAL_STORAGE_KEY } from "../utils/constants";
import {
  sortItems,
  handleDrop as treeHandleDropUtil, // Renamed to avoid conflict
  deleteItemRecursive,
  renameItemRecursive,
  insertItemRecursive,
  isSelfOrDescendant,
  findItemById,
  findParentAndSiblings, // Using the corrected version from treeUtils.js
  hasSiblingWithName,
} from "../utils/treeUtils";
import { jsPDF } from "jspdf";
import * as bidi from 'unicode-bidirectional';
import { notoSansHebrewBase64 } from '../fonts/NotoSansHebrewBase64';

// Helper function to convert editor HTML to plain text preserving basic newlines
function htmlToPlainTextWithNewlines(html) {
    if (!html) return "";
    let text = html;
    // Add explicit newline markers BEFORE block elements that should cause a break.
    text = text.replace(/<(div|p|h[1-6]|li|blockquote|pre|tr|hr)[^>]*>/gi, '\n$&');
    // Replace <br> tags with newline characters
    text = text.replace(/<br\s*\/?>/gi, '\n');
    // Now, remove all HTML tags
    text = text.replace(/<[^>]+>/g, '');
    // Decode HTML entities AFTER removing tags
    try {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = text; // Let the browser parse entities
        text = tempDiv.textContent || tempDiv.innerText || "";
    } catch (e) {
        console.error("Error decoding HTML entities during PDF export:", e);
        // Fallback or just continue with potentially encoded text
    }
    // Cleanup whitespace: trim leading/trailing, replace multiple newlines with ONE.
    text = text.trim().replace(/(\r\n|\r|\n){2,}/g, '\n');
    return text;
}

// Helper: Recursively assign new IDs to an item and its children
// Ensures unique IDs when duplicating or pasting.
const assignNewIds = (item) => {
    const newItem = { ...item };
    // Generate a reasonably unique ID
    newItem.id = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9);
    // If the item has children, recursively assign new IDs to them
    if (Array.isArray(newItem.children)) {
        newItem.children = newItem.children.map(child => assignNewIds(child));
    }
    return newItem;
};


export const useTree = () => {
  const EXPANDED_KEY = `${LOCAL_STORAGE_KEY}_expanded`;

  // --- State Initialization ---
  const [tree, setTree] = useState(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      // Ensure it's always an array, handle potential parsing errors gracefully
      return Array.isArray(parsed) ? parsed : [];
    } catch (error){
      console.error("Failed to load or parse tree from localStorage:", error);
      return []; // Default to empty array on error
    }
  });

  const [selectedItemId, setSelectedItemId] = useState(null);

  const [contextMenu, setContextMenu] = useState({
    visible: false, x: 0, y: 0, item: null, isEmptyArea: false,
  });

  const [expandedFolders, setExpandedFolders] = useState(() => {
    try {
      const stored = localStorage.getItem(EXPANDED_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error){
      console.error("Failed to load or parse expanded folders from localStorage:", error);
      return {}; // Default to empty object on error
    }
  });

  const [draggedId, setDraggedId] = useState(null);
  const [clipboardItem, setClipboardItem] = useState(null); // Stores the actual item data (deep copy)
  const [clipboardMode, setClipboardMode] = useState(null); // 'copy' or 'cut'
  const [cutItemId, setCutItemId] = useState(null);       // Track the original ID if mode is 'cut'

  // Memoize selectedItem calculation for performance
  const selectedItem = useMemo(() => findItemById(tree, selectedItemId), [tree, selectedItemId]);

  // --- Persistence Effects ---
  // Persist tree structure to localStorage
  const setTreeAndPersist = useCallback((newTreeOrCallback) => {
    setTree((prevTree) => {
      // Allow passing a function or a direct value to setTree
      const newTree = typeof newTreeOrCallback === "function"
        ? newTreeOrCallback(prevTree)
        : newTreeOrCallback;
      try {
        // Basic validation before saving: Ensure it's an array.
        if (!Array.isArray(newTree)) {
            console.error("Attempted to save non-array data to localStorage:", newTree);
            return prevTree; // Avoid saving invalid data, return previous state
        }
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newTree));
      } catch (error) {
        console.error("Failed to save tree to localStorage:", error);
        // Optionally: Implement more robust error handling, e.g., notify user
      }
      return newTree; // Return the new state
    });
  }, [LOCAL_STORAGE_KEY]); // Dependency on the storage key

  // Persist expanded folders state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(EXPANDED_KEY, JSON.stringify(expandedFolders));
    } catch (error) {
      console.error("Failed to save expanded folders to localStorage:", error);
    }
  }, [expandedFolders, EXPANDED_KEY]);


  // --- Selection and Expansion ---
  const selectItemById = useCallback((id) => {
    setSelectedItemId(id);
  }, []); // No dependencies needed as setSelectedItemId is stable

  // Replace the entire tree (e.g., on full import)
  const replaceTree = useCallback((newTreeData) => {
    if (Array.isArray(newTreeData)) {
      setTreeAndPersist(newTreeData); // Use the persisting setter
      setSelectedItemId(null);      // Clear selection
      setExpandedFolders({});       // Reset expanded state
      return { success: true };
    } else {
      console.error("replaceTree failed: Provided data is not an array.", newTreeData);
      return { success: false, error: "Import failed: Invalid data format (expected an array)." };
    }
  }, [setTreeAndPersist]); // Depends on the persisting setter

  // Expand all parent folders leading up to a specific folderId
  const expandFolderPath = useCallback((folderId) => {
    if (!folderId) return; // Ignore if no ID provided

    // Recursive helper to find ancestor IDs
    const findAncestors = (nodes, id, ancestors = []) => {
        if (!Array.isArray(nodes)) return null; // Safety check
        for (const item of nodes) {
            if (item.id === id) return ancestors; // Found the item, return collected ancestors
            if (item.type === "folder" && Array.isArray(item.children)) {
                 // Recurse, adding current item's ID to potential ancestors
                const found = findAncestors(item.children, id, [...ancestors, item.id]);
                if (found) return found; // Pass up the result if found in children
            }
        }
        return null; // Not found in this branch
    };

    const currentTree = Array.isArray(tree) ? tree : []; // Ensure tree is usable
    const ancestors = findAncestors(currentTree, folderId);

    // Update expanded state using functional update
    setExpandedFolders((prev) => {
      const next = { ...prev }; // Copy previous state
      if (ancestors) {
        ancestors.forEach((pid) => (next[pid] = true)); // Mark all ancestors as expanded
      }
      next[folderId] = true; // Mark the target folder itself as expanded
      return next; // Return the new state
    });
  }, [tree]); // Depends on the tree structure

  // Toggle the expansion state of a single folder
  const toggleFolderExpand = useCallback((id, forceState) => {
    if (!id) return; // Ignore if no ID provided
    setExpandedFolders((prev) => ({
      ...prev,
      [id]: forceState !== undefined ? Boolean(forceState) : !prev[id], // Use forced state or toggle
    }));
  }, []); // No dependencies needed


  // --- Content/Task Updates ---
  // Update the content of a note or task
  const updateNoteContent = useCallback((itemId, content) => {
    // Recursive function to find and update the item
    const recurse = (items) =>
      items.map((it) =>
        it.id === itemId
          ? { ...it, content } // Found: return updated item
          : Array.isArray(it.children)
          ? { ...it, children: recurse(it.children) } // Not found, recurse into children
          : it // Not found, not a folder: return as is
      );
    setTreeAndPersist(recurse); // Update state and persist
  }, [setTreeAndPersist]);

  // Update properties of a task (e.g., completed status, content)
  const updateTask = useCallback((taskId, updates) => {
    const recurse = (items) =>
      items.map((it) =>
        it.id === taskId && it.type === 'task'
          ? { ...it, ...updates } // Found task: merge updates
          : Array.isArray(it.children)
          ? { ...it, children: recurse(it.children) } // Recurse
          : it
      );
    setTreeAndPersist(recurse);
  }, [setTreeAndPersist]);

  // --- Item Operations (Add, Rename, Delete, Duplicate) ---

  /**
   * Adds a new item. Performs sibling name validation.
   * Returns { success: boolean, error?: string }
   */
  const addItem = useCallback((newItem, parentId) => {
    const trimmedLabel = newItem?.label?.trim();
    console.log(`addItem Hook: Attempting to add "${trimmedLabel}" under parentId: ${parentId}`);

    if (!newItem || !newItem.id || !trimmedLabel) {
      console.error("addItem Hook failed: newItem is invalid (missing id or label).", { newItem });
      return { success: false, error: "Invalid item data provided." };
    }

    // --- Corrected Sibling Finding Logic for ADD ---
    let siblings = [];
    let parentItem = null;

    if (parentId === null) {
      // Adding to root: siblings are the items in the root of the tree
      siblings = tree || []; // Use current tree state from the hook
      console.log(`addItem Hook: Target is ROOT. Found siblings:`, siblings.map(s=>s?.label ?? 'N/A'));
    } else {
      // Adding to a specific folder: siblings are the children of that folder
      parentItem = findItemById(tree, parentId); // Find the parent folder using current tree state
      if (!parentItem || parentItem.type !== 'folder') {
        console.error(`addItem Hook failed: Target parent folder with id ${parentId} not found or is not a folder.`);
        return { success: false, error: "Target parent folder not found or invalid." };
      }
      siblings = parentItem.children || []; // Siblings are the children array of the found parent
      console.log(`addItem Hook: Target parent ${parentItem.label} (${parentId}). Found siblings:`, siblings.map(s=>s?.label ?? 'N/A'));
    }
    // --- End Corrected Sibling Finding Logic ---


    // --- Sibling Name Validation ---
    // Check if the new name conflicts with any existing sibling names (case-insensitive)
    const conflictExists = hasSiblingWithName(siblings, trimmedLabel, null); // excludeId is null for new items
    console.log(`addItem Hook: Checking name "${trimmedLabel}" against siblings. Conflict exists? ${conflictExists}`);

    if (conflictExists) {
        const errorMsg = `An item named "${trimmedLabel}" already exists at this level.`;
        console.warn("addItem Hook prevented:", errorMsg);
        return { success: false, error: errorMsg }; // Return error if conflict found
    }
    // --- End Validation ---

    console.log(`addItem Hook: Validation passed for "${trimmedLabel}". Proceeding to add.`);
    // Use functional update with the recursive utility to insert the item
    setTreeAndPersist((prevTree) => insertItemRecursive(prevTree, parentId, newItem));

    // Expand the parent folder after adding, use setTimeout for state updates
    if (parentId) {
       setTimeout(() => expandFolderPath(parentId), 0);
    }
    return { success: true }; // Return success
  }, [setTreeAndPersist, expandFolderPath, tree]); // Depends on tree for validation


  /**
   * Renames an item. Performs sibling name validation.
   * Returns { success: boolean, error?: string }
   */
  const renameItem = useCallback((itemId, newLabel) => {
      const trimmedLabel = newLabel?.trim();
      // Validate input
      if (!trimmedLabel || !itemId) {
          console.warn("renameItem Hook: Invalid ID or empty name provided.");
          return { success: false, error: "Cannot rename: Invalid ID or empty name provided." };
      }

      // --- Sibling Name Validation for RENAME ---
      // Use findParentAndSiblings to get the context of the item being renamed
      const { parent, siblings } = findParentAndSiblings(tree, itemId); // Use current tree state
      console.log(`renameItem Hook: Item ID ${itemId}. Found parent: ${parent?.label ?? 'ROOT'}. Found siblings:`, siblings?.map(s=>s?.label ?? 'N/A'));

      // Check for conflict, EXCLUDING the item itself (itemId) from the check
      const conflictExists = hasSiblingWithName(siblings, trimmedLabel, itemId);
      console.log(`renameItem Hook: Checking name "${trimmedLabel}" for item ${itemId}. Conflict exists? ${conflictExists}`);

      if (conflictExists) {
          const errorMsg = `An item named "${trimmedLabel}" already exists at this level.`;
          console.warn("renameItem Hook prevented:", errorMsg);
          return { success: false, error: errorMsg }; // Return error if conflict found
      }
      // --- End Validation ---

      console.log(`renameItem Hook: Validation passed for "${trimmedLabel}". Proceeding to rename.`);
      // Use functional update with the recursive utility to rename
      setTreeAndPersist((currentTree) => renameItemRecursive(currentTree, itemId, trimmedLabel));
      return { success: true }; // Return success
  }, [setTreeAndPersist, tree]); // Depends on tree for validation


  /**
   * Deletes an item and cleans up selection/expansion state.
   */
  const deleteItem = useCallback((idToDelete) => {
    if (!idToDelete) return; // Ignore if no ID

    console.log(`deleteItem Hook: Deleting item ${idToDelete}`);
    setTreeAndPersist((currentTree) => deleteItemRecursive(currentTree, idToDelete));

    // Reset selection if the deleted item was selected
    if (selectedItemId === idToDelete) {
      console.log(`deleteItem Hook: Clearing selection as deleted item was selected.`);
      setSelectedItemId(null);
    }
    // Remove from expanded folders state if it was a deleted folder
    setExpandedFolders((prev) => {
      // Only create new object if key exists
      if (prev.hasOwnProperty(idToDelete)) {
        const next = { ...prev };
        delete next[idToDelete];
        console.log(`deleteItem Hook: Removing ${idToDelete} from expanded state.`);
        return next;
      }
      return prev; // Return previous state if key wasn't present
    });
    // Close context menu if open
    setContextMenu((m) => m.visible ? { ...m, visible: false } : m);
  }, [selectedItemId, setTreeAndPersist]); // Dependencies are state setters and selectedItemId


  /**
   * Duplicates an item. Handles potential name conflicts by appending "-dup" or "-dup (n)".
   */
   const duplicateItem = useCallback((itemId) => {
        const itemToDuplicate = findItemById(tree, itemId); // Find the original item
        if (!itemToDuplicate) {
            console.error("duplicateItem Hook failed: Item to duplicate not found", itemId);
            return; // Or return { success: false, error: ... }
        }

        // Find the context (parent/siblings) of the original item to check for name conflicts
        const { parent, siblings } = findParentAndSiblings(tree, itemId); // Use current tree state
        const parentId = parent?.id ?? null; // Parent ID for insertion (null for root)

        // Determine a unique name for the duplicate
        let baseName = itemToDuplicate.label;
        let duplicateLabel = `${baseName}-dup`;
        let counter = 1;
        console.log(`duplicateItem Hook: Base name "${baseName}", initial proposed "${duplicateLabel}" for parentId ${parentId}`);

        // Check name against the *original* siblings array
        while (hasSiblingWithName(siblings, duplicateLabel, null)) { // excludeId is null
            counter++;
            duplicateLabel = `${baseName}-dup (${counter})`;
            console.log(`duplicateItem Hook: Conflict found, trying "${duplicateLabel}"`);
        }
        console.log(`duplicateItem Hook: Final unique name "${duplicateLabel}"`);

        // Create the duplicate with new IDs and the unique label
        let duplicate = assignNewIds(itemToDuplicate); // Assign new IDs recursively
        duplicate.label = duplicateLabel; // Set the unique label

        // Insert the duplicate using functional update
        setTreeAndPersist((prevTree) => insertItemRecursive(prevTree, parentId, duplicate));

        setContextMenu((m) => ({ ...m, visible: false })); // Close context menu
        // Optional: Expand parent if duplicating into a folder
        if(parentId) {
            setTimeout(() => expandFolderPath(parentId), 0);
        }
  }, [tree, setTreeAndPersist, expandFolderPath]); // Depends on tree


  // --- Drag and Drop ---
  // Handles the drop event after validation in treeUtils
  const handleDrop = useCallback((targetId) => {
    const currentDraggedId = draggedId; // Capture draggedId before resetting
    setDraggedId(null); // Reset drag state immediately

    if (!currentDraggedId || targetId === currentDraggedId) {
      return; // Ignore invalid drops
    }

    console.log(`handleDrop Hook: Attempting drop of ${currentDraggedId} onto ${targetId}`);
    // Use the utility function which includes validation (ancestor, name conflict)
    // Pass the current tree state for validation
    const nextTree = treeHandleDropUtil(tree, targetId, currentDraggedId);

    if (nextTree) {
      console.log(`handleDrop Hook: Drop successful. Updating tree.`);
      setTreeAndPersist(nextTree); // Persist the new tree structure
      toggleFolderExpand(targetId, true); // Expand the target folder
    } else {
      console.warn("handleDrop Hook: Drop deemed invalid by treeUtils. No tree update.");
      // User feedback (alert) is handled within treeHandleDropUtil
    }
  }, [draggedId, tree, setTreeAndPersist, toggleFolderExpand]);


  // --- Clipboard Operations ---
  // Copies item data to the clipboard state
  const copyItem = useCallback((itemId) => {
    const itemToCopy = findItemById(tree, itemId); // Find the item in the current tree
    if (itemToCopy) {
      try {
        const deepCopy = typeof structuredClone === "function"
          ? structuredClone(itemToCopy)
          : JSON.parse(JSON.stringify(itemToCopy)); // Fallback

        setClipboardItem(deepCopy);
        setClipboardMode("copy");
        setCutItemId(null); // Clear any previous cut state
        console.log("Copied item:", itemToCopy.label);
      } catch (e) {
        console.error("Failed to copy item:", e);
        setClipboardItem(null); setClipboardMode(null); setCutItemId(null);
      }
    } else {
         console.warn("copyItem: Item not found", itemId);
    }
    setContextMenu((m) => ({ ...m, visible: false })); // Close context menu
  }, [tree]); // Depends on tree


  // Sets clipboard state for cutting an item
  const cutItem = useCallback((itemId) => {
    const itemToCut = findItemById(tree, itemId); // Find the item in the current tree
    if (itemToCut) {
      try {
        const deepCopy = typeof structuredClone === "function"
          ? structuredClone(itemToCut)
          : JSON.parse(JSON.stringify(itemToCut));

        setClipboardItem(deepCopy);
        setClipboardMode("cut");
        setCutItemId(itemId); // Store the ID of the item being cut
        console.log("Cut item:", itemToCut.label, "ID:", itemId);
      } catch (e) {
        console.error("Failed to cut item:", e);
        setClipboardItem(null); setClipboardMode(null); setCutItemId(null);
      }
    } else {
         console.warn("cutItem: Item not found", itemId);
    }
    setContextMenu((m) => ({ ...m, visible: false })); // Close context menu
  }, [tree]); // Depends on tree


  /**
   * Pastes the clipboard item. Handles validation (ancestor check, name conflicts).
   * Returns { success: boolean, error?: string }
   */
  const pasteItem = useCallback((targetFolderId) => {
    console.log(`pasteItem Hook: Attempting to paste "${clipboardItem?.label}" into targetFolderId: ${targetFolderId}`);
    if (!clipboardItem) {
      console.warn("pasteItem Hook: Clipboard is empty.");
      return { success: false, error: "Clipboard is empty." };
    }

    const originalClipboardItemId = clipboardItem.id; // ID from the copied/cut item data
    const currentCutItemIdValue = cutItemId;       // Original ID if it was a cut
    const currentClipboardMode = clipboardMode;

    // --- Ancestor Check (Prevent pasting a folder into itself/descendant) ---
    if (clipboardItem.type === "folder" && isSelfOrDescendant(tree, originalClipboardItemId, targetFolderId)) {
        const errorMsg = `Cannot paste folder "${clipboardItem.label}" into itself or one of its subfolders.`;
        console.warn("pasteItem Hook prevented: Ancestor check failed.", errorMsg);
        return { success: false, error: errorMsg };
    }

    // --- Corrected Sibling Finding Logic for PASTE Validation ---
    let targetSiblings = [];
    let targetParent = null;

    if (targetFolderId === null) {
      // Pasting to root: siblings are items in the root
      targetSiblings = tree || [];
      console.log(`pasteItem Hook: Target is ROOT. Found siblings:`, targetSiblings.map(s=>s?.label ?? 'N/A'));
    } else {
      // Pasting to a folder: siblings are the children of that folder
      targetParent = findItemById(tree, targetFolderId);
      if (!targetParent || targetParent.type !== 'folder') {
        console.error(`pasteItem Hook failed: Target folder with id ${targetFolderId} not found or is not a folder.`);
        return { success: false, error: "Target folder not found or invalid." };
      }
      targetSiblings = targetParent.children || [];
      console.log(`pasteItem Hook: Target folder ${targetParent.label} (${targetFolderId}). Found siblings:`, targetSiblings.map(s=>s?.label ?? 'N/A'));
    }
    // --- End Corrected Sibling Finding Logic ---


    // --- Sibling Name Validation for Paste ---
    // Find the original parent of the cut item to see if it's moving within the same folder
    // Use the CORRECTED findParentAndSiblings utility here
    const { parent: sourceParent } = findParentAndSiblings(tree, currentCutItemIdValue); // Use cutItemIdValue if available
    // Check if targetFolderId matches sourceParent's id (null for root handled) & it's a 'cut'
    const isMovingInSameFolder = currentClipboardMode === 'cut' && sourceParent?.id === targetFolderId;
    console.log(`pasteItem Hook: Is moving in same folder during cut? ${isMovingInSameFolder}`);

    let conflictExists = false;
    // Only check name conflicts if NOT moving within the same folder during a cut
    if (!isMovingInSameFolder) {
        // Check clipboard item's name against the CORRECT target siblings
        conflictExists = hasSiblingWithName(targetSiblings, clipboardItem.label, null); // excludeId is null
        console.log(`pasteItem Hook: Checking name "${clipboardItem.label}" in target siblings. Conflict exists? ${conflictExists}`);
    } else {
         console.log(`pasteItem Hook: Skipping name check because item is being cut/pasted within the same folder.`);
    }

    if (conflictExists) {
        const errorMsg = `An item named "${clipboardItem.label}" already exists in the target location.`;
        console.warn("pasteItem Hook prevented: Name conflict.", errorMsg);
        return { success: false, error: errorMsg };
    }
    // --- End Validation ---

    console.log(`pasteItem Hook: Validation passed for "${clipboardItem.label}". Proceeding to paste.`);
    // Always assign new IDs when pasting, even for cut, to ensure tree integrity
    const itemToPasteWithNewIds = assignNewIds(clipboardItem);

    // Perform insertion and potential deletion (for cut) using functional update
    setTreeAndPersist((currentTree) => {
      // 1. Insert the item (with new IDs)
      let newTree = insertItemRecursive(currentTree, targetFolderId, itemToPasteWithNewIds);

      // 2. If it was a 'cut', delete the original (using cutItemIdValue)
      if (currentClipboardMode === "cut" && currentCutItemIdValue) {
          // Verify insertion seems to have worked before deleting original
          const pastedItemExists = findItemById(newTree, itemToPasteWithNewIds.id);
          if (pastedItemExists) {
            console.log(`Cut/Paste Hook: Deleting original item with ID: ${currentCutItemIdValue}`);
            newTree = deleteItemRecursive(newTree, currentCutItemIdValue);
          } else {
             // Log error and revert if insertion failed during a cut
             console.error("Paste ERROR during CUT: Item was not found after supposed insertion! Reverting tree.", { targetFolderId, pastedId: itemToPasteWithNewIds.id, cutId: currentCutItemIdValue });
             return currentTree; // Return original tree to prevent deletion without paste
          }
      }
      return newTree; // Return the modified tree
    });

    // Clear cut state ONLY if the operation was a 'cut'
    if (currentClipboardMode === "cut") {
        console.log("pasteItem Hook: Clearing cut state.");
        setCutItemId(null);
        // Optionally clear clipboard fully after a successful cut/paste
        // setClipboardItem(null);
        // setClipboardMode(null);
    }

    // Expand the target folder after pasting
    if (targetFolderId) {
        setTimeout(() => expandFolderPath(targetFolderId), 0);
    }

    setContextMenu((m) => ({ ...m, visible: false })); // Close context menu
    return { success: true }; // Indicate success
  }, [clipboardItem, clipboardMode, cutItemId, tree, setTreeAndPersist, expandFolderPath]); // Include dependencies


  // --- Export and Import Functions ---
  // Handles exporting the selected item or the entire tree
  const handleExport = useCallback((target, format) => {
        let dataToExport;
        let fileName;
        // Find selected item again based on current state, selectedItem memo might be slightly stale
        const currentSelectedItem = findItemById(tree, selectedItemId);

        // Determine what data to export based on the target ('selected' or 'entire')
        if (target === "selected") {
            if (!currentSelectedItem) { alert("No item is selected to export."); return; }
            dataToExport = currentSelectedItem; // Export only the selected item (and its children if folder)
            fileName = `${currentSelectedItem.label}-export`;
        } else { // Target is 'entire' or unspecified default
            dataToExport = tree; // Export the entire tree structure
            fileName = "tree-export";
        }

        // Export based on the chosen format
        if (format === "json") {
             try {
                const jsonStr = JSON.stringify(dataToExport, null, 2); // Pretty-print JSON
                const blob = new Blob([jsonStr], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                // Create a temporary link to trigger download
                const a = document.createElement("a");
                a.href = url;
                a.download = fileName + ".json";
                document.body.appendChild(a);
                a.click(); // Simulate click
                document.body.removeChild(a); // Clean up the link
                URL.revokeObjectURL(url); // Release object URL
            } catch (error) { console.error("JSON export failed:", error); alert("Failed to export as JSON."); }
        } else if (format === "pdf") {
            try {
                const doc = new jsPDF();
                // Font setup (assuming NotoSansHebrewBase64 is imported correctly)
                const FONT_NAME = 'NotoSansHebrew';
                const FONT_FILENAME = 'NotoSansHebrew-Regular.ttf';
                const FONT_STYLE_NORMAL = 'normal';
                const FONT_STYLE_BOLD = 'bold';

                if (notoSansHebrewBase64) {
                    try {
                        // Add font file to jsPDF's virtual file system if not already present
                        if (!doc.getFileFromVFS(FONT_FILENAME)) { doc.addFileToVFS(FONT_FILENAME, notoSansHebrewBase64); }
                        // Add font variations
                        doc.addFont(FONT_FILENAME, FONT_NAME, FONT_STYLE_NORMAL);
                        doc.addFont(FONT_FILENAME, FONT_NAME, FONT_STYLE_BOLD);
                         doc.setFont(FONT_NAME, FONT_STYLE_NORMAL); // Set default font
                    } catch (fontError) { console.error("Error loading/adding Hebrew font:", fontError); alert("Failed to load Hebrew font for PDF export. Hebrew text may not display correctly."); }
                } else { console.warn("Hebrew font data could not be imported for PDF export."); alert("Hebrew font not configured. Hebrew text may not display correctly."); }


                // PDF layout constants
                const PAGE_MARGIN = 15;
                const FONT_SIZE_LABEL = 12; const FONT_SIZE_CONTENT = 10;
                const lineHeightFactor = doc.getLineHeightFactor ? doc.getLineHeightFactor() : 1.15; // Get line height factor
                const LINE_SPACING_LABEL = FONT_SIZE_LABEL * lineHeightFactor;
                const LINE_SPACING_CONTENT = FONT_SIZE_CONTENT * lineHeightFactor;
                const CONTENT_INDENT = 5; // Indentation for content relative to label
                let cursorY = PAGE_MARGIN; // Start drawing from the top margin
                const pageHeight = doc.internal.pageSize.getHeight();
                const pageWidth = doc.internal.pageSize.getWidth();
                const maxLineWidth = pageWidth - PAGE_MARGIN * 2; // Maximum width for text

                // Helper function to add text, handle line breaks, page breaks, and BiDi
                const addText = (text, x, y, options = {}) => {
                    const { fontSize = FONT_SIZE_CONTENT, fontStyle = FONT_STYLE_NORMAL, isLabel = false } = options;
                    const currentLineHeight = isLabel ? LINE_SPACING_LABEL : LINE_SPACING_CONTENT;
                    doc.setFont(FONT_NAME, fontStyle); // Set font style and size for this text block
                    doc.setFontSize(fontSize);

                    // Calculate available width based on current indentation
                    const availableWidth = maxLineWidth - (x - PAGE_MARGIN);

                    // Prepare text for rendering, applying BiDi reordering if needed
                    let processedTextForRendering = text;
                    const needsBiDi = /[\u0590-\u05FF]/.test(text); // Simple check for Hebrew characters
                    if (needsBiDi) {
                        try {
                            const levels = bidi.getEmbeddingLevels(text);
                            processedTextForRendering = bidi.getReorderedString(text, levels);
                        } catch (bidiError) {
                            console.error("BiDi processing failed for text:", text, bidiError);
                            // Proceed with original text if BiDi fails
                        }
                    }

                    // Split text into lines that fit within the available width
                    const lines = doc.splitTextToSize(processedTextForRendering, availableWidth);

                    // Draw each line
                    lines.forEach((line) => {
                        // Check if adding this line exceeds page height
                        if (cursorY + currentLineHeight > pageHeight - PAGE_MARGIN) {
                            doc.addPage(); // Add a new page
                            cursorY = PAGE_MARGIN; // Reset cursor to top margin
                            // Re-apply font settings on new page
                            doc.setFont(FONT_NAME, fontStyle);
                            doc.setFontSize(fontSize);
                        }
                        // Handle RTL alignment for Hebrew text
                        const isRTL = /[\u0590-\u05FF]/.test(line); // Check per line might be more robust
                        const textX = isRTL ? pageWidth - x : x; // Adjust X for RTL
                        const textOptions = { align: isRTL ? 'right' : 'left' };
                        if (isRTL) textOptions.lang = 'he'; // Hint language for potential PDF features

                        doc.text(line, textX, cursorY, textOptions); // Draw the text
                        cursorY += currentLineHeight; // Move cursor down
                    });
                    // Add a small gap after a block of text
                    if (lines.length > 0) cursorY += currentLineHeight * 0.3;
                };

                // Recursive function to build the PDF content from the tree structure
                const buildPdfContent = (item, indentLevel = 0) => {
                    if (!item) return; // Skip if item is null/undefined

                    const currentIndent = PAGE_MARGIN + (indentLevel * 10); // Calculate indentation
                    // Determine icon based on item type
                    const labelIcon = item.type === 'folder' ? '📁' : item.type === 'note' ? '📝' : (item.type === 'task' ? (item.completed ? '✅' : '⬜️') : '❓');
                    const labelText = `${labelIcon} ${item.label || 'Untitled'}`;

                    // Add the item label (bold)
                    addText(labelText, currentIndent, cursorY, { fontSize: FONT_SIZE_LABEL, fontStyle: FONT_STYLE_BOLD, isLabel: true });

                    // Add item content if it exists (for notes and tasks)
                    if (item.content && (item.type === 'note' || item.type === 'task')) {
                        const plainTextContent = htmlToPlainTextWithNewlines(item.content);
                        if (plainTextContent) {
                            // Add content indented under the label
                            addText(plainTextContent, currentIndent + CONTENT_INDENT, cursorY, { fontSize: FONT_SIZE_CONTENT, fontStyle: FONT_STYLE_NORMAL });
                        }
                    }

                    // Recursively process children if they exist
                    if (item.type === 'folder' && Array.isArray(item.children) && item.children.length > 0) {
                        cursorY += LINE_SPACING_CONTENT * 0.5; // Add space before children
                        sortItems(item.children).forEach((child) => buildPdfContent(child, indentLevel + 1)); // Process sorted children
                    }
                };

                // Start building the PDF from the determined dataToExport
                doc.setFont(FONT_NAME, FONT_STYLE_NORMAL); // Ensure default font is set initially
                doc.setFontSize(FONT_SIZE_CONTENT);

                if (target === "selected" && dataToExport) {
                    buildPdfContent(dataToExport, 0); // Build from the single selected item
                } else if (Array.isArray(dataToExport)) {
                    // Build from the root array, adding space between root items
                    sortItems(dataToExport).forEach((item, index) => {
                        buildPdfContent(item, 0); // Build each root item
                        // Add extra space between root items, checking for page breaks
                        if (index < dataToExport.length - 1) {
                             cursorY += LINE_SPACING_LABEL; // Add space after a root item
                            if (cursorY > pageHeight - PAGE_MARGIN - (LINE_SPACING_LABEL * 2)) { // Check if space pushes to next page
                                doc.addPage(); cursorY = PAGE_MARGIN; // Add page if needed
                            }
                        }
                    });
                }
                // Save the generated PDF
                doc.save(fileName + ".pdf");
            } catch(error) { console.error("PDF export failed:", error); alert("Failed to generate PDF."); }
        }
  }, [tree, selectedItemId]); // Dependencies: tree state and selected item ID


  /**
   * Handles importing a JSON file. Validates structure and name conflicts.
   * Returns Promise<{ success: boolean, error?: string }>
   */
  const handleImport = useCallback((file, importTargetOption) => {
    return new Promise((resolve) => {
        // Basic file validation
        if (!file || file.type !== 'application/json') {
            resolve({ success: false, error: "Import failed: Please select a valid JSON file (.json)." });
            return;
        }

        const reader = new FileReader();

        // Handle successful file read
        reader.onload = (e) => {
            let importedData;
            try {
                importedData = JSON.parse(e.target.result); // Parse the JSON content
            } catch (error) {
                console.error("Import JSON parsing failed:", error);
                resolve({ success: false, error: `Failed to parse JSON file: ${error.message}` });
                return;
            }

            try {
                // --- Basic Structure Validation ---
                const isValidItem = (item) => typeof item === 'object' && item !== null && 'id' in item && 'label' in item && 'type' in item;
                const isValidStructure = (data) => {
                    if (Array.isArray(data)) {
                        return data.every(isValidItem);
                    } else {
                         return isValidItem(data);
                    }
                };
                if (!isValidStructure(importedData)) { throw new Error("Invalid JSON structure (items must have id, label, type)."); }

                // Ensure itemsToImport is always an array
                const itemsToImport = Array.isArray(importedData) ? importedData : [importedData];

                // --- Perform Import based on Target Option ---
                if (importTargetOption === "tree") {
                    // Option 1: Replace the entire tree
                    console.log("handleImport Hook: Replacing entire tree.");
                    // Assign new IDs to avoid potential collisions if importing modified old data
                    resolve(replaceTree(itemsToImport.map(item => assignNewIds(item))));
                } else {
                    // Option 2: Import under the currently selected item
                    console.log(`handleImport Hook: Importing under selected item: ${selectedItemId}`);
                    const currentSelectedItem = findItemById(tree, selectedItemId); // Use current tree state

                    // Validate selected item
                    if (!currentSelectedItem) { resolve({ success: false, error: "Import failed: No item selected as target." }); return; }
                    if (currentSelectedItem.type !== "folder") { resolve({ success: false, error: "Import failed: Selected item must be a folder." }); return; }

                    // --- Sibling Name Validation for Import ---
                    const targetSiblings = currentSelectedItem.children || []; // Get children of the target folder
                    console.log(`handleImport Hook: Target folder "${currentSelectedItem.label}". Existing children:`, targetSiblings.map(s=>s?.label));
                    for (const item of itemsToImport) {
                        if (hasSiblingWithName(targetSiblings, item.label, null)) { // Check against existing children
                            const errorMsg = `Import failed: An item named "${item.label}" already exists in the target folder "${currentSelectedItem.label}".`;
                            console.warn("handleImport Hook:", errorMsg);
                            resolve({ success: false, error: errorMsg });
                            return; // Abort on the first conflict
                        }
                    }
                    console.log(`handleImport Hook: Name validation passed for all items.`);
                    // --- End Validation ---

                    // Assign new IDs to all imported items and their descendants
                    const itemsWithNewIds = itemsToImport.map(item => assignNewIds(item));

                    // Insert items into the target folder using functional update
                    setTreeAndPersist((prevTree) => {
                        let currentSubTree = prevTree;
                        itemsWithNewIds.forEach(item => {
                            console.log(`handleImport Hook: Inserting item "${item.label}" into ${selectedItemId}`);
                            currentSubTree = insertItemRecursive(currentSubTree, selectedItemId, item);
                        });
                        return currentSubTree; // Return the updated tree
                    });

                    // Expand the target folder after import
                    setTimeout(() => expandFolderPath(selectedItemId), 0);
                    resolve({ success: true }); // Indicate successful import under item
                }
            } catch (error) { // Catch errors from validation or processing
                console.error("Import processing failed:", error);
                resolve({ success: false, error: `Failed to process import data: ${error.message}` });
            }
        };

        // Handle file reading errors
        reader.onerror = (error) => {
            console.error("File reading error:", error);
            resolve({ success: false, error: "Failed to read the selected file." });
        };

        // Read the file content as text
        reader.readAsText(file);
    });
  }, [tree, selectedItemId, setTreeAndPersist, replaceTree, expandFolderPath]); // Include dependencies


  // --- Return Hook State and Methods ---
  return {
    // State
    tree,
    selectedItem, // Memoized selected item object
    selectedItemId,
    contextMenu,
    expandedFolders,
    draggedId,
    clipboardItem,
    clipboardMode,
    // Actions
    setContextMenu, // Allow App to control context menu visibility/position
    setDraggedId,   // Allow Tree component to set dragged item
    selectItemById,
    toggleFolderExpand,
    updateNoteContent,
    updateTask,
    addItem,        // Includes validation
    renameItem,     // Includes validation
    deleteItem,
    duplicateItem,  // Includes validation
    handleDrop,     // Includes validation
    copyItem,
    cutItem,
    pasteItem,      // Includes validation
    handleExport,
    handleImport,   // Includes validation
  };
}; // End of useTree hook