// src/App.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
// ... other imports
import {
  Search as SearchIcon,
  Info,
  EllipsisVertical,
  XCircle,
  Settings as SettingsIcon,
} from "lucide-react";
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
import SearchResultsPane from "./components/SearchResultsPane";
import { matchText } from "./utils/searchUtils";

// Helper function (can be imported from utils if you move it there)
function htmlToPlainTextWithNewlines(html) {
  if (!html) return "";
  let text = html;
  text = text.replace(
    /<(div|p|h[1-6]|li|blockquote|pre|tr|hr)[^>]*>/gi,
    "\n$&"
  );
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<[^>]+>/g, ""); // Strip all tags
  try {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = text; // For HTML entities decoding
    text = tempDiv.textContent || tempDiv.innerText || "";
  } catch (e) {
    // console.error("Error decoding HTML entities for snippet:", e);
  }
  return text.trim().replace(/(\r\n|\r|\n){2,}/g, "\n");
}

const ErrorDisplay = ({ message, onClose }) => {
  if (!message) return null;
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [message, onClose]);
  return (
    <div className="absolute top-2 right-2 left-2 md:left-auto md:max-w-md z-50 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded shadow-lg flex justify-between items-center">
      <span className="text-sm">{message}</span>
      <button
        onClick={onClose}
        className="ml-2 text-red-500 hover:text-red-700"
      >
        <XCircle className="w-4 h-4" />
      </button>
    </div>
  );
};

const APP_HEADER_HEIGHT_CLASS = "h-12";

