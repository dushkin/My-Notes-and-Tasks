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
import {
  findItemById as findItemByIdUtil,
  findParentAndSiblings as findParentAndSiblingsUtil,
} from "./utils/treeUtils";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import {
  Search as SearchIcon,
  Info,
  EllipsisVertical,
  XCircle,
  Settings as SettingsIcon,
  Undo,
  Redo,
  LogOut,
  FileJson,
} from "lucide-react";
import SearchResultsPane from "./components/SearchResultsPane";
import { matchText } from "./utils/searchUtils";
import { Sheet } from "react-modal-sheet";
import Login from "./components/Login";
import Register from "./components/Register";

function htmlToPlainTextWithNewlines(html) {
  /* ... (same as before) ... */
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

const APP_HEADER_HEIGHT_CLASS = "h-14 sm:h-12";

const ErrorDisplay = ({ message, type = "error", onClose }) => {
  /* ... (same as before, with success styling) ... */
  if (!message) return null;
  useEffect(() => {
    const timer = setTimeout(() => onClose(), 5000);
    return () => clearTimeout(timer);
  }, [message, onClose]);
  const baseClasses =
    "fixed top-3 right-3 left-3 md:left-auto md:max-w-lg z-[100] px-4 py-3 rounded-lg shadow-xl flex justify-between items-center text-sm transition-all duration-300 ease-in-out";
  let typeClasses =
    type === "success"
      ? "bg-green-100 dark:bg-green-800/80 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-200"
      : "bg-red-100 dark:bg-red-800/80 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200";
  const iconColor =
    type === "success"
      ? "text-green-500 hover:text-green-700 dark:text-green-300 dark:hover:text-green-100"
      : "text-red-500 hover:text-red-700 dark:text-red-300 dark:hover:text-red-100";
  return (
    <div className={`${baseClasses} ${typeClasses}`}>
      <span>{message}</span>
      <button
        onClick={onClose}
        className={`ml-3 -mr-1 -my-1 p-1 ${iconColor} rounded-full focus:outline-none focus:ring-2 focus:ring-current`}
        aria-label="Close message"
      >
        <XCircle className="w-5 h-5" />
      </button>
    </div>
  );
};

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
    copyItem,
    cutItem,
    pasteItem,
    addItem,
    duplicateItem,
    handleExport,
    handleImport: handleImportFromHook, // Renamed to avoid conflict
    searchItems,
    undoTreeChange,
    redoTreeChange,
    canUndoTree,
    canRedoTree,
    resetState: resetTreeHistory,
    fetchUserTree,
    isFetchingTree, // Get these from useTree
  } = useTree();

  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthCheckComplete, setIsAuthCheckComplete] = useState(false);
  const [currentView, setCurrentView] = useState("login");
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
  const [uiMessage, setUiMessage] = useState("");
  const [uiMessageType, setUiMessageType] = useState("error");

  const showMessage = useCallback(
    (message, type = "error", duration = 5000) => {
      setUiMessage(message);
      setUiMessageType(type);
      // ErrorDisplay will auto-hide
    },
    []
  );

  const startInlineRename = useCallback(
    (item) => {
      if (!item || draggedId === item.id || inlineRenameId) return;
      showMessage("", "error");
      setInlineRenameId(item.id);
      setInlineRenameValue(item.label);
      setContextMenu((m) => ({ ...m, visible: false }));
    },
    [draggedId, inlineRenameId, showMessage]
  );

  const cancelInlineRename = useCallback(() => {
    setInlineRenameId(null);
    setInlineRenameValue("");
    showMessage("", "error");
    requestAnimationFrame(() =>
      document
        .querySelector('nav[aria-label="Notes and Tasks Tree"]')
        ?.focus({ preventScroll: true })
    );
  }, [showMessage]);

  const findItemByIdFromTree = useCallback(
    (id) => findItemByIdUtil(tree, id),
    [tree]
  );
  const findParentAndSiblingsFromTree = useCallback(
    (id) => findParentAndSiblingsUtil(tree, id),
    [tree]
  );

  const handleAttemptRename = useCallback(async () => {
    if (!inlineRenameId) return;
    const newLabel = inlineRenameValue.trim();
    const originalItem = findItemByIdFromTree(inlineRenameId);
    if (!newLabel) {
      showMessage("Name cannot be empty.", "error");
      return;
    }
    if (newLabel === originalItem?.label) {
      cancelInlineRename();
      return;
    }
    const result = await renameItem(inlineRenameId, newLabel);
    if (result.success) {
      cancelInlineRename();
      showMessage("Item renamed.", "success", 3000);
    } else {
      showMessage(result.error || "Rename failed.", "error");
    }
  }, [
    inlineRenameId,
    inlineRenameValue,
    renameItem,
    cancelInlineRename,
    findItemByIdFromTree,
    showMessage,
  ]);

  const openAddDialog = useCallback(
    (type, parent) => {
      setNewItemType(type);
      setParentItemForAdd(parent);
      setNewItemLabel("");
      setAddDialogErrorMessage("");
      showMessage("", "error");
      setAddDialogOpen(true);
      setContextMenu((m) => ({ ...m, visible: false }));
      setTopMenuOpen(false);
    },
    [showMessage]
  );

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
      showMessage(`${newItemType} added.`, "success", 3000);
      if (result.item?.id) {
        selectItemById(result.item.id);
        if (result.item.type === "folder" && settings.autoExpandNewFolders) {
          if (pid) expandFolderPath(pid);
          else expandFolderPath(result.item.id);
        }
      }
    } else {
      setAddDialogErrorMessage(result.error || "Add operation failed.");
    }
  }, [
    newItemLabel,
    newItemType,
    parentItemForAdd,
    addItem,
    showMessage,
    selectItemById,
    settings.autoExpandNewFolders,
    expandFolderPath,
  ]);

  const handleToggleTask = useCallback(
    async (id, currentCompletedStatus) => {
      const result = await updateTask(id, {
        completed: !currentCompletedStatus,
      });
      if (!result.success)
        showMessage(result.error || "Failed to update task status.", "error");
      else showMessage("Task status updated.", "success", 2000);
    },
    [updateTask, showMessage]
  );

  const handleDragEnd = useCallback(() => setDraggedId(null), []);
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
      showMessage("", "error");
      const result = await handleImportFromHook(file, importTargetOption); // Use renamed hook function
      if (result && result.success) {
        showMessage(result.message || "Import successful!", "success");
        setTimeout(() => {
          setImportDialogState({ isOpen: false, context: null });
          showMessage("", "success");
        }, 1500);
        return {
          success: true,
          message: result.message || "Import successful!",
        };
      } else {
        showMessage(result?.error || "Import operation failed.", "error");
        return {
          success: false,
          error: result?.error || "Import operation failed.",
        };
      }
    },
    [handleImportFromHook, setImportDialogState, showMessage]
  );

  const handlePasteWrapper = useCallback(
    async (targetId) => {
      const result = await pasteItem(targetId);
      if (!result.success)
        showMessage(result.error || "Paste operation failed.", "error");
      else showMessage("Item pasted.", "success", 3000);
    },
    [pasteItem, showMessage]
  );

  const handleDeleteConfirm = useCallback(
    async (itemIdToDelete) => {
      if (itemIdToDelete) {
        const result = await deleteItem(itemIdToDelete);
        if (!result.success)
          showMessage(result.error || "Delete operation failed.", "error");
        else showMessage("Item deleted.", "success", 3000);
      }
      setContextMenu((m) => ({ ...m, visible: false }));
    },
    [deleteItem, showMessage]
  );

  const handleShowItemMenu = useCallback(
    (item, buttonElement) => {
      /* ... (as before) ... */
      if (!item || !buttonElement) return;
      const rect = buttonElement.getBoundingClientRect();
      let x = rect.left,
        y = rect.bottom + 2;
      const menuWidth = 190,
        menuHeight = item.type === "folder" ? 350 : 280;
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
      /* ... (as before) ... */
      if (draggedId || inlineRenameId) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      selectItemById(item?.id ?? null);
      let x = event.clientX,
        y = event.clientY;
      const menuWidth = 190,
        menuHeight = item ? (item.type === "folder" ? 350 : 280) : 180;
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
    // Handles initial auth check and tree loading
    const token = localStorage.getItem("userToken");
    if (token) {
      setCurrentUser({ token }); // Set minimal current user
      setCurrentView("app");
      if (fetchUserTree) fetchUserTree(token); // Pass token directly for clarity
    } else {
      setCurrentView("login");
      if (resetTreeHistory) resetTreeHistory([]);
    }
    setIsAuthCheckComplete(true);
  }, [fetchUserTree, resetTreeHistory]); // fetchUserTree and resetTreeHistory are stable

  const handleLoginSuccess = async (userData) => {
    setCurrentUser(userData); // userData from backend (token already set in localStorage by Login.jsx)
    setCurrentView("app");
    if (fetchUserTree) {
      await fetchUserTree(localStorage.getItem("userToken")); // Fetch tree using the new token
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("userToken");
    setCurrentUser(null);
    if (resetTreeHistory) resetTreeHistory([]);
    showMessage("");
    setCurrentView("login");
  };

  useEffect(() => {
    /* ... (Global Keydown for Undo/Redo, Search Toggle - as before) ... */
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
    /* ... (Global Keydown for Tree Item Operations - as refined before) ... */
    const handleGlobalTreeOpsKeyDown = async (e) => {
      const activeEl = document.activeElement;
      const isRenameActive =
        !!inlineRenameId &&
        activeEl?.closest(`li[data-item-id="${inlineRenameId}"] input`) ===
          activeEl;
      if (isRenameActive && (e.key === "Enter" || e.key === "Escape")) return;
      const isStandardInputFocused =
        activeEl &&
        (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA") &&
        activeEl.id !== "tree-navigation-area" &&
        !isRenameActive;
      const isContentEditorFocused =
        activeEl &&
        (activeEl.classList.contains("editor-pane") ||
          activeEl.closest(".editor-pane"));
      if (
        (isStandardInputFocused || isContentEditorFocused) &&
        !(
          (e.ctrlKey || e.metaKey) &&
          ["c", "x", "v"].includes(e.key.toLowerCase())
        )
      ) {
        if (e.key === "F2" && isContentEditorFocused) return;
        else if (e.key === "Delete" || e.key === "Backspace") return;
      }
      const treeNav = document.querySelector(
        'nav[aria-label="Notes and Tasks Tree"]'
      );
      const isTreeAreaLikelyFocused =
        treeNav &&
        (treeNav === activeEl ||
          treeNav.contains(activeEl) ||
          document.body === activeEl);
      if (
        e.key === "F2" &&
        selectedItemId &&
        !isRenameActive &&
        !isContentEditorFocused
      ) {
        if (isTreeAreaLikelyFocused || document.body === activeEl) {
          e.preventDefault();
          const item = findItemByIdFromTree(selectedItemId);
          if (item) startInlineRename(item);
        }
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "c" &&
        selectedItemId &&
        !isRenameActive &&
        !isContentEditorFocused
      ) {
        e.preventDefault();
        copyItem(selectedItemId);
        showMessage("Item copied.", "success", 2000);
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "x" &&
        selectedItemId &&
        !isRenameActive &&
        !isContentEditorFocused
      ) {
        e.preventDefault();
        cutItem(selectedItemId);
        showMessage("Item cut.", "success", 2000);
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "v" &&
        clipboardItem &&
        !isRenameActive &&
        !isContentEditorFocused
      ) {
        e.preventDefault();
        const currentItem = findItemByIdFromTree(selectedItemId);
        const targetIdForPaste =
          currentItem?.type === "folder"
            ? selectedItemId
            : findParentAndSiblingsFromTree(selectedItemId)?.parent?.id ?? null;
        await handlePasteWrapper(targetIdForPaste);
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedItemId &&
        !isRenameActive
      ) {
        if (
          isContentEditorFocused ||
          (isStandardInputFocused && activeEl.id !== "tree-navigation-area")
        )
          return;
        if (
          activeEl.id === "global-search-input" &&
          ((e.key === "Backspace" && searchQuery !== "") || e.key === "Delete")
        )
          return;
        if (isTreeAreaLikelyFocused || document.body === activeEl) {
          e.preventDefault();
          const item = findItemByIdFromTree(selectedItemId);
          if (
            item &&
            window.confirm(`Delete "${item.label}"? This cannot be undone.`)
          ) {
            await handleDeleteConfirm(selectedItemId);
          }
        }
      }
    };
    window.addEventListener("keydown", handleGlobalTreeOpsKeyDown);
    return () =>
      window.removeEventListener("keydown", handleGlobalTreeOpsKeyDown);
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
    showMessage,
    findItemByIdFromTree,
    findParentAndSiblingsFromTree,
  ]);

  useEffect(() => {
    /* ... (Search Results processing - as before) ... */
    if (searchQuery && searchSheetOpen) {
      const currentSearchOpts = { ...searchOptions, useRegex: false };
      const rawHits = searchItems(searchQuery, currentSearchOpts);
      const CONTEXT_CHARS_BEFORE = 20,
        CONTEXT_CHARS_AFTER = 20,
        MAX_SNIPPET_LENGTH = 80;
      let resultCounter = 0;
      const processedResults = rawHits
        .map((hit) => {
          if (!hit || !hit.id) return null;
          const pathString = getItemPath(hit.id);
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
            hlStartIndex = -1,
            hlEndIndex = -1,
            matchSrc = "";
          let pathLabelHlDetails = {
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
            matchSrc = "label";
            displaySnippetText = originalLabel;
            hlStartIndex = labelMatchInfo.startIndex;
            hlEndIndex =
              labelMatchInfo.startIndex + labelMatchInfo.matchedString.length;
            pathLabelHlDetails = {
              start: labelMatchInfo.startIndex,
              end: hlEndIndex,
              originalMatchInLabel: labelMatchInfo.matchedString,
            };
          }
          if (
            (hit.type === "note" || hit.type === "task") &&
            plainTextContent
          ) {
            const contentMatchInfo = matchText(
              plainTextContent,
              searchQuery,
              currentSearchOpts
            );
            if (contentMatchInfo) {
              if (matchSrc === "label") matchSrc = "label & content";
              else {
                matchSrc = "content";
                const { matchedString, startIndex: siInPlainText } =
                  contentMatchInfo;
                let snipStart = Math.max(
                  0,
                  siInPlainText - CONTEXT_CHARS_BEFORE
                );
                let snipEnd = Math.min(
                  plainTextContent.length,
                  siInPlainText + matchedString.length + CONTEXT_CHARS_AFTER
                );
                displaySnippetText = plainTextContent.substring(
                  snipStart,
                  snipEnd
                );
                hlStartIndex = siInPlainText - snipStart;
                hlEndIndex = hlStartIndex + matchedString.length;
                let preEll = snipStart > 0,
                  sufEll = snipEnd < plainTextContent.length;
                if (displaySnippetText.length > MAX_SNIPPET_LENGTH) {
                  const ovf = displaySnippetText.length - MAX_SNIPPET_LENGTH;
                  let redPre = Math.floor(ovf / 2);
                  if (hlStartIndex < redPre) redPre = hlStartIndex;
                  if (redPre > 0) {
                    displaySnippetText = displaySnippetText.substring(redPre);
                    hlStartIndex -= redPre;
                    hlEndIndex -= redPre;
                    preEll = true;
                  }
                  if (displaySnippetText.length > MAX_SNIPPET_LENGTH) {
                    const cutEnd =
                      displaySnippetText.length - MAX_SNIPPET_LENGTH;
                    displaySnippetText = displaySnippetText.substring(
                      0,
                      displaySnippetText.length - cutEnd
                    );
                    sufEll = true;
                  }
                  hlStartIndex = Math.max(0, hlStartIndex);
                  hlEndIndex = Math.min(displaySnippetText.length, hlEndIndex);
                  if (hlStartIndex >= hlEndIndex) {
                    hlStartIndex = -1;
                    hlEndIndex = -1;
                  }
                }
                if (preEll && !displaySnippetText.startsWith("..."))
                  displaySnippetText = "..." + displaySnippetText;
                if (sufEll && !displaySnippetText.endsWith("..."))
                  displaySnippetText = displaySnippetText + "...";
              }
            }
          }
          if (!matchSrc) {
            displaySnippetText = originalLabel;
            matchSrc = "unknown";
          }
          return {
            id: `${hit.id}-${matchSrc}-${resultCounter++}`,
            originalId: hit.id,
            ...hit,
            path: pathString,
            displaySnippetText,
            highlightStartIndexInSnippet: hlStartIndex,
            highlightEndIndexInSnippet: hlEndIndex,
            matchSource: matchSrc,
            pathLabelHighlight:
              pathLabelHlDetails.start !== -1 ? pathLabelHlDetails : undefined,
          };
        })
        .filter(Boolean);
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
    getItemPath,
    searchSheetOpen,
    tree,
    matchText,
  ]);

  useEffect(() => {
    /* ... (Top Menu Outside Click Handler - as before) ... */
    const handleClickOutside = (e) => {
      if (topMenuRef.current && !topMenuRef.current.contains(e.target))
        setTopMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isAuthCheckComplete) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-100 dark:bg-zinc-900 text-zinc-100">
        Loading application...
      </div>
    );
  }

  if (currentView === "login") {
    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        onSwitchToRegister={() => setCurrentView("register")}
      />
    );
  }
  if (currentView === "register") {
    return (
      <Register
        onRegisterSuccess={() => setCurrentView("login")}
        onSwitchToLogin={() => setCurrentView("login")}
      />
    );
  }

  // currentView === 'app'
  return (
    <div className="relative flex flex-col h-screen bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 overflow-hidden">
      <ErrorDisplay
        message={uiMessage}
        type={uiMessageType}
        onClose={() => setUiMessage("")}
      />
      <header
        className={`fixed top-0 left-0 right-0 z-30 bg-white dark:bg-zinc-800/95 backdrop-blur-sm shadow-sm ${APP_HEADER_HEIGHT_CLASS}`}
      >
        {/* ... Header JSX as before ... */}
        <div className="container mx-auto px-2 sm:px-4 flex justify-between items-center h-full">
          <h1 className="font-semibold text-lg sm:text-xl md:text-2xl whitespace-nowrap overflow-hidden text-ellipsis mr-2 text-zinc-800 dark:text-zinc-100">
            Notes & Tasks
          </h1>
          <div
            className="flex items-center space-x-0.5 sm:space-x-1 relative"
            ref={topMenuRef}
          >
            <button
              onClick={undoTreeChange}
              disabled={!canUndoTree}
              title="Undo (Ctrl+Z)"
              className={`p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full ${
                !canUndoTree
                  ? "opacity-40 cursor-not-allowed"
                  : "text-zinc-600 dark:text-zinc-300"
              }`}
            >
              {" "}
              <Undo className="w-5 h-5" />{" "}
            </button>
            <button
              onClick={redoTreeChange}
              disabled={!canRedoTree}
              title="Redo (Ctrl+Y)"
              className={`p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full ${
                !canRedoTree
                  ? "opacity-40 cursor-not-allowed"
                  : "text-zinc-600 dark:text-zinc-300"
              }`}
            >
              {" "}
              <Redo className="w-5 h-5" />{" "}
            </button>
            <button
              onClick={() => setSearchSheetOpen((s) => !s)}
              title="Search (Ctrl+Shift+F)"
              className={`p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full ${
                searchSheetOpen
                  ? "bg-blue-100 dark:bg-blue-700/50 text-blue-600 dark:text-blue-300"
                  : "text-zinc-600 dark:text-zinc-300"
              }`}
            >
              {" "}
              <SearchIcon className="w-5 h-5" />{" "}
            </button>
            <button
              onClick={() => setSettingsDialogOpen(true)}
              className="p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full"
              title="Settings"
            >
              {" "}
              <SettingsIcon className="w-5 h-5" />{" "}
            </button>
            <button
              onClick={() => setTopMenuOpen((p) => !p)}
              className="p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full"
              title="More actions"
            >
              {" "}
              <EllipsisVertical className="w-5 h-5" />{" "}
            </button>
            {topMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg z-40 py-1">
                <button
                  onClick={() => {
                    openAddDialog("folder", null);
                    setTopMenuOpen(false);
                  }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                >
                  {" "}
                  <FileJson className="w-4 h-4 opacity-70" /> Add Root Folder{" "}
                </button>
                <button
                  onClick={() => {
                    openExportDialog("tree");
                    setTopMenuOpen(false);
                  }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                >
                  {" "}
                  <FileJson className="w-4 h-4 opacity-70" /> Export Full
                  Tree...{" "}
                </button>
                <button
                  onClick={() => {
                    openImportDialog("tree");
                    setTopMenuOpen(false);
                  }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                >
                  {" "}
                  <FileJson className="w-4 h-4 opacity-70" /> Import Full
                  Tree...{" "}
                </button>
                <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-700"></div>
                <button
                  onClick={() => {
                    setAboutDialogOpen(true);
                    setTopMenuOpen(false);
                  }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                >
                  {" "}
                  <Info className="w-4 h-4 opacity-70" /> About{" "}
                </button>
                <button
                  onClick={() => {
                    handleLogout();
                    setTopMenuOpen(false);
                  }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-700/30"
                >
                  {" "}
                  <LogOut className="w-4 h-4 opacity-70" /> Logout{" "}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className={`flex-1 flex min-h-0 pt-14 sm:pt-12`}>
        <PanelGroup direction="horizontal" className="flex-1">
          <Panel
            id="tree-panel"
            order={0}
            defaultSize={30}
            minSize={20}
            maxSize={60}
            className="flex flex-col !overflow-hidden bg-zinc-50 dark:bg-zinc-800/30 border-r border-zinc-200 dark:border-zinc-700/50"
          >
            {/* ... Tree Panel JSX as before ... */}
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
                    showMessage("Drag operation failed.", "error");
                  }
                }}
                onDrop={(targetId) => handleDrop(targetId, draggedId)}
                onDragEnd={handleDragEnd}
                onNativeContextMenu={handleNativeContextMenu}
                onShowItemMenu={handleShowItemMenu}
                onRename={startInlineRename}
                uiError={uiMessage}
                setUiError={(msg) => showMessage(msg, "error")}
              />
            </div>
          </Panel>
          <PanelResizeHandle className="w-1.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-blue-500 data-[resize-handle-active=true]:bg-blue-600 transition-colors cursor-col-resize z-20 flex-shrink-0" />
          <Panel
            id="content-panel"
            order={1}
            defaultSize={70}
            minSize={30}
            className="flex flex-col !overflow-hidden bg-white dark:bg-zinc-900"
          >
            {" "}
            {/* CHANGED to dark:bg-zinc-900 for panel */}
            <div className="flex-grow overflow-auto h-full">
              {selectedItem ? (
                selectedItem.type === "folder" ? (
                  <div className="p-3 sm:p-4">
                    <h2 className="text-lg sm:text-xl font-semibold mb-3 text-zinc-800 dark:text-zinc-100 break-words">
                      {" "}
                      {/* Added dark text color */}
                      {selectedItem.label}
                    </h2>
                    <FolderContents
                      folder={selectedItem}
                      onSelect={selectItemById}
                      handleDragStart={(e, id) => {
                        if (inlineRenameId) e.preventDefault();
                        else setDraggedId(id);
                      }}
                      handleDragEnter={(e, id) => {}}
                      handleDragOver={(e) => e.preventDefault()}
                      handleDragLeave={(e) => {}}
                      handleDrop={(e, targetItemId) => {
                        if (draggedId && targetItemId === selectedItem.id) {
                          handleDrop(targetItemId, draggedId);
                        }
                      }}
                      handleDragEnd={handleDragEnd}
                      draggedId={draggedId}
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
                            const result = await updateTask(id, { content });
                            if (!result.success)
                              showMessage(
                                result.error || "Failed to save task content.",
                                "error"
                              );
                          }
                        : async (id, content) => {
                            const result = await updateNoteContent(id, content);
                            if (!result.success)
                              showMessage(
                                result.error || "Failed to save note content.",
                                "error"
                              );
                          }
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
      </main>
      {/* ... Sheet, ContextMenu, AddDialog, AboutDialog, ExportDialog, ImportDialog, SettingsDialog JSX as before ... */}
      <Sheet
        isOpen={searchSheetOpen}
        onClose={() => setSearchSheetOpen(false)}
        snapPoints={[0.85, 0.6, 0.3]}
        initialSnap={1}
        className="z-40"
      >
        <Sheet.Container className="!bg-zinc-50 dark:!bg-zinc-900 !rounded-t-xl">
          <Sheet.Header>
            <div className="flex justify-center py-2.5 cursor-grab">
              <div className="w-10 h-1.5 bg-zinc-300 dark:bg-zinc-600 rounded-full"></div>
            </div>
          </Sheet.Header>
          <Sheet.Content className="!pb-0">
            <div className="overflow-y-auto h-full">
              <SearchResultsPane
                headerHeightClass={APP_HEADER_HEIGHT_CLASS}
                query={searchQuery}
                onQueryChange={setSearchQuery}
                results={searchResults}
                onSelectResult={(item) => {
                  if (item.originalId) {
                    expandFolderPath(item.originalId);
                    selectItemById(item.originalId);
                    setSearchSheetOpen(false);
                    setTimeout(() => {
                      document
                        .querySelector(`li[data-item-id="${item.originalId}"]`)
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                    }, 100);
                  }
                }}
                onClose={() => setSearchSheetOpen(false)}
                opts={searchOptions}
                setOpts={setSearchOptions}
              />
            </div>
          </Sheet.Content>
        </Sheet.Container>
        <Sheet.Backdrop onTap={() => setSearchSheetOpen(false)} />
      </Sheet>
      {contextMenu.visible && (
        <ContextMenu
          visible={contextMenu.visible}
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
                handleDeleteConfirm(contextMenu.item.id);
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
                showMessage(result.error || "Duplicate failed", "error");
              else showMessage("Item duplicated.", "success", 3000);
            }
          }}
          onClose={() => setContextMenu((m) => ({ ...m, visible: false }))}
          onCopy={() => {
            if (contextMenu.item) {
              copyItem(contextMenu.item.id);
              showMessage("Item copied.", "success", 2000);
            }
          }}
          onCut={() => {
            if (contextMenu.item) {
              cutItem(contextMenu.item.id);
              showMessage("Item cut.", "success", 2000);
            }
          }}
          onPaste={async () => {
            const tid = contextMenu.isEmptyArea
              ? null
              : contextMenu.item?.type === "folder"
              ? contextMenu.item.id
              : findParentAndSiblingsFromTree(contextMenu.item?.id)?.parent
                  ?.id ?? null;
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
          showMessage("", "error");
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
        context={importDialogState.context}
        selectedItem={selectedItem}
        onClose={() => {
          setImportDialogState({ isOpen: false, context: null });
          showMessage("", "success");
        }}
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
