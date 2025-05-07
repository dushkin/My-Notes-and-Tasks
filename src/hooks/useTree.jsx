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
import { itemMatches, matchText as utilMatchText } from "../utils/searchUtils";
import { useUndoRedo } from "./useUndoRedo";

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

const assignNewIds = (item) => {
  const newItem = {
    ...item,
    id:
      Date.now().toString() + "-" + Math.random().toString(36).substring(2, 9),
  };
  if (Array.isArray(newItem.children)) {
    newItem.children = newItem.children.map((child) => assignNewIds(child));
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
  }, [expandedFolders, EXPANDED_KEY]);

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
        if (targetItem) {
          next[folderId] = true;
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
      const mapRecursive = (items, id, updates) => {
        return items.map((i) =>
          i.id === id
            ? { ...i, ...updates }
            : Array.isArray(i.children)
            ? { ...i, children: mapRecursive(i.children, id, updates) }
            : i
        );
      };
      const newTreeState = mapRecursive(tree, itemId, { content });
      setTreeWithUndo(newTreeState);
    },
    [tree, setTreeWithUndo]
  );

  const updateTask = useCallback(
    (taskId, updates) => {
      const mapRecursiveTask = (items, id, taskUpdates) => {
        return items.map((i) =>
          i.id === id && i.type === "task"
            ? { ...i, ...taskUpdates }
            : Array.isArray(i.children)
            ? { ...i, children: mapRecursiveTask(i.children, id, taskUpdates) }
            : i
        );
      };
      const newTreeState = mapRecursiveTask(tree, taskId, updates);
      setTreeWithUndo(newTreeState);
    },
    [tree, setTreeWithUndo]
  );

  const addItem = useCallback(
    (newItem, parentId) => {
      const trimmedLabel = newItem?.label?.trim();
      if (!newItem || !newItem.id || !trimmedLabel)
        return { success: false, error: "Invalid item data." };
      let siblings = [];
      const currentTreeSnapshot = tree;
      if (parentId === null) {
        siblings = currentTreeSnapshot || [];
      } else {
        const parentItem = findItemById(currentTreeSnapshot, parentId);
        if (!parentItem || parentItem.type !== "folder")
          return { success: false, error: "Target parent not found." };
        siblings = parentItem.children || [];
      }
      if (hasSiblingWithName(siblings, trimmedLabel, null))
        return {
          success: false,
          error: `Item "${trimmedLabel}" already exists.`,
        };

      const newTreeState = insertItemRecursive(tree, parentId, newItem);
      setTreeWithUndo(newTreeState);

      if (parentId && settings.autoExpandNewFolders) {
        setTimeout(() => expandFolderPath(parentId), 0);
      }
      return { success: true };
    },
    [tree, setTreeWithUndo, expandFolderPath, settings.autoExpandNewFolders]
  );

  const renameItem = useCallback(
    (itemId, newLabel) => {
      const trimmedLabel = newLabel?.trim();
      if (!trimmedLabel || !itemId)
        return { success: false, error: "Invalid ID or name." };
      const currentTreeSnapshot = tree;
      const { siblings } = findParentAndSiblings(currentTreeSnapshot, itemId);
      if (hasSiblingWithName(siblings, trimmedLabel, itemId))
        return {
          success: false,
          error: `Item "${trimmedLabel}" already exists.`,
        };

      const newTreeState = renameItemRecursive(tree, itemId, trimmedLabel);
      setTreeWithUndo(newTreeState);
      return { success: true };
    },
    [tree, setTreeWithUndo]
  );

  const deleteItem = useCallback(
    (idToDelete) => {
      if (!idToDelete) return;
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
    },
    [tree, selectedItemId, setTreeWithUndo]
  );

  const duplicateItem = useCallback(
    (itemId) => {
      const currentTreeSnapshot = tree;
      const itemToDuplicate = findItemById(currentTreeSnapshot, itemId);
      if (!itemToDuplicate) {
        console.error("duplicateItem Hook failed", itemId);
        return;
      }
      const { parent, siblings } = findParentAndSiblings(
        currentTreeSnapshot,
        itemId
      );
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

      const newTreeState = insertItemRecursive(tree, parentId, duplicate);
      setTreeWithUndo(newTreeState);

      if (parentId && settings.autoExpandNewFolders) {
        setTimeout(() => expandFolderPath(parentId), 0);
      }
      setContextMenu((m) => ({ ...m, visible: false }));
    },
    [tree, setTreeWithUndo, expandFolderPath, settings.autoExpandNewFolders]
  );

  const handleDrop = useCallback(
    (targetId) => {
      const currentDraggedId = draggedId;
      setDraggedId(null);
      if (!currentDraggedId || targetId === currentDraggedId) return;
      const currentTreeSnapshot = tree;
      const nextTreeResult = treeHandleDropUtil(
        currentTreeSnapshot,
        targetId,
        currentDraggedId
      ); // This utility should return the new tree array or null
      if (nextTreeResult) {
        setTreeWithUndo(nextTreeResult);
        toggleFolderExpand(targetId, true);
      } else {
        console.warn("Drop invalid by treeUtils.");
      }
    },
    [draggedId, tree, setTreeWithUndo, toggleFolderExpand]
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
    (targetFolderId) => {
      if (!clipboardItem) return { success: false, error: "Clipboard empty." };
      const currentTreeSnapshot = tree;
      if (
        clipboardItem.type === "folder" &&
        isSelfOrDescendant(
          currentTreeSnapshot,
          clipboardItem.id,
          targetFolderId
        )
      ) {
        return { success: false, error: `Cannot paste folder into itself.` };
      }
      let targetSiblings = [];
      if (targetFolderId === null) {
        targetSiblings = currentTreeSnapshot || [];
      } else {
        const targetParent = findItemById(currentTreeSnapshot, targetFolderId);
        if (!targetParent || targetParent.type !== "folder")
          return { success: false, error: "Target not found." };
        targetSiblings = targetParent.children || [];
      }
      const { parent: sourceParent } = findParentAndSiblings(
        currentTreeSnapshot,
        cutItemId
      );
      const isMovingInSameFolder =
        clipboardMode === "cut" && sourceParent?.id === targetFolderId;
      if (
        !isMovingInSameFolder &&
        hasSiblingWithName(targetSiblings, clipboardItem.label, null)
      ) {
        return {
          success: false,
          error: `Item "${clipboardItem.label}" already exists.`,
        };
      }
      const itemToPasteWithNewIds = assignNewIds(clipboardItem);

      let finalTreeState = insertItemRecursive(
        tree,
        targetFolderId,
        itemToPasteWithNewIds
      ); // tree is history.present
      if (clipboardMode === "cut" && cutItemId) {
        const pastedItemStillExists = findItemById(
          finalTreeState,
          itemToPasteWithNewIds.id
        );
        if (pastedItemStillExists) {
          finalTreeState = deleteItemRecursive(finalTreeState, cutItemId);
        } else {
          console.error(
            "Paste ERROR during CUT: Pasted item disappeared! No tree operation performed."
          );
          return { success: false, error: "Paste error during cut operation." };
        }
      }
      setTreeWithUndo(finalTreeState);

      if (clipboardMode === "cut") setCutItemId(null);
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
      setTreeWithUndo,
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
          alert("Failed to export JSON.");
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
              alert("Font error.");
            }
          } else {
            alert("Hebrew font not configured.");
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
              } catch (bidiError) {}
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
          resolve({ success: false, error: "Please select JSON." });
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          let importedData;
          try {
            importedData = JSON.parse(e.target.result);
          } catch (error) {
            resolve({ success: false, error: `Parse error: ${error.message}` });
            return;
          }
          try {
            const isValidItem = (item) =>
              typeof item === "object" &&
              item &&
              "id" in item &&
              "label" in item &&
              "type" in item;
            const isValid = (d) =>
              Array.isArray(d) ? d.every(isValidItem) : isValidItem(d);
            if (!isValid(importedData)) {
              throw new Error("Invalid structure.");
            }
            const itemsToImport = Array.isArray(importedData)
              ? importedData
              : [importedData];
            if (importTargetOption === "tree") {
              const newTreeState = itemsToImport.map((i) => assignNewIds(i));
              resolve(replaceTree(newTreeState));
            } else {
              const currentSel = findItemById(tree, selectedItemId);
              if (!currentSel) {
                resolve({ success: false, error: "No target selected." });
                return;
              }
              if (currentSel.type !== "folder") {
                resolve({ success: false, error: "Target must be folder." });
                return;
              }
              const siblings = currentSel.children || [];
              for (const i of itemsToImport) {
                if (hasSiblingWithName(siblings, i.label, null)) {
                  resolve({ success: false, error: `"${i.label}" exists.` });
                  return;
                }
              }
              const newItems = itemsToImport.map((i) => assignNewIds(i));

              let finalTreeStateAfterInserts = tree;
              newItems.forEach((ni) => {
                finalTreeStateAfterInserts = insertItemRecursive(
                  finalTreeStateAfterInserts,
                  selectedItemId,
                  ni
                );
              });
              setTreeWithUndo(finalTreeStateAfterInserts);

              if (selectedItemId && settings.autoExpandNewFolders) {
                setTimeout(() => expandFolderPath(selectedItemId), 0);
              }
              resolve({ success: true });
            }
          } catch (error) {
            resolve({
              success: false,
              error: `Processing error: ${error.message}`,
            });
          }
        };
        reader.onerror = () => {
          resolve({ success: false, error: "File read error." });
        };
        reader.readAsText(file);
      });
    },
    [
      tree,
      selectedItemId,
      setTreeWithUndo,
      replaceTree,
      expandFolderPath,
      settings.autoExpandNewFolders,
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
          if (itemMatches(it, query, opts)) {
            results.push(it);
          }
          if (it.type === "folder" && Array.isArray(it.children)) {
            walk(it.children);
          }
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
  };
};