const App = () => {
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
  } = useTree();

  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
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

  useEffect(() => {
    const handler = (e) => {
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.isContentEditable);
      if (
        isInputFocused &&
        activeElement.id !== "tree-navigation-area" &&
        activeElement.id !== "global-search-input"
      )
        return;
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toUpperCase() === "F"
      ) {
        e.preventDefault();
        setSearchPanelOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const isRegexCurrentlyDisabledInPane = true;
    if (isRegexCurrentlyDisabledInPane && searchOptions.useRegex) {
      setSearchOptions((prev) => ({ ...prev, useRegex: false }));
    }
  }, [searchOptions.useRegex]);

  useEffect(() => {
    if (searchQuery && searchPanelOpen) {
      const currentSearchOpts = { ...searchOptions };
      currentSearchOpts.useRegex = false; // Regex is disabled in SearchResultsPane

      const rawHits = searchItems(searchQuery, currentSearchOpts);

      const CONTEXT_CHARS_BEFORE = 20;
      const CONTEXT_CHARS_AFTER = 20;
      const MAX_SNIPPET_LENGTH = 80; // Increased slightly for better context

      const allProcessedResults = rawHits.flatMap((hit) => {
        const itemSpecificResults = [];
        const path = getItemPath(tree, hit.id);
        const originalLabel =
          typeof hit.label === "string"
            ? hit.label
            : typeof hit.title === "string"
            ? hit.title
            : "";
        const originalContentHtml =
          typeof hit.content === "string" ? hit.content : "";

        // Convert HTML content to plain text for searching and snippet generation
        const plainTextContent =
          htmlToPlainTextWithNewlines(originalContentHtml);

        let pathLabelHighlight = {
          start: -1,
          end: -1,
          originalMatchInLabel: "",
        };

        // 1. Check for Label Match
        if (originalLabel) {
          const labelMatchInfo = matchText(
            originalLabel,
            searchQuery,
            currentSearchOpts
          );
          if (labelMatchInfo) {
            itemSpecificResults.push({
              id: `${hit.id}-labelmatch-${labelMatchInfo.startIndex}`,
              originalId: hit.id,
              label: hit.label,
              title: hit.title,
              type: hit.type,
              path: path,
              displaySnippetText: originalLabel, // Snippet is the full label
              highlightStartIndexInSnippet: labelMatchInfo.startIndex,
              highlightEndIndexInSnippet:
                labelMatchInfo.startIndex + labelMatchInfo.matchedString.length,
              matchSource: "label",
            });
            // For path highlighting, use this match info
            pathLabelHighlight = {
              start: labelMatchInfo.startIndex,
              end:
                labelMatchInfo.startIndex + labelMatchInfo.matchedString.length,
              originalMatchInLabel: labelMatchInfo.matchedString,
            };
          }
        }

        // 2. Check for Content Match (for notes and tasks, using plainTextContent)
        if ((hit.type === "note" || hit.type === "task") && plainTextContent) {
          const contentMatchInfo = matchText(
            plainTextContent,
            searchQuery,
            currentSearchOpts
          );
          if (contentMatchInfo) {
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
            let displaySnippetText = plainTextContent.substring(
              snippetStart,
              snippetEnd
            );

            let highlightStartIndexInSnippet =
              startIndexInPlainText - snippetStart;
            let highlightEndIndexInSnippet =
              highlightStartIndexInSnippet + matchedOriginalString.length;

            let prefixEllipsis = snippetStart > 0;
            let suffixEllipsis = snippetEnd < plainTextContent.length;

            if (displaySnippetText.length > MAX_SNIPPET_LENGTH) {
              const overflow = displaySnippetText.length - MAX_SNIPPET_LENGTH;
              let reduceBefore = Math.floor(overflow / 2);
              if (highlightStartIndexInSnippet < reduceBefore)
                reduceBefore = highlightStartIndexInSnippet;
              if (reduceBefore > 0) {
                displaySnippetText = displaySnippetText.substring(reduceBefore);
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
              if (highlightStartIndexInSnippet >= highlightEndIndexInSnippet) {
                highlightStartIndexInSnippet = -1;
                highlightEndIndexInSnippet = -1;
              }
            }

            if (prefixEllipsis && !displaySnippetText.startsWith("..."))
              displaySnippetText = "..." + displaySnippetText;
            if (suffixEllipsis && !displaySnippetText.endsWith("..."))
              displaySnippetText = displaySnippetText + "...";

            // If this content match is different from a potential label match result, add it
            // (This check avoids duplicate entries if label and content snippet are identical and match identically)
            const existingLabelMatchEntry = itemSpecificResults.find(
              (r) => r.matchSource === "label"
            );
            if (
              !existingLabelMatchEntry ||
              existingLabelMatchEntry.displaySnippetText !== displaySnippetText
            ) {
              itemSpecificResults.push({
                id: `${hit.id}-contentmatch-${contentMatchInfo.startIndex}`,
                originalId: hit.id,
                label: hit.label,
                title: hit.title,
                type: hit.type,
                path: path,
                displaySnippetText: displaySnippetText, // This is now plain text
                highlightStartIndexInSnippet: highlightStartIndexInSnippet,
                highlightEndIndexInSnippet: highlightEndIndexInSnippet,
                matchSource: "content",
                // Pass pathLabelHighlight if label also matched, for consistent path display
                pathLabelHighlight:
                  pathLabelHighlight.start !== -1
                    ? pathLabelHighlight
                    : undefined,
              });
            } else if (
              existingLabelMatchEntry &&
              existingLabelMatchEntry.displaySnippetText === displaySnippetText
            ) {
              // If content snippet is identical to label and label already matched, update matchSource or merge
              existingLabelMatchEntry.matchSource = "label & content";
            }
          }
        }

        // If results were generated, ensure pathLabelHighlight is on all of them for this item if applicable
        if (pathLabelHighlight.start !== -1) {
          itemSpecificResults.forEach((res) => {
            if (!res.pathLabelHighlight) {
              res.pathLabelHighlight = pathLabelHighlight;
            }
          });
        }

        return itemSpecificResults;
      });
      setSearchResults(allProcessedResults.filter((r) => r !== null)); // Filter out nulls if flatMap produced them
    } else {
      setSearchResults([]);
    }
  }, [
    searchQuery,
    searchOptions,
    searchItems,
    tree,
    getItemPath,
    searchPanelOpen,
  ]);

  // ... (rest of App.jsx is the same as your last provided version)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (topMenuRef.current && !topMenuRef.current.contains(event.target)) {
        setTopMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const startInlineRename = useCallback(
    (itemToRename) => {
      if (!itemToRename || draggedId === itemToRename.id || inlineRenameId)
        return;
      setUiError("");
      setInlineRenameId(itemToRename.id);
      setInlineRenameValue(itemToRename.label);
      setContextMenu((m) => ({ ...m, visible: false }));
    },
    [draggedId, inlineRenameId, setContextMenu]
  );

  const cancelInlineRename = useCallback(() => {
    setInlineRenameId(null);
    setInlineRenameValue("");
    setUiError("");
    const treeNav = document.querySelector(
      'nav[aria-label="Notes and Tasks Tree"]'
    );
    requestAnimationFrame(() => treeNav?.focus({ preventScroll: true }));
  }, []);

  const handleAttemptRename = useCallback(async () => {
    if (!inlineRenameId) return;
    const newLabel = inlineRenameValue.trim();
    const originalItem = findItemById(tree, inlineRenameId);
    if (!newLabel) {
      setUiError("Name cannot be empty.");
      return;
    }
    if (newLabel === originalItem?.label) {
      cancelInlineRename();
      return;
    }
    const result = renameItem(inlineRenameId, newLabel);
    if (result.success) {
      cancelInlineRename();
    } else {
      setUiError(result.error || "Failed to rename item.");
    }
  }, [inlineRenameId, inlineRenameValue, renameItem, tree, cancelInlineRename]);

  const openAddDialog = useCallback(
    (type, parentItemOrNull) => {
      setNewItemType(type);
      setParentItemForAdd(parentItemOrNull);
      setNewItemLabel("");
      setUiError("");
      setAddDialogOpen(true);
      setContextMenu((m) => ({ ...m, visible: false }));
      setTopMenuOpen(false);
    },
    [setContextMenu]
  );

  const handleAdd = useCallback(async () => {
    const trimmedLabel = newItemLabel.trim();
    if (!trimmedLabel) {
      setUiError("Name cannot be empty.");
      return;
    }
    const newItem = {
      id:
        Date.now().toString() +
        "-" +
        Math.random().toString(36).substring(2, 9),
      type: newItemType,
      label: trimmedLabel,
      ...(newItemType === "folder" ? { children: [] } : {}),
      ...(newItemType === "task" ? { completed: false, content: "" } : {}),
      ...(newItemType === "note" ? { content: "" } : {}),
    };
    const parentId = parentItemForAdd?.id ?? null;
    const result = addItem(newItem, parentId);
    if (result.success) {
      setAddDialogOpen(false);
      setNewItemLabel("");
      setParentItemForAdd(null);
      setUiError("");
    } else {
      setUiError(result.error || "Failed to add item.");
    }
  }, [newItemLabel, newItemType, parentItemForAdd, addItem]);

  const handleToggleTask = useCallback(
    (id, completed) => updateTask(id, { completed }),
    [updateTask]
  );
  const handleDragEnd = useCallback(() => setDraggedId(null), [setDraggedId]);
  const openExportDialog = useCallback(
    (context = null) => {
      setExportDialogState({ isOpen: true, context: context });
      setContextMenu((m) => ({ ...m, visible: false }));
      setTopMenuOpen(false);
    },
    [setContextMenu]
  );
  const openImportDialog = useCallback(
    (context = null) => {
      setImportDialogState({ isOpen: true, context: context });
      setContextMenu((m) => ({ ...m, visible: false }));
      setTopMenuOpen(false);
    },
    [setContextMenu]
  );
  const handleFileImport = useCallback(
    async (file, targetOption) => {
      const result = await handleImport(file, targetOption);
      if (!result.success) {
        setUiError(result.error || "An unknown error occurred during import.");
      } else {
        setUiError("");
      }
    },
    [handleImport]
  );
  const handlePaste = useCallback(
    (targetFolderId) => {
      const result = pasteItem(targetFolderId);
      if (!result.success) {
        setUiError(result.error || "Failed to paste item.");
      } else {
        setUiError("");
      }
    },
    [pasteItem]
  );
  const handleDeleteConfirm = useCallback(() => {
    if (contextMenu.item) {
      deleteItem(contextMenu.item.id);
    }
    setContextMenu((m) => ({ ...m, visible: false }));
  }, [contextMenu.item, deleteItem, setContextMenu]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.isContentEditable);
      const renameInput = inlineRenameId
        ? document.querySelector(`li[data-item-id="${inlineRenameId}"] input`)
        : null;
      const isRenameInputFocused = renameInput === activeElement;

      if (isRenameInputFocused) {
        if (e.key === "Enter" || e.key === "Escape") {
          /* Handled by input */
        } else {
          return;
        }
      }

      if (isInputFocused && !isRenameInputFocused) {
        const isGlobalShortcut = e.ctrlKey || e.metaKey || e.key === "F2";
        if (
          activeElement.id === "global-search-input" &&
          (e.key === "Delete" || e.key === "Backspace")
        ) {
          // Allow search input to process its own delete/backspace
        } else if (
          !isGlobalShortcut &&
          (e.key === "Delete" || e.key === "Backspace")
        ) {
          return;
        }
      }

      const treeNav = document.querySelector(
        'nav[aria-label="Notes and Tasks Tree"]'
      );
      const isTreeAreaFocused =
        treeNav &&
        (treeNav === activeElement ||
          activeElement === document.body ||
          treeNav.contains(activeElement));

      if (
        !isTreeAreaFocused &&
        !selectedItemId &&
        isInputFocused &&
        activeElement.id !== "global-search-input"
      )
        return;

      if (
        e.key === "F2" &&
        selectedItemId &&
        !isRenameInputFocused &&
        activeElement.id !== "global-search-input"
      ) {
        e.preventDefault();
        const itemToRename = findItemById(tree, selectedItemId);
        if (itemToRename) startInlineRename(itemToRename);
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "c" &&
        selectedItemId &&
        activeElement.id !== "global-search-input"
      ) {
        e.preventDefault();
        copyItem(selectedItemId);
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "x" &&
        selectedItemId &&
        activeElement.id !== "global-search-input"
      ) {
        e.preventDefault();
        cutItem(selectedItemId);
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "v" &&
        clipboardItem &&
        activeElement.id !== "global-search-input"
      ) {
        e.preventDefault();
        const currentItem = findItemById(tree, selectedItemId);
        const targetId =
          currentItem?.type === "folder"
            ? selectedItemId
            : findParentAndSiblings(tree, selectedItemId)?.parent?.id ?? null;
        handlePaste(targetId);
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedItemId &&
        activeElement.id !== "global-search-input" &&
        !isInputFocused
      ) {
        e.preventDefault();
        const itemToDelete = findItemById(tree, selectedItemId);
        if (
          itemToDelete &&
          window.confirm(
            `Are you sure you want to delete "${itemToDelete.label}"?`
          )
        ) {
          deleteItem(selectedItemId);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedItemId,
    inlineRenameId,
    startInlineRename,
    tree,
    copyItem,
    cutItem,
    pasteItem,
    clipboardItem,
    deleteItem,
    handlePaste,
  ]);

  return (
    <div className="relative flex flex-col h-screen bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
      <ErrorDisplay message={uiError} onClose={() => setUiError("")} />

      <PanelGroup direction="horizontal" className="flex-1 min-h-0">
        <Panel
          id="tree-panel"
          order={0}
          defaultSize={25}
          minSize={15}
          maxSize={50}
          className="flex flex-col !overflow-hidden bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-700"
        >
          <div className="flex flex-col h-full">
            <div
              className={`p-2 flex justify-between items-center border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0 ${APP_HEADER_HEIGHT_CLASS}`}
            >
              <h2 className="font-medium text-sm sm:text-base whitespace-nowrap overflow-hidden text-ellipsis mr-2">
                Notes & Tasks
              </h2>
              <div
                className="flex items-center space-x-1 sm:space-x-2 relative"
                ref={topMenuRef}
              >
                <button
                  onClick={() => setSearchPanelOpen((s) => !s)}
                  title="Toggle search pane (Ctrl+Shift+F)"
                  className={`p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded ${
                    searchPanelOpen
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  <SearchIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setSettingsDialogOpen(true)}
                  className="p-1 sm:p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
                  title="Settings"
                >
                  <SettingsIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setAboutDialogOpen(true)}
                  className="p-1 sm:p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
                  title="About this application"
                >
                  <Info className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setTopMenuOpen((prev) => !prev)}
                  className="p-1 sm:p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
                  title="More Actions"
                >
                  <EllipsisVertical className="w-4 h-4" />
                </button>
                {topMenuOpen && (
                  <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded shadow-lg z-40 text-sm">
                    <button
                      onClick={() => openAddDialog("folder", null)}
                      className="block w-full px-4 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      Add Root Folder
                    </button>
                    <button
                      onClick={() => openExportDialog("tree")}
                      className="block w-full px-4 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      Export Full Tree...
                    </button>
                    <button
                      onClick={() => openImportDialog("tree")}
                      className="block w-full px-4 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      Import Full Tree...
                    </button>
                  </div>
                )}
              </div>
            </div>
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
                    } else {
                      console.warn(
                        "Drag start: dataTransfer object not available."
                      );
                    }
                    setDraggedId(id);
                  } catch (err) {
                    console.error("Error setting drag data:", err);
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

        {searchPanelOpen && (
          <PanelResizeHandle className="w-1 bg-zinc-300 dark:bg-zinc-600 hover:bg-blue-500 data-[resize-handle-active]:bg-blue-600 cursor-col-resize z-20 flex-shrink-0" />
        )}
        {searchPanelOpen && (
          <Panel
            id="search-results-panel"
            order={1}
            defaultSize={25}
            minSize={15}
            maxSize={50}
            className="flex flex-col !overflow-hidden bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-700"
          >
            <SearchResultsPane
              query={searchQuery}
              onQueryChange={setSearchQuery}
              results={searchResults}
              onSelectResult={(item) => {
                expandFolderPath(item.originalId);
                selectItemById(item.originalId);
                setTimeout(() => {
                  const treePanel = document.querySelector(
                    'nav[aria-label="Notes and Tasks Tree"]'
                  );
                  const el = treePanel?.querySelector(
                    `li[data-item-id="${item.originalId}"]`
                  );
                  el?.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 50);
              }}
              onClose={() => setSearchPanelOpen(false)}
              opts={searchOptions}
              setOpts={setSearchOptions}
              headerHeightClass={APP_HEADER_HEIGHT_CLASS}
            />
          </Panel>
        )}
        <PanelResizeHandle className="w-1 bg-zinc-300 dark:bg-zinc-600 hover:bg-blue-500 data-[resize-handle-active]:bg-blue-600 cursor-col-resize z-20 flex-shrink-0" />
        <Panel
          id="content-panel"
          order={2}
          minSize={30}
          defaultSize={searchPanelOpen ? 50 : 75}
          className="flex flex-col !overflow-hidden bg-white dark:bg-zinc-800"
        >
          <div className="flex-grow p-1 sm:p-4 overflow-auto h-full">
            {selectedItem ? (
              selectedItem.type === "folder" ? (
                <div className="p-3">
                  <h2 className="text-lg sm:text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100 break-words">
                    {selectedItem.label}
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
              <div className="flex items-center justify-center h-full text-zinc-500 dark:text-zinc-400">
                Select or create an item.
              </div>
            )}
          </div>
        </Panel>
      </PanelGroup>

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
                  `Are you sure you want to delete "${contextMenu.item.label}"?`
                )
              ) {
                handleDeleteConfirm();
              } else {
                setContextMenu((m) => ({ ...m, visible: false }));
              }
            } else {
              setContextMenu((m) => ({ ...m, visible: false }));
            }
          }}
          onDuplicate={() =>
            contextMenu.item && duplicateItem(contextMenu.item.id)
          }
          onClose={() => setContextMenu((m) => ({ ...m, visible: false }))}
          onCopy={() => contextMenu.item && copyItem(contextMenu.item.id)}
          onCut={() => contextMenu.item && cutItem(contextMenu.item.id)}
          onPaste={() => {
            const targetId = contextMenu.isEmptyArea
              ? null
              : contextMenu.item?.type === "folder"
              ? contextMenu.item.id
              : findParentAndSiblings(tree, contextMenu.item?.id)?.parent?.id ??
                null;
            handlePaste(targetId);
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
