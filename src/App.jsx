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
  LogOut, // Added for logout button
} from "lucide-react";
import SearchResultsPane from "./components/SearchResultsPane";
import { matchText } from "./utils/searchUtils"; // escapeRegex might not be needed here
import { Sheet } from "react-modal-sheet";
import Login from "./components/Login"; // Import the Login component

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
    /* ignore */
  }
  return text.replace(/(\r?\n|\r){2,}/g, "\n").trim();
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

const APP_HEADER_HEIGHT_CLASS = "h-14 sm:h-12";

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
    undoTreeChange,
    redoTreeChange,
    canUndoTree,
    canRedoTree,
    // It's good practice to get resetTreeHistory if you might clear the tree on logout
    resetState: resetTreeHistory, // from useUndoRedo, aliased as resetTreeHistory in useTree
  } = useTree();

  // Authentication State
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthCheckComplete, setIsAuthCheckComplete] = useState(false);

  const [searchSheetOpen, setSearchSheetOpen] = useState(false);
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
  const [addDialogErrorMessage, setAddDialogErrorMessage] = useState("");
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

  // Check for existing token on initial app load
  useEffect(() => {
    const token = localStorage.getItem("userToken");
    if (token) {
      // Here, you might want to verify the token with the backend
      // and fetch user details if the token is valid.
      // For now, we'll assume if a token exists, the user is "logged in"
      // The useTree hook will then attempt to fetch the tree using this token.
      setCurrentUser({ token }); // Minimal user object indicating logged-in state
      
    }
    setIsAuthCheckComplete(true); // Mark initial auth check as complete
  }, []);

  const handleLoginSuccess = (userData) => {
    setCurrentUser(userData); // userData from server should not include token, token is already in localStorage
    // The useEffect in useTree hook should re-run due to resetTreeHistory or if its dependencies change
    // in a way that makes it re-fetch based on the new auth state (e.g., if it depended on a user context).
    // Forcing a reload is a simple way to ensure everything re-initializes with the new token.
    window.location.reload();
  };

  const handleLogout = () => {
    localStorage.removeItem("userToken");
    setCurrentUser(null);
    if (resetTreeHistory) {
      // Ensure resetTreeHistory is available from useTree
      resetTreeHistory([]); // Clear the local tree state
    }
    setUiError(""); // Clear any existing errors
    // No need to reload, the component will re-render to show Login
  };

  useEffect(() => {
    // Global Keybindings
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

      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "z" &&
        !e.shiftKey
      ) {
        if (
          isInput &&
          !isRenameActive &&
          activeElement.id !== "tree-navigation-area" &&
          activeElement.id !== "global-search-input" &&
          !activeElement.classList.contains("editor-pane")
        )
          return;
        e.preventDefault();
        if (canUndoTree) undoTreeChange();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === "y" ||
          (e.shiftKey && e.key.toLowerCase() === "z"))
      ) {
        if (
          isInput &&
          !isRenameActive &&
          activeElement.id !== "tree-navigation-area" &&
          activeElement.id !== "global-search-input" &&
          !activeElement.classList.contains("editor-pane")
        )
          return;
        e.preventDefault();
        if (canRedoTree) redoTreeChange();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toUpperCase() === "F"
      ) {
        if (isInput && activeElement.id === "global-search-input") return;
        e.preventDefault();
        setSearchSheetOpen((s) => !s);
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

  useEffect(() => {
    // Disable Regex search option
    const isRegexCurrentlyDisabledInPane = true;
    if (isRegexCurrentlyDisabledInPane && searchOptions.useRegex) {
      setSearchOptions((prev) => ({ ...prev, useRegex: false }));
    }
  }, [searchOptions.useRegex]);

  useEffect(() => {
    // Generate search results
    if (searchQuery && searchSheetOpen) {
      const currentSearchOpts = { ...searchOptions, useRegex: false };
      const rawHits = searchItems(searchQuery, currentSearchOpts);
      const CONTEXT_CHARS_BEFORE = 20,
        CONTEXT_CHARS_AFTER = 20,
        MAX_SNIPPET_LENGTH = 80;
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
        let displaySnippetText = "",
          highlightStartIndexInSnippet = -1,
          highlightEndIndexInSnippet = -1,
          matchSource = "";
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
            end: highlightStartIndexInSnippet,
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
            if (matchSource === "label") matchSource = "label & content";
            else {
              matchSource = "content";
              const { matchedString, startIndex: startIndexInPlainText } =
                contentMatchInfo;
              let snippetStart = Math.max(
                0,
                startIndexInPlainText - CONTEXT_CHARS_BEFORE
              );
              let snippetEnd = Math.min(
                plainTextContent.length,
                startIndexInPlainText +
                  matchedString.length +
                  CONTEXT_CHARS_AFTER
              );
              displaySnippetText = plainTextContent.substring(
                snippetStart,
                snippetEnd
              );
              highlightStartIndexInSnippet =
                startIndexInPlainText - snippetStart;
              highlightEndIndexInSnippet =
                highlightStartIndexInSnippet + matchedString.length;
              let prefixEllipsis = snippetStart > 0,
                suffixEllipsis = snippetEnd < plainTextContent.length;
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
          path,
          displaySnippetText,
          highlightStartIndexInSnippet,
          highlightEndIndexInSnippet,
          matchSource,
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
  ]);

  useEffect(() => {
    // Close top menu on outside click
    const handleClickOutside = (e) => {
      if (topMenuRef.current && !topMenuRef.current.contains(e.target)) {
        setTopMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const startInlineRename = useCallback(
    (item) => {
      if (!item || draggedId === item.id || inlineRenameId) return;
      setUiError("");
      setInlineRenameId(item.id);
      setInlineRenameValue(item.label);
      setContextMenu((m) => ({ ...m, visible: false }));
    },
    [draggedId, inlineRenameId]
  );

  const cancelInlineRename = useCallback(() => {
    setInlineRenameId(null);
    setInlineRenameValue("");
    setUiError("");
    requestAnimationFrame(() =>
      document
        .querySelector('nav[aria-label="Notes and Tasks Tree"]')
        ?.focus({ preventScroll: true })
    );
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
    const result = await renameItem(inlineRenameId, newLabel);
    if (result.success) cancelInlineRename();
    else setUiError(result.error || "Rename failed.");
  }, [
    inlineRenameId,
    inlineRenameValue,
    renameItem,
    tree,
    cancelInlineRename,
    setUiError,
  ]);

  const openAddDialog = useCallback((type, parent) => {
    setNewItemType(type);
    setParentItemForAdd(parent);
    setNewItemLabel("");
    setAddDialogErrorMessage("");
    setUiError("");
    setAddDialogOpen(true);
    setContextMenu((m) => ({ ...m, visible: false }));
    setTopMenuOpen(false);
  }, []);

  const handleAdd = useCallback(async () => {
    const tl = newItemLabel.trim();
    if (!tl) {
      setAddDialogErrorMessage("Name cannot be empty.");
      return;
    }
    const newItemData = {
      type: newItemType,
      label: tl,
      ...(newItemType === "task" ? { completed: false, content: "" } : {}),
      ...(newItemType === "note" ? { content: "" } : {}),
    };
    const pid = parentItemForAdd?.id ?? null;
    const result = await addItem(newItemData, pid);
    if (result.success) {
      setAddDialogOpen(false);
      setNewItemLabel("");
      setParentItemForAdd(null);
      setAddDialogErrorMessage("");
      setUiError("");
      // if (result.item && result.item.id) selectItemById(result.item.id);
    } else {
      setAddDialogErrorMessage(result.error || "Add operation failed.");
    }
  }, [
    newItemLabel,
    newItemType,
    parentItemForAdd,
    addItem /* selectItemById */,
  ]);

  const handleToggleTask = useCallback(
    async (id, currentCompletedStatus) => {
      const result = await updateTask(id, {
        completed: !currentCompletedStatus,
      });
      if (!result.success)
        setUiError(result.error || "Failed to update task status.");
    },
    [updateTask, setUiError]
  );

  const handleDragEnd = useCallback(() => setDraggedId(null), [setDraggedId]);

  const openExportDialog = useCallback((context) => {
    setExportDialogState({ isOpen: true, context });
    setContextMenu((m) => ({ ...m, visible: false }));
    setTopMenuOpen(false);
  }, []);

  const openImportDialog = useCallback((context) => {
    setImportDialogState({ isOpen: true, context });
    setContextMenu((m) => ({ ...m, visible: false }));
    setTopMenuOpen(false);
  }, []);

  const handleFileImport = useCallback(
    async (file, importTargetOption) => {
      const result = await handleImport(file, importTargetOption);
      if (!result.success)
        setUiError(result.error || "Import operation failed.");
      else setUiError("");
    },
    [handleImport, setUiError]
  );

  const handlePasteWrapper = useCallback(
    async (targetId) => {
      const result = await pasteItem(targetId);
      if (!result.success)
        setUiError(result.error || "Paste operation failed.");
      else setUiError("");
    },
    [pasteItem, setUiError]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (contextMenu.item && contextMenu.item.id) {
      const result = await deleteItem(contextMenu.item.id);
      if (!result.success)
        setUiError(result.error || "Delete operation failed.");
      else setUiError("");
    }
    setContextMenu((m) => ({ ...m, visible: false }));
  }, [contextMenu.item, deleteItem, setUiError]);

  const handleShowItemMenu = useCallback(
    (item, buttonElement) => {
      if (!item || !buttonElement) return;
      const rect = buttonElement.getBoundingClientRect();
      let x = rect.left,
        y = rect.bottom + 2;
      const menuWidth = 180,
        menuHeight = 250;
      if (x + menuWidth > window.innerWidth - 10)
        x = window.innerWidth - menuWidth - 10;
      if (x < 10) x = 10;
      if (y + menuHeight > window.innerHeight - 10)
        y = rect.top - menuHeight - 2;
      if (y < 10) y = 10;
      selectItemById(item.id);
      setContextMenu({ visible: true, x, y, item, isEmptyArea: false });
    },
    [selectItemById]
  );

  const handleNativeContextMenu = useCallback(
    (event, item) => {
      if (draggedId || inlineRenameId) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      selectItemById(item?.id ?? null);
      let x = event.clientX,
        y = event.clientY;
      const menuWidth = 180,
        menuHeight = item ? 250 : 150;
      if (x + menuWidth > window.innerWidth - 10)
        x = window.innerWidth - menuWidth - 10;
      if (x < 10) x = 10;
      if (y + menuHeight > window.innerHeight - 10)
        y = window.innerHeight - menuHeight - 10;
      if (y < 10) y = 10;
      setContextMenu({ visible: true, x, y, item, isEmptyArea: !item });
    },
    [draggedId, inlineRenameId, selectItemById]
  );

  useEffect(() => {
    const handleGlobalKeyDown = async (e) => {
      const activeEl = document.activeElement;
      const isRenameActive =
        !!inlineRenameId &&
        activeEl?.closest(`li[data-item-id="${inlineRenameId}"] input`) ===
          activeEl;

      // If inline rename is active, let its own onKeyDown handler manage Enter/Escape
      if (isRenameActive && (e.key === "Enter" || e.key === "Escape")) {
        return;
      }

      // Standard input fields like search, add dialog, rename dialog input
      const isStandardInputFocused =
        activeEl &&
        (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA") &&
        activeEl.id !== "tree-navigation-area" && // Exclude the tree itself from this check
        !activeEl.closest(`li[data-item-id="${inlineRenameId}"] input`); // Exclude active rename input

      // Specifically check if the ContentEditor's contentEditable div is focused
      const isContentEditorFocused =
        activeEl &&
        (activeEl.classList.contains("editor-pane") ||
          activeEl.closest(".editor-pane"));

      // --- Ctrl/Meta + Z (Undo) & Ctrl/Meta + Y (Redo) ---
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "z" &&
        !e.shiftKey
      ) {
        // Allow undo in specific inputs, otherwise global undo
        if (isStandardInputFocused || isContentEditorFocused) {
          // Let browser/editor handle its own undo if it's not the global search or tree nav
          if (
            activeEl.id === "global-search-input" ||
            activeEl.id === "tree-navigation-area" ||
            document.body === activeEl
          ) {
            e.preventDefault();
            if (canUndoTree) undoTreeChange();
          }
          // else: do nothing, let the input field handle its own undo.
        } else {
          // Focus is not on a specific input that handles undo, or it's the tree itself
          e.preventDefault();
          if (canUndoTree) undoTreeChange();
        }
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === "y" ||
          (e.shiftKey && e.key.toLowerCase() === "z"))
      ) {
        // Similar logic for redo
        if (isStandardInputFocused || isContentEditorFocused) {
          if (
            activeEl.id === "global-search-input" ||
            activeEl.id === "tree-navigation-area" ||
            document.body === activeEl
          ) {
            e.preventDefault();
            if (canRedoTree) redoTreeChange();
          }
        } else {
          e.preventDefault();
          if (canRedoTree) redoTreeChange();
        }
      }
      // --- Ctrl/Meta + Shift + F (Search) ---
      else if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toUpperCase() === "F"
      ) {
        if (isStandardInputFocused && activeEl.id === "global-search-input")
          return;
        e.preventDefault();
        setSearchSheetOpen((s) => !s);
      }
      // --- F2 (Rename) ---
      else if (
        e.key === "F2" &&
        selectedItemId &&
        !isRenameActive &&
        !isStandardInputFocused &&
        !isContentEditorFocused
      ) {
        e.preventDefault();
        const item = findItemById(tree, selectedItemId);
        if (item) startInlineRename(item);
      }
      // --- Ctrl/Meta + C (Copy) & Ctrl/Meta + X (Cut) ---
      else if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "c" &&
        selectedItemId &&
        !isRenameActive &&
        !isContentEditorFocused &&
        !isStandardInputFocused
      ) {
        e.preventDefault();
        copyItem(selectedItemId);
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "x" &&
        selectedItemId &&
        !isRenameActive &&
        !isContentEditorFocused &&
        !isStandardInputFocused
      ) {
        e.preventDefault();
        cutItem(selectedItemId);
      }
      // --- Ctrl/Meta + V (Paste) ---
      else if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "v" &&
        clipboardItem &&
        !isRenameActive &&
        !isContentEditorFocused &&
        !isStandardInputFocused
      ) {
        e.preventDefault();
        const currentItem = findItemById(tree, selectedItemId);
        const targetIdForPaste =
          currentItem?.type === "folder"
            ? selectedItemId
            : findParentAndSiblings(tree, selectedItemId)?.parent?.id ?? null;
        await handlePasteWrapper(targetIdForPaste);
      }
      // --- Delete / Backspace for Item Deletion ---
      else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedItemId &&
        !isRenameActive
      ) {
        // CRITICAL: Only proceed if focus is NOT within ContentEditor or a standard input field
        if (isContentEditorFocused || isStandardInputFocused) {
          // If focus is inside editor or a text input (not rename), let the input handle the key press.
          return;
        }
        // Allow if focus is on body, tree nav, or an element that doesn't trap these keys for text editing.
        if (
          activeEl.id === "global-search-input" &&
          searchQuery !== "" &&
          e.key === "Backspace"
        ) {
          // Let backspace work in search input if it has content
          return;
        }
        if (activeEl.id === "global-search-input" && e.key === "Delete") {
          // Let delete work in search input
          return;
        }

        e.preventDefault(); // Prevent default only if we are handling item deletion
        const item = findItemById(tree, selectedItemId);
        if (
          item &&
          window.confirm(`Delete "${item.label}"? This cannot be undone.`)
        ) {
          const result = await deleteItem(selectedItemId);
          if (!result.success) {
            setUiError(result.error || "Delete operation failed via keydown.");
          } else {
            setUiError("");
          }
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
    handlePasteWrapper,
    setUiError,
  ]);

  // Conditional rendering based on auth state
  if (!isAuthCheckComplete) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    ); // Or a spinner
  }

  if (
    !currentUser &&
    !localStorage.getItem("userToken") /* More robust check might be needed */
  ) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="relative flex flex-col h-screen bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
      <ErrorDisplay message={uiError} onClose={() => setUiError("")} />
      {/* Logout Button - Example Placement */}
      <button
        onClick={handleLogout}
        className="absolute top-3 right-3 z-50 p-1.5 sm:p-1 bg-red-500 hover:bg-red-600 text-white rounded"
        title="Logout"
      >
        <LogOut className="w-5 h-5" />
      </button>

      <PanelGroup direction="horizontal" className="flex-1 min-h-0 pt-12">
        {" "}
        {/* Added pt-12 for header spacing */}
        <Panel
          id="tree-panel"
          order={0}
          defaultSize={30}
          minSize={20}
          maxSize={60}
          className="flex flex-col !overflow-hidden bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-700"
        >
          <div className="flex flex-col h-full">
            {/* Header is now part of the main app layout, not inside panel if logout is outside */}
            <div
              className={`p-2 sm:p-3 flex justify-between items-center border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0 ${APP_HEADER_HEIGHT_CLASS}`}
            >
              <h2 className="font-medium text-base sm:text-lg md:text-xl whitespace-nowrap overflow-hidden text-ellipsis mr-2">
                Notes & Tasks
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
                    setUiError("Drag operation failed to start.");
                  }
                }}
                onDrop={(targetId) => handleDrop(targetId, draggedId)}
                onDragEnd={handleDragEnd}
                onNativeContextMenu={handleNativeContextMenu}
                onShowItemMenu={handleShowItemMenu}
                onRename={startInlineRename}
                uiError={uiError}
                setUiError={setUiError}
              />
            </div>
          </div>
        </Panel>
        <PanelResizeHandle className="w-1 bg-zinc-300 dark:bg-zinc-600 hover:bg-blue-500 data-[resize-handle-active]:bg-blue-600 cursor-col-resize z-20 flex-shrink-0" />
        <Panel
          id="content-panel"
          order={1}
          defaultSize={70}
          minSize={40}
          className="flex flex-col !overflow-hidden bg-white dark:bg-zinc-800"
        >
          <div className="flex-grow p-2 sm:p-4 overflow-auto h-full">
            {selectedItem ? (
              selectedItem.type === "folder" ? (
                <div className="p-3">
                  <h2 className="text-lg sm:text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100 break-words">
                    {selectedItem.label}
                  </h2>
                  <FolderContents
                    folder={selectedItem}
                    onSelect={selectItemById}
                    handleDragStart={(e, id) => {
                      if (inlineRenameId) e.preventDefault();
                      else setDraggedId(id);
                    }}
                    handleDragEnter={(e, id) => {
                      /* Placeholder */
                    }}
                    handleDragOver={(e) => {
                      /* Placeholder */
                    }}
                    handleDragLeave={(e) => {
                      /* Placeholder */
                    }}
                    handleDrop={(e, id) => {
                      if (
                        draggedId &&
                        id !== draggedId &&
                        selectedItem?.id === id
                      ) {
                        handleDrop(id, draggedId);
                      }
                    }}
                    handleDragEnd={handleDragEnd}
                    draggedId={draggedId}
                    dragOverItemId={null}
                    onToggleExpand={toggleFolderExpand}
                    expandedItems={expandedFolders}
                    onShowItemMenu={handleShowItemMenu}
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
                      ? async (id, content) => {
                          
                          const result = await updateTask(id, { content }); // updateTask should be from useTree
                          if (!result.success)
                            setUiError(
                              result.error || "Failed to save task content."
                            );
                        }
                      : async (id, content) => {
                          
                          const result = await updateNoteContent(id, content); // updateNoteContent from useTree
                          if (!result.success)
                            setUiError(
                              result.error || "Failed to save note content."
                            );
                        }
                  }
                />
              ) : null
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-500 dark:text-zinc-400 p-4 text-center">
                Select or create an item to view or edit its content.
              </div>
            )}
          </div>
        </Panel>
      </PanelGroup>

      <Sheet
        isOpen={searchSheetOpen}
        onClose={() => setSearchSheetOpen(false)}
        snapPoints={[0.75, 0.5, 0.25]}
        initialSnap={1}
      >
        <Sheet.Container>
          <Sheet.Header>
            <div className="flex justify-center py-2 cursor-grab">
              {" "}
              <div className="w-8 h-1 bg-zinc-400 dark:bg-zinc-600 rounded-full"></div>{" "}
            </div>
          </Sheet.Header>
          <Sheet.Content>
            <div className="overflow-y-auto h-full">
              <SearchResultsPane
                headerHeightClass="h-12"
                query={searchQuery}
                onQueryChange={setSearchQuery}
                results={searchResults}
                onSelectResult={(item) => {
                  expandFolderPath(item.originalId);
                  selectItemById(item.originalId);
                  setTimeout(() => {
                    document
                      .querySelector(`li[data-item-id="${item.originalId}"]`)
                      ?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }, 50);
                }}
                onClose={() => setSearchSheetOpen(false)}
                opts={searchOptions}
                setOpts={setSearchOptions}
              />
            </div>
          </Sheet.Content>
        </Sheet.Container>
      </Sheet>

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
              ) {
                handleDeleteConfirm();
              } else {
                setContextMenu((m) => ({ ...m, visible: false }));
              }
            } else {
              setContextMenu((m) => ({ ...m, visible: false }));
            }
          }}
          onDuplicate={async () => {
            if (contextMenu.item) {
              const result = await duplicateItem(contextMenu.item.id);
              if (!result.success)
                setUiError(result.error || "Duplicate failed");
            }
          }}
          onClose={() => setContextMenu((m) => ({ ...m, visible: false }))}
          onCopy={() => contextMenu.item && copyItem(contextMenu.item.id)}
          onCut={() => contextMenu.item && cutItem(contextMenu.item.id)}
          onPaste={async () => {
            const tid = contextMenu.isEmptyArea
              ? null
              : contextMenu.item?.type === "folder"
              ? contextMenu.item.id
              : findParentAndSiblings(tree, contextMenu.item?.id)?.parent?.id ??
                null;
            await handlePasteWrapper(tid);
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
        errorMessage={addDialogErrorMessage}
        onLabelChange={(e) => {
          setNewItemLabel(e.target.value);
          if (addDialogOpen) setAddDialogErrorMessage("");
        }}
        onAdd={handleAdd}
        onCancel={() => {
          setAddDialogOpen(false);
          setAddDialogErrorMessage("");
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
