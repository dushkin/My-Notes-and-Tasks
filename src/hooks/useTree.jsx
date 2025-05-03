// src/hooks/useTree.jsx
import { useState, useEffect, useCallback, useMemo } from "react";
import { LOCAL_STORAGE_KEY } from "../utils/constants";
import {
  sortItems,
  handleDrop as treeHandleDropUtil,
  deleteItemRecursive,
  renameItemRecursive,
  insertItemRecursive,
  isSelfOrDescendant,
} from "../utils/treeUtils";
import { jsPDF } from "jspdf";
import { notoSansHebrewBase64 } from '../fonts/NotoSansHebrewBase64';


// Helper function to find an item by its ID
const findItemById = (nodes, id) => {
  if (!id || !Array.isArray(nodes)) return null;
  for (const item of nodes) {
    if (item.id === id) return item;
    if (Array.isArray(item.children)) {
      const found = findItemById(item.children, id);
      if (found) return found;
    }
  }
  return null;
};

// Helper: Recursively assign new IDs to an item and its children
const assignNewIds = (item) => {
    const newItem = { ...item };
    newItem.id = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9);
    if (Array.isArray(newItem.children)) {
        newItem.children = newItem.children.map(child => assignNewIds(child));
    }
    return newItem;
};


export const useTree = () => {
  const EXPANDED_KEY = `${LOCAL_STORAGE_KEY}_expanded`;
  const [tree, setTree] = useState(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      console.error("Failed to load tree from localStorage.");
      return [];
    }
  });
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
      console.error("Failed to load expanded folders from localStorage.");
      return {};
    }
  });
  const [draggedId, setDraggedId] = useState(null);
  const [clipboardItem, setClipboardItem] = useState(null);
  const [clipboardMode, setClipboardMode] = useState(null);
  const [cutItemId, setCutItemId] = useState(null);

  const selectedItem = useMemo(() => findItemById(tree, selectedItemId), [tree, selectedItemId]);

  useEffect(() => {
    try {
      localStorage.setItem(EXPANDED_KEY, JSON.stringify(expandedFolders));
    } catch (error) {
      console.error("Failed to save expanded folders to localStorage:", error);
    }
  }, [expandedFolders]);

  const setTreeAndPersist = useCallback((newTreeOrCallback) => {
    setTree((prevTree) => {
      const newTree =
        typeof newTreeOrCallback === "function"
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

   const selectItemById = useCallback((id) => {
     setSelectedItemId(id);
   }, []);

  const replaceTree = useCallback((newTreeData) => {
     if (Array.isArray(newTreeData)) {
        setTreeAndPersist(newTreeData);
        setSelectedItemId(null);
        setExpandedFolders({});
     } else {
        console.error("replaceTree failed: Provided data is not an array.", newTreeData);
        alert("Import failed: Invalid data format (expected an array).");
     }
  }, [setTreeAndPersist]);

  const expandFolderPath = useCallback(
    (folderId) => {
       if (!folderId) return;
      const findAncestors = (nodes, id, ancestors = []) => {
        for (const item of nodes) {
          if (item.id === id) return ancestors;
          if (item.children) {
            const found = findAncestors(item.children, id, [...ancestors, item.id]);
            if (found) return found;
          }
        }
        return null;
      };
      const ancestors = findAncestors(tree, folderId, []);
      setExpandedFolders((prev) => {
        const next = { ...prev };
        if (ancestors) {
          ancestors.forEach((pid) => (next[pid] = true));
        }
        next[folderId] = true;
        return next;
      });
    },
    [tree]
  );

  const toggleFolderExpand = useCallback((id, forced) => {
     if (!id) return;
    setExpandedFolders((prev) => ({ ...prev, [id]: forced !== undefined ? forced : !prev[id] }));
  }, []);

   const updateNoteContent = useCallback(
    (noteId, content) => {
      const recurse = (items) =>
        items.map((it) =>
          it.id === noteId
            ? { ...it, content }
            : Array.isArray(it.children)
            ? { ...it, children: recurse(it.children) }
            : it
        );
      setTreeAndPersist(recurse);
    },
    [setTreeAndPersist]
  );

  const updateTask = useCallback(
    (taskId, updates) => {
      const recurse = (items) =>
        items.map((it) =>
          it.id === taskId && it.type === 'task'
            ? { ...it, ...updates }
            : Array.isArray(it.children)
            ? { ...it, children: recurse(it.children) }
            : it
        );
      setTreeAndPersist(recurse);
    },
    [setTreeAndPersist]
  );

  const renameItem = useCallback(
    (itemId, newLabel) => {
      if (!newLabel || !itemId) return;
      setTreeAndPersist((currentTree) => renameItemRecursive(currentTree, itemId, newLabel));
    },
    [setTreeAndPersist]
  );

  const deleteItem = useCallback(
    (idToDelete) => {
      setTreeAndPersist((currentTree) => deleteItemRecursive(currentTree, idToDelete));
      if (selectedItemId === idToDelete) setSelectedItemId(null);
      setExpandedFolders((prev) => {
        const next = { ...prev };
        delete next[idToDelete];
        return next;
      });
      setContextMenu((m) => ({ ...m, visible: false }));
    },
    [selectedItemId, setTreeAndPersist]
  );

  const handleDrop = useCallback(
    (targetId) => {
      const currentDraggedId = draggedId;
      if (!currentDraggedId || targetId === currentDraggedId) {
        setDraggedId(null);
        return;
      }
      const nextTree = treeHandleDropUtil(tree, targetId, currentDraggedId);
      if (nextTree) {
        setTreeAndPersist(nextTree);
        toggleFolderExpand(targetId, true);
      } else {
        console.warn("Drop deemed invalid by treeUtils.");
      }
      setDraggedId(null);
    },
    [draggedId, tree, setTreeAndPersist, toggleFolderExpand]
  );

  const copyItem = useCallback(
    (itemId) => {
      const itemToCopy = findItemById(tree, itemId);
      if (itemToCopy) {
        try {
          const deepCopy = typeof structuredClone === "function"
              ? structuredClone(itemToCopy)
              : JSON.parse(JSON.stringify(itemToCopy));
          setClipboardItem(deepCopy);
          setClipboardMode("copy");
          setCutItemId(null);
          console.log("Copied item:", itemToCopy.label);
        } catch (e) {
          console.error("Failed to copy item:", e);
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
           const deepCopy = typeof structuredClone === "function"
              ? structuredClone(itemToCut)
              : JSON.parse(JSON.stringify(itemToCut));
           setClipboardItem(deepCopy);
           setClipboardMode("cut");
           setCutItemId(itemId);
           console.log("Cut item:", itemToCut.label);
        } catch (e) {
          console.error("Failed to cut item:", e);
          setClipboardItem(null);
          setClipboardMode(null);
          setCutItemId(null);
        }
      }
      setContextMenu((m) => ({ ...m, visible: false }));
    },
    [tree]
  );

   const addItem = useCallback(
    (newItem, parentId) => {
       if (!newItem || !newItem.id) {
           console.error("addItem failed: newItem is invalid or missing an ID.");
           return;
       }
      setTreeAndPersist((prevTree) => insertItemRecursive(prevTree, parentId, newItem));
      if (parentId) {
        setTimeout(() => expandFolderPath(parentId), 0);
      }
    },
    [setTreeAndPersist, expandFolderPath]
  );


  const duplicateItem = useCallback((itemId) => {
    const itemToDuplicate = findItemById(tree, itemId);
    if (!itemToDuplicate) return;

    let duplicate = assignNewIds(itemToDuplicate);
    duplicate.label = duplicate.label + "-dup";

    const findParentAndIndex = (nodes, id, parent = null) => {
      if (!Array.isArray(nodes)) return null;
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === id) return { parent, index: i };
        if (nodes[i].children) {
          const res = findParentAndIndex(nodes[i].children, id, nodes[i]);
          if (res) return res;
        }
      }
      return null;
    };

    const parentInfo = findParentAndIndex(tree, itemId);
    if (parentInfo && parentInfo.parent) {
      const parentId = parentInfo.parent.id;
      setTreeAndPersist((prevTree) => {
        const updateTree = (nodes) =>
          nodes.map((node) => {
            if (node.id === parentId) {
              const newChildren = Array.isArray(node.children) ? [...node.children] : [];
              newChildren.splice(parentInfo.index + 1, 0, duplicate);
              return { ...node, children: sortItems(newChildren) };
            } else if (node.children) {
              return { ...node, children: updateTree(node.children) };
            }
            return node;
          });
        return updateTree(prevTree);
      });
    } else {
      setTreeAndPersist((prevTree) => sortItems([...prevTree, duplicate]));
    }
    setContextMenu((m) => ({ ...m, visible: false }));
  }, [tree, setTreeAndPersist]);

  const pasteItem = useCallback(
    (targetFolderId) => {
      if (!clipboardItem) {
        console.warn("Clipboard is empty.");
        setContextMenu((m) => ({ ...m, visible: false }));
        return;
      }

      const originalClipboardItemId = clipboardItem.id;

      if (clipboardItem.type === "folder" &&
          isSelfOrDescendant(tree, originalClipboardItemId, targetFolderId)) {
        console.warn(`Paste prevented: Cannot paste folder '${clipboardItem.label}' into itself or a descendant.`);
        alert(`Cannot paste folder '${clipboardItem.label}' into itself or one of its subfolders.`);
        setContextMenu((m) => ({ ...m, visible: false }));
        return;
      }

      const itemToPasteWithNewIds = assignNewIds(clipboardItem);
      const originalIdToDeleteIfCut = cutItemId;

      setTreeAndPersist((currentTree) => {
        let newTree = insertItemRecursive(currentTree, targetFolderId, itemToPasteWithNewIds);
        const pastedItemExists = findItemById(newTree, itemToPasteWithNewIds.id);

        if (pastedItemExists && clipboardMode === "cut" && originalIdToDeleteIfCut) {
           console.log("Cut/Paste: Deleting original", originalIdToDeleteIfCut);
           newTree = deleteItemRecursive(newTree, originalIdToDeleteIfCut);
        } else if (!pastedItemExists) {
             console.warn("Paste target folder not found or invalid during state update:", targetFolderId);
             newTree = currentTree;
        }
        return newTree;
      });

      if (clipboardMode === "cut" && findItemById(tree, itemToPasteWithNewIds.id)) {
            setCutItemId(null);
       }

      if (targetFolderId) {
        setTimeout(() => {
          expandFolderPath(targetFolderId);
        }, 0);
      }

      setContextMenu((m) => ({ ...m, visible: false }));
    },
    [clipboardItem, clipboardMode, cutItemId, tree, setTreeAndPersist, expandFolderPath, deleteItem]
  );

  // --- Export and Import Functions ---
  const handleExport = useCallback(
    (target, format) => {
      let dataToExport;
      let fileName;
      if (target === "selected") {
        if (!selectedItem) {
          alert("No item is selected to export.");
          return;
        }
        dataToExport = selectedItem;
        fileName = `${selectedItem.label}-export`;
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
             alert("Failed to export as JSON.");
        }
      } else if (format === "pdf") {
        try {
            const doc = new jsPDF();

            // --- Font Handling ---
            const FONT_NAME = 'NotoSansHebrew';
            const FONT_FILENAME = 'NotoSansHebrew-Regular.ttf'; // Must match VFS filename
            const FONT_STYLE = 'normal';

            // Check if font data is available
            if (notoSansHebrewBase64) {
                 try {
                    // Register the font file in VFS only if not already registered
                    if (!doc.getFileFromVFS(FONT_FILENAME)) {
                        doc.addFileToVFS(FONT_FILENAME, notoSansHebrewBase64);
                    }
                    // Add the font to the document only if not already added
                    // Note: jsPDF font list access is internal, so we might re-add, but it's usually ok.
                    doc.addFont(FONT_FILENAME, FONT_NAME, FONT_STYLE);
                    doc.setFont(FONT_NAME, FONT_STYLE); // Set the font
                 } catch (fontError) {
                      console.error("Error loading/adding Hebrew font:", fontError);
                      alert("Failed to load Hebrew font for PDF export. Hebrew text may not display correctly.");
                      // Fallback to default font will happen if setFont fails or isn't called
                 }
            } else {
                console.warn("Hebrew font data not available for PDF export.");
                alert("Hebrew font not configured. Hebrew text may not display correctly.");
            }
            // --- End Font Handling ---


            const buildText = (item, indent = 0) => {
              const spaces = " ".repeat(indent);
              let text = `${spaces}${item.type === 'folder' ? '📁' : item.type === 'note' ? '📝' : item.completed ? '✅' : '⬜️'} ${item.label}`;
              if (item.content && (item.type === 'note' || item.type === 'task')) {
                 const tempDiv = document.createElement('div');
                 tempDiv.innerHTML = item.content;
                 const contentText = tempDiv.textContent || tempDiv.innerText || "";
                 // Replace multiple spaces/newlines possibly introduced by HTML stripping
                 const cleanedContent = contentText.replace(/\s+/g, ' ').trim();
                 text += `\n${spaces}  Content: ${cleanedContent.substring(0, 200)}${cleanedContent.length > 200 ? '...' : ''}`;
              }
              text += "\n";
              if (item.children && item.children.length > 0) {
                sortItems(item.children).forEach((child) => {
                  text += buildText(child, indent + 2);
                });
              }
              return text;
            };

            let fullText = "";
            if (target === "selected") {
              fullText = buildText(selectedItem);
            } else {
              sortItems(Array.isArray(dataToExport) ? dataToExport : []).forEach((item) => {
                fullText += buildText(item) + "\n";
              });
            }

            // Set font size AFTER setting the font
            doc.setFontSize(10);

            const pageHeight = doc.internal.pageSize.getHeight();
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 10;
            const maxLineWidth = pageWidth - margin * 2;
            const lines = doc.splitTextToSize(fullText, maxLineWidth);

            let cursorY = margin;
             // jsPDF's text function needs manual line breaking and page adding
             lines.forEach(line => {
                if (cursorY + 5 > pageHeight - margin) { // Estimate line height (adjust 5 if needed)
                    doc.addPage();
                    cursorY = margin;
                    // Re-apply font on new page (important!)
                    doc.setFont(FONT_NAME, FONT_STYLE);
                    doc.setFontSize(10);
                }
                // Render text line by line
                // Consider RTL options if needed: doc.text(line, pageWidth - margin, cursorY, { align: 'right' });
                doc.text(line, margin, cursorY);
                cursorY += 5; // Increment cursor Y position (adjust line height if needed)
             });

            doc.save(fileName + ".pdf");
         } catch(error) {
             console.error("PDF export failed:", error);
             alert("Failed to generate PDF.");
         }
      }
    },
    [selectedItem, tree] // Ensure dependencies are correct
  );

  const handleImport = useCallback(
    (file, targetOption) => { // targetOption might be 'item' or 'tree', passed from App.jsx
      if (!file || !file.type || file.type !== 'application/json') {
           alert("Import failed: Please select a valid JSON file (.json).");
           return;
       }
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target.result);

          const isValidStructure = (data) => {
              if (Array.isArray(data)) {
                  return data.every(item => item && item.id && item.label && item.type);
              } else if (typeof data === 'object' && data !== null) {
                  return data.id && data.label && data.type;
              }
              return false;
          };

          if (!isValidStructure(importedData)) {
               throw new Error("Invalid JSON structure for import.");
           }

          // Use targetOption passed from App.jsx via ImportDialog state
          if (targetOption === "tree") {
             if (Array.isArray(importedData)) {
                 replaceTree(importedData);
             } else {
                 replaceTree([importedData]);
             }
          } else { // targetOption should be 'item' or null (defaulting to selected)
            if (!selectedItem) {
              alert("No item is selected to import under.");
              return;
            }
            if (selectedItem.type !== "folder") {
              alert("The selected item is not a folder. Cannot import under non-folder items.");
              return;
            }

             const itemsToImport = Array.isArray(importedData)
                 ? importedData.map(item => assignNewIds(item))
                 : [assignNewIds(importedData)];

             itemsToImport.forEach(item => {
                 addItem(item, selectedItem.id);
             });
          }
        } catch (error) {
          console.error("Import failed:", error);
          alert(`Failed to import file. Please check the file format and structure. Error: ${error.message}`);
        }
      };
       reader.onerror = (e) => {
           console.error("File reading error:", e);
           alert("Failed to read the selected file.");
       };
      reader.readAsText(file);
    },
    [selectedItem, addItem, replaceTree] // Dependencies
  );


  // Return all state and functions needed by the UI
  return {
    tree,
    selectedItem,
    selectedItemId,
    selectItemById,
    contextMenu,
    setContextMenu,
    expandedFolders,
    toggleFolderExpand,
    expandFolderPath,
    updateNoteContent,
    updateTask,
    renameItem,
    deleteItem,
    draggedId,
    setDraggedId,
    handleDrop,
    clipboardItem,
    clipboardMode,
    copyItem,
    cutItem,
    pasteItem,
    addItem,
    duplicateItem,
    handleExport,
    handleImport,
  };
}; // End of useTree hook