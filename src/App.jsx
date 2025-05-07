// src/App.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import Tree from "./components/Tree";
import FolderContents from "./components/FolderContents";
import ContentEditor from "./components/ContentEditor";
import ContextMenu from "./components/ContextMenu";
import AddDialog from "./components/AddDialog";
import AboutDialog from "./components/AboutDialog";
import ExportDialog from "./components/ExportDialog";
import ImportDialog from "./components/ImportDialog";
import SettingsDialog from "./components/SettingsDialog";
import { useTree } from "./hooks/useTree.jsx";
import { useSettings } from "./contexts/SettingsContext";
import { findItemById, findParentAndSiblings } from "./utils/treeUtils";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import {
  Search as SearchIcon,
  Info,
  EllipsisVertical,
  XCircle,
  Settings as SettingsIcon,
  Undo,
  Redo,
  // ChevronDown, // No longer needed for placeholder handle
} from "lucide-react";
import SearchResultsPane from "./components/SearchResultsPane";
// Import matchText AND escapeRegex from searchUtils
import { matchText, escapeRegex } from "./utils/searchUtils";
import { Sheet } from 'react-modal-sheet'; // Use curly braces for named import

// Helper function to convert HTML to plain text, preserving basic newlines
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
    // console.error("Error decoding HTML entities:", e);
  }
  return text.replace(/(\r?\n|\r){2,}/g, "\n").trim();
}

// Component to display temporary error messages
const ErrorDisplay = ({ message, onClose }) => {
  if (!message) return null;
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  return (
    <div className="absolute top-2 right-2 left-2 md:left-auto md:max-w-md z-[60] bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded shadow-lg flex justify-between items-center">
      <span className="text-sm">{message}</span>
      <button
        onClick={onClose}
        className="ml-2 text-red-500 hover:text-red-700"
        aria-label="Close error message"
      >
        <XCircle className="w-4 h-4" />
      </button>
    </div>
  );
};

// Consistent header height class
const APP_HEADER_HEIGHT_CLASS = "h-14 sm:h-12";

