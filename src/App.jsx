import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Tree from "./components/Tree";
import FolderContents from "./components/FolderContents";
import ContentEditor from "./components/ContentEditor";
import ContextMenu from "./components/ContextMenu";
import AddDialog from "./components/AddDialog";
import AboutDialog from "./components/AboutDialog";
import ExportDialog from "./components/ExportDialog";
import ImportDialog from "./components/ImportDialog";
import SettingsDialog from "./components/SettingsDialog";
import ConfirmDialog from "./components/ConfirmDialog";
import LoadingSpinner from "./components/LoadingSpinner";
import LoadingButton from "./components/LoadingButton";
import LandingPage from "./components/LandingPage";
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
  UserCircle2,
  Download,
  Upload,
  Plus,
  Gem,
} from "lucide-react";
import SearchResultsPane from "./components/SearchResultsPane";
import { matchText } from "./utils/searchUtils";
import { Sheet } from "react-modal-sheet";
import Login from "./components/Login";
import Register from "./components/Register";
import {
  getAccessToken,
  getRefreshToken,
  clearTokens,
} from "./services/authService";
import { initApiClient, authFetch } from "./services/apiClient";
import logo from "./assets/logo_dual_32x32.png";
function getTimestampedFilename(baseName = "tree-export", extension = "json") {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const seconds = now.getSeconds().toString().padStart(2, "0");
  return `${baseName}-${year}${month}${day}-${hours}${minutes}${seconds}.${extension}`;
}

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

const APP_HEADER_HEIGHT_CLASS = "h-14 sm:h-12";

const ErrorDisplay = ({ message, type = "error", onClose }) => {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => onClose(), 5000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);
  if (!message) {
    return null;
  }

  const baseClasses =
    "fixed top-3 right-3 left-3 md:left-auto md:max-w-lg z-[100] px-4 py-3 rounded-lg shadow-xl flex justify-between items-center text-sm transition-all duration-300 ease-in-out";
  const typeClasses =
    type === "success"
      ? "bg-green-100 dark:bg-green-800/80 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-200"
      : type === "info"
      ? "bg-sky-100 dark:bg-sky-800/80 border border-sky-400 dark:border-sky-600 text-sky-700 dark:text-sky-200"
      : "bg-red-100 dark:bg-red-800/80 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200";
  const iconColor =
    type === "success"
      ? "text-green-500 hover:text-green-700 dark:text-green-300 dark:hover:text-green-100"
      : type === "info"
      ? "text-sky-500 hover:text-sky-700 dark:text-sky-300 dark:hover:text-sky-100"
      : "text-red-500 hover:text-red-700 dark:text-red-300 dark:hover:text-red-100";
  return (
    <div
      data-item-id="error-display-message"
      className={`${baseClasses} ${typeClasses}`}
      role="alert"
    >
      <span>{message}</span>
      <LoadingButton
        onClick={onClose}
        className={`ml-3 -mr-1 -my-1 p-1 ${iconColor} rounded-full focus:outline-none focus:ring-2 focus:ring-current`}
        aria-label="Close message"
        variant="secondary"
        size="small"
      >
        <XCircle className="w-5 h-5" />
      </LoadingButton>
    </div>
  );
};
// Main App Component that handles routing
const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPageRoute />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/register" element={<RegisterRoute />} />
        <Route path="/app" element={<ProtectedAppRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

// Landing Page Route Component
const LandingPageRoute = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = getAccessToken();
      if (token) {
        try {
          const response = await authFetch("/auth/verify-token");
          if (response.ok) {
            const data = await response.json();
            if (data.valid && data.user) {
              setCurrentUser(data.user);
            }
          }
        } catch (error) {
          console.log("Auth check failed:", error);
        }
      }
      setIsCheckingAuth(false);
    };
    
    checkAuth();
  }, []);
  if (isCheckingAuth) {
    return <LoadingSpinner variant="overlay" text="Loading..." />;
  }

  // Show landing page regardless of auth status
  // Users can navigate to their account from here
  return (
    <LandingPage
      onLogin={() => window.location.href = '/login'}
      onSignup={() => window.location.href = '/register'}
      currentUser={currentUser} // Pass user info to landing page
    />
  );
};

