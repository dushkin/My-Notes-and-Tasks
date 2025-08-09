import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import ErrorBoundary from "./ErrorBoundary.jsx";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  Navigate,
} from "react-router-dom";
import BetaBanner from "./components/BetaBanner";
import {
  initSocket,
  getSocket,
  disconnectSocket,
} from "./services/socketClient";
import Tree from "./components/tree/Tree";
import AccountPlanStatus from "./components/tree/AccountPlanStatus.jsx";
import FolderContents from "./components/rpane/FolderContents";
import ContentEditor from "./components/rpane/ContentEditor";
import ContextMenu from "./components/tree/ContextMenu.jsx";
import AddDialog from "./components/dialogs/AddDialog.jsx";
import AboutDialog from "./components/dialogs/AboutDialog.jsx";
import ExportDialog from "./components/dialogs/ExportDialog.jsx";
import ImportDialog from "./components/dialogs/ImportDialog.jsx";
import SettingsDialog from "./components/dialogs/SettingsDialog.jsx";
import ConfirmDialog from "./components/dialogs/ConfirmDialog.jsx";
import LoadingSpinner from "./components/ui/LoadingSpinner.jsx";
import LoadingButton from "./components/ui/LoadingButton.jsx";
import LandingPage from "./components/LandingPage";
import DeletionStatusPage from "./components/DeletionStatusPage";
import { subscribeToPushNotifications } from "./utils/pushSubscriptionUtil";
import { useTree } from "./hooks/useTree.jsx";
import { useSettings } from "./contexts/SettingsContext";
import { useIsMobile } from "./hooks/useIsMobile";
import { setupAndroidBackHandler, cleanupAndroidBackHandler } from "./utils/androidBackHandler";
import {
  findItemById,
  findParentAndSiblings,
  insertItemRecursive,
  deleteItemRecursive,
} from "./utils/treeUtils";
import {
  registerServiceWorker,
  requestNotificationPermission,
  subscribePush,
  getReminders,
} from "./utils/reminderUtils";
import reminderMonitor from "./components/reminders/reminderMonitor.js";
import SnoozeDialog from "./components/reminders/SnoozeDialog";
import SetReminderDialog from "./components/reminders/SetReminderDialog.jsx";
import MobileReminderPopup from "./components/reminders/MobileReminderPopup.jsx";
import FeedbackNotification from "./components/FeedbackNotification";
// Import notificationService so we can cancel high‑importance notifications and
// schedule low‑importance drawer entries when reminders fire in the foreground.
import notificationService from "./services/notificationService.js";
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
  Menu,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import SearchResultsPane from "./components/search/SearchResultsPane.jsx";
import { matchText } from "./utils/searchUtils";
import { Sheet } from "react-modal-sheet";
import Login from "./components/dialogs/Login";
import Register from "./components/dialogs/Register";
import {
  getAccessToken,
  getRefreshToken,
  clearTokens,
} from "./services/authService";
import { initApiClient, authFetch } from "./services/apiClient";
import EditorPage from "./components/pages/EditorPage.jsx";
import logo from "./assets/logo_dual_32x32.png";

// Import version manager for auto-updates
// import './utils/versionManager.js';

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