// Main Application Component
const App = () => {
  // --- State Hooks ---
  const { settings } = useSettings();
  const {
    tree,
    selectedItem,
    selectedItemId,
    selectItemById,
    contextMenu,
    setContextMenu,
    expandedFolders,
    toggleFolderExpand,
    expandFolderPath,
    getItemPath,
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
    searchItems,
    undoTreeChange,
    redoTreeChange,
    canUndoTree,
    canRedoTree,
  } = useTree();

  // UI State
  const [searchSheetOpen, setSearchSheetOpen] = useState(false); // State for the search bottom sheet
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOptions, setSearchOptions] = useState({
    caseSensitive: false,
    wholeWord: false,
    useRegex: false,
  });
  const [searchResults, setSearchResults] = useState([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newItemType, setNewItemType] = useState("folder");
  const [newItemLabel, setNewItemLabel] = useState("");
  const [parentItemForAdd, setParentItemForAdd] = useState(null);
  const [inlineRenameId, setInlineRenameId] = useState(null);
  const [inlineRenameValue, setInlineRenameValue] = useState("");
  const [aboutDialogOpen, setAboutDialogOpen] = useState(false);
  const [exportDialogState, setExportDialogState] = useState({
    isOpen: false,
    context: null,
  });
  const [importDialogState, setImportDialogState] = useState({
    isOpen: false,
    context: null,
  });
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  const topMenuRef = useRef(null);
  const [uiError, setUiError] = useState("");

  // --- Effects ---

  // Global keybindings for Undo/Redo and Search Toggle
  useEffect(() => {
    const handler = (e) => {
      const activeElement = document.activeElement;
      const isInput =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.isContentEditable);
      const isRenameActive =
        !!inlineRenameId &&
        activeElement?.closest(`li[data-item-id="${inlineRenameId}"] input`) ===
          activeElement;

      // Undo (Ctrl/Cmd + Z)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "z" &&
        !e.shiftKey
      ) {
        if (
          isInput &&
          !isRenameActive &&
          activeElement.id !== "tree-navigation-area" &&
          activeElement.id !== "global-search-input"
        )
          return;
        e.preventDefault();
        if (canUndoTree) undoTreeChange();
      }
      // Redo (Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z)
      else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === "y" ||
          (e.shiftKey && e.key.toLowerCase() === "z"))
      ) {
        if (
          isInput &&
          !isRenameActive &&
          activeElement.id !== "tree-navigation-area" &&
          activeElement.id !== "global-search-input"
        )
          return;
        e.preventDefault();
        if (canRedoTree) redoTreeChange();
      }
      // Toggle Search Sheet (Ctrl/Cmd + Shift + F)
      else if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toUpperCase() === "F"
      ) {
        if (
          isInput &&
          activeElement.id !== "tree-navigation-area" &&
          activeElement.id !== "global-search-input"
        )
          return;
        e.preventDefault();
        setSearchSheetOpen((s) => !s); // Toggle sheet
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    canUndoTree,
    undoTreeChange,
    canRedoTree,
    redoTreeChange,
    inlineRenameId,
  ]);

  // Disable Regex search option if needed
  useEffect(() => {
    const isRegexCurrentlyDisabledInPane = true;
    if (isRegexCurrentlyDisabledInPane && searchOptions.useRegex) {
      setSearchOptions((prev) => ({ ...prev, useRegex: false }));
    }
  }, [searchOptions.useRegex]);

  // Effect to generate search results (FIX for Duplicates included)
  useEffect(() => {
    if (searchQuery && searchSheetOpen) {
      // Check if sheet is open
      const currentSearchOpts = { ...searchOptions, useRegex: false };
      const rawHits = searchItems(searchQuery, currentSearchOpts);
      const CONTEXT_CHARS_BEFORE = 20;
      const CONTEXT_CHARS_AFTER = 20;
      const MAX_SNIPPET_LENGTH = 80;
      let resultCounter = 0;

      const processedResults = rawHits.map((hit) => {
        const path = getItemPath(tree, hit.id);
        const originalLabel =
          typeof hit.label === "string"
            ? hit.label
            : typeof hit.title === "string"
            ? hit.title
            : "";
        const originalContentHtml =
          typeof hit.content === "string" ? hit.content : "";
        const plainTextContent =
          htmlToPlainTextWithNewlines(originalContentHtml);

        let displaySnippetText = "";
        let highlightStartIndexInSnippet = -1;
        let highlightEndIndexInSnippet = -1;
        let matchSource = "";
        let pathLabelHighlightDetails = {
          start: -1,
          end: -1,
          originalMatchInLabel: "",
        };

        const labelMatchInfo = matchText(
          originalLabel,
          searchQuery,
          currentSearchOpts
        );
        if (labelMatchInfo) {
          matchSource = "label";
          displaySnippetText = originalLabel;
          highlightStartIndexInSnippet = labelMatchInfo.startIndex;
          highlightEndIndexInSnippet =
            labelMatchInfo.startIndex + labelMatchInfo.matchedString.length;
          pathLabelHighlightDetails = {
            start: labelMatchInfo.startIndex,
            end:
              labelMatchInfo.startIndex + labelMatchInfo.matchedString.length,
            originalMatchInLabel: labelMatchInfo.matchedString,
          };
        }

        if ((hit.type === "note" || hit.type === "task") && plainTextContent) {
          const contentMatchInfo = matchText(
            plainTextContent,
            searchQuery,
            currentSearchOpts
          );
          if (contentMatchInfo) {
            if (matchSource === "label") {
              matchSource = "label & content";
            } else {
              matchSource = "content";
              const matchedOriginalString = contentMatchInfo.matchedString;
              const startIndexInPlainText = contentMatchInfo.startIndex;
              let snippetStart = Math.max(
                0,
                startIndexInPlainText - CONTEXT_CHARS_BEFORE
              );
              let snippetEnd = Math.min(
                plainTextContent.length,
                startIndexInPlainText +
                  matchedOriginalString.length +
                  CONTEXT_CHARS_AFTER
              );
              displaySnippetText = plainTextContent.substring(
                snippetStart,
                snippetEnd
              );
              highlightStartIndexInSnippet =
                startIndexInPlainText - snippetStart;
              highlightEndIndexInSnippet =
                highlightStartIndexInSnippet + matchedOriginalString.length;

              let prefixEllipsis = snippetStart > 0;
              let suffixEllipsis = snippetEnd < plainTextContent.length;
              if (displaySnippetText.length > MAX_SNIPPET_LENGTH) {
                const overflow = displaySnippetText.length - MAX_SNIPPET_LENGTH;
                let reduceBefore = Math.floor(overflow / 2);
                if (highlightStartIndexInSnippet < reduceBefore)
                  reduceBefore = highlightStartIndexInSnippet;
                if (reduceBefore > 0) {
                  displaySnippetText =
                    displaySnippetText.substring(reduceBefore);
                  highlightStartIndexInSnippet -= reduceBefore;
                  highlightEndIndexInSnippet -= reduceBefore;
                  prefixEllipsis = true;
                }
                if (displaySnippetText.length > MAX_SNIPPET_LENGTH) {
                  const cutFromEnd =
                    displaySnippetText.length - MAX_SNIPPET_LENGTH;
                  displaySnippetText = displaySnippetText.substring(
                    0,
                    displaySnippetText.length - cutFromEnd
                  );
                  suffixEllipsis = true;
                }
                highlightStartIndexInSnippet = Math.max(
                  0,
                  highlightStartIndexInSnippet
                );
                highlightEndIndexInSnippet = Math.min(
                  displaySnippetText.length,
                  highlightEndIndexInSnippet
                );
                if (
                  highlightStartIndexInSnippet >= highlightEndIndexInSnippet
                ) {
                  highlightStartIndexInSnippet = -1;
                  highlightEndIndexInSnippet = -1;
                }
              }
              if (prefixEllipsis && !displaySnippetText.startsWith("..."))
                displaySnippetText = "..." + displaySnippetText;
              if (suffixEllipsis && !displaySnippetText.endsWith("..."))
                displaySnippetText = displaySnippetText + "...";
            }
          }
        }

        if (!matchSource) {
          displaySnippetText = originalLabel;
          matchSource = "unknown";
        }

        return {
          id: `${hit.id}-${matchSource}-${resultCounter++}`,
          originalId: hit.id,
          ...hit,
          path: path,
          displaySnippetText: displaySnippetText,
          highlightStartIndexInSnippet: highlightStartIndexInSnippet,
          highlightEndIndexInSnippet: highlightEndIndexInSnippet,
          matchSource: matchSource,
          pathLabelHighlight:
            pathLabelHighlightDetails.start !== -1
              ? pathLabelHighlightDetails
              : undefined,
        };
      });

      setSearchResults(
        processedResults.filter(
          (r) => r && r.matchSource && r.matchSource !== "unknown"
        )
      );
    } else {
      setSearchResults([]);
    }
  }, [
    searchQuery,
    searchOptions,
    searchItems,
    tree,
    getItemPath,
    searchSheetOpen,
  ]); // Depends on sheet state

  // Close top menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (topMenuRef.current && !topMenuRef.current.contains(e.target)) {
        setTopMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Callback Handlers (Unchanged from previous correct version) ---
  const startInlineRename = useCallback(
    /* ... */ (i) => {
      if (!i || draggedId === i.id || inlineRenameId) return;
      setUiError("");
      setInlineRenameId(i.id);
      setInlineRenameValue(i.label);
      setContextMenu((m) => ({ ...m, visible: false }));
    },
    [draggedId, inlineRenameId, setContextMenu]
  );
  const cancelInlineRename = useCallback(
    /* ... */ () => {
      setInlineRenameId(null);
      setInlineRenameValue("");
      setUiError("");
      requestAnimationFrame(() =>
        document
          .querySelector('nav[aria-label="Notes and Tasks Tree"]')
          ?.focus({ preventScroll: true })
      );
    },
    []
  );
  const handleAttemptRename = useCallback(
    /* ... */ async () => {
      if (!inlineRenameId) return;
      const nl = inlineRenameValue.trim();
      const oi = findItemById(tree, inlineRenameId);
      if (!nl) {
        setUiError("Name cannot be empty.");
        return;
      }
      if (nl === oi?.label) {
        cancelInlineRename();
        return;
      }
      const r = renameItem(inlineRenameId, nl);
      if (r.success) cancelInlineRename();
      else setUiError(r.error || "Rename failed.");
    },
    [inlineRenameId, inlineRenameValue, renameItem, tree, cancelInlineRename]
  );
  const openAddDialog = useCallback(
    /* ... */ (t, p) => {
      setNewItemType(t);
      setParentItemForAdd(p);
      setNewItemLabel("");
      setUiError("");
      setAddDialogOpen(true);
      setContextMenu((m) => ({ ...m, visible: false }));
      setTopMenuOpen(false);
    },
    [setContextMenu]
  );
  const handleAdd = useCallback(
    /* ... */ async () => {
      const tl = newItemLabel.trim();
      if (!tl) {
        setUiError("Name cannot be empty.");
        return;
      }
      const ni = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: newItemType,
        label: tl,
        ...(newItemType === "folder" ? { children: [] } : {}),
        ...(newItemType === "task" ? { completed: false, content: "" } : {}),
        ...(newItemType === "note" ? { content: "" } : {}),
      };
      const pid = parentItemForAdd?.id ?? null;
      const r = addItem(ni, pid);
      if (r.success) {
        setAddDialogOpen(false);
        setNewItemLabel("");
        setParentItemForAdd(null);
        setUiError("");
      } else setUiError(r.error || "Add failed.");
    },
    [newItemLabel, newItemType, parentItemForAdd, addItem]
  );
  const handleToggleTask = useCallback(
    /* ... */ (id, comp) => updateTask(id, { completed: comp }),
    [updateTask]
  );
  const handleDragEnd = useCallback(
    /* ... */ () => setDraggedId(null),
    [setDraggedId]
  );
  const openExportDialog = useCallback(
    /* ... */ (ctx) => {
      setExportDialogState({ isOpen: true, context: ctx });
      setContextMenu((m) => ({ ...m, visible: false }));
      setTopMenuOpen(false);
    },
    [setContextMenu]
  );
  const openImportDialog = useCallback(
    /* ... */ (ctx) => {
      setImportDialogState({ isOpen: true, context: ctx });
      setContextMenu((m) => ({ ...m, visible: false }));
      setTopMenuOpen(false);
    },
    [setContextMenu]
  );
  const handleFileImport = useCallback(
    /* ... */ async (f, to) => {
      const r = await handleImport(f, to);
      if (!r.success) setUiError(r.error || "Import error.");
      else setUiError("");
    },
    [handleImport]
  );
  const handlePaste = useCallback(
    /* ... */ (tid) => {
      const r = pasteItem(tid);
      if (!r.success) setUiError(r.error || "Paste failed.");
      else setUiError("");
    },
    [pasteItem]
  );
  const handleDeleteConfirm = useCallback(
    /* ... */ () => {
      if (contextMenu.item) deleteItem(contextMenu.item.id);
      setContextMenu((m) => ({ ...m, visible: false }));
    },
    [contextMenu.item, deleteItem, setContextMenu]
  );

  // Global Keydown logic for F2, Copy, Cut, Paste, Delete (Unchanged)
  useEffect(() => {
    /* ... Keep the existing handleGlobalKeyDown logic ... */
    const handleGlobalKeyDown = (e) => {
      const activeEl = document.activeElement;
      const isAnyInputFocused =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.isContentEditable);
      const isRenameActive = !!inlineRenameId;
      if (
        isAnyInputFocused &&
        !isRenameActive &&
        activeEl.id !== "global-search-input" &&
        activeEl.id !== "tree-navigation-area"
      ) {
        if (
          isRenameActive &&
          activeEl?.closest(`li[data-item-id="${inlineRenameId}"] input`) ===
            activeEl &&
          (e.key === "Enter" || e.key === "Escape")
        ) {
          /* handled by input */
        } else {
          return;
        }
      }
      if (
        isRenameActive &&
        activeEl?.closest(`li[data-item-id="${inlineRenameId}"] input`) ===
          activeEl
      ) {
        if (e.key !== "Enter" && e.key !== "Escape") {
          return;
        }
      }
      const treeNav = document.querySelector(
        'nav[aria-label="Notes and Tasks Tree"]'
      );
      const isTreeAreaFocused =
        treeNav &&
        (treeNav === activeEl ||
          activeEl === document.body ||
          treeNav.contains(activeEl));
      if (
        !isTreeAreaFocused &&
        !selectedItemId &&
        isAnyInputFocused &&
        activeEl.id !== "global-search-input"
      )
        return;
      if (e.key === "F2" && selectedItemId) {
        e.preventDefault();
        const item = findItemById(tree, selectedItemId);
        if (item) startInlineRename(item);
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "c" &&
        selectedItemId
      ) {
        e.preventDefault();
        copyItem(selectedItemId);
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "x" &&
        selectedItemId
      ) {
        e.preventDefault();
        cutItem(selectedItemId);
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "v" &&
        clipboardItem
      ) {
        e.preventDefault();
        const currentItem = findItemById(tree, selectedItemId);
        const targetId =
          currentItem?.type === "folder"
            ? selectedItemId
            : findParentAndSiblings(tree, selectedItemId)?.parent?.id ?? null;
        handlePaste(targetId);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedItemId) {
        if (activeEl.id === "global-search-input" && searchQuery !== "") return;
        e.preventDefault();
        const item = findItemById(tree, selectedItemId);
        if (
          item &&
          window.confirm(`Delete "${item.label}"? This cannot be undone.`)
        ) {
          deleteItem(selectedItemId);
        }
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [
    selectedItemId,
    inlineRenameId,
    tree,
    clipboardItem,
    searchQuery,
    copyItem,
    cutItem,
    pasteItem,
    deleteItem,
    startInlineRename,
  ]);

  // --- Render ---
  return (
    <div className="relative flex flex-col h-screen bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
      <ErrorDisplay message={uiError} onClose={() => setUiError("")} />

      {/* Main Layout: Only Tree and Content Panels */}
      <PanelGroup direction="horizontal" className="flex-1 min-h-0">
        {/* Panel 1: Tree View */}
        <Panel
          id="tree-panel"
          order={0}
          defaultSize={30}
          minSize={20}
          maxSize={60}
          className="flex flex-col !overflow-hidden bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-700"
        >
          {/* Tree Header & Controls */}
          <div className="flex flex-col h-full">
            <div
              className={`p-2 sm:p-3 flex justify-between items-center border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0 ${APP_HEADER_HEIGHT_CLASS}`}
            >
              <h2 className="font-medium text-base sm:text-lg md:text-xl whitespace-nowrap overflow-hidden text-ellipsis mr-2">
                {" "}
                Notes & Tasks{" "}
              </h2>
              <div
                className="flex items-center space-x-1 sm:space-x-1.5 relative"
                ref={topMenuRef}
              >
                <button
                  onClick={undoTreeChange}
                  disabled={!canUndoTree}
                  title="Undo (Ctrl+Z)"
                  className={`p-1.5 sm:p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded ${
                    !canUndoTree
                      ? "opacity-50 cursor-not-allowed"
                      : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  {" "}
                  <Undo className="w-5 h-5" />{" "}
                </button>
                <button
                  onClick={redoTreeChange}
                  disabled={!canRedoTree}
                  title="Redo (Ctrl+Y)"
                  className={`p-1.5 sm:p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded ${
                    !canRedoTree
                      ? "opacity-50 cursor-not-allowed"
                      : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  {" "}
                  <Redo className="w-5 h-5" />{" "}
                </button>
                {/* Search button toggles the Bottom Sheet */}
                <button
                  onClick={() => setSearchSheetOpen((s) => !s)}
                  title="Search (Ctrl+Shift+F)"
                  className={`p-1.5 sm:p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded ${
                    searchSheetOpen
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  {" "}
                  <SearchIcon className="w-5 h-5" />{" "}
                </button>
                <button
                  onClick={() => setSettingsDialogOpen(true)}
                  className="p-1.5 sm:p-1 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
                  title="Settings"
                >
                  {" "}
                  <SettingsIcon className="w-5 h-5 sm:w-4 sm:h-4" />{" "}
                </button>
                <button
                  onClick={() => setAboutDialogOpen(true)}
                  className="p-1.5 sm:p-1 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
                  title="About"
                >
                  {" "}
                  <Info className="w-5 h-5 sm:w-4 sm:h-4" />{" "}
                </button>
                <button
                  onClick={() => setTopMenuOpen((p) => !p)}
                  className="p-1.5 sm:p-1 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
                  title="More"
                >
                  {" "}
                  <EllipsisVertical className="w-5 h-5 sm:w-4 sm:h-4" />{" "}
                </button>
                {topMenuOpen && (
                  <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded shadow-lg z-40 text-sm">
                    <button
                      onClick={() => openAddDialog("folder", null)}
                      className="block w-full px-4 py-2.5 sm:py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      {" "}
                      Add Root Folder{" "}
                    </button>
                    <button
                      onClick={() => openExportDialog("tree")}
                      className="block w-full px-4 py-2.5 sm:py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      {" "}
                      Export Full Tree...{" "}
                    </button>
                    <button
                      onClick={() => openImportDialog("tree")}
                      className="block w-full px-4 py-2.5 sm:py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      {" "}
                      Import Full Tree...{" "}
                    </button>
                  </div>
                )}
              </div>
            </div>
            {/* Tree Component */}
            <div
              className="flex-grow overflow-auto"
              id="tree-navigation-area"
              tabIndex={-1}
            >
              <Tree
                items={tree || []}
                selectedItemId={selectedItemId}
                onSelect={selectItemById}
                inlineRenameId={inlineRenameId}
                inlineRenameValue={inlineRenameValue}
                setInlineRenameValue={setInlineRenameValue}
                onAttemptRename={handleAttemptRename}
                cancelInlineRename={cancelInlineRename}
                expandedFolders={expandedFolders}
                onToggleExpand={toggleFolderExpand}
                onToggleTask={handleToggleTask}
                draggedId={draggedId}
                onDragStart={(e, id) => {
                  if (inlineRenameId) {
                    e.preventDefault();
                    return;
                  }
                  try {
                    if (e.dataTransfer) {
                      e.dataTransfer.setData("text/plain", id);
                      e.dataTransfer.effectAllowed = "move";
                    }
                    setDraggedId(id);
                  } catch (err) {
                    console.error("Drag error:", err);
                  }
                }}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onContextMenu={(e, item) => {
                  if (draggedId || inlineRenameId) {
                    e.preventDefault();
                    return;
                  }
                  e.preventDefault();
                  e.stopPropagation();
                  selectItemById(item?.id ?? null);
                  setContextMenu({
                    visible: true,
                    x: e.clientX,
                    y: e.clientY,
                    item,
                    isEmptyArea: !item,
                  });
                }}
                onRename={startInlineRename}
                uiError={uiError}
                setUiError={setUiError}
              />
            </div>
          </div>
        </Panel>

        {/* NO Search Panel Here */}

        <PanelResizeHandle className="w-1 bg-zinc-300 dark:bg-zinc-600 hover:bg-blue-500 data-[resize-handle-active]:bg-blue-600 cursor-col-resize z-20 flex-shrink-0" />

        {/* Panel 2: Content Area */}
        <Panel
          id="content-panel"
          order={1} // Only 2 panels now
          defaultSize={70}
          minSize={40}
          className="flex flex-col !overflow-hidden bg-white dark:bg-zinc-800"
        >
          <div className="flex-grow p-2 sm:p-4 overflow-auto h-full">
            {selectedItem ? (
              selectedItem.type === "folder" ? (
                <div className="p-3">
                  <h2 className="text-lg sm:text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100 break-words">
                    {" "}
                    {selectedItem.label}{" "}
                  </h2>
                  <FolderContents
                    folder={selectedItem}
                    onSelect={selectItemById}
                    handleDragEnd={handleDragEnd}
                    draggedId={draggedId}
                    dragOverItemId={null}
                    onToggleExpand={toggleFolderExpand}
                    expandedItems={expandedFolders}
                  />
                </div>
              ) : selectedItem.type === "note" ||
                selectedItem.type === "task" ? (
                <ContentEditor
                  key={selectedItemId}
                  item={selectedItem}
                  defaultFontFamily={settings.editorFontFamily}
                  defaultFontSize={settings.editorFontSize}
                  onSaveContent={
                    selectedItem.type === "task"
                      ? (id, content) => updateTask(id, { content })
                      : updateNoteContent
                  }
                />
              ) : null
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-500 dark:text-zinc-400 p-4 text-center">
                {" "}
                Select or create an item to view or edit its content.{" "}
              </div>
            )}
          </div>
        </Panel>
      </PanelGroup>

      {/* --- Bottom Sheet for Search using react-modal-sheet --- */}
      <Sheet
        isOpen={searchSheetOpen}
        onClose={() => setSearchSheetOpen(false)}
        snapPoints={[0.75, 0.5, 0.25]} // Snap points as fractions of window height (e.g., 75%, 50%, 25%)
        initialSnap={1} // Start at 50% height (index 1 of snapPoints)
      >
        <Sheet.Container>
          <Sheet.Header>
            {/* Optional: Add a drag handle indicator */}
            <div className="flex justify-center py-2 cursor-grab">
              <div className="w-8 h-1 bg-zinc-400 dark:bg-zinc-600 rounded-full"></div>
            </div>
          </Sheet.Header>
          <Sheet.Content>
            {/* Render the SearchResultsPane inside the sheet content */}
            {/* We remove the internal header/close button from SearchResultsPane if the Sheet handles it */}
            <SearchResultsPane
              // headerHeightClass="h-12" // Height is now managed by Sheet.Header/Sheet.Content
              query={searchQuery}
              onQueryChange={setSearchQuery}
              results={searchResults}
              onSelectResult={(item) => {
                expandFolderPath(item.originalId);
                selectItemById(item.originalId);
                setSearchSheetOpen(false); // Close sheet on selection
                setTimeout(() => {
                  document
                    .querySelector(`li[data-item-id="${item.originalId}"]`)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 50);
              }}
              onClose={() => setSearchSheetOpen(false)} // Close button within pane can still trigger close
              opts={searchOptions}
              setOpts={setSearchOptions}
              // Pass a prop to hide internal header if Sheet.Header is used
              // hideInternalHeader={true}
            />
          </Sheet.Content>
        </Sheet.Container>
        {/* Backdrop is usually handled by the Sheet component itself */}
        {/* <Sheet.Backdrop onTap={() => setSearchSheetOpen(false)} /> */}
      </Sheet>
      {/* --- End Bottom Sheet --- */}

      {/* Modals and Dialogs (Context Menu, Add, About, Export, Import, Settings) */}
      {contextMenu.visible && (
        <ContextMenu
          visible={true}
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          isEmptyArea={contextMenu.isEmptyArea}
          clipboardItem={clipboardItem}
          onAddRootFolder={() => openAddDialog("folder", null)}
          onAddFolder={() =>
            contextMenu.item && openAddDialog("folder", contextMenu.item)
          }
          onAddNote={() =>
            contextMenu.item && openAddDialog("note", contextMenu.item)
          }
          onAddTask={() =>
            contextMenu.item && openAddDialog("task", contextMenu.item)
          }
          onRename={() =>
            contextMenu.item && startInlineRename(contextMenu.item)
          }
          onDelete={() => {
            if (contextMenu.item) {
              if (
                window.confirm(
                  `Delete "${contextMenu.item.label}"? This cannot be undone.`
                )
              )
                handleDeleteConfirm();
              else setContextMenu((m) => ({ ...m, visible: false }));
            } else setContextMenu((m) => ({ ...m, visible: false }));
          }}
          onDuplicate={() =>
            contextMenu.item && duplicateItem(contextMenu.item.id)
          }
          onClose={() => setContextMenu((m) => ({ ...m, visible: false }))}
          onCopy={() => contextMenu.item && copyItem(contextMenu.item.id)}
          onCut={() => contextMenu.item && cutItem(contextMenu.item.id)}
          onPaste={() => {
            const tid = contextMenu.isEmptyArea
              ? null
              : contextMenu.item?.type === "folder"
              ? contextMenu.item.id
              : findParentAndSiblings(tree, contextMenu.item?.id)?.parent?.id ??
                null;
            handlePaste(tid);
          }}
          onExportItem={() => openExportDialog("item")}
          onImportItem={() => openImportDialog("item")}
          onExportTree={() => openExportDialog("tree")}
          onImportTree={() => openImportDialog("tree")}
        />
      )}
      <AddDialog
        isOpen={addDialogOpen}
        newItemType={newItemType}
        newItemLabel={newItemLabel}
        errorMessage={addDialogOpen ? uiError : ""}
        onLabelChange={(e) => {
          setNewItemLabel(e.target.value);
          if (addDialogOpen) setUiError("");
        }}
        onAdd={handleAdd}
        onCancel={() => {
          setAddDialogOpen(false);
          setUiError("");
        }}
      />
      <AboutDialog
        isOpen={aboutDialogOpen}
        onClose={() => setAboutDialogOpen(false)}
      />
      <ExportDialog
        isOpen={exportDialogState.isOpen}
        context={exportDialogState.context}
        defaultFormat={settings.defaultExportFormat}
        onClose={() => setExportDialogState({ isOpen: false, context: null })}
        onExport={handleExport}
      />
      <ImportDialog
        isOpen={importDialogState.isOpen}
        onClose={() => setImportDialogState({ isOpen: false, context: null })}
        onImport={handleFileImport}
      />
      <SettingsDialog
        isOpen={settingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
      />
    </div>
  );
};
export default App;