// Login Route Component
const LoginRoute = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = getAccessToken();
      if (token) {
        try {
          const response = await authFetch("/auth/verify-token");
          if (response.ok) {
            const data = await response.json();
            if (data.valid && data.user) {
              setCurrentUser(data.user);
            }
          }
        } catch (error) {
          console.log("Auth check failed:", error);
        }
      }
      setIsCheckingAuth(false);
    };
    
    checkAuth();
  }, []);
  if (isCheckingAuth) {
    return <LoadingSpinner variant="overlay" text="Loading..." />;
  }

  // If user is already logged in, redirect to app
  if (currentUser) {
    return <Navigate to="/app" replace />;
  }

  const handleLoginSuccess = (userData) => {
    setCurrentUser(userData);
    window.location.href = '/app';
  };
  return (
    <Login
      onLoginSuccess={handleLoginSuccess}
      onSwitchToRegister={() => window.location.href = '/register'}
    />
  );
};

// Register Route Component
const RegisterRoute = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = getAccessToken();
      if (token) {
        try {
          const response = await authFetch("/auth/verify-token");
          if (response.ok) {
            const data = await response.json();
            if (data.valid && data.user) {
              setCurrentUser(data.user);
            }
          }
        } catch (error) {
          console.log("Auth check failed:", error);
        }
      }
      setIsCheckingAuth(false);
    };
    
    checkAuth();
  }, []);
  if (isCheckingAuth) {
    return <LoadingSpinner variant="overlay" text="Loading..." />;
  }

  // If user is already logged in, redirect to app
  if (currentUser) {
    return <Navigate to="/app" replace />;
  }

  const handleRegisterSuccess = () => {
    window.location.href = '/login';
  };
  return (
    <Register
      onRegisterSuccess={handleRegisterSuccess}
      onSwitchToLogin={() => window.location.href = '/login'}
    />
  );
};

// Protected App Route Component
const ProtectedAppRoute = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthCheckComplete, setIsAuthCheckComplete] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token = getAccessToken();
      if (token) {
        try {
          const response = await authFetch("/auth/verify-token");
          if (response.ok) {
            const data = await response.json();
            if (data.valid && data.user) {
              setCurrentUser(data.user);
              setIsAuthCheckComplete(true);
              return;
            }
          }
        } catch (error) {
          console.log("Auth check failed:", error);
        }
      }
      // If no valid token, redirect to landing page
      clearTokens();
      window.location.href = '/';
    };
    
    checkAuth();
  }, []);
  if (!isAuthCheckComplete || !currentUser) {
    return <LoadingSpinner variant="overlay" text="Loading application..." />;
  }

  return <MainApp currentUser={currentUser} setCurrentUser={setCurrentUser} />;
};