const ErrorDisplay = ({ message, type = "error", onClose, currentUser }) => {
  useEffect(() => {
    if (
      currentUser?.token &&
      typeof window.subscribeAfterLogin === "function"
    ) {
      window.subscribeAfterLogin();
    }
  }, [currentUser]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => onClose(), 8000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);
  if (!message) {
    return null;
  }

  const baseClasses =
    "fixed right-3 left-3 md:left-auto md:max-w-lg z-[100] px-4 py-3 rounded-lg shadow-xl flex justify-between items-center text-sm transition-all duration-300 ease-in-out";
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
      style={{ top: "calc(var(--beta-banner-height, 0px) + 0.75rem)" }}
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
  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === "taskChecked" && event.newValue) {
        try {
          const data = JSON.parse(event.newValue);
          if (data?.id) {
            document
              .querySelector(`[data-id='${data.id}'] input[type='checkbox']`)
              ?.click();
          }
        } catch (e) {
          console.warn("Invalid taskChecked value", event.newValue);
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Initialize notification service
  useEffect(() => {
    const initNotificationService = async () => {
      try {
        const { notificationService } = await import('./services/notificationService.js');
        await notificationService.initialize();
        await notificationService.registerActionTypes();
        console.log('🔔 Notification service initialized in App');
      } catch (error) {
        console.error('❌ Failed to initialize notification service:', error);
      }
    };

    initNotificationService();
  }, []);
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPageRoute />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/register" element={<RegisterRoute />} />
        <Route path="/app/*" element={<ProtectedAppRoute />} />
        <Route path="/deletion-status" element={<DeletionStatusPage />} />
        {/* Only catch non-API routes */}
        <Route path="/api/*" element={null} />
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

  if (currentUser) {
    return <Navigate to="/app" replace />;
  }

  return (
    <>
      <BetaBanner variant="landing" />
      <LandingPage
        onLogin={() => (window.location.href = "/login")}
        onSignup={() => (window.location.href = "/register")}
        currentUser={currentUser}
      />
    </>
  );
};

// Login Route Component
const LoginRoute = () => {
  const navigate = useNavigate(); // Add this for proper navigation
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
              // Also subscribe to push notifications for existing authenticated users
              if (typeof window.subscribeAfterLogin === "function") {
                window.subscribeAfterLogin();
              }
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

  if (currentUser) {
    return <Navigate to="/app" replace />;
  }

  const handleLoginSuccess = (userData) => {
    console.log("[DEBUG] Login success - setting user:", userData);
    setCurrentUser(userData);

    // Subscribe to push notifications after successful login
    if (typeof window.subscribeAfterLogin === "function") {
      window.subscribeAfterLogin();
    }

    // Use React Router navigation instead of hard redirect
    console.log("[DEBUG] Navigating to /app");
    navigate("/app", { replace: true });
  };

  const handleSwitchToRegister = () => {
    navigate("/register", { replace: true });
  };

  return (
    <>
      <BetaBanner variant="auth" />
      <Login
        onLoginSuccess={handleLoginSuccess}
        onSwitchToRegister={handleSwitchToRegister}
      />
    </>
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

  if (currentUser) {
    return <Navigate to="/app" replace />;
  }

  const handleRegisterSuccess = () => {
    window.location.href = "/login";
  };
  return (
    <>
      <BetaBanner variant="auth" />
      <Register
        onRegisterSuccess={handleRegisterSuccess}
        onSwitchToLogin={() => (window.location.href = "/login")}
      />
    </>
  );
};

// Protected App Route Component
const ProtectedAppRoute = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [isAuthCheckComplete, setIsAuthCheckComplete] = useState(false);
  useEffect(() => {
    const checkAuth = async () => {
      const initialToken = getAccessToken();
      if (initialToken) {
        try {
          const response = await authFetch("/auth/verify-token");
          if (response.ok) {
            const data = await response.json();
            if (data.valid && data.user) {
              const finalToken = getAccessToken();
              setCurrentUser(data.user);
              setAuthToken(finalToken);
              setIsAuthCheckComplete(true);
              return;
            }
          }
        } catch (error) {
          console.log("Auth check failed:", error);
        }
      }
      clearTokens();
      window.location.href = "/";
    };

    checkAuth();
  }, []);
  if (!isAuthCheckComplete || !currentUser) {
    return <LoadingSpinner variant="overlay" text="Loading application..." />;
  }

  return (
    <Routes>
      <Route
        index
        element={
          <MainApp
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            authToken={authToken}
          />
        }
      />
      <Route path="item/:id" element={<EditorPage />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
};

// Main App Component (the actual notes app)
const dragOverItemId = null;
const handleDragEnter = () => {};
const handleDragOver = () => {};
const handleDragLeave = () => {};
const MainApp = ({ currentUser, setCurrentUser, authToken }) => {
  const navigate = useNavigate();
  const {
    tree,
    setTreeWithUndo,
    selectedItem,
    selectedItemId,
    selectItemById,
    contextMenu,
    setContextMenu,
    expandedFolders,
    toggleFolderExpand,
    collapseAll,
    expandAll,
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
  } = useTree(currentUser);

  useEffect(() => {
    console.log("Attempting to init socket with token:", authToken);

    if (!currentUser?._id || !authToken) return;

    const socket = initSocket(authToken);

    if (!socket) {
      console.warn("🧨 Socket not created. Aborting listeners setup.");
      return;
    }

    socket.on("connect_error", (error) => {
      console.warn("Socket connection failed:", error.message);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
    });

    // Tree sync is now handled entirely by useRealTimeSync in useTree.jsx

    // FIXED: Reminder sync handlers - only sync data, don't trigger
    const handleReminderSet = (reminderData) => {
      console.log("Socket event: reminder:set - SYNCING ONLY", reminderData);
      const reminders = getReminders();
      reminders[reminderData.itemId] = reminderData;
      localStorage.setItem("notes_app_reminders", JSON.stringify(reminders));
      window.dispatchEvent(
        new CustomEvent("remindersUpdated", { detail: reminders })
      );
    };

    const handleReminderClear = ({ itemId }) => {
      console.log("Socket event: reminder:clear - SYNCING ONLY", { itemId });
      const reminders = getReminders();
      delete reminders[itemId];
      localStorage.setItem("notes_app_reminders", JSON.stringify(reminders));
      window.dispatchEvent(
        new CustomEvent("remindersUpdated", { detail: reminders })
      );
    };

    const handleReminderUpdate = (reminderData) => {
      console.log("Socket event: reminder:update - SYNCING ONLY", reminderData);
      const reminders = getReminders();
      reminders[reminderData.itemId] = reminderData;
      localStorage.setItem("notes_app_reminders", JSON.stringify(reminders));
      window.dispatchEvent(
        new CustomEvent("remindersUpdated", { detail: reminders })
      );
    };

    // NEW: Direct reminder trigger from server (for server-scheduled reminders)
    const handleReminderTriggered = (reminder) => {
      console.log("Socket event: reminder:trigger - DIRECT TRIGGER", reminder);
      window.dispatchEvent(
        new CustomEvent("reminderTriggered", {
          detail: { ...reminder },
        })
      );
    };

    // Register only reminder-related socket listeners
    // Tree-related events (treeReplaced, itemUpdated, itemMoved, itemDeleted, itemCreated) 
    // are handled by useRealTimeSync in useTree.jsx to avoid duplicate listeners
    socket.on("reminder:set", handleReminderSet);
    socket.on("reminder:clear", handleReminderClear);
    socket.on("reminder:update", handleReminderUpdate);
    socket.on("reminder:trigger", handleReminderTriggered);

    return () => {
      // Cleanup only reminder listeners
      socket.off("reminder:set", handleReminderSet);
      socket.off("reminder:clear", handleReminderClear);
      socket.off("reminder:update", handleReminderUpdate);
      socket.off("reminder:trigger", handleReminderTriggered);
      socket.off("connect_error");
      socket.off("disconnect");
      disconnectSocket();
    };
  }, [
    currentUser?._id,
    authToken,
    setTreeWithUndo,
    fetchUserTree,
    resetTreeHistory,
    selectedItemId,
    selectItemById,
  ]);

  useEffect(() => {
    const liveSocket = getSocket();
    if (!liveSocket) return;

    liveSocket.on("taskUpdated", ({ itemId, data }) => {
      updateTask(itemId, data);
    });

    liveSocket.on("reminderUpdated", ({ itemId, reminder }) => {
      setReminders((prev) => ({
        ...prev,
        [itemId]: reminder,
      }));
    });

    liveSocket.on("itemContentUpdated", ({ itemId, content }) => {
      updateNoteContent(itemId, { content });
    });

    return () => {
      liveSocket.off("taskUpdated");
      liveSocket.off("reminderUpdated");
      liveSocket.off("itemContentUpdated");
    };
  }, [updateTask, updateNoteContent]);
  const isMobile = useIsMobile();
  const [mobileViewMode, setMobileViewMode] = useState("tree");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
  useEffect(() => {
    reminderMonitor.setSettingsContext(settings);
  }, [settings]);

  // Safari detection and warning
  useEffect(() => {
    const detectSafari = () => {
      const userAgent = navigator.userAgent;
      const vendor = navigator.vendor;
      
      // Check for Safari on all platforms (iOS, macOS, iPadOS)
      const isSafari = /Safari/.test(userAgent) && 
                       /Apple Computer/.test(vendor) && 
                       !/Chrome|Chromium|CriOS|FxiOS|EdgiOS/.test(userAgent);
      
      // Check for WebKit-based browsers on iOS that might have Safari-like behavior
      const isIOSWebView = /iPhone|iPad|iPod/.test(userAgent) && 
                           /WebKit/.test(userAgent) && 
                           !/CriOS|FxiOS|EdgiOS/.test(userAgent);
      
      return isSafari || isIOSWebView;
    };

    const hasShownWarning = localStorage.getItem('safari-warning-dismissed');
    
    if (detectSafari() && !hasShownWarning) {
      setShowSafariWarning(true);
    }
  }, []);

  const [uiMessage, setUiMessage] = useState("");
  const [uiMessageType, setUiMessageType] = useState("error");
  const [showSafariWarning, setShowSafariWarning] = useState(false);

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

  // Interactive notification states
  const [snoozeDialogOpen, setSnoozeDialogOpen] = useState(false);
  const [snoozeDialogData, setSnoozeDialogData] = useState(null);
  const [feedbackNotifications, setFeedbackNotifications] = useState([]);
  
  // Mobile reminder popup state
  const [mobileReminderPopup, setMobileReminderPopup] = useState({
    isVisible: false,
    title: '',
    message: '',
    itemId: null,
    reminderId: null,
    showDoneButton: true
  });

  // Reminder states
  const [reminders, setReminders] = useState({});
  const [isSetReminderDialogOpen, setIsSetReminderDialogOpen] = useState(false);
  const [itemForReminder, setItemForReminder] = useState(null);

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
  const findItemByIdFromTree = useCallback(
    (id) => findItemById(tree, id),
    [tree]
  );
  const findParentAndSiblingsFromTree = useCallback(
    (id) => findParentAndSiblings(tree, id),
    [tree]
  );
  const showMessage = useCallback(
    (message, type = "error", duration = 8000) => {
      setUiMessage(message);
      setUiMessageType(type);
    },
    []
  );
  // Reminder Dialog handlers
  const handleOpenSetReminderDialog = useCallback(
    (item) => {
      if (item) {
        setItemForReminder(item);
        setIsSetReminderDialogOpen(true);
        setContextMenu((m) => ({ ...m, visible: false }));
      }
    },
    [setContextMenu]
  );
  const handleConfirmSetReminder = useCallback(
    async (itemId, timestamp, repeatOptions) => {
      if (!itemId || !timestamp) {
        setIsSetReminderDialogOpen(false);
        return;
      }
      try {
        const { setReminder } = await import("./utils/reminderUtils");
        await setReminder(itemId, timestamp, repeatOptions);
        const itemLabel = itemForReminder?.label || "item";
        showMessage(`Reminder set for "${itemLabel}".`, "success", 3000);
      } catch (error) {
        console.error("Failed to set reminder:", error);
        showMessage("Failed to set reminder.", "error");
      } finally {
        setIsSetReminderDialogOpen(false);
        setItemForReminder(null);
      }
    },
    [itemForReminder, showMessage]
  );
  const handleUiMessageClose = useCallback(() => {
    setUiMessage("");
  }, []);
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
          result = await updateNoteContent(itemId, updates.content, updates.direction);
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
  // Memoize content editor props to prevent unnecessary re-renders
  const contentEditorProps = useMemo(
    () => ({
      item: selectedItem,
      defaultFontFamily: settings.editorFontFamily,
      onSaveItemData: handleSaveItemData,
      reminder: reminders[selectedItemId],
      renderToolbarToggle: (toggleToolbar, showToolbar) => (
        <button
          className="toolbar-toggle-button px-3 py-1 rounded bg-slate-500 text-white hover:bg-slate-600"
          onClick={toggleToolbar}
          style={{ position: 'fixed', bottom: '20px', left: '20px', zIndex: 60 }}
        >
          {showToolbar ? "Hide Toolbar" : "Show Toolbar"}
        </button>
      ),
    }),
    [
      selectedItem,
      settings.editorFontFamily,
      handleSaveItemData,
      reminders,
      selectedItemId,
    ]
  );
  const hasActiveAccess = (user) => {
    if (!user) return false;
    if (user.role === "admin") return true;
    if (user.subscriptionStatus === "active") return true;
    if (
      user.subscriptionStatus === "cancelled" &&
      user.subscriptionEndsAt &&
      new Date(user.subscriptionEndsAt) > new Date()
    ) {
      return true;
    }
    return false;
  };

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
  const handleActualLogout = useCallback(() => {
    clearTokens();
    setCurrentUser(null);
    if (resetTreeHistory) resetTreeHistory([]);
    setUiMessage("");
    setAccountMenuOpen(false);
    setTopMenuOpen(false);
    setMobileMenuOpen(false);
    setIsLoggingOut(false);
    window.location.href = "/";
  }, [resetTreeHistory, setCurrentUser]);
  useEffect(() => {
    initApiClient(handleActualLogout);
  }, [handleActualLogout]);
  useEffect(() => {
    if (fetchUserTree) {
      fetchUserTree();
    }
  }, [fetchUserTree]);
  // Load reminders from localStorage and set up live updates
  useEffect(() => {
    const loadReminders = () => {
      try {
        setReminders(getReminders());
      } catch (error) {
        console.error("Failed to load reminders:", error);
        setReminders({});
      }
    };

    const handleRemindersUpdate = (event) => {
      setReminders(event.detail || getReminders());
    };

    if (currentUser) {
      loadReminders();
      // Listen for immediate updates
      window.addEventListener("remindersUpdated", handleRemindersUpdate);
      // Also poll as a fallback
      const reminderRefreshInterval = setInterval(loadReminders, 8000);

      return () => {
        window.removeEventListener("remindersUpdated", handleRemindersUpdate);
        clearInterval(reminderRefreshInterval);
      };
    } else {
      setReminders({});
    }
  }, [currentUser]);
  // Initialize push notifications and reminder monitoring
  useEffect(() => {
    const initializePushNotifications = async () => {
      try {
        const registration = await registerServiceWorker();
        if (!registration) {
          console.warn("Service worker registration failed");
          return;
        }

        const permission = await requestNotificationPermission();
        if (permission === "granted") {
          console.log("Notification permission granted");

          // 🚨 ADD THIS ENHANCED CHANNEL SETUP HERE:
          console.log("🔔 Setting up enhanced notification channels...");

          // Set up high-priority notification channel (Android Chrome)
          if ("setUserVisibleOnly" in registration.pushManager) {
            registration.pushManager.getSubscription().then((subscription) => {
              if (subscription) {
                console.log("🔔 Enhanced notification channels ready");
              }
            });
          }

          // Request critical notification permissions (if supported)
          if (
            "requestPermission" in Notification &&
            Notification.permission === "default"
          ) {
            const criticalPermission = await Notification.requestPermission();
            console.log(
              "🔔 Critical notification permission:",
              criticalPermission
            );
          }

          const subscription = await subscribePush(registration);
          if (subscription) {
            console.log("Push subscription successful with enhanced channels");
          }
        } else {
          console.warn("Notification permission denied");
        }
      } catch (error) {
        console.error(
          "Failed to initialize enhanced push notifications:",
          error
        );
      }
    };

    if (currentUser) {
      initializePushNotifications();
      reminderMonitor.start();
    }

    return () => {
      if (!currentUser) {
        reminderMonitor.stop();
      }
    };
  }, [currentUser]);

  // Set up event listeners for reminder monitor events
  useEffect(() => {
    const handleShowSnoozeDialog = (event) => {
      const { itemId, reminderId, originalData, onSnooze } = event.detail;
      const itemTitle = findItemByIdFromTree(itemId)?.label || "Untitled";

      setSnoozeDialogData({
        itemId,
        reminderId,
        itemTitle,
        originalData,
        onSnooze,
      });
      setSnoozeDialogOpen(true);
    };

    const handleShowFeedback = (event) => {
      const { message, type } = event.detail;
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      setFeedbackNotifications((prev) => {
        const isDuplicate = prev.some(
          (notif) =>
            notif.message === message &&
            notif.type === type &&
            Date.now() - notif.timestamp < 1000
        );

        if (isDuplicate) {
          return prev;
        }

        return [
          ...prev,
          {
            id,
            message,
            type,
            timestamp: Date.now(),
          },
        ];
      });
    };

    const handleReminderMarkedDone = async (event) => {
      const { itemId } = event.detail;
      const itemTitle = findItemByIdFromTree(itemId)?.label || "Item";

      try {
        const result = await updateTask(itemId, { completed: true });
        if (result && result.success) {
          const successMessage = `✅ "${itemTitle}" marked as done!`;
          const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          setFeedbackNotifications((prev) => {
            const isDuplicate = prev.some(
              (notif) =>
                notif.message === successMessage &&
                notif.type === "success" &&
                Date.now() - notif.timestamp < 2000
            );

            if (isDuplicate) {
              return prev;
            }

            return [
              ...prev,
              {
                id,
                message: successMessage,
                type: "success",
                timestamp: Date.now(),
              },
            ];
          });
        } else {
          showMessage(`Failed to mark "${itemTitle}" as done.`, "error", 3000);
        }
      } catch (error) {
        showMessage(`Error marking "${itemTitle}" as done.`, "error", 3000);
      }
    };

    const handleReminderDismissed = (event) => {
      const { itemId } = event.detail;
      console.log("Reminder dismissed for item:", itemId);
    };

    const handleFocusItem = (event) => {
      const { itemId } = event.detail;
      if (itemId) {
        expandFolderPath(itemId);
        selectItemById(itemId);
        setTimeout(() => {
          const element = document.querySelector(
            `li[data-item-id="${itemId}"]`
          );
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 100);
      }
    };

    // Handle reminder triggered event to show mobile popup and manage system notifications.
    const handleReminderTriggered = (event) => {
      const { itemTitle, notificationData, itemId } = event.detail;

      // Some notifications (e.g. low‑importance drawer replacements) set skipPopup so the
      // in‑app popup is not displayed. Check for that flag and bail early.
      if (notificationData?.skipPopup) {
        console.debug('🔕 Skipping in‑app popup for drawer‑only notification:', itemId);
        return;
      }

      // Only show popup on mobile devices
      const isMobileDevice =
        /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ||
        "ontouchstart" in window ||
        (window.screen && window.screen.width <= 768);

      // Determine if app is currently visible (foreground). When in the foreground,
      // we cancel the system's heads‑up notification and schedule a low‑importance
      // notification in the drawer to avoid duplicate heads‑up alerts.
      const isForeground = document.visibilityState === 'visible';
      if (isForeground) {
        try {
          // Cancel the high‑priority notification so only our in‑app popup remains
          notificationService.cancelNotificationByItem(itemId);
          // Immediately schedule a drawer‑only notification so the user still has
          // a persistent entry to act on later. Pass a minimal reminder object.
          notificationService.scheduleDrawerNotification({
            itemId,
            timestamp: Date.now(),
            itemTitle: itemTitle || 'Untitled',
            originalReminder: notificationData?.originalReminder || null
          });
        } catch (err) {
          console.warn('⚠️ Failed to downgrade notification for item', itemId, err);
        }
      }

      if (isMobileDevice) {
        setMobileReminderPopup({
          isVisible: true,
          title: '⏰ Reminder',
          message: `Don't forget: ${itemTitle || 'Untitled'}`,
          itemId: itemId,
          reminderId: notificationData?.reminderId,
          showDoneButton:
            notificationData?.reminderDisplayDoneButton ?? true,
        });
      }
    };

    const handleUpgradePlanRequest = () => {
      // Navigate to landing page pricing section
      window.location.href = "/#pricing";
    };

    window.addEventListener("reminderTriggered", handleReminderTriggered);
    window.addEventListener("showSnoozeDialog", handleShowSnoozeDialog);
    window.addEventListener("showFeedback", handleShowFeedback);
    window.addEventListener("reminderMarkedDone", handleReminderMarkedDone);
    window.addEventListener("reminderDismissed", handleReminderDismissed);
    window.addEventListener("focusItem", handleFocusItem);
    window.addEventListener("upgrade-plan-requested", handleUpgradePlanRequest);
    return () => {
      window.removeEventListener("reminderTriggered", handleReminderTriggered);
      window.removeEventListener("showSnoozeDialog", handleShowSnoozeDialog);
      window.removeEventListener("showFeedback", handleShowFeedback);
      window.removeEventListener(
        "reminderMarkedDone",
        handleReminderMarkedDone
      );
      window.removeEventListener("reminderDismissed", handleReminderDismissed);
      window.removeEventListener("focusItem", handleFocusItem);
      window.removeEventListener("upgrade-plan-requested", handleUpgradePlanRequest);
    };
  }, [findItemByIdFromTree, expandFolderPath, selectItemById, showMessage]);
  const handleSnoozeConfirm = useCallback(
    (duration, unit) => {
      if (snoozeDialogData && snoozeDialogData.onSnooze) {
        snoozeDialogData.onSnooze(duration, unit);
      } else if (snoozeDialogData) {
        reminderMonitor.applySnooze(
          snoozeDialogData.itemId,
          duration,
          unit,
          snoozeDialogData.originalData
        );
      }
      setSnoozeDialogOpen(false);
      setSnoozeDialogData(null);
    },
    [snoozeDialogData]
  );
  const handleSnoozeCancel = useCallback(() => {
    setSnoozeDialogOpen(false);
    setSnoozeDialogData(null);
  }, []);

  const removeFeedbackNotification = useCallback((id) => {
    setFeedbackNotifications((prev) => prev.filter((notif) => notif.id !== id));
  }, []);
  const handleInitiateLogout = async () => {
    console.log("[Logout] Initiating logout…");
    setIsLoggingOut(true);

    const currentRefreshToken = getRefreshToken();
    console.log("[Logout] Retrieved refresh token:", currentRefreshToken);

    if (currentRefreshToken) {
      try {
        const response = await authFetch("/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken: currentRefreshToken }),
        });
        console.log(
          "[Logout] Backend logout response status:",
          response.status
        );
        const responseBody = await response.json().catch(() => null);
        console.log("[Logout] Backend logout response body:", responseBody);
      } catch (error) {
        console.error(
          "[Logout] Error calling backend logout, proceeding with client-side logout:",
          error
        );
      }
    } else {
      console.warn("[Logout] No refresh token found, skipping backend logout");
    }

    console.log("[Logout] Proceeding with client-side logout");
    handleActualLogout();
  };

  const autoExportIntervalRef = useRef(null);
  const performAutoExportRef = useRef(null);
  useEffect(() => {
    performAutoExportRef.current = () => {
      if (!settings.autoExportEnabled || !currentUser) return;
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
      console.log('🔧 openAddDialog called:', { type, parent: parent?.label || parent, isMobile });
      setNewItemType(type);
      setParentItemForAdd(parent);
      setNewItemLabel("");
      setAddDialogErrorMessage("");
      showMessage("", "error");
      setAddDialogOpen(true);
      console.log('🔧 setAddDialogOpen(true) called');
      setContextMenu((m) => ({ ...m, visible: false }));
      setTopMenuOpen(false);
      setMobileMenuOpen(false);
    },
    [showMessage, setContextMenu, isMobile]
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
  const handleAddWithReminder = useCallback(
    async (reminderData, repeatOptions = null) => {
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
          (sibling) =>
            sibling.label.toLowerCase() === trimmedLabel.toLowerCase()
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
        let finalReminderTime = null;
        if (
          typeof reminderData === "string" &&
          reminderData.startsWith("relative:")
        ) {
          const offset = parseInt(reminderData.split(":")[1], 10);
          if (!isNaN(offset)) {
            finalReminderTime = Date.now() + offset;
          }
        } else if (typeof reminderData === "number") {
          finalReminderTime = reminderData;
        }

        if (finalReminderTime && result.item?.id) {
          const { setReminder } = await import("./utils/reminderUtils");
          setReminder(result.item.id, finalReminderTime, repeatOptions);
          showMessage(
            `${
              newItemType.charAt(0).toUpperCase() + newItemType.slice(1)
            } added with reminder.`,
            "success",
            3000
          );
        } else {
          showMessage(
            `${
              newItemType.charAt(0).toUpperCase() + newItemType.slice(1)
            } added.`,
            "success",
            3000
          );
        }

        setAddDialogOpen(false);
        setNewItemLabel("");
        setParentItemForAdd(null);
        setAddDialogErrorMessage("");
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
    },
    [
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
    ]
  );
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

  // Mobile reminder popup handlers
  const handleMobileReminderDismiss = useCallback(() => {
    setMobileReminderPopup(prev => ({ ...prev, isVisible: false }));
  }, []);

  const handleMobileReminderDone = useCallback(() => {
    const { itemId } = mobileReminderPopup;
    if (itemId) {
      // Mark the task as done
      handleToggleTask(itemId, true);
      // Clear the reminder
      clearReminder(itemId);
      showMessage("Task marked as completed!", "success");
    }
    setMobileReminderPopup(prev => ({ ...prev, isVisible: false }));
  }, [mobileReminderPopup, handleToggleTask, showMessage]);

  const handleMobileReminderSnooze = useCallback((duration, unit) => {
    const { itemId } = mobileReminderPopup;
    if (itemId) {
      reminderMonitor.applySnooze(itemId, duration, unit, {});
    }
    setMobileReminderPopup(prev => ({ ...prev, isVisible: false }));
  }, [mobileReminderPopup]);

  const handleDragEnd = useCallback(() => setDraggedId(null), [setDraggedId]);

  const openExportDialog = useCallback(
    (context) => {
      setExportDialogState({ isOpen: true, context });
      setContextMenu((m) => ({ ...m, visible: false }));
      setTopMenuOpen(false);
      setMobileMenuOpen(false);
    },
    [setContextMenu]
  );
  const openImportDialog = useCallback(
    (context) => {
      setImportDialogState({ isOpen: true, context });
      setContextMenu((m) => ({ ...m, visible: false }));
      setTopMenuOpen(false);
      setMobileMenuOpen(false);
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
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      setContextMenu((m) => ({ ...m, visible: false }));
    },
    [deleteItem, showMessage, setContextMenu, setConfirmDialog]
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
      if (mobileMenuOpen && !e.target.closest(".mobile-menu-container")) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileMenuOpen]);
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
  useEffect(() => {
    if (!isMobile) return;

    // Setup Android back button handler
    setupAndroidBackHandler(isMobile, mobileViewMode, setMobileViewMode, navigate);

    // Also keep web browser back button support
    const handlePopState = (event) => {
      // If we're in content view mode, go back to tree view
      if (mobileViewMode === "content") {
        setMobileViewMode("tree");
        // Push a new state to maintain proper history stack  
        window.history.pushState(
          { viewMode: "tree" },
          "",
          window.location.href
        );
      }
    };

    // Listen for web browser back button events
    window.addEventListener("popstate", handlePopState);

    return () => {
      cleanupAndroidBackHandler();
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isMobile, mobileViewMode, navigate]);
  const handleAccountDisplayClick = () => {
    setAccountMenuOpen((prev) => !prev);
    setTopMenuOpen(false);
  };

  const iconBaseClass = "w-4 h-4 mr-2";
  return (
    <div className="relative flex flex-col h-screen bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 overflow-hidden">
      <BetaBanner />

      <ErrorDisplay
        message={uiMessage}
        currentUser={currentUser}
        type={uiMessageType}
        onClose={handleUiMessageClose}
      />

      {/* Safari Warning Dialog */}
      {showSafariWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-md mx-4 p-6">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="flex-1 overflow-y-auto">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  Browser Compatibility Notice
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4">
                  We've detected you're using Safari. For the best experience with all features, we recommend using <strong>Google Chrome</strong>. 
                  Some advanced functionality may not work properly in Safari.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => {
                      localStorage.setItem('safari-warning-dismissed', 'true');
                      setShowSafariWarning(false);
                    }}
                    className="px-4 py-2 text-sm bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                  >
                    Continue with Safari
                  </button>
                  <button
                    onClick={() => {
                      window.open('https://www.google.com/chrome/', '_blank');
                      localStorage.setItem('safari-warning-dismissed', 'true');
                      setShowSafariWarning(false);
                    }}
                    className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    Download Chrome
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <header
        className={`fixed left-0 right-0 z-30 bg-white dark:bg-zinc-800/95 backdrop-blur-sm shadow-sm ${APP_HEADER_HEIGHT_CLASS}`}
        style={{
          top: "var(--beta-banner-height, 0px)",
        }}
      >
        <div className="md:hidden mobile-menu-container h-full">
          <div className="flex justify-between items-center px-4 py-2 h-full">
            <div className="flex items-center flex-1 min-w-0">
              <img
                src={logo}
                alt="Application Logo"
                className="h-6 w-6 mr-2 flex-shrink-0"
              />
              <h1 className="font-semibold text-sm text-zinc-800 dark:text-zinc-100 truncate">
                Notes & Tasks
              </h1>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {currentUser && currentUser.email && (
                <div className="relative" ref={accountMenuRef}>
                  <LoadingButton
                    onClick={handleAccountDisplayClick}
                    className="flex items-center p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    title={`Account: ${currentUser.email}`}
                    disabled={isLoggingOut}
                    variant="secondary"
                    size="small"
                  >
                    <UserCircle2 className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                  </LoadingButton>
                  {accountMenuOpen && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg z-50 py-1">
                      <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-700">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Signed in as
                        </p>
                        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">
                          {currentUser.email}
                        </p>
                      </div>
                      <LoadingButton
                        onMouseDown={() => {
                          console.log("[UI] Logout button clicked");
                          handleInitiateLogout();
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
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md"
                title="Menu"
                variant="secondary"
                size="small"
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </LoadingButton>
            </div>
          </div>
          {mobileMenuOpen && (
            <div
              role="menu"
              aria-label="Mobile navigation menu"
              className="border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg"
            >
              <div className="px-4 py-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <LoadingButton
                    onClick={() => {
                      undoTreeChange();
                      setMobileMenuOpen(false);
                    }}
                    disabled={!canUndoTree}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border ${
                      !canUndoTree
                        ? "opacity-40 cursor-not-allowed bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                        : "bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-600"
                    }`}
                    variant="secondary"
                    size="small"
                  >
                    <Undo className="w-4 h-4" />
                    <span className="text-sm font-medium">Undo</span>
                  </LoadingButton>
                  <LoadingButton
                    onClick={() => {
                      redoTreeChange();
                      setMobileMenuOpen(false);
                    }}
                    disabled={!canRedoTree}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border ${
                      !canRedoTree
                        ? "opacity-40 cursor-not-allowed bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                        : "bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-600"
                    }`}
                    variant="secondary"
                    size="small"
                  >
                    <Redo className="w-4 h-4" />
                    <span className="text-sm font-medium">Redo</span>
                  </LoadingButton>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <LoadingButton
                    onClick={() => {
                      setSearchSheetOpen(true);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border ${
                      searchSheetOpen
                        ? "bg-blue-100 dark:bg-blue-700/50 border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-300"
                        : "bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-600"
                    }`}
                    variant="secondary"
                    size="small"
                  >
                    <SearchIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">Search</span>
                  </LoadingButton>
                  <LoadingButton
                    onClick={() => {
                      setSettingsDialogOpen(true);
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center justify-center gap-2 p-3 rounded-lg border bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-600"
                    variant="secondary"
                    size="small"
                  >
                    <SettingsIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">Settings</span>
                  </LoadingButton>
                </div>
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 space-y-1">
                  <button
                    role="menuitem"
                    onClick={() => {
                      openAddDialog("folder", null);
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-left text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg"
                  >
                    <Plus className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                    Add Root Folder
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      openExportDialog("tree");
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-left text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg"
                  >
                    <Download className="w-4 h-4 text-teal-500 dark:text-teal-400" />
                    Export Full Tree...
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      openImportDialog("tree");
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-left text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg"
                  >
                    <Upload className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                    Import Full Tree...
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setAboutDialogOpen(true);
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-left text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg"
                  >
                    <Info className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                    About
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="hidden md:block h-full">
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
                          console.log("[UI] Logout button clicked");
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
                  <div
                    role="menu"
                    aria-label="More actions menu"
                    className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg z-40 py-1"
                  >
                    <button
                      role="menuitem"
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
                      role="menuitem"
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
                      role="menuitem"
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
                    <div
                      className="my-1 h-px bg-zinc-200 dark:bg-zinc-700"
                      role="separator"
                    ></div>
                    <button
                      role="menuitem"
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
        </div>
      </header>

      <main
        id="main-content"
        className={`flex-1 flex min-h-0`}
        style={{
          paddingTop: "calc(var(--beta-banner-height, 0px) + 3.5rem)",
        }}
      >
        {isMobile ? (
          <>
            {mobileViewMode === "tree" ? (
              <div className="flex flex-col bg-zinc-50 dark:bg-zinc-800 h-full w-full">
                {/* Tree Controls - Pinned at top */}
                <div className="sticky top-0 z-10 flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-600 shadow-sm">
                  <button
                    onClick={expandAll}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                    title="Expand All Folders"
                  >
                    <ChevronDown className="w-3 h-3" />
                    Expand All
                  </button>
                  <button
                    onClick={collapseAll}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors"
                    title="Collapse All Folders"
                  >
                    <ChevronRight className="w-3 h-3" />
                    Collapse All
                  </button>
                </div>
                <div className="flex-grow overflow-auto w-full">
                  <div className="overflow-x-auto tree-horizontal-scroll">
                    <Tree
                    items={tree || []}
                    selectedItemId={selectedItemId}
                    onSelect={(id) => {
                      console.log("🔵 Mobile tree item selected:", id);

                      // Always select the item first
                      selectItemById(id);

                      // Skip navigation if we're in rename mode
                      if (inlineRenameId) {
                        console.log(
                          "⏸️ Skipping navigation - rename mode active"
                        );
                        return;
                      }

                      // Find the item directly from tree data
                      const findItemInTree = (items, targetId) => {
                        if (!Array.isArray(items)) return null;
                        for (const item of items) {
                          if (item.id === targetId) return item;
                          if (item.children && Array.isArray(item.children)) {
                            const found = findItemInTree(item.children, targetId);
                            if (found) return found;
                          }
                        }
                        return null;
                      };

                      const selectedItem = findItemInTree(tree || [], id);
                      console.log("🔍 Found item:", selectedItem);

                      if (!selectedItem) {
                        console.warn("⚠️ Could not find item with id:", id);
                        return;
                      }

                      // Handle different item types
                      if (selectedItem.type === "folder") {
                        console.log("📁 Folder selected - toggling expansion");
                        toggleFolderExpand(id);
                      } else if (
                        selectedItem.type === "note" ||
                        selectedItem.type === "task"
                      ) {
                        console.log(
                          "📄 Note/Task selected - navigating to content view"
                        );
                        setMobileViewMode("content");
                        window.history.pushState(
                          { viewMode: "content", itemId: id },
                          "",
                          window.location.href
                        );
                      } else {
                        console.log("❓ Unknown item type:", selectedItem.type);
                      }
                    }}
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
                      
                      // Prevent drag if already dragging something
                      if (draggedId) {
                        console.log('❌ Preventing drag start - already dragging:', draggedId);
                        e.preventDefault();
                        return;
                      }
                      
                      // Set drag data
                      e.dataTransfer.setData('text/plain', id);
                      e.dataTransfer.effectAllowed = 'move';
                      
                      // Create a simple but visible drag image
                      const dragElement = e.target.closest('[data-item-id]');
                      if (dragElement) {
                        const rect = dragElement.getBoundingClientRect();
                        e.dataTransfer.setDragImage(dragElement, rect.width / 2, rect.height / 2);
                      }
                      
                      // Set drag state immediately
                      console.log('🎯 Setting draggedId:', id);
                      setDraggedId(id);
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
                </div>
                <AccountPlanStatus user={currentUser} currentItemCount={currentItemCount} />
              </div>
            ) : (
              // Content view remains the same
              <div className="flex-grow flex flex-col">
                {/* Add back button for mobile content view */}
                <div className="flex items-center p-2 bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 md:hidden relative z-50">
                  <button
                    onClick={() => {
                      console.log("🔙 Back button pressed");
                      setMobileViewMode("tree");
                      window.history.pushState(
                        { viewMode: "tree" },
                        "",
                        window.location.href
                      );
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-300 hover:text-zinc-800 dark:hover:text-zinc-100"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                    Back to Tree
                  </button>
                </div>

                {selectedItem ? (
                  selectedItem.type === "folder" ? (
                    <FolderContents
                      folder={selectedItem}
                      onSelect={(id) => selectItemById(id)}
                      handleDragStart={(e, id) => {
                        if (inlineRenameId) e.preventDefault();
                        else setDraggedId(id);
                      }}
                      handleDragEnter={handleDragEnter}
                      handleDragOver={handleDragOver}
                      handleDragLeave={handleDragLeave}
                      handleDrop={(targetId) => handleDrop(targetId, draggedId)}
                      handleDragEnd={handleDragEnd}
                      draggedId={draggedId}
                      dragOverItemId={dragOverItemId}
                      onToggleExpand={toggleFolderExpand}
                      expandedItems={expandedFolders}
                      onShowItemMenu={handleShowItemMenu}
                      reminders={reminders}
                      contextMenu={contextMenu}
                      clipboardItem={clipboardItem}
                      handleAdd={openAddDialog}
                      handleRename={startInlineRename}
                      handleDelete={(item) =>
                        showConfirm({
                          title: `Delete ${
                            item.type.charAt(0).toUpperCase() + item.type.slice(1)
                          }`,
                          message: `Are you sure you want to delete "${item.label}"? This cannot be undone.`,
                          onConfirm: () => handleDeleteConfirm(item.id),
                          variant: "danger",
                          confirmText: "Delete",
                        })
                      }
                      handleCopy={copyItem}
                      handleCut={cutItem}
                      handlePaste={handlePasteWrapper}
                      handleDuplicate={handleDuplicate}
                      handleExport={(context) => openExportDialog(context)}
                      handleImport={(context) => openImportDialog(context)}
                      handleCloseContextMenu={() => setContextMenu((m) => ({ ...m, visible: false }))}
                    />
                  ) : (
                    <div className="flex flex-col h-full">
                      {/* Title Section */}
                      {selectedItem && (
                        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
                          <h1
                            dir={(() => {
                              const titleText = selectedItem?.label || selectedItem?.title || '';
                              if (!titleText) return 'ltr';
                              const rtlChars = /[\u0590-\u08FF]|[\uFB1D-\uFDFF]|[\uFE70-\uFEFF]/g;
                              const rtlMatches = titleText.match(rtlChars) || [];
                              const textForAnalysis = titleText.replace(/[\s\d\p{P}\p{S}a-zA-Z]/gu, "");
                              if (textForAnalysis.length === 0) return 'ltr';
                              const rtlRatio = rtlMatches.length / textForAnalysis.length;
                              return rtlRatio > 0.3 ? 'rtl' : 'ltr';
                            })()}
                            className={`text-xl font-bold title-multiline ${
                              (() => {
                                const titleText = selectedItem?.label || selectedItem?.title || '';
                                const rtlChars = /[\u0590-\u08FF]|[\uFB1D-\uFDFF]|[\uFE70-\uFEFF]/g;
                                const rtlMatches = titleText.match(rtlChars) || [];
                                const textForAnalysis = titleText.replace(/[\s\d\p{P}\p{S}a-zA-Z]/gu, "");
                                const rtlRatio = textForAnalysis.length > 0 ? rtlMatches.length / textForAnalysis.length : 0;
                                return rtlRatio > 0.3 ? 'text-right' : 'text-left';
                              })()
                            } text-zinc-900 dark:text-zinc-100`}
                          >
                            {selectedItem.label || selectedItem.title || "Untitled"}
                          </h1>
                        </div>
                      )}
                      <div className="flex-1 overflow-y-auto">
                        <ContentEditor {...contentEditorProps} />
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
                    Select an item to view or edit
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <PanelGroup direction="vertical">
            <Panel 
              id="main-content-panel" 
              order={0} 
              defaultSize={searchSheetOpen ? 75 : 100} 
              minSize={40}
            >
              <PanelGroup direction="horizontal">
                <Panel id="tree-panel" order={0} defaultSize={30} minSize={20}>
                  <div className="flex flex-col bg-zinc-50 dark:bg-zinc-800 h-full">
                    {/* Tree Controls - Pinned at top */}
                    <div className="sticky top-0 z-10 flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-600 shadow-sm">
                      <button
                        onClick={expandAll}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                        title="Expand All Folders"
                      >
                        <ChevronDown className="w-3 h-3" />
                        Expand All
                      </button>
                      <button
                        onClick={collapseAll}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors"
                        title="Collapse All Folders"
                      >
                        <ChevronRight className="w-3 h-3" />
                        Collapse All
                      </button>
                    </div>
                    <div className="flex-grow overflow-auto">
                      <div className="overflow-x-auto tree-horizontal-scroll">
                        <Tree
                        items={tree || []}
                        selectedItemId={selectedItemId}
                        onSelect={(id) => {
                          selectItemById(id);
                        }}
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
                          
                          // Prevent drag if already dragging something
                          if (draggedId) {
                            console.log('❌ Preventing drag start - already dragging:', draggedId);
                            e.preventDefault();
                            return;
                          }
                          
                          // Set drag data
                          e.dataTransfer.setData('text/plain', id);
                          e.dataTransfer.effectAllowed = 'move';
                          
                          // Create a simple but visible drag image
                          const dragElement = e.target.closest('[data-item-id]');
                          if (dragElement) {
                            const rect = dragElement.getBoundingClientRect();
                            e.dataTransfer.setDragImage(dragElement, rect.width / 2, rect.height / 2);
                          }
                          
                          // Set drag state immediately
                          console.log('🎯 Setting draggedId (search):', id);
                          setDraggedId(id);
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
                    </div>
                    <AccountPlanStatus user={currentUser} currentItemCount={currentItemCount} />
                  </div>
                </Panel>
                <PanelResizeHandle className="w-1 bg-zinc-200 dark:bg-zinc-700 hover:bg-blue-400 dark:hover:bg-blue-600 transition-colors" />
                <Panel
                  id="content-panel"
                  order={1}
                  defaultSize={70}
                  minSize={40}
                  className="flex flex-col"
                >
                  {selectedItem ? (
                    selectedItem.type === "folder" ? (
                      <FolderContents
                        folder={selectedItem}
                        onSelect={(id) => selectItemById(id)}
                        handleDragStart={(e, id) => {
                          if (inlineRenameId) e.preventDefault();
                          else setDraggedId(id);
                        }}
                        handleDragEnter={handleDragEnter}
                        handleDragOver={handleDragOver}
                        handleDragLeave={handleDragLeave}
                        handleDrop={(targetId) => handleDrop(targetId, draggedId)}
                        handleDragEnd={handleDragEnd}
                        draggedId={draggedId}
                        dragOverItemId={dragOverItemId}
                        onToggleExpand={toggleFolderExpand}
                        expandedItems={expandedFolders}
                        onShowItemMenu={handleShowItemMenu}
                        reminders={reminders}
                        contextMenu={contextMenu}
                        clipboardItem={clipboardItem}
                        handleAdd={openAddDialog}
                        handleRename={startInlineRename}
                        handleDelete={(item) =>
                          showConfirm({
                            title: `Delete ${
                              item.type.charAt(0).toUpperCase() + item.type.slice(1)
                            }`,
                            message: `Are you sure you want to delete "${item.label}"? This cannot be undone.`,
                            onConfirm: () => handleDeleteConfirm(item.id),
                            variant: "danger",
                            confirmText: "Delete",
                          })
                        }
                        handleCopy={copyItem}
                        handleCut={cutItem}
                        handlePaste={handlePasteWrapper}
                        handleDuplicate={handleDuplicate}
                        handleExport={(context) => openExportDialog(context)}
                        handleImport={(context) => openImportDialog(context)}
                        handleCloseContextMenu={() => setContextMenu(m => ({ ...m, visible: false }))}
                      />
                  ) : (
                    <div className="flex flex-col h-full">
                      {/* Title Section */}
                      {selectedItem && (
                        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
                          <h1
                            dir={(() => {
                              const titleText = selectedItem?.label || selectedItem?.title || '';
                              if (!titleText) return 'ltr';
                              const rtlChars = /[\u0590-\u08FF]|[\uFB1D-\uFDFF]|[\uFE70-\uFEFF]/g;
                              const rtlMatches = titleText.match(rtlChars) || [];
                              const textForAnalysis = titleText.replace(/[\s\d\p{P}\p{S}a-zA-Z]/gu, "");
                              if (textForAnalysis.length === 0) return 'ltr';
                              const rtlRatio = rtlMatches.length / textForAnalysis.length;
                              return rtlRatio > 0.3 ? 'rtl' : 'ltr';
                            })()}
                            className={`text-xl font-bold title-multiline ${
                              (() => {
                                const titleText = selectedItem?.label || selectedItem?.title || '';
                                const rtlChars = /[\u0590-\u08FF]|[\uFB1D-\uFDFF]|[\uFE70-\uFEFF]/g;
                                const rtlMatches = titleText.match(rtlChars) || [];
                                const textForAnalysis = titleText.replace(/[\s\d\p{P}\p{S}a-zA-Z]/gu, "");
                                const rtlRatio = textForAnalysis.length > 0 ? rtlMatches.length / textForAnalysis.length : 0;
                                return rtlRatio > 0.3 ? 'text-right' : 'text-left';
                              })()
                            } text-zinc-900 dark:text-zinc-100`}
                          >
                            {selectedItem.label || selectedItem.title || "Untitled"}
                          </h1>
                        </div>
                      )}
                      <div className="flex-1 overflow-y-auto">
                        <ContentEditor {...contentEditorProps} />
                      </div>
                    </div>
                    )
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
                      Select an item to view or edit
                    </div>
                  )}
                </Panel>
              </PanelGroup>
            </Panel>
            {searchSheetOpen && (
              <>
                <PanelResizeHandle className="h-1 bg-zinc-200 dark:bg-zinc-700 hover:bg-blue-400 dark:hover:bg-blue-600 transition-colors" />
                <Panel
                  id="search-panel"
                  order={1}
                  defaultSize={25}
                  minSize={15}
                  maxSize={60}
                >
                  <SearchResultsPane
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    searchOptions={searchOptions}
                    setSearchOptions={setSearchOptions}
                    searchResults={searchResults}
                    onSelect={(id) => {
                      selectItemById(id);
                      setSearchSheetOpen(false);
                    }}
                    searchInputRef={searchInputRef}
                    onClose={() => setSearchSheetOpen(false)}
                  />
                </Panel>
              </>
            )}
          </PanelGroup>
        )}
      </main>

      <ContextMenu
        {...contextMenu}
        onClose={() => {
          console.log('ContextMenu onClose called');
          setContextMenu((m) => ({ ...m, visible: false }));
        }}
        onAdd={openAddDialog}
        onRename={startInlineRename}
        onDelete={(item) =>
          showConfirm({
            title: `Delete ${
              item.type.charAt(0).toUpperCase() + item.type.slice(1)
            }`,
            message: `Are you sure you want to delete "${item.label}"? This cannot be undone.`,
            onConfirm: () => handleDeleteConfirm(item.id),
            variant: "danger",
            confirmText: "Delete",
          })
        }
        onCopy={copyItem}
        onCut={cutItem}
        onPaste={handlePasteWrapper}
        onDuplicate={handleDuplicate}
        onSetReminder={handleOpenSetReminderDialog}
        isDuplicating={isDuplicating}
        clipboardItem={clipboardItem}
        onExport={openExportDialog}
        onImport={openImportDialog}
        isMobile={isMobile}
        currentItemCount={currentItemCount}
        maxItems={currentUser?.maxItems || 1000}
        hasActiveAccess={hasActiveAccess(currentUser)}
      />

      <AddDialog
        isOpen={addDialogOpen}
        onClose={() => {
          setAddDialogOpen(false);
          setNewItemLabel("");
          setParentItemForAdd(null);
          setAddDialogErrorMessage("");
        }}
        newItemType={newItemType}
        newItemLabel={newItemLabel}
        setNewItemLabel={setNewItemLabel}
        onAdd={handleAdd}
        onAddWithReminder={handleAddWithReminder}
        errorMessage={addDialogErrorMessage}
      />

      <AboutDialog
        isOpen={aboutDialogOpen}
        onClose={() => setAboutDialogOpen(false)}
      />

      <ExportDialog
        isOpen={exportDialogState.isOpen}
        onClose={() => setExportDialogState({ isOpen: false, context: null })}
        onExport={handleExport}
        context={exportDialogState.context}
        defaultFormat={settings.defaultExportFormat}
      />

      <ImportDialog
        isOpen={importDialogState.isOpen}
        onClose={() => setImportDialogState({ isOpen: false, context: null })}
        context={importDialogState.context}
        onImport={handleFileImport}
        selectedItem={selectedItem}
      />

      <SettingsDialog
        isOpen={settingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        autoExportIntervalRef={autoExportIntervalRef}
        performAutoExport={performAutoExportRef.current}
      />

      <SnoozeDialog
        isOpen={snoozeDialogOpen}
        onSnooze={handleSnoozeConfirm}
        onClose={handleSnoozeCancel}
        itemTitle={snoozeDialogData?.itemTitle}
      />

      <SetReminderDialog
        isOpen={isSetReminderDialogOpen}
        onClose={() => {
          setIsSetReminderDialogOpen(false);
          setItemForReminder(null);
        }}
        onSetReminder={handleConfirmSetReminder}
        item={itemForReminder}
      />
      <MobileReminderPopup
        isVisible={mobileReminderPopup.isVisible}
        title={mobileReminderPopup.title}
        message={mobileReminderPopup.message}
        onDismiss={handleMobileReminderDismiss}
        onMarkDone={handleMobileReminderDone}
        onSnooze={handleMobileReminderSnooze}
        showDoneButton={mobileReminderPopup.showDoneButton}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={confirmDialog.onCancel}
        variant={confirmDialog.variant}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
      />

      {isMobile && (
        <Sheet
          isOpen={searchSheetOpen}
          onClose={() => setSearchSheetOpen(false)}
          snapPoints={[0.95, 0.5, 0]}
          initialSnap={0}
          detent="full-height"
        >
          <Sheet.Container>
            <Sheet.Header>
              <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
                <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
                  Search
                </h2>
                <LoadingButton
                  onClick={() => setSearchSheetOpen(false)}
                  className="p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full"
                  variant="secondary"
                  size="small"
                >
                  <X className="w-5 h-5" />
                </LoadingButton>
              </div>
            </Sheet.Header>
            <Sheet.Content>
              <SearchResultsPane
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchOptions={searchOptions}
                setSearchOptions={setSearchOptions}
                searchResults={searchResults}
                onSelect={(id) => {
                  selectItemById(id);
                  setSearchSheetOpen(false);
                  setMobileViewMode("content");
                  window.history.pushState(
                    { viewMode: "content", itemId: id },
                    "",
                    window.location.href
                  );
                }}
                searchInputRef={searchInputRef}
                onClose={() => setSearchSheetOpen(false)}
              />
            </Sheet.Content>
          </Sheet.Container>
          <Sheet.Backdrop />
        </Sheet>
      )}

      {feedbackNotifications.map((notification) => (
        <FeedbackNotification
          key={notification.id}
          message={notification.message}
          type={notification.type}
          onClose={() => removeFeedbackNotification(notification.id)}
        />
      ))}
    </div>
  );
};

export default App;