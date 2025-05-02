// src/hooks/useTree.js
import { useState, useEffect, useCallback, useMemo } from "react";
import { LOCAL_STORAGE_KEY } from "../utils/constants";
import { sortItems, handleDrop as treeHandleDropUtil } from "../utils/treeUtils";

// --- Helper Functions ---

// Find item by ID (recursive)
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

// Assign new unique IDs recursively
const assignNewIds = (item) => {
  // Simple unique enough ID for this context
  const newItem = { ...item, id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9) };
  if (Array.isArray(newItem.children)) {
    newItem.children = newItem.children.map(assignNewIds);
  }
  return newItem;
};

// Delete item recursively from a given tree structure
const deleteItemRecursive = (items, idToDelete) => {
    // Ensure items is an array before filtering
    const baseItems = Array.isArray(items) ? items : [];
    return baseItems
        .filter((it) => it.id !== idToDelete)
        .map((it) =>
            Array.isArray(it.children)
                ? { ...it, children: deleteItemRecursive(it.children, idToDelete) }
                : it
        );
};

// Rename item recursively within a given tree structure
const renameItemRecursive = (items, idToRename, newLabel) => {
    // Ensure items is an array before mapping
    const baseItems = Array.isArray(items) ? items : [];
    return baseItems.map((it) => {
      if (it.id === idToRename) {
        return { ...it, label: newLabel };
      }
      if (Array.isArray(it.children)) {
        const updatedChildren = renameItemRecursive(it.children, idToRename, newLabel);
        // Avoid creating new object if children didn't change
        return updatedChildren !== it.children ? { ...it, children: updatedChildren } : it;
      }
      return it;
    });
};

// Insert item recursively into the target folder ID or root
const insertItemRecursive = (nodes, targetFolderId, itemToInsert) => {
    const baseNodes = Array.isArray(nodes) ? nodes : [];
    // Base case: Operating on the root array and target is root
    if (targetFolderId === null) {
        return sortItems([...baseNodes, itemToInsert]);
    }

    // Recursive step: Map through nodes
    return baseNodes.map(node => {
        if (node.id === targetFolderId && node.type === 'folder') {
            // Found the target folder: insert item into its children
            const currentChildren = Array.isArray(node.children) ? node.children : [];
            return {
                ...node,
                children: sortItems([...currentChildren, itemToInsert])
            };
        } else if (Array.isArray(node.children)) {
             // Recurse into children of non-target nodes
            const updatedChildren = insertItemRecursive(node.children, targetFolderId, itemToInsert);
            // Avoid creating new object if children didn't change
            return updatedChildren !== node.children ? { ...node, children: updatedChildren } : node;
        }
        // Not the target, not a folder with children to recurse into
        return node;
    });
};

// Check if potentialTargetId is the checkItemId or one of its descendants (within nodes)
const isSelfOrDescendant = (nodes, checkItemId, potentialTargetId) => {
     if (!checkItemId || !potentialTargetId) return false; // Cannot paste into nothing or if item doesn't exist
     if (checkItemId === potentialTargetId) return true; // Is self

     const item = findItemById(nodes, checkItemId);
     // If item not found or has no children, target cannot be a descendant
     if (!item || !Array.isArray(item.children)) return false;

     // Check children recursively
     for (const child of item.children) {
          if (child.id === potentialTargetId) return true; // Direct descendant
          // Recurse only if child is a folder and check its descendants
          // Pass child's subtree ([child]) for the recursive check is incorrect logic here,
          // we need to check within the main nodes structure passed down.
          // Instead, just recurse using the child's ID as the new checkItemId.
          if (child.type === 'folder' && isSelfOrDescendant(nodes, child.id, potentialTargetId)) {
               // Correction: The original check within isDescendant in useTree was flawed.
               // This revised check correctly uses findItemById from the root 'nodes'.
               // Let's simplify the check logic within pasteItem itself later.
              return true; // Found descendant
          }
     }
     // Checked all children, target not found as descendant
     return false;
};