// Main App Component (the actual notes app)
const MainApp = ({ currentUser, setCurrentUser }) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef(null);
  
  useEffect(() => {
    if (isSearchOpen) {
      const observer = new MutationObserver(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus({ preventScroll: true });
          observer.disconnect();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      return () => observer.disconnect();
    }
  }, [isSearchOpen]);
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
    handleImport: handleImportFromHook,
    searchItems,
    undoTreeChange,
    redoTreeChange,
    canUndoTree,
    canRedoTree,
    resetState: resetTreeHistory,
    fetchUserTree,
    isFetchingTree,
    currentItemCount,
  } = useTree();
  const [uiMessage, setUiMessage] = useState("");
  const [uiMessageType, setUiMessageType] = useState("error");

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
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);

  // Loading states
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    onCancel: () => {},
    variant: "default",
    confirmText: "Confirm",
    cancelText: "Cancel",
  });
  const showConfirm = useCallback((options) => {
    setConfirmDialog({
      isOpen: true,
      title: options.title || "Confirm",
      message: options.message || "Are you sure?",
      onConfirm: options.onConfirm || (() => {}),
      onCancel:
        options.onCancel ||
        (() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))),
      variant: options.variant || "default",
      confirmText: options.confirmText || "Confirm",
      cancelText: options.cancelText || "Cancel",
    });
  }, []);
  const showMessage = useCallback(
    (message, type = "error", duration = 5000) => {
      setUiMessage(message);
      setUiMessageType(type);
    },
    []
  );
  const handleActualLogout = useCallback(() => {
    clearTokens();
    setCurrentUser(null);
    if (resetTreeHistory) resetTreeHistory([]);
    setUiMessage("");
    setAccountMenuOpen(false);
    setTopMenuOpen(false);
    setIsLoggingOut(false);
    window.location.href = '/';
  }, [resetTreeHistory, setCurrentUser]);
  useEffect(() => {
    initApiClient(handleActualLogout);
  }, [handleActualLogout]);
  useEffect(() => {
    if (fetchUserTree) {
      fetchUserTree();
    }
  }, [fetchUserTree]);
  const handleInitiateLogout = async () => {
    setIsLoggingOut(true);
    const currentRefreshToken = getRefreshToken();
    if (currentRefreshToken) {
      try {
        await authFetch("/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken: currentRefreshToken }),
        });
      } catch (error) {
        console.error(
          "Error calling backend logout, proceeding with client-side logout:",
          error
        );
      }
    }
    handleActualLogout();
  };

  // Auto export functionality
  const autoExportIntervalRef = useRef(null);
  const performAutoExportRef = useRef(null);
  
  useEffect(() => {
    performAutoExportRef.current = () => {
      if (!settings.autoExportEnabled || !currentUser)
        return;
      if (!tree || tree.length === 0) {
        console.info("Auto Export: Tree is empty, skipping.");
        return;
      }
      const exportFormat = settings.defaultExportFormat || "json";
      const filename = getTimestampedFilename("auto-tree-export", exportFormat);
      console.log(`Auto Export: Interval Fired. Exporting tree as ${filename}`);
      try {
        const dataToExport = tree;
        if (exportFormat === "json") {
          const jsonStr = JSON.stringify(dataToExport, null, 2);
          const blob = new Blob([jsonStr], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          console.log(
            `Auto Export: Successfully triggered download for ${filename}`
          );
        } else if (exportFormat === "pdf") {
          console.warn(
            `PDF auto-export for ${filename} needs specific PDF generation logic.`
          );
        }
      } catch (error) {
        console.error("Auto Export: Failed to export data.", error);
        showMessage("Auto export failed.", "error");
      }
    };
  }, [
    tree,
    settings.autoExportEnabled,
    settings.defaultExportFormat,
    settings.autoExportIntervalMinutes,
    currentUser,
    showMessage,
  ]);
  useEffect(() => {
    if (autoExportIntervalRef.current) {
      clearInterval(autoExportIntervalRef.current);
      autoExportIntervalRef.current = null;
    }
    const canSetupInterval =
      settings.autoExportEnabled &&
      settings.autoExportIntervalMinutes >= 1 &&
      currentUser;
    if (canSetupInterval) {
      const intervalMs = settings.autoExportIntervalMinutes * 60 * 1000;
      autoExportIntervalRef.current = setInterval(() => {
        if (performAutoExportRef.current) {
          performAutoExportRef.current();
        }
      }, intervalMs);
      console.log(
        `Auto Export: Interval set. Exports every ${settings.autoExportIntervalMinutes} minutes.`
      );
      showMessage(
        `Auto-export active: every ${settings.autoExportIntervalMinutes} min.`,
        "info",
        4000
      );
    }
    return () => {
      if (autoExportIntervalRef.current) {
        clearInterval(autoExportIntervalRef.current);
        autoExportIntervalRef.current = null;
        console.log(
          "Auto Export: Interval cleared on cleanup or settings change."
        );
      }
    };
  }, [
    settings.autoExportEnabled,
    settings.autoExportIntervalMinutes,
    currentUser,
    showMessage,
  ]);
  // All the handler functions (keeping them similar to original)
  const startInlineRename = useCallback(
    (item) => {
      if (!item || draggedId === item.id || inlineRenameId) return;
      showMessage("", "error");
      setInlineRenameId(item.id);
      setInlineRenameValue(item.label);
      setContextMenu((m) => ({ ...m, visible: false }));
    },
    [draggedId, inlineRenameId, showMessage, setContextMenu]
  );
  const cancelInlineRename = useCallback(() => {
    setInlineRenameId(null);
    setInlineRenameValue("");
    showMessage("", "error");
    requestAnimationFrame(() => {
      const treeNav = document.querySelector(
        'nav[aria-label="Notes and Tasks Tree"]'
      );
      treeNav?.focus({ preventScroll: true });
    });
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
      showMessage("Item renamed successfully.", "success", 3000);
    } else {
      const isNetworkOrServerError =
        result.error &&
        (result.error.includes("Network error") ||
          result.error.includes("network error") ||
          result.error.includes("Server error") ||
          result.error.includes("500") ||
          result.error.includes("timeout") ||
          result.error.includes("fetch") ||
          result.error.includes("Failed to"));

      if (isNetworkOrServerError) {
        showMessage(result.error || "Rename failed.", "error");
      } else {
        showMessage(result.error || "Rename failed.", "error");
      }
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
    [showMessage, setContextMenu]
  );
  const handleAdd = useCallback(async () => {
    const trimmedLabel = newItemLabel.trim();
    if (!trimmedLabel) {
      setAddDialogErrorMessage("Name cannot be empty.");
      return;
    }

    const parentId = parentItemForAdd?.id ?? null;
    const { siblings: targetSiblings } = findParentAndSiblingsFromTree(
      parentId ? parentItemForAdd.id : null
    );

    if (
      (targetSiblings || tree).some(
        (sibling) => sibling.label.toLowerCase() === trimmedLabel.toLowerCase()
      )
    ) {
      setAddDialogErrorMessage(
        `An item named "${trimmedLabel}" already exists here.`
      );
      return;
    }

    const newItemData = {
      type: newItemType,
      label: trimmedLabel,
      content:
        newItemType === "note" || newItemType === "task" ? "" : undefined,
      completed: newItemType === "task" ? false : undefined,
      direction:
        newItemType === "note" || newItemType === "task" ? "ltr" : undefined,
    };

    setAddDialogErrorMessage("");
    const result = await addItem(newItemData, parentId);

    if (result.success) {
      setAddDialogOpen(false);
      setNewItemLabel("");
      setParentItemForAdd(null);
      setAddDialogErrorMessage("");
      showMessage(
        `${newItemType.charAt(0).toUpperCase() + newItemType.slice(1)} added.`,
        "success",
        3000
      );
      if (result.item?.id) {
        selectItemById(result.item.id);
        if (result.item.type === "folder" && settings.autoExpandNewFolders) {
          expandFolderPath(result.item.id);
        }
        if (parentId && settings.autoExpandNewFolders) {
          expandFolderPath(parentId);
        }
      }
    } else {
      const isNetworkOrServerError =
        result.error &&
        (result.error.includes("Network error") ||
          result.error.includes("network error") ||
          result.error.includes("Failed to add item") ||
          result.error.includes("Server error") ||
          result.error.includes("500") ||
          result.error.includes("timeout") ||
          result.error.includes("fetch"));
      if (isNetworkOrServerError) {
        showMessage(result.error, "error");
        setAddDialogErrorMessage("");
      } else {
        setAddDialogErrorMessage(result.error || "Add operation failed.");
      }
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
    tree,
    findParentAndSiblingsFromTree,
  ]);
  const handleToggleTask = useCallback(
    async (id, currentCompletedStatus) => {
      const result = await updateTask(id, {
        completed: !currentCompletedStatus,
      });

      if (!result.success) {
        showMessage(result.error || "Failed to update task status.", "error");
      } else {
        showMessage("Task status updated.", "success", 2000);
      }
    },
    [updateTask, showMessage]
  );
  const handleSaveItemData = useCallback(
    async (itemId, dataToSave) => {
      const item = findItemByIdFromTree(itemId);
      if (!item) return;

      let result;
      const updates = { ...dataToSave };
      if (item.type === "folder") {
        delete updates.content;
        delete updates.direction;
      }

      try {
        if (item.type === "note") {
          result = await updateNoteContent(itemId, updates);
        } else if (item.type === "task") {
          result = await updateTask(itemId, updates);
        }

        if (result && !result.success) {
          showMessage(result.error || "Failed to save item.", "error");
          throw new Error(result.error || "Failed to save item.");
        }

        return result;
      } catch (error) {
        showMessage(error.message || "Failed to save item.", "error");
        throw error;
      }
    },
    [updateNoteContent, updateTask, findItemByIdFromTree, showMessage]
  );
  const handleDragEnd = useCallback(() => setDraggedId(null), [setDraggedId]);

  const openExportDialog = useCallback(
    (context) => {
      setExportDialogState({ isOpen: true, context });
      setContextMenu((m) => ({ ...m, visible: false }));
      setTopMenuOpen(false);
    },
    [setContextMenu]
  );
  const openImportDialog = useCallback(
    (context) => {
      setImportDialogState({ isOpen: true, context });
      setContextMenu((m) => ({ ...m, visible: false }));
      setTopMenuOpen(false);
    },
    [setContextMenu]
  );
  const handleFileImport = useCallback(
    async (file, importTargetOption) => {
      showMessage("", "error");
      const result = await handleImportFromHook(file, importTargetOption);
      if (result && result.success) {
        showMessage(result.message || "Import successful!", "success");
        setTimeout(
          () => {
            setImportDialogState({ isOpen: false, context: null });
          },
          result.message && result.message.toLowerCase().includes("successful")
            ? 1500
            : 0
        );
        return {
          success: true,
          message: result.message || "Import successful!",
        };
      } else {
        if (
          result.error &&
          !result.error.startsWith("Import error: Please select a JSON file")
        ) {
          showMessage(result.error, "error");
        }
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
      if (!result.success) {
        showMessage(result.error || "Paste operation failed.", "error");
      } else {
        showMessage(result.message || "Item pasted.", "success", 3000);
      }
    },
    [pasteItem, showMessage]
  );
  const handleDeleteConfirm = useCallback(
    async (itemIdToDelete) => {
      if (itemIdToDelete) {
        const result = await deleteItem(itemIdToDelete);
        if (!result.success) {
          showMessage(result.error || "Delete operation failed.", "error");
        } else {
          showMessage("Item deleted.", "success", 3000);
        }
      }
      setContextMenu((m) => ({ ...m, visible: false }));
    },
    [deleteItem, showMessage, setContextMenu]
  );
  const handleDuplicate = useCallback(
    async (itemId) => {
      setIsDuplicating(true);
      try {
        const result = await duplicateItem(itemId);
        if (!result.success) {
          showMessage(result.error || "Duplicate failed", "error");
        } else {
          showMessage("Item duplicated.", "success", 3000);
        }
      } finally {
        setIsDuplicating(false);
      }
    },
    [duplicateItem, showMessage]
  );
  const handleShowItemMenu = useCallback(
    (item, buttonElement) => {
      if (!item || !buttonElement) return;
      const rect = buttonElement.getBoundingClientRect();
      let x = rect.left,
        y = rect.bottom + 2;
      const menuWidth = 190;
      const menuHeight = item.type === "folder" ? 350 : 280;
      if (x + menuWidth > window.innerWidth - 10)
        x = window.innerWidth - menuWidth - 10;
      if (x < 10) x = 10;
      if (y + menuHeight > window.innerHeight - 10)
        y = rect.top - menuHeight - 2;
      if (y < 10) y = 10;

      selectItemById(item.id);
      setContextMenu({ visible: true, x, y, item, isEmptyArea: false });
    },
    [selectItemById, setContextMenu]
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
      const menuWidth = 190;
      const menuHeight = item ? (item.type === "folder" ? 350 : 280) : 180;

      if (x + menuWidth > window.innerWidth - 10)
        x = window.innerWidth - menuWidth - 10;
      if (x < 10) x = 10;
      if (y + menuHeight > window.innerHeight - 10)
        y = window.innerHeight - menuHeight - 10;
      if (y < 10) y = 10;

      setContextMenu({ visible: true, x, y, item, isEmptyArea: !item });
    },
    [draggedId, inlineRenameId, selectItemById, setContextMenu]
  );
  // Search functionality
  useEffect(() => {
    if (searchQuery && searchSheetOpen) {
      const currentSearchOpts = { ...searchOptions, useRegex: false };
      const rawHits = searchItems(searchQuery, currentSearchOpts);
      const CONTEXT_CHARS_BEFORE = 20,
        CONTEXT_CHARS_AFTER = 20,
        MAX_SNIPPET_LENGTH = 80;
      let resultCounter = 0;
      const processedResults = rawHits
        .map((hit) => {
          if (!hit || !hit.id) {
            return null;
          }
          const pathString = getItemPath(tree, hit.id) || "";
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
          let hlStartIndex = -1;
          let hlEndIndex = -1;
          let matchSrc = "";
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
              if (matchSrc === "label") {
                matchSrc = "label & content";
              } else {
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
                let preEll = snipStart > 0;
                let sufEll = snipEnd < plainTextContent.length;
                if (displaySnippetText.length > MAX_SNIPPET_LENGTH) {
                  const overflow =
                    displaySnippetText.length - MAX_SNIPPET_LENGTH;
                  let reduceStart = Math.floor(overflow / 2);
                  let reduceEnd = overflow - reduceStart;
                  if (hlStartIndex < reduceStart) {
                    displaySnippetText = displaySnippetText.substring(
                      0,
                      MAX_SNIPPET_LENGTH
                    );
                    sufEll = true;
                  } else if (
                    hlEndIndex >
                    displaySnippetText.length - reduceEnd
                  ) {
                    displaySnippetText = displaySnippetText.substring(overflow);
                    hlStartIndex -= overflow;
                    hlEndIndex -= overflow;
                    preEll = true;
                  } else {
                    displaySnippetText = displaySnippetText.substring(
                      reduceStart,
                      displaySnippetText.length - reduceEnd
                    );
                    hlStartIndex -= reduceStart;
                    hlEndIndex -= reduceStart;
                    preEll = true;
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
            displaySnippetText =
              originalLabel.substring(0, MAX_SNIPPET_LENGTH) +
              (originalLabel.length > MAX_SNIPPET_LENGTH ? "..." : "");
            matchSrc = "unknown";
          }
          resultCounter++;
          return {
            id: `${hit.id}-${matchSrc}-${resultCounter}`,
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
  ]);
  // Keyboard shortcuts and event handlers
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (topMenuRef.current && !topMenuRef.current.contains(e.target)) {
        setTopMenuOpen(false);
      }
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(e.target)
      ) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.isContentEditable);
      const isRenameInputActive =
        !!inlineRenameId &&
        activeElement?.closest(`li[data-item-id="${inlineRenameId}"] input`) ===
          activeElement;
      const isTipTapEditorFocused =
        activeElement &&
        (activeElement.classList.contains("ProseMirror") ||
          activeElement.closest(".ProseMirror"));

      if (
        isInputFocused &&
        !isRenameInputActive &&
        !isTipTapEditorFocused &&
        activeElement.id !== "tree-navigation-area" &&
        activeElement.id !== "global-search-input"
      ) {
        if (
          (e.ctrlKey || e.metaKey) &&
          (e.key.toLowerCase() === "z" || e.key.toLowerCase() === "y")
        ) {
          return;
        }
      }

      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "z" &&
        !e.shiftKey
      ) {
        if (isRenameInputActive || isTipTapEditorFocused) return;
        e.preventDefault();
        if (canUndoTree) undoTreeChange();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === "y" ||
          (e.shiftKey && e.key.toLowerCase() === "z"))
      ) {
        if (isRenameInputActive || isTipTapEditorFocused) return;
        e.preventDefault();
        if (canRedoTree) redoTreeChange();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toUpperCase() === "F"
      ) {
        const el = e.target;
        if (el.id === "global-search-input") return;

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
    setSearchSheetOpen,
  ]);
  const handleAccountDisplayClick = () => {
    setAccountMenuOpen((prev) => !prev);
    setTopMenuOpen(false);
  };

  const iconBaseClass = "w-4 h-4 mr-2";
  return (
    <div className="relative flex flex-col h-screen bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 overflow-hidden">
      <ErrorDisplay
        message={uiMessage}
        type={uiMessageType}
        onClose={() => setUiMessage("")}
      />

      {isFetchingTree && (
        <LoadingSpinner
          variant="overlay"
          text="Loading your notes and tasks..."
        />
      )}

      <header
        className={`fixed top-0 left-0 right-0 z-30 bg-white dark:bg-zinc-800/95 backdrop-blur-sm shadow-sm ${APP_HEADER_HEIGHT_CLASS}`}
      >
        <div className="container mx-auto px-2 sm:px-4 flex justify-between items-center h-full">
          <div className="flex items-center">
            <img src={logo} alt="Application Logo" className="h-8 w-8 mr-2" />
            <h1 className="font-semibold text-lg sm:text-xl md:text-2xl whitespace-nowrap overflow-hidden text-ellipsis text-zinc-800 dark:text-zinc-100">
              Notes & Tasks
            </h1>
          </div>
          <div className="flex items-center space-x-0.5 sm:space-x-1">
            {currentUser && currentUser.email && (
              <div className="relative" ref={accountMenuRef}>
                <LoadingButton
                  onClick={handleAccountDisplayClick}
                  className="flex items-center mr-1 sm:mr-2 p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  title={`Account: ${currentUser.email}`}
                  disabled={isLoggingOut}
                  variant="secondary"
                  size="small"
                >
                  <UserCircle2 className="w-5 h-5 text-zinc-500 dark:text-zinc-400 mr-1 sm:mr-1.5 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 truncate max-w-[80px] xs:max-w-[100px] sm:max-w-[150px]">
                    {currentUser.email}
                  </span>
                </LoadingButton>
                {accountMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg z-40 py-1">
                    <LoadingButton
                      onClick={() => {
                        handleInitiateLogout();
                        setAccountMenuOpen(false);
                      }}
                      isLoading={isLoggingOut}
                      loadingText="Logging out..."
                      variant="danger-ghost"
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left"
                      size="small"
                    >
                      <LogOut className="w-4 h-4" /> Logout
                    </LoadingButton>
                  </div>
                )}
              </div>
            )}
            <LoadingButton
              onClick={undoTreeChange}
              disabled={!canUndoTree}
              title="Undo (Ctrl+Z)"
              className={`p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full ${
                !canUndoTree
                  ? "opacity-40 cursor-not-allowed"
                  : "text-zinc-600 dark:text-zinc-300"
              }`}
              variant="secondary"
              size="small"
            >
              <Undo className="w-5 h-5" />
            </LoadingButton>
            <LoadingButton
              onClick={redoTreeChange}
              disabled={!canRedoTree}
              title="Redo (Ctrl+Y)"
              className={`p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full ${
                !canRedoTree
                  ? "opacity-40 cursor-not-allowed"
                  : "text-zinc-600 dark:text-zinc-300"
              }`}
              variant="secondary"
              size="small"
            >
              <Redo className="w-5 h-5" />
            </LoadingButton>
            <LoadingButton
              onClick={() => setSearchSheetOpen((s) => !s)}
              title="Search (Ctrl+Shift+F)"
              className={`p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full ${
                searchSheetOpen
                  ? "bg-blue-100 dark:bg-blue-700/50 text-blue-600 dark:text-blue-300"
                  : "text-zinc-600 dark:text-zinc-300"
              }`}
              variant="secondary"
              size="small"
            >
              <SearchIcon className="w-5 h-5" />
            </LoadingButton>
            <LoadingButton
              onClick={() => setSettingsDialogOpen(true)}
              className="p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full"
              title="Settings"
              variant="secondary"
              size="small"
            >
              <SettingsIcon className="w-5 h-5" />
            </LoadingButton>
            <div className="relative" ref={topMenuRef}>
              <LoadingButton
                onClick={() => {
                  setTopMenuOpen((p) => !p);
                  setAccountMenuOpen(false);
                }}
                className="p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full"
                title="More actions"
                variant="secondary"
                size="small"
              >
                <EllipsisVertical className="w-5 h-5" />
              </LoadingButton>
              {topMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg z-40 py-1">
                  <button
                    onClick={() => {
                      openAddDialog("folder", null);
                      setTopMenuOpen(false);
                    }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  >
                    <Plus
                      className={`${iconBaseClass} text-purple-500 dark:text-purple-400`}
                    />{" "}
                    Add Root Folder
                  </button>
                  <button
                    onClick={() => {
                      openExportDialog("tree");
                      setTopMenuOpen(false);
                    }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  >
                    <Download
                      className={`${iconBaseClass} text-teal-500 dark:text-teal-400`}
                    />{" "}
                    Export Full Tree...
                  </button>
                  <button
                    onClick={() => {
                      openImportDialog("tree");
                      setTopMenuOpen(false);
                    }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  >
                    <Upload
                      className={`${iconBaseClass} text-cyan-500 dark:text-cyan-400`}
                    />{" "}
                    Import Full Tree...
                  </button>
                  <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-700"></div>
                  <button
                    onClick={() => {
                      setAboutDialogOpen(true);
                      setTopMenuOpen(false);
                    }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  >
                    <Info
                      className={`${iconBaseClass} text-blue-500 dark:text-blue-400`}
                    />{" "}
                    About
                  </button>
                </div>
              )}
            </div>
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
            {/* === Free Plan Indicator === */}
            <div className="flex-shrink-0 p-3 border-t border-zinc-200 dark:border-zinc-700/50 bg-zinc-50 dark:bg-zinc-800/30">
                <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">Free Plan</span>
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        {currentItemCount} / 100 items
                    </span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                    <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(currentItemCount, 100)}%` }}
                    ></div>
                </div>
                <button 
                    onClick={() => { window.open('/#pricing', '_blank'); }}
                    className="mt-3 w-full flex items-center justify-center gap-2 text-sm bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-2 px-4 rounded-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                    <Gem className="w-4 h-4" />
                    Upgrade to Pro
                </button>
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
            <div className="flex-grow overflow-auto h-full">
              {selectedItem ? (
                selectedItem.type === "folder" ? (
                  <div className="p-3 sm:p-4">
                    <h2 className="text-lg sm:text-xl font-semibold mb-3 text-zinc-800 dark:text-zinc-100 break-words">
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
                ) : selectedItem.type === "note" || selectedItem.type === "task" ? (
                  <ContentEditor
                    key={selectedItemId}
                    item={selectedItem}
                    defaultFontFamily={settings.editorFontFamily}
                    onSaveItemData={handleSaveItemData}
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
      </main>

      <Sheet
        isOpen={searchSheetOpen}
        onClose={() => setSearchSheetOpen(false)}
        snapPoints={[0.85, 0.6, 0.3]}
        initialSnap={1}
        className="z-40"
      >
        <Sheet.Container
          data-item-id="search-sheet-container"
          className="!bg-zinc-50 dark:!bg-zinc-900 !rounded-t-xl"
        >
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
              showConfirm({
                title: "Delete Item",
                message: `Delete "${contextMenu.item.label}"?\nThis cannot be undone.`,
                variant: "danger",
                confirmText: "Delete",
                onConfirm: () => {
                  handleDeleteConfirm(contextMenu.item.id);
                  setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                },
                onCancel: () => {
                  setContextMenu((m) => ({ ...m, visible: false }));
                  setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                },
              });
            } else {
              setContextMenu((m) => ({ ...m, visible: false }));
            }
          }}
          onDuplicate={async () => {
            if (contextMenu.item) {
              await handleDuplicate(contextMenu.item.id);
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
          const val = e.target.value ?? "";
          setNewItemLabel(val);
          if (addDialogOpen) setAddDialogErrorMessage("");
        }}
        onAdd={handleAdd}
        onCancel={() => {
          setAddDialogOpen(false);
          setAddDialogErrorMessage("");
          showMessage("", "error");
          setNewItemLabel("");
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

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={confirmDialog.onCancel}
      />

      {isDuplicating && (
        <LoadingSpinner variant="overlay" text="Duplicating item..." />
      )}
    </div>
  );
};

export default App;