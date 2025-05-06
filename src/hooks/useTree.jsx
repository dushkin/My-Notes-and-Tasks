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
    console.error("Error decoding HTML entities during PDF export:", e);
  }
  text = text.trim().replace(/(\r\n|\r|\n){2,}/g, "\n");
  return text;
}

const assignNewIds = (item) => {
  const newItem = { ...item };
  newItem.id =
    Date.now().toString() + "-" + Math.random().toString(36).substring(2, 9);
  if (Array.isArray(newItem.children)) {
    newItem.children = newItem.children.map((child) => assignNewIds(child));
  }
  return newItem;
};

export const useTree = () => {
  const EXPANDED_KEY = `${LOCAL_STORAGE_KEY}_expanded`;
  const { settings } = useSettings();

  const [tree, setTree] = useState(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Failed to load or parse tree from localStorage:", error);
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
    } catch (error) {
      console.error(
        "Failed to load or parse expanded folders from localStorage:",
        error
      );
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

  const setTreeAndPersist = useCallback(
    (newTreeOrCallback) => {
      setTree((prevTree) => {
        const newTree =
          typeof newTreeOrCallback === "function"
            ? newTreeOrCallback(prevTree)
            : newTreeOrCallback;
        try {
          if (!Array.isArray(newTree)) {
            console.error(
              "Attempted to save non-array data to localStorage:",
              newTree
            );
            return prevTree;
          }
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newTree));
        } catch (error) {
          console.error("Failed to save tree to localStorage:", error);
        }
        return newTree;
      });
    },
    [LOCAL_STORAGE_KEY]
  );

  useEffect(() => {
    try {
      localStorage.setItem(EXPANDED_KEY, JSON.stringify(expandedFolders));
    } catch (error) {
      console.error("Failed to save expanded folders to localStorage:", error);
    }
  }, [expandedFolders, EXPANDED_KEY]);

  const selectItemById = useCallback((id) => setSelectedItemId(id), []);

  const replaceTree = useCallback(
    (newTreeData) => {
      if (Array.isArray(newTreeData)) {
        setTreeAndPersist(newTreeData);
        setSelectedItemId(null);
        setExpandedFolders({});
        return { success: true };
      } else {
        console.error(
          "replaceTree failed: Provided data is not an array.",
          newTreeData
        );
        return {
          success: false,
          error: "Import failed: Invalid data format (expected an array).",
        };
      }
    },
    [setTreeAndPersist]
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
        if (targetItem) {
          next[folderId] = true;
        } else {
          console.warn(
            `expandFolderPath: Could not find item with id ${folderId} to ensure expansion.`
          );
        }
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

  const updateNoteContent = useCallback(
    (itemId, content) => {
      const recurse = (items) =>
        items.map((it) =>
          it.id === itemId
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
          it.id === taskId && it.type === "task"
            ? { ...it, ...updates }
            : Array.isArray(it.children)
            ? { ...it, children: recurse(it.children) }
            : it
        );
      setTreeAndPersist(recurse);
    },
    [setTreeAndPersist]
  );

  const addItem = useCallback(
    (newItem, parentId) => {
      const trimmedLabel = newItem?.label?.trim();
      if (!newItem || !newItem.id || !trimmedLabel) {
        return { success: false, error: "Invalid item data provided." };
      }
      let siblings = [];
      let parentItem = null;
      if (parentId === null) {
        siblings = tree || [];
      } else {
        parentItem = findItemById(tree, parentId);
        if (!parentItem || parentItem.type !== "folder") {
          return {
            success: false,
            error: "Target parent folder not found or invalid.",
          };
        }
        siblings = parentItem.children || [];
      }
      if (hasSiblingWithName(siblings, trimmedLabel, null)) {
        return {
          success: false,
          error: `An item named "${trimmedLabel}" already exists at this level.`,
        };
      }
      setTreeAndPersist((prevTree) =>
        insertItemRecursive(prevTree, parentId, newItem)
      );
      if (parentId && settings.autoExpandNewFolders) {
        setTimeout(() => expandFolderPath(parentId), 0);
      }
      return { success: true };
    },
    [setTreeAndPersist, expandFolderPath, tree, settings.autoExpandNewFolders]
  );

  const renameItem = useCallback(
    (itemId, newLabel) => {
      const trimmedLabel = newLabel?.trim();
      if (!trimmedLabel || !itemId) {
        return {
          success: false,
          error: "Cannot rename: Invalid ID or empty name provided.",
        };
      }
      const { siblings } = findParentAndSiblings(tree, itemId);
      if (hasSiblingWithName(siblings, trimmedLabel, itemId)) {
        return {
          success: false,
          error: `An item named "${trimmedLabel}" already exists at this level.`,
        };
      }
      setTreeAndPersist((currentTree) =>
        renameItemRecursive(currentTree, itemId, trimmedLabel)
      );
      return { success: true };
    },
    [setTreeAndPersist, tree]
  );

  const deleteItem = useCallback(
    (idToDelete) => {
      if (!idToDelete) return;
      setTreeAndPersist((currentTree) =>
        deleteItemRecursive(currentTree, idToDelete)
      );
      if (selectedItemId === idToDelete) {
        setSelectedItemId(null);
      }
      setExpandedFolders((prev) => {
        if (prev.hasOwnProperty(idToDelete)) {
          const next = { ...prev };
          delete next[idToDelete];
          return next;
        }
        return prev;
      });
      setContextMenu((m) => (m.visible ? { ...m, visible: false } : m));
    },
    [selectedItemId, setTreeAndPersist, setExpandedFolders]
  );

  const duplicateItem = useCallback(
    (itemId) => {
      const itemToDuplicate = findItemById(tree, itemId);
      if (!itemToDuplicate) {
        console.error(
          "duplicateItem Hook failed: Item to duplicate not found",
          itemId
        );
        return;
      }
      const { parent, siblings } = findParentAndSiblings(tree, itemId);
      const parentId = parent?.id ?? null;
      let baseName = itemToDuplicate.label;
      let duplicateLabel = `${baseName}-dup`;
      let counter = 1;
      while (hasSiblingWithName(siblings, duplicateLabel, null)) {
        counter++;
        duplicateLabel = `${baseName}-dup (${counter})`;
      }
      let duplicate = assignNewIds(itemToDuplicate);
      duplicate.label = duplicateLabel;
      setTreeAndPersist((prevTree) =>
        insertItemRecursive(prevTree, parentId, duplicate)
      );
      if (parentId && settings.autoExpandNewFolders) {
        setTimeout(() => expandFolderPath(parentId), 0);
      }
      setContextMenu((m) => ({ ...m, visible: false }));
    },
    [tree, setTreeAndPersist, expandFolderPath, settings.autoExpandNewFolders]
  );

  const handleDrop = useCallback(
    (targetId) => {
      const currentDraggedId = draggedId;
      setDraggedId(null);
      if (!currentDraggedId || targetId === currentDraggedId) return;
      const nextTree = treeHandleDropUtil(tree, targetId, currentDraggedId);
      if (nextTree) {
        setTreeAndPersist(nextTree);
        toggleFolderExpand(targetId, true);
      } else {
        console.warn("handleDrop Hook: Drop deemed invalid by treeUtils.");
      }
    },
    [draggedId, tree, setTreeAndPersist, toggleFolderExpand]
  );

  const copyItem = useCallback(
    (itemId) => {
      const itemToCopy = findItemById(tree, itemId);
      if (itemToCopy) {
        try {
          const deepCopy =
            typeof structuredClone === "function"
              ? structuredClone(itemToCopy)
              : JSON.parse(JSON.stringify(itemToCopy));
          setClipboardItem(deepCopy);
          setClipboardMode("copy");
          setCutItemId(null);
        } catch (e) {
          console.error("Failed to copy item:", e);
          setClipboardItem(null);
          setClipboardMode(null);
          setCutItemId(null);
        }
      } else {
        console.warn("copyItem: Item not found", itemId);
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
          const deepCopy =
            typeof structuredClone === "function"
              ? structuredClone(itemToCut)
              : JSON.parse(JSON.stringify(itemToCut));
          setClipboardItem(deepCopy);
          setClipboardMode("cut");
          setCutItemId(itemId);
        } catch (e) {
          console.error("Failed to cut item:", e);
          setClipboardItem(null);
          setClipboardMode(null);
          setCutItemId(null);
        }
      } else {
        console.warn("cutItem: Item not found", itemId);
      }
      setContextMenu((m) => ({ ...m, visible: false }));
    },
    [tree]
  );

  const pasteItem = useCallback(
    (targetFolderId) => {
      if (!clipboardItem) {
        return { success: false, error: "Clipboard is empty." };
      }
      const originalClipboardItemId = clipboardItem.id;
      const currentCutItemIdValue = cutItemId;
      const currentClipboardMode = clipboardMode;
      if (
        clipboardItem.type === "folder" &&
        isSelfOrDescendant(tree, originalClipboardItemId, targetFolderId)
      ) {
        return {
          success: false,
          error: `Cannot paste folder "${clipboardItem.label}" into itself or one of its subfolders.`,
        };
      }
      let targetSiblings = [];
      let targetParent = null;
      if (targetFolderId === null) {
        targetSiblings = tree || [];
      } else {
        targetParent = findItemById(tree, targetFolderId);
        if (!targetParent || targetParent.type !== "folder") {
          return {
            success: false,
            error: "Target folder not found or invalid.",
          };
        }
        targetSiblings = targetParent.children || [];
      }
      const { parent: sourceParent } = findParentAndSiblings(
        tree,
        currentCutItemIdValue
      );
      const isMovingInSameFolder =
        currentClipboardMode === "cut" && sourceParent?.id === targetFolderId;
      let conflictExists = false;
      if (!isMovingInSameFolder) {
        conflictExists = hasSiblingWithName(
          targetSiblings,
          clipboardItem.label,
          null
        );
      }
      if (conflictExists) {
        return {
          success: false,
          error: `An item named "${clipboardItem.label}" already exists in the target location.`,
        };
      }
      const itemToPasteWithNewIds = assignNewIds(clipboardItem);
      setTreeAndPersist((currentTree) => {
        let newTree = insertItemRecursive(
          currentTree,
          targetFolderId,
          itemToPasteWithNewIds
        );
        if (currentClipboardMode === "cut" && currentCutItemIdValue) {
          const pastedItemExists = findItemById(
            newTree,
            itemToPasteWithNewIds.id
          );
          if (pastedItemExists) {
            newTree = deleteItemRecursive(newTree, currentCutItemIdValue);
          } else {
            console.error("Paste ERROR during CUT: Reverting tree.");
            return currentTree;
          }
        }
        return newTree;
      });
      if (currentClipboardMode === "cut") {
        setCutItemId(null);
      }
      if (targetFolderId && settings.autoExpandNewFolders) {
        setTimeout(() => expandFolderPath(targetFolderId), 0);
      }
      setContextMenu((m) => ({ ...m, visible: false }));
      return { success: true };
    },
    [
      clipboardItem,
      clipboardMode,
      cutItemId,
      tree,
      setTreeAndPersist,
      expandFolderPath,
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
          alert("No item is selected to export.");
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
          alert("Failed to export as JSON.");
        }
      } else if (format === "pdf") {
        try {
          const doc = new jsPDF();
          const FONT_NAME = "NotoSansHebrew";
          const FONT_FILENAME = "NotoSansHebrew-Regular.ttf";
          const FONT_STYLE_NORMAL = "normal";
          const FONT_STYLE_BOLD = "bold";
          if (notoSansHebrewBase64) {
            try {
              if (!doc.getFileFromVFS(FONT_FILENAME)) {
                doc.addFileToVFS(FONT_FILENAME, notoSansHebrewBase64);
              }
              doc.addFont(FONT_FILENAME, FONT_NAME, FONT_STYLE_NORMAL);
              doc.addFont(FONT_FILENAME, FONT_NAME, FONT_STYLE_BOLD);
              doc.setFont(FONT_NAME, FONT_STYLE_NORMAL);
            } catch (fontError) {
              console.error("Error loading/adding Hebrew font:", fontError);
              alert(
                "Failed to load Hebrew font for PDF export. Hebrew text may not display correctly."
              );
            }
          } else {
            console.warn(
              "Hebrew font data could not be imported for PDF export."
            );
            alert(
              "Hebrew font not configured. Hebrew text may not display correctly."
            );
          }
          const PAGE_MARGIN = 15;
          const FONT_SIZE_LABEL = 12;
          const FONT_SIZE_CONTENT = 10;
          const lineHeightFactor = doc.getLineHeightFactor
            ? doc.getLineHeightFactor()
            : 1.15;
          const LINE_SPACING_LABEL = FONT_SIZE_LABEL * lineHeightFactor;
          const LINE_SPACING_CONTENT = FONT_SIZE_CONTENT * lineHeightFactor;
          const CONTENT_INDENT = 5;
          let cursorY = PAGE_MARGIN;
          const pageHeight = doc.internal.pageSize.getHeight();
          const pageWidth = doc.internal.pageSize.getWidth();
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
            const needsBiDi = /[\u0590-\u05FF]/.test(text);
            if (needsBiDi) {
              try {
                const levels = embeddingLevels(text);
                processedTextForRendering = reorder(text, levels);
              } catch (bidiError) {
                console.error(
                  "BiDi processing failed for text:",
                  text,
                  bidiError
                );
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
              const textX = isRTL ? pageWidth - x : x;
              const textOptions = { align: isRTL ? "right" : "left" };
              if (isRTL) textOptions.lang = "he";
              doc.text(line, textX, cursorY, textOptions);
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
            const labelText = `${labelIcon} ${item.label || "Untitled"}`;
            addText(labelText, currentIndent, cursorY, {
              fontSize: FONT_SIZE_LABEL,
              fontStyle: FONT_STYLE_BOLD,
              isLabel: true,
            });
            if (
              item.content &&
              (item.type === "note" || item.type === "task")
            ) {
              const plainTextContent = htmlToPlainTextWithNewlines(
                item.content
              );
              if (plainTextContent) {
                addText(
                  plainTextContent,
                  currentIndent + CONTENT_INDENT,
                  cursorY,
                  { fontSize: FONT_SIZE_CONTENT, fontStyle: FONT_STYLE_NORMAL }
                );
              }
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
          if (target === "selected" && dataToExport) {
            buildPdfContent(dataToExport, 0);
          } else if (Array.isArray(dataToExport)) {
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
      return new Promise((resolve) => {
        if (!file || file.type !== "application/json") {
          resolve({
            success: false,
            error: "Import failed: Please select a valid JSON file (.json).",
          });
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          let importedData;
          try {
            importedData = JSON.parse(e.target.result);
          } catch (error) {
            resolve({
              success: false,
              error: `Failed to parse JSON file: ${error.message}`,
            });
            return;
          }
          try {
            const isValidItem = (item) =>
              typeof item === "object" &&
              item !== null &&
              "id" in item &&
              "label" in item &&
              "type" in item;
            const isValidStructure = (data) =>
              Array.isArray(data) ? data.every(isValidItem) : isValidItem(data);
            if (!isValidStructure(importedData)) {
              throw new Error(
                "Invalid JSON structure (items must have id, label, type)."
              );
            }
            const itemsToImport = Array.isArray(importedData)
              ? importedData
              : [importedData];
            if (importTargetOption === "tree") {
              resolve(
                replaceTree(itemsToImport.map((item) => assignNewIds(item)))
              );
            } else {
              const currentSelectedItem = findItemById(tree, selectedItemId);
              if (!currentSelectedItem) {
                resolve({
                  success: false,
                  error: "Import failed: No item selected as target.",
                });
                return;
              }
              if (currentSelectedItem.type !== "folder") {
                resolve({
                  success: false,
                  error: "Import failed: Selected item must be a folder.",
                });
                return;
              }
              const targetSiblings = currentSelectedItem.children || [];
              for (const item of itemsToImport) {
                if (hasSiblingWithName(targetSiblings, item.label, null)) {
                  resolve({
                    success: false,
                    error: `Import failed: An item named "${item.label}" already exists in the target folder "${currentSelectedItem.label}".`,
                  });
                  return;
                }
              }
              const itemsWithNewIds = itemsToImport.map((item) =>
                assignNewIds(item)
              );
              setTreeAndPersist((prevTree) => {
                let currentSubTree = prevTree;
                itemsWithNewIds.forEach((item) => {
                  currentSubTree = insertItemRecursive(
                    currentSubTree,
                    selectedItemId,
                    item
                  );
                });
                return currentSubTree;
              });
              if (selectedItemId && settings.autoExpandNewFolders) {
                setTimeout(() => expandFolderPath(selectedItemId), 0);
              }
              resolve({ success: true });
            }
          } catch (error) {
            resolve({
              success: false,
              error: `Failed to process import data: ${error.message}`,
            });
          }
        };
        reader.onerror = (error) => {
          resolve({
            success: false,
            error: "Failed to read the selected file.",
          });
        };
        reader.readAsText(file);
      });
    },
    [
      tree,
      selectedItemId,
      setTreeAndPersist,
      replaceTree,
      expandFolderPath,
      settings.autoExpandNewFolders,
    ]
  );

  const searchItems = useCallback(
    (
      query,
      opts = { caseSensitive: false, wholeWord: false, useRegex: false }
    ) => {
      if (!query) return [];
      const results = [];
      const walk = (nodes) => {
        if (!Array.isArray(nodes)) return;
        nodes.forEach((it) => {
          // Use the revised itemMatches which checks label for folders, and label/content for notes/tasks
          if (itemMatches(it, query, opts)) {
            results.push(it);
          }
          // Recursively search children if it's a folder
          if (it.type === "folder" && Array.isArray(it.children)) {
            walk(it.children);
          }
        });
      };
      walk(tree); // Start walking from the root of the tree
      return results;
    },
    [tree]
  ); // itemMatches is pure, tree is the main dependency

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
  };
};