// --- useTree Hook ---
export const useTree = () => {
    const EXPANDED_KEY = `${LOCAL_STORAGE_KEY}_expanded`;
    const [tree, setTree] = useState(() => {
        try {
            const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
            // Ensure loaded data is an array
            const parsed = stored ? JSON.parse(stored) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch { console.error("Failed to load tree from localStorage."); return []; }
    });
    const [selectedItemId, setSelectedItemId] = useState(null);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, item: null, isEmptyArea: false });
    const [expandedFolders, setExpandedFolders] = useState(() => {
        try {
            const stored = localStorage.getItem(EXPANDED_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch { console.error("Failed to load expanded folders from localStorage."); return {}; }
    });
    const [draggedId, setDraggedId] = useState(null);
    // Clipboard State
    const [clipboardItem, setClipboardItem] = useState(null);
    const [clipboardMode, setClipboardMode] = useState(null);
    const [cutItemId, setCutItemId] = useState(null);


    // Derived State
    const selectedItem = useMemo(() => findItemById(tree, selectedItemId), [tree, selectedItemId]);

    // --- Persistence Effects ---
    useEffect(() => {
        // Persist expanded folders state
        try { localStorage.setItem(EXPANDED_KEY, JSON.stringify(expandedFolders)); }
        catch (error) { console.error("Failed to save expanded folders to localStorage:", error); }
    }, [expandedFolders]);

    // Internal function to update tree state and persist
    const setTreeAndPersist = useCallback((newTreeOrCallback) => {
        setTree(prevTree => {
            // Resolve the new tree state whether it's a value or a function
            const newTree = typeof newTreeOrCallback === 'function'
                ? newTreeOrCallback(prevTree)
                : newTreeOrCallback;
            // Persist the resolved state
            try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newTree)); }
            catch (error) { console.error("Failed to save tree to localStorage:", error); }
            // Return the new state for React to use
            return newTree;
        });
    }, []); // No external dependencies needed

    // --- Tree Manipulation Callbacks ---
    const toggleFolderExpand = useCallback((id, forced) => {
        setExpandedFolders(prev => ({ ...prev, [id]: forced !== undefined ? forced : !prev[id] }));
    }, []); // No external dependencies needed

    const expandFolderPath = useCallback((folderId) => {
        const findPath = (nodes, id, path = []) => {
            const currentNodes = Array.isArray(nodes) ? nodes : [];
            for (const it of currentNodes) {
                if (it.id === id) return [...path]; // Found item -> return path to parent
                if (Array.isArray(it.children)) {
                    const directChildMatch = it.children.find(child => child.id === id);
                    if (directChildMatch) return [...path, it.id]; // Found parent
                    const p = findPath(it.children, id, [...path, it.id]);
                    // Check if path returned from recursion is longer
                    if (p.length > path.length) return p;
                }
            }
            return []; // Return empty if not found
        };
        // Start search from the root 'tree'
        const path = findPath(tree, folderId);
        setExpandedFolders(prev => {
            const next = { ...prev };
            // Expand the ancestors AND the target folder itself
            [...path, folderId].forEach(pid => { if(pid) next[pid] = true; });
            return next;
        });
    }, [tree]); // Depends on tree structure

    const updateNoteContent = useCallback((noteId, content) => {
        const recurse = (items) => items.map(it => it.id === noteId ? { ...it, content } : (Array.isArray(it.children) ? { ...it, children: recurse(it.children) } : it));
        setTreeAndPersist(recurse);
    }, [setTreeAndPersist]);

    const updateTaskContent = useCallback((taskId, content) => {
         const recurse = (items) => items.map(it => it.id === taskId ? { ...it, content } : (Array.isArray(it.children) ? { ...it, children: recurse(it.children) } : it));
        setTreeAndPersist(recurse);
    }, [setTreeAndPersist]);

    // Rename Item
    const renameItem = useCallback((itemId, newLabel) => {
        if (!newLabel || !itemId) return;
        setTreeAndPersist(currentTree => renameItemRecursive(currentTree, itemId, newLabel));
    }, [setTreeAndPersist]);

    // Delete Item - This is the main function called externally or by pasteItem
    const deleteItem = useCallback((idToDelete) => {
        // Perform deletion using the recursive helper
        setTreeAndPersist(currentTree => deleteItemRecursive(currentTree, idToDelete));

        // Update UI state after deletion commit
        if (selectedItemId === idToDelete) setSelectedItemId(null); // Deselect if needed
        setExpandedFolders(prev => { // Remove from expanded state
            const next = {...prev};
            delete next[idToDelete];
            return next;
        });
        setContextMenu(m => ({ ...m, visible: false })); // Close context menu if open
    }, [selectedItemId, setTreeAndPersist]); // Dependencies


    const handleDrop = useCallback((targetId) => {
          const currentDraggedId = draggedId;
          if (!currentDraggedId || targetId === currentDraggedId) { setDraggedId(null); return; }
          // Use the utility function for drop logic
          const nextTree = treeHandleDropUtil(tree, targetId, currentDraggedId);
          if (nextTree) {
            setTreeAndPersist(nextTree); // Update state
            toggleFolderExpand(targetId, true); // Expand target after drop
          } else {
              console.warn("Drop deemed invalid by treeUtils.");
          }
          setDraggedId(null); // Clear dragged state
    }, [draggedId, tree, setTreeAndPersist, toggleFolderExpand]); // Add dependencies

    // Copy Item
    const copyItem = useCallback((itemId) => {
        const itemToCopy = findItemById(tree, itemId);
        if (itemToCopy) {
            try {
                // Use structuredClone if available, otherwise fallback to JSON method
                const deepCopy = typeof structuredClone === 'function'
                    ? structuredClone(itemToCopy)
                    : JSON.parse(JSON.stringify(itemToCopy));
                setClipboardItem(deepCopy);
                setClipboardMode('copy');
                setCutItemId(null); // Clear cut state
                console.log("Copied item:", itemToCopy.label);
            } catch (e) {
                console.error("Failed to copy item:", e);
                setClipboardItem(null); setClipboardMode(null); setCutItemId(null);
            }
        }
        setContextMenu(m => ({ ...m, visible: false }));
    }, [tree]); // Depends on tree state

    // Cut Item
    const cutItem = useCallback((itemId) => {
        const itemToCut = findItemById(tree, itemId);
        if (itemToCut) {
             try {
                 const deepCopy = typeof structuredClone === 'function'
                    ? structuredClone(itemToCut)
                    : JSON.parse(JSON.stringify(itemToCut));
                setClipboardItem(deepCopy);
                setClipboardMode('cut');
                setCutItemId(itemId); // Store the ORIGINAL ID
                console.log("Cut item:", itemToCut.label);
            } catch (e) {
                console.error("Failed to cut item:", e);
                setClipboardItem(null); setClipboardMode(null); setCutItemId(null);
            }
        }
        setContextMenu(m => ({ ...m, visible: false }));
    }, [tree]); // Depends on tree state


     // --- Add Item Function (used by App.jsx) ---
     // This function handles the state update logic for adding an item
     const addItem = useCallback((newItem, parentId) => {
         setTreeAndPersist(prevTree => {
            if (parentId === null) { // Add to root
                const baseNodes = Array.isArray(prevTree) ? prevTree : [];
                return sortItems([...baseNodes, newItem]);
            } else { // Add to specific parent folder
                // Use recursive insert helper
                return insertItemRecursive(prevTree, parentId, newItem);
            }
        });
        // Expanding the parent folder is handled in App.jsx after calling addItem
    }, [setTreeAndPersist]); // Depends on setTreeAndPersist


    // Paste Item
    const pasteItem = useCallback((targetFolderId) => {
        if (!clipboardItem) { console.warn("Clipboard is empty."); return; }

        const originalClipboardItemId = clipboardItem.id; // ID before assigning new ones

        // --- Validation: Prevent pasting folder into itself or descendant ---
        // This check needs to use the current tree state
        if (clipboardItem.type === 'folder') {
             // Use the correct isSelfOrDescendant check
             if (isSelfOrDescendant(tree, originalClipboardItemId, targetFolderId)) {
                  console.warn(`Paste prevented: Cannot paste folder '${clipboardItem.label}' into itself or a descendant.`);
                  alert(`Cannot paste folder '${clipboardItem.label}' into itself or one of its subfolders.`);
                  setContextMenu(m => ({ ...m, visible: false })); // Close menu on invalid paste
                  return; // Stop the paste operation
              }
        }

        // Create item with new IDs *before* updating state
        const itemToPasteWithNewIds = assignNewIds(clipboardItem);
        let successfullyPasted = false;
        const originalIdToDelete = cutItemId; // Capture the ID before potentially clearing it

        // Update the tree state using the functional form of setState
        setTreeAndPersist(currentTree => {
            // Insert the item with new IDs into the target location
            let newTree = insertItemRecursive(currentTree, targetFolderId, itemToPasteWithNewIds);

            // Check if insertion seemed successful (target was found)
            if (findItemById(newTree, itemToPasteWithNewIds.id)) {
                 successfullyPasted = true; // Mark as successful for post-update actions

                 // If cut mode, remove original AFTER successful paste
                 if (clipboardMode === 'cut' && originalIdToDelete) {
                    console.log("Paste successful (cut mode), deleting original:", originalIdToDelete);
                    newTree = deleteItemRecursive(newTree, originalIdToDelete); // Delete from the tree that includes the pasted item
                 } else {
                    console.log("Paste successful (copy mode)");
                 }
            } else {
                // This case might happen if targetFolderId becomes invalid between actions
                console.warn("Paste target folder not found or invalid during state update:", targetFolderId);
                successfullyPasted = false;
                newTree = currentTree; // Return original tree if insert failed
            }
            return newTree; // Return the final tree state for this update
        });

        // Post-paste UI updates (Run AFTER state update commits)
        // Use useEffect or simply run after the state update call
        if (successfullyPasted) {
            if (clipboardMode === 'cut') {
                 setCutItemId(null); // Clear cut state only after successful paste & potential delete
                 // Optional: Clear clipboard after cut/paste?
                 // setClipboardMode(null);
                 // setClipboardItem(null);
            }
            if (targetFolderId) {
                // Ensure target folder is expanded after successful paste
                // Adding a slight delay might help if state update isn't immediate enough for path finding
                setTimeout(() => expandFolderPath(targetFolderId), 0);
            }
        }
        setContextMenu(m => ({ ...m, visible: false })); // Close context menu

    }, [clipboardItem, clipboardMode, cutItemId, setTreeAndPersist, expandFolderPath, tree]); // Add tree dependency for validation


    // Context menu for empty area
    const handleEmptyAreaContextMenu = useCallback((e) => {
        e.preventDefault();
        // Close any inline rename before showing context menu
        // cancelInlineRename(); // Assuming cancelInlineRename is available if needed here
        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, item: null, isEmptyArea: true });
    }, []); // No dependencies


    // --- Return values exposed by the hook ---
    // KEEP THIS ORDER: Define all functions above, then return them here.
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
        // Clipboard
        clipboardItem,
        clipboardMode,
        copyItem,
        cutItem,
        pasteItem,
        // Add Item
        addItem, // Make sure addItem is included here
    };
}; // End of useTree hook definition